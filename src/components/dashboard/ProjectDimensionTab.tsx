
import { useMemo, useState, useEffect } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis,
  YAxis
} from 'recharts';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonthPicker } from './MonthPicker';

type Period = 'monthly' | 'quarterly' | 'semiannually' | 'annually' | 'custom';
type InvestmentDealCategory = 'Corporate Matter' | 'IPO' | 'M&A';

const InvestmentLegalCenterAnalysis = ({ data }: { data: any[] }) => {
  const [period, setPeriod] = useState<Period>('monthly');
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedPeriodValue, setSelectedPeriodValue] = useState<string | null>(null);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);

  const teamData = useMemo(() => data.filter(row => row && row['团队'] === '投资法务中心'), [data]);

  const { availableYears, periodOptions } = useMemo(() => {
    const validData = teamData.filter(row => row && row['Month']);
    if (!validData || validData.length === 0) {
      return { availableYears: [], periodOptions: {} };
    }
    const years = [...new Set(validData.map(row => new Date(row['Month'].toString() + '/01').getFullYear()))].filter(year => !isNaN(year));
    const sortedYears = years.sort((a, b) => b - a);

    const options: any = {
      monthly: Array.from({ length: 12 }, (_, i) => ({ value: i.toString(), label: `${i + 1}月` })),
      quarterly: [
        { value: '0', label: '第一季度' },
        { value: '1', label: '第二季度' },
        { value: '2', label: '第三季度' },
        { value: '3', label: '第四季度' },
      ],
      semiannually: [
        { value: '0', label: '上半年' },
        { value: '1', label: '下半年' },
      ],
      annually: [],
      custom: [],
    };
    return { availableYears: sortedYears.map(y => y.toString()), periodOptions: options };
  }, [teamData]);

  useEffect(() => {
    if (availableYears.length > 0 && !selectedYear) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  useEffect(() => {
    setSelectedPeriodValue(null);
  }, [period]);


  const processedData = useMemo(() => {
    // --- 1. TIME FILTERING ---
    const timeFilteredData = teamData.filter(row => {
        try {
            if (!row || !row['Month']) return false;
            
            const [yearStr, monthStr] = row['Month'].toString().split('/');
            const yearNum = parseInt(yearStr, 10);
            const monthNum = parseInt(monthStr, 10);
            if (isNaN(yearNum) || isNaN(monthNum)) return false;
            
            const rowDate = new Date(Date.UTC(yearNum, monthNum - 1, 1));
            if (isNaN(rowDate.getTime())) return false;

            if (period === 'custom') {
                if (!customStartDate || !customEndDate) return false;
                const startUTC = new Date(Date.UTC(customStartDate.getFullYear(), customStartDate.getMonth(), 1));
                const endUTC = new Date(Date.UTC(customEndDate.getFullYear(), customEndDate.getMonth() + 1, 0));
                return rowDate >= startUTC && rowDate <= endUTC;

            } else if (selectedYear) {
                const year = parseInt(selectedYear, 10);
                let startMonth = 0;
                let endMonth = 11;

                if (period !== 'annually' && selectedPeriodValue !== null) {
                    const val = parseInt(selectedPeriodValue, 10);
                    switch (period) {
                        case 'monthly': startMonth = endMonth = val; break;
                        case 'quarterly': startMonth = val * 3; endMonth = startMonth + 2; break;
                        case 'semiannually': startMonth = val * 6; endMonth = startMonth + 5; break;
                    }
                }
                const startDate = new Date(Date.UTC(year, startMonth, 1));
                const endDate = new Date(Date.UTC(year, endMonth + 1, 0));
                return rowDate >= startDate && rowDate <= endDate;
            }
            return false; // Default to no data if conditions not met
        } catch {
            return false;
        }
    });

    // --- 2. DATA CLEANING, MAPPING & AGGREGATION ---
    const centerData = timeFilteredData.filter(row => {
      if (!row || typeof row !== 'object') return false;
      const hours = Number(row['Hours']);
      return !(isNaN(hours) || hours <= 0 || !row['Deal/Matter Name'] || !row['Deal/Matter Category']);
    });

    const businessTypeMapping = {
      'Corporate Matter': ['Investment Related - Corporate Matter'],
      'IPO': ['Investment Related - IPO'],
      'M&A': ['Investment Related - M&A Deal', 'Investment Related - M&A Matter']
    };

    const allProjects: { originalName: string; hours: number; category: InvestmentDealCategory }[] = [];

    for (const [finalCategory, sourceCategories] of Object.entries(businessTypeMapping)) {
      const categoryData = centerData.filter(row => sourceCategories.includes(row['Deal/Matter Category']));
      const projectHoursMap = new Map<string, { originalName: string; hours: number }>();
      
      categoryData.forEach(row => {
        const dealName = row['Deal/Matter Name'].toString();
        const normalizedName = dealName.trim().replace(/\s+/g, ' ').toLowerCase();
        const hours = Number(row['Hours']);

        const existing = projectHoursMap.get(normalizedName);
        if (existing) {
          existing.hours += hours;
        } else {
          projectHoursMap.set(normalizedName, { originalName: dealName, hours });
        }
      });

      projectHoursMap.forEach((value) => {
        allProjects.push({
          ...value,
          category: finalCategory as InvestmentDealCategory,
        });
      });
    }

    // --- 3. CHART DATA PREPARATION ---
    const totalHoursByCategory = { 'Corporate Matter': 0, 'IPO': 0, 'M&A': 0 };
    allProjects.forEach(p => { totalHoursByCategory[p.category] += p.hours; });
    const totalHoursData = Object.entries(totalHoursByCategory).map(([name, hours]) => ({ name, hours })).sort((a, b) => a.hours - b.hours);

    const top10Data = [...allProjects]
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10)
      .map((p, i) => ({ ...p, rank: i + 1, name: p.originalName }))
      .reverse();

    const categoryChartData: any = {};
    const categoryXMapping: Record<string, number> = { 'Corporate Matter': 0, 'IPO': 1, 'M&A': 2 };
    const categoryColors: Record<string, string> = { 'Corporate Matter': '#4C72B0', 'IPO': '#55A868', 'M&A': '#C44E52' };
    const allScatterPoints: any[] = [];

    (['Corporate Matter', 'IPO', 'M&A'] as InvestmentDealCategory[]).forEach(cat => {
      const projects = allProjects.filter(p => p.category === cat);
      let statsSummary = { count: 0, median: 'N/A', average: 'N/A' };

      if (projects.length > 0) {
        const hours = projects.map(p => p.hours).sort((a, b) => a - b);
        const median = hours[Math.floor(hours.length / 2)];
        const mean = hours.reduce((a, b) => a + b, 0) / hours.length;
        statsSummary = {
          count: projects.length,
          median: median ? median.toFixed(1) : '0.0',
          average: mean ? mean.toFixed(1) : '0.0',
        };
        projects.forEach(p => {
          allScatterPoints.push({
            name: p.originalName,
            hours: p.hours,
            x: categoryXMapping[cat] + (Math.random() - 0.5) * 0.6,
            category: cat
          });
        });
      }
      categoryChartData[cat] = { statsSummary };
    });

    return { totalHoursData, top10Data, categoryChartData, categoryXMapping, categoryColors, allScatterPoints };
  }, [teamData, period, selectedYear, selectedPeriodValue, customStartDate, customEndDate]);
  
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      if (data && data.name) {
        return (
          <div className="p-2 border bg-background rounded shadow-lg text-sm">
            <p className="font-bold">{data.name}</p>
            <p>{`Duration: ${data.hours.toFixed(1)}h`}</p>
          </div>
        );
      }
    }
    return null;
  };

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload || !payload.category) return null;
    const color = processedData.categoryColors[payload.category];
    return <circle cx={cx} cy={cy} r={5} fill={color} opacity={0.6} />;
  };

  const renderDistributionChart = (categories: InvestmentDealCategory[], title: string, yMax: number) => {
    const statsData = Object.fromEntries(categories.map(cat => [cat, processedData.categoryChartData[cat]?.statsSummary]));
    const ticks = categories.map(cat => processedData.categoryXMapping[cat]);
    const tickFormatter = (value: number) => Object.keys(processedData.categoryXMapping).find(key => processedData.categoryXMapping[key] === value) || '';

    return (
      <Card>
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent className="flex">
          <ResponsiveContainer width="70%" height={400}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="x" name="Deal/Matter Category" ticks={ticks} tickFormatter={tickFormatter} domain={['dataMin - 0.5', 'dataMax + 0.5']} />
              <YAxis type="number" dataKey="hours" name="Duration" unit="h" domain={[0, yMax]} />
              <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
              <Legend />
              {categories.map(cat => (
                <Scatter key={`${cat}-legend`} name={cat} data={[]} fill={processedData.categoryColors[cat]} legendType="circle" />
              ))}
              <Scatter 
                isAnimationActive={false}
                name='Data' 
                data={processedData.allScatterPoints ? processedData.allScatterPoints.filter(p => categories.includes(p.category)) : []} 
                shape={<CustomDot />} 
                legendType='none'
              />
            </ScatterChart>
          </ResponsiveContainer>
          <div className="w-30% p-4 text-xs">
            {categories.map(cat => statsData[cat] && (
              <div key={cat} className="mb-4">
                <p className="font-bold">{cat}:</p>
                <p>Projects: {(statsData[cat] as any).count}</p>
                <p>Median: {(statsData[cat] as any).median}h</p>
                <p>Average: {(statsData[cat] as any).average}h</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 mb-4 flex-wrap">
        <Button variant={period === 'monthly' ? 'secondary' : 'outline'} onClick={() => setPeriod('monthly')}>月度</Button>
        <Button variant={period === 'quarterly' ? 'secondary' : 'outline'} onClick={() => setPeriod('quarterly')}>季度</Button>
        <Button variant={period === 'semiannually' ? 'secondary' : 'outline'} onClick={() => setPeriod('semiannually')}>半年度</Button>
        <Button variant={period === 'annually' ? 'secondary' : 'outline'} onClick={() => setPeriod('annually')}>年度</Button>
        <Button variant={period === 'custom' ? 'secondary' : 'outline'} onClick={() => setPeriod('custom')}>自定义</Button>
        
        {period !== 'custom' && availableYears.length > 0 && (
          <Select value={selectedYear || ''} onValueChange={(val) => setSelectedYear(val)}>
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="选择年份" /></SelectTrigger>
            <SelectContent>{availableYears.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}</SelectContent>
          </Select>
        )}

        {period !== 'annually' && period !== 'custom' && selectedYear && periodOptions[period] && (
            <Select value={selectedPeriodValue || ''} onValueChange={(val) => setSelectedPeriodValue(val)}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder={`选择${period === 'monthly' ? '月份' : period === 'quarterly' ? '季度' : '半年度'}`} /></SelectTrigger>
                <SelectContent>{(periodOptions[period] as any[]).map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
        )}

        {period === 'custom' && (
          <div className="flex items-center space-x-2">
            <MonthPicker value={customStartDate} onChange={setCustomStartDate} />
            <MonthPicker value={customEndDate} onChange={setCustomEndDate} />
          </div>
        )}
      </div>
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
        <Card>
          <CardHeader><CardTitle>1. Total Hours by Deal/Matter Category</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={processedData.totalHoursData} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={80} />
                <Tooltip formatter={(value: number) => [value.toFixed(1) + 'h', 'Total Hours']} />
                <Bar dataKey="hours" fill="#C44E52" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>2. Top 10 Deals/Matters Ranking by Hours Spent</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={processedData.top10Data} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                <Tooltip formatter={(value: number, _name, props) => [`${value.toFixed(1)}h (Rank #${11 - (props.payload.rank || 0)})`, 'Hours']} />
                <Bar dataKey="hours" name="Hours" fill="#C44E52" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      {renderDistributionChart(['Corporate Matter', 'IPO'], '2. Hour Distribution by Deal/Matter Category (Corporate Matter & IPO)', 250)}
      {renderDistributionChart(['M&A'], '3. Hour Distribution by Deal/Matter Category (M&A)', 1200)}
    </div>
  );
}

const CorporateFinanceCenterAnalysis = ({ data }: { data: any[] }) => {
  const [period, setPeriod] = useState<Period>('monthly');
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedPeriodValue, setSelectedPeriodValue] = useState<string | null>(null);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);

  const teamFilteredData = useMemo(() => data.filter(row => row && row['团队'] === '公司及国际金融事务中心'), [data]);

  const { availableYears, periodOptions } = useMemo(() => {
    const validData = teamFilteredData.filter(row => row && row['Month']);
    if (!validData || validData.length === 0) {
      return { availableYears: [], periodOptions: {} };
    }
    const years = [...new Set(validData.map(row => new Date(row['Month'].toString() + '/01').getFullYear()))].filter(year => !isNaN(year));
    const sortedYears = years.sort((a, b) => b - a);

    const options: any = {
      monthly: Array.from({ length: 12 }, (_, i) => ({ value: i.toString(), label: `${i + 1}月` })),
      quarterly: [
        { value: '0', label: '第一季度' },
        { value: '1', label: '第二季度' },
        { value: '2', label: '第三季度' },
        { value: '3', label: '第四季度' },
      ],
      semiannually: [
        { value: '0', label: '上半年' },
        { value: '1', label: '下半年' },
      ],
      annually: [],
      custom: [],
    };
    return { availableYears: sortedYears.map(y => y.toString()), periodOptions: options };
  }, [teamFilteredData]);

  useEffect(() => {
    if (availableYears.length > 0 && !selectedYear) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  useEffect(() => {
    setSelectedPeriodValue(null);
  }, [period]);

  const heatmapData = useMemo(() => {
    // --- 1. TIME FILTERING ---
    const timeFilteredData = teamFilteredData.filter(row => {
        try {
            if (!row || !row['Month']) return false;
            
            const [yearStr, monthStr] = row['Month'].toString().split('/');
            const yearNum = parseInt(yearStr, 10);
            const monthNum = parseInt(monthStr, 10);
            if (isNaN(yearNum) || isNaN(monthNum)) return false;
            
            const rowDate = new Date(Date.UTC(yearNum, monthNum - 1, 1));
            if (isNaN(rowDate.getTime())) return false;

            if (period === 'custom') {
                if (!customStartDate || !customEndDate) return false;
                const startUTC = new Date(Date.UTC(customStartDate.getFullYear(), customStartDate.getMonth(), 1));
                const endUTC = new Date(Date.UTC(customEndDate.getFullYear(), customEndDate.getMonth() + 1, 0));
                return rowDate >= startUTC && rowDate <= endUTC;

            } else if (selectedYear) {
                const year = parseInt(selectedYear, 10);
                let startMonth = 0;
                let endMonth = 11;

                if (period !== 'annually' && selectedPeriodValue !== null) {
                    const val = parseInt(selectedPeriodValue, 10);
                    switch (period) {
                        case 'monthly': startMonth = endMonth = val; break;
                        case 'quarterly': startMonth = val * 3; endMonth = startMonth + 2; break;
                        case 'semiannually': startMonth = val * 6; endMonth = startMonth + 5; break;
                    }
                }
                const startDate = new Date(Date.UTC(year, startMonth, 1));
                const endDate = new Date(Date.UTC(year, endMonth + 1, 0));
                return rowDate >= startDate && rowDate <= endDate;
            }
            return false;
        } catch {
            return false;
        }
    });

    // --- 2. DATA PROCESSING FOR HEATMAP ---
    if (!timeFilteredData || timeFilteredData.length === 0) {
        return { error: 'no_team_data' }; 
    }

    const firstRow = timeFilteredData[0];
    const hasOriginalColumns = 'Virtual Group' in firstRow && 'Internal Client' in firstRow;
    const hasMappedColumns = 'Deal/Matter Category' in firstRow && 'Deal/Matter Name' in firstRow;

    if (!hasOriginalColumns && !hasMappedColumns) {
        return { error: 'missing_columns', missing: ['Virtual Group', 'Internal Client'] };
    }

    const excludedGroups = ['International Regulatory Legal and Compliance', 'International Employment'];

    const cleanedData = timeFilteredData.map(row => {
        const rawVirtualGroup = row['Virtual Group'] || row['Deal/Matter Category'];
        const rawInternalClient = row['Internal Client'] || row['Deal/Matter Name'];
        
        const virtualGroup = rawVirtualGroup ? rawVirtualGroup.trim().replace(/\s+/g, ' ') : null;
        const internalClient = rawInternalClient ? rawInternalClient.trim().replace(/\s+/g, ' ') : null;
        
        const hours = Number(row['Hours']);

        if (!virtualGroup || !internalClient || isNaN(hours) || hours <= 0) return null;
        if (excludedGroups.includes(virtualGroup)) return null;

        return { ...row, virtualGroup, internalClient, hours };
    }).filter((row): row is Exclude<typeof row, null> => row !== null);

    if (cleanedData.length === 0) {
        return { error: 'no_display_data' };
    }

    const pivotTable = new Map<string, Map<string, number>>();
    cleanedData.forEach(row => {
      const vg = row.virtualGroup;
      const ic = row.internalClient;
      const hours = row.hours;

      if (!pivotTable.has(vg)) {
        pivotTable.set(vg, new Map());
      }
      const clientMap = pivotTable.get(vg)!;
      clientMap.set(ic, (clientMap.get(ic) || 0) + hours);
    });

    const clientTotals = new Map<string, number>();
    pivotTable.forEach(clientMap => {
      clientMap.forEach((hours, client) => {
        clientTotals.set(client, (clientTotals.get(client) || 0) + hours);
      });
    });

    const colLabels = Array.from(clientTotals.keys()).filter(client => (clientTotals.get(client) || 0) > 5);

    const formatVgName = (name: string) => {
      if (name.includes('Listing Rules and Corporate Governance')) {
        return 'Listing Rules and\nCorporate Governance';
      }
      return name;
    };

    const rowLabels = Array.from(pivotTable.keys()).sort().map(formatVgName);

    if (rowLabels.length === 0 || colLabels.length === 0) {
      return { error: 'no_display_data' };
    }

    let maxHours = 0;
    pivotTable.forEach(clientMap => {
      clientMap.forEach((hours, client) => {
        if (colLabels.includes(client) && hours > maxHours) {
          maxHours = hours;
        }
      });
    });

    return { pivotTable, rowLabels, colLabels, maxHours, error: null };
  }, [teamFilteredData, period, selectedYear, selectedPeriodValue, customStartDate, customEndDate]);

  const renderContent = () => {
    if (!heatmapData || heatmapData.error) {
      let message;
      switch (heatmapData?.error) {
        case 'no_team_data':
          message = '没有找到"公司及国际金融事务中心"在指定时期的数据。';
          break;
        case 'missing_columns':
          message = `数据文件缺少必要的列: ${heatmapData.missing?.join(', ') || ''}。请检查文件是否为"公司及国际金融事务中心"的正确工时记录。`;
          break;
        case 'no_display_data':
          message = '根据当前筛选条件，没有可用于生成热力图的数据。可能是所有数据的工时都过低或已被排除。'
          break;
        default:
          message = '加载热力图时发生未知错误。'
      }
      return <div className="p-4 text-center text-muted-foreground">{message}</div>;
    }

    const { pivotTable, rowLabels, colLabels, maxHours } = heatmapData;

    const getColor = (hours: number, max: number = 0) => {
      if (hours === 0 || max === 0) return 'transparent';
      const percent = Math.sqrt(hours / max);
      const hue = 210 - (100 * percent);
      const lightness = 95 - (65 * percent);
      return `hsl(${hue}, 90%, ${lightness}%)`;
    };

    const getOriginalVgName = (formattedName: string) => {
      return formattedName.replace('\n', ' ');
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle>Internal Clients by Virtual Groups Distribution Heatmap</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="text-left">
                <th className="sticky left-0 z-10 bg-card p-2 border-b border-r font-bold">Virtual Groups</th>
                {colLabels?.map(client => (
                  <th key={client} className="p-2 border-b font-bold whitespace-nowrap">{client}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowLabels?.map(vgFormatted => {
                const vgOriginal = getOriginalVgName(vgFormatted);
                const clientMap = pivotTable?.get(vgOriginal);
                return (
                  <tr key={vgFormatted}>
                    <td className="sticky left-0 z-10 bg-card p-2 border-b border-r font-bold whitespace-pre-wrap">{vgFormatted.replace(/\n/g, '\n')}</td>
                    {colLabels?.map(client => {
                      const hours = clientMap?.get(client) || 0;
                      return (
                        <td 
                          key={client} 
                          className="border-b p-2 text-center"
                          style={{ backgroundColor: getColor(hours, maxHours || 0) }}
                        >
                          {hours > 0 ? hours.toFixed(1) : ''}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 mb-4 flex-wrap">
        <Button variant={period === 'monthly' ? 'secondary' : 'outline'} onClick={() => setPeriod('monthly')}>月度</Button>
        <Button variant={period === 'quarterly' ? 'secondary' : 'outline'} onClick={() => setPeriod('quarterly')}>季度</Button>
        <Button variant={period === 'semiannually' ? 'secondary' : 'outline'} onClick={() => setPeriod('semiannually')}>半年度</Button>
        <Button variant={period === 'annually' ? 'secondary' : 'outline'} onClick={() => setPeriod('annually')}>年度</Button>
        <Button variant={period === 'custom' ? 'secondary' : 'outline'} onClick={() => setPeriod('custom')}>自定义</Button>
        
        {period !== 'custom' && availableYears.length > 0 && (
          <Select value={selectedYear || ''} onValueChange={(val) => setSelectedYear(val)}>
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="选择年份" /></SelectTrigger>
            <SelectContent>{availableYears.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}</SelectContent>
          </Select>
        )}

        {period !== 'annually' && period !== 'custom' && selectedYear && periodOptions[period] && (
            <Select value={selectedPeriodValue || ''} onValueChange={(val) => setSelectedPeriodValue(val)}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder={`选择${period === 'monthly' ? '月份' : period === 'quarterly' ? '季度' : '半年度'}`} /></SelectTrigger>
                <SelectContent>{(periodOptions[period] as any[]).map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
        )}

        {period === 'custom' && (
          <div className="flex items-center space-x-2">
            <MonthPicker value={customStartDate} onChange={setCustomStartDate} />
            <MonthPicker value={customEndDate} onChange={setCustomEndDate} />
          </div>
        )}
      </div>
      {renderContent()}
    </div>
  );
};

export const ProjectDimensionTab = ({ data }: { data: any[] }) => {
  return (
    <Tabs defaultValue="investment-legal">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="investment-legal">投资法务中心</TabsTrigger>
        <TabsTrigger value="corporate-finance">公司及国际金融事务中心</TabsTrigger>
      </TabsList>
      <TabsContent value="investment-legal">
        <InvestmentLegalCenterAnalysis data={data} />
      </TabsContent>
      <TabsContent value="corporate-finance">
        <CorporateFinanceCenterAnalysis data={data} />
      </TabsContent>
    </Tabs>
  )
}
