import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import { getWorkdaysInMonth, parseMonthString, normalizeMonthString, normalizeCategoryDisplay } from '@/lib/date-utils';
import { MonthPicker } from './MonthPicker';
import { ProjectDimensionTab } from './ProjectDimensionTab';
import { TeamDimensionTab } from './TeamDimensionTab';
import { useReactToPrint } from 'react-to-print';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { cn } from "@/lib/utils";

import { format, parse } from 'date-fns';

type Period = 'monthly' | 'quarterly' | 'semiannually' | 'annually' | 'custom';

interface MonthlyData {
    month: string;
    totalHours: number;
    activeUsers: number;
    avgHoursPerUser: number;
    totalHoursTrend: number;
    avgHoursTrend: number;
  }

export function DashboardPage() {
  const [rawData, setRawData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  
  // Period filter states for TimeDimensionTab
  const [period, setPeriod] = useState<Period>('monthly');
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedPeriodValue, setSelectedPeriodValue] = useState<string | null>(null);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);

  // 数据更新回调函数 - 用于子组件修改数据后同步更新
  const handleDataUpdate = (updatedRecords: any[]) => {
    setRawData(prevData => {
      const newData = [...prevData];
      updatedRecords.forEach(updatedRecord => {
        // 通过唯一标识找到并更新记录
        // 使用多个字段进行匹配，提高准确性
        const index = newData.findIndex(row => {
          const monthMatch = String(row.Month || '') === String(updatedRecord._originalMonth || '');
          const nameMatch = String(row.Name || '') === String(updatedRecord._originalName || '');
          const dealNameMatch = String(row['Deal/Matter Name'] || '') === String(updatedRecord._originalDealMatterName || '');
          const dealCategoryMatch = String(row['Deal/Matter Category'] || '') === String(updatedRecord._originalDealMatterCategory || '');
          const hoursMatch = Math.abs(Number(row.Hours || 0) - Number(updatedRecord._originalHours || 0)) < 0.001;
          const tagMatch = String(row['OKR/BSC Tag'] || '') === String(updatedRecord._originalOKRBSCTag || '');
          return monthMatch && nameMatch && dealNameMatch && dealCategoryMatch && hoursMatch && tagMatch;
        });
        if (index !== -1) {
          // 移除内部标识字段，但保留_isModified标记
          const { _originalMonth, _originalName, _originalDealMatterName, _originalDealMatterCategory, _originalHours, _originalOKRBSCTag, _parsedDate, _modifiedFields, ...cleanRecord } = updatedRecord;
          newData[index] = { ...newData[index], ...cleanRecord };
        }
      });
      return newData;
    });
  };

  // Excel导出功能
  const handleExportExcel = () => {
    if (rawData.length === 0) {
      alert('没有数据可导出');
      return;
    }
    
    // 创建工作簿
    const wb = XLSX.utils.book_new();
    
    // 过滤掉内部字段（以_开头的字段），并格式化Month字段
    // 同时添加"已修改"标记列
    const exportData = rawData.map(row => {
      const cleanRow: any = {};
      const isModified = row._isModified === true;
      
      Object.keys(row).forEach(key => {
        if (!key.startsWith('_')) {
          let value = row[key];
          // 格式化Month字段
          if (key === 'Month' && value !== null && value !== undefined) {
            const formatted = normalizeMonthString(value);
            if (formatted) {
              value = formatted;
            }
          }
          cleanRow[key] = value;
        }
      });
      
      // 添加修改标记列
      cleanRow['已修改'] = isModified ? '是' : '';
      
      return cleanRow;
    });
    
    // 创建工作表
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // 获取列头
    const headers = Object.keys(exportData[0] || {});
    
    // 设置列宽
    const colWidths = headers.map((header) => {
      if (header === 'Month') return { wch: 10 };
      if (header === 'Name') return { wch: 15 };
      if (header === 'Deal/Matter Category') return { wch: 30 };
      if (header === 'Deal/Matter Name') return { wch: 25 };
      if (header === 'OKR/BSC Tag') return { wch: 12 };
      if (header === 'OKR/BSC Item') return { wch: 15 };
      if (header === 'Hours') return { wch: 8 };
      if (header === 'Work Category') return { wch: 15 };
      if (header === 'Narrative (Optional)') return { wch: 30 };
      if (header === '已修改') return { wch: 8 };
      return { wch: 15 };
    });
    ws['!cols'] = colWidths;
    
    // 添加工作表到工作簿
    XLSX.utils.book_append_sheet(wb, ws, '工时数据');
    
    // 导出文件
    const fileName = `工时数据_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // 获取页面名称
  const getPageName = () => {
    switch (activeTab) {
      case 'overview': return '部门总览';
      case 'team': return '分团队预览';
      case 'personal': return '个人工时预览';
      default: return '工时数据看板';
    }
  };

  // PDF导出功能 - 添加防止分页截断样式
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${getPageName()}_${format(selectedDate, 'yyyy年_MM月')}`,
    pageStyle: `
      @page {
        size: A4 landscape;
        margin: 8mm;
      }
      @media print {
        html, body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .no-print {
          display: none !important;
        }
        /* 防止卡片和图表被分页截断 */
        .card-premium,
        [class*="Card"],
        .recharts-wrapper,
        .recharts-responsive-container,
        table,
        [class*="chart"],
        [class*="Chart"] {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        /* 确保每个主要区块不被截断 */
        .print-section {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
      }
    `,
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet) as any[];
        setRawData(json);
        processTimeData(json);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const processTimeData = (data: any[]) => {
    const monthlyAgg: { [key: string]: { [key: string]: { hours: number; users: Set<string> } } } = {};

    data.forEach(item => {
        if (item.Month && item.Name) {
            // Use normalizeMonthString to handle various date formats (including Date objects)
            const month = normalizeMonthString(item.Month);
            if (!month) return;
            
            const team = item['团队'] || 'Unknown';

            if (!monthlyAgg[month]) {
                monthlyAgg[month] = {};
            }
            if (!monthlyAgg[month][team]) {
                monthlyAgg[month][team] = { hours: 0, users: new Set() };
            }
            monthlyAgg[month][team].hours += Number(item['Hours']) || 0;
            const name = normalizeCategoryDisplay(item.Name?.toString());
            monthlyAgg[month][team].users.add(name);
        }
    });

    const sortedMonths = Object.keys(monthlyAgg).sort();

    const coreData = sortedMonths.map(month => {
        const date = parseMonthString(month) || new Date();
        const year = date.getFullYear();
        const monthNum = date.getMonth() + 1;
        const cnWorkdays = getWorkdaysInMonth(year, monthNum, 'CN');
        const hkWorkdays = getWorkdaysInMonth(year, monthNum, 'HK');

        let totalHours = 0;
        let departmentAvgHours = 0;
        let contributingTeams = 0;

        const teamsData = monthlyAgg[month];
        const allUsers = new Set<string>();

        for (const team in teamsData) {
            const teamData = teamsData[team];
            totalHours += teamData.hours;
            teamData.users.forEach(user => allUsers.add(user));

            let timeCoefficient = 1;
            if (team === '投资法务中心') {
                timeCoefficient = cnWorkdays > 0 ? 20.83 / cnWorkdays : 0;
            } else if (team === '公司及国际金融事务中心') {
                timeCoefficient = hkWorkdays > 0 ? 20.83 / hkWorkdays : 0;
            }

            if (teamData.users.size > 0 && timeCoefficient > 0) {
                const teamAvgHours = (teamData.hours / teamData.users.size) * timeCoefficient;
                departmentAvgHours += teamAvgHours;
                contributingTeams++;
            }
        }

        const totalActiveUsers = allUsers.size;
        const avgHoursPerUser = contributingTeams > 0 ? departmentAvgHours / contributingTeams : 0;

        return {
            month,
            totalHours,
            activeUsers: totalActiveUsers,
            avgHoursPerUser,
        };
    });

    const finalData: MonthlyData[] = coreData.map((currentMonthData, index) => {
        let totalHoursTrend = 0;
        let avgHoursTrend = 0;

        if (index > 0) {
            const prevMonthData = coreData[index - 1];
            if (prevMonthData.totalHours > 0) {
                totalHoursTrend = ((currentMonthData.totalHours - prevMonthData.totalHours) / prevMonthData.totalHours) * 100;
            }
            if (prevMonthData.avgHoursPerUser > 0) {
                avgHoursTrend = ((currentMonthData.avgHoursPerUser - prevMonthData.avgHoursPerUser) / prevMonthData.avgHoursPerUser) * 100;
            }
        }

        return {
            ...currentMonthData,
            totalHoursTrend,
            avgHoursTrend,
        };
    });

    setMonthlyData(finalData);
    if (finalData.length > 0) {
        const latestMonth = finalData[finalData.length - 1].month;
        const latestDate = parseMonthString(latestMonth);
        if (latestDate) {
            setSelectedDate(latestDate);
            setSelectedYear(latestDate.getFullYear().toString());
            setSelectedPeriodValue(latestDate.getMonth().toString());
        }
    }
  };

  // 计算可用年份
  const availableYears = useMemo(() => {
    if (monthlyData.length === 0) return [];
    const years = [...new Set(monthlyData.map(d => {
      const parsed = parseMonthString(d.month);
      return parsed ? parsed.getFullYear() : null;
    }).filter(Boolean))] as number[];
    return years.sort((a, b) => b - a).map(y => y.toString());
  }, [monthlyData]);

  // 初始化年份
  useMemo(() => {
    if (availableYears.length > 0 && !selectedYear) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  const displayedData = useMemo(() => {
    if (monthlyData.length === 0) return { totalHours: 0, activeUsers: 0, avgHours: 0, totalHoursTrend: 0, avgHoursTrend: 0 };
    
    let filteredData: MonthlyData[] = [];
    
    if (period === 'custom') {
      if (customStartDate && customEndDate) {
        filteredData = monthlyData.filter(d => {
          const date = parseMonthString(d.month);
          return date && date >= customStartDate && date <= customEndDate;
        });
      }
    } else if (selectedYear) {
      const year = parseInt(selectedYear, 10);
      if (period === 'annually') {
        filteredData = monthlyData.filter(d => {
          const date = parseMonthString(d.month);
          return date && date.getFullYear() === year;
        });
      } else if (period === 'monthly' && selectedPeriodValue !== null) {
        const month = parseInt(selectedPeriodValue, 10);
        filteredData = monthlyData.filter(d => {
          const date = parseMonthString(d.month);
          return date && date.getFullYear() === year && date.getMonth() === month;
        });
      } else if (period === 'quarterly' && selectedPeriodValue !== null) {
        const quarter = parseInt(selectedPeriodValue, 10);
        const startMonth = quarter * 3;
        const endMonth = startMonth + 2;
        filteredData = monthlyData.filter(d => {
          const date = parseMonthString(d.month);
          return date && date.getFullYear() === year && date.getMonth() >= startMonth && date.getMonth() <= endMonth;
        });
      } else if (period === 'semiannually' && selectedPeriodValue !== null) {
        const half = parseInt(selectedPeriodValue, 10);
        const startMonth = half * 6;
        const endMonth = startMonth + 5;
        filteredData = monthlyData.filter(d => {
          const date = parseMonthString(d.month);
          return date && date.getFullYear() === year && date.getMonth() >= startMonth && date.getMonth() <= endMonth;
        });
      } else {
        // 未选择具体期间时，显示整年数据
        filteredData = monthlyData.filter(d => {
          const date = parseMonthString(d.month);
          return date && date.getFullYear() === year;
        });
      }
    }
    
    if (filteredData.length === 0) {
      return { totalHours: 0, activeUsers: 0, avgHours: 0, totalHoursTrend: 0, avgHoursTrend: 0 };
    }
    
    const totalHours = filteredData.reduce((sum, d) => sum + d.totalHours, 0);
    const avgHours = filteredData.reduce((sum, d) => sum + d.avgHoursPerUser, 0) / filteredData.length;
    const lastData = filteredData[filteredData.length - 1];
    
    return {
      totalHours,
      activeUsers: lastData.activeUsers,
      avgHours,
      totalHoursTrend: lastData.totalHoursTrend,
      avgHoursTrend: lastData.avgHoursTrend
    };
  }, [period, selectedYear, selectedPeriodValue, customStartDate, customEndDate, monthlyData]);

  const periodLabels: Record<Period, string> = {
    monthly: '月度',
    quarterly: '季度',
    semiannually: '半年度',
    annually: '年度',
    custom: '自定义'
  };

  const TimeDimensionTab = () => (
    <TabsContent value="time-dimension" className="space-y-6">
        {/* 极简日期筛选器 - 标签式切换 */}
        <div className="flex items-center justify-between animate-fade-in-up">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                {/* Period 标签 */}
                <span className="text-xs font-medium tracking-widest text-neutral-400 uppercase">Period</span>
                
                {/* 周期类型切换 */}
                <div className="flex items-center gap-0.5 p-1 bg-neutral-100/80 rounded-full">
                    {(['monthly', 'quarterly', 'semiannually', 'annually', 'custom'] as Period[]).map((p) => (
                        <button
                            key={p}
                            onClick={() => {
                                setPeriod(p);
                                if (p !== 'monthly') setSelectedPeriodValue(null);
                            }}
                            className={cn(
                                "px-4 py-2.5 text-xs font-medium rounded-full transition-colors duration-75",
                                "cursor-pointer select-none touch-manipulation",
                                "focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-1",
                                period === p
                                    ? "bg-white text-neutral-900 shadow-sm active:bg-neutral-100"
                                    : "text-neutral-500 hover:text-neutral-700 hover:bg-white/60 active:bg-white/80"
                            )}
                        >
                            {periodLabels[p]}
                        </button>
                    ))}
                </div>

                {/* 分隔线 */}
                <span className="w-px h-5 bg-neutral-200 hidden sm:block" />

                {/* 年份和期间选择 */}
                {period !== 'custom' ? (
                    <div className="flex items-center gap-3">
                        {/* 年份选择 */}
                        {availableYears.length > 0 && (
                            <select
                                value={selectedYear || ''}
                                onChange={(e) => setSelectedYear(e.target.value)}
                                className="px-3 py-2 text-sm font-medium bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400"
                            >
                                {availableYears.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        )}

                        {/* 月份选择 */}
                        {period === 'monthly' && selectedYear && (
                            <>
                                <span className="text-neutral-300">·</span>
                                <select
                                    value={selectedPeriodValue || ''}
                                    onChange={(e) => setSelectedPeriodValue(e.target.value)}
                                    className="px-3 py-2 text-sm font-medium bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400"
                                >
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <option key={i} value={i.toString()}>{i + 1}月</option>
                                    ))}
                                </select>
                            </>
                        )}

                        {/* 季度选择 */}
                        {period === 'quarterly' && selectedYear && (
                            <>
                                <span className="text-neutral-300">·</span>
                                <select
                                    value={selectedPeriodValue || ''}
                                    onChange={(e) => setSelectedPeriodValue(e.target.value)}
                                    className="px-3 py-2 text-sm font-medium bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400"
                                >
                                    <option value="">选择季度</option>
                                    <option value="0">Q1 (1-3月)</option>
                                    <option value="1">Q2 (4-6月)</option>
                                    <option value="2">Q3 (7-9月)</option>
                                    <option value="3">Q4 (10-12月)</option>
                                </select>
                            </>
                        )}

                        {/* 半年度选择 */}
                        {period === 'semiannually' && selectedYear && (
                            <>
                                <span className="text-neutral-300">·</span>
                                <select
                                    value={selectedPeriodValue || ''}
                                    onChange={(e) => setSelectedPeriodValue(e.target.value)}
                                    className="px-3 py-2 text-sm font-medium bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400"
                                >
                                    <option value="">选择半年度</option>
                                    <option value="0">上半年 (1-6月)</option>
                                    <option value="1">下半年 (7-12月)</option>
                                </select>
                            </>
                        )}
                    </div>
                ) : (
                    /* 自定义日期范围 */
                    <div className="flex items-center gap-3">
                        <MonthPicker value={customStartDate} onChange={(d) => setCustomStartDate(d)} variant="minimal" />
                        <span className="text-neutral-300 text-sm">至</span>
                        <MonthPicker value={customEndDate} onChange={(d) => setCustomEndDate(d)} variant="minimal" />
                    </div>
                )}
            </div>
        </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-fade-in-up">
            <Card className="card-premium">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-semibold text-neutral-600">部门总用时</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-neutral-900">{displayedData.totalHours.toFixed(2)}</div>
                <p className={`text-xs font-medium mt-2 ${displayedData.totalHoursTrend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    环比: {displayedData.totalHoursTrend >= 0 ? '+' : ''}{displayedData.totalHoursTrend.toFixed(2)}%
                </p>
              </CardContent>
            </Card>
            <Card className="card-premium md:col-span-1 lg:col-span-3">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-neutral-600">部门整体情况</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 divide-x divide-neutral-200/50">
                  <div className="flex flex-col items-center p-3">
                      <div className="text-2xl font-bold text-neutral-900">{displayedData.totalHours.toFixed(2)}</div>
                      <p className="text-xs text-neutral-500 mt-1 font-medium">总用时</p>
                  </div>
                  <div className="flex flex-col items-center p-3">
                      <div className="text-2xl font-bold text-neutral-900">{displayedData.avgHours.toFixed(2)}</div>
                      <p className="text-xs text-neutral-500 mt-1 font-medium">人均用时</p>
                  </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 animate-fade-in-up">
            <Card className="card-premium">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold text-neutral-900">总用时月度趋势</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={monthlyData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="month" stroke="rgba(0,0,0,0.3)" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748b' }, dx: -10, dy: 20 }} stroke="rgba(0,0,0,0.3)" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: 'MoM%', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: '#64748b' }, dy: 20 }} stroke="rgba(0,0,0,0.3)" tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => value.toFixed(2)} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="totalHours" name="Total Hours" fill="#2563eb" radius={[8, 8, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="totalHoursTrend" name="MoM%" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="card-premium">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold text-neutral-900">月度人均用时趋势</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={monthlyData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="month" stroke="rgba(0,0,0,0.3)" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748b' }, dy: 20 }} stroke="rgba(0,0,0,0.3)" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: 'MoM%', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: '#64748b' }, dy: 20 }} stroke="rgba(0,0,0,0.3)" tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => value.toFixed(2)} />
                    <Legend 
                      content={() => (
                        <div className="flex justify-center gap-6 mt-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-4 h-0.5 bg-[#f59e0b]" style={{ position: 'relative' }}>
                              <div className="w-2 h-2 rounded-full bg-[#f59e0b] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                            </div>
                            <span className="text-sm text-gray-600">MoM%</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 bg-[#0ea5e9]" />
                            <span className="text-sm text-gray-600">Avg Hours/Person</span>
                          </div>
                        </div>
                      )}
                    />
                    <Bar yAxisId="left" dataKey="avgHoursPerUser" name="Avg Hours/Person" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="avgHoursTrend" name="MoM%" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
    </TabsContent>
  );

  const DepartmentOverviewTab = () => (
      <TabsContent value="overview" className="space-y-6 focus-visible:outline-none">
        <Tabs defaultValue="time-dimension" className="space-y-6">
          <div className="bg-slate-50/95 backdrop-blur supports-[backdrop-filter]:bg-slate-50/60 border-b border-slate-200/60 -mx-6 px-6 pt-2 pb-0">
            <TabsList className="flex h-auto items-center justify-start gap-2 bg-transparent p-0 w-full">
                <TabsTrigger 
                  value="time-dimension"
                  className="relative h-9 rounded-md border-0 bg-transparent px-4 py-2 font-normal text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 data-[state=active]:shadow-none text-sm"
                >
                  工时维度
                </TabsTrigger>
                <TabsTrigger 
                  value="project-dimension"
                  className="relative h-9 rounded-md border-0 bg-transparent px-4 py-2 font-normal text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 data-[state=active]:shadow-none text-sm"
                >
                  项目维度
                </TabsTrigger>
            </TabsList>
          </div>
            <TimeDimensionTab />
            <TabsContent value="project-dimension" className="mt-6 focus-visible:outline-none">
                <ProjectDimensionTab data={rawData} />
            </TabsContent>
        </Tabs>
      </TabsContent>
  );

  return (
    <div className="min-h-screen section-gradient relative overflow-hidden">
      {/* Ambient background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-teal-100/20 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative z-10 space-y-6 p-6">
        <div className='flex justify-between items-center mb-2 animate-fade-in-down'>
          <div>
            <h1 className="text-4xl font-bold text-neutral-900 tracking-tight">工时数据看板</h1>
            <p className="text-neutral-500 mt-2 text-sm font-medium">工时统计与趋势分析</p>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" className="no-print group relative overflow-hidden px-4 py-2 h-9 rounded-lg border border-slate-200/60 bg-white/60 backdrop-blur-sm hover:bg-slate-50/80 hover:border-slate-300/80 transition-all duration-200">
              <label htmlFor="file-upload" className="cursor-pointer flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 group-hover:text-slate-700 transition-colors"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                <span className="text-[13px] font-medium text-slate-600 group-hover:text-slate-800 transition-colors">导入数据</span>
              </label>
            </Button>
            <Input id="file-upload" type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xls" />
            <DropdownMenu open={isExportMenuOpen} onOpenChange={setIsExportMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="no-print group relative overflow-hidden px-4 py-2 h-9 rounded-lg border border-slate-200/60 bg-white/60 backdrop-blur-sm hover:bg-slate-50/80 hover:border-slate-300/80 transition-all duration-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 group-hover:text-slate-700 transition-colors mr-1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                  <span className="text-[13px] font-medium text-slate-600 group-hover:text-slate-800 transition-colors">导出</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-1 text-slate-400 group-hover:text-slate-500 transition-colors"><polyline points="6 9 12 15 18 9"/></svg>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36 p-1 rounded-lg border border-slate-200/80 bg-white/95 backdrop-blur-md shadow-lg">
                <DropdownMenuItem onClick={() => handlePrint()} className="cursor-pointer rounded-md px-3 py-2 text-[13px] text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-rose-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  导出 PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer rounded-md px-3 py-2 text-[13px] text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-emerald-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10 12l2 2 4-4"/></svg>
                  导出 Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="glass-effect -mx-6 px-6 shadow-elevation-2 transition-all duration-200 rounded-xl">
            <TabsList className="flex h-14 items-center justify-start gap-8 bg-transparent p-0 w-full">
              <TabsTrigger 
                value="overview"
                className="nav-tab-enhanced relative text-neutral-600 hover:text-neutral-900 data-[state=active]:text-blue-600 data-[state=active]:font-semibold transition-colors duration-300 text-[17px]"
              >
                部门总览
                <span className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full scale-x-0 data-[state=active]:scale-x-100 transition-transform duration-300 origin-left"></span>
              </TabsTrigger>
              <TabsTrigger 
                value="team"
                className="nav-tab-enhanced relative text-neutral-600 hover:text-neutral-900 data-[state=active]:text-blue-600 data-[state=active]:font-semibold transition-colors duration-300 text-[17px]"
              >
                分团队预览
                <span className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full scale-x-0 data-[state=active]:scale-x-100 transition-transform duration-300 origin-left"></span>
              </TabsTrigger>
              <TabsTrigger 
                value="personal" 
                disabled
                className="nav-tab-enhanced relative text-neutral-400 cursor-not-allowed opacity-50 hover:opacity-50 transition-opacity duration-300 text-[17px]"
              >
                个人工时预览 (待完善)
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="container mx-auto max-w-7xl animate-fade-in-up" ref={printRef}>
            <DepartmentOverviewTab />
            <TabsContent value="team" className="m-0 focus-visible:outline-none">
              {activeTab === 'team' && <TeamDimensionTab data={rawData} onDataUpdate={handleDataUpdate} />}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
