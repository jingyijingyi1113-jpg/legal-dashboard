
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
import { fieldsMatch, createNormalizedKey } from '@/lib/date-utils';

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

    // Use case-insensitive matching for business type mapping
    const businessTypeMapping: { [key: string]: string[] } = {
      'Corporate Matter': ['Investment Related - Corporate Matter'],
      'IPO': ['Investment Related - IPO'],
      'M&A': ['Investment Related - M&A Deal', 'Investment Related - M&A Matter']
    };

    const allProjects: { originalName: string; hours: number; category: InvestmentDealCategory }[] = [];

    for (const [finalCategory, sourceCategories] of Object.entries(businessTypeMapping)) {
      // Use case-insensitive matching for category filtering
      const categoryData = centerData.filter(row => {
        const rowCategory = row['Deal/Matter Category']?.toString();
        return sourceCategories.some(srcCat => fieldsMatch(srcCat, rowCategory));
      });
      const projectHoursMap = new Map<string, { originalName: string; hours: number }>();
      
      categoryData.forEach(row => {
        const dealName = row['Deal/Matter Name'].toString();
        const normalizedName = createNormalizedKey(dealName);
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
      <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <CardHeader className="pb-2 border-b border-slate-200/50 dark:border-slate-700/50">
          <CardTitle className="text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex pt-6">
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
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* Chart 1: Total Hours by Category - Modern Gradient Design */}
        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          <CardHeader className="pb-2 border-b border-slate-200/50 dark:border-slate-700/50">
            <CardTitle className="text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">
              Total Hours by Deal/Matter Category
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={processedData.totalHoursData} layout="vertical" margin={{ left: 20, right: 30, top: 10, bottom: 10 }}>
                <defs>
                  {/* IPO - green color (match scatter plot) */}
                  <linearGradient id="barGradientIPO" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#55A868" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#6bbe7a" stopOpacity={1} />
                  </linearGradient>
                  {/* Corporate Matter - blue color (match scatter plot) */}
                  <linearGradient id="barGradientCorporate" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#4C72B0" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#6b8fc7" stopOpacity={1} />
                  </linearGradient>
                  {/* M&A - red color (match scatter plot) */}
                  <linearGradient id="barGradientMA" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#C44E52" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#d4696c" stopOpacity={1} />
                  </linearGradient>
                  <filter id="shadow1" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="2" dy="2" stdDeviation="3" floodOpacity="0.15" />
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} horizontal={true} vertical={false} />
                <XAxis 
                  type="number" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                  tickFormatter={(value) => `${value}h`}
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  width={130} 
                  axisLine={false} 
                  tickLine={false}
                  tick={(props: any) => {
                    const { x, y, payload } = props;
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text x={-8} y={0} dy={4} textAnchor="end" fill="#334155" fontSize={12} fontWeight={600} style={{ whiteSpace: 'nowrap' }}>
                          {payload.value}
                        </text>
                      </g>
                    );
                  }}
                />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(1)} hours`, 'Total']}
                  contentStyle={{ 
                    backgroundColor: 'rgba(255,255,255,0.98)', 
                    border: 'none', 
                    borderRadius: '12px', 
                    boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                    padding: '12px 16px'
                  }}
                  labelStyle={{ fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}
                  itemStyle={{ color: '#0ea5e9', fontWeight: 600 }}
                  cursor={{ fill: 'rgba(14, 165, 233, 0.08)' }}
                />
                <Bar 
                  dataKey="hours" 
                  radius={[0, 8, 8, 0]}
                  filter="url(#shadow1)"
                  animationDuration={800}
                  animationEasing="ease-out"
                  shape={(props: any) => {
                    const { x, y, width, height, payload } = props;
                    let fillUrl = 'url(#barGradientIPO)';
                    if (payload.name === 'Corporate Matter') fillUrl = 'url(#barGradientCorporate)';
                    else if (payload.name === 'M&A') fillUrl = 'url(#barGradientMA)';
                    return <rect x={x} y={y} width={width} height={height} fill={fillUrl} rx={8} ry={8} filter="url(#shadow1)" />;
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
            {/* Summary Stats - colors match scatter plot */}
            <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/50 flex justify-around">
              {processedData.totalHoursData.map((item: any) => {
                // Match scatter plot colors: Corporate Matter=#4C72B0(blue), IPO=#55A868(green), M&A=#C44E52(red)
                let colorStyle = { color: '#55A868' }; // IPO - green
                if (item.name === 'Corporate Matter') colorStyle = { color: '#4C72B0' }; // blue
                else if (item.name === 'M&A') colorStyle = { color: '#C44E52' }; // red
                return (
                  <div key={item.name} className="text-center">
                    <div className="text-lg font-bold" style={colorStyle}>
                      {item.hours.toFixed(0)}h
                    </div>
                    <div className="text-xs text-slate-500 font-medium whitespace-nowrap">{item.name}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Chart 2: Top 10 Ranking - Light theme to match left */}
        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          <CardHeader className="pb-2 border-b border-slate-200/50 dark:border-slate-700/50">
            <CardTitle className="text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">
              Top 10 Deals/Matters Ranking
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 pb-2">
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={processedData.top10Data} layout="vertical" margin={{ left: 10, right: 50, top: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="rankGradientGold" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity={1} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={1} />
                  </linearGradient>
                  <linearGradient id="rankGradientSilver" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#94a3b8" stopOpacity={1} />
                    <stop offset="100%" stopColor="#cbd5e1" stopOpacity={1} />
                  </linearGradient>
                  <linearGradient id="rankGradientBronze" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#d97706" stopOpacity={1} />
                    <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient id="rankGradientBlue" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#93c5fd" stopOpacity={1} />
                  </linearGradient>
                  <filter id="shadow2" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="2" dy="2" stdDeviation="2" floodOpacity="0.1" />
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} horizontal={true} vertical={false} />
                <XAxis 
                  type="number" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
                  tickFormatter={(value) => `${value}h`}
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  tick={(props: any) => {
                    const { x, y, payload } = props;
                    const item = processedData.top10Data.find((d: any) => d.name === payload.value);
                    const actualRank = item ? 11 - item.rank : 0;
                    const medalColors: Record<number, string> = { 1: '#f59e0b', 2: '#64748b', 3: '#d97706' };
                    const displayName = payload.value.length > 10 ? payload.value.substring(0, 10) + '...' : payload.value;
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text x={-8} y={0} dy={4} textAnchor="end" fill={actualRank <= 3 ? medalColors[actualRank] : '#475569'} fontSize={11} fontWeight={actualRank <= 3 ? 700 : 500}>
                          {displayName}
                        </text>
                      </g>
                    );
                  }}
                  width={110}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  formatter={(value: number, _name, props) => {
                    const actualRank = 11 - (props.payload.rank || 0);
                    return [`${value.toFixed(1)} hours`, `Rank #${actualRank}`];
                  }}
                  contentStyle={{ 
                    backgroundColor: 'rgba(255,255,255,0.98)', 
                    border: 'none', 
                    borderRadius: '12px', 
                    boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                    padding: '12px 16px'
                  }}
                  labelStyle={{ fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}
                  itemStyle={{ color: '#f59e0b', fontWeight: 600 }}
                  cursor={{ fill: 'rgba(251, 191, 36, 0.08)' }}
                />
                <Bar 
                  dataKey="hours" 
                  name="Hours" 
                  radius={[0, 6, 6, 0]}
                  animationDuration={1000}
                  animationEasing="ease-out"
                  filter="url(#shadow2)"
                  shape={(props: any) => {
                    const { x, y, width, height, payload } = props;
                    const actualRank = 11 - (payload.rank || 0);
                    let fillUrl = 'url(#rankGradientBlue)';
                    if (actualRank === 1) fillUrl = 'url(#rankGradientGold)';
                    else if (actualRank === 2) fillUrl = 'url(#rankGradientSilver)';
                    else if (actualRank === 3) fillUrl = 'url(#rankGradientBronze)';
                    return (
                      <g>
                        <rect x={x} y={y} width={width} height={height} fill={fillUrl} rx={6} ry={6} filter="url(#shadow2)" />
                        {actualRank <= 3 && (
                          <text x={x + width + 8} y={y + height / 2 + 4} fill={actualRank === 1 ? '#f59e0b' : actualRank === 2 ? '#64748b' : '#d97706'} fontSize={11} fontWeight={700}>
                            #{actualRank}
                          </text>
                        )}
                      </g>
                    );
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      {renderDistributionChart(['Corporate Matter', 'IPO'], 'Hour Distribution by Deal/Matter Category (Corporate Matter & IPO)', 250)}
      {renderDistributionChart(['M&A'], 'Hour Distribution by Deal/Matter Category (M&A)', 1200)}
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

    // Premium heatmap color scale - deep navy to vibrant coral
    const getColor = (hours: number, max: number = 0) => {
      if (hours === 0 || max === 0) return 'transparent';
      const percent = Math.sqrt(hours / max);
      // Gradient from soft blue (#e0f2fe) through teal (#14b8a6) to warm coral (#f97316)
      if (percent < 0.3) {
        // Low values: soft blue to light teal
        const t = percent / 0.3;
        return `rgba(20, 184, 166, ${0.15 + t * 0.25})`;
      } else if (percent < 0.6) {
        // Medium values: teal
        const t = (percent - 0.3) / 0.3;
        return `rgba(20, 184, 166, ${0.4 + t * 0.35})`;
      } else {
        // High values: teal to coral
        const t = (percent - 0.6) / 0.4;
        const r = Math.round(20 + (249 - 20) * t);
        const g = Math.round(184 - (184 - 115) * t);
        const b = Math.round(166 - (166 - 22) * t);
        return `rgba(${r}, ${g}, ${b}, ${0.75 + t * 0.25})`;
      }
    };

    const getTextColor = (hours: number, max: number = 0) => {
      if (hours === 0 || max === 0) return '#94a3b8';
      const percent = Math.sqrt(hours / max);
      return percent > 0.5 ? '#ffffff' : '#334155';
    };

    const getOriginalVgName = (formattedName: string) => {
      return formattedName.replace('\n', ' ');
    };

    // Calculate row and column totals
    const rowTotals = new Map<string, number>();
    const colTotals = new Map<string, number>();
    
    rowLabels?.forEach(vgFormatted => {
      const vgOriginal = getOriginalVgName(vgFormatted);
      const clientMap = pivotTable?.get(vgOriginal);
      let total = 0;
      colLabels?.forEach(client => {
        const hours = clientMap?.get(client) || 0;
        total += hours;
        colTotals.set(client, (colTotals.get(client) || 0) + hours);
      });
      rowTotals.set(vgFormatted, total);
    });

    const grandTotal = Array.from(rowTotals.values()).reduce((a, b) => a + b, 0);

    return (
      <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <CardHeader className="pb-4 border-b border-slate-200/60 dark:border-slate-700/60 bg-gradient-to-r from-slate-100/50 to-transparent dark:from-slate-800/50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100">
                Internal Clients by Virtual Groups Distribution
              </CardTitle>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Hours distribution heatmap • Total: <span className="font-semibold text-teal-600">{grandTotal.toFixed(0)}h</span>
              </p>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Low</span>
              <div className="flex h-3 rounded-full overflow-hidden shadow-inner">
                <div className="w-6 h-full" style={{ backgroundColor: 'rgba(20, 184, 166, 0.2)' }} />
                <div className="w-6 h-full" style={{ backgroundColor: 'rgba(20, 184, 166, 0.5)' }} />
                <div className="w-6 h-full" style={{ backgroundColor: 'rgba(20, 184, 166, 0.75)' }} />
                <div className="w-6 h-full" style={{ backgroundColor: 'rgba(249, 115, 22, 0.9)' }} />
              </div>
              <span className="text-slate-500">High</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 p-3 border-b-2 border-r border-slate-200 dark:border-slate-600 text-left font-bold text-slate-700 dark:text-slate-200 text-sm min-w-[140px]">
                    Virtual Groups
                  </th>
                  {colLabels?.map((client, idx) => (
                    <th 
                      key={client} 
                      className="p-3 border-b-2 border-slate-200 dark:border-slate-600 font-semibold text-slate-600 dark:text-slate-300 text-xs whitespace-nowrap text-center min-w-[80px]"
                      style={{ 
                        backgroundColor: idx % 2 === 0 ? 'rgba(241, 245, 249, 0.5)' : 'transparent'
                      }}
                    >
                      {client}
                    </th>
                  ))}
                  <th className="sticky right-0 z-20 bg-gradient-to-l from-amber-50 to-transparent dark:from-amber-900/20 p-3 border-b-2 border-l border-slate-200 dark:border-slate-600 font-bold text-amber-700 dark:text-amber-400 text-xs text-center min-w-[70px]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {rowLabels?.map((vgFormatted, rowIdx) => {
                  const vgOriginal = getOriginalVgName(vgFormatted);
                  const clientMap = pivotTable?.get(vgOriginal);
                  const rowTotal = rowTotals.get(vgFormatted) || 0;
                  const isEvenRow = rowIdx % 2 === 0;
                  
                  return (
                    <tr 
                      key={vgFormatted}
                      className="group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                    >
                      <td 
                        className="sticky left-0 z-10 p-3 border-b border-r border-slate-200/80 dark:border-slate-700/80 font-semibold text-slate-700 dark:text-slate-200 text-sm whitespace-pre-wrap"
                        style={{ 
                          backgroundColor: isEvenRow ? '#f8fafc' : '#ffffff',
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-1 h-6 rounded-full"
                            style={{ 
                              backgroundColor: `hsl(${170 + rowIdx * 15}, 70%, 50%)`,
                              opacity: 0.7
                            }}
                          />
                          {vgFormatted.replace(/\n/g, '\n')}
                        </div>
                      </td>
                      {colLabels?.map((client, colIdx) => {
                        const hours = clientMap?.get(client) || 0;
                        const bgColor = getColor(hours, maxHours || 0);
                        const textColor = getTextColor(hours, maxHours || 0);
                        
                        return (
                          <td 
                            key={client} 
                            className="border-b border-slate-100 dark:border-slate-700/50 p-0 text-center transition-all duration-200 group-hover:scale-[1.02]"
                            style={{ 
                              backgroundColor: colIdx % 2 === 0 && hours === 0 ? 'rgba(241, 245, 249, 0.3)' : undefined
                            }}
                          >
                            <div 
                              className="m-1 rounded-md py-2 px-1 text-xs font-medium transition-all duration-300 hover:scale-110 hover:shadow-lg cursor-default"
                              style={{ 
                                backgroundColor: bgColor,
                                color: textColor,
                                minHeight: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title={hours > 0 ? `${vgFormatted} → ${client}: ${hours.toFixed(1)}h` : ''}
                            >
                              {hours > 0 ? hours.toFixed(1) : ''}
                            </div>
                          </td>
                        );
                      })}
                      <td 
                        className="sticky right-0 z-10 border-b border-l border-slate-200/80 dark:border-slate-700/80 p-2 text-center font-bold text-sm"
                        style={{ 
                          backgroundColor: isEvenRow ? 'rgba(254, 243, 199, 0.3)' : 'rgba(254, 243, 199, 0.15)',
                          color: '#b45309'
                        }}
                      >
                        {rowTotal.toFixed(0)}h
                      </td>
                    </tr>
                  );
                })}
                {/* Column totals row */}
                <tr className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700">
                  <td className="sticky left-0 z-20 bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-600 p-3 border-t-2 border-r border-slate-300 dark:border-slate-500 font-bold text-slate-700 dark:text-slate-200 text-sm">
                    Total
                  </td>
                  {colLabels?.map(client => {
                    const colTotal = colTotals.get(client) || 0;
                    return (
                      <td 
                        key={client} 
                        className="p-2 border-t-2 border-slate-300 dark:border-slate-500 text-center font-bold text-xs text-teal-700 dark:text-teal-400"
                      >
                        {colTotal.toFixed(0)}h
                      </td>
                    );
                  })}
                  <td className="sticky right-0 z-20 bg-gradient-to-l from-amber-100 to-amber-50 dark:from-amber-900/40 dark:to-amber-800/20 p-2 border-t-2 border-l border-slate-300 dark:border-slate-500 text-center font-bold text-sm text-amber-700 dark:text-amber-400">
                    {grandTotal.toFixed(0)}h
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
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
