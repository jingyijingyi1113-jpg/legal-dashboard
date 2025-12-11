import { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from '@/contexts/AuthContext';
import { useTimesheet } from '@/contexts/TimesheetContext';
import { cn } from "@/lib/utils";
import { getWorkdaysInRange } from '@/lib/date-utils';
import type { TimesheetEntry, LeaveRecord } from '@/types/timesheet';

// 极简风格年份选择器
const MinimalYearSelector = ({
  selectedYear,
  onSelect,
  availableYears
}: {
  selectedYear: number;
  onSelect: (year: number) => void;
  availableYears: number[];
}) => {
  const [open, setOpen] = useState(false);
  
  const currentYear = new Date().getFullYear();
  const defaultYears = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);
  const yearsToShow = availableYears.length > 0 ? availableYears : defaultYears;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "group relative inline-flex items-center gap-2 px-0 py-1",
            "text-neutral-900 transition-all duration-300",
            "focus:outline-none focus-visible:ring-0"
          )}
        >
          <span className="text-lg font-semibold tracking-tight text-neutral-800 tabular-nums">
            {selectedYear}
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
          <div className="grid grid-cols-3 gap-1 p-3 max-h-[240px] overflow-y-auto">
            {yearsToShow.map((year) => {
              const isSelected = selectedYear === year;
              const isCurrentYear = new Date().getFullYear() === year;
              
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

// 极简风格月份选择器
const MinimalMonthSelector = ({
  selectedYear,
  selectedMonth,
  onSelect
}: {
  selectedYear: number;
  selectedMonth: number | 'all';
  onSelect: (year: number, month: number) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selectedYear);

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const monthLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  const handleMonthSelect = (month: number) => {
    onSelect(viewYear, month);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      if (isOpen) {
        setViewYear(selectedYear);
      }
      setOpen(isOpen);
    }}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "group relative inline-flex items-center gap-2 px-0 py-1",
            "text-neutral-900 transition-all duration-300",
            "focus:outline-none focus-visible:ring-0"
          )}
        >
          <span className="text-lg font-semibold tracking-tight text-neutral-800 tabular-nums">
            {selectedMonth !== 'all' ? monthLabels[selectedMonth - 1] : '全年'}
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
          
          <div className="grid grid-cols-3 gap-1 p-3">
            {months.map((month) => {
              const isSelected = selectedMonth === month && selectedYear === viewYear;
              const isCurrentMonth = new Date().getMonth() + 1 === month && new Date().getFullYear() === viewYear;
              
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
                  {monthLabels[month - 1]}
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
  selectedQuarter: number;
  onSelect: (quarter: number) => void;
}) => {
  const [open, setOpen] = useState(false);
  const quarters = [
    { value: 1, label: '第一季度' },
    { value: 2, label: '第二季度' },
    { value: 3, label: '第三季度' },
    { value: 4, label: '第四季度' },
  ];

  const selectedLabel = quarters.find(q => q.value === selectedQuarter)?.label || '选择季度';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "group relative inline-flex items-center gap-2 px-0 py-1",
            "text-neutral-900 transition-all duration-300",
            "focus:outline-none focus-visible:ring-0"
          )}
        >
          <span className="text-lg font-semibold tracking-tight text-neutral-800 tabular-nums">
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
  selectedSemiannual: number;
  onSelect: (semiannual: number) => void;
}) => {
  const [open, setOpen] = useState(false);
  const semiannuals = [
    { value: 1, label: '上半年' },
    { value: 2, label: '下半年' },
  ];

  const selectedLabel = semiannuals.find(s => s.value === selectedSemiannual)?.label || '选择半年度';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "group relative inline-flex items-center gap-2 px-0 py-1",
            "text-neutral-900 transition-all duration-300",
            "focus:outline-none focus-visible:ring-0"
          )}
        >
          <span className="text-lg font-semibold tracking-tight text-neutral-800 tabular-nums">
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

interface TimesheetHistoryProps {
  onCopyEntry?: (entry: TimesheetEntry) => void;
}

export function TimesheetHistory({ onCopyEntry }: TimesheetHistoryProps) {
  const { user } = useAuth();
  const { entries, leaveRecords } = useTimesheet();
  
  // 筛选条件
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>(currentMonth);

  // 获取可选的年份列表（从最早记录到当前年份）
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(currentYear);
    entries.forEach(e => {
      const year = new Date(e.date).getFullYear();
      years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [entries, currentYear]);

  // 周期类型
  type PeriodType = 'month' | 'quarter' | 'halfYear' | 'year' | 'custom';
  const [periodType, setPeriodType] = useState<PeriodType>('month');

  // 月份选项
  const months = [
    { value: 1, label: '1月' },
    { value: 2, label: '2月' },
    { value: 3, label: '3月' },
    { value: 4, label: '4月' },
    { value: 5, label: '5月' },
    { value: 6, label: '6月' },
    { value: 7, label: '7月' },
    { value: 8, label: '8月' },
    { value: 9, label: '9月' },
    { value: 10, label: '10月' },
    { value: 11, label: '11月' },
    { value: 12, label: '12月' },
  ];

  // 季度选项
  const quarters = [
    { value: 1, label: 'Q1', months: [1, 2, 3] },
    { value: 2, label: 'Q2', months: [4, 5, 6] },
    { value: 3, label: 'Q3', months: [7, 8, 9] },
    { value: 4, label: 'Q4', months: [10, 11, 12] },
  ];

  // 半年度选项
  const halfYears = [
    { value: 1, label: '上半年', months: [1, 2, 3, 4, 5, 6] },
    { value: 2, label: '下半年', months: [7, 8, 9, 10, 11, 12] },
  ];

  // 周期类型配置
  const periodTypes = [
    { value: 'month' as PeriodType, label: '月度' },
    { value: 'quarter' as PeriodType, label: '季度' },
    { value: 'halfYear' as PeriodType, label: '半年度' },
    { value: 'year' as PeriodType, label: '年度' },
    { value: 'custom' as PeriodType, label: '自定义' },
  ];

  // 自定义日期范围
  const [customStartDate, setCustomStartDate] = useState<string>(`${currentYear}-01-01`);
  const [customEndDate, setCustomEndDate] = useState<string>(`${currentYear}-12-31`);

  // 季度/半年度选择
  const [selectedQuarter, setSelectedQuarter] = useState<number>(Math.ceil(currentMonth / 3));
  const [selectedHalfYear, setSelectedHalfYear] = useState<number>(currentMonth <= 6 ? 1 : 2);

  // 获取当前用户的已提交记录（按筛选条件过滤）
  const filteredEntries = useMemo(() => {
    if (!user) return [];
    
    return entries.filter(e => {
      if (e.userId !== user.id) return false;
      if (e.status !== 'submitted') return false;
      
      const entryDate = new Date(e.date);
      const entryYear = entryDate.getFullYear();
      const entryMonth = entryDate.getMonth() + 1;
      
      if (entryYear !== selectedYear) return false;
      
      switch (periodType) {
        case 'month':
          if (selectedMonth !== 'all' && entryMonth !== selectedMonth) return false;
          break;
        case 'quarter':
          const quarter = quarters.find(q => q.value === selectedQuarter);
          if (quarter && !quarter.months.includes(entryMonth)) return false;
          break;
        case 'halfYear':
          const half = halfYears.find(h => h.value === selectedHalfYear);
          if (half && !half.months.includes(entryMonth)) return false;
          break;
        case 'year':
          // 全年，不需要额外过滤
          break;
        case 'custom':
          const dateStr = e.date;
          if (dateStr < customStartDate || dateStr > customEndDate) return false;
          break;
      }
      
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries, user, selectedYear, selectedMonth, periodType, selectedQuarter, selectedHalfYear, customStartDate, customEndDate, quarters, halfYears]);

  // 获取选定时间范围的开始和结束日期
  const dateRange = useMemo(() => {
    let startDate: string;
    let endDate: string;
    
    switch (periodType) {
      case 'month':
        if (selectedMonth === 'all') {
          startDate = `${selectedYear}-01-01`;
          endDate = `${selectedYear}-12-31`;
        } else {
          const month = String(selectedMonth).padStart(2, '0');
          startDate = `${selectedYear}-${month}-01`;
          const lastDay = new Date(selectedYear, selectedMonth as number, 0).getDate();
          endDate = `${selectedYear}-${month}-${String(lastDay).padStart(2, '0')}`;
        }
        break;
      case 'quarter':
        const quarterMonths = quarters.find(q => q.value === selectedQuarter)?.months || [1, 2, 3];
        const qStartMonth = String(quarterMonths[0]).padStart(2, '0');
        const qEndMonth = String(quarterMonths[2]).padStart(2, '0');
        startDate = `${selectedYear}-${qStartMonth}-01`;
        const qLastDay = new Date(selectedYear, quarterMonths[2], 0).getDate();
        endDate = `${selectedYear}-${qEndMonth}-${String(qLastDay).padStart(2, '0')}`;
        break;
      case 'halfYear':
        const halfMonths = halfYears.find(h => h.value === selectedHalfYear)?.months || [1, 2, 3, 4, 5, 6];
        const hStartMonth = String(halfMonths[0]).padStart(2, '0');
        const hEndMonth = String(halfMonths[5]).padStart(2, '0');
        startDate = `${selectedYear}-${hStartMonth}-01`;
        const hLastDay = new Date(selectedYear, halfMonths[5], 0).getDate();
        endDate = `${selectedYear}-${hEndMonth}-${String(hLastDay).padStart(2, '0')}`;
        break;
      case 'year':
        startDate = `${selectedYear}-01-01`;
        endDate = `${selectedYear}-12-31`;
        break;
      case 'custom':
        startDate = customStartDate;
        endDate = customEndDate;
        break;
      default:
        startDate = `${selectedYear}-01-01`;
        endDate = `${selectedYear}-12-31`;
    }
    
    return { startDate, endDate };
  }, [periodType, selectedYear, selectedMonth, selectedQuarter, selectedHalfYear, customStartDate, customEndDate, quarters, halfYears]);

  // 计算实际的日期范围（截止到今天）
  const actualDateRange = useMemo(() => {
    const { startDate, endDate } = dateRange;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 如果结束日期在未来，使用今天作为结束日期
    const actualEnd = end > today ? today : end;
    
    return {
      startDate,
      endDate: actualEnd.toISOString().split('T')[0],
      actualEnd
    };
  }, [dateRange]);

  // 计算选定时间范围内的请假天数（截止到今天）
  const leaveDaysInRange = useMemo(() => {
    if (!user) return 0;
    
    const { startDate, endDate } = actualDateRange;
    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);
    
    return leaveRecords
      .filter((r: LeaveRecord) => r.userId === user.id)
      .reduce((total: number, record: LeaveRecord) => {
        const leaveStart = new Date(record.startDate);
        const leaveEnd = new Date(record.endDate);
        
        // 检查请假记录是否与选定范围有交集
        if (leaveEnd < rangeStart || leaveStart > rangeEnd) {
          return total;
        }
        
        // 计算交集范围内的请假天数
        const overlapStart = leaveStart < rangeStart ? rangeStart : leaveStart;
        const overlapEnd = leaveEnd > rangeEnd ? rangeEnd : leaveEnd;
        
        // 计算交集范围内的工作日天数
        let days = 0;
        const current = new Date(overlapStart);
        while (current <= overlapEnd) {
          const dayOfWeek = current.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            days++;
          }
          current.setDate(current.getDate() + 1);
        }
        
        // 如果请假记录完全在范围内，使用记录的天数；否则使用计算的天数
        if (leaveStart >= rangeStart && leaveEnd <= rangeEnd) {
          return total + record.days;
        }
        return total + days;
      }, 0);
  }, [user, leaveRecords, actualDateRange]);

  // 计算选定时间范围内的总工作日天数（排除周末和节假日，截止到今天）
  const totalWorkDaysInRange = useMemo(() => {
    const { startDate } = dateRange;
    const { endDate } = actualDateRange;
    
    // 使用用户的地区设置，默认为 CN
    const userRegion = user?.region || 'CN';
    
    return getWorkdaysInRange(startDate, endDate, userRegion);
  }, [dateRange, actualDateRange, user]);

  // 统计数据
  const stats = useMemo(() => {
    const totalHours = filteredEntries.reduce((sum, e) => sum + e.hours, 0);
    const totalEntries = filteredEntries.length;
    
    // 按日期分组统计
    const byDate = new Map<string, number>();
    filteredEntries.forEach(e => {
      byDate.set(e.date, (byDate.get(e.date) || 0) + e.hours);
    });
    const recordedDays = byDate.size;
    
    // 应出勤天数 = 总工作日 - 请假天数
    const workDays = Math.max(0, totalWorkDaysInRange - leaveDaysInRange);
    const avgHoursPerDay = workDays > 0 ? totalHours / workDays : 0;
    
    return { totalHours, totalEntries, workDays, avgHoursPerDay, recordedDays, leaveDays: leaveDaysInRange };
  }, [filteredEntries, totalWorkDaysInRange, leaveDaysInRange]);

  // 获取记录的显示信息
  const getEntryDisplayInfo = (entry: TimesheetEntry) => {
    const data = entry.data;
    const category = data.category as string || '';
    const task = data.task as string || data.project as string || '';
    return { category, task };
  };

  // 复制记录
  const handleCopy = (entry: TimesheetEntry) => {
    onCopyEntry?.(entry);
  };

  return (
    <div className="space-y-6">
      {/* 筛选区域 - 极简风格 */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl shadow-slate-200/50 p-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {/* PERIOD 标签 */}
          <span className="text-xs font-medium tracking-widest text-neutral-400 uppercase">Period</span>
          
          {/* 周期类型切换 */}
          <div className="flex items-center gap-0.5 p-1 bg-neutral-100/80 rounded-full">
            {periodTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => setPeriodType(type.value)}
                className={cn(
                  "px-4 py-2.5 text-xs font-medium rounded-full transition-colors duration-75",
                  "cursor-pointer select-none touch-manipulation",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-1",
                  periodType === type.value
                    ? "bg-white text-neutral-900 shadow-sm active:bg-neutral-100"
                    : "text-neutral-500 hover:text-neutral-700 hover:bg-white/60 active:bg-white/80"
                )}
              >
                {type.label}
              </button>
            ))}
          </div>

          {/* 分隔线 */}
          <span className="w-px h-5 bg-neutral-200 hidden sm:block" />

          {/* 年份和期间选择 */}
          {periodType !== 'custom' ? (
            <div className="flex items-center gap-3">
              {/* 年份选择 */}
              <MinimalYearSelector
                selectedYear={selectedYear}
                onSelect={setSelectedYear}
                availableYears={availableYears}
              />

              {/* 月份选择 */}
              {periodType === 'month' && (
                <>
                  <span className="text-neutral-300">·</span>
                  <MinimalMonthSelector
                    selectedYear={selectedYear}
                    selectedMonth={selectedMonth}
                    onSelect={(year, month) => {
                      setSelectedYear(year);
                      setSelectedMonth(month);
                    }}
                  />
                </>
              )}

              {/* 季度选择 */}
              {periodType === 'quarter' && (
                <>
                  <span className="text-neutral-300">·</span>
                  <MinimalQuarterSelector
                    selectedQuarter={selectedQuarter}
                    onSelect={setSelectedQuarter}
                  />
                </>
              )}

              {/* 半年度选择 */}
              {periodType === 'halfYear' && (
                <>
                  <span className="text-neutral-300">·</span>
                  <MinimalSemiannualSelector
                    selectedSemiannual={selectedHalfYear}
                    onSelect={setSelectedHalfYear}
                  />
                </>
              )}
            </div>
          ) : (
            /* 自定义日期范围 */
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 hover:border-slate-300 transition-all cursor-pointer"
              />
              <span className="text-neutral-300 text-sm">至</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 hover:border-slate-300 transition-all cursor-pointer"
              />
            </div>
          )}

          <div className="flex-1"></div>

          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-500">
              共 <span className="font-semibold text-slate-700">{stats.totalEntries}</span> 条记录
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">
              工作 <span className="font-semibold text-slate-700">{stats.workDays}</span> 天
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">
              总计 <span className="font-semibold text-green-600">{stats.totalHours.toFixed(1)}</span> 小时
            </span>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-200/50 p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-blue-100">总工时</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-200">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="text-3xl font-bold">{stats.totalHours.toFixed(1)} h</div>
          <p className="text-xs text-blue-200 mt-1">
            {selectedMonth === 'all' ? `${selectedYear}年全年` : `${selectedYear}年${selectedMonth}月`}
          </p>
        </div>
        
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg shadow-green-200/50 p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-green-100">记录条数</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-200">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </div>
          <div className="text-3xl font-bold">{stats.totalEntries}</div>
          <p className="text-xs text-green-200 mt-1">已提交记录</p>
        </div>
        
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-200/50 p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-indigo-100">已工作天数</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-200">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div className="text-3xl font-bold">{stats.workDays}</div>
          <p className="text-xs text-indigo-200 mt-1">
            截止今日{stats.leaveDays > 0 ? ` - 请假${stats.leaveDays}天` : ''}
          </p>
        </div>
        
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-amber-200/50 p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-amber-100">日均工时</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-200">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </div>
          <div className="text-3xl font-bold">{stats.avgHoursPerDay.toFixed(1)} h</div>
          <p className="text-xs text-amber-200 mt-1">平均每日工时</p>
        </div>
      </div>

      {/* 记录列表 */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl shadow-slate-200/50">
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              历史记录
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                {filteredEntries.length} 条
              </span>
            </h3>
          </div>
        </div>
        
        <div className="p-6">
          {filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-50">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <p className="text-sm font-medium">暂无历史记录</p>
              <p className="text-xs mt-1">
                {selectedMonth === 'all' 
                  ? `${selectedYear}年暂无已提交的工时记录` 
                  : `${selectedYear}年${selectedMonth}月暂无已提交的工时记录`
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {filteredEntries.map((entry) => {
                const { category, task } = getEntryDisplayInfo(entry);
                return (
                  <div
                    key={entry.id}
                    className="flex items-start justify-between p-4 rounded-xl bg-green-50/50 border border-green-100 hover:border-green-200 transition-all duration-200"
                  >
                    <div className="flex items-center mr-3 mt-1">
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <span className="text-sm font-medium text-neutral-900 truncate max-w-[200px]">
                          {task || category || '未分类'}
                        </span>
                        {category && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-600 truncate max-w-[150px]">
                            {category.replace(/^_/, '').replace(/_/g, ' ')}
                          </span>
                        )}
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-600">
                          已提交
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-neutral-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                          </svg>
                          {entry.date}
                        </span>
                        {entry.description && (
                          <span className="truncate max-w-[300px]">{entry.description}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <span className="text-lg font-semibold text-green-600 whitespace-nowrap">{entry.hours}h</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(entry)}
                        className="h-8 w-8 p-0 text-neutral-400 hover:text-blue-500 hover:bg-blue-50"
                        title="复制为新草稿"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
