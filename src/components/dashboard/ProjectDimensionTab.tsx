
import { useMemo, useState, useEffect, useTransition, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis,
  YAxis, Line, LineChart
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MonthPicker } from './MonthPicker';
import { fieldsMatch, createNormalizedKey, parseMonthString, normalizeCategoryDisplay } from '@/lib/date-utils';
import { cn } from "@/lib/utils";

type Period = 'monthly' | 'quarterly' | 'semiannually' | 'annually' | 'custom';
type InvestmentDealCategory = 'Corporate Matter' | 'IPO' | 'M&A';

// 活跃度状态类型
type ActivityStatus = 'hot' | 'rising' | 'stable' | 'declining' | 'inactive' | 'new';

// 公司活跃度数据接口
interface CompanyActivity {
  name: string;
  category: InvestmentDealCategory;
  totalHours: number;
  recentHours: number;
  monthlyTrend: { month: string; hours: number }[];
  growthRate: number;
  participantCount: number;
  status: ActivityStatus;
  firstAppearance: string;
  lastActivity: string;
}

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
  const initializedRef = useRef(false);
  
  // Distribution Charts 共用筛选器状态
  const [distPeriod, setDistPeriod] = useState<Period>('monthly');
  const [distSelectedYear, setDistSelectedYear] = useState<string | null>(null);
  const [distSelectedPeriodValue, setDistSelectedPeriodValue] = useState<string | null>(null);
  const [distCustomStartDate, setDistCustomStartDate] = useState<Date | undefined>(undefined);
  const [distCustomEndDate, setDistCustomEndDate] = useState<Date | undefined>(undefined);
  const distInitializedRef = useRef(false);
  
  // 弹窗状态
  const [companyListDialog, setCompanyListDialog] = useState<{
    open: boolean;
    type: 'active' | 'new' | 'rising' | 'declining';
    title: string;
  }>({ open: false, type: 'active', title: '' });
  
  // 弹窗筛选状态
  const [dialogFilter, setDialogFilter] = useState<{
    category: 'all' | 'Corporate Matter' | 'IPO' | 'M&A';
    searchText: string;
  }>({ category: 'all', searchText: '' });
  
  // 重置筛选条件当弹窗关闭或切换类型时
  const handleDialogOpen = (open: boolean, type?: 'active' | 'new' | 'rising' | 'declining', title?: string) => {
    if (open && type && title) {
      setCompanyListDialog({ open, type, title });
      setDialogFilter({ category: 'all', searchText: '' });
    } else {
      setCompanyListDialog(prev => ({ ...prev, open }));
    }
  };

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

  // 初始化：设置默认年份和最新月份（只执行一次）
  useEffect(() => {
    if (initializedRef.current) return;
    if (availableYears.length > 0 && teamData.length > 0) {
      const latestMonth = teamData.reduce((latest, row) => {
        const d = parseMonthString(row['Month']);
        return d && d > latest ? d : latest;
      }, new Date(0));
      if (latestMonth.getTime() > 0) {
        setSelectedYear(latestMonth.getFullYear().toString());
        setSelectedPeriodValue(latestMonth.getMonth().toString());
        initializedRef.current = true;
      }
    }
  }, [availableYears, teamData]);

  // 初始化 Distribution Charts 共用筛选器
  useEffect(() => {
    if (distInitializedRef.current) return;
    if (availableYears.length > 0 && teamData.length > 0) {
      const latestMonth = teamData.reduce((latest, row) => {
        const d = parseMonthString(row['Month']);
        return d && d > latest ? d : latest;
      }, new Date(0));
      if (latestMonth.getTime() > 0) {
        setDistSelectedYear(latestMonth.getFullYear().toString());
        setDistSelectedPeriodValue(latestMonth.getMonth().toString());
        distInitializedRef.current = true;
      }
    }
  }, [availableYears, teamData]);

  // 切换周期时重置期间值
  useEffect(() => {
    if (period !== 'monthly') {
      setSelectedPeriodValue(null);
    }
  }, [period]);

  // Distribution Charts 周期切换时重置期间值
  useEffect(() => {
    if (distPeriod !== 'monthly') {
      setDistSelectedPeriodValue(null);
    }
  }, [distPeriod]);


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

  // Distribution Charts 共用数据处理
  const distProcessedData = useMemo(() => {
    // 时间筛选逻辑
    let cardStartDate: Date | undefined, cardEndDate: Date | undefined;

    if (distPeriod === 'custom') {
      cardStartDate = distCustomStartDate ? new Date(distCustomStartDate.getFullYear(), distCustomStartDate.getMonth(), 1) : undefined;
      cardEndDate = distCustomEndDate ? new Date(distCustomEndDate.getFullYear(), distCustomEndDate.getMonth() + 1, 0) : undefined;
    } else if (distSelectedYear) {
      const year = parseInt(distSelectedYear, 10);
      if (distPeriod === 'annually') {
        cardStartDate = new Date(year, 0, 1);
        cardEndDate = new Date(year, 11, 31);
      } else if (distSelectedPeriodValue !== null && (distPeriod === 'monthly' || distPeriod === 'quarterly' || distPeriod === 'semiannually')) {
        const val = parseInt(distSelectedPeriodValue, 10);
        switch (distPeriod) {
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
      } else if (distSelectedYear && !distSelectedPeriodValue && (distPeriod === 'quarterly' || distPeriod === 'semiannually')) {
        cardStartDate = new Date(year, 0, 1);
        cardEndDate = new Date(year, 11, 31);
      }
    }

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

    const centerData = timeFilteredData.filter(row => {
      if (!row || typeof row !== 'object') return false;
      const hours = Number(row['Hours']);
      return !(isNaN(hours) || hours <= 0 || !row['Deal/Matter Name'] || !row['Deal/Matter Category']);
    });

    const businessTypeMapping: { [key: string]: string[] } = {
      'Corporate Matter': ['Investment Related - Corporate Matter'],
      'IPO': ['Investment Related - IPO'],
      'M&A': ['Investment Related - M&A Deal', 'Investment Related - M&A Matter']
    };

    const allProjects: { originalName: string; hours: number; category: InvestmentDealCategory }[] = [];

    for (const [finalCategory, sourceCategories] of Object.entries(businessTypeMapping)) {
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

    const categoryChartData: any = {};
    const categoryXMapping: Record<string, number> = { 'Corporate Matter': 0, 'IPO': 1, 'M&A': 0 };
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

    return { categoryChartData, categoryXMapping, categoryColors, allScatterPoints };
  }, [teamData, distPeriod, distSelectedYear, distSelectedPeriodValue, distCustomStartDate, distCustomEndDate]);

  // 活跃度分析数据 - 基于全量历史数据计算
  const activityData = useMemo(() => {
    const emptyResult = { 
      activityRanking: [] as CompanyActivity[], 
      trendData: [], 
      top5Companies: [] as CompanyActivity[],
      stats: { active: 0, new: 0, rising: 0, declining: 0 },
      companyLists: { active: [] as CompanyActivity[], new: [] as CompanyActivity[], rising: [] as CompanyActivity[], declining: [] as CompanyActivity[] }
    };
    
    if (!teamData || teamData.length === 0) {
      return emptyResult;
    }

    // 获取所有月份并排序
    const allMonths = [...new Set(teamData.map(row => {
      const d = parseMonthString(row['Month']);
      return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : null;
    }).filter(Boolean))] as string[];
    allMonths.sort();

    if (allMonths.length === 0) {
      return emptyResult;
    }

    // 确定"近期"范围（最近3个月）
    const recentMonths = allMonths.slice(-3);
    const olderMonths = allMonths.slice(0, -3);

    // 业务类型映射
    const businessTypeMapping: { [key: string]: string[] } = {
      'Corporate Matter': ['Investment Related - Corporate Matter'],
      'IPO': ['Investment Related - IPO'],
      'M&A': ['Investment Related - M&A Deal', 'Investment Related - M&A Matter']
    };

    // 按公司聚合数据
    const companyMap = new Map<string, {
      name: string;
      category: InvestmentDealCategory;
      monthlyHours: Map<string, number>;
      participants: Set<string>;
    }>();

    teamData.forEach(row => {
      if (!row['Deal/Matter Name'] || !row['Deal/Matter Category']) return;
      const dealName = row['Deal/Matter Name'].toString();
      const normalizedName = createNormalizedKey(dealName);
      const hours = Number(row['Hours']) || 0;
      const month = parseMonthString(row['Month']);
      if (!month || hours <= 0) return;

      const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
      const participant = row['Name']?.toString() || '';

      // 确定类别
      let category: InvestmentDealCategory | null = null;
      const rowCategory = row['Deal/Matter Category']?.toString();
      for (const [finalCat, sourceCats] of Object.entries(businessTypeMapping)) {
        if (sourceCats.some(srcCat => fieldsMatch(srcCat, rowCategory))) {
          category = finalCat as InvestmentDealCategory;
          break;
        }
      }
      if (!category) return;

      if (!companyMap.has(normalizedName)) {
        companyMap.set(normalizedName, {
          name: dealName,
          category,
          monthlyHours: new Map(),
          participants: new Set(),
        });
      }

      const company = companyMap.get(normalizedName)!;
      company.monthlyHours.set(monthStr, (company.monthlyHours.get(monthStr) || 0) + hours);
      if (participant) company.participants.add(participant);
    });

    // 计算每个公司的活跃度指标
    const activityList: CompanyActivity[] = [];

    companyMap.forEach((company) => {
      const monthlyHoursArr = Array.from(company.monthlyHours.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      const totalHours = monthlyHoursArr.reduce((sum, [, h]) => sum + h, 0);
      
      // 近期工时（最近3个月）
      const recentHours = monthlyHoursArr
        .filter(([m]) => recentMonths.includes(m))
        .reduce((sum, [, h]) => sum + h, 0);
      
      // 历史工时（3个月前）
      const olderHours = monthlyHoursArr
        .filter(([m]) => olderMonths.includes(m))
        .reduce((sum, [, h]) => sum + h, 0);
      const olderMonthCount = monthlyHoursArr.filter(([m]) => olderMonths.includes(m)).length;
      const olderAvg = olderMonthCount > 0 ? olderHours / olderMonthCount : 0;

      // 近期月均
      const recentMonthCount = monthlyHoursArr.filter(([m]) => recentMonths.includes(m)).length;
      const recentAvg = recentMonthCount > 0 ? recentHours / recentMonthCount : 0;

      // 计算增长率
      let growthRate = 0;
      if (olderAvg > 0) {
        growthRate = ((recentAvg - olderAvg) / olderAvg) * 100;
      } else if (recentHours > 0) {
        growthRate = 100; // 新项目
      }

      // 判断活跃状态
      let status: ActivityStatus = 'stable';
      const firstMonth = monthlyHoursArr[0]?.[0] || '';
      const lastMonth = monthlyHoursArr[monthlyHoursArr.length - 1]?.[0] || '';
      const isNew = recentMonths.includes(firstMonth) && olderHours === 0;

      if (isNew) {
        status = 'new';
      } else if (recentHours === 0) {
        status = 'inactive';
      } else if (growthRate > 50) {
        status = 'hot';
      } else if (growthRate > 20) {
        status = 'rising';
      } else if (growthRate < -30) {
        status = 'declining';
      }

      // 构建月度趋势数据
      const monthlyTrend = allMonths.slice(-6).map(m => ({
        month: m,
        hours: company.monthlyHours.get(m) || 0,
      }));

      activityList.push({
        name: company.name,
        category: company.category,
        totalHours,
        recentHours,
        monthlyTrend,
        growthRate,
        participantCount: company.participants.size,
        status,
        firstAppearance: firstMonth,
        lastActivity: lastMonth,
      });
    });

    // 按近期工时排序
    const activityRanking = activityList
      .filter(c => c.recentHours > 0 || c.status === 'new')
      .sort((a, b) => b.recentHours - a.recentHours)
      .slice(0, 10);

    // 增长最快排名
    const growthRanking = activityList
      .filter(c => c.recentHours > 0 && c.status !== 'new')
      .sort((a, b) => b.growthRate - a.growthRate)
      .slice(0, 10);

    // 趋势图数据：取活跃度前5的公司
    const top5Companies = activityRanking.slice(0, 5);
    const trendMonths = allMonths.slice(-6);
    const trendData = trendMonths.map(month => {
      const point: any = { month: month.substring(5) + '月' };
      top5Companies.forEach((company, idx) => {
        const trend = company.monthlyTrend.find(t => t.month === month);
        point[`company${idx}`] = trend?.hours || 0;
        point[`name${idx}`] = company.name;
      });
      return point;
    });

    // 统计 - 包含列表数据
    const activeList = activityList.filter(c => c.recentHours > 0);
    const newList = activityList.filter(c => c.status === 'new');
    const risingList = activityList.filter(c => c.status === 'rising' || c.status === 'hot');
    const decliningList = activityList.filter(c => c.status === 'declining');

    const stats = {
      active: activeList.length,
      new: newList.length,
      rising: risingList.length,
      declining: decliningList.length,
    };

    // 计算最大工时用于归一化
    const maxRecentHours = Math.max(...activeList.map(c => c.recentHours), 1);

    const companyLists = {
      active: activeList.sort((a, b) => b.recentHours - a.recentHours),
      new: newList.sort((a, b) => b.recentHours - a.recentHours),
      // 增长中排序：综合评分 = 增长率权重(0.4) + 工时权重(0.6)
      // 这样既考虑增长趋势，也确保有足够的业务量
      rising: risingList.sort((a, b) => {
        // 归一化增长率（0-100%映射到0-1，超过100%按1计算）
        const normalizedGrowthA = Math.min(a.growthRate / 100, 1);
        const normalizedGrowthB = Math.min(b.growthRate / 100, 1);
        // 归一化工时
        const normalizedHoursA = a.recentHours / maxRecentHours;
        const normalizedHoursB = b.recentHours / maxRecentHours;
        // 综合评分
        const scoreA = normalizedGrowthA * 0.4 + normalizedHoursA * 0.6;
        const scoreB = normalizedGrowthB * 0.4 + normalizedHoursB * 0.6;
        return scoreB - scoreA;
      }),
      // 下降排序：综合评分 = 下降幅度权重(0.4) + 工时权重(0.6)
      declining: decliningList.sort((a, b) => {
        // 归一化下降率（取绝对值）
        const normalizedDeclineA = Math.min(Math.abs(a.growthRate) / 100, 1);
        const normalizedDeclineB = Math.min(Math.abs(b.growthRate) / 100, 1);
        // 归一化工时
        const normalizedHoursA = a.recentHours / maxRecentHours;
        const normalizedHoursB = b.recentHours / maxRecentHours;
        // 综合评分（工时越高、下降越多的排前面）
        const scoreA = normalizedDeclineA * 0.4 + normalizedHoursA * 0.6;
        const scoreB = normalizedDeclineB * 0.4 + normalizedHoursB * 0.6;
        return scoreB - scoreA;
      }),
    };

    return { activityRanking, growthRanking, trendData, top5Companies, stats, companyLists, recentMonths };
  }, [teamData]);
  
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

  // 创建自定义 Dot 组件，接受独立的 categoryColors
  const createCustomDot = (categoryColors: Record<string, string>) => (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload || !payload.category) return null;
    const color = categoryColors[payload.category];
    return <circle cx={cx} cy={cy} r={5} fill={color} opacity={0.6} />;
  };

  const renderDistributionChart = (
    categories: InvestmentDealCategory[], 
    title: string, 
    chartData: {
      categoryChartData: any;
      categoryXMapping: Record<string, number>;
      categoryColors: Record<string, string>;
      allScatterPoints: any[];
    }
  ) => {
    const statsData = Object.fromEntries(categories.map(cat => [cat, chartData.categoryChartData[cat]?.statsSummary]));
    const ticks = categories.map(cat => chartData.categoryXMapping[cat]);
    const tickFormatter = (value: number) => Object.keys(chartData.categoryXMapping).find(key => chartData.categoryXMapping[key] === value) || '';
    const CustomDotForChart = createCustomDot(chartData.categoryColors);

    return (
      <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex-1">
        <CardHeader className="pb-2 border-b border-slate-200/50 dark:border-slate-700/50">
          <CardTitle className="text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex pt-4">
          <div className="w-[75%]">
            <ResponsiveContainer width="100%" height={320}>
              <ScatterChart margin={{ top: 20, right: 10, bottom: 20, left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" name="Deal/Matter Category" ticks={ticks} tickFormatter={tickFormatter} domain={['dataMin - 0.5', 'dataMax + 0.5']} tick={{ fontSize: 11 }} />
                <YAxis type="number" dataKey="hours" name="Duration" domain={[0, 'auto']} tickFormatter={(value) => `${value}h`} width={50} tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter 
                  isAnimationActive={false}
                  name='Data' 
                  data={chartData.allScatterPoints ? chartData.allScatterPoints.filter(p => categories.includes(p.category)) : []} 
                  shape={<CustomDotForChart />} 
                  legendType='none'
                />
              </ScatterChart>
            </ResponsiveContainer>
            {/* 图例 - 散点图下方并排展示，向右偏移对齐图表区域 */}
            <div className="flex items-center justify-center gap-6 mt-2 ml-10">
              {categories.map(cat => (
                <div key={cat} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: chartData.categoryColors[cat] }}></span>
                  <span className="text-slate-600 text-[11px]">{cat}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="w-[25%] p-3 text-xs">
            {/* 统计信息 */}
            {categories.map(cat => statsData[cat] && (
              <div key={cat} className="mb-3">
                <p className="font-bold text-slate-700">{cat}:</p>
                <p className="text-slate-500">Projects: {(statsData[cat] as any).count}</p>
                <p className="text-slate-500">Median: {(statsData[cat] as any).median}h</p>
                <p className="text-slate-500">Average: {(statsData[cat] as any).average}h</p>
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
              <BarChart data={processedData.top10Data} layout="vertical" margin={{ left: 20, right: 30, top: 5, bottom: 5 }}>
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
                    const category = item?.category;
                    // Use category colors for text
                    let textColor = '#475569';
                    if (category === 'IPO') textColor = '#55A868';
                    else if (category === 'Corporate Matter') textColor = '#4C72B0';
                    else if (category === 'M&A') textColor = '#C44E52';
                    // 动态截断：根据名称长度自适应
                    const maxLen = 12;
                    const displayName = payload.value.length > maxLen ? payload.value.substring(0, maxLen) + '...' : payload.value;
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <title>{payload.value}</title>
                        <text x={-8} y={0} dy={4} textAnchor="end" fill={textColor} fontSize={11} fontWeight={600}>
                          {displayName}
                        </text>
                      </g>
                    );
                  }}
                  width={130}
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

      {/* 活跃度分析区域 */}
      {activityData.activityRanking.length > 0 && (
        <div className="space-y-4">
          {/* 活跃度分析标题 */}
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-gradient-to-b from-orange-500 to-amber-600 rounded-full"></div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">Investment Company Activity Analysis</h3>
              <p className="text-xs text-slate-500">Analyzing company activity based on the last 3 months of timesheet data</p>
            </div>
          </div>

          {/* 统计卡片 - 高级设计风格 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 活跃公司卡片 */}
            <div 
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 p-5 cursor-pointer shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-1 transition-all duration-300"
              onClick={() => handleDialogOpen(true, 'active', 'Active Companies（活跃公司）')}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <span className="text-white/80 text-xs font-medium tracking-wide uppercase">Active</span>
                </div>
                <div className="text-4xl font-bold text-white mb-1 tracking-tight">{activityData.stats.active}</div>
                <p className="text-white/70 text-sm font-medium">活跃公司</p>
                <div className="mt-3 flex items-center gap-1 text-white/60 text-xs group-hover:text-white/90 transition-colors">
                  <span>查看详情</span>
                  <svg className="w-3 h-3 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* 新进公司卡片 */}
            <div 
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 p-5 cursor-pointer shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-1 transition-all duration-300"
              onClick={() => handleDialogOpen(true, 'new', 'New Companies（新进公司）')}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <span className="text-white/80 text-xs font-medium tracking-wide uppercase">New</span>
                </div>
                <div className="text-4xl font-bold text-white mb-1 tracking-tight">{activityData.stats.new}</div>
                <p className="text-white/70 text-sm font-medium">新进公司</p>
                <div className="mt-3 flex items-center gap-1 text-white/60 text-xs group-hover:text-white/90 transition-colors">
                  <span>查看详情</span>
                  <svg className="w-3 h-3 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* 增长中卡片 */}
            <div 
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-orange-600 to-amber-700 p-5 cursor-pointer shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/30 hover:-translate-y-1 transition-all duration-300"
              onClick={() => handleDialogOpen(true, 'rising', 'Rising Companies（增长中公司）')}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  </div>
                  <span className="text-white/80 text-xs font-medium tracking-wide uppercase">Rising</span>
                </div>
                <div className="text-4xl font-bold text-white mb-1 tracking-tight">{activityData.stats.rising}</div>
                <p className="text-white/70 text-sm font-medium">增长中</p>
                <div className="mt-3 flex items-center gap-1 text-white/60 text-xs group-hover:text-white/90 transition-colors">
                  <span>查看详情</span>
                  <svg className="w-3 h-3 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* 活跃下降卡片 */}
            <div 
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 via-rose-600 to-pink-700 p-5 cursor-pointer shadow-lg shadow-rose-500/20 hover:shadow-xl hover:shadow-rose-500/30 hover:-translate-y-1 transition-all duration-300"
              onClick={() => handleDialogOpen(true, 'declining', 'Declining Companies（活跃下降公司）')}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                  <span className="text-white/80 text-xs font-medium tracking-wide uppercase">Declining</span>
                </div>
                <div className="text-4xl font-bold text-white mb-1 tracking-tight">{activityData.stats.declining}</div>
                <p className="text-white/70 text-sm font-medium">活跃下降</p>
                <div className="mt-3 flex items-center gap-1 text-white/60 text-xs group-hover:text-white/90 transition-colors">
                  <span>查看详情</span>
                  <svg className="w-3 h-3 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* 活跃度排行榜和趋势图 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
            {/* 近期最活跃 Top 10 - 极简表格风格 */}
            <Card className="overflow-hidden border border-slate-200/60 shadow-sm bg-white h-full">
              <CardHeader className="pb-3 pt-4 px-5">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center justify-between">
                  <span>Top 10 Active Companies（近期最活跃）</span>
                  <span className="text-xs font-normal text-slate-400">Last 3 months</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-y border-slate-100 bg-slate-50/50">
                      <th className="text-left text-xs font-medium text-slate-500 px-5 py-2 w-8">#</th>
                      <th className="text-left text-xs font-medium text-slate-500 py-2">Company</th>
                      <th className="text-center text-xs font-medium text-slate-500 py-2 w-16">Status</th>
                      <th className="text-right text-xs font-medium text-slate-500 py-2 w-16">Hours</th>
                      <th className="text-right text-xs font-medium text-slate-500 px-5 py-2 w-16">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityData.activityRanking.map((company, idx) => {
                      const categoryColors: Record<string, string> = {
                        'Corporate Matter': 'text-blue-600',
                        'IPO': 'text-emerald-600',
                        'M&A': 'text-rose-600',
                      };
                      
                      // 状态标签配置
                      const statusConfig: Record<ActivityStatus, { label: string; color: string; bg: string }> = {
                        hot: { label: 'Hot', color: 'text-orange-600', bg: 'bg-orange-50' },
                        rising: { label: 'Rising', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        stable: { label: 'Stable', color: 'text-slate-500', bg: 'bg-slate-50' },
                        declining: { label: 'Declining', color: 'text-rose-600', bg: 'bg-rose-50' },
                        inactive: { label: 'Inactive', color: 'text-slate-400', bg: 'bg-slate-50' },
                        new: { label: 'New', color: 'text-blue-600', bg: 'bg-blue-50' },
                      };
                      const statusInfo = statusConfig[company.status];

                      return (
                        <tr 
                          key={company.name} 
                          className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-5 py-2.5">
                            <span className={cn(
                              "text-xs font-semibold tabular-nums",
                              idx < 3 ? "text-amber-500" : "text-slate-400"
                            )}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-800 truncate max-w-[120px]" title={company.name}>
                                {company.name}
                              </span>
                              <span className={cn("text-xs font-medium", categoryColors[company.category])}>
                                {company.category}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 text-center">
                            <span className={cn(
                              "text-xs px-2 py-0.5 rounded font-medium",
                              statusInfo.bg, statusInfo.color
                            )}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="py-2.5 text-right">
                            <span className="text-sm font-semibold text-slate-700 tabular-nums">
                              {company.recentHours.toFixed(0)}h
                            </span>
                          </td>
                          <td className="px-5 py-2.5 text-right">
                            <span className={cn(
                              "text-xs font-medium tabular-nums",
                              company.status === 'new' ? "text-blue-500" : company.growthRate >= 0 ? "text-emerald-500" : "text-rose-500"
                            )}>
                              {company.status === 'new' ? 'NEW' : `${company.growthRate >= 0 ? '+' : ''}${company.growthRate.toFixed(0)}%`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* 右侧列：趋势图 + 指标定义 */}
            <div className="flex flex-col gap-4 h-full">
              {/* 工时趋势对比图 - 极简风格 */}
              <Card className="overflow-hidden border border-slate-200/60 shadow-sm bg-white flex-1">
                <CardHeader className="pb-2 pt-3 px-5">
                  <CardTitle className="text-sm font-semibold text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span>Top 5 Companies Trend</span>
                      <span className="text-[10px] font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">from Active Ranking</span>
                    </span>
                    <span className="text-xs font-normal text-slate-400">Last 6 months</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-1 pb-3 px-4 h-[calc(100%-48px)]">
                  <ResponsiveContainer width="100%" height="85%">
                    <LineChart data={activityData.trendData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                        dy={5}
                      />
                      <YAxis 
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${v}h`}
                        width={35}
                        domain={[0, 'auto']}
                        allowDecimals={false}
                        tickCount={5}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #e2e8f0', 
                          borderRadius: '8px', 
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          padding: '6px 10px',
                          fontSize: '11px'
                        }}
                        formatter={(value: number, name: string, props: any) => {
                          const idx = parseInt(name.replace('company', ''));
                          const companyName = activityData.top5Companies?.[idx]?.name || '';
                          return [`${value.toFixed(1)}h`, companyName];
                        }}
                      />
                      {activityData.top5Companies?.map((company, idx) => {
                        const colors = ['#3b82f6', '#10b981', '#f43f5e', '#8b5cf6', '#f59e0b'];
                        return (
                          <Line
                            key={idx}
                            type="monotone"
                            dataKey={`company${idx}`}
                            name={`company${idx}`}
                            stroke={colors[idx]}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 3, fill: colors[idx], stroke: 'white', strokeWidth: 2 }}
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                  {/* 图例 - 更紧凑 */}
                  <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1 pt-1.5 border-t border-slate-100">
                    {activityData.top5Companies?.map((company, idx) => {
                      const colors = ['#3b82f6', '#10b981', '#f43f5e', '#8b5cf6', '#f59e0b'];
                      return (
                        <div key={idx} className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors[idx] }} />
                          <span className="text-[10px] text-slate-500 truncate max-w-[60px]" title={company.name}>
                            {company.name.length > 6 ? company.name.substring(0, 6) + '…' : company.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* 指标定义说明卡片 */}
              <Card className="overflow-hidden border border-slate-200/60 shadow-sm bg-white">
                <CardHeader className="pb-2 pt-3 px-5">
                  <CardTitle className="text-sm font-semibold text-slate-800">
                    Metrics Definitions（指标定义）
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-3 px-5">
                  {/* 统计卡说明 */}
                  <p className="text-xs font-medium text-slate-600 mb-1.5">Statistics Cards（统计卡定义）</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-500">
                    <div className="flex items-start gap-1">
                      <span className="px-1 py-0.5 rounded bg-blue-50 text-blue-600 font-medium shrink-0 text-[10px]">Active</span>
                      <span className="text-[11px]">近3个月有工时记录</span>
                    </div>
                    <div className="flex items-start gap-1">
                      <span className="px-1 py-0.5 rounded bg-purple-50 text-purple-600 font-medium shrink-0 text-[10px]">New</span>
                      <span className="text-[11px]">首次出现在近3个月内</span>
                    </div>
                    <div className="flex items-start gap-1">
                      <span className="px-1 py-0.5 rounded bg-orange-50 text-orange-600 font-medium shrink-0 text-[10px]">Rising</span>
                      <span className="text-[11px]">增长率&gt;20%，按综合评分排序</span>
                    </div>
                    <div className="flex items-start gap-1">
                      <span className="px-1 py-0.5 rounded bg-rose-50 text-rose-600 font-medium shrink-0 text-[10px]">Declining</span>
                      <span className="text-[11px]">增长率&lt;-30%，按综合评分排序</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5 mb-2 italic">* 综合评分 = 增长/下降幅度(40%) + 工时(60%)</p>
                  {/* Top 10 状态标签说明 */}
                  <p className="text-xs font-medium text-slate-600 mb-1.5 pt-2 border-t border-slate-100">Top 10 Status Labels（状态标签）</p>
                  <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs text-slate-500">
                    <div className="flex items-start gap-1">
                      <span className="px-1 py-0.5 rounded bg-blue-50 text-blue-600 font-medium shrink-0 text-[10px]">New</span>
                      <span className="text-[11px]">首次出现在近3月</span>
                    </div>
                    <div className="flex items-start gap-1">
                      <span className="px-1 py-0.5 rounded bg-orange-50 text-orange-600 font-medium shrink-0 text-[10px]">Hot</span>
                      <span className="text-[11px]">增长率&gt;50%</span>
                    </div>
                    <div className="flex items-start gap-1">
                      <span className="px-1 py-0.5 rounded bg-emerald-50 text-emerald-600 font-medium shrink-0 text-[10px]">Rising</span>
                      <span className="text-[11px]">增长率&gt;20%</span>
                    </div>
                    <div className="flex items-start gap-1">
                      <span className="px-1 py-0.5 rounded bg-slate-100 text-slate-500 font-medium shrink-0 text-[10px]">Stable</span>
                      <span className="text-[11px]">-30%~20%</span>
                    </div>
                    <div className="flex items-start gap-1">
                      <span className="px-1 py-0.5 rounded bg-rose-50 text-rose-600 font-medium shrink-0 text-[10px]">Declining</span>
                      <span className="text-[11px]">增长率&lt;-30%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Hour Distribution Charts - 并排展示，共用筛选器 */}
      <div className="space-y-4">
        {/* 共用筛选器 */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">Hour Distribution by Deal/Matter Category</h3>
          <MinimalPeriodFilter
            period={distPeriod}
            setPeriod={setDistPeriod}
            selectedYear={distSelectedYear}
            setSelectedYear={setDistSelectedYear}
            selectedPeriodValue={distSelectedPeriodValue}
            setSelectedPeriodValue={setDistSelectedPeriodValue}
            customStartDate={distCustomStartDate}
            setCustomStartDate={setDistCustomStartDate}
            customEndDate={distCustomEndDate}
            setCustomEndDate={setDistCustomEndDate}
            availableYears={availableYears}
            periodOptions={periodOptions}
          />
        </div>
        {/* 并排图表 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {renderDistributionChart(
            ['Corporate Matter', 'IPO'], 
            'Corporate Matter & IPO', 
            distProcessedData
          )}
          {renderDistributionChart(
            ['M&A'], 
            'M&A', 
            distProcessedData
          )}
        </div>
      </div>

      {/* 公司列表弹窗 - 极简设计 */}
      <Dialog open={companyListDialog.open} onOpenChange={(open) => handleDialogOpen(open)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col p-0 gap-0 rounded-xl border border-slate-200 shadow-xl bg-white">
          {/* 极简头部 */}
          <div className="px-6 py-4 border-b border-slate-100">
            <DialogHeader className="p-0 space-y-0">
              <DialogTitle className="text-lg font-semibold text-slate-900">{companyListDialog.title}</DialogTitle>
            </DialogHeader>
            {/* 筛选栏 */}
            <div className="flex items-center gap-3 mt-3">
              {/* 搜索框 */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="搜索公司名称..."
                  value={dialogFilter.searchText}
                  onChange={(e) => setDialogFilter(prev => ({ ...prev, searchText: e.target.value }))}
                  className="w-full px-3 py-1.5 pl-8 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                />
                <svg className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {/* 类别筛选按钮 */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDialogFilter(prev => ({ ...prev, category: 'all' }))}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                    dialogFilter.category === 'all' 
                      ? "bg-slate-800 text-white" 
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  全部
                </button>
                <button
                  onClick={() => setDialogFilter(prev => ({ ...prev, category: 'Corporate Matter' }))}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1",
                    dialogFilter.category === 'Corporate Matter' 
                      ? "bg-blue-500 text-white" 
                      : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                  Corporate
                </button>
                <button
                  onClick={() => setDialogFilter(prev => ({ ...prev, category: 'IPO' }))}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1",
                    dialogFilter.category === 'IPO' 
                      ? "bg-emerald-500 text-white" 
                      : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                  IPO
                </button>
                <button
                  onClick={() => setDialogFilter(prev => ({ ...prev, category: 'M&A' }))}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1",
                    dialogFilter.category === 'M&A' 
                      ? "bg-rose-500 text-white" 
                      : "bg-rose-50 text-rose-600 hover:bg-rose-100"
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                  M&A
                </button>
              </div>
            </div>
            {/* 统计信息 */}
            <div className="flex items-center gap-5 text-xs text-slate-500 mt-2">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span>Corporate Matter</span>
                <span className="font-medium text-slate-700">{activityData.companyLists?.[companyListDialog.type]?.filter(c => c.category === 'Corporate Matter').length || 0}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>IPO</span>
                <span className="font-medium text-slate-700">{activityData.companyLists?.[companyListDialog.type]?.filter(c => c.category === 'IPO').length || 0}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>M&A</span>
                <span className="font-medium text-slate-700">{activityData.companyLists?.[companyListDialog.type]?.filter(c => c.category === 'M&A').length || 0}</span>
              </span>
            </div>
          </div>

          {/* 列表内容 - 极简表格风格 */}
          <div className="flex-1 overflow-y-auto">
            {(() => {
              const filteredList = activityData.companyLists?.[companyListDialog.type]?.filter(c => {
                const matchCategory = dialogFilter.category === 'all' || c.category === dialogFilter.category;
                const matchSearch = !dialogFilter.searchText || c.name.toLowerCase().includes(dialogFilter.searchText.toLowerCase());
                return matchCategory && matchSearch;
              }) || [];
              
              return filteredList.length > 0 ? (
              <table className="w-full">
                <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">
                  <tr className="text-xs text-slate-500 border-b border-slate-100">
                    <th className="text-left font-medium px-6 py-3 w-12">#</th>
                    <th className="text-left font-medium py-3">公司名称</th>
                    <th className="text-left font-medium py-3 w-32">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="flex items-center gap-1 hover:text-slate-700 transition-colors group">
                            <span>类别</span>
                            {dialogFilter.category !== 'all' && (
                              <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-slate-200 text-slate-600">
                                {dialogFilter.category === 'Corporate Matter' ? 'Corp' : dialogFilter.category}
                              </span>
                            )}
                            <svg className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-40 p-1.5 bg-white shadow-xl border border-slate-200/80 rounded-xl backdrop-blur-sm" align="start" sideOffset={4}>
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => setDialogFilter(prev => ({ ...prev, category: 'all' }))}
                              className={cn(
                                "px-3 py-2 text-xs text-left rounded-md transition-colors",
                                dialogFilter.category === 'all' 
                                  ? "bg-slate-100 text-slate-900 font-medium" 
                                  : "text-slate-600 hover:bg-slate-50"
                              )}
                            >
                              全部类别
                            </button>
                            <button
                              onClick={() => setDialogFilter(prev => ({ ...prev, category: 'Corporate Matter' }))}
                              className={cn(
                                "px-3 py-2 text-xs text-left rounded-md transition-colors flex items-center gap-2",
                                dialogFilter.category === 'Corporate Matter' 
                                  ? "bg-blue-50 text-blue-700 font-medium" 
                                  : "text-slate-600 hover:bg-slate-50"
                              )}
                            >
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              Corporate Matter
                            </button>
                            <button
                              onClick={() => setDialogFilter(prev => ({ ...prev, category: 'IPO' }))}
                              className={cn(
                                "px-3 py-2 text-xs text-left rounded-md transition-colors flex items-center gap-2",
                                dialogFilter.category === 'IPO' 
                                  ? "bg-emerald-50 text-emerald-700 font-medium" 
                                  : "text-slate-600 hover:bg-slate-50"
                              )}
                            >
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              IPO
                            </button>
                            <button
                              onClick={() => setDialogFilter(prev => ({ ...prev, category: 'M&A' }))}
                              className={cn(
                                "px-3 py-2 text-xs text-left rounded-md transition-colors flex items-center gap-2",
                                dialogFilter.category === 'M&A' 
                                  ? "bg-rose-50 text-rose-700 font-medium" 
                                  : "text-slate-600 hover:bg-slate-50"
                              )}
                            >
                              <span className="w-2 h-2 rounded-full bg-rose-500" />
                              M&A
                            </button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </th>
                    <th className="text-right font-medium py-3 w-20">工时</th>
                    <th className="text-right font-medium px-6 py-3 w-20">增长率</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredList.map((company, idx) => {
                    const categoryColors: Record<string, string> = {
                      'Corporate Matter': 'text-blue-600',
                      'IPO': 'text-emerald-600',
                      'M&A': 'text-rose-600',
                    };

                    return (
                      <tr 
                        key={company.name} 
                        className="group hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-6 py-3">
                          <span className={cn(
                            "text-sm font-medium",
                            idx < 3 ? "text-amber-500" : "text-slate-400"
                          )}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-800 truncate max-w-[280px]" title={company.name}>
                              {company.name}
                            </span>
                            <span className="text-xs text-slate-400 mt-0.5">
                              {company.firstAppearance} → {company.lastActivity}
                            </span>
                          </div>
                        </td>
                        <td className="py-3">
                          <span className={cn("text-xs font-medium", categoryColors[company.category])}>
                            {company.category}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <span className="text-sm font-semibold text-slate-700 tabular-nums">
                            {company.recentHours.toFixed(0)}h
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <span className={cn(
                            "text-sm font-medium tabular-nums",
                            company.status === 'new' ? "text-blue-500" : company.growthRate >= 0 ? "text-emerald-500" : "text-rose-500"
                          )}>
                            {company.status === 'new' ? 'NEW' : `${company.growthRate >= 0 ? '+' : ''}${company.growthRate.toFixed(0)}%`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <p className="text-sm">{dialogFilter.searchText || dialogFilter.category !== 'all' ? '没有符合筛选条件的数据' : '暂无数据'}</p>
              </div>
            );
            })()}
          </div>
        </DialogContent>
      </Dialog>
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
  const initializedRef = useRef(false);

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

  // 初始化：设置默认年份和最新月份（只执行一次）
  useEffect(() => {
    if (initializedRef.current) return;
    if (availableYears.length > 0 && teamFilteredData.length > 0) {
      const latestMonth = teamFilteredData.reduce((latest, row) => {
        const d = parseMonthString(row['Month']);
        return d && d > latest ? d : latest;
      }, new Date(0));
      if (latestMonth.getTime() > 0) {
        setSelectedYear(latestMonth.getFullYear().toString());
        setSelectedPeriodValue(latestMonth.getMonth().toString());
        initializedRef.current = true;
      }
    }
  }, [availableYears, teamFilteredData]);

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
  const { t } = useTranslation();
  const [activeTeamTab, setActiveTeamTab] = useState('investment-legal');
  
  // 无数据时的展示
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-neutral-500">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-lg font-medium">{t('dashboard.empty.title')}</p>
          <p className="text-sm text-neutral-400 mt-1">{t('dashboard.empty.subtitle')}</p>
        </div>
      </div>
    );
  }

  return (
    <Tabs value={activeTeamTab} onValueChange={setActiveTeamTab}>
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
