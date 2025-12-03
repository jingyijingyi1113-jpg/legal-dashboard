
import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonthPicker } from './MonthPicker';
import { getWorkdaysInMonth, normalizeField, fieldsMatch, createNormalizedKey } from '@/lib/date-utils';
import { ComposedChart, Line, Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Area } from 'recharts';
import { format, parse, startOfMonth, endOfMonth, eachMonthOfInterval, getYear, getMonth } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Period = 'monthly' | 'quarterly' | 'semiannually' | 'annually' | 'custom';
type Option = { value: string; label: string };
type PeriodOptions = { [key in Exclude<Period, 'custom'>]: readonly Option[] };

const PERIOD_OPTIONS: PeriodOptions = {
    monthly: Array.from({ length: 12 }, (_, i) => ({ value: i.toString(), label: `${i + 1}月` })),
    quarterly: [{ value: '0', label: '第一季度' }, { value: '1', label: '第二季度' }, { value: '2', label: '第三季度' }, { value: '3', label: '第四季度' }],
    semiannually: [{ value: '0', label: '上半年' }, { value: '1', label: '下半年' }],
    annually: [], 
};

const CustomPieLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percentage, name } = props;
    
    if (percentage === undefined || percentage < 5) return null;
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
        <text 
            x={x} 
            y={y} 
            fill="white" 
            textAnchor={x > cx ? 'start' : 'end'} 
            dominantBaseline="central"
            fontSize="12"
            fontWeight="bold"
        >
            {`${percentage.toFixed(0)}%`}
        </text>
    );
};


const CustomTooltip = ({ active, payload, label, onItemClick }: any) => {
  if (active && payload && payload.length) {
    const sortedPayload = [...payload]
        .filter(entry => entry.value > 0)
        .sort((a, b) => b.value - a.value);

    return (
      <div className="custom-tooltip" style={{ backgroundColor: '#fff', padding: '8px', border: '1px solid #ccc', whiteSpace: 'nowrap', opacity: 1, zIndex: 100 }}>
        <p className="label font-bold" style={{ margin: '0 0 4px 0', fontSize: '12px' }}>{label}</p>
        {sortedPayload.map((entry: any, index: number) => (
          <p 
            key={index} 
            onClick={() => onItemClick && onItemClick(entry.name, label)}
            style={{ color: entry.color, margin: '2px 0', fontSize: '11px', cursor: 'pointer', padding: '2px 4px', borderRadius: '2px' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {entry.name}: {entry.value.toFixed(2)}h {entry.payload[`${entry.name}_percent`] ? `(${entry.payload[`${entry.name}_percent`]?.toFixed(2)}%)` : ''}
          </p>
        ))}
         {payload[0].payload.totalHours && <p className="font-bold mt-1 border-t pt-1" style={{ margin: '4px 0 0 0', fontSize: '11px', paddingTop: '2px' }}>Total: {payload[0].payload.totalHours?.toFixed(2)}h</p>}
      </div>
    );
  }
  return null;
};



const DetailsDialog = ({ isOpen, onClose, title, data }: { isOpen: boolean, onClose: () => void, title: string, data: any[] }) => {
    const [columnFilters, setColumnFilters] = useState<{ [key: string]: string }>({});
    
    // Reset filters when dialog opens with new data
    useEffect(() => {
        if (isOpen) {
            setColumnFilters({});
        }
    }, [isOpen, data]);

    // ESC key handler - must be before any conditional returns
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    const allKeys = useMemo(() => {
        if (!data || data.length === 0) return [];
        const keys = new Set<string>();
        data.forEach(row => {
             if(row) Object.keys(row).forEach(k => {
                 // Filter out internal fields
                 if (!k.startsWith('_')) keys.add(k);
             });
        });
        const preferredOrder = [
            'Month', 
            'Name', 
            'Deal/Matter Category', 
            'Deal/Matter Name', 
            'OKR/BSC Tag', 
            'OKR/BSC Item', 
            'Hours', 
            'Work Category', 
            'Narrative (Optional)',
            'Source Path', 
            '团队'
        ];
        return Array.from(keys).sort((a, b) => {
            const idxA = preferredOrder.indexOf(a);
            const idxB = preferredOrder.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [data]);

    // Filter data based on column filters
    const filteredData = useMemo(() => {
        if (!data || data.length === 0) return [];
        return data.filter(row => {
            if (!row) return false;
            return Object.entries(columnFilters).every(([key, filterValue]) => {
                if (!filterValue || filterValue.trim() === '') return true;
                const cellValue = row[key];
                if (cellValue === null || cellValue === undefined) return false;
                return cellValue.toString().toLowerCase().includes(filterValue.toLowerCase());
            });
        });
    }, [data, columnFilters]);

    const handleFilterChange = (key: string, value: string) => {
        setColumnFilters(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const clearAllFilters = () => {
        setColumnFilters({});
    };

    const hasActiveFilters = Object.values(columnFilters).some(v => v && v.trim() !== '');

    // Conditional return AFTER all hooks
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div 
                className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-[95vw] h-[85vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700"
                style={{ backgroundColor: '#ffffff', opacity: 1 }}
            >
                <div 
                    className="p-4 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0"
                    style={{ backgroundColor: '#f8fafc' }}
                >
                    <div className="flex items-center gap-4">
                        <h3 className="text-lg font-semibold">{title}</h3>
                        {hasActiveFilters && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={clearAllFilters}
                                className="h-7 px-2 text-xs bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100"
                            >
                                清除筛选
                            </Button>
                        )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 rounded-full">
                        <span className="sr-only">Close</span>
                        ✕
                    </Button>
                </div>
                <div className="flex-1 overflow-auto relative w-full bg-white dark:bg-slate-900" style={{ backgroundColor: '#ffffff' }}>
                   <Table className="w-max min-w-full border-collapse bg-white dark:bg-slate-900" style={{ backgroundColor: '#ffffff' }}>
                       <TableHeader className="sticky top-0 z-10 shadow-sm bg-slate-100" style={{ backgroundColor: '#f1f5f9' }}>
                           <TableRow className="bg-slate-100 hover:bg-slate-100" style={{ backgroundColor: '#f1f5f9' }}>
                               {allKeys.map(key => (
                                   <TableHead key={key} className="whitespace-nowrap px-4 py-2 font-bold text-slate-900 dark:text-slate-100 border-b border-r last:border-r-0 bg-slate-100 dark:bg-slate-800" style={{ backgroundColor: '#f1f5f9' }}>
                                       <div className="flex flex-col gap-1">
                                           <span>{key}</span>
                                           <input
                                               type="text"
                                               placeholder="筛选..."
                                               value={columnFilters[key] || ''}
                                               onChange={(e) => handleFilterChange(key, e.target.value)}
                                               className="w-full min-w-[80px] px-2 py-1 text-xs font-normal border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                               onClick={(e) => e.stopPropagation()}
                                           />
                                       </div>
                                   </TableHead>
                               ))}
                           </TableRow>
                       </TableHeader>
                       <TableBody className="bg-white" style={{ backgroundColor: '#ffffff' }}>
                           {filteredData.length > 0 ? filteredData.map((row, i) => (
                               <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-800">
                                   {allKeys.map(key => (
                                       <TableCell key={key} className="whitespace-nowrap px-4 py-2 border-b border-r last:border-r-0 max-w-[400px] truncate text-sm" title={row[key]?.toString()}>
                                           {key === 'Hours' || key === 'Total Hours' 
                                                ? (typeof row[key] === 'number' ? row[key].toFixed(2) : row[key]) 
                                                : row[key]}
                                       </TableCell>
                                   ))}
                               </TableRow>
                           )) : <TableRow><TableCell colSpan={allKeys.length} className="text-center py-4">No data found</TableCell></TableRow>}
                       </TableBody>
                   </Table>
                </div>
                 <div 
                    className="p-4 border-t bg-slate-50 dark:bg-slate-800 flex justify-between items-center shrink-0"
                    style={{ backgroundColor: '#f8fafc' }}
                >
                    <div className="text-sm text-muted-foreground font-medium">
                        {hasActiveFilters && <span className="text-blue-600">筛选后: {filteredData.length} / </span>}
                        Total Records: {data.length} | Total Hours: {filteredData.reduce((acc, r) => acc + (Number(r.Hours) || 0), 0).toFixed(2)}
                        {hasActiveFilters && <span className="text-slate-400"> (原始: {data.reduce((acc, r) => acc + (Number(r.Hours) || 0), 0).toFixed(2)})</span>}
                    </div>
                </div>
            </div>
        </div>
    );
};

const BSCPieChartSection = ({ filteredData, totalHours }: { filteredData: any[], totalHours: number }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any[]>([]);
    const [dialogTitle, setDialogTitle] = useState('');

    const bscData = useMemo(() => {
        const bscHours: { [key: string]: { hours: number; name: string } } = {};
        filteredData.forEach(row => {
            const rawTag = row['OKR/BSC Tag']?.toString() || 'uncategoried';
            const tag = rawTag.trim().replace(/\s+/g, ' ');
            const key = createNormalizedKey(tag);
            const hours = Number(row['Hours']) || 0;
            if (hours > 0) {
                if (!bscHours[key]) bscHours[key] = { hours: 0, name: tag };
                bscHours[key].hours += hours;
            }
        });
        return Object.values(bscHours).map(({ name, hours }) => ({
            name,
            value: hours,
            percentage: totalHours > 0 ? (hours / totalHours) * 100 : 0
        })).sort((a, b) => b.value - a.value);
    }, [filteredData, totalHours]);

    const handlePieClick = (data: any) => {
        if (!data || !data.name) return;
        const categoryName = data.name;
        const details = filteredData.filter(row => {
            const rawTag = row['OKR/BSC Tag']?.toString() || 'uncategoried';
            return fieldsMatch(rawTag, categoryName);
        });
        setDialogTitle(`Details for ${categoryName}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    const handleLegendClick = (e: any) => {
        if (!e || !e.value) return;
        const categoryName = e.value;
        const details = filteredData.filter(row => {
            const rawTag = row['OKR/BSC Tag']?.toString() || 'uncategoried';
            return fieldsMatch(rawTag, categoryName);
        });
        setDialogTitle(`All records for ${categoryName}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    if (bscData.length === 0) {
        return <div className="h-full flex items-center justify-center text-muted-foreground"><p>当期无BSC分类数据</p></div>;
    }

    // Premium color palette - sophisticated and harmonious
    const PREMIUM_COLORS = [
        '#3b82f6', // Blue
        '#10b981', // Emerald
        '#f59e0b', // Amber
        '#ef4444', // Red
        '#06b6d4', // Cyan
        '#ec4899', // Pink
        '#f97316', // Orange
        '#84cc16', // Lime
    ];

    return (
        <div className="relative">
            <div className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Click on slices or legend to view details
            </div>
            <div className="flex items-center gap-4 justify-start max-w-[600px]">
                <ResponsiveContainer width="50%" height={180}>
                    <PieChart>
                        <defs>
                            {PREMIUM_COLORS.map((color, index) => (
                                <linearGradient key={`gradient-bsc-${index}`} id={`pieGradientBSC${index}`} x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                                    <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                                </linearGradient>
                            ))}
                            <filter id="pieShadow" x="-20%" y="-20%" width="140%" height="140%">
                                <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
                            </filter>
                        </defs>
                        <Pie 
                            data={bscData} 
                            cx="50%" 
                            cy="50%" 
                            labelLine={false}
                            innerRadius={35}
                            outerRadius={70}
                            paddingAngle={2}
                            dataKey="value"
                            onClick={handlePieClick}
                            cursor="pointer"
                            animationBegin={0}
                            animationDuration={800}
                            animationEasing="ease-out"
                        >
                            {bscData.map((_entry, index) => (
                                <Cell 
                                    key={`cell-${index}`} 
                                    fill={`url(#pieGradientBSC${index % PREMIUM_COLORS.length})`}
                                    stroke="#fff"
                                    strokeWidth={2}
                                    filter="url(#pieShadow)"
                                />
                            ))}
                        </Pie>
                        <Tooltip 
                            formatter={(value: number, _name: any, entry: any) => [
                                `${value.toFixed(1)}h (${(entry.payload as any).percentage.toFixed(1)}%)`, 
                                ''
                            ]}
                            contentStyle={{
                                backgroundColor: 'rgba(255,255,255,0.98)',
                                border: 'none',
                                borderRadius: '10px',
                                boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                                padding: '10px 14px'
                            }}
                            labelStyle={{ fontWeight: 600, color: '#1e293b' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
                {/* Custom Legend */}
                <div className="flex-1 space-y-1.5 max-h-[180px] overflow-y-auto pr-2">
                    {bscData.slice(0, 6).map((entry, index) => (
                        <div 
                            key={entry.name}
                            className="flex items-center gap-2 p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors group"
                            onClick={() => handleLegendClick({ value: entry.name })}
                        >
                            <div 
                                className="w-3 h-3 rounded-sm flex-shrink-0 group-hover:scale-110 transition-transform"
                                style={{ backgroundColor: PREMIUM_COLORS[index % PREMIUM_COLORS.length] }}
                            />
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                                    {entry.name}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                    {entry.value.toFixed(0)}h · {entry.percentage.toFixed(1)}%
                                </div>
                            </div>
                        </div>
                    ))}
                    {bscData.length > 6 && (
                        <div className="text-[10px] text-slate-400 pl-5">+{bscData.length - 6} more...</div>
                    )}
                </div>
            </div>
            <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} />
        </div>
    );
};

const DealCategoryPieChartSection = ({ filteredData, totalHours }: { filteredData: any[], totalHours: number }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any[]>([]);
    const [dialogTitle, setDialogTitle] = useState('');

    const dealCategoryAllocation = useMemo(() => {
        const dealCategoryHours: { [key: string]: { hours: number; name: string } } = {};
        filteredData.forEach(row => {
            const rawCategory = row['Deal/Matter Category']?.toString();
            // Ensure category is never empty string
            const category = (rawCategory && rawCategory.trim()) ? rawCategory.replace(/\s+/g, ' ').trim() : 'Uncategorized';
            const key = createNormalizedKey(category);
            const hours = Number(row['Hours']) || 0;
            if (hours > 0) {
                if (!dealCategoryHours[key]) dealCategoryHours[key] = { hours: 0, name: category };
                dealCategoryHours[key].hours += hours;
            }
        });
        return Object.values(dealCategoryHours).map(({ name, hours }) => ({
            name,
            value: hours,
            percentage: totalHours > 0 ? (hours / totalHours) * 100 : 0
        })).sort((a, b) => b.value - a.value);
    }, [filteredData, totalHours]);

    const handlePieClick = (entry: any) => {
        if (!entry || !entry.name) return;
        const categoryName = entry.name;
        const details = filteredData.filter(row => {
            const rawCategory = row['Deal/Matter Category']?.toString();
            const category = (rawCategory && rawCategory.trim()) ? rawCategory.replace(/\s+/g, ' ').trim() : 'Uncategorized';
            return fieldsMatch(category, categoryName);
        });
        setDialogTitle(`Details for ${categoryName}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    const handleLegendClick = (e: any) => {
        if (!e || !e.value) return;
        const categoryName = e.value;
        const details = filteredData.filter(row => {
            const rawCategory = row['Deal/Matter Category']?.toString();
            const category = (rawCategory && rawCategory.trim()) ? rawCategory.replace(/\s+/g, ' ').trim() : 'Uncategorized';
            return fieldsMatch(category, categoryName);
        });
        setDialogTitle(`All records for ${categoryName}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    if (dealCategoryAllocation.length === 0) {
        return <div className="h-full flex items-center justify-center text-muted-foreground"><p>当期无数据</p></div>;
    }

    // Premium color palette for deal categories
    const DEAL_COLORS = [
        '#0ea5e9', // Sky
        '#10b981', // Emerald
        '#f59e0b', // Amber
        '#ef4444', // Red
        '#06b6d4', // Cyan
        '#ec4899', // Pink
        '#84cc16', // Lime
    ];

    return (
        <div className="relative">
            <div className="text-xs text-slate-500 mb-4 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Click on slices or legend to view details
            </div>
            <div className="flex flex-col lg:flex-row items-center gap-6">
                <div className="w-full lg:w-1/2">
                    <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                            <defs>
                                {DEAL_COLORS.map((color, index) => (
                                    <linearGradient key={`gradient-deal-${index}`} id={`pieGradientDeal${index}`} x1="0" y1="0" x2="1" y2="1">
                                        <stop offset="0%" stopColor={color} stopOpacity={1} />
                                        <stop offset="100%" stopColor={color} stopOpacity={0.75} />
                                    </linearGradient>
                                ))}
                                <filter id="pieShadowDeal" x="-20%" y="-20%" width="140%" height="140%">
                                    <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.12" />
                                </filter>
                            </defs>
                            <Pie
                                data={dealCategoryAllocation}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                innerRadius={50}
                                outerRadius={100}
                                paddingAngle={3}
                                dataKey="value"
                                onClick={handlePieClick}
                                cursor="pointer"
                                animationBegin={0}
                                animationDuration={1000}
                                animationEasing="ease-out"
                            >
                                {dealCategoryAllocation.map((_entry, index) => (
                                    <Cell 
                                        key={`cell-${index}`} 
                                        fill={`url(#pieGradientDeal${index % DEAL_COLORS.length})`}
                                        stroke="#fff"
                                        strokeWidth={3}
                                        filter="url(#pieShadowDeal)"
                                    />
                                ))}
                            </Pie>
                            <Tooltip 
                                formatter={(value: number, _name: any, entry: any) => [
                                    `${value.toFixed(1)}h (${(entry.payload as any).percentage.toFixed(1)}%)`, 
                                    ''
                                ]}
                                contentStyle={{
                                    backgroundColor: 'rgba(255,255,255,0.98)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                                    padding: '12px 16px'
                                }}
                                labelStyle={{ fontWeight: 600, color: '#1e293b' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                {/* Custom Legend with stats */}
                <div className="w-full lg:w-1/2 space-y-2">
                    {dealCategoryAllocation.map((entry, index) => (
                        <div 
                            key={entry.name}
                            className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all group border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                            onClick={() => handleLegendClick({ value: entry.name })}
                        >
                            <div 
                                className="w-4 h-4 rounded-md flex-shrink-0 group-hover:scale-110 transition-transform shadow-sm"
                                style={{ backgroundColor: DEAL_COLORS[index % DEAL_COLORS.length] }}
                            />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                                    {entry.name}
                                </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <div className="text-sm font-bold" style={{ color: DEAL_COLORS[index % DEAL_COLORS.length] }}>
                                    {entry.value.toFixed(0)}h
                                </div>
                                <div className="text-[10px] text-slate-500">
                                    {entry.percentage.toFixed(1)}%
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} />
        </div>
    );
};

const UtilizationTrendChart = ({ data, teamData }: { data: any[], teamData: any[] }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any[]>([]);
    const [dialogTitle, setDialogTitle] = useState('');

    // Premium color palette matching scatter plot colors
    const LINE_COLORS = {
        'Investment Related - IPO': '#55A868',           // Green - IPO
        'Investment Related - Corporate Matter': '#4C72B0', // Blue - Corporate Matter
        'Investment Related - M&A Deal': '#C44E52'       // Red - M&A
    };

    const handleDotClick = (entry: any, dataKey: string) => {
        if (!entry || !entry.month) return;
        
        const monthStr = entry.month;
        const categoryName = dataKey;
        
        const details = teamData.filter(row => {
            if (!row || !row['Month'] || !row['Deal/Matter Category']) return false;
            const rowMonth = format(parse(row['Month'].toString(), 'yyyy/MM', new Date()), 'yyyy/MM');
            const rowCategory = row['Deal/Matter Category']?.toString();
            return rowMonth === monthStr && fieldsMatch(rowCategory, categoryName);
        });
        
        setDialogTitle(`${categoryName} - ${monthStr}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    const CustomDot = (props: any) => {
        const { cx, cy, fill, dataKey, index } = props;
        if (!cx || !cy) return null;
        
        return (
            <g>
                {/* Glow effect */}
                <circle 
                    cx={cx} 
                    cy={cy} 
                    r={10} 
                    fill={fill}
                    opacity={0.15}
                />
                {/* Main dot with gradient */}
                <circle 
                    cx={cx} 
                    cy={cy} 
                    r={6} 
                    fill={fill}
                    stroke="white"
                    strokeWidth={2}
                    cursor="pointer"
                    onClick={() => handleDotClick(props.payload, dataKey)}
                    style={{ 
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
                        transition: 'all 0.2s ease'
                    }}
                />
            </g>
        );
    };

    const CustomActiveDot = (props: any) => {
        const { cx, cy, fill, dataKey } = props;
        if (!cx || !cy) return null;
        
        return (
            <g>
                {/* Pulse animation ring */}
                <circle 
                    cx={cx} 
                    cy={cy} 
                    r={14} 
                    fill="none"
                    stroke={fill}
                    strokeWidth={2}
                    opacity={0.3}
                />
                {/* Glow */}
                <circle 
                    cx={cx} 
                    cy={cy} 
                    r={10} 
                    fill={fill}
                    opacity={0.2}
                />
                {/* Main dot */}
                <circle 
                    cx={cx} 
                    cy={cy} 
                    r={8} 
                    fill={fill}
                    stroke="white"
                    strokeWidth={3}
                    cursor="pointer"
                    onClick={() => handleDotClick(props.payload, dataKey)}
                    style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.2))' }}
                />
            </g>
        );
    };

    // Custom tooltip with premium styling - filter out Area duplicates
    const PremiumTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;
        
        // Filter to only show Line data (not Area), using the short names
        const filteredPayload = payload.filter((entry: any) => 
            ['IPO', 'Corporate Matter', 'M&A Deal'].includes(entry.name)
        );
        
        if (!filteredPayload.length) return null;
        
        return (
            <div className="bg-white/95 backdrop-blur-md border border-slate-200/60 rounded-xl shadow-xl p-4 min-w-[180px]">
                <div className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">
                    {label}
                </div>
                <div className="space-y-2">
                    {filteredPayload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <div 
                                    className="w-3 h-3 rounded-full shadow-sm"
                                    style={{ backgroundColor: entry.color }}
                                />
                                <span className="text-xs text-slate-600">{entry.name}</span>
                            </div>
                            <span className="text-xs font-semibold text-slate-800">
                                {Number(entry.value).toFixed(1)}h
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Custom legend
    const legendItems = [
        { key: 'Investment Related - IPO', name: 'IPO', color: LINE_COLORS['Investment Related - IPO'] },
        { key: 'Investment Related - Corporate Matter', name: 'Corporate Matter', color: LINE_COLORS['Investment Related - Corporate Matter'] },
        { key: 'Investment Related - M&A Deal', name: 'M&A Deal', color: LINE_COLORS['Investment Related - M&A Deal'] }
    ];

    return (
        <div className="relative">
            {/* Custom Legend */}
            <div className="flex items-center justify-center gap-6 mb-4">
                {legendItems.map((item) => (
                    <div key={item.key} className="flex items-center gap-2 group cursor-pointer">
                        <div 
                            className="w-4 h-1 rounded-full group-hover:scale-110 transition-transform"
                            style={{ backgroundColor: item.color }}
                        />
                        <span className="text-xs font-medium text-slate-600 group-hover:text-slate-800 transition-colors">
                            {item.name}
                        </span>
                    </div>
                ))}
            </div>
            
            <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                    <defs>
                        {/* Gradient definitions for lines */}
                        <linearGradient id="lineGradientIPO" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#55A868" stopOpacity={0.8}/>
                            <stop offset="100%" stopColor="#55A868" stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="lineGradientCM" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#4C72B0" stopOpacity={0.8}/>
                            <stop offset="100%" stopColor="#4C72B0" stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="lineGradientMA" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#C44E52" stopOpacity={0.8}/>
                            <stop offset="100%" stopColor="#C44E52" stopOpacity={0.1}/>
                        </linearGradient>
                        {/* Glow filter */}
                        <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                            <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                    </defs>
                    <CartesianGrid 
                        strokeDasharray="3 3" 
                        stroke="#e2e8f0" 
                        strokeOpacity={0.6}
                        vertical={false}
                    />
                    <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 11, fill: '#64748b' }} 
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis 
                        label={{ value: '小时', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: '#64748b' } }} 
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickLine={{ stroke: '#e2e8f0' }}
                    />
                    <Tooltip content={<PremiumTooltip />} />
                    
                    {/* Area fills for depth */}
                    <Area 
                        type="monotone" 
                        dataKey="Investment Related - IPO" 
                        fill="url(#lineGradientIPO)" 
                        stroke="none"
                        fillOpacity={0.15}
                    />
                    <Area 
                        type="monotone" 
                        dataKey="Investment Related - Corporate Matter" 
                        fill="url(#lineGradientCM)" 
                        stroke="none"
                        fillOpacity={0.15}
                    />
                    <Area 
                        type="monotone" 
                        dataKey="Investment Related - M&A Deal" 
                        fill="url(#lineGradientMA)" 
                        stroke="none"
                        fillOpacity={0.15}
                    />
                    
                    {/* Lines with enhanced styling */}
                    <Line 
                        type="monotone" 
                        dataKey="Investment Related - IPO" 
                        name="IPO" 
                        stroke={LINE_COLORS['Investment Related - IPO']}
                        strokeWidth={3}
                        dot={(props) => <CustomDot {...props} dataKey="Investment Related - IPO" />}
                        activeDot={(props) => <CustomActiveDot {...props} dataKey="Investment Related - IPO" />}
                        animationDuration={1000}
                        animationEasing="ease-out"
                    />
                    <Line 
                        type="monotone" 
                        dataKey="Investment Related - Corporate Matter" 
                        name="Corporate Matter" 
                        stroke={LINE_COLORS['Investment Related - Corporate Matter']}
                        strokeWidth={3}
                        dot={(props) => <CustomDot {...props} dataKey="Investment Related - Corporate Matter" />}
                        activeDot={(props) => <CustomActiveDot {...props} dataKey="Investment Related - Corporate Matter" />}
                        animationDuration={1000}
                        animationEasing="ease-out"
                        animationBegin={200}
                    />
                    <Line 
                        type="monotone" 
                        dataKey="Investment Related - M&A Deal" 
                        name="M&A Deal" 
                        stroke={LINE_COLORS['Investment Related - M&A Deal']}
                        strokeWidth={3}
                        dot={(props) => <CustomDot {...props} dataKey="Investment Related - M&A Deal" />}
                        activeDot={(props) => <CustomActiveDot {...props} dataKey="Investment Related - M&A Deal" />}
                        animationDuration={1000}
                        animationEasing="ease-out"
                        animationBegin={400}
                    />
                </ComposedChart>
            </ResponsiveContainer>
            
            {/* Hint text */}
            <div className="text-xs text-slate-400 text-center mt-2">
                Click on data points to view detailed records
            </div>
            
            <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} />
        </div>
    );
};

const VirtualGroupTrendChart = ({ data, teamData, groupList }: { data: any[], teamData: any[], groupList: string[] }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any[]>([]);
    const [dialogTitle, setDialogTitle] = useState('');

    // Define allowed groups for case-insensitive matching
    const allowedGroups = ['Group Financing', 'International Financial', 'Listing Rules and Corporate Governance', 'Others'];

    // Premium color palette - sophisticated and vibrant
    const PREMIUM_COLORS = [
        '#6366f1', // Indigo
        '#10b981', // Emerald
        '#f59e0b', // Amber
        '#ef4444', // Red
        '#06b6d4', // Cyan
        '#ec4899', // Pink
    ];

    const handleDotClick = (entry: any, dataKey: string) => {
        if (!entry || !entry.month) return;
        
        const monthStr = entry.month;
        const groupName = dataKey;
        
        const details = teamData.filter(row => {
            if (!row || !row['Month'] || !row['Deal/Matter Category']) return false;
            const rowMonth = format(parse(row['Month'].toString(), 'yyyy/MM', new Date()), 'yyyy/MM');
            const rowGroup = row['Deal/Matter Category']?.toString();
            const matchedGroup = allowedGroups.find(allowed => fieldsMatch(allowed, rowGroup));
            return rowMonth === monthStr && matchedGroup === groupName;
        });
        
        setDialogTitle(`${groupName} - ${monthStr}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    const CustomDot = (props: any) => {
        const { cx, cy, fill, dataKey, index } = props;
        if (!cx || !cy) return null;
        
        return (
            <g>
                {/* Outer glow */}
                <circle 
                    cx={cx} 
                    cy={cy} 
                    r={10} 
                    fill={fill}
                    opacity={0.15}
                />
                {/* Main dot */}
                <circle 
                    cx={cx} 
                    cy={cy} 
                    r={6} 
                    fill={fill}
                    stroke="white"
                    strokeWidth={2}
                    cursor="pointer"
                    onClick={() => handleDotClick(props.payload, dataKey)}
                    style={{ 
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
                        transition: 'all 0.2s ease'
                    }}
                />
            </g>
        );
    };

    const CustomActiveDot = (props: any) => {
        const { cx, cy, fill, dataKey } = props;
        if (!cx || !cy) return null;
        
        return (
            <g>
                {/* Pulse ring */}
                <circle 
                    cx={cx} 
                    cy={cy} 
                    r={14} 
                    fill="none"
                    stroke={fill}
                    strokeWidth={2}
                    opacity={0.3}
                />
                {/* Glow */}
                <circle 
                    cx={cx} 
                    cy={cy} 
                    r={10} 
                    fill={fill}
                    opacity={0.2}
                />
                {/* Main dot */}
                <circle 
                    cx={cx} 
                    cy={cy} 
                    r={8} 
                    fill={fill}
                    stroke="white"
                    strokeWidth={3}
                    cursor="pointer"
                    onClick={() => handleDotClick(props.payload, dataKey)}
                    style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.2))' }}
                />
            </g>
        );
    };

    // Premium tooltip - filter out Area duplicates, keep Line entries with actual colors
    const PremiumGroupTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;
        
        // Filter to only show Line data (entries with actual hex colors, not gradient URLs)
        const filteredPayload = payload.filter((entry: any) => {
            // Line entries have hex colors like '#6366f1', Area entries have 'url(#...)' 
            return entry.color && !entry.color.startsWith('url(');
        });
        
        if (!filteredPayload.length) return null;
        
        return (
            <div className="bg-white/95 backdrop-blur-md border border-slate-200/60 rounded-xl shadow-xl p-4 min-w-[200px]">
                <div className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">
                    {label}
                </div>
                <div className="space-y-2">
                    {filteredPayload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <div 
                                    className="w-3 h-3 rounded-full shadow-sm"
                                    style={{ backgroundColor: entry.color }}
                                />
                                <span className="text-xs text-slate-600 max-w-[120px] truncate">{entry.name}</span>
                            </div>
                            <span className="text-xs font-semibold text-slate-800">
                                {Number(entry.value).toFixed(1)}h
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="relative">
            {/* Custom Legend - positioned above chart */}
            <div className="flex flex-wrap items-center justify-center gap-4 mb-4 -mt-12">
                {groupList?.map((group, index) => (
                    <div key={group} className="flex items-center gap-2 group cursor-pointer">
                        <div 
                            className="w-4 h-1 rounded-full group-hover:scale-110 transition-transform"
                            style={{ backgroundColor: PREMIUM_COLORS[index % PREMIUM_COLORS.length] }}
                        />
                        <span className="text-xs font-medium text-slate-600 group-hover:text-slate-800 transition-colors">
                            {group}
                        </span>
                    </div>
                ))}
            </div>
            
            <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                    <defs>
                        {/* Gradient definitions for area fills */}
                        {PREMIUM_COLORS.map((color, index) => (
                            <linearGradient key={`areaGrad${index}`} id={`areaGradient${index}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={color} stopOpacity={0.3}/>
                                <stop offset="100%" stopColor={color} stopOpacity={0.02}/>
                            </linearGradient>
                        ))}
                        {/* Glow filter */}
                        <filter id="lineGlowVG" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                            <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                    </defs>
                    <CartesianGrid 
                        strokeDasharray="3 3" 
                        stroke="#e2e8f0" 
                        strokeOpacity={0.6}
                        vertical={false}
                    />
                    <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 11, fill: '#64748b' }} 
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis 
                        label={{ value: '小时', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: '#64748b' } }} 
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickLine={{ stroke: '#e2e8f0' }}
                    />
                    <Tooltip content={<PremiumGroupTooltip />} />
                    
                    {/* Area fills for visual depth */}
                    {groupList?.map((group, index) => (
                        <Area 
                            key={`area-${group}`}
                            type="monotone" 
                            dataKey={group} 
                            fill={`url(#areaGradient${index % PREMIUM_COLORS.length})`}
                            stroke="none"
                            fillOpacity={0.4}
                        />
                    ))}
                    
                    {/* Lines with premium styling */}
                    {groupList?.map((group, index) => (
                        <Line 
                            key={group} 
                            type="monotone" 
                            dataKey={group} 
                            name={group} 
                            stroke={PREMIUM_COLORS[index % PREMIUM_COLORS.length]}
                            strokeWidth={3}
                            dot={(props) => <CustomDot {...props} dataKey={group} />}
                            activeDot={(props) => <CustomActiveDot {...props} dataKey={group} />}
                            animationDuration={1000}
                            animationEasing="ease-out"
                            animationBegin={index * 150}
                        />
                    ))}
                </ComposedChart>
            </ResponsiveContainer>
            
            {/* Hint text */}
            <div className="text-xs text-slate-400 text-center mt-2">
                Click on data points to view detailed records
            </div>
            
            <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} />
        </div>
    );
};

const VirtualGroupHoursChart = ({ filteredData }: { filteredData: any[] }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any[]>([]);
    const [dialogTitle, setDialogTitle] = useState('');

    // Premium color palette - high contrast colors
    const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316'];

    const virtualGroupData: { [key: string]: { [key: string]: number } } = {};
    const virtualGroupCategories = new Set<string>();
    const normalizedCategoriesMap: { [key: string]: string } = {};
    
    filteredData.forEach(row => {
        const rawSourcePath = row['Source Path']?.toString();
        const sourcePath = rawSourcePath ? rawSourcePath.replace(/\\s+/g, ' ').trim() : '';
        const rawCategory = row['Deal/Matter Category']?.toString().replace(/\\s+/g, ' ').trim();
        const hours = Number(row['Hours']) || 0;

        if (sourcePath && rawCategory && hours > 0) {
            const categoryKey = createNormalizedKey(rawCategory);
            if (!normalizedCategoriesMap[categoryKey]) normalizedCategoriesMap[categoryKey] = rawCategory;
            const category = normalizedCategoriesMap[categoryKey];
            if (!virtualGroupData[sourcePath]) virtualGroupData[sourcePath] = {};
            virtualGroupData[sourcePath][category] = (virtualGroupData[sourcePath][category] || 0) + hours;
            virtualGroupCategories.add(category);
        }
    });

    const virtualGroupChartData = Object.entries(virtualGroupData).map(([sourcePath, categories]) => {
         const totalHours = Object.values(categories).reduce((sum, h) => sum + h, 0);
         const entry: any = { name: sourcePath, totalHours };
         Object.entries(categories).forEach(([cat, hours]) => {
             entry[cat] = hours;
             entry[`${cat}_percent`] = totalHours > 0 ? (hours / totalHours) * 100 : 0;
         });
         return entry;
    }).sort((a, b) => b.totalHours - a.totalHours);
    const virtualGroupCategoryList = Array.from(virtualGroupCategories);

    const handleBarClick = (data: any, dataKey: string) => {
        if (!data || !data.name) return;
        const sourcePath = data.name;
        const category = dataKey;
        const details = filteredData.filter(row => {
            const rawSourcePath = row['Source Path']?.toString();
            const rowSourcePath = rawSourcePath ? rawSourcePath.replace(/\\s+/g, ' ').trim() : '';
            const rawCategory = row['Deal/Matter Category']?.toString();
            return rowSourcePath === sourcePath && fieldsMatch(rawCategory, category);
        });
        setDialogTitle(`${sourcePath} - ${category}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    const handleTooltipItemClick = (category: string, sourcePath: string) => {
        const details = filteredData.filter(row => {
            const rawSourcePath = row['Source Path']?.toString();
            const rowSourcePath = rawSourcePath ? rawSourcePath.replace(/\\s+/g, ' ').trim() : '';
            const rawCategory = row['Deal/Matter Category']?.toString();
            return rowSourcePath === sourcePath && fieldsMatch(rawCategory, category);
        });
        setDialogTitle(`${sourcePath} - ${category}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    const handleLegendClick = (e: any) => {
        if (!e || !e.dataKey) return;
        const categoryName = e.dataKey;
        const details = filteredData.filter(row => {
            const rawCategory = row['Deal/Matter Category']?.toString();
            return fieldsMatch(rawCategory, categoryName);
        });
        setDialogTitle(`All records for ${categoryName}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    // Premium tooltip
    const PremiumBarTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;
        
        const total = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);
        
        return (
            <div className="bg-white/95 backdrop-blur-md border border-slate-200/60 rounded-xl shadow-xl p-4 min-w-[220px]">
                <div className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100 truncate max-w-[200px]">
                    {label}
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {payload.map((entry: any, index: number) => (
                        <div 
                            key={index} 
                            className="flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5 transition-colors"
                            onClick={() => handleTooltipItemClick(entry.dataKey, label)}
                        >
                            <div className="flex items-center gap-2">
                                <div 
                                    className="w-3 h-3 rounded-sm shadow-sm"
                                    style={{ backgroundColor: entry.color }}
                                />
                                <span className="text-xs text-slate-600 truncate max-w-[100px]">{entry.name}</span>
                            </div>
                            <span className="text-xs font-semibold text-slate-800">
                                {Number(entry.value).toFixed(1)}h
                            </span>
                        </div>
                    ))}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between">
                    <span className="text-xs font-medium text-slate-500">Total</span>
                    <span className="text-xs font-bold text-slate-800">{total.toFixed(1)}h</span>
                </div>
            </div>
        );
    };

    return (
        <div className="relative">
            <div className="text-xs text-slate-400 mb-3 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                Click on legend labels or bars to view detailed data
            </div>
            
            {/* Custom Legend */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
                {virtualGroupCategoryList.map((category, index) => (
                    <div 
                        key={category} 
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-slate-100 cursor-pointer transition-colors"
                        onClick={() => handleLegendClick({ dataKey: category })}
                    >
                        <div 
                            className="w-3 h-3 rounded-sm"
                            style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        <span className="text-xs text-slate-600 hover:text-slate-800">{category}</span>
                    </div>
                ))}
            </div>
            
            <ResponsiveContainer width="100%" height={450}>
                <BarChart layout="vertical" data={virtualGroupChartData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                    <defs>
                        {CHART_COLORS.map((color, index) => (
                            <linearGradient key={`barGrad${index}`} id={`barGradient${index}`} x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor={color} stopOpacity={0.9}/>
                                <stop offset="100%" stopColor={color} stopOpacity={0.7}/>
                            </linearGradient>
                        ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} horizontal={true} vertical={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                    <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<PremiumBarTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                    {virtualGroupCategoryList.map((category, index) => (
                        <Bar 
                            key={category} 
                            dataKey={category} 
                            stackId="a" 
                            fill={`url(#barGradient${index % CHART_COLORS.length})`}
                            onClick={(data) => handleBarClick(data, category)} 
                            cursor="pointer"
                            radius={index === virtualGroupCategoryList.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
            <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} />
        </div>
    );
};

const AverageMonthlyHourPerPersonChart = ({ teamData }: { teamData: any[] }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any[]>([]);
    const [dialogTitle, setDialogTitle] = useState('');

    // Premium color palette for groups - high contrast colors
    const GROUP_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

    const monthlyHourPerPersonData: { [key: string]: { [key: string]: { hours: number, users: Set<string> } } } = {};
    const allSourcePaths = new Set<string>();
    
    teamData.forEach(row => {
        const rawSourcePath = row['Source Path']?.toString();
        const sourcePath = rawSourcePath ? rawSourcePath.trim().replace('工时统计-', '').replace(/\\s+/g, ' ') : '';
        if (sourcePath && row['Month'] && row['Name']) {
            allSourcePaths.add(sourcePath);
             try {
                const rowDate = parse(row['Month'].toString(), 'yyyy/MM', new Date());
                const monthKey = format(rowDate, 'yyyy/MM');
                const hours = Number(row['Hours']) || 0;
                if (!monthlyHourPerPersonData[monthKey]) monthlyHourPerPersonData[monthKey] = {};
                if (!monthlyHourPerPersonData[monthKey][sourcePath]) monthlyHourPerPersonData[monthKey][sourcePath] = { hours: 0, users: new Set() };
                monthlyHourPerPersonData[monthKey][sourcePath].hours += hours;
                monthlyHourPerPersonData[monthKey][sourcePath].users.add(row['Name']);
             } catch {}
        }
    });
    
    const sourcePathList = Array.from(allSourcePaths).sort();
    const avgMonthlyHoursPerGroup = Object.entries(monthlyHourPerPersonData).map(([month, groupData]) => {
        const date = parse(month, 'yyyy/MM', new Date());
        const workdays = getWorkdaysInMonth(date.getFullYear(), date.getMonth() + 1, 'CN');
        const timeCoefficient = workdays > 0 ? 20.83 / workdays : 0;
        const monthEntry: any = { month };
        sourcePathList.forEach(sp => {
             const group = groupData[sp];
             if(group && group.users.size > 0) monthEntry[sp] = (group.hours / group.users.size) * timeCoefficient;
             else monthEntry[sp] = 0;
        });
        return monthEntry;
    }).sort((a,b) => a.month.localeCompare(b.month));

    const handleBarClick = (data: any, dataKey: string) => {
        if (!data || !data.month) return;
        const monthStr = data.month;
        const sourcePath = dataKey;
        const details = teamData.filter(row => {
            if (!row || !row['Month'] || !row['Source Path']) return false;
            try {
                const rowDate = parse(row['Month'].toString(), 'yyyy/MM', new Date());
                const rowMonth = format(rowDate, 'yyyy/MM');
                const rawSourcePath = row['Source Path'].toString();
                const rowSourcePath = rawSourcePath ? rawSourcePath.trim().replace('工时统计-', '').replace(/\\s+/g, ' ') : '';
                return rowMonth === monthStr && rowSourcePath === sourcePath;
            } catch { return false; }
        });
        setDialogTitle(`${sourcePath} - ${monthStr}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    // Premium tooltip
    const PremiumAvgTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;
        
        return (
            <div className="bg-white/95 backdrop-blur-md border border-slate-200/60 rounded-xl shadow-xl p-4 min-w-[200px]">
                <div className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">
                    {label}
                </div>
                <div className="space-y-2">
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <div 
                                    className="w-3 h-3 rounded-sm shadow-sm"
                                    style={{ backgroundColor: entry.color }}
                                />
                                <span className="text-xs text-slate-600 truncate max-w-[100px]">{entry.name}</span>
                            </div>
                            <span className="text-xs font-semibold text-slate-800">
                                {Number(entry.value).toFixed(2)}h
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <Card className="border-slate-200/60 shadow-sm hover:shadow-md transition-shadow duration-300">
            <CardHeader>
                <CardTitle className="text-sm font-medium text-slate-800">Average Monthly Hour Per Person - Each Virtual Group</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="relative">
                    {/* Custom Legend */}
                    <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
                        {sourcePathList.map((sourcePath, index) => (
                            <div key={sourcePath} className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-slate-100 cursor-pointer transition-colors">
                                <div 
                                    className="w-3 h-3 rounded-sm"
                                    style={{ backgroundColor: GROUP_COLORS[index % GROUP_COLORS.length] }}
                                />
                                <span className="text-xs text-slate-600">{sourcePath}</span>
                            </div>
                        ))}
                    </div>
                    
                    <ResponsiveContainer width="100%" height={350}>
                         <BarChart data={avgMonthlyHoursPerGroup} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                            <defs>
                                {GROUP_COLORS.map((color, index) => (
                                    <linearGradient key={`avgGrad${index}`} id={`avgGradient${index}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={color} stopOpacity={0.9}/>
                                        <stop offset="100%" stopColor={color} stopOpacity={0.7}/>
                                    </linearGradient>
                                ))}
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} vertical={false} />
                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                            <Tooltip content={<PremiumAvgTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                            {sourcePathList.map((sourcePath, index) => (
                                <Bar 
                                    key={sourcePath} 
                                    dataKey={sourcePath} 
                                    name={sourcePath} 
                                    fill={`url(#avgGradient${index % GROUP_COLORS.length})`}
                                    onClick={(data) => handleBarClick(data, sourcePath)} 
                                    cursor="pointer"
                                    radius={[4, 4, 0, 0]}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                    <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} />
                </div>
            </CardContent>
        </Card>
    );
};

const ClickableHoursCell = ({ 
    hours, 
    dealName, 
    category, 
    filteredData,
    isGroup 
}: { 
    hours: number, 
    dealName: string, 
    category: string, 
    filteredData: any[],
    isGroup?: boolean
}) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any[]>([]);
    const [dialogTitle, setDialogTitle] = useState('');

    const handleClick = () => {
        let details: any[] = [];
        
        if (isGroup) {
            // For group tables, match by name only (already filtered by source path)
            details = filteredData.filter(row => {
                const rowName = row['Deal/Matter Name']?.toString().replace(/\s+/g, ' ').trim();
                return rowName === dealName;
            });
        } else {
            // For M&A and Corporate Matter tables, match by name and category
            details = filteredData.filter(row => {
                const rowName = row['Deal/Matter Name']?.toString().replace(/\s+/g, ' ').trim();
                const rowCategory = row['Deal/Matter Category']?.toString().replace(/\s+/g, ' ').trim();
                return rowName === dealName && rowCategory === category;
            });
        }
        
        setDialogTitle(`${dealName} - ${category}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    return (
        <>
            <span 
                onClick={handleClick}
                className="cursor-pointer hover:text-blue-600 hover:underline transition-colors"
            >
                {hours.toFixed(2)}
            </span>
            <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} />
        </>
    );
};

const PeriodFilter = ({ 
    period, setPeriod, 
    selectedYear, setSelectedYear, 
    selectedPeriodValue, setSelectedPeriodValue, 
    customStartDate, setCustomStartDate, 
    customEndDate, setCustomEndDate,
    availableYears,
    periodOptions
}: any) => {
    return (
        <div className="flex items-center space-x-2 flex-wrap justify-end gap-y-2">
            <div className="flex items-center space-x-1">
                <Button size="sm" variant={period === 'monthly' ? 'secondary' : 'outline'} onClick={() => setPeriod('monthly')}>月度</Button>
                <Button size="sm" variant={period === 'quarterly' ? 'secondary' : 'outline'} onClick={() => setPeriod('quarterly')}>季度</Button>
                <Button size="sm" variant={period === 'semiannually' ? 'secondary' : 'outline'} onClick={() => setPeriod('semiannually')}>半年度</Button>
                <Button size="sm" variant={period === 'annually' ? 'secondary' : 'outline'} onClick={() => setPeriod('annually')}>年度</Button>
                <Button size="sm" variant={period === 'custom' ? 'secondary' : 'outline'} onClick={() => setPeriod('custom')}>自定义</Button>
            </div>

            {(period !== 'custom' && availableYears.length > 0) && (
                <Select value={selectedYear || ''} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-[100px] h-8"><SelectValue placeholder="年份" /></SelectTrigger>
                    <SelectContent>{availableYears.map((year: string) => <SelectItem key={year} value={year}>{year}</SelectItem>)}</SelectContent>
                </Select>
            )}

            {(period !== 'custom' && period !== 'annually') && (periodOptions[period] as readonly Option[]).length > 0 && (
                <Select value={selectedPeriodValue || ''} onValueChange={setSelectedPeriodValue}>
                    <SelectTrigger className="w-[120px] h-8"><SelectValue placeholder="选择期间" /></SelectTrigger>
                    <SelectContent>{(periodOptions[period] as readonly Option[]).map((option: Option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
            )}

            {period === 'custom' && (
                <div className="flex items-center space-x-2">
                    <MonthPicker value={customStartDate} onChange={setCustomStartDate} />
                    <span>-</span>
                    <MonthPicker value={customEndDate} onChange={setCustomEndDate} />
                </div>
            )}
        </div>
    );
};

const FilterSection = ({ 
    data, 
    title, 
    children,
    className 
}: { 
    data: any[], 
    title?: string, 
    children: (filteredData: any[], totalHours: number, trend?: number) => React.ReactNode,
    className?: string
}) => {
    const [period, setPeriod] = useState<Period>('monthly');
    const [selectedYear, setSelectedYear] = useState<string | null>(null);
    const [selectedPeriodValue, setSelectedPeriodValue] = useState<string | null>(null);
    const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
    const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);

    const availableYears = useMemo(() => {
        const validData = data.filter(row => row && (row._parsedDate || row['Month']));
        if (!validData || validData.length === 0) return [];
        const years = [...new Set(validData.map(row => {
            const d = row._parsedDate || parse(row['Month'].toString(), 'yyyy/MM', new Date());
            return d.getFullYear();
        }))].filter(year => !isNaN(year));
        return years.sort((a, b) => b - a).map(y => y.toString());
    }, [data]);

    useEffect(() => {
        if (availableYears.length > 0 && !selectedYear) {
            setSelectedYear(availableYears[0]);
        }
        if (period === 'monthly' && !selectedPeriodValue && data.length > 0) {
            const latestMonth = data.reduce((latest, row) => {
                // Use pre-parsed date if available
                const d = row._parsedDate;
                return d && d > latest ? d : latest;
            }, new Date(0));
            if(latestMonth.getTime() > 0) {
                setSelectedYear(getYear(latestMonth).toString());
                setSelectedPeriodValue(getMonth(latestMonth).toString());
            }
        }
    }, [availableYears, data, period, selectedYear, selectedPeriodValue]);

    useEffect(() => {
        if(period !== 'monthly') {
            setSelectedPeriodValue(null);
        }
    }, [period]);

    const filteredInfo = useMemo(() => {
        let cardStartDate: Date | undefined, cardEndDate: Date | undefined;

        if (period === 'custom') {
            cardStartDate = customStartDate ? startOfMonth(customStartDate) : undefined;
            cardEndDate = customEndDate ? endOfMonth(customEndDate) : undefined;
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
                        cardEndDate = endOfMonth(cardStartDate);
                        break;
                    case 'quarterly':
                        cardStartDate = new Date(year, val * 3, 1);
                        cardEndDate = endOfMonth(new Date(year, val * 3 + 2, 1));
                        break;
                    case 'semiannually':
                        cardStartDate = new Date(year, val * 6, 1);
                        cardEndDate = endOfMonth(new Date(year, val * 6 + 5, 1));
                        break;
                }
            } else if (selectedYear && !selectedPeriodValue && (period === 'quarterly' || period === 'semiannually')) {
                cardStartDate = new Date(year, 0, 1);
                cardEndDate = new Date(year, 11, 31);
            }
        }
        
        // Default to latest month if no selection
        if (!cardStartDate || !cardEndDate) {
             const latestMonthInData = data.length > 0 ? data.reduce((latest, row) => {
                 // Use pre-parsed date if available
                 const d = row._parsedDate || (row.Month ? parse(row.Month.toString(), 'yyyy/MM', new Date()) : null);
                 return d && d > latest ? d : latest;
            }, new Date(0)) : new Date(0);

             if (latestMonthInData.getTime() > 0) {
                cardStartDate = startOfMonth(latestMonthInData);
                cardEndDate = endOfMonth(latestMonthInData);
            } else {
                cardStartDate = startOfMonth(new Date());
                cardEndDate = endOfMonth(new Date());
            }
        }

        const filteredData = data.filter(row => {
            if (!row) return false;
            // Use pre-parsed date if available
            const rowDate = row._parsedDate;
            if (!rowDate) return false;
            return rowDate >= cardStartDate! && rowDate <= cardEndDate!;
        });

        const totalHours = filteredData.reduce((acc, row) => acc + (Number(row['Hours']) || 0), 0);

        // Calculate previous period for trend
        let prevStartDate: Date | undefined, prevEndDate: Date | undefined;
        if (cardStartDate && cardEndDate) {
            const duration = cardEndDate.getTime() - cardStartDate.getTime();
            const durationMonths = Math.round(duration / (1000 * 60 * 60 * 24 * 30));
            
            if (period === 'monthly') {
                // Previous month
                prevStartDate = new Date(cardStartDate.getFullYear(), cardStartDate.getMonth() - 1, 1);
                prevEndDate = endOfMonth(prevStartDate);
            } else if (period === 'quarterly') {
                // Previous quarter
                prevStartDate = new Date(cardStartDate.getFullYear(), cardStartDate.getMonth() - 3, 1);
                prevEndDate = endOfMonth(new Date(prevStartDate.getFullYear(), prevStartDate.getMonth() + 2, 1));
            } else if (period === 'semiannually') {
                // Previous half year
                prevStartDate = new Date(cardStartDate.getFullYear(), cardStartDate.getMonth() - 6, 1);
                prevEndDate = endOfMonth(new Date(prevStartDate.getFullYear(), prevStartDate.getMonth() + 5, 1));
            } else if (period === 'annually') {
                // Previous year
                prevStartDate = new Date(cardStartDate.getFullYear() - 1, 0, 1);
                prevEndDate = new Date(cardStartDate.getFullYear() - 1, 11, 31);
            } else if (period === 'custom' && durationMonths > 0) {
                // Previous period of same duration
                prevEndDate = new Date(cardStartDate.getTime() - 1);
                prevStartDate = new Date(prevEndDate.getTime() - duration);
            }
        }

        let trend: number | undefined = undefined;
        if (prevStartDate && prevEndDate) {
            const prevFilteredData = data.filter(row => {
                if (!row) return false;
                // Use pre-parsed date if available
                const rowDate = row._parsedDate;
                if (!rowDate) return false;
                return rowDate >= prevStartDate! && rowDate <= prevEndDate!;
            });
            const prevTotalHours = prevFilteredData.reduce((acc, row) => acc + (Number(row['Hours']) || 0), 0);
            if (prevTotalHours > 0) {
                trend = ((totalHours - prevTotalHours) / prevTotalHours) * 100;
            }
        }

        return { filteredData, totalHours, trend };
    }, [data, period, selectedYear, selectedPeriodValue, customStartDate, customEndDate]);

    return (
        <Card className={`${className} border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-200`}>
            <CardHeader className="pb-4">
                <div className="flex flex-col space-y-3">
                    <div className="flex justify-end">
                        <PeriodFilter 
                            period={period} setPeriod={setPeriod}
                            selectedYear={selectedYear} setSelectedYear={setSelectedYear}
                            selectedPeriodValue={selectedPeriodValue} setSelectedPeriodValue={setSelectedPeriodValue}
                            customStartDate={customStartDate} setCustomStartDate={setCustomStartDate}
                            customEndDate={customEndDate} setCustomEndDate={setCustomEndDate}
                            availableYears={availableYears}
                            periodOptions={PERIOD_OPTIONS}
                        />
                    </div>
                    {title && <CardTitle className="text-sm font-medium">{title}</CardTitle>}
                </div>
            </CardHeader>
            <CardContent>
                {children(filteredInfo.filteredData, filteredInfo.totalHours, filteredInfo.trend)}
            </CardContent>
        </Card>
    );
};

// Investment Work Category Comparison Component - shows Work Category distribution by Deal/Matter Category
const InvestmentWorkCategoryComparison = ({ teamData }: { teamData: any[] }) => {
    const [period, setPeriod] = useState<Period>('monthly');
    const [selectedYear, setSelectedYear] = useState<string | null>(null);
    const [selectedPeriodValue, setSelectedPeriodValue] = useState<string | null>(null);
    const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
    const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any[]>([]);
    const [dialogTitle, setDialogTitle] = useState('');

    // Investment-related categories to filter
    const investmentCategories = [
        'Investment Related - M&A Deal',
        'Investment Related - IPO',
        'Investment Related - Corporate Matter'
    ];

    const availableYears = useMemo(() => {
        const validData = teamData.filter(row => row && row._parsedDate);
        if (!validData || validData.length === 0) return [];
        const years = [...new Set(validData.map(row => row._parsedDate.getFullYear()))].filter(year => !isNaN(year));
        return years.sort((a, b) => b - a).map(y => y.toString());
    }, [teamData]);

    useEffect(() => {
        if (availableYears.length > 0 && !selectedYear) {
            setSelectedYear(availableYears[0]);
        }
        if (period === 'monthly' && !selectedPeriodValue && teamData.length > 0) {
            const latestMonth = teamData.reduce((latest, row) => {
                const d = row._parsedDate;
                return d && d > latest ? d : latest;
            }, new Date(0));
            if (latestMonth.getTime() > 0) {
                setSelectedYear(getYear(latestMonth).toString());
                setSelectedPeriodValue(getMonth(latestMonth).toString());
            }
        }
    }, [availableYears, teamData, period, selectedYear, selectedPeriodValue]);

    useEffect(() => {
        if (period !== 'monthly') {
            setSelectedPeriodValue(null);
        }
    }, [period]);

    // Filter data based on period selection
    const filteredData = useMemo(() => {
        let cardStartDate: Date | undefined, cardEndDate: Date | undefined;

        if (period === 'custom') {
            cardStartDate = customStartDate ? startOfMonth(customStartDate) : undefined;
            cardEndDate = customEndDate ? endOfMonth(customEndDate) : undefined;
        } else if (selectedYear) {
            const year = parseInt(selectedYear, 10);
            if (period === 'annually') {
                cardStartDate = new Date(year, 0, 1);
                cardEndDate = new Date(year, 11, 31);
            } else if (selectedPeriodValue !== null) {
                const val = parseInt(selectedPeriodValue, 10);
                switch (period) {
                    case 'monthly':
                        cardStartDate = new Date(year, val, 1);
                        cardEndDate = endOfMonth(cardStartDate);
                        break;
                    case 'quarterly':
                        cardStartDate = new Date(year, val * 3, 1);
                        cardEndDate = endOfMonth(new Date(year, val * 3 + 2, 1));
                        break;
                    case 'semiannually':
                        cardStartDate = new Date(year, val * 6, 1);
                        cardEndDate = endOfMonth(new Date(year, val * 6 + 5, 1));
                        break;
                }
            } else if (!selectedPeriodValue && (period === 'quarterly' || period === 'semiannually')) {
                cardStartDate = new Date(year, 0, 1);
                cardEndDate = new Date(year, 11, 31);
            }
        }

        // Default to latest month if no selection
        if (!cardStartDate || !cardEndDate) {
            const latestMonthInData = teamData.length > 0 ? teamData.reduce((latest, row) => {
                const d = row._parsedDate;
                return d && d > latest ? d : latest;
            }, new Date(0)) : new Date(0);

            if (latestMonthInData.getTime() > 0) {
                cardStartDate = startOfMonth(latestMonthInData);
                cardEndDate = endOfMonth(latestMonthInData);
            } else {
                cardStartDate = startOfMonth(new Date());
                cardEndDate = endOfMonth(new Date());
            }
        }

        return teamData.filter(row => {
            if (!row || !row._parsedDate) return false;
            const rowDate = row._parsedDate;
            return rowDate >= cardStartDate! && rowDate <= cardEndDate!;
        });
    }, [teamData, period, selectedYear, selectedPeriodValue, customStartDate, customEndDate]);

    // Process chart data - group by Deal/Matter Category (X-axis) and Work Category (bars)
    const chartData = useMemo(() => {
        // First filter to only investment-related categories
        const investmentData = filteredData.filter(row => {
            const category = row['Deal/Matter Category']?.toString();
            return investmentCategories.some(invCat => fieldsMatch(invCat, category));
        });

        // Group by Deal/Matter Category
        const categoryGroups: { [key: string]: { [workCat: string]: number } } = {};
        const allWorkCategories = new Set<string>();
        const workCategoryMap: { [key: string]: string } = {}; // normalized key -> display name

        investmentData.forEach(row => {
            const rawDealCategory = row['Deal/Matter Category']?.toString();
            const rawWorkCategory = row['Work Category']?.toString();
            const hours = Number(row['Hours']) || 0;

            if (!rawDealCategory || !rawWorkCategory || hours <= 0) return;

            // Find matching investment category for consistent naming
            const matchedDealCategory = investmentCategories.find(invCat => fieldsMatch(invCat, rawDealCategory)) || rawDealCategory;
            
            // Normalize work category
            const workCatKey = createNormalizedKey(rawWorkCategory);
            if (!workCategoryMap[workCatKey]) {
                workCategoryMap[workCatKey] = rawWorkCategory.trim().replace(/\s+/g, ' ');
            }
            const workCategory = workCategoryMap[workCatKey];
            allWorkCategories.add(workCategory);

            if (!categoryGroups[matchedDealCategory]) {
                categoryGroups[matchedDealCategory] = {};
            }
            categoryGroups[matchedDealCategory][workCategory] = (categoryGroups[matchedDealCategory][workCategory] || 0) + hours;
        });

        // Convert to chart format
        const data = investmentCategories.map(dealCategory => {
            const entry: any = { 
                category: dealCategory.replace('Investment Related - ', ''), // Shorter label
                fullCategory: dealCategory
            };
            allWorkCategories.forEach(workCat => {
                entry[workCat] = categoryGroups[dealCategory]?.[workCat] || 0;
            });
            return entry;
        });

        // Sort work categories by total hours
        const workCatTotals: { [key: string]: number } = {};
        Array.from(allWorkCategories).forEach(wc => {
            workCatTotals[wc] = data.reduce((sum, d) => sum + (d[wc] || 0), 0);
        });
        const sortedWorkCategories = Array.from(allWorkCategories).sort((a, b) => workCatTotals[b] - workCatTotals[a]);

        return { data, workCategories: sortedWorkCategories };
    }, [filteredData]);

    const handleBarClick = (barData: any, workCategory: string) => {
        if (!barData || !barData.fullCategory) return;
        const dealCategory = barData.fullCategory;
        
        const details = filteredData.filter(row => {
            const rowDealCat = row['Deal/Matter Category']?.toString();
            const rowWorkCat = row['Work Category']?.toString();
            return fieldsMatch(rowDealCat, dealCategory) && fieldsMatch(rowWorkCat, workCategory);
        });
        
        setDialogTitle(`${dealCategory} - ${workCategory}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    const handleLegendClick = (e: any) => {
        if (!e || !e.dataKey) return;
        const workCategory = e.dataKey;
        
        const details = filteredData.filter(row => {
            const rowDealCat = row['Deal/Matter Category']?.toString();
            const rowWorkCat = row['Work Category']?.toString();
            const isInvestmentCategory = investmentCategories.some(invCat => fieldsMatch(invCat, rowDealCat));
            return isInvestmentCategory && fieldsMatch(rowWorkCat, workCategory);
        });
        
        setDialogTitle(`All records for ${workCategory}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    // Premium color palette - high contrast colors
    const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#a855f7', '#14b8a6', '#e11d48', '#22c55e', '#eab308', '#3b82f6', '#d946ef'];

    // Handle tooltip item click
    const handleTooltipItemClick = (workCategory: string, dealCategory: string) => {
        const fullDealCategory = chartData.data.find(d => d.category === dealCategory)?.fullCategory || dealCategory;
        const details = filteredData.filter(row => {
            const rowDealCat = row['Deal/Matter Category']?.toString();
            const rowWorkCat = row['Work Category']?.toString();
            return fieldsMatch(rowDealCat, fullDealCategory) && fieldsMatch(rowWorkCat, workCategory);
        });
        setDialogTitle(`${fullDealCategory} - ${workCategory}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    // Premium tooltip component
    const PremiumComparisonTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;
        
        // Filter out gradient fills (Area components)
        const filteredPayload = payload.filter((entry: any) => 
            entry.value > 0 && entry.color && !entry.color.startsWith('url(')
        );
        
        if (filteredPayload.length === 0) return null;
        
        const total = filteredPayload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);
        
        return (
            <div className="bg-white/95 backdrop-blur-md border border-slate-200/60 rounded-xl shadow-xl p-4 min-w-[240px]">
                <div className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">
                    Deal/Matter: {label}
                </div>
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                    {filteredPayload.map((entry: any, index: number) => (
                        <div 
                            key={index} 
                            className="flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5 transition-colors"
                            onClick={() => handleTooltipItemClick(entry.dataKey, label)}
                        >
                            <div className="flex items-center gap-2">
                                <div 
                                    className="w-3 h-3 rounded-sm shadow-sm"
                                    style={{ backgroundColor: entry.color }}
                                />
                                <span className="text-xs text-slate-600 truncate max-w-[120px]">{entry.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-800">
                                    {Number(entry.value).toFixed(1)}h
                                </span>
                                <span className="text-[10px] text-slate-400">
                                    ({((entry.value / total) * 100).toFixed(0)}%)
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between">
                    <span className="text-xs font-medium text-slate-500">Total</span>
                    <span className="text-xs font-bold text-slate-800">{total.toFixed(1)}h</span>
                </div>
            </div>
        );
    };

    return (
        <Card className="border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-200">
            <CardHeader className="pb-4">
                <div className="flex flex-col space-y-4 xl:flex-row xl:items-center xl:justify-between xl:space-y-0">
                    <CardTitle className="text-sm font-medium">Comparison of Work Category by Deal/Matter Category</CardTitle>
                    <div className="origin-left xl:origin-right">
                        <PeriodFilter 
                            period={period} setPeriod={setPeriod}
                            selectedYear={selectedYear} setSelectedYear={setSelectedYear}
                            selectedPeriodValue={selectedPeriodValue} setSelectedPeriodValue={setSelectedPeriodValue}
                            customStartDate={customStartDate} setCustomStartDate={setCustomStartDate}
                            customEndDate={customEndDate} setCustomEndDate={setCustomEndDate}
                            availableYears={availableYears}
                            periodOptions={PERIOD_OPTIONS}
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {chartData.data.length > 0 && chartData.workCategories.length > 0 ? (
                    <div className="relative">
                        <div className="text-xs text-slate-400 mb-3 flex items-center gap-1.5">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                            Click on legend labels or bars to view detailed data
                        </div>
                        
                        {/* Custom Legend */}
                        <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                            {chartData.workCategories.map((workCat, index) => (
                                <div 
                                    key={workCat} 
                                    className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-slate-100 cursor-pointer transition-colors"
                                    onClick={() => handleLegendClick({ dataKey: workCat })}
                                >
                                    <div 
                                        className="w-3 h-3 rounded-sm"
                                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                                    />
                                    <span className="text-xs text-slate-600 hover:text-slate-800">{workCat}</span>
                                </div>
                            ))}
                        </div>
                        
                        <ResponsiveContainer width="100%" height={500}>
                            <BarChart data={chartData.data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                <defs>
                                    {CHART_COLORS.map((color, index) => (
                                        <linearGradient key={`invWorkGrad${index}`} id={`invWorkGradient${index}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={color} stopOpacity={0.95}/>
                                            <stop offset="100%" stopColor={color} stopOpacity={0.7}/>
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} vertical={false} />
                                <XAxis 
                                    dataKey="category" 
                                    tick={{ fontSize: 12, fill: '#475569' }} 
                                    interval={0}
                                    angle={-15}
                                    textAnchor="end"
                                    height={80}
                                    axisLine={{ stroke: '#e2e8f0' }}
                                    tickLine={false}
                                />
                                <YAxis 
                                    label={{ value: 'Hours', angle: -90, position: 'insideLeft', offset: 10, style: { fill: '#64748b', fontSize: 12 } }} 
                                    tick={{ fontSize: 11, fill: '#64748b' }}
                                    axisLine={{ stroke: '#e2e8f0' }}
                                    tickLine={false}
                                />
                                <Tooltip 
                                    content={<PremiumComparisonTooltip />}
                                    cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                                />
                                {chartData.workCategories.map((workCat, index) => (
                                    <Bar 
                                        key={workCat} 
                                        dataKey={workCat} 
                                        name={workCat} 
                                        fill={`url(#invWorkGradient${index % CHART_COLORS.length})`}
                                        onClick={(data) => handleBarClick(data, workCat)}
                                        cursor="pointer"
                                        radius={[4, 4, 0, 0]}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        <p>当期无数据</p>
                    </div>
                )}
                <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} />
            </CardContent>
        </Card>
    );
};

const InvestmentLegalCenterPanel = ({ data }: { data: any[] }) => {
    // Pre-process data once: filter team and parse dates
    const teamData = useMemo(() => {
        return data
            .filter(row => row && row['团队'] === '投资法务中心')
            .map(row => ({
                ...row,
                _parsedDate: row['Month'] ? parse(row['Month'].toString(), 'yyyy/MM', new Date()) : null
            }));
    }, [data]);

    // Global Data for Trends (Full History)
    const trendData = useMemo(() => {
        if (teamData.length === 0) return { monthlyTrends: [], utilizationTrends: [] };

        let overallMinDate: Date | null = null;
        let overallMaxDate: Date | null = null;

        teamData.forEach(row => {
             if (!row) return;
             // Use pre-parsed date
             const rowDate = row._parsedDate;
             if (!rowDate) return;
             if (!overallMinDate || rowDate < overallMinDate) overallMinDate = rowDate;
             if (!overallMaxDate || rowDate > overallMaxDate) overallMaxDate = rowDate;
        });

        const trendStartDate = overallMinDate ? startOfMonth(overallMinDate) : new Date();
        const trendEndDate = overallMaxDate ? endOfMonth(overallMaxDate) : new Date();

        // Monthly Trends
        const monthlyAgg: { [key: string]: { hours: number; users: Set<string> } } = {};
        const monthsInPeriod = eachMonthOfInterval({ start: trendStartDate, end: trendEndDate });
        monthsInPeriod.forEach(monthDate => {
            monthlyAgg[format(monthDate, 'yyyy/MM')] = { hours: 0, users: new Set() };
        });

        teamData.forEach(row => {
            if (!row || !row['Name']) return;
            // Use pre-parsed date
            const rowDate = row._parsedDate;
            if (!rowDate) return;
            const monthKey = format(rowDate, 'yyyy/MM');
            if (monthlyAgg.hasOwnProperty(monthKey)) {
                monthlyAgg[monthKey].hours += Number(row['Hours']) || 0;
                const name = row['Name'].toString().replace(/\\s+/g, ' ').trim();
                monthlyAgg[monthKey].users.add(name);
            }
        });

        const monthlyTrends = Object.keys(monthlyAgg).sort().map(month => {
            const monthData = monthlyAgg[month];
            const date = parse(month, 'yyyy/MM', new Date());
            const workdays = getWorkdaysInMonth(date.getFullYear(), date.getMonth() + 1, 'CN');
            const timeCoefficient = workdays > 0 ? 20.83 / workdays : 0;
            const avgHours = monthData.users.size > 0 ? (monthData.hours / monthData.users.size) * timeCoefficient : 0;
            return { month, totalHours: monthData.hours, avgHoursPerUser: avgHours };
        }).map((current, index, array) => {
            const prevTotalHours = index > 0 ? array[index - 1].totalHours : 0;
            const prevAvgHours = index > 0 ? array[index - 1].avgHoursPerUser : 0;
            return {
                ...current,
                totalHoursTrend: prevTotalHours > 0 ? ((current.totalHours - prevTotalHours) / prevTotalHours) * 100 : 0,
                avgHoursTrend: prevAvgHours > 0 ? ((current.avgHoursPerUser - prevAvgHours) / prevAvgHours) * 100 : 0,
            };
        });

        // Utilization Trends - use case-insensitive matching
        const utilizationCategories = ['Investment Related - IPO', 'Investment Related - Corporate Matter', 'Investment Related - M&A Deal'];
        const utilizationTrendsAgg: { [key: string]: any } = {};
        monthsInPeriod.forEach(monthDate => {
            const monthKey = format(monthDate, 'yyyy/MM');
            utilizationTrendsAgg[monthKey] = { month: monthKey };
            utilizationCategories.forEach(cat => utilizationTrendsAgg[monthKey][cat] = 0);
        });

        teamData.forEach(row => {
            if (!row || !row['Deal/Matter Category']) return;
            const rawCategory = row['Deal/Matter Category']?.toString() || '';
            // Find matching category using case-insensitive comparison
            const matchedCategory = utilizationCategories.find(cat => fieldsMatch(cat, rawCategory));
            if (matchedCategory) {
                // Use pre-parsed date
                const rowDate = row._parsedDate;
                if (!rowDate) return;
                const monthKey = format(rowDate, 'yyyy/MM');
                if (utilizationTrendsAgg[monthKey]) {
                     utilizationTrendsAgg[monthKey][matchedCategory] = (utilizationTrendsAgg[monthKey][matchedCategory] || 0) + (Number(row['Hours']) || 0);
                }
            }
        });
        const utilizationTrends = Object.values(utilizationTrendsAgg).sort((a: any, b: any) => a.month.localeCompare(b.month));

        return { monthlyTrends, utilizationTrends };
    }, [teamData]);

    return (
        <div className="space-y-4">
             <div className="grid gap-4 md:grid-cols-2">
                <FilterSection data={teamData} title="Total Working Hours">
                    {(_, totalHours, trend) => (
                         <>
                            <div className="text-2xl font-bold">{totalHours?.toFixed(2) || '0.00'}h</div>
                            <p className="text-xs text-muted-foreground">在筛选期间的总工时</p>
                            {trend !== undefined && (
                                <p className={`text-xs font-medium mt-1 ${trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    环比: {trend >= 0 ? '+' : ''}{trend.toFixed(2)}%
                                </p>
                            )}
                         </>
                    )}
                </FilterSection>
                
                <FilterSection data={teamData} title="Working Hours (BSC vs Others)">
                    {(filteredData, totalHours) => (
                        <BSCPieChartSection filteredData={filteredData} totalHours={totalHours} />
                    )}
                </FilterSection>
            </div>

            {/* Trend Charts - No Filter */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle className="text-sm font-medium">Comparison of Total Working Hours</CardTitle></CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <ComposedChart data={trendData.monthlyTrends}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                <YAxis yAxisId="left" label={{ value: '小时', angle: -90, position: 'insideLeft', offset: 10 }} tick={{ fontSize: 12 }} />
                                <YAxis yAxisId="right" orientation="right" label={{ value: '%', angle: -90, position: 'insideRight', offset: 10 }} tick={{ fontSize: 12 }}/>
                                <Tooltip formatter={(value: number) => Number(value).toFixed(2)} />
                                <Legend iconType="rect" />
                                <Bar yAxisId="left" dataKey="totalHours" name="总用时" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                                <Line yAxisId="right" type="monotone" dataKey="totalHoursTrend" name="环比 (%)" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: "#10b981" }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-sm font-medium">Comparison of Monthly Avg Working Hours per person</CardTitle></CardHeader>
                    <CardContent>
                         <ResponsiveContainer width="100%" height={300}>
                            <ComposedChart data={trendData.monthlyTrends}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                <YAxis yAxisId="left" label={{ value: '小时', angle: -90, position: 'insideLeft', offset: 10 }} tick={{ fontSize: 12 }} />
                                <YAxis yAxisId="right" orientation="right" label={{ value: '%', angle: -90, position: 'insideRight', offset: 10 }} tick={{ fontSize: 12 }}/>
                                <Tooltip formatter={(value: number) => Number(value).toFixed(2)} />
                                <Legend iconType="rect" />
                                <Bar yAxisId="left" dataKey="avgHoursPerUser" name="人均用时" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                                <Line yAxisId="right" type="monotone" dataKey="avgHoursTrend" name="环比 (%)" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: "#f59e0b" }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Pie Chart Section - Full Width */}
            <FilterSection data={teamData} title="Hours Allocation by Deal/Matters Categories">
                {(filteredData, totalHours) => (
                     <DealCategoryPieChartSection filteredData={filteredData} totalHours={totalHours} />
                )}
            </FilterSection>
                
            {/* Utilization Trend - Full Width */}
            <Card className="border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-200">
                <CardHeader><CardTitle className="text-sm font-medium">Working Hour Utilization Trends by Deal/Matter Categories</CardTitle></CardHeader>
                <CardContent>
                    <UtilizationTrendChart data={trendData.utilizationTrends} teamData={teamData} />
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                <FilterSection data={teamData} title="Working Hours of M&A Deals - Per Target Companies">
                    {(filteredData) => {
                        const mAndADealsAgg: { [key: string]: { hours: number, name: string } } = {};
                        filteredData.filter(row => fieldsMatch(row['Deal/Matter Category'], 'Investment Related - M&A Deal') && row['Deal/Matter Name']).forEach(row => {
                                const rawName = row['Deal/Matter Name'].toString();
                                const name = rawName.replace(/\\s+/g, ' ').trim();
                                if (!name) return;
                                const key = createNormalizedKey(name);
                                const hours = Number(row['Hours']) || 0;
                                if (!mAndADealsAgg[key]) mAndADealsAgg[key] = { hours: 0, name: name };
                                mAndADealsAgg[key].hours += hours;
                            });
                        const mAndADeals = Object.values(mAndADealsAgg).map(({ name, hours }) => ({ name, hours })).sort((a, b) => b.hours - a.hours);
                        const maxHours = mAndADeals.length > 0 ? Math.max(...mAndADeals.map(d => d.hours)) : 0;

                        return (
                            <div className="max-h-[320px] overflow-y-auto rounded-lg border border-slate-200/60">
                                <table className="w-full">
                                    <thead className="sticky top-0 z-10">
                                        <tr className="bg-gradient-to-r from-rose-50 to-orange-50 border-b border-slate-200/60">
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">Deal/Matter Name</th>
                                            <th className="text-right py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider w-32">Hours</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {mAndADeals.length > 0 ? mAndADeals.map((deal, idx) => (
                                            <tr 
                                                key={deal.name} 
                                                className="group hover:bg-gradient-to-r hover:from-rose-50/50 hover:to-transparent transition-all duration-200"
                                                style={{ animationDelay: `${idx * 30}ms` }}
                                            >
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-3">
                                                        <div 
                                                            className="w-1.5 h-8 rounded-full bg-gradient-to-b from-rose-400 to-rose-500 opacity-60 group-hover:opacity-100 transition-opacity"
                                                            style={{ height: `${Math.max(20, (deal.hours / maxHours) * 32)}px` }}
                                                        />
                                                        <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors font-medium">
                                                            {deal.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <ClickableHoursCell hours={deal.hours} dealName={deal.name} category="Investment Related - M&A Deal" filteredData={filteredData} />
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={2} className="text-center py-8 text-slate-400 text-sm">当期无数据</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        );
                    }}
                </FilterSection>

                <FilterSection data={teamData} title="Working Hours of Portfolios' Corporate Matters - Per Target Companies">
                    {(filteredData) => {
                         const corporateMattersAgg: { [key: string]: { hours: number, name: string } } = {};
                        filteredData.filter(row => fieldsMatch(row['Deal/Matter Category'], 'Investment Related - Corporate Matter') && row['Deal/Matter Name']).forEach(row => {
                                const rawName = row['Deal/Matter Name'].toString();
                                const name = rawName.replace(/\\s+/g, ' ').trim();
                                if (!name) return;
                                const key = createNormalizedKey(name);
                                const hours = Number(row['Hours']) || 0;
                                if (!corporateMattersAgg[key]) corporateMattersAgg[key] = { hours: 0, name: name };
                                corporateMattersAgg[key].hours += hours;
                            });
                        const corporateMatters = Object.values(corporateMattersAgg).map(({ name, hours }) => ({ name, hours })).sort((a, b) => b.hours - a.hours);
                        const maxHours = corporateMatters.length > 0 ? Math.max(...corporateMatters.map(d => d.hours)) : 0;

                        return (
                            <div className="max-h-[320px] overflow-y-auto rounded-lg border border-slate-200/60">
                                <table className="w-full">
                                    <thead className="sticky top-0 z-10">
                                        <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200/60">
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">Deal/Matter Name</th>
                                            <th className="text-right py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider w-32">Hours</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {corporateMatters.length > 0 ? corporateMatters.map((matter, idx) => (
                                            <tr 
                                                key={matter.name} 
                                                className="group hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent transition-all duration-200"
                                                style={{ animationDelay: `${idx * 30}ms` }}
                                            >
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-3">
                                                        <div 
                                                            className="w-1.5 h-8 rounded-full bg-gradient-to-b from-blue-400 to-indigo-500 opacity-60 group-hover:opacity-100 transition-opacity"
                                                            style={{ height: `${Math.max(20, (matter.hours / maxHours) * 32)}px` }}
                                                        />
                                                        <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors font-medium">
                                                            {matter.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <ClickableHoursCell hours={matter.hours} dealName={matter.name} category="Investment Related - Corporate Matter" filteredData={filteredData} />
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={2} className="text-center py-8 text-slate-400 text-sm">当期无数据</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        );
                    }}
                </FilterSection>
            </div>

            <FilterSection data={teamData} title="Working Hours of Each Virtual Group">
                {(filteredData) => (
                    <VirtualGroupHoursChart filteredData={filteredData} />
                )}
            </FilterSection>

            {/* Average Monthly Hour - Trend Chart - No Filter */}
            <AverageMonthlyHourPerPersonChart teamData={teamData} />

            <FilterSection data={teamData} title="Working Hours - Per Target Company (Groups 1-6)">
                {(filteredData) => {
                    // Premium color palette for each group
                    const GROUP_COLORS = [
                        { from: 'from-violet-400', to: 'to-purple-500', bg: 'from-violet-50', bgHover: 'hover:from-violet-50/50' },
                        { from: 'from-emerald-400', to: 'to-teal-500', bg: 'from-emerald-50', bgHover: 'hover:from-emerald-50/50' },
                        { from: 'from-amber-400', to: 'to-orange-500', bg: 'from-amber-50', bgHover: 'hover:from-amber-50/50' },
                        { from: 'from-sky-400', to: 'to-blue-500', bg: 'from-sky-50', bgHover: 'hover:from-sky-50/50' },
                        { from: 'from-rose-400', to: 'to-pink-500', bg: 'from-rose-50', bgHover: 'hover:from-rose-50/50' },
                        { from: 'from-indigo-400', to: 'to-blue-600', bg: 'from-indigo-50', bgHover: 'hover:from-indigo-50/50' },
                    ];
                    
                    return (
                        <div className="grid gap-4 grid-cols-3">
                            {[1, 2, 3, 4, 5, 6].map(groupNum => {
                                const groupName = `${groupNum}组`;
                                const targetSuffix = `${groupNum}组`;
                                const colorScheme = GROUP_COLORS[groupNum - 1];
                                const groupDataMap: { [key: string]: { hours: number, name: string } } = {};
                                filteredData
                                    .filter(row => {
                                        const rawSourcePath = row['Source Path']?.toString();
                                        const sourcePath = rawSourcePath ? rawSourcePath.trim() : '';
                                        return sourcePath && sourcePath.endsWith(targetSuffix);
                                    })
                                    .forEach(row => {
                                        const rawName = row['Deal/Matter Name']?.toString();
                                        const name = rawName ? rawName.replace(/\\s+/g, ' ').trim() : '';
                                        if (name) {
                                            const key = createNormalizedKey(name);
                                            const hours = Number(row['Hours']) || 0;
                                            if (!groupDataMap[key]) groupDataMap[key] = { hours: 0, name: name };
                                            groupDataMap[key].hours += hours;
                                        }
                                    });
                                const data = Object.values(groupDataMap).map(({ name, hours }) => ({ name, hours })).sort((a, b) => b.hours - a.hours);
                                const maxHours = data.length > 0 ? Math.max(...data.map(d => d.hours)) : 0;

                                return (
                                    <div key={groupName} className="rounded-xl border border-slate-200/60 overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
                                        {/* Group Header */}
                                        <div className={`bg-gradient-to-r ${colorScheme.bg} to-white px-4 py-3 border-b border-slate-100`}>
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${colorScheme.from} ${colorScheme.to}`} />
                                                <h4 className="text-sm font-semibold text-slate-700">Group {groupNum}</h4>
                                                <span className="ml-auto text-xs text-slate-400">{data.length} items</span>
                                            </div>
                                        </div>
                                        
                                        {/* Table Content */}
                                        <div className="max-h-[280px] overflow-y-auto">
                                            <table className="w-full">
                                                <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm">
                                                    <tr className="border-b border-slate-100">
                                                        <th className="text-left py-2 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                                                        <th className="text-right py-2 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider w-20">Hours</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {data.length > 0 ? data.map((item, idx) => (
                                                        <tr 
                                                            key={idx} 
                                                            className={`group hover:bg-gradient-to-r ${colorScheme.bgHover} hover:to-transparent transition-all duration-200`}
                                                        >
                                                            <td className="py-2.5 px-3">
                                                                <div className="flex items-center gap-2">
                                                                    <div 
                                                                        className={`w-1 rounded-full bg-gradient-to-b ${colorScheme.from} ${colorScheme.to} opacity-50 group-hover:opacity-100 transition-opacity`}
                                                                        style={{ height: `${Math.max(16, (item.hours / maxHours) * 24)}px` }}
                                                                    />
                                                                    <span className="text-xs text-slate-600 group-hover:text-slate-800 transition-colors truncate max-w-[120px]" title={item.name}>
                                                                        {item.name}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="py-2.5 px-3 text-right">
                                                                <ClickableHoursCell 
                                                                    hours={item.hours} 
                                                                    dealName={item.name} 
                                                                    category={groupName} 
                                                                    filteredData={filteredData.filter(row => {
                                                                        const rawSourcePath = row['Source Path']?.toString();
                                                                        const sourcePath = rawSourcePath ? rawSourcePath.trim() : '';
                                                                        return sourcePath && sourcePath.endsWith(targetSuffix);
                                                                    })} 
                                                                    isGroup={true} 
                                                                />
                                                            </td>
                                                        </tr>
                                                    )) : (
                                                        <tr>
                                                            <td colSpan={2} className="text-center py-6 text-slate-300 text-xs">当期无数据</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                }}
            </FilterSection>

            {/* Comparison of Work Category by Deal/Matter Category */}
            <InvestmentWorkCategoryComparison teamData={teamData} />
        </div>
    );
}

const WorkCategoryComparisonChart = ({ data, workCategoryList, teamData }: { data: any[], workCategoryList: string[], teamData: any[] }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any[]>([]);
    const [dialogTitle, setDialogTitle] = useState('');

    // Premium color palette - high contrast colors (avoid similar blue/purple shades)
    const CATEGORY_COLORS = [
        '#3b82f6', // Blue - Drafting/reviewing
        '#10b981', // Emerald - Discussing with internal
        '#f59e0b', // Amber - Conducting legal analysis
        '#ef4444', // Red - Others
        '#8b5cf6', // Violet - Attending to international
        '#f97316', // Orange - Participating training sessions
        '#84cc16', // Lime - Participating in training
        '#e11d48', // Rose - Preparing internal know-how
        '#06b6d4', // Cyan - Negotiating/discussing (changed from purple)
        '#22c55e', // Green - Internal/cross-teams
        '#eab308', // Yellow - Preparing Internal memo (changed from blue)
        '#ec4899', // Pink
        '#14b8a6', // Teal
    ];

    const handleBarClick = (barData: any, dataKey: string) => {
        if (!barData || !barData.month) return;
        const monthStr = barData.month;
        const categoryName = dataKey;
        
        const details = teamData.filter(row => {
            if (!row || !row['Month'] || !row['Work Category']) return false;
            try {
                const rowDate = parse(row['Month'].toString(), 'yyyy/MM', new Date());
                const rowMonth = format(rowDate, 'yyyy/MM');
                const rawCat = row['Work Category']?.toString();
                if (!rawCat) return false;
                return rowMonth === monthStr && fieldsMatch(rawCat, categoryName);
            } catch { return false; }
        });
        
        setDialogTitle(`${categoryName} - ${monthStr}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    const handleLegendClick = (e: any) => {
        if (!e || !e.dataKey) return;
        const categoryName = e.dataKey;
        
        const details = teamData.filter(row => {
            if (!row || !row['Work Category']) return false;
            const rawCat = row['Work Category']?.toString();
            if (!rawCat) return false;
            return fieldsMatch(rawCat, categoryName);
        });
        
        setDialogTitle(`All records for ${categoryName}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    // Premium tooltip
    const PremiumCategoryTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;
        
        const total = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);
        
        return (
            <div className="bg-white/95 backdrop-blur-md border border-slate-200/60 rounded-xl shadow-xl p-4 min-w-[200px]">
                <div className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">
                    {label}
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <div 
                                    className="w-3 h-3 rounded-sm shadow-sm"
                                    style={{ backgroundColor: entry.color }}
                                />
                                <span className="text-xs text-slate-600 truncate max-w-[100px]">{entry.name}</span>
                            </div>
                            <span className="text-xs font-semibold text-slate-800">
                                {Number(entry.value).toFixed(1)}h
                            </span>
                        </div>
                    ))}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between">
                    <span className="text-xs font-medium text-slate-500">Total</span>
                    <span className="text-xs font-bold text-slate-800">{total.toFixed(1)}h</span>
                </div>
            </div>
        );
    };

    return (
        <>
            <Card className="border-slate-200/60 shadow-sm hover:shadow-md transition-shadow duration-300">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-slate-800">Comparison of Work Category</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="relative">
                        <div className="text-xs text-slate-400 mb-3 flex items-center gap-1.5">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                            Click on legend labels or bars to view detailed data
                        </div>
                        
                        {/* Custom Legend */}
                        <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
                            {workCategoryList?.map((category, index) => (
                                <div 
                                    key={category} 
                                    className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-slate-100 cursor-pointer transition-colors"
                                    onClick={() => handleLegendClick({ dataKey: category })}
                                >
                                    <div 
                                        className="w-3 h-3 rounded-sm"
                                        style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                                    />
                                    <span className="text-xs text-slate-600 hover:text-slate-800">{category}</span>
                                </div>
                            ))}
                        </div>
                        
                        <ResponsiveContainer width="100%" height={450}>
                            <BarChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                                <defs>
                                    {CATEGORY_COLORS.map((color, index) => (
                                        <linearGradient key={`catGrad${index}`} id={`catGradient${index}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={color} stopOpacity={0.9}/>
                                            <stop offset="100%" stopColor={color} stopOpacity={0.7}/>
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} vertical={false} />
                                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                                <YAxis label={{ value: '小时', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: '#64748b' } }} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                                <Tooltip content={<PremiumCategoryTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                                 {workCategoryList?.map((category, index) => (
                                    <Bar 
                                        key={category} 
                                        dataKey={category} 
                                        name={category} 
                                        fill={`url(#catGradient${index % CATEGORY_COLORS.length})`}
                                        onClick={(barData) => handleBarClick(barData, category)} 
                                        cursor="pointer"
                                        radius={[4, 4, 0, 0]}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
            <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} />
        </>
    );
};

const CorporateFinancePanel = ({ data }: { data: any[] }) => {
    // Pre-process data once: filter team and parse dates
    const teamData = useMemo(() => {
        return data
            .filter(row => row && row['团队'] === '公司及国际金融事务中心')
            .map(row => ({
                ...row,
                _parsedDate: row['Month'] ? parse(row['Month'].toString(), 'yyyy/MM', new Date()) : null
            }));
    }, [data]);

    const trendData = useMemo(() => {
        if (teamData.length === 0) return { monthlyTrends: [], virtualGroupTrendData: [], virtualGroupList: [], workCategoryTrendData: [], workCategoryList: [] };

         let overallMinDate: Date | null = null;
        let overallMaxDate: Date | null = null;

        teamData.forEach(row => {
             if (!row) return;
             // Use pre-parsed date
             const rowDate = row._parsedDate;
             if (!rowDate) return;
             if (!overallMinDate || rowDate < overallMinDate) overallMinDate = rowDate;
             if (!overallMaxDate || rowDate > overallMaxDate) overallMaxDate = rowDate;
        });

        const trendStartDate = overallMinDate ? startOfMonth(overallMinDate) : new Date();
        const trendEndDate = overallMaxDate ? endOfMonth(overallMaxDate) : new Date();
        const monthsInPeriod = eachMonthOfInterval({ start: trendStartDate, end: trendEndDate });

        // Monthly Trends
        const monthlyAgg: { [key: string]: { hours: number; users: Set<string> } } = {};
        monthsInPeriod.forEach(monthDate => monthlyAgg[format(monthDate, 'yyyy/MM')] = { hours: 0, users: new Set() });
        teamData.forEach(row => {
            if (!row || !row['Name']) return;
            // Use pre-parsed date
            const rowDate = row._parsedDate;
            if (!rowDate) return;
            const monthKey = format(rowDate, 'yyyy/MM');
            if (monthlyAgg.hasOwnProperty(monthKey)) {
                monthlyAgg[monthKey].hours += Number(row['Hours']) || 0;
                monthlyAgg[monthKey].users.add(row['Name'].toString().replace(/\\s+/g, ' ').trim());
            }
        });

        const monthlyTrends = Object.keys(monthlyAgg).sort().map(month => {
            const monthData = monthlyAgg[month];
            const date = parse(month, 'yyyy/MM', new Date());
            const workdays = getWorkdaysInMonth(date.getFullYear(), date.getMonth() + 1, 'HK');
            const timeCoefficient = workdays > 0 ? 20.83 / workdays : 0;
            const avgHours = monthData.users.size > 0 ? (monthData.hours / monthData.users.size) * timeCoefficient : 0;
            return { month, totalHours: monthData.hours, avgHoursPerUser: avgHours };
        }).map((current, index, array) => {
            const prevTotalHours = index > 0 ? array[index - 1].totalHours : 0;
            const prevAvgHours = index > 0 ? array[index - 1].avgHoursPerUser : 0;
            return {
                ...current,
                totalHoursTrend: prevTotalHours > 0 ? ((current.totalHours - prevTotalHours) / prevTotalHours) * 100 : 0,
                avgHoursTrend: prevAvgHours > 0 ? ((current.avgHoursPerUser - prevAvgHours) / prevAvgHours) * 100 : 0,
            };
        });

        // Virtual Group Trend - use case-insensitive matching
        const virtualGroupTrendAgg: { [key: string]: { [key: string]: number } } = {};
        const allVirtualGroups = new Set<string>();
        const allowedVirtualGroups = ['Group Financing', 'International Financial', 'Listing Rules and Corporate Governance', 'Others'];
        monthsInPeriod.forEach(monthDate => virtualGroupTrendAgg[format(monthDate, 'yyyy/MM')] = {});

        teamData.forEach(row => {
            if (!row || !row['Deal/Matter Category']) return;
            const rawGroup = row['Deal/Matter Category'].toString();
            // Find matching allowed group using case-insensitive comparison
            const allowedMatch = allowedVirtualGroups.find(allowed => fieldsMatch(allowed, rawGroup));
            if (allowedMatch) {
                 // Use pre-parsed date
                 const rowDate = row._parsedDate;
                 if (!rowDate) return;
                 const monthKey = format(rowDate, 'yyyy/MM');
                 if (virtualGroupTrendAgg[monthKey]) {
                    virtualGroupTrendAgg[monthKey][allowedMatch] = (virtualGroupTrendAgg[monthKey][allowedMatch] || 0) + (Number(row['Hours']) || 0);
                    allVirtualGroups.add(allowedMatch);
                 }
            }
        });
        const virtualGroupTrendData = Object.entries(virtualGroupTrendAgg).map(([month, groups]) => {
            const entry: any = { month };
            allVirtualGroups.forEach(group => entry[group] = groups[group] || 0);
            return entry;
        }).sort((a, b) => a.month.localeCompare(b.month));
        const virtualGroupList = Array.from(allVirtualGroups).sort();

        // Work Category Trend - use case-insensitive key for aggregation
        const workCategoryTrendAgg: { [key: string]: { [key: string]: number } } = {};
        const allWorkCategoriesMap: { [key: string]: string } = {};
        const categoryTotalHours: { [key: string]: number } = {};

        monthsInPeriod.forEach(monthDate => workCategoryTrendAgg[format(monthDate, 'yyyy/MM')] = {});

        teamData.forEach(row => {
            if (!row || !row['Work Category']) return;
            const rawCat = row['Work Category'].toString();
            const category = rawCat.trim().replace(/\\s+/g, ' ');
            const normalizedKey = createNormalizedKey(category);
            const hours = Number(row['Hours']) || 0;
            if (hours > 0) {
                // Use pre-parsed date
                const rowDate = row._parsedDate;
                if (!rowDate) return;
                const monthKey = format(rowDate, 'yyyy/MM');
                if (workCategoryTrendAgg[monthKey]) {
                    if (!allWorkCategoriesMap[normalizedKey]) allWorkCategoriesMap[normalizedKey] = category;
                    const displayName = allWorkCategoriesMap[normalizedKey];
                    workCategoryTrendAgg[monthKey][displayName] = (workCategoryTrendAgg[monthKey][displayName] || 0) + hours;
                    categoryTotalHours[displayName] = (categoryTotalHours[displayName] || 0) + hours;
                }
            }
        });

        const workCategoryTrendData = Object.entries(workCategoryTrendAgg).map(([month, cats]) => {
            const entry: any = { month };
            Object.values(allWorkCategoriesMap).forEach(cat => entry[cat] = cats[cat] || 0);
            return entry;
        }).sort((a, b) => a.month.localeCompare(b.month));
        
        const workCategoryList = Object.values(allWorkCategoriesMap).sort((a, b) => (categoryTotalHours[b] || 0) - (categoryTotalHours[a] || 0));

        return { monthlyTrends, virtualGroupTrendData, virtualGroupList, workCategoryTrendData, workCategoryList };
    }, [teamData]);

    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
                 <FilterSection data={teamData} title="Total Working Hours">
                    {(_, totalHours, trend) => (
                         <>
                            <div className="text-2xl font-bold">{totalHours?.toFixed(2) || '0.00'}h</div>
                            <p className="text-xs text-muted-foreground">在筛选期间的总工时</p>
                            {trend !== undefined && (
                                <p className={`text-xs font-medium mt-1 ${trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    环比: {trend >= 0 ? '+' : ''}{trend.toFixed(2)}%
                                </p>
                            )}
                         </>
                    )}
                </FilterSection>

                <FilterSection data={teamData} title="Working Hours (BSC vs Others)">
                    {(filteredData, totalHours) => {
                        const [isDialogOpen, setIsDialogOpen] = useState(false);
                        const [dialogData, setDialogData] = useState<any[]>([]);
                        const [dialogTitle, setDialogTitle] = useState('');

                        const bscHours: { [key: string]: { hours: number; name: string } } = {};
                        filteredData.forEach(row => {
                            const rawTag = row['OKR/BSC Tag']?.toString() || 'uncategoried';
                            const tag = rawTag.trim().replace(/\\s+/g, ' ');
                            const key = createNormalizedKey(tag);
                            const hours = Number(row['Hours']) || 0;
                            if (hours > 0) {
                                if (!bscHours[key]) bscHours[key] = { hours: 0, name: tag };
                                bscHours[key].hours += hours;
                            }
                        });
                        const bscData = Object.values(bscHours).map(({ name, hours }) => ({
                            name,
                            value: hours,
                            percentage: totalHours > 0 ? (hours / totalHours) * 100 : 0
                        })).sort((a, b) => b.value - a.value);

                        const handlePieClick = (data: any) => {
                            if (!data || !data.name) return;
                            const bscName = data.name;
                            const details = filteredData.filter(row => {
                                const rawTag = row['OKR/BSC Tag']?.toString() || 'uncategoried';
                                return fieldsMatch(rawTag, bscName);
                            });
                            setDialogTitle(`Details for ${bscName}`);
                            setDialogData(details);
                            setIsDialogOpen(true);
                        };

                        const handleLegendClick = (e: any) => {
                            if (!e || !e.value) return;
                            const bscName = e.value;
                            const details = filteredData.filter(row => {
                                const rawTag = row['OKR/BSC Tag']?.toString() || 'uncategoried';
                                return fieldsMatch(rawTag, bscName);
                            });
                            setDialogTitle(`All records for ${bscName}`);
                            setDialogData(details);
                            setIsDialogOpen(true);
                        };

                        // Premium color palette for BSC categories - high contrast
                        const BSC_COLORS2 = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#ec4899', '#84cc16', '#f97316'];

                        return (
                            <div className="relative">
                                {bscData.length > 0 ? (
                                    <>
                                        <div className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
                                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                                            Click on slices or legend to view details
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <ResponsiveContainer width="55%" height={180}>
                                                <PieChart>
                                                    <defs>
                                                        {BSC_COLORS2.map((color, index) => (
                                                            <linearGradient key={`gradient-bsc2-${index}`} id={`pieGradientBSC2${index}`} x1="0" y1="0" x2="1" y2="1">
                                                                <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                                                                <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                                                            </linearGradient>
                                                        ))}
                                                        <filter id="pieShadowBSC2" x="-20%" y="-20%" width="140%" height="140%">
                                                            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
                                                        </filter>
                                                    </defs>
                                                    <Pie 
                                                        data={bscData} 
                                                        cx="50%" 
                                                        cy="50%" 
                                                        labelLine={false}
                                                        innerRadius={35}
                                                        outerRadius={70}
                                                        paddingAngle={2}
                                                        dataKey="value" 
                                                        onClick={handlePieClick} 
                                                        cursor="pointer"
                                                        animationBegin={0}
                                                        animationDuration={800}
                                                        animationEasing="ease-out"
                                                    >
                                                        {bscData.map((_entry, index) => (
                                                            <Cell 
                                                                key={`cell-${index}`} 
                                                                fill={`url(#pieGradientBSC2${index % BSC_COLORS2.length})`}
                                                                stroke="#fff"
                                                                strokeWidth={2}
                                                                filter="url(#pieShadowBSC2)"
                                                            />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip 
                                                        formatter={(value:number, _name, entry) => [
                                                            `${value.toFixed(1)}h (${(entry.payload as any).percentage.toFixed(1)}%)`, 
                                                            ''
                                                        ]}
                                                        contentStyle={{
                                                            backgroundColor: 'rgba(255,255,255,0.98)',
                                                            border: 'none',
                                                            borderRadius: '10px',
                                                            boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                                                            padding: '10px 14px'
                                                        }}
                                                        labelStyle={{ fontWeight: 600, color: '#1e293b' }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            {/* Custom Legend */}
                                            <div className="flex-1 space-y-1.5 max-h-[180px] overflow-y-auto pr-2">
                                                {bscData.slice(0, 6).map((entry, index) => (
                                                    <div 
                                                        key={entry.name}
                                                        className="flex items-center gap-2 p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors group"
                                                        onClick={() => handleLegendClick({ value: entry.name })}
                                                    >
                                                        <div 
                                                            className="w-3 h-3 rounded-sm flex-shrink-0 group-hover:scale-110 transition-transform"
                                                            style={{ backgroundColor: BSC_COLORS2[index % BSC_COLORS2.length] }}
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                                                                {entry.name}
                                                            </div>
                                                            <div className="text-[10px] text-slate-500">
                                                                {entry.value.toFixed(0)}h · {entry.percentage.toFixed(1)}%
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {bscData.length > 6 && (
                                                    <div className="text-[10px] text-slate-400 pl-5">+{bscData.length - 6} more...</div>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                ) : <div className="h-full flex items-center justify-center text-muted-foreground"><p>当期无BSC分类数据</p></div>}
                                <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} />
                            </div>
                        );
                    }}
                </FilterSection>
            </div>

            {/* Trend Charts - No Filter */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle className="text-sm font-medium">Comparison of Total Working Hours</CardTitle></CardHeader>
                    <CardContent className="pt-8">
                        <ResponsiveContainer width="100%" height={300}>
                            <ComposedChart data={trendData.monthlyTrends} margin={{ left: 0, right: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                <YAxis yAxisId="left" label={{ value: '小时', angle: -90, position: 'left', offset: 0 }} tick={{ fontSize: 12 }} />
                                <YAxis yAxisId="right" orientation="right" label={{ value: '%', angle: -90, position: 'right', offset: 0 }} tick={{ fontSize: 12 }}/>
                                <Tooltip formatter={(value: number) => Number(value).toFixed(2)} />
                                <Legend iconType="rect" />
                                <Bar yAxisId="left" dataKey="totalHours" name="总用时" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                                <Line yAxisId="right" type="monotone" dataKey="totalHoursTrend" name="环比 (%)" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: "#10b981" }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-sm font-medium">Comparison of Monthly Avg Working Hours per person</CardTitle></CardHeader>
                    <CardContent className="pt-8">
                         <ResponsiveContainer width="100%" height={300}>
                            <ComposedChart data={trendData.monthlyTrends} margin={{ left: 0, right: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                <YAxis yAxisId="left" label={{ value: '小时', angle: -90, position: 'left', offset: 0 }} tick={{ fontSize: 12 }} />
                                <YAxis yAxisId="right" orientation="right" label={{ value: '%', angle: -90, position: 'right', offset: 0 }} tick={{ fontSize: 12 }}/>
                                <Tooltip formatter={(value: number) => Number(value).toFixed(2)} />
                                <Legend iconType="rect" />
                                <Bar yAxisId="left" dataKey="avgHoursPerUser" name="人均用时" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                                <Line yAxisId="right" type="monotone" dataKey="avgHoursTrend" name="环比 (%)" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: "#f59e0b" }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                 <FilterSection data={teamData} title="Working Hours (Virtual Group Hours)">
                    {(filteredData, totalHours) => {
                        const [isDialogOpen, setIsDialogOpen] = useState(false);
                        const [dialogData, setDialogData] = useState<any[]>([]);
                        const [dialogTitle, setDialogTitle] = useState('');

                        const allowedVirtualGroups = ['Group Financing', 'International Financial', 'Listing Rules and Corporate Governance', 'Others'];
                        const virtualGroupHours: { [key: string]: { hours: number, name: string } } = {};
                        filteredData.forEach(row => {
                             const rawGroup = row['Deal/Matter Category']?.toString();
                             const hours = Number(row['Hours']) || 0;
                             // Use fieldsMatch for case-insensitive comparison
                             const allowedMatch = allowedVirtualGroups.find(allowed => fieldsMatch(allowed, rawGroup));
                             if (rawGroup && hours > 0 && allowedMatch) {
                                 const key = allowedMatch; 
                                 if (!virtualGroupHours[key]) virtualGroupHours[key] = { hours: 0, name: allowedMatch };
                                 virtualGroupHours[key].hours += hours;
                             }
                        });
                        const virtualGroupPieData = Object.values(virtualGroupHours).map(({ name, hours }) => ({
                            name,
                            value: hours,
                            percentage: totalHours > 0 ? (hours / totalHours) * 100 : 0
                        })).sort((a, b) => b.value - a.value);

                        const handlePieClick = (data: any) => {
                            if (!data || !data.name) return;
                            const groupName = data.name;
                            const details = filteredData.filter(row => {
                                const rawGroup = row['Deal/Matter Category']?.toString();
                                const matchedGroup = allowedVirtualGroups.find(allowed => fieldsMatch(allowed, rawGroup));
                                return matchedGroup === groupName;
                            });
                            setDialogTitle(`Details for ${groupName}`);
                            setDialogData(details);
                            setIsDialogOpen(true);
                        };

                        const handleLegendClick = (e: any) => {
                            if (!e || !e.value) return;
                            const groupName = e.value;
                            const details = filteredData.filter(row => {
                                const rawGroup = row['Deal/Matter Category']?.toString();
                                const matchedGroup = allowedVirtualGroups.find(allowed => fieldsMatch(allowed, rawGroup));
                                return matchedGroup === groupName;
                            });
                            setDialogTitle(`All records for ${groupName}`);
                            setDialogData(details);
                            setIsDialogOpen(true);
                        };

                        // Premium color palette for virtual groups - high contrast
                        const VG_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#84cc16'];

                        return (
                            <div className="relative">
                                {virtualGroupPieData.length > 0 ? (
                                    <>
                                        <div className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
                                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                                            Click on slices or legend to view details
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <ResponsiveContainer width="55%" height={220}>
                                                <PieChart>
                                                    <defs>
                                                        {VG_COLORS.map((color, index) => (
                                                            <linearGradient key={`gradient-vg-${index}`} id={`pieGradientVG${index}`} x1="0" y1="0" x2="1" y2="1">
                                                                <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                                                                <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                                                            </linearGradient>
                                                        ))}
                                                        <filter id="pieShadowVG" x="-20%" y="-20%" width="140%" height="140%">
                                                            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
                                                        </filter>
                                                    </defs>
                                                    <Pie 
                                                        data={virtualGroupPieData} 
                                                        cx="50%" 
                                                        cy="50%" 
                                                        labelLine={false}
                                                        innerRadius={40}
                                                        outerRadius={80}
                                                        paddingAngle={3}
                                                        dataKey="value" 
                                                        onClick={handlePieClick} 
                                                        cursor="pointer"
                                                        animationBegin={0}
                                                        animationDuration={800}
                                                        animationEasing="ease-out"
                                                    >
                                                        {virtualGroupPieData.map((_entry, index) => (
                                                            <Cell 
                                                                key={`cell-${index}`} 
                                                                fill={`url(#pieGradientVG${index % VG_COLORS.length})`}
                                                                stroke="#fff"
                                                                strokeWidth={2}
                                                                filter="url(#pieShadowVG)"
                                                            />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip 
                                                        formatter={(value:number, _name, entry) => [
                                                            `${value.toFixed(1)}h (${(entry.payload as any).percentage.toFixed(1)}%)`, 
                                                            ''
                                                        ]}
                                                        contentStyle={{
                                                            backgroundColor: 'rgba(255,255,255,0.98)',
                                                            border: 'none',
                                                            borderRadius: '10px',
                                                            boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                                                            padding: '10px 14px'
                                                        }}
                                                        labelStyle={{ fontWeight: 600, color: '#1e293b' }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            {/* Custom Legend */}
                                            <div className="flex-1 space-y-2">
                                                {virtualGroupPieData.map((entry, index) => (
                                                    <div 
                                                        key={entry.name}
                                                        className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all group border border-transparent hover:border-slate-200"
                                                        onClick={() => handleLegendClick({ value: entry.name })}
                                                    >
                                                        <div 
                                                            className="w-3.5 h-3.5 rounded-md flex-shrink-0 group-hover:scale-110 transition-transform shadow-sm"
                                                            style={{ backgroundColor: VG_COLORS[index % VG_COLORS.length] }}
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                                                                {entry.name}
                                                            </div>
                                                        </div>
                                                        <div className="text-right flex-shrink-0">
                                                            <div className="text-xs font-bold" style={{ color: VG_COLORS[index % VG_COLORS.length] }}>
                                                                {entry.value.toFixed(0)}h
                                                            </div>
                                                            <div className="text-[10px] text-slate-500">
                                                                {entry.percentage.toFixed(1)}%
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                ) : <div className="h-full flex items-center justify-center text-muted-foreground"><p>当期无虚拟组数据</p></div>}
                                <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} />
                            </div>
                        );
                    }}
                </FilterSection>

                {/* Virtual Group Comparison - Trend - No Filter */}
                <Card>
                    <CardHeader><CardTitle className="text-sm font-medium">Comparison of Virtual Groups</CardTitle></CardHeader>
                    <CardContent className="pt-16 pb-12">
                        <VirtualGroupTrendChart data={trendData.virtualGroupTrendData} teamData={teamData} groupList={trendData.virtualGroupList || []} />
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 grid-cols-1">
                 <FilterSection data={teamData} title="Working Hours (Internal Client)">
                    {(filteredData) => {
                        const [isDialogOpen, setIsDialogOpen] = useState(false);
                        const [dialogData, setDialogData] = useState<any[]>([]);
                        const [dialogTitle, setDialogTitle] = useState('');

                        const internalClientAgg: { [key: string]: { hours: number, displayName: string } } = {};
                        filteredData.forEach(row => {
                            const rawName = row['Deal/Matter Name']?.toString();
                            if (!rawName) return;
                            const cleanName = rawName.trim().replace(/\\s+/g, ' ');
                            if (!cleanName || normalizeField(cleanName) === 'group matter') return;
                            const normalizedKey = createNormalizedKey(cleanName);
                            const hours = Number(row['Hours']) || 0;
                            if (hours > 0) {
                                if (!internalClientAgg[normalizedKey]) internalClientAgg[normalizedKey] = { hours: 0, displayName: cleanName };
                                internalClientAgg[normalizedKey].hours += hours;
                            }
                        });
                        const internalClientData = Object.values(internalClientAgg).map(item => ({ name: item.displayName, hours: item.hours })).sort((a, b) => b.hours - a.hours);
                        
                        const handleBarClick = (data: any) => {
                            if (!data || !data.name) return;
                            const clientName = data.name;
                            const details = filteredData.filter(row => {
                                const rawName = row['Deal/Matter Name']?.toString();
                                if (!rawName) return false;
                                return fieldsMatch(rawName, clientName);
                            });
                            setDialogTitle(`Details for ${clientName}`);
                            setDialogData(details);
                            setIsDialogOpen(true);
                        };

                        const handleLegendClick = (e: any) => {
                            if (!e || !e.dataKey) return;
                            const details = filteredData.filter(row => {
                                const rawName = row['Deal/Matter Name']?.toString();
                                if (!rawName) return false;
                                return rawName.trim() && normalizeField(rawName) !== 'group matter';
                            });
                            setDialogTitle('All Internal Clients');
                            setDialogData(details);
                            setIsDialogOpen(true);
                        };

                        return (
                            <div className="relative">
                                <div className="text-xs text-slate-400 mb-3 flex items-center gap-1.5">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                    Click on bars to view detailed data
                                </div>
                                <ResponsiveContainer width="100%" height={450}>
                                    <BarChart data={internalClientData} margin={{ left: 10, right: 30, bottom: 80, top: 10 }}>
                                        <defs>
                                            <linearGradient id="internalClientGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9}/>
                                                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.7}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} vertical={false} />
                                        <XAxis dataKey="name" interval={0} angle={-45} textAnchor="end" height={80} tick={{fontSize: 11, fill: '#64748b'}} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                                        <Tooltip 
                                            formatter={(value: number) => [`${Number(value).toFixed(2)}h`, 'Hours']}
                                            contentStyle={{
                                                backgroundColor: 'rgba(255,255,255,0.95)',
                                                border: 'none',
                                                borderRadius: '10px',
                                                boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                                                padding: '10px 14px'
                                            }}
                                            cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                                        />
                                        <Bar dataKey="hours" name="Hours" fill="url(#internalClientGrad)" onClick={handleBarClick} cursor="pointer" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                                <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} />
                            </div>
                        );
                    }}
                </FilterSection>

                 <FilterSection data={teamData} title="Working Hours (Work Category)">
                    {(filteredData) => {
                        const [isDialogOpen, setIsDialogOpen] = useState(false);
                        const [dialogData, setDialogData] = useState<any[]>([]);
                        const [dialogTitle, setDialogTitle] = useState('');

                        const workCategoryAgg: { [key: string]: { hours: number, displayName: string } } = {};
                        filteredData.forEach(row => {
                            const rawCat = row['Work Category']?.toString();
                            if (!rawCat) return;
                            const category = rawCat.trim().replace(/\\s+/g, ' ');
                            const normalizedKey = createNormalizedKey(category);
                            const hours = Number(row['Hours']) || 0;
                            if (hours > 0) {
                                if (!workCategoryAgg[normalizedKey]) workCategoryAgg[normalizedKey] = { hours: 0, displayName: category };
                                workCategoryAgg[normalizedKey].hours += hours;
                            }
                        });
                        const workCategoryData = Object.values(workCategoryAgg).map(item => ({ name: item.displayName, hours: item.hours })).sort((a, b) => b.hours - a.hours);
                        const maxHours = workCategoryData.length > 0 ? Math.max(...workCategoryData.map(d => d.hours)) : 0;

                        const handleBarClick = (data: any) => {
                            if (!data || !data.name) return;
                            const categoryName = data.name;
                            const details = filteredData.filter(row => {
                                const rawCat = row['Work Category']?.toString();
                                if (!rawCat) return false;
                                return fieldsMatch(rawCat, categoryName);
                            });
                            setDialogTitle(`Details for ${categoryName}`);
                            setDialogData(details);
                            setIsDialogOpen(true);
                        };

                        const handleLegendClick = (e: any) => {
                            if (!e || !e.dataKey) return;
                            const details = filteredData.filter(row => {
                                const rawCat = row['Work Category']?.toString();
                                return rawCat && rawCat.trim();
                            });
                            setDialogTitle('All Work Categories');
                            setDialogData(details);
                            setIsDialogOpen(true);
                        };

                        return (
                            <div className="relative">
                                <div className="text-xs text-slate-400 mb-3 flex items-center gap-1.5">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Click on bars to view detailed data
                                </div>
                                <ResponsiveContainer width="100%" height={450}>
                                    <BarChart data={workCategoryData} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
                                        <defs>
                                            <linearGradient id="workCategoryGrad" x1="0" y1="0" x2="1" y2="0">
                                                <stop offset="0%" stopColor="#10b981" stopOpacity={0.9}/>
                                                <stop offset="100%" stopColor="#10b981" stopOpacity={0.7}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} horizontal={true} vertical={false} />
                                        <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                                        <YAxis dataKey="name" type="category" width={350} tick={{fontSize: 11, fill: '#475569'}} interval={0} axisLine={false} tickLine={false} />
                                        <Tooltip 
                                            formatter={(value: number) => [`${Number(value).toFixed(2)}h`, 'Hours']}
                                            contentStyle={{
                                                backgroundColor: 'rgba(255,255,255,0.95)',
                                                border: 'none',
                                                borderRadius: '10px',
                                                boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                                                padding: '10px 14px'
                                            }}
                                            cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }}
                                        />
                                        <Bar dataKey="hours" name="Hours" fill="url(#workCategoryGrad)" onClick={handleBarClick} cursor="pointer" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                                <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} />
                            </div>
                        );
                    }}
                </FilterSection>
            </div>

            {/* Work Category Comparison - Trend - No Filter */}
            <WorkCategoryComparisonChart data={trendData.workCategoryTrendData} workCategoryList={trendData.workCategoryList || []} teamData={teamData} />
        </div>
    );
}

export function TeamDimensionTab({ data }: { data: any[] }) {
  const [activeSubTab, setActiveSubTab] = useState<string>('investment-legal');
  const [isReady, setIsReady] = useState(false);
  
  // Use setTimeout(0) to yield to the browser and let UI update first
  useEffect(() => {
    setIsReady(false);
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className="space-y-6 py-2 bg-transparent min-h-screen">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="space-y-6">
        <div className="bg-slate-50/95 backdrop-blur supports-[backdrop-filter]:bg-slate-50/60 border-b border-slate-200/60 -mx-6 px-6 pt-2 pb-0">
          <TabsList className="flex h-auto items-center justify-start gap-2 bg-transparent p-0 w-full">
            <TabsTrigger 
              value="investment-legal"
              className="relative h-9 rounded-md border-0 bg-transparent px-4 py-2 font-normal text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 data-[state=active]:shadow-none text-sm"
            >
              投资法务中心
            </TabsTrigger>
            <TabsTrigger 
              value="corporate-finance"
              className="relative h-9 rounded-md border-0 bg-transparent px-4 py-2 font-normal text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 data-[state=active]:shadow-none text-sm"
            >
              公司及国际金融事务中心
            </TabsTrigger>
          </TabsList>
        </div>
        
        <div className="container mx-auto max-w-7xl">
          {!isReady ? (
            <div className="space-y-4 mt-6 animate-pulse">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="h-48 bg-slate-100 rounded-lg"></div>
                <div className="h-48 bg-slate-100 rounded-lg"></div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="h-80 bg-slate-100 rounded-lg"></div>
                <div className="h-80 bg-slate-100 rounded-lg"></div>
              </div>
            </div>
          ) : (
            <>
              <TabsContent value="investment-legal" className="mt-6 space-y-6 focus-visible:outline-none animate-in fade-in-50 duration-300">
                {activeSubTab === 'investment-legal' && <InvestmentLegalCenterPanel data={data} />}
              </TabsContent>
              <TabsContent value="corporate-finance" className="mt-6 space-y-6 focus-visible:outline-none animate-in fade-in-50 duration-300">
                {activeSubTab === 'corporate-finance' && <CorporateFinancePanel data={data} />}
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}
