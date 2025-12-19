import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, setMonth, setYear } from "date-fns";
import { enUS, zhCN } from 'date-fns/locale';

interface MonthPickerProps {
    value?: Date;
    onChange: (date: Date) => void;
    variant?: 'default' | 'minimal';
}

export function MonthPicker({ value, onChange, variant = 'default' }: MonthPickerProps) {
    const { t, i18n } = useTranslation();
    const [open, setOpen] = useState(false);
    const [viewDate, setViewDate] = useState(value || new Date());
    
    const locale = i18n.language === 'zh' ? zhCN : enUS;

    const handleMonthSelect = (month: number) => {
        const newDate = setMonth(viewDate, month);
        onChange(newDate);
        setOpen(false);
    };

    const months = Array.from({ length: 12 }, (_, i) => i);
    const currentYear = viewDate.getFullYear();

    // 极简风格触发器
    if (variant === 'minimal') {
        return (
            <Popover open={open} onOpenChange={(isOpen) => { 
                if(isOpen) {
                    setViewDate(value || new Date());
                }
                setOpen(isOpen);
            }}>
                <PopoverTrigger asChild>
                    <button
                        className={cn(
                            "group relative inline-flex items-center gap-3 px-3 py-2.5 -mx-3 -my-2",
                            "text-neutral-900 transition-colors duration-75",
                            "hover:bg-neutral-100 active:bg-neutral-200 rounded-lg",
                            "focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400",
                            "cursor-pointer select-none touch-manipulation",
                            !value && "text-neutral-400"
                        )}
                    >
                        {/* 年份 - 细体 */}
                        <span className="text-[13px] font-light tracking-[0.2em] text-neutral-400 uppercase">
                            {value ? format(value, "yyyy") : "----"}
                        </span>
                        
                        {/* 分隔线 */}
                        <span className="w-px h-4 bg-neutral-200" />
                        
                        {/* 月份 - 粗体突出 */}
                        <span className="text-[22px] font-semibold tracking-tight text-neutral-800 tabular-nums">
                            {value ? format(value, "MM") : "--"}
                        </span>
                        
                        {/* 展开指示器 */}
                        <svg 
                            className={cn(
                                "w-4 h-4 text-neutral-500 transition-transform duration-75",
                                open && "rotate-180"
                            )}
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </PopoverTrigger>
                <PopoverContent 
                    className="z-[10001] w-[280px] p-0 border-0 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] rounded-2xl overflow-hidden animate-duration-75"
                    align="start"
                    sideOffset={8}
                >
                    <div className="bg-white">
                        {/* 年份选择器 - 极简头部 */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
                            <button 
                                onClick={() => setViewDate(prev => setYear(prev, prev.getFullYear() - 1))}
                                className="w-10 h-10 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 active:bg-neutral-200 transition-colors duration-75 touch-manipulation"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <span className="text-lg font-semibold tracking-tight text-neutral-800">{currentYear}</span>
                            <button 
                                onClick={() => setViewDate(prev => setYear(prev, prev.getFullYear() + 1))}
                                className="w-10 h-10 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 active:bg-neutral-200 transition-colors duration-75 touch-manipulation"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                        
                        {/* 月份网格 - 精致布局 */}
                        <div className="grid grid-cols-3 gap-1 p-3">
                            {months.map((month) => {
                                const isSelected = value && value.getMonth() === month && value.getFullYear() === currentYear;
                                const isCurrentMonth = new Date().getMonth() === month && new Date().getFullYear() === currentYear;
                                
                                return (
                                    <button
                                        key={month}
                                        onClick={() => handleMonthSelect(month)}
                                        className={cn(
                                            "relative py-3.5 px-2 rounded-xl text-sm font-medium transition-colors duration-75",
                                            "hover:bg-neutral-100 active:bg-neutral-200 touch-manipulation",
                                            isSelected 
                                                ? "bg-neutral-900 text-white hover:bg-neutral-800 active:bg-neutral-700" 
                                                : "text-neutral-600 hover:text-neutral-900",
                                            isCurrentMonth && !isSelected && "text-neutral-900 font-semibold"
                                        )}
                                    >
                                    {format(setMonth(new Date(), month), "MMM", { locale })}
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
}

    // 默认风格
    return (
        <Popover open={open} onOpenChange={(isOpen) => { 
            if(isOpen) {
                setViewDate(value || new Date());
            }
            setOpen(isOpen);
        }}>
            <PopoverTrigger asChild>
                <button
                    className={cn(
                        "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl",
                        "bg-white border border-neutral-200/60 shadow-sm",
                        "text-sm font-medium text-neutral-700",
                        "hover:border-neutral-300 hover:shadow-md active:bg-neutral-50",
                        "transition-all duration-75",
                        "cursor-pointer select-none touch-manipulation",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10",
                        !value && "text-neutral-400"
                    )}
                >
                    <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {value ? format(value, "yyyy-MM") : <span>{t('dashboard.selector.selectMonth')}</span>}
                </button>
            </PopoverTrigger>
            <PopoverContent 
                className="z-[10001] w-[280px] p-0 border-0 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] rounded-2xl overflow-hidden animate-duration-75"
                align="start"
                sideOffset={8}
            >
                <div className="bg-white">
                    {/* 年份选择器 */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
                        <button 
                            onClick={() => setViewDate(prev => setYear(prev, prev.getFullYear() - 1))}
                            className="w-10 h-10 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 active:bg-neutral-200 transition-colors duration-75 touch-manipulation"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <span className="text-lg font-semibold tracking-tight text-neutral-800">{currentYear}</span>
                        <button 
                            onClick={() => setViewDate(prev => setYear(prev, prev.getFullYear() + 1))}
                            className="w-10 h-10 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 active:bg-neutral-200 transition-colors duration-75 touch-manipulation"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                    
                    {/* 月份网格 */}
                    <div className="grid grid-cols-3 gap-1 p-3">
                        {months.map((month) => {
                            const isSelected = value && value.getMonth() === month && value.getFullYear() === currentYear;
                            const isCurrentMonth = new Date().getMonth() === month && new Date().getFullYear() === currentYear;
                            
                            return (
                                <button
                                    key={month}
                                    onClick={() => handleMonthSelect(month)}
                                    className={cn(
                                        "relative py-3.5 px-2 rounded-xl text-sm font-medium transition-colors duration-75",
                                        "hover:bg-neutral-100 active:bg-neutral-200 touch-manipulation",
                                        isSelected 
                                            ? "bg-neutral-900 text-white hover:bg-neutral-800 active:bg-neutral-700" 
                                            : "text-neutral-600 hover:text-neutral-900",
                                        isCurrentMonth && !isSelected && "text-neutral-900 font-semibold"
                                    )}
                                >
                                    {format(setMonth(new Date(), month), "MMM", { locale })}
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
}