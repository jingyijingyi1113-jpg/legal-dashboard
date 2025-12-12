
import { useMemo, useState, useEffect, useTransition, useCallback } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis,
  YAxis
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MonthPicker } from './MonthPicker';
import { fieldsMatch, createNormalizedKey, parseMonthString, normalizeCategoryDisplay } from '@/lib/date-utils';
import { cn } from "@/lib/utils";

type Period = 'monthly' | 'quarterly' | 'semiannually' | 'annually' | 'custom';
type InvestmentDealCategory = 'Corporate Matter' | 'IPO' | 'M&A';

// 极简风格年份选择器
const MinimalYearSelector = ({
  selectedYear,
  onSelect,
  availableYears
}: {
  selectedYear: string | null;
  onSelect: (year: string) => void;
  availableYears: string[];
}) => {
  const [open, setOpen] = useState(false);
  
  // 生成年份范围：当前年份前后5年
  const currentYear = new Date().getFullYear();
  const defaultYears = Array.from({ length: 11 }, (_, i) => (currentYear - 5 + i).toString());
  const yearsToShow = availableYears.length > 0 ? availableYears : defaultYears;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "group relative inline-flex items-center gap-2 px-0 py-1",
            "text-neutral-900 transition-all duration-300",
            "focus:outline-none focus-visible:ring-0",
            !selectedYear && "text-neutral-400"
          )}
        >
          <span className="text-lg font-semibold tracking-tight text-neutral-800 tabular-nums">
            {selectedYear || '选择年份'}
          </span>
          <span className="absolute -bottom-0.5 left-0 h-[1.5px] w-0 bg-neutral-800 transition-all duration-300 group-hover:w-full" />
          <svg 
            className={cn(
              "w-3 h-3 text-neutral-400 transition-transform duration-200",
              open && "rotate-180"
            )}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[200px] p-0 border-0 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] rounded-2xl overflow-hidden"
        align="start"
      >
        <div className="bg-white">
          {/* 年份网格 */}
          <div className="grid grid-cols-3 gap-1 p-3 max-h-[240px] overflow-y-auto">
            {yearsToShow.map((year) => {
              const isSelected = selectedYear === year;
              const isCurrentYear = new Date().getFullYear().toString() === year;
              
              return (
                <button
                  key={year}
                  onClick={() => {
                    onSelect(year);
                    setOpen(false);
                  }}
                  className={cn(
                    "relative py-3 px-2 rounded-xl text-sm font-medium transition-all duration-200",
                    "hover:bg-neutral-50",
                    isSelected 
                      ? "bg-neutral-900 text-white hover:bg-neutral-800" 
                      : "text-neutral-600 hover:text-neutral-900",
                    isCurrentYear && !isSelected && "text-neutral-900 font-semibold"
                  )}
                >
                  {year}
                  {isCurrentYear && !isSelected && (
                    <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-neutral-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// 极简风格月份选择器（带日历弹出）
const MinimalMonthSelector = ({
  selectedYear,
  selectedMonth,
  onSelect,
  availableYears
}: {
  selectedYear: string | null;
  selectedMonth: string | null;
  onSelect: (year: string, month: string) => void;
  availableYears: string[];
}) => {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selectedYear ? parseInt(selectedYear) : new Date().getFullYear());

  const months = Array.from({ length: 12 }, (_, i) => i);
  const monthLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  const handleMonthSelect = (month: number) => {
    onSelect(viewYear.toString(), month.toString());
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      if (isOpen && selectedYear) {
        setViewYear(parseInt(selectedYear));
      }
      setOpen(isOpen);
    }}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "group relative inline-flex items-center gap-2 px-0 py-1",
            "text-neutral-900 transition-all duration-300",
            "focus:outline-none focus-visible:ring-0",
            !selectedMonth && "text-neutral-400"
          )}
        >
          <span className="text-lg font-semibold tracking-tight text-neutral-800 tabular-nums">
            {selectedMonth !== null ? monthLabels[parseInt(selectedMonth)] : '选择月份'}
          </span>
          <span className="absolute -bottom-0.5 left-0 h-[1.5px] w-0 bg-neutral-800 transition-all duration-300 group-hover:w-full" />
          <svg 
            className={cn(
              "w-3 h-3 text-neutral-400 transition-transform duration-200",
              open && "rotate-180"
            )}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[280px] p-0 border-0 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] rounded-2xl overflow-hidden"
        align="start"
      >
        <div className="bg-white">
          {/* 年份选择器 */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
            <button 
              onClick={() => setViewYear(prev => prev - 1)}
              className="w-8 h-8 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-800 hover:bg-neutral-50 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-lg font-semibold tracking-tight text-neutral-800">{viewYear}</span>
            <button 
              onClick={() => setViewYear(prev => prev + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-800 hover:bg-neutral-50 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          {/* 月份网格 */}
          <div className="grid grid-cols-3 gap-1 p-3">
            {months.map((month) => {
              const isSelected = selectedMonth !== null && parseInt(selectedMonth) === month && selectedYear === viewYear.toString();
              const isCurrentMonth = new Date().getMonth() === month && new Date().getFullYear() === viewYear;
              
              return (
                <button
                  key={month}
                  onClick={() => handleMonthSelect(month)}
                  className={cn(
                    "relative py-3 px-2 rounded-xl text-sm font-medium transition-all duration-200",
                    "hover:bg-neutral-50",
                    isSelected 
                      ? "bg-neutral-900 text-white hover:bg-neutral-800" 
                      : "text-neutral-600 hover:text-neutral-900",
                    isCurrentMonth && !isSelected && "text-neutral-900 font-semibold"
                  )}
                >
                  {monthLabels[month]}
                  {isCurrentMonth && !isSelected && (
                    <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-neutral-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// 极简风格季度选择器
const MinimalQuarterSelector = ({
  selectedQuarter,
  onSelect
}: {
  selectedQuarter: string | null;
  onSelect: (quarter: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const quarters = [
    { value: '0', label: '第一季度' },
    { value: '1', label: '第二季度' },
    { value: '2', label: '第三季度' },
    { value: '3', label: '第四季度' },
  ];

  const selectedLabel = selectedQuarter !== null 
    ? quarters.find(q => q.value === selectedQuarter)?.label 
    : '选择季度';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "group relative inline-flex items-center gap-2 px-0 py-1",
            "text-neutral-900 transition-all duration-300",
            "focus:outline-none focus-visible:ring-0",
            !selectedQuarter && "text-neutral-400"
          )}
        >
          <span className={cn(
            "text-lg font-semibold tracking-tight tabular-nums",
            selectedQuarter !== null ? "text-neutral-800" : "text-neutral-400"
          )}>
            {selectedLabel}
          </span>
          <span className="absolute -bottom-0.5 left-0 h-[1.5px] w-0 bg-neutral-800 transition-all duration-300 group-hover:w-full" />
          <svg 
            className={cn(
              "w-3 h-3 text-neutral-400 transition-transform duration-200",
              open && "rotate-180"
            )}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[200px] p-0 border-0 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] rounded-2xl overflow-hidden"
        align="start"
      >
        <div className="bg-white p-2">
          {quarters.map((quarter) => {
            const isSelected = selectedQuarter === quarter.value;
            return (
              <button
                key={quarter.value}
                onClick={() => {
                  onSelect(quarter.value);
                  setOpen(false);
                }}
                className={cn(
                  "w-full py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200 text-left",
                  "hover:bg-neutral-50",
                  isSelected 
                    ? "bg-neutral-900 text-white hover:bg-neutral-800" 
                    : "text-neutral-600 hover:text-neutral-900"
                )}
              >
                {quarter.label}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// 极简风格半年度选择器
const MinimalSemiannualSelector = ({
  selectedSemiannual,
  onSelect
}: {
  selectedSemiannual: string | null;
  onSelect: (semiannual: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const semiannuals = [
    { value: '0', label: '上半年' },
    { value: '1', label: '下半年' },
  ];

  const selectedLabel = selectedSemiannual !== null 
    ? semiannuals.find(s => s.value === selectedSemiannual)?.label 
    : '选择半年度';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "group relative inline-flex items-center gap-2 px-0 py-1",
            "text-neutral-900 transition-all duration-300",
            "focus:outline-none focus-visible:ring-0",
            !selectedSemiannual && "text-neutral-400"
          )}
        >
          <span className={cn(
            "text-lg font-semibold tracking-tight tabular-nums",
            selectedSemiannual !== null ? "text-neutral-800" : "text-neutral-400"
          )}>
            {selectedLabel}
          </span>
          <span className="absolute -bottom-0.5 left-0 h-[1.5px] w-0 bg-neutral-800 transition-all duration-300 group-hover:w-full" />
          <svg 
            className={cn(
              "w-3 h-3 text-neutral-400 transition-transform duration-200",
              open && "rotate-180"
            )}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[160px] p-0 border-0 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] rounded-2xl overflow-hidden"
        align="start"
      >
        <div className="bg-white p-2">
          {semiannuals.map((semi) => {
            const isSelected = selectedSemiannual === semi.value;
            return (
              <button
                key={semi.value}
                onClick={() => {
                  onSelect(semi.value);
                  setOpen(false);
                }}
                className={cn(
                  "w-full py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200 text-left",
                  "hover:bg-neutral-50",
                  isSelected 
                    ? "bg-neutral-900 text-white hover:bg-neutral-800" 
                    : "text-neutral-600 hover:text-neutral-900"
                )}
              >
                {semi.label}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// 极简风格周期筛选器组件
const MinimalPeriodFilter = ({
  period,
  setPeriod,
  selectedYear,
  setSelectedYear,
  selectedPeriodValue,
  setSelectedPeriodValue,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  availableYears,
  periodOptions
}: {
  period: Period;
  setPeriod: (p: Period) => void;
  selectedYear: string | null;
  setSelectedYear: (y: string) => void;
  selectedPeriodValue: string | null;
  setSelectedPeriodValue: (v: string) => void;
  customStartDate: Date | undefined;
  setCustomStartDate: (d: Date | undefined) => void;
  customEndDate: Date | undefined;
  setCustomEndDate: (d: Date | undefined) => void;
  availableYears: string[];
  periodOptions: any;
}) => {
  const periodLabels: Record<Period, string> = {
    monthly: '月度',
    quarterly: '季度',
    semiannually: '半年度',
    annually: '年度',
    custom: '自定义'
  };

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      {/* Period 标签 */}
      <span className="text-xs font-medium tracking-widest text-neutral-400 uppercase">Period</span>
      
      {/* 周期类型切换 - 增大点击区域 */}
      <div className="flex items-center gap-0.5 p-1 bg-neutral-100/80 rounded-full">
        {(['monthly', 'quarterly', 'semiannually', 'annually', 'custom'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
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

      {/* 分隔线 - 在换行时隐藏 */}
      <span className="w-px h-5 bg-neutral-200 hidden sm:block" />

      {/* 年份和期间选择 */}
      {period !== 'custom' ? (
        <div className="flex items-center gap-3">
          {/* 年份选择 - 使用弹出面板 */}
          {availableYears.length > 0 && (
            <MinimalYearSelector
              selectedYear={selectedYear}
              onSelect={setSelectedYear}
              availableYears={availableYears}
            />
          )}

          {/* 期间选择 - 根据不同周期类型使用不同的选择器 */}
          {period === 'monthly' && selectedYear && (
            <>
              <span className="text-neutral-300">·</span>
              <MinimalMonthSelector
                selectedYear={selectedYear}
                selectedMonth={selectedPeriodValue}
                onSelect={(year, month) => {
                  setSelectedYear(year);
                  setSelectedPeriodValue(month);
                }}
                availableYears={availableYears}
              />
            </>
          )}

          {period === 'quarterly' && selectedYear && (
            <>
              <span className="text-neutral-300">·</span>
              <MinimalQuarterSelector
                selectedQuarter={selectedPeriodValue}
                onSelect={setSelectedPeriodValue}
              />
            </>
          )}

          {period === 'semiannually' && selectedYear && (
            <>
              <span className="text-neutral-300">·</span>
              <MinimalSemiannualSelector
                selectedSemiannual={selectedPeriodValue}
                onSelect={setSelectedPeriodValue}
              />
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
  );
};

const InvestmentLegalCenterAnalysis = ({ data }: { data: any[] }) => {
  const [period, setPeriod] = useState<Period>('monthly');
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedPeriodValue, setSelectedPeriodValue] = useState<string | null>(null);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  // 使用 useTransition 包装周期切换，让 UI 更快响应
  const handlePeriodChange = useCallback((newPeriod: Period) => {
    startTransition(() => {
      setPeriod(newPeriod);
    });
  }, []);

  const teamData = useMemo(() => data.filter(row => row && row['团队'] === '投资法务中心'), [data]);

  const { availableYears, periodOptions } = useMemo(() => {
    const validData = teamData.filter(row => row && row['Month']);
    if (!validData || validData.length === 0) {
      return { availableYears: [], periodOptions: {} };
    }
    const years = [...new Set(validData.map(row => {
      const parsed = parseMonthString(row['Month']);
      return parsed ? parsed.getFullYear() : NaN;
    }))].filter(year => !isNaN(year));
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

  // 初始化：设置默认年份和最新月份
  useEffect(() => {
    if (availableYears.length > 0 && !selectedYear) {
      setSelectedYear(availableYears[0]);
    }
    // 默认选中最新月份（仅在月度模式下）
    if (period === 'monthly' && !selectedPeriodValue && teamData.length > 0) {
      const latestMonth = teamData.reduce((latest, row) => {
        const d = parseMonthString(row['Month']);
        return d && d > latest ? d : latest;
      }, new Date(0));
      if (latestMonth.getTime() > 0) {
        setSelectedYear(latestMonth.getFullYear().toString());
        setSelectedPeriodValue(latestMonth.getMonth().toString());
      }
    }
  }, [availableYears, teamData, selectedYear]);

  // 切换周期时重置期间值
  useEffect(() => {
    if (period !== 'monthly') {
      setSelectedPeriodValue(null);
    }
  }, [period]);


  const processedData = useMemo(() => {
    // --- 1. TIME FILTERING (与 TeamDimensionTab FilterSection 逻辑一致) ---
    let cardStartDate: Date | undefined, cardEndDate: Date | undefined;

    if (period === 'custom') {
      cardStartDate = customStartDate ? new Date(customStartDate.getFullYear(), customStartDate.getMonth(), 1) : undefined;
      cardEndDate = customEndDate ? new Date(customEndDate.getFullYear(), customEndDate.getMonth() + 1, 0) : undefined;
    } else if (selectedYear) {
      const year = parseInt(selectedYear, 10);
      if (period === 'annually') {
        cardStartDate = new Date(year, 0, 1);
        cardEndDate = new Date(year, 11, 31);
      } else if (selectedPeriodValue !== null && (period === 'monthly' || period === 'quarterly' || period === 'semiannually')) {
        const val = parseInt(selectedPeriodValue, 10);
        switch (period) {
          case 'monthly':
            cardStartDate = new Date(year, val, 1);
            cardEndDate = new Date(year, val + 1, 0);
            break;
          case 'quarterly':
            cardStartDate = new Date(year, val * 3, 1);
            cardEndDate = new Date(year, val * 3 + 3, 0);
            break;
          case 'semiannually':
            cardStartDate = new Date(year, val * 6, 1);
            cardEndDate = new Date(year, val * 6 + 6, 0);
            break;
        }
      } else if (selectedYear && !selectedPeriodValue && (period === 'quarterly' || period === 'semiannually')) {
        // 未选择具体期间时，显示整年数据
        cardStartDate = new Date(year, 0, 1);
        cardEndDate = new Date(year, 11, 31);
      }
    }

    // 默认使用最新月份数据
    if (!cardStartDate || !cardEndDate) {
      const latestMonthInData = teamData.length > 0 ? teamData.reduce((latest, row) => {
        const d = parseMonthString(row['Month']);
        return d && d > latest ? d : latest;
      }, new Date(0)) : new Date(0);

      if (latestMonthInData.getTime() > 0) {
        cardStartDate = new Date(latestMonthInData.getFullYear(), latestMonthInData.getMonth(), 1);
        cardEndDate = new Date(latestMonthInData.getFullYear(), latestMonthInData.getMonth() + 1, 0);
      } else {
        const now = new Date();
        cardStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
        cardEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }
    }

    const timeFilteredData = teamData.filter(row => {
      try {
        if (!row || !row['Month']) return false;
        const rowDate = parseMonthString(row['Month']);
        if (!rowDate) return false;
        return rowDate >= cardStartDate! && rowDate <= cardEndDate!;
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
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 50 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="x" name="Deal/Matter Category" ticks={ticks} tickFormatter={tickFormatter} domain={['dataMin - 0.5', 'dataMax + 0.5']} />
              <YAxis type="number" dataKey="hours" name="Duration" domain={[0, 'auto']} tickFormatter={(value) => `${value}h`} width={60} />
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
    <div className="space-y-6">
      {/* 极简日期筛选器 */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <MinimalPeriodFilter
          period={period}
          setPeriod={handlePeriodChange}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          selectedPeriodValue={selectedPeriodValue}
          setSelectedPeriodValue={setSelectedPeriodValue}
          customStartDate={customStartDate}
          setCustomStartDate={setCustomStartDate}
          customEndDate={customEndDate}
          setCustomEndDate={setCustomEndDate}
          availableYears={availableYears}
          periodOptions={periodOptions}
        />
      </div>
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${isPending ? "opacity-70 transition-opacity duration-150" : ""}`}>
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

        {/* Chart 2: Top 10 Ranking - Premium Design with Category Colors */}
        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          <CardHeader className="pb-2 border-b border-slate-200/50 dark:border-slate-700/50">
            <CardTitle className="text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">
              Top 10 Deals/Matters Ranking
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 pb-2">
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={processedData.top10Data} layout="vertical" margin={{ left: 10, right: 60, top: 5, bottom: 5 }}>
                <defs>
                  {/* Category-based gradients matching left chart */}
                  <linearGradient id="rankGradientIPO" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#55A868" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#6bbe7a" stopOpacity={1} />
                  </linearGradient>
                  <linearGradient id="rankGradientCorporate" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#4C72B0" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#6b8fc7" stopOpacity={1} />
                  </linearGradient>
                  <linearGradient id="rankGradientMA" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#C44E52" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#d4696c" stopOpacity={1} />
                  </linearGradient>
                  {/* Medal accent gradients for top 3 */}
                  <linearGradient id="medalGold" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity={1} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={1} />
                  </linearGradient>
                  <linearGradient id="medalSilver" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#94a3b8" stopOpacity={1} />
                    <stop offset="100%" stopColor="#cbd5e1" stopOpacity={1} />
                  </linearGradient>
                  <linearGradient id="medalBronze" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#d97706" stopOpacity={1} />
                    <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.8} />
                  </linearGradient>
                  <filter id="shadow2" x="-20%" y="-20%" width="140%" height="140%">
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
                  tick={(props: any) => {
                    const { x, y, payload } = props;
                    const item = processedData.top10Data.find((d: any) => d.name === payload.value);
                    const actualRank = item ? 11 - item.rank : 0;
                    const category = item?.category;
                    // Use category colors for text
                    let textColor = '#475569';
                    if (category === 'IPO') textColor = '#55A868';
                    else if (category === 'Corporate Matter') textColor = '#4C72B0';
                    else if (category === 'M&A') textColor = '#C44E52';
                    const displayName = payload.value.length > 10 ? payload.value.substring(0, 10) + '...' : payload.value;
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text x={-8} y={0} dy={4} textAnchor="end" fill={textColor} fontSize={11} fontWeight={actualRank <= 3 ? 700 : 500}>
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
                    const category = props.payload.category || '';
                    return [`${value.toFixed(1)} hours`, `#${actualRank} · ${category}`];
                  }}
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
                  name="Hours" 
                  radius={[0, 8, 8, 0]}
                  animationDuration={800}
                  animationEasing="ease-out"
                  filter="url(#shadow2)"
                  shape={(props: any) => {
                    const { x, y, width, height, payload } = props;
                    const actualRank = 11 - (payload.rank || 0);
                    const category = payload.category;
                    
                    // Use category-based colors (matching left chart)
                    let fillUrl = 'url(#rankGradientIPO)';
                    if (category === 'Corporate Matter') fillUrl = 'url(#rankGradientCorporate)';
                    else if (category === 'M&A') fillUrl = 'url(#rankGradientMA)';
                    
                    // Medal colors for rank badges
                    const medalColors: Record<number, { bg: string, text: string }> = {
                      1: { bg: 'url(#medalGold)', text: '#92400e' },
                      2: { bg: 'url(#medalSilver)', text: '#475569' },
                      3: { bg: 'url(#medalBronze)', text: '#92400e' }
                    };
                    
                    return (
                      <g>
                        <rect x={x} y={y} width={width} height={height} fill={fillUrl} rx={8} ry={8} filter="url(#shadow2)" />
                      </g>
                    );
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
            {/* Category Legend - matching left chart style */}
            <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50 flex justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(90deg, #55A868, #6bbe7a)' }} />
                <span className="text-xs text-slate-600 font-medium">IPO</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(90deg, #4C72B0, #6b8fc7)' }} />
                <span className="text-xs text-slate-600 font-medium">Corporate Matter</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(90deg, #C44E52, #d4696c)' }} />
                <span className="text-xs text-slate-600 font-medium">M&A</span>
              </div>
            </div>
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
  const [isPending, startTransition] = useTransition();

  // 使用 useTransition 包装周期切换，让 UI 更快响应
  const handlePeriodChange = useCallback((newPeriod: Period) => {
    startTransition(() => {
      setPeriod(newPeriod);
    });
  }, []);

  const teamFilteredData = useMemo(() => data.filter(row => row && row['团队'] === '公司及国际金融事务中心'), [data]);

  const { availableYears, periodOptions } = useMemo(() => {
    const validData = teamFilteredData.filter(row => row && row['Month']);
    if (!validData || validData.length === 0) {
      return { availableYears: [], periodOptions: {} };
    }
    const years = [...new Set(validData.map(row => {
      const parsed = parseMonthString(row['Month']);
      return parsed ? parsed.getFullYear() : NaN;
    }))].filter(year => !isNaN(year));
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

  // 初始化：设置默认年份和最新月份
  useEffect(() => {
    if (availableYears.length > 0 && !selectedYear) {
      setSelectedYear(availableYears[0]);
    }
    // 默认选中最新月份（仅在月度模式下）
    if (period === 'monthly' && !selectedPeriodValue && teamFilteredData.length > 0) {
      const latestMonth = teamFilteredData.reduce((latest, row) => {
        const d = parseMonthString(row['Month']);
        return d && d > latest ? d : latest;
      }, new Date(0));
      if (latestMonth.getTime() > 0) {
        setSelectedYear(latestMonth.getFullYear().toString());
        setSelectedPeriodValue(latestMonth.getMonth().toString());
      }
    }
  }, [availableYears, teamFilteredData, selectedYear]);

  // 切换周期时重置期间值
  useEffect(() => {
    if (period !== 'monthly') {
      setSelectedPeriodValue(null);
    }
  }, [period]);

  const heatmapData = useMemo(() => {
    // --- 1. TIME FILTERING (与 TeamDimensionTab FilterSection 逻辑一致) ---
    let cardStartDate: Date | undefined, cardEndDate: Date | undefined;

    if (period === 'custom') {
      cardStartDate = customStartDate ? new Date(customStartDate.getFullYear(), customStartDate.getMonth(), 1) : undefined;
      cardEndDate = customEndDate ? new Date(customEndDate.getFullYear(), customEndDate.getMonth() + 1, 0) : undefined;
    } else if (selectedYear) {
      const year = parseInt(selectedYear, 10);
      if (period === 'annually') {
        cardStartDate = new Date(year, 0, 1);
        cardEndDate = new Date(year, 11, 31);
      } else if (selectedPeriodValue !== null && (period === 'monthly' || period === 'quarterly' || period === 'semiannually')) {
        const val = parseInt(selectedPeriodValue, 10);
        switch (period) {
          case 'monthly':
            cardStartDate = new Date(year, val, 1);
            cardEndDate = new Date(year, val + 1, 0);
            break;
          case 'quarterly':
            cardStartDate = new Date(year, val * 3, 1);
            cardEndDate = new Date(year, val * 3 + 3, 0);
            break;
          case 'semiannually':
            cardStartDate = new Date(year, val * 6, 1);
            cardEndDate = new Date(year, val * 6 + 6, 0);
            break;
        }
      } else if (selectedYear && !selectedPeriodValue && (period === 'quarterly' || period === 'semiannually')) {
        // 未选择具体期间时，显示整年数据
        cardStartDate = new Date(year, 0, 1);
        cardEndDate = new Date(year, 11, 31);
      }
    }

    // 默认使用最新月份数据
    if (!cardStartDate || !cardEndDate) {
      const latestMonthInData = teamFilteredData.length > 0 ? teamFilteredData.reduce((latest, row) => {
        const d = parseMonthString(row['Month']);
        return d && d > latest ? d : latest;
      }, new Date(0)) : new Date(0);

      if (latestMonthInData.getTime() > 0) {
        cardStartDate = new Date(latestMonthInData.getFullYear(), latestMonthInData.getMonth(), 1);
        cardEndDate = new Date(latestMonthInData.getFullYear(), latestMonthInData.getMonth() + 1, 0);
      } else {
        const now = new Date();
        cardStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
        cardEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }
    }

    const timeFilteredData = teamFilteredData.filter(row => {
      try {
        if (!row || !row['Month']) return false;
        const rowDate = parseMonthString(row['Month']);
        if (!rowDate) return false;
        return rowDate >= cardStartDate! && rowDate <= cardEndDate!;
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
        
        const virtualGroup = rawVirtualGroup ? normalizeCategoryDisplay(rawVirtualGroup) : null;
        const internalClient = rawInternalClient ? normalizeCategoryDisplay(rawInternalClient) : null;
        
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
    <div className="space-y-6">
      {/* 极简日期筛选器 */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <MinimalPeriodFilter
          period={period}
          setPeriod={handlePeriodChange}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          selectedPeriodValue={selectedPeriodValue}
          setSelectedPeriodValue={setSelectedPeriodValue}
          customStartDate={customStartDate}
          setCustomStartDate={setCustomStartDate}
          customEndDate={customEndDate}
          setCustomEndDate={setCustomEndDate}
          availableYears={availableYears}
          periodOptions={periodOptions}
        />
      </div>
      <div className={isPending ? "opacity-70 transition-opacity duration-150" : ""}>
        {renderContent()}
      </div>
    </div>
  );
};

export const ProjectDimensionTab = ({ data }: { data: any[] }) => {
  // 无数据时的展示
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-neutral-500">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-lg font-medium">请先导入工时数据</p>
          <p className="text-sm text-neutral-400 mt-1">导入数据后可查看项目维度分析</p>
        </div>
      </div>
    );
  }

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
