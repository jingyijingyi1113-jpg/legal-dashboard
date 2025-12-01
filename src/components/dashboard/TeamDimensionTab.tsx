
import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonthPicker } from './MonthPicker';
import { getWorkdaysInMonth } from '@/lib/date-utils';
import { ComposedChart, Line, Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
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
    if (!isOpen) return null;

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
             if(row) Object.keys(row).forEach(k => keys.add(k));
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
                    <h3 className="text-lg font-semibold">{title}</h3>
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
                                   <TableHead key={key} className="whitespace-nowrap px-4 py-3 font-bold text-slate-900 dark:text-slate-100 border-b border-r last:border-r-0 bg-slate-100 dark:bg-slate-800" style={{ backgroundColor: '#f1f5f9' }}>
                                       {key}
                                   </TableHead>
                               ))}
                           </TableRow>
                       </TableHeader>
                       <TableBody className="bg-white" style={{ backgroundColor: '#ffffff' }}>
                           {data.length > 0 ? data.map((row, i) => (
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
                    className="p-4 border-t bg-slate-50 dark:bg-slate-800 flex justify-end shrink-0"
                    style={{ backgroundColor: '#f8fafc' }}
                >
                    <div className="text-sm text-muted-foreground font-medium">
                        Total Records: {data.length} | Total Hours: {data.reduce((acc, r) => acc + (Number(r.Hours) || 0), 0).toFixed(2)}
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
            const key = tag.toUpperCase();
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
            const tag = rawTag.trim().replace(/\s+/g, ' ');
            return tag === categoryName;
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
            const tag = rawTag.trim().replace(/\s+/g, ' ');
            return tag === categoryName;
        });
        setDialogTitle(`All records for ${categoryName}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    if (bscData.length === 0) {
        return <div className="h-full flex items-center justify-center text-muted-foreground"><p>当期无BSC分类数据</p></div>;
    }

    return (
        <>
            <div className="text-sm text-muted-foreground mb-2">💡 Tip: Click on legend labels or pie slices to view data</div>
            <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                    <Pie 
                        data={bscData} 
                        cx="50%" 
                        cy="50%" 
                        labelLine={false} 
                        label={<CustomPieLabel />} 
                        outerRadius={60} 
                        fill="#8884d8" 
                        dataKey="value"
                        onClick={handlePieClick}
                        cursor="pointer"
                    >
                        {bscData.map((_entry, index) => (<Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'][index % 6]} />))}
                    </Pie>
                    <Tooltip formatter={(value: number, _name: any, entry: any) => [`${value.toFixed(2)}h (${(entry.payload as any).percentage.toFixed(2)}%)`, (entry.payload as any).name]} />
                    <Legend iconType="rect" wrapperStyle={{ cursor: 'pointer' }} onClick={handleLegendClick} />
                </PieChart>
            </ResponsiveContainer>
            <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} />
        </>
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
            const key = category.toUpperCase();
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
            return category === categoryName;
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
            return category === categoryName;
        });
        setDialogTitle(`All records for ${categoryName}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    if (dealCategoryAllocation.length === 0) {
        return <div className="h-full flex items-center justify-center text-muted-foreground"><p>当期无数据</p></div>;
    }

    return (
        <>
            <div className="flex flex-col items-center justify-center gap-4">
                <div className="text-sm text-muted-foreground">💡 Tip: Click on legend labels or pie slices to view data</div>
                <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                        <Pie
                            data={dealCategoryAllocation}
                            cx="50%"
                            cy="35%"
                            labelLine={false}
                            label={<CustomPieLabel />}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            onClick={handlePieClick}
                            cursor="pointer"
                        >
                            {dealCategoryAllocation.map((_entry, index) => (
                                <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'][index % 6]} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(value: number, _name: any, entry: any) => [`${value.toFixed(2)}h (${(entry.payload as any).percentage.toFixed(2)}%)`, (entry.payload as any).name]} />
                        <Legend 
                            iconType="rect" 
                            verticalAlign="bottom" 
                            height={80} 
                            wrapperStyle={{ paddingTop: '20px', cursor: 'pointer' }}
                            onClick={handleLegendClick}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} />
        </>
    );
};

const UtilizationTrendChart = ({ data, teamData }: { data: any[], teamData: any[] }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any[]>([]);
    const [dialogTitle, setDialogTitle] = useState('');

    const handleDotClick = (entry: any, dataKey: string) => {
        if (!entry || !entry.month) return;
        
        const monthStr = entry.month;
        const categoryName = dataKey;
        
        // Filter data for this month and category
        const details = teamData.filter(row => {
            if (!row || !row['Month'] || !row['Deal/Matter Category']) return false;
            const rowMonth = format(parse(row['Month'].toString(), 'yyyy/MM', new Date()), 'yyyy/MM');
            const rowCategory = row['Deal/Matter Category']?.toString().replace(/\s+/g, ' ').trim();
            return rowMonth === monthStr && rowCategory === categoryName;
        });
        
        setDialogTitle(`${categoryName} - ${monthStr}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    const CustomDot = (props: any) => {
        const { cx, cy, fill, dataKey } = props;
        if (!cx || !cy) return null;
        
        return (
            <circle 
                cx={cx} 
                cy={cy} 
                r={5} 
                fill={fill} 
                stroke="white"
                strokeWidth={2}
                cursor="pointer"
                onClick={() => handleDotClick(props.payload, dataKey)}
            />
        );
    };

    return (
        <>
            <ResponsiveContainer width="100%" height={310}>
                <ComposedChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis label={{ value: '小时', angle: -90, position: 'insideLeft', offset: 10 }} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => Number(value).toFixed(2)} />
                    <Legend iconType="rect" />
                    <Line type="monotone" dataKey="Investment Related - IPO" name="IPO" stroke="#8884d8" dot={(props) => <CustomDot {...props} dataKey="Investment Related - IPO" />} />
                    <Line type="monotone" dataKey="Investment Related - Corporate Matter" name="Corporate Matter" stroke="#82ca9d" dot={(props) => <CustomDot {...props} dataKey="Investment Related - Corporate Matter" />} />
                    <Line type="monotone" dataKey="Investment Related - M&A Deal" name="M&A Deal" stroke="#ffc658" dot={(props) => <CustomDot {...props} dataKey="Investment Related - M&A Deal" />} />
                </ComposedChart>
            </ResponsiveContainer>
            <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} />
        </>
    );
};

const VirtualGroupTrendChart = ({ data, teamData, groupList }: { data: any[], teamData: any[], groupList: string[] }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any[]>([]);
    const [dialogTitle, setDialogTitle] = useState('');

    const handleDotClick = (entry: any, dataKey: string) => {
        if (!entry || !entry.month) return;
        
        const monthStr = entry.month;
        const groupName = dataKey;
        
        // Filter data for this month and group
        const details = teamData.filter(row => {
            if (!row || !row['Month'] || !row['Deal/Matter Category']) return false;
            const rowMonth = format(parse(row['Month'].toString(), 'yyyy/MM', new Date()), 'yyyy/MM');
            const rowGroup = row['Deal/Matter Category']?.toString().replace(/\s+/g, ' ').trim();
            const allowedMatch = ['Group Financing', 'International Financial', 'Listing Rules and Corporate Governance', 'Others'].find(allowed => allowed.toLowerCase() === rowGroup.toLowerCase());
            return rowMonth === monthStr && allowedMatch === groupName;
        });
        
        setDialogTitle(`${groupName} - ${monthStr}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    const CustomDot = (props: any) => {
        const { cx, cy, fill, dataKey } = props;
        if (!cx || !cy) return null;
        
        return (
            <circle 
                cx={cx} 
                cy={cy} 
                r={5} 
                fill={fill} 
                stroke="white"
                strokeWidth={2}
                cursor="pointer"
                onClick={() => handleDotClick(props.payload, dataKey)}
            />
        );
    };

    const colors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

    return (
        <>
            <ResponsiveContainer width="100%" height={310}>
                <ComposedChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis label={{ value: '小时', angle: -90, position: 'insideLeft', offset: 10 }} tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="rect" wrapperStyle={{ paddingTop: '90px' }} />
                    {groupList?.map((group, index) => (
                        <Line 
                            key={group} 
                            type="monotone" 
                            dataKey={group} 
                            name={group} 
                            stroke={colors[index % colors.length]}
                            dot={(props) => <CustomDot {...props} dataKey={group} />}
                        />
                    ))}
                </ComposedChart>
            </ResponsiveContainer>
            <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} />
        </>
    );
};

const VirtualGroupHoursChart = ({ filteredData }: { filteredData: any[] }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any[]>([]);
    const [dialogTitle, setDialogTitle] = useState('');

    const virtualGroupData: { [key: string]: { [key: string]: number } } = {};
    const virtualGroupCategories = new Set<string>();
    const normalizedCategoriesMap: { [key: string]: string } = {};
    
    filteredData.forEach(row => {
        const rawSourcePath = row['Source Path']?.toString();
        const sourcePath = rawSourcePath ? rawSourcePath.replace(/\\s+/g, ' ').trim() : '';
        const rawCategory = row['Deal/Matter Category']?.toString().replace(/\\s+/g, ' ').trim();
        const hours = Number(row['Hours']) || 0;

        if (sourcePath && rawCategory && hours > 0) {
            const categoryKey = rawCategory.toUpperCase();
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
            const rawCategory = row['Deal/Matter Category']?.toString().replace(/\\s+/g, ' ').trim();
            return rowSourcePath === sourcePath && rawCategory === category;
        });
        setDialogTitle(`${sourcePath} - ${category}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    const handleTooltipItemClick = (category: string, sourcePath: string) => {
        const details = filteredData.filter(row => {
            const rawSourcePath = row['Source Path']?.toString();
            const rowSourcePath = rawSourcePath ? rawSourcePath.replace(/\\s+/g, ' ').trim() : '';
            const rawCategory = row['Deal/Matter Category']?.toString().replace(/\\s+/g, ' ').trim();
            return rowSourcePath === sourcePath && rawCategory === category;
        });
        setDialogTitle(`${sourcePath} - ${category}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    const handleLegendClick = (e: any) => {
        if (!e || !e.dataKey) return;
        const categoryName = e.dataKey;
        const details = filteredData.filter(row => {
            const rawCategory = row['Deal/Matter Category']?.toString().replace(/\\s+/g, ' ').trim();
            return rawCategory === categoryName;
        });
        setDialogTitle(`All records for ${categoryName}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    return (
        <>
            <div className="text-sm text-muted-foreground mb-2">💡 Tip: Click on legend labels or bars to view data</div>
            <ResponsiveContainer width="100%" height={500}>
                <BarChart layout="vertical" data={virtualGroupChartData} margin={{ top: 20, right: 30, left: 100, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={150} tick={{fontSize: 12}} />
                    <Tooltip content={<CustomTooltip onItemClick={handleTooltipItemClick} />} />
                    <Legend iconType="rect" wrapperStyle={{ cursor: 'pointer' }} onClick={handleLegendClick} />
                    {virtualGroupCategoryList.map((category, index) => (
                        <Bar key={category} dataKey={category} stackId="a" fill={['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'][index % 8]} onClick={(data) => handleBarClick(data, category)} cursor="pointer" />
                    ))}
                </BarChart>
            </ResponsiveContainer>
            <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} />
        </>
    );
};

const AverageMonthlyHourPerPersonChart = ({ teamData }: { teamData: any[] }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any[]>([]);
    const [dialogTitle, setDialogTitle] = useState('');

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

    return (
        <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Average Monthly Hour Per Person - Each Virtual Group</CardTitle></CardHeader>
            <CardContent>
                <div>
                    <ResponsiveContainer width="100%" height={400}>
                         <BarChart data={avgMonthlyHoursPerGroup} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip formatter={(value: number) => Number(value).toFixed(2)} />
                            <Legend iconType="rect" />
                            {sourcePathList.map((sourcePath, index) => (
                                <Bar key={sourcePath} dataKey={sourcePath} name={sourcePath} fill={['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F'][index % 6]} onClick={(data) => handleBarClick(data, sourcePath)} cursor="pointer" />
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
    children: (filteredData: any[], totalHours: number) => React.ReactNode,
    className?: string
}) => {
    const [period, setPeriod] = useState<Period>('monthly');
    const [selectedYear, setSelectedYear] = useState<string | null>(null);
    const [selectedPeriodValue, setSelectedPeriodValue] = useState<string | null>(null);
    const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
    const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);

    const availableYears = useMemo(() => {
        const validData = data.filter(row => row && row['Month']);
        if (!validData || validData.length === 0) return [];
        const years = [...new Set(validData.map(row => parse(row['Month'].toString(), 'yyyy/MM', new Date()).getFullYear()))].filter(year => !isNaN(year));
        return years.sort((a, b) => b - a).map(y => y.toString());
    }, [data]);

    useEffect(() => {
        if (availableYears.length > 0 && !selectedYear) {
            setSelectedYear(availableYears[0]);
        }
        if (period === 'monthly' && !selectedPeriodValue && data.length > 0) {
            const latestMonth = data.reduce((latest, row) => {
                try {
                    const d = parse(row.Month.toString(), 'yyyy/MM', new Date());
                    return d > latest ? d : latest;
                } catch { return latest; }
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
                 try {
                    const d = parse(row.Month.toString(), 'yyyy/MM', new Date());
                    return d > latest ? d : latest;
                } catch { return latest; }
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
            if (!row || !row['Month']) return false;
            try {
                const rowDate = parse(row['Month'].toString(), 'yyyy/MM', new Date());
                return rowDate >= cardStartDate! && rowDate <= cardEndDate!;
            } catch { return false; }
        });

        const totalHours = filteredData.reduce((acc, row) => acc + (Number(row['Hours']) || 0), 0);

        return { filteredData, totalHours };
    }, [data, period, selectedYear, selectedPeriodValue, customStartDate, customEndDate]);

    return (
        <Card className={`${className} border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-200`}>
            <CardHeader className="pb-4">
                <div className="flex flex-col space-y-4 xl:flex-row xl:items-center xl:justify-between xl:space-y-0">
                    {title && <CardTitle className="text-sm font-medium">{title}</CardTitle>}
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
                {children(filteredInfo.filteredData, filteredInfo.totalHours)}
            </CardContent>
        </Card>
    );
};

const InvestmentLegalCenterPanel = ({ data }: { data: any[] }) => {
    const teamData = useMemo(() => data.filter(row => row && row['团队'] === '投资法务中心'), [data]);

    // Global Data for Trends (Full History)
    const trendData = useMemo(() => {
        if (teamData.length === 0) return { monthlyTrends: [], utilizationTrends: [] };

        let overallMinDate: Date | null = null;
        let overallMaxDate: Date | null = null;

        teamData.forEach(row => {
             if (!row || !row['Month']) return;
             try {
                const rowDate = parse(row['Month'].toString(), 'yyyy/MM', new Date());
                if (!overallMinDate || rowDate < overallMinDate) overallMinDate = rowDate;
                if (!overallMaxDate || rowDate > overallMaxDate) overallMaxDate = rowDate;
             } catch {}
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
            if (!row || !row['Month'] || !row['Name']) return;
            try {
                const rowDate = parse(row['Month'].toString(), 'yyyy/MM', new Date());
                const monthKey = format(rowDate, 'yyyy/MM');
                if (monthlyAgg.hasOwnProperty(monthKey)) {
                    monthlyAgg[monthKey].hours += Number(row['Hours']) || 0;
                    const name = row['Name'].toString().replace(/\\s+/g, ' ').trim();
                    monthlyAgg[monthKey].users.add(name);
                }
            } catch {}
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

        // Utilization Trends
        const utilizationCategories = ['Investment Related - IPO', 'Investment Related - Corporate Matter', 'Investment Related - M&A Deal'];
        const utilizationTrendsAgg: { [key: string]: any } = {};
        monthsInPeriod.forEach(monthDate => {
            const monthKey = format(monthDate, 'yyyy/MM');
            utilizationTrendsAgg[monthKey] = { month: monthKey };
            utilizationCategories.forEach(cat => utilizationTrendsAgg[monthKey][cat] = 0);
        });

        teamData.forEach(row => {
            if (!row || !row['Month'] || !row['Deal/Matter Category']) return;
            const rawCategory = row['Deal/Matter Category']?.toString() || '';
            const category = rawCategory.replace(/\\s+/g, ' ').trim();
            if (utilizationCategories.includes(category)) {
                try {
                    const rowDate = parse(row['Month'].toString(), 'yyyy/MM', new Date());
                    const monthKey = format(rowDate, 'yyyy/MM');
                    if (utilizationTrendsAgg[monthKey]) {
                         utilizationTrendsAgg[monthKey][category] = (utilizationTrendsAgg[monthKey][category] || 0) + (Number(row['Hours']) || 0);
                    }
                } catch {}
            }
        });
        const utilizationTrends = Object.values(utilizationTrendsAgg).sort((a: any, b: any) => a.month.localeCompare(b.month));

        return { monthlyTrends, utilizationTrends };
    }, [teamData]);

    return (
        <div className="space-y-4">
             <div className="grid gap-4 md:grid-cols-2">
                <FilterSection data={teamData} title="投资法务中心总用时">
                    {(_, totalHours) => (
                         <>
                            <div className="text-2xl font-bold">{totalHours?.toFixed(2) || '0.00'}h</div>
                            <p className="text-xs text-muted-foreground">在筛选期间的总工时</p>
                         </>
                    )}
                </FilterSection>
                
                <FilterSection data={teamData} title="投资法务中心BSC占比">
                    {(filteredData, totalHours) => (
                        <BSCPieChartSection filteredData={filteredData} totalHours={totalHours} />
                    )}
                </FilterSection>
            </div>

            {/* Trend Charts - No Filter */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle className="text-sm font-medium">投资法务中心总用时月度趋势图</CardTitle></CardHeader>
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
                    <CardHeader><CardTitle className="text-sm font-medium">投资法务中心人均用时月度趋势图</CardTitle></CardHeader>
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
            <FilterSection data={teamData} title="Investment Legal Hours Allocation by Deal/Matters Categories">
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
                        filteredData.filter(row => row['Deal/Matter Category'] === 'Investment Related - M&A Deal' && row['Deal/Matter Name']).forEach(row => {
                                const rawName = row['Deal/Matter Name'].toString();
                                const name = rawName.replace(/\\s+/g, ' ').trim();
                                if (!name) return;
                                const key = name.toUpperCase();
                                const hours = Number(row['Hours']) || 0;
                                if (!mAndADealsAgg[key]) mAndADealsAgg[key] = { hours: 0, name: name };
                                mAndADealsAgg[key].hours += hours;
                            });
                        const mAndADeals = Object.values(mAndADealsAgg).map(({ name, hours }) => ({ name, hours })).sort((a, b) => b.hours - a.hours);

                        return (
                            <div className="max-h-[300px] overflow-y-auto">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Deal/Matter Name</TableHead><TableHead className="text-right">Hours</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {mAndADeals.length > 0 ? mAndADeals.map((deal) => (
                                            <TableRow key={deal.name}><TableCell>{deal.name}</TableCell><TableCell className="text-right"><ClickableHoursCell hours={deal.hours} dealName={deal.name} category="Investment Related - M&A Deal" filteredData={filteredData} /></TableCell></TableRow>
                                        )) : <TableRow><TableCell colSpan={2} className="text-center">当期无数据</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </div>
                        );
                    }}
                </FilterSection>

                <FilterSection data={teamData} title="Working Hours of Portfolios' Corporate Matters - Per Target Companies">
                    {(filteredData) => {
                         const corporateMattersAgg: { [key: string]: { hours: number, name: string } } = {};
                        filteredData.filter(row => row['Deal/Matter Category'] === 'Investment Related - Corporate Matter' && row['Deal/Matter Name']).forEach(row => {
                                const rawName = row['Deal/Matter Name'].toString();
                                const name = rawName.replace(/\\s+/g, ' ').trim();
                                if (!name) return;
                                const key = name.toUpperCase();
                                const hours = Number(row['Hours']) || 0;
                                if (!corporateMattersAgg[key]) corporateMattersAgg[key] = { hours: 0, name: name };
                                corporateMattersAgg[key].hours += hours;
                            });
                        const corporateMatters = Object.values(corporateMattersAgg).map(({ name, hours }) => ({ name, hours })).sort((a, b) => b.hours - a.hours);

                        return (
                            <div className="max-h-[300px] overflow-y-auto">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Deal/Matter Name</TableHead><TableHead className="text-right">Hours</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {corporateMatters.length > 0 ? corporateMatters.map((matter) => (
                                            <TableRow key={matter.name}><TableCell>{matter.name}</TableCell><TableCell className="text-right"><ClickableHoursCell hours={matter.hours} dealName={matter.name} category="Investment Related - Corporate Matter" filteredData={filteredData} /></TableCell></TableRow>
                                        )) : <TableRow><TableCell colSpan={2} className="text-center">当期无数据</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
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
                {(filteredData) => (
                    <div className="grid gap-4 grid-cols-3">
                        {[1, 2, 3, 4, 5, 6].map(groupNum => {
                            const groupName = `${groupNum}组`;
                            const targetSuffix = `${groupNum}组`;
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
                                        const key = name.toUpperCase();
                                        const hours = Number(row['Hours']) || 0;
                                        if (!groupDataMap[key]) groupDataMap[key] = { hours: 0, name: name };
                                        groupDataMap[key].hours += hours;
                                    }
                                });
                            const data = Object.values(groupDataMap).map(({ name, hours }) => ({ name, hours })).sort((a, b) => b.hours - a.hours);

                            return (
                                <Card key={groupName} className="border-0 shadow-none"> {/* remove card style to fit inside container */}
                                    <CardHeader className="px-0 pt-0"><CardTitle className="text-sm font-medium">Group {groupNum}</CardTitle></CardHeader>
                                    <CardContent className="max-h-[300px] overflow-y-auto p-0">
                                        <Table>
                                            <TableHeader><TableRow><TableHead>Deal/Matter Name</TableHead><TableHead className="text-right">Hours</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {data.length > 0 ? data.map((item, idx) => (
                                                    <TableRow key={idx}><TableCell className="py-2">{item.name}</TableCell><TableCell className="text-right py-2"><ClickableHoursCell hours={item.hours} dealName={item.name} category={groupName} filteredData={filteredData.filter(row => {
                                                        const rawSourcePath = row['Source Path']?.toString();
                                                        const sourcePath = rawSourcePath ? rawSourcePath.trim() : '';
                                                        return sourcePath && sourcePath.endsWith(targetSuffix);
                                                    })} isGroup={true} /></TableCell></TableRow>
                                                )) : <TableRow><TableCell colSpan={2} className="text-center py-2">当期无数据</TableCell></TableRow>}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </FilterSection>
        </div>
    );
}

const WorkCategoryComparisonChart = ({ data, workCategoryList, teamData }: { data: any[], workCategoryList: string[], teamData: any[] }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any[]>([]);
    const [dialogTitle, setDialogTitle] = useState('');

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
                const category = rawCat.trim().replace(/\\s+/g, ' ');
                return rowMonth === monthStr && category === categoryName;
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
            const category = rawCat.trim().replace(/\\s+/g, ' ');
            return category === categoryName;
        });
        
        setDialogTitle(`All records for ${categoryName}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    return (
        <>
            <Card>
                <CardHeader><CardTitle className="text-sm font-medium">Corporate and International Financial Affairs Center - Comparison of Work Category</CardTitle></CardHeader>
                <CardContent>
                    <div className="text-sm text-muted-foreground mb-2">💡 Tip: Click on legend labels to view all data for that category, or click on bars for specific month data</div>
                    <ResponsiveContainer width="100%" height={500}>
                        <BarChart data={data} margin={{ bottom: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                            <YAxis label={{ value: '小时', angle: -90, position: 'insideLeft', offset: 10 }} tick={{ fontSize: 12 }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend iconType="rect" wrapperStyle={{ paddingTop: '20px', cursor: 'pointer' }} onClick={handleLegendClick} />
                             {workCategoryList?.map((category, index) => (
                                <Bar key={category} dataKey={category} name={category} fill={['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28', '#a4de6c', '#d0ed57', '#ffc658'][index % 10]} onClick={(barData) => handleBarClick(barData, category)} cursor="pointer" />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
            <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} />
        </>
    );
};

const CorporateFinancePanel = ({ data }: { data: any[] }) => {
    const teamData = useMemo(() => data.filter(row => row && row['团队'] === '公司及国际金融事务中心'), [data]);

    const trendData = useMemo(() => {
        if (teamData.length === 0) return { monthlyTrends: [], virtualGroupTrendData: [], virtualGroupList: [], workCategoryTrendData: [], workCategoryList: [] };

         let overallMinDate: Date | null = null;
        let overallMaxDate: Date | null = null;

        teamData.forEach(row => {
             if (!row || !row['Month']) return;
             try {
                const rowDate = parse(row['Month'].toString(), 'yyyy/MM', new Date());
                if (!overallMinDate || rowDate < overallMinDate) overallMinDate = rowDate;
                if (!overallMaxDate || rowDate > overallMaxDate) overallMaxDate = rowDate;
             } catch {}
        });

        const trendStartDate = overallMinDate ? startOfMonth(overallMinDate) : new Date();
        const trendEndDate = overallMaxDate ? endOfMonth(overallMaxDate) : new Date();
        const monthsInPeriod = eachMonthOfInterval({ start: trendStartDate, end: trendEndDate });

        // Monthly Trends
        const monthlyAgg: { [key: string]: { hours: number; users: Set<string> } } = {};
        monthsInPeriod.forEach(monthDate => monthlyAgg[format(monthDate, 'yyyy/MM')] = { hours: 0, users: new Set() });
        teamData.forEach(row => {
            if (!row || !row['Month'] || !row['Name']) return;
            try {
                const rowDate = parse(row['Month'].toString(), 'yyyy/MM', new Date());
                const monthKey = format(rowDate, 'yyyy/MM');
                if (monthlyAgg.hasOwnProperty(monthKey)) {
                    monthlyAgg[monthKey].hours += Number(row['Hours']) || 0;
                    monthlyAgg[monthKey].users.add(row['Name'].toString().replace(/\\s+/g, ' ').trim());
                }
            } catch {}
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

        // Virtual Group Trend
        const virtualGroupTrendAgg: { [key: string]: { [key: string]: number } } = {};
        const allVirtualGroups = new Set<string>();
        monthsInPeriod.forEach(monthDate => virtualGroupTrendAgg[format(monthDate, 'yyyy/MM')] = {});

        teamData.forEach(row => {
            if (!row || !row['Month'] || !row['Deal/Matter Category']) return;
            const rawGroup = row['Deal/Matter Category'].toString().replace(/\\s+/g, ' ').trim();
            const allowedMatch = ['Group Financing', 'International Financial', 'Listing Rules and Corporate Governance', 'Others'].find(allowed => allowed.toLowerCase() === rawGroup.toLowerCase());
            if (allowedMatch) {
                 try {
                     const rowDate = parse(row['Month'].toString(), 'yyyy/MM', new Date());
                     const monthKey = format(rowDate, 'yyyy/MM');
                     if (virtualGroupTrendAgg[monthKey]) {
                        virtualGroupTrendAgg[monthKey][allowedMatch] = (virtualGroupTrendAgg[monthKey][allowedMatch] || 0) + (Number(row['Hours']) || 0);
                        allVirtualGroups.add(allowedMatch);
                     }
                } catch {}
            }
        });
        const virtualGroupTrendData = Object.entries(virtualGroupTrendAgg).map(([month, groups]) => {
            const entry: any = { month };
            allVirtualGroups.forEach(group => entry[group] = groups[group] || 0);
            return entry;
        }).sort((a, b) => a.month.localeCompare(b.month));
        const virtualGroupList = Array.from(allVirtualGroups).sort();

        // Work Category Trend
        const workCategoryTrendAgg: { [key: string]: { [key: string]: number } } = {};
        const allWorkCategoriesMap: { [key: string]: string } = {};
        const categoryTotalHours: { [key: string]: number } = {};

        monthsInPeriod.forEach(monthDate => workCategoryTrendAgg[format(monthDate, 'yyyy/MM')] = {});

        teamData.forEach(row => {
            if (!row || !row['Month'] || !row['Work Category']) return;
            const rawCat = row['Work Category'].toString();
            const category = rawCat.trim().replace(/\\s+/g, ' ');
            const normalizedKey = category.toUpperCase();
            const hours = Number(row['Hours']) || 0;
            if (hours > 0) {
                try {
                    const rowDate = parse(row['Month'].toString(), 'yyyy/MM', new Date());
                    const monthKey = format(rowDate, 'yyyy/MM');
                    if (workCategoryTrendAgg[monthKey]) {
                        if (!allWorkCategoriesMap[normalizedKey]) allWorkCategoriesMap[normalizedKey] = category;
                        const displayName = allWorkCategoriesMap[normalizedKey];
                        workCategoryTrendAgg[monthKey][displayName] = (workCategoryTrendAgg[monthKey][displayName] || 0) + hours;
                        categoryTotalHours[displayName] = (categoryTotalHours[displayName] || 0) + hours;
                    }
                } catch {}
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
                 <FilterSection data={teamData} title="Corporate and International Financial Affairs Center - Total Working Hours">
                    {(_, totalHours) => (
                         <>
                            <div className="text-2xl font-bold">{totalHours?.toFixed(2) || '0.00'}h</div>
                            <p className="text-xs text-muted-foreground">在筛选期间的总工时</p>
                         </>
                    )}
                </FilterSection>

                <FilterSection data={teamData} title="Corporate and International Financial Affairs Center - Working Hours (BSC vs Others)">
                    {(filteredData, totalHours) => {
                        const [isDialogOpen, setIsDialogOpen] = useState(false);
                        const [dialogData, setDialogData] = useState<any[]>([]);
                        const [dialogTitle, setDialogTitle] = useState('');

                        const bscHours: { [key: string]: { hours: number; name: string } } = {};
                        filteredData.forEach(row => {
                            const rawTag = row['OKR/BSC Tag']?.toString() || 'uncategoried';
                            const tag = rawTag.trim().replace(/\\s+/g, ' ');
                            const key = tag.toUpperCase();
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
                                const tag = rawTag.trim().replace(/\\s+/g, ' ');
                                return tag === bscName;
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
                                const tag = rawTag.trim().replace(/\\s+/g, ' ');
                                return tag === bscName;
                            });
                            setDialogTitle(`All records for ${bscName}`);
                            setDialogData(details);
                            setIsDialogOpen(true);
                        };

                        return (
                            <>
                                {bscData.length > 0 ? (
                                    <div>
                                        <div className="text-sm text-muted-foreground mb-2">💡 Tip: Click on legend labels or pie slices to view data</div>
                                        <ResponsiveContainer width="100%" height={200}>
                                            <PieChart>
                                                <Pie data={bscData} cx="50%" cy="50%" labelLine={false} label={<CustomPieLabel />} outerRadius={60} fill="#8884d8" dataKey="value" onClick={handlePieClick} cursor="pointer">
                                                    {bscData.map((_entry, index) => (<Cell key={`cell-${index}`} fill={['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F'][index % 6]} />))}
                                                </Pie>
                                                <Tooltip formatter={(value:number, _name, entry) => [`${value.toFixed(2)}h (${(entry.payload as any).percentage.toFixed(2)}%)`, (entry.payload as any).name]} />
                                                <Legend iconType="rect" wrapperStyle={{ cursor: 'pointer' }} onClick={handleLegendClick} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : <div className="h-full flex items-center justify-center text-muted-foreground"><p>当期无BSC分类数据</p></div>}
                                <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} />
                            </>
                        );
                    }}
                </FilterSection>
            </div>

            {/* Trend Charts - No Filter */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle className="text-sm font-medium">1. Corporate and International Financial Affairs Center - Comparison of Total Working Hours</CardTitle></CardHeader>
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
                    <CardHeader><CardTitle className="text-sm font-medium">2. Corporate and International Financial Affairs Center - Comparison of Monthly Avg Working Hours per person</CardTitle></CardHeader>
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
                 <FilterSection data={teamData} title="Corporate and International Financial Affairs Center - Working Hours (Virtual Group Hours)">
                    {(filteredData, totalHours) => {
                        const [isDialogOpen, setIsDialogOpen] = useState(false);
                        const [dialogData, setDialogData] = useState<any[]>([]);
                        const [dialogTitle, setDialogTitle] = useState('');

                        const virtualGroupHours: { [key: string]: { hours: number, name: string } } = {};
                        filteredData.forEach(row => {
                             const rawGroup = row['Deal/Matter Category']?.toString();
                             const group = rawGroup ? rawGroup.replace(/\\s+/g, ' ').trim() : '';
                             const hours = Number(row['Hours']) || 0;
                             const allowedMatch = ['Group Financing', 'International Financial', 'Listing Rules and Corporate Governance', 'Others'].find(allowed => allowed.toLowerCase() === group.toLowerCase());
                             if (group && hours > 0 && allowedMatch) {
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
                                const group = rawGroup ? rawGroup.replace(/\\s+/g, ' ').trim() : '';
                                const allowedMatch = ['Group Financing', 'International Financial', 'Listing Rules and Corporate Governance', 'Others'].find(allowed => allowed.toLowerCase() === group.toLowerCase());
                                return allowedMatch === groupName;
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
                                const group = rawGroup ? rawGroup.replace(/\\s+/g, ' ').trim() : '';
                                const allowedMatch = ['Group Financing', 'International Financial', 'Listing Rules and Corporate Governance', 'Others'].find(allowed => allowed.toLowerCase() === group.toLowerCase());
                                return allowedMatch === groupName;
                            });
                            setDialogTitle(`All records for ${groupName}`);
                            setDialogData(details);
                            setIsDialogOpen(true);
                        };

                        return (
                            <>
                                {virtualGroupPieData.length > 0 ? (
                                    <div>
                                        <div className="text-sm text-muted-foreground mb-2">💡 Tip: Click on legend labels or pie slices to view data</div>
                                        <ResponsiveContainer width="100%" height={300}>
                                            <PieChart>
                                                <Pie data={virtualGroupPieData} cx="50%" cy="50%" labelLine={false} label={<CustomPieLabel />} outerRadius={80} fill="#8884d8" dataKey="value" onClick={handlePieClick} cursor="pointer">
                                                    {virtualGroupPieData.map((_entry, index) => (<Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'][index % 6]} />))}
                                                </Pie>
                                                <Tooltip formatter={(value:number, _name, entry) => [`${value.toFixed(2)}h (${(entry.payload as any).percentage.toFixed(2)}%)`, (entry.payload as any).name]} />
                                                <Legend iconType="rect" wrapperStyle={{ cursor: 'pointer' }} onClick={handleLegendClick} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : <div className="h-full flex items-center justify-center text-muted-foreground"><p>当期无虚拟组数据</p></div>}
                                <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} />
                            </>
                        );
                    }}
                </FilterSection>

                {/* Virtual Group Comparison - Trend - No Filter */}
                <Card>
                    <CardHeader><CardTitle className="text-sm font-medium">Corporate and International Financial Affairs Center- Comparison of Virtual Groups</CardTitle></CardHeader>
                    <CardContent className="pt-16 pb-12">
                        <VirtualGroupTrendChart data={trendData.virtualGroupTrendData} teamData={teamData} groupList={trendData.virtualGroupList || []} />
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 grid-cols-1">
                 <FilterSection data={teamData} title="Corporate and International Financial Affairs Center - Working Hours (Internal Client)">
                    {(filteredData) => {
                        const [isDialogOpen, setIsDialogOpen] = useState(false);
                        const [dialogData, setDialogData] = useState<any[]>([]);
                        const [dialogTitle, setDialogTitle] = useState('');

                        const internalClientAgg: { [key: string]: { hours: number, displayName: string } } = {};
                        filteredData.forEach(row => {
                            const rawName = row['Deal/Matter Name']?.toString();
                            if (!rawName) return;
                            const cleanName = rawName.trim().replace(/\\s+/g, ' ');
                            if (!cleanName || cleanName.toLowerCase() === 'group matter') return;
                            const normalizedKey = cleanName.toUpperCase();
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
                                const cleanName = rawName.trim().replace(/\\s+/g, ' ');
                                return cleanName === clientName;
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
                                const cleanName = rawName.trim().replace(/\\s+/g, ' ');
                                return cleanName && cleanName.toLowerCase() !== 'group matter';
                            });
                            setDialogTitle('All Internal Clients');
                            setDialogData(details);
                            setIsDialogOpen(true);
                        };

                        return (
                            <>
                                <div className="text-sm text-muted-foreground mb-2">💡 Tip: Click on bars or legend to view data</div>
                                <ResponsiveContainer width="100%" height={500}>
                                    <BarChart data={internalClientData} margin={{ left: 20, right: 30, bottom: 80 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" interval={0} angle={-45} textAnchor="end" height={80} tick={{fontSize: 12}} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip formatter={(value: number) => Number(value).toFixed(2)} />
                                        <Legend iconType="rect" wrapperStyle={{ paddingTop: '20px', cursor: 'pointer' }} onClick={handleLegendClick} />
                                        <Bar dataKey="hours" name="Hours" fill="#8884d8" onClick={handleBarClick} cursor="pointer" />
                                    </BarChart>
                                </ResponsiveContainer>
                                <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} />
                            </>
                        );
                    }}
                </FilterSection>

                 <FilterSection data={teamData} title="Corporate and International Financial Affairs Center - Working Hours (Work Category)">
                    {(filteredData) => {
                        const [isDialogOpen, setIsDialogOpen] = useState(false);
                        const [dialogData, setDialogData] = useState<any[]>([]);
                        const [dialogTitle, setDialogTitle] = useState('');

                        const workCategoryAgg: { [key: string]: { hours: number, displayName: string } } = {};
                        filteredData.forEach(row => {
                            const rawCat = row['Work Category']?.toString();
                            if (!rawCat) return;
                            const category = rawCat.trim().replace(/\\s+/g, ' ');
                            const normalizedKey = category.toUpperCase();
                            const hours = Number(row['Hours']) || 0;
                            if (hours > 0) {
                                if (!workCategoryAgg[normalizedKey]) workCategoryAgg[normalizedKey] = { hours: 0, displayName: category };
                                workCategoryAgg[normalizedKey].hours += hours;
                            }
                        });
                        const workCategoryData = Object.values(workCategoryAgg).map(item => ({ name: item.displayName, hours: item.hours })).sort((a, b) => b.hours - a.hours);

                        const handleBarClick = (data: any) => {
                            if (!data || !data.name) return;
                            const categoryName = data.name;
                            const details = filteredData.filter(row => {
                                const rawCat = row['Work Category']?.toString();
                                if (!rawCat) return false;
                                const category = rawCat.trim().replace(/\\s+/g, ' ');
                                return category === categoryName;
                            });
                            setDialogTitle(`Details for ${categoryName}`);
                            setDialogData(details);
                            setIsDialogOpen(true);
                        };

                        const handleLegendClick = (e: any) => {
                            if (!e || !e.dataKey) return;
                            const details = filteredData.filter(row => {
                                const rawCat = row['Work Category']?.toString();
                                if (!rawCat) return false;
                                const category = rawCat.trim().replace(/\\s+/g, ' ');
                                return category;
                            });
                            setDialogTitle('All Work Categories');
                            setDialogData(details);
                            setIsDialogOpen(true);
                        };

                        return (
                            <>
                                <div className="text-sm text-muted-foreground mb-2">💡 Tip: Click on bars or legend to view data</div>
                                <ResponsiveContainer width="100%" height={500}>
                                    <BarChart data={workCategoryData} layout="vertical" margin={{ left: 0, right: 30 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" />
                                        <YAxis dataKey="name" type="category" width={400} tick={{fontSize: 11}} interval={0} />
                                        <Tooltip formatter={(value: number) => Number(value).toFixed(2)} />
                                        <Legend iconType="rect" wrapperStyle={{ cursor: 'pointer' }} onClick={handleLegendClick} />
                                        <Bar dataKey="hours" name="Hours" fill="#82ca9d" onClick={handleBarClick} cursor="pointer" />
                                    </BarChart>
                                </ResponsiveContainer>
                                <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} />
                            </>
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
  return (
    <div className="space-y-6 py-2 bg-transparent min-h-screen">
      <Tabs defaultValue="investment-legal" className="space-y-6">
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
          <TabsContent value="investment-legal" className="mt-6 space-y-6 focus-visible:outline-none animate-in fade-in-50 duration-500 slide-in-from-bottom-2">
            <InvestmentLegalCenterPanel data={data} />
          </TabsContent>
          <TabsContent value="corporate-finance" className="mt-6 space-y-6 focus-visible:outline-none animate-in fade-in-50 duration-500 slide-in-from-bottom-2">
            <CorporateFinancePanel data={data} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
