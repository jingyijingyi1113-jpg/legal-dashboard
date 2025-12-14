
import { useMemo, useState, useEffect, useTransition, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MonthPicker } from './MonthPicker';
import { getWorkdaysInMonth, normalizeField, fieldsMatch, createNormalizedKey, parseMonthString, normalizeMonthString, normalizeCategoryDisplay } from '@/lib/date-utils';
import { ComposedChart, Line, Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Area, LineChart } from 'recharts';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, getYear, getMonth } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Period = 'monthly' | 'quarterly' | 'semiannually' | 'annually' | 'custom';
type Option = { value: string; label: string };
type PeriodOptions = { [key in Exclude<Period, 'custom'>]: readonly Option[] };

const PERIOD_OPTIONS: PeriodOptions = {
    monthly: Array.from({ length: 12 }, (_, i) => ({ value: i.toString(), label: `${i + 1}月` })),
    quarterly: [{ value: '0', label: '第一季度' }, { value: '1', label: '第二季度' }, { value: '2', label: '第三季度' }, { value: '3', label: '第四季度' }],
    semiannually: [{ value: '0', label: '上半年' }, { value: '1', label: '下半年' }],
    annually: [], 
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CustomPieLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percentage, name: _name } = props;
    
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


// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CustomTooltip = ({ active, payload, label, onItemClick }: any) => {
  if (active && payload && payload.length) {
    const sortedPayload = [...payload]
        .filter((entry: any) => entry.value > 0)
        .sort((a: any, b: any) => b.value - a.value);

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



const DetailsDialog = ({ isOpen, onClose, title, data, onSave }: { isOpen: boolean, onClose: () => void, title: string, data: any[], onSave?: (updatedData: any[]) => void }) => {
    const [columnFilters, setColumnFilters] = useState<{ [key: string]: string }>({});
    const [editableData, setEditableData] = useState<any[]>([]);
    const [editingCell, setEditingCell] = useState<{ rowIndex: number, key: string } | null>(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [selectedCell, setSelectedCell] = useState<{ rowIndex: number, key: string } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragEndRow, setDragEndRow] = useState<number | null>(null);
    const tableRef = useRef<HTMLDivElement>(null);
    
    // Reset filters and editable data when dialog opens with new data
    useEffect(() => {
        if (isOpen) {
            setColumnFilters({});
            // Deep copy data and add original values for tracking
            // Include more fields for better matching accuracy
            setEditableData(data.map(row => ({
                ...row,
                _originalMonth: row.Month,
                _originalName: row.Name,
                _originalDealMatterName: row['Deal/Matter Name'],
                _originalDealMatterCategory: row['Deal/Matter Category'],
                _originalHours: row.Hours,
                _originalOKRBSCTag: row['OKR/BSC Tag'],
                _modifiedFields: {} // Track which fields have been modified
            })));
            setHasChanges(false);
            setEditingCell(null);
            setSelectedCell(null);
        }
    }, [isOpen, data]);

    // ESC key handler - must be before any conditional returns
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (editingCell) {
                    setEditingCell(null);
                } else {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose, editingCell]);

    // Define all standard columns that should always be displayed
    const standardColumns = [
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

    const allKeys = useMemo(() => {
        if (!data || data.length === 0) return [];
        const keys = new Set<string>();
        
        // First add all standard columns
        standardColumns.forEach(col => keys.add(col));
        
        // Then add any additional columns from data
        data.forEach(row => {
             if(row) Object.keys(row).forEach(k => {
                 // Filter out internal fields
                 if (!k.startsWith('_')) keys.add(k);
             });
        });
        
        // Sort by preferred order
        return Array.from(keys).sort((a, b) => {
            const idxA = standardColumns.indexOf(a);
            const idxB = standardColumns.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [data]);

    // Filter data based on column filters
    const filteredData = useMemo(() => {
        if (!editableData || editableData.length === 0) return [];
        return editableData.filter(row => {
            if (!row) return false;
            return Object.entries(columnFilters).every(([key, filterValue]) => {
                if (!filterValue || filterValue.trim() === '') return true;
                const cellValue = row[key];
                if (cellValue === null || cellValue === undefined) return false;
                return cellValue.toString().toLowerCase().includes(filterValue.toLowerCase());
            });
        });
    }, [editableData, columnFilters]);

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

    // Handle cell edit
    const handleCellClick = (rowIndex: number, key: string) => {
        if (onSave) { // Only allow editing if onSave is provided
            setEditingCell({ rowIndex, key });
        }
    };

    // Handle single click for selection (for fill down feature)
    const handleCellSelect = (rowIndex: number, key: string) => {
        if (onSave) {
            setSelectedCell({ rowIndex, key });
        }
    };

    const handleCellChange = (rowIndex: number, key: string, value: string) => {
        setEditableData(prev => {
            const newData = [...prev];
            const actualIndex = editableData.findIndex(row => row === filteredData[rowIndex]);
            if (actualIndex !== -1) {
                // Convert to number if it's the Hours field
                const newValue = key === 'Hours' ? (parseFloat(value) || 0) : value;
                newData[actualIndex] = { 
                    ...newData[actualIndex], 
                    [key]: newValue,
                    _modifiedFields: { 
                        ...newData[actualIndex]._modifiedFields, 
                        [key]: true 
                    }
                };
            }
            return newData;
        });
        setHasChanges(true);
    };

    const handleCellBlur = () => {
        setEditingCell(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, key: string) => {
        if (e.key === 'Enter') {
            setEditingCell(null);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            const currentKeyIndex = allKeys.indexOf(key);
            const nextKeyIndex = e.shiftKey ? currentKeyIndex - 1 : currentKeyIndex + 1;
            if (nextKeyIndex >= 0 && nextKeyIndex < allKeys.length) {
                setEditingCell({ rowIndex, key: allKeys[nextKeyIndex] });
            }
        }
    };

    // Fill down function - copy selected cell value to all cells below in the same column
    const handleFillDown = () => {
        if (!selectedCell) return;
        const { rowIndex, key } = selectedCell;
        const sourceValue = filteredData[rowIndex]?.[key];
        
        setEditableData(prev => {
            const newData = [...prev];
            // Fill from selected row to the end
            for (let i = rowIndex + 1; i < filteredData.length; i++) {
                const actualIndex = editableData.findIndex(row => row === filteredData[i]);
                if (actualIndex !== -1) {
                    newData[actualIndex] = { 
                        ...newData[actualIndex], 
                        [key]: sourceValue,
                        _modifiedFields: { 
                            ...newData[actualIndex]._modifiedFields, 
                            [key]: true 
                        }
                    };
                }
            }
            return newData;
        });
        setHasChanges(true);
    };

    // Fill all function - copy selected cell value to ALL cells in the same column
    const handleFillAll = () => {
        if (!selectedCell) return;
        const { rowIndex, key } = selectedCell;
        const sourceValue = filteredData[rowIndex]?.[key];
        
        setEditableData(prev => {
            const newData = [...prev];
            // Fill all rows in the filtered data
            filteredData.forEach((row, i) => {
                if (i !== rowIndex) { // Skip the source row
                    const actualIndex = editableData.findIndex(r => r === row);
                    if (actualIndex !== -1) {
                        newData[actualIndex] = { 
                            ...newData[actualIndex], 
                            [key]: sourceValue,
                            _modifiedFields: { 
                                ...newData[actualIndex]._modifiedFields, 
                                [key]: true 
                            }
                        };
                    }
                }
            });
            return newData;
        });
        setHasChanges(true);
    };

    // Drag fill handlers - Excel-like drag to fill
    const handleDragStart = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!selectedCell) return;
        setIsDragging(true);
        setDragEndRow(selectedCell.rowIndex);
    };

    const handleMouseMove = (rowIndex: number) => {
        if (isDragging && selectedCell) {
            // Only allow dragging downward from selected cell
            if (rowIndex >= selectedCell.rowIndex) {
                setDragEndRow(rowIndex);
            }
        }
    };

    const handleMouseUp = () => {
        if (isDragging && selectedCell && dragEndRow !== null && dragEndRow > selectedCell.rowIndex) {
            const { rowIndex, key } = selectedCell;
            const sourceValue = filteredData[rowIndex]?.[key];
            
            setEditableData(prev => {
                const newData = [...prev];
                // Fill from selected row + 1 to drag end row
                for (let i = rowIndex + 1; i <= dragEndRow; i++) {
                    const actualIndex = editableData.findIndex(row => row === filteredData[i]);
                    if (actualIndex !== -1) {
                        newData[actualIndex] = { 
                            ...newData[actualIndex], 
                            [key]: sourceValue,
                            _modifiedFields: { 
                                ...newData[actualIndex]._modifiedFields, 
                                [key]: true 
                            }
                        };
                    }
                }
                return newData;
            });
            setHasChanges(true);
        }
        setIsDragging(false);
        setDragEndRow(null);
    };

    // Global mouse up handler for drag fill
    useEffect(() => {
        const handleGlobalMouseUp = () => {
            if (isDragging) {
                handleMouseUp();
            }
        };
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, [isDragging, selectedCell, dragEndRow]);

    // Check if a cell is in the drag selection range
    const isInDragRange = (rowIndex: number, key: string) => {
        if (!isDragging || !selectedCell || dragEndRow === null) return false;
        return key === selectedCell.key && rowIndex > selectedCell.rowIndex && rowIndex <= dragEndRow;
    };

    const handleSave = () => {
        if (onSave && hasChanges) {
            // Mark rows that have any modified fields with _isModified flag
            const dataWithModifiedFlag = editableData.map(row => {
                const hasModifications = row._modifiedFields && Object.keys(row._modifiedFields).length > 0;
                return {
                    ...row,
                    _isModified: hasModifications
                };
            });
            onSave(dataWithModifiedFlag);
            setHasChanges(false);
            onClose();
        }
    };

    // Check if a cell has been modified
    const isCellModified = (row: any, key: string) => {
        return row._modifiedFields && row._modifiedFields[key];
    };

    // Conditional return AFTER all hooks
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" style={{ position: 'fixed', left: 0, right: 0, top: 0, bottom: 0, margin: 0 }}>
            <div 
                className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-[calc(100vw-32px)] max-w-[1800px] h-[85vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700"
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
                        {hasChanges && (
                            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                有未保存的修改
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 rounded-full">
                            <span className="sr-only">Close</span>
                            ✕
                        </Button>
                    </div>
                </div>
                {onSave && (
                    <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                            <span>双击编辑 | 单击选中后可使用填充功能 | 修改的单元格会高亮显示</span>
                        </div>
                        {selectedCell && (
                            <div className="flex items-center gap-2">
                                <span className="text-slate-500">已选中: 第{selectedCell.rowIndex + 1}行 [{selectedCell.key}]</span>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={handleFillDown}
                                    className="h-6 px-2 text-xs bg-white border-blue-300 text-blue-600 hover:bg-blue-100"
                                    title="将选中单元格的值填充到下方所有单元格"
                                >
                                    ↓ 向下填充
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={handleFillAll}
                                    className="h-6 px-2 text-xs bg-white border-purple-300 text-purple-600 hover:bg-purple-100"
                                    title="将选中单元格的值填充到该列所有单元格"
                                >
                                    ⬇ 填充全部
                                </Button>
                            </div>
                        )}
                    </div>
                )}
                <div 
                    ref={tableRef}
                    className="flex-1 overflow-x-auto overflow-y-auto relative w-full bg-white dark:bg-slate-900" 
                    style={{ backgroundColor: '#ffffff', overflowX: 'auto', overflowY: 'auto' }}
                    onMouseUp={handleMouseUp}
                >
                   <Table className="w-max min-w-full border-collapse bg-white dark:bg-slate-900" style={{ backgroundColor: '#ffffff' }}>
                       <TableHeader className="sticky top-0 z-10 shadow-sm bg-slate-100" style={{ backgroundColor: '#f1f5f9' }}>
                           <TableRow className="bg-slate-100 hover:bg-slate-100" style={{ backgroundColor: '#f1f5f9' }}>
                               {allKeys.map(key => (
                                   <TableHead key={key} className="whitespace-nowrap px-4 py-2 font-bold text-slate-900 dark:text-slate-100 border-b border-r last:border-r-0 bg-slate-100 dark:bg-slate-800 min-w-[120px]" style={{ backgroundColor: '#f1f5f9' }}>
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
                                   {allKeys.map(key => {
                                       let displayValue = row[key];
                                       const isEditing = editingCell?.rowIndex === i && editingCell?.key === key;
                                       
                                       // Format Month field - convert Excel serial number to date string
                                       if (key === 'Month' && displayValue !== null && displayValue !== undefined && !isEditing) {
                                           const parsed = parseMonthString(displayValue);
                                           if (parsed) {
                                               displayValue = normalizeMonthString(displayValue);
                                           }
                                       }
                                       // Format Hours fields
                                       if ((key === 'Hours' || key === 'Total Hours') && typeof displayValue === 'number' && !isEditing) {
                                           displayValue = displayValue.toFixed(2);
                                       }
                                       
                                       return (
                                           <TableCell 
                                               key={key} 
                                               className={`whitespace-nowrap px-4 py-2 border-b border-r last:border-r-0 max-w-[400px] text-sm relative ${onSave ? 'cursor-pointer hover:bg-blue-50' : ''} ${isCellModified(row, key) ? 'bg-amber-50' : ''} ${selectedCell?.rowIndex === i && selectedCell?.key === key ? 'ring-2 ring-blue-500 ring-inset' : ''} ${isInDragRange(i, key) ? 'bg-blue-100 ring-1 ring-blue-400 ring-inset' : ''}`}
                                               onDoubleClick={() => handleCellClick(i, key)}
                                               onClick={() => handleCellSelect(i, key)}
                                               onMouseEnter={() => handleMouseMove(i)}
                                               title={displayValue?.toString()}
                                           >
                                               {isEditing ? (
                                                   <input
                                                       type={key === 'Hours' ? 'number' : 'text'}
                                                       value={row[key] ?? ''}
                                                       onChange={(e) => handleCellChange(i, key, e.target.value)}
                                                       onBlur={handleCellBlur}
                                                       onKeyDown={(e) => handleKeyDown(e, i, key)}
                                                       className="w-full px-2 py-1 text-sm border border-blue-400 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                       autoFocus
                                                       step={key === 'Hours' ? '0.01' : undefined}
                                                   />
                                               ) : (
                                                   <>
                                                       <span className={`truncate block ${isCellModified(row, key) ? 'text-amber-700 font-medium' : ''}`}>{displayValue}</span>
                                                       {/* Drag handle - small square at bottom-right corner */}
                                                       {selectedCell?.rowIndex === i && selectedCell?.key === key && onSave && (
                                                           <div
                                                               className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 cursor-crosshair hover:bg-blue-600 z-20"
                                                               style={{ transform: 'translate(50%, 50%)' }}
                                                               onMouseDown={handleDragStart}
                                                               title="拖动向下填充"
                                                           />
                                                       )}
                                                   </>
                                               )}
                                           </TableCell>
                                       );
                                   })}
                               </TableRow>
                           )) : <TableRow><TableCell colSpan={allKeys.length} className="text-center py-4">No data found</TableCell></TableRow>}
                       </TableBody>
                   </Table>
                </div>
                 <div 
                    className="p-4 border-t bg-slate-50 dark:bg-slate-800 flex justify-between items-center shrink-0"
                    style={{ backgroundColor: '#f8fafc' }}
                >
                    <div className="text-sm text-muted-foreground font-medium flex items-center gap-4">
                        <span>
                            {hasActiveFilters && <span className="text-blue-600">筛选后: {filteredData.length} / </span>}
                            Total Records: {editableData.length} | Total Hours: {filteredData.reduce((acc, r) => acc + (Number(r.Hours) || 0), 0).toFixed(2)}
                            {hasActiveFilters && <span className="text-slate-400"> (原始: {editableData.reduce((acc, r) => acc + (Number(r.Hours) || 0), 0).toFixed(2)})</span>}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                            左右滑动查看更多列
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        </span>
                    </div>
                    {onSave && (
                        <div className="flex items-center gap-2">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={onClose}
                                className="h-8 px-4"
                            >
                                取消
                            </Button>
                            <Button 
                                variant="default" 
                                size="sm" 
                                onClick={handleSave}
                                disabled={!hasChanges}
                                className="h-8 px-4 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                            >
                                保存修改
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

const BSCPieChartSection = ({ filteredData, totalHours, onDataUpdate }: { filteredData: any[], totalHours: number, onDataUpdate?: (updatedRecords: any[]) => void }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any[]>([]);
    const [dialogTitle, setDialogTitle] = useState('');

    const bscData = useMemo(() => {
        const bscHours: { [key: string]: { hours: number; name: string } } = {};
        filteredData.forEach(row => {
            const rawTag = row['OKR/BSC Tag']?.toString() || 'uncategoried';
            const tag = normalizeCategoryDisplay(rawTag);
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

    // Handle save from DetailsDialog
    const handleSave = (updatedData: any[]) => {
        if (onDataUpdate) {
            onDataUpdate(updatedData);
        }
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
                                (entry.payload as any).name
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
            <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} onSave={onDataUpdate ? handleSave : undefined} />
        </div>
    );
};

const DealCategoryPieChartSection = ({ filteredData, totalHours, onDataUpdate }: { filteredData: any[], totalHours: number, onDataUpdate?: (updatedRecords: any[]) => void }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any[]>([]);
    const [dialogTitle, setDialogTitle] = useState('');

    // Handle save from DetailsDialog
    const handleSave = (updatedData: any[]) => {
        if (onDataUpdate) {
            onDataUpdate(updatedData);
        }
    };

    // Fixed order for Deal/Matter Categories
    const DEAL_CATEGORY_ORDER = [
        'Investment Related - M&A Deal',
        'Investment Related - Corporate Matter',
        'Investment Related - IPO',
        'Non-Investment Related - Other Departments',
        'Public - Infrastructure & Guidance',
        'Public - Knowledge Accumulation & Sharing',
        'Public - Others',
    ];

    const dealCategoryAllocation = useMemo(() => {
        const dealCategoryHours: { [key: string]: { hours: number; name: string } } = {};
        filteredData.forEach(row => {
            const rawCategory = row['Deal/Matter Category']?.toString();
            // Normalize category using the standard function
            const category = (rawCategory && rawCategory.trim()) 
                ? normalizeCategoryDisplay(rawCategory)
                : 'Uncategorized';
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
        })).sort((a, b) => {
            // Sort by fixed order
            const indexA = DEAL_CATEGORY_ORDER.findIndex(cat => fieldsMatch(cat, a.name));
            const indexB = DEAL_CATEGORY_ORDER.findIndex(cat => fieldsMatch(cat, b.name));
            // If both are in the order list, sort by order
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            // If only one is in the list, it comes first
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            // Otherwise sort by value descending
            return b.value - a.value;
        });
    }, [filteredData, totalHours]);

    const handlePieClick = (entry: any) => {
        if (!entry || !entry.name) return;
        const categoryName = entry.name;
        const details = filteredData.filter(row => {
            const rawCategory = row['Deal/Matter Category']?.toString();
            const category = (rawCategory && rawCategory.trim()) ? normalizeCategoryDisplay(rawCategory) : 'Uncategorized';
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
            const category = (rawCategory && rawCategory.trim()) ? normalizeCategoryDisplay(rawCategory) : 'Uncategorized';
            return fieldsMatch(category, categoryName);
        });
        setDialogTitle(`All records for ${categoryName}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    if (dealCategoryAllocation.length === 0) {
        return <div className="h-full flex items-center justify-center text-muted-foreground"><p>当期无数据</p></div>;
    }

    // Premium color palette for deal categories - matched to DEAL_CATEGORY_ORDER
    // M&A=Red, Corporate Matter=Blue, IPO=Green, then other categories
    const DEAL_COLORS = [
        '#C44E52', // Red - M&A Deal
        '#4C72B0', // Blue - Corporate Matter
        '#55A868', // Green - IPO
        '#84cc16', // Lime - Non-Investment Related
        '#06b6d4', // Cyan - Public Infrastructure
        '#f59e0b', // Amber - Public Knowledge
        '#ec4899', // Pink - Public Others
    ];

    return (
        <div className="relative">
            <div className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Click on slices or legend to view details
            </div>
            <div className="flex flex-col lg:flex-row items-center gap-4">
                <div className="w-full lg:w-1/2">
                    <ResponsiveContainer width="100%" height={220}>
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
                                innerRadius={40}
                                outerRadius={80}
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
                                    (entry.payload as any).name
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
                <div className="w-full lg:w-1/2 space-y-1">
                    {dealCategoryAllocation.map((entry, index) => (
                        <div 
                            key={entry.name}
                            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all group border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                            onClick={() => handleLegendClick({ value: entry.name })}
                        >
                            <div 
                                className="w-3 h-3 rounded-md flex-shrink-0 group-hover:scale-110 transition-transform shadow-sm"
                                style={{ backgroundColor: DEAL_COLORS[index % DEAL_COLORS.length] }}
                            />
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                                    {entry.name}
                                </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <div className="text-xs font-bold" style={{ color: DEAL_COLORS[index % DEAL_COLORS.length] }}>
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
            <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} onSave={onDataUpdate ? handleSave : undefined} />
        </div>
    );
};

const UtilizationTrendChart = ({ data, teamData, onDataUpdate }: { data: any[], teamData: any[], onDataUpdate?: (updatedRecords: any[]) => void }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any[]>([]);
    const [dialogTitle, setDialogTitle] = useState('');

    // Handle save from DetailsDialog
    const handleSave = (updatedData: any[]) => {
        if (onDataUpdate) {
            onDataUpdate(updatedData);
        }
    };

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
            const rowMonth = normalizeMonthString(row['Month']);
            const rowCategory = row['Deal/Matter Category']?.toString();
            return rowMonth === monthStr && fieldsMatch(rowCategory, categoryName);
        });
        
        setDialogTitle(`${categoryName} - ${monthStr}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    const CustomDot = (props: any) => {
        const { cx, cy, fill, dataKey, index: _index } = props;
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
    // Sort order: M&A Deal -> Corporate Matter -> IPO (matching line order from top to bottom)
    const TOOLTIP_ORDER = ['M&A Deal', 'Corporate Matter', 'IPO'];
    
    // Get the last month in data for comparison
    const lastMonth = data.length > 0 ? data[data.length - 1]?.month : null;

    // Handle tooltip item click
    const handleTooltipItemClick = (categoryName: string, monthStr: string) => {
        const fullCategoryName = Object.keys(LINE_COLORS).find(key => key.includes(categoryName)) || categoryName;
        const details = teamData.filter(row => {
            if (!row || !row['Month'] || !row['Deal/Matter Category']) return false;
            const rowMonth = normalizeMonthString(row['Month']);
            const rowCategory = row['Deal/Matter Category']?.toString();
            return rowMonth === monthStr && fieldsMatch(rowCategory, fullCategoryName);
        });
        setDialogTitle(`${fullCategoryName} - ${monthStr}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };
    
    const PremiumTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;
        
        // Filter to only show Line data (not Area), using the short names
        const filteredPayload = payload.filter((entry: any) => 
            ['IPO', 'Corporate Matter', 'M&A Deal'].includes(entry.name)
        );
        
        if (!filteredPayload.length) return null;
        
        // Sort by fixed order
        const sortedPayload = [...filteredPayload].sort((a: any, b: any) => {
            const indexA = TOOLTIP_ORDER.indexOf(a.name);
            const indexB = TOOLTIP_ORDER.indexOf(b.name);
            return indexA - indexB;
        });

        // Calculate total for percentage
        const total = sortedPayload.reduce((sum: number, entry: any) => sum + (Number(entry.value) || 0), 0);

        // Determine tooltip position based on month - show on left side starting from October
        const shouldShowOnLeft = (() => {
            if (!label) return false;
            // Extract month number from format like "2025/10" or "2025-10"
            const monthMatch = label.match(/[\/\-](\d{1,2})$/);
            if (monthMatch) {
                const monthNum = parseInt(monthMatch[1], 10);
                return monthNum >= 10; // October (10), November (11), December (12)
            }
            return false;
        })();
        
        return (
            <div 
                className="bg-white border border-slate-200 rounded-xl shadow-2xl p-4 min-w-[260px]"
                style={{ 
                    pointerEvents: 'auto',
                    transform: shouldShowOnLeft ? 'translateX(-100%)' : 'translateX(0)',
                    zIndex: 9999,
                    position: 'relative'
                }}
            >
                <div className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">
                    {label}
                </div>
                <div className="space-y-2">
                    {sortedPayload.map((entry: any, index: number) => {
                        const percentage = total > 0 ? ((Number(entry.value) || 0) / total) * 100 : 0;
                        return (
                            <div 
                                key={index} 
                                className="flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5 transition-colors"
                                onClick={() => handleTooltipItemClick(entry.name, label)}
                            >
                                <div className="flex items-center gap-2">
                                    <div 
                                        className="w-3 h-3 rounded-full shadow-sm"
                                        style={{ backgroundColor: entry.color }}
                                    />
                                    <span className="text-xs text-slate-600">{entry.name}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-xs font-semibold text-slate-800">
                                        {Number(entry.value).toFixed(1)}h
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        ({percentage.toFixed(0)}%)
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600">Total</span>
                    <span className="text-xs font-bold text-slate-800">{total.toFixed(1)}h</span>
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
                        label={{ value: 'Hours', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: '#64748b' } }} 
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickLine={{ stroke: '#e2e8f0' }}
                    />
                    <Tooltip 
                        content={<PremiumTooltip />}
                        wrapperStyle={{ 
                            pointerEvents: 'auto', 
                            zIndex: 9999,
                            overflow: 'visible',
                            visibility: 'visible'
                        }}
                        allowEscapeViewBox={{ x: true, y: true }}
                        position={{ y: 0 }}
                    />
                    
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
            
            <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} onSave={onDataUpdate ? handleSave : undefined} />
        </div>
    );
};

const VirtualGroupTrendChart = ({ data, teamData, groupList, onDataUpdate }: { data: any[], teamData: any[], groupList: string[], onDataUpdate?: (updatedRecords: any[]) => void }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any[]>([]);
    const [dialogTitle, setDialogTitle] = useState('');

    // Handle save from DetailsDialog
    const handleSave = (updatedData: any[]) => {
        if (onDataUpdate) {
            onDataUpdate(updatedData);
        }
    };
    
    // State for fixed tooltip
    const [tooltipData, setTooltipData] = useState<{ payload: any[], label: string } | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState<{ x: number, y: number } | null>(null);
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const isTooltipHovered = useRef(false);
    const lastTooltipLabel = useRef<string | null>(null);

    // Reset tooltip hover state when dialog closes
    useEffect(() => {
        if (!isDialogOpen) {
            isTooltipHovered.current = false;
            lastTooltipLabel.current = null;
        }
    }, [isDialogOpen]);

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
            const rowMonth = normalizeMonthString(row['Month']);
            const rowGroup = row['Deal/Matter Category']?.toString();
            const matchedGroup = allowedGroups.find(allowed => fieldsMatch(allowed, rowGroup));
            return rowMonth === monthStr && matchedGroup === groupName;
        });
        
        setDialogTitle(`${groupName} - ${monthStr}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    // Handle tooltip item click
    const handleTooltipItemClick = (groupName: string, monthStr: string) => {
        const details = teamData.filter(row => {
            if (!row || !row['Month'] || !row['Deal/Matter Category']) return false;
            const rowMonth = normalizeMonthString(row['Month']);
            const rowGroup = row['Deal/Matter Category']?.toString();
            const matchedGroup = allowedGroups.find(allowed => fieldsMatch(allowed, rowGroup));
            return rowMonth === monthStr && matchedGroup === groupName;
        });
        
        setDialogTitle(`${groupName} - ${monthStr}`);
        setDialogData(details);
        setIsDialogOpen(true);
        setTooltipData(null);
        setTooltipPosition(null);
    };

    // Custom tooltip component that triggers state updates
    const TooltipTrigger = useCallback(({ active, payload, label, coordinate }: any) => {
        if (isTooltipHovered.current) return null;
        
        if (active && payload && payload.length > 0 && label !== lastTooltipLabel.current) {
            lastTooltipLabel.current = label;
            
            const filteredPayload = payload.filter((entry: any) => {
                const color = entry.color || entry.stroke;
                return color && !color.startsWith('url(');
            });
            
            if (filteredPayload.length > 0) {
                // Use setTimeout to avoid state update during render
                setTimeout(() => {
                    setTooltipData({ payload: filteredPayload, label });
                    // Position tooltip near the data point, adjust based on x position
                    const chartWidth = chartContainerRef.current?.offsetWidth || 800;
                    const tooltipWidth = 220;
                    const xPos = coordinate?.x || 60;
                    // If point is in the right half, show tooltip on the left of the point
                    const adjustedX = xPos > chartWidth / 2 ? xPos - tooltipWidth - 20 : xPos + 20;
                    setTooltipPosition({ x: Math.max(10, adjustedX), y: 30 });
                }, 0);
            }
        }
        
        return null;
    }, []);

    // Handle mouse leave from chart area
    const handleChartMouseLeave = () => {
        lastTooltipLabel.current = null;
        setTimeout(() => {
            if (!isTooltipHovered.current) {
                setTooltipData(null);
                setTooltipPosition(null);
            }
        }, 100);
    };

    // Handle tooltip mouse enter/leave
    const handleTooltipMouseEnter = () => {
        isTooltipHovered.current = true;
    };

    const handleTooltipMouseLeave = () => {
        isTooltipHovered.current = false;
        setTooltipData(null);
        setTooltipPosition(null);
    };

    const CustomDot = (props: any) => {
        const { cx, cy, fill, dataKey, index: _index } = props;
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

    // Render fixed tooltip
    const renderFixedTooltip = () => {
        if (!tooltipData || !tooltipPosition) return null;
        
        const { payload, label } = tooltipData;
        const total = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);
        
        return (
            <div 
                className="absolute bg-white/98 backdrop-blur-md border border-slate-200/60 rounded-xl shadow-2xl p-4 min-w-[220px] z-50"
                style={{ 
                    left: tooltipPosition.x, 
                    top: tooltipPosition.y,
                    pointerEvents: 'auto'
                }}
                onMouseEnter={handleTooltipMouseEnter}
                onMouseLeave={handleTooltipMouseLeave}
            >
                <div className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">
                    <span>{label}</span>
                </div>
                <div 
                    className="space-y-1 overflow-y-auto pr-1 custom-scrollbar"
                    style={{ maxHeight: '200px' }}
                >
                    {payload.map((entry: any, index: number) => {
                        const entryColor = entry.color || entry.stroke || PREMIUM_COLORS[index % PREMIUM_COLORS.length];
                        const itemName = entry.name || entry.dataKey;
                        return (
                            <div 
                                key={index} 
                                className="group relative flex items-center justify-between gap-2 cursor-pointer hover:bg-indigo-50 rounded-lg px-2 py-1.5 transition-all duration-150 border border-transparent hover:border-indigo-100"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleTooltipItemClick(itemName, label);
                                }}
                                title={itemName}
                            >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div 
                                        className="w-2.5 h-2.5 rounded-full shadow-sm flex-shrink-0"
                                        style={{ backgroundColor: entryColor }}
                                    />
                                    <span className="text-xs text-slate-600 truncate max-w-[100px] group-hover:text-indigo-700 transition-colors">{itemName}</span>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <span className="text-xs font-semibold text-slate-800 group-hover:text-indigo-700">
                                        {Number(entry.value).toFixed(1)}h
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        ({total > 0 ? ((Number(entry.value) / total) * 100).toFixed(0) : 0}%)
                                    </span>
                                    <svg className="w-3 h-3 text-slate-300 group-hover:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-xs font-medium text-slate-500">Total</span>
                    <span className="text-sm font-bold text-slate-800">{total.toFixed(1)}h</span>
                </div>
            </div>
        );
    };

    return (
        <div className="relative" ref={chartContainerRef}>
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
            
            <div onMouseLeave={handleChartMouseLeave}>
                <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart 
                        data={data} 
                        margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                    >
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
                            label={{ value: 'Hours', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: '#64748b' } }} 
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            axisLine={{ stroke: '#e2e8f0' }}
                            tickLine={{ stroke: '#e2e8f0' }}
                        />
                        <Tooltip content={<TooltipTrigger />} />
                        
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
            </div>
            
            {/* Fixed Tooltip */}
            {renderFixedTooltip()}
            
            {/* Hint text */}
            <div className="text-xs text-slate-400 text-center mt-2">
                Click on data points to view detailed records
            </div>
            
            <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} onSave={onDataUpdate ? handleSave : undefined} />
            
            {/* Custom scrollbar styles */}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f1f5f9;
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
            `}</style>
        </div>
    );
};

// Internal Client Monthly Trend Chart - Grouped Bar Chart with per-month sorting
const InternalClientMonthlyTrendChart = ({ teamData, onDataUpdate }: { teamData: any[], onDataUpdate?: (updatedRecords: any[]) => void }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any[]>([]);
    const [dialogTitle, setDialogTitle] = useState('');

    // Handle save from DetailsDialog
    const handleSave = (updatedData: any[]) => {
        if (onDataUpdate) {
            onDataUpdate(updatedData);
        }
    };

    // Extended color palette - 30 unique colors for more clients
    const PREMIUM_COLORS = [
        '#6366f1', // Indigo
        '#10b981', // Emerald
        '#f59e0b', // Amber
        '#ef4444', // Red
        '#06b6d4', // Cyan
        '#ec4899', // Pink
        '#84cc16', // Lime
        '#f97316', // Orange
        '#8b5cf6', // Violet
        '#14b8a6', // Teal
        '#f43f5e', // Rose
        '#0ea5e9', // Sky
        '#a855f7', // Purple
        '#22c55e', // Green
        '#eab308', // Yellow
        '#3b82f6', // Blue
        '#d946ef', // Fuchsia
        '#64748b', // Slate
        '#0d9488', // Teal Dark
        '#dc2626', // Red Dark
        '#7c3aed', // Violet Dark
        '#059669', // Emerald Dark
        '#ca8a04', // Yellow Dark
        '#2563eb', // Blue Dark
        '#c026d3', // Fuchsia Dark
        '#475569', // Slate Dark
        '#0891b2', // Cyan Dark
        '#be123c', // Rose Dark
        '#4f46e5', // Indigo Dark
        '#16a34a', // Green Dark
    ];

    // Process data: aggregate by Month and Deal/Matter Name (internal client)
    const { flatChartData, clientList, clientColorMap } = useMemo(() => {
        const monthMap: { [month: string]: { [client: string]: number } } = {};
        const normalizedClientMap: { [key: string]: string } = {};

        teamData.forEach(row => {
            const rawMonth = row['Month']?.toString();
            const rawName = row['Deal/Matter Name']?.toString();
            const hours = Number(row['Hours']) || 0;

            if (!rawMonth || !rawName || hours <= 0) return;

            // Parse and format month using the new universal parser
            const monthStr = normalizeMonthString(rawMonth);
            if (!monthStr) return;

            // Normalize client name to handle duplicates from input issues
            const cleanName = normalizeCategoryDisplay(rawName);
            if (!cleanName || normalizeField(cleanName) === 'group matter') return;
            
            const normalizedKey = createNormalizedKey(cleanName);
            if (!normalizedClientMap[normalizedKey]) {
                normalizedClientMap[normalizedKey] = cleanName;
            }
            const clientName = normalizedClientMap[normalizedKey];

            if (!monthMap[monthStr]) monthMap[monthStr] = {};
            monthMap[monthStr][clientName] = (monthMap[monthStr][clientName] || 0) + hours;
        });

        // Sort months chronologically
        const sortedMonths = Object.keys(monthMap).sort();

        // Calculate total hours per client for consistent color assignment
        const clientTotals: { [client: string]: number } = {};
        Object.values(monthMap).forEach(monthData => {
            Object.entries(monthData).forEach(([client, hours]) => {
                clientTotals[client] = (clientTotals[client] || 0) + hours;
            });
        });

        // Get clients sorted by total hours for legend and color assignment
        const sortedClients = Object.entries(clientTotals)
            .sort((a, b) => b[1] - a[1])
            .map(([client]) => client);

        // Create color map for consistent colors
        const colorMap: { [client: string]: string } = {};
        sortedClients.forEach((client, index) => {
            colorMap[client] = PREMIUM_COLORS[index % PREMIUM_COLORS.length];
        });

        // Build flat chart data: each bar is a separate data point
        // Format: [{ month: "2025/01", client: "HR", hours: 531.8, color: "#6366f1", displayName: "2025/01_0" }, ...]
        const flatData: any[] = [];
        sortedMonths.forEach(month => {
            const monthData = monthMap[month];
            // Sort clients by hours for this specific month (descending)
            const sortedMonthClients = Object.entries(monthData)
                .sort((a, b) => b[1] - a[1]);
            
            sortedMonthClients.forEach(([client, hours], idx) => {
                flatData.push({
                    month,
                    client,
                    hours,
                    color: colorMap[client],
                    barIndex: idx,
                    displayKey: `${month}_${idx}`
                });
            });
        });

        return { flatChartData: flatData, clientList: sortedClients, clientColorMap: colorMap };
    }, [teamData]);

    const handleBarClick = (entry: any) => {
        if (!entry || !entry.month || !entry.client) return;
        const monthStr = entry.month;
        const clientName = entry.client;
        
        const details = teamData.filter(row => {
            const rawMonth = row['Month']?.toString();
            const rawName = row['Deal/Matter Name']?.toString();
            if (!rawMonth || !rawName) return false;
            
            const rowMonth = normalizeMonthString(rawMonth);
            if (!rowMonth) return false;
            
            return rowMonth === monthStr && fieldsMatch(rawName, clientName);
        });
        
        setDialogTitle(`${clientName} - ${monthStr}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    // Group data by month for the chart
    const groupedChartData = useMemo(() => {
        const months = [...new Set(flatChartData.map(d => d.month))].sort();
        return months.map(month => {
            const monthBars = flatChartData.filter(d => d.month === month);
            const entry: any = { month };
            monthBars.forEach((bar, idx) => {
                entry[`bar_${idx}`] = bar.hours;
                entry[`bar_${idx}_client`] = bar.client;
                entry[`bar_${idx}_color`] = bar.color;
            });
            entry._barCount = monthBars.length;
            entry._bars = monthBars;
            return entry;
        });
    }, [flatChartData]);

    // Get max bar count across all months
    const maxBarCount = useMemo(() => {
        return Math.max(...groupedChartData.map(d => d._barCount || 0));
    }, [groupedChartData]);

    // Custom tooltip - increased height to show more items without scrolling
    const PremiumTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;
        
        // Get the actual bars data for this month
        const monthData = groupedChartData.find(d => d.month === label);
        if (!monthData || !monthData._bars) return null;
        
        const bars = monthData._bars as any[];
        const total = bars.reduce((sum: number, bar: any) => sum + bar.hours, 0);
        
        // Determine tooltip position based on month - show on left side starting from October
        const shouldShowOnLeft = (() => {
            if (!label) return false;
            // Extract month number from format like "2025/10" or "2025-10"
            const monthMatch = label.match(/[\/\-](\d{1,2})$/);
            if (monthMatch) {
                const monthNum = parseInt(monthMatch[1], 10);
                return monthNum >= 10; // October (10), November (11), December (12)
            }
            return false;
        })();
        
        return (
            <div 
                className="bg-white border border-slate-200 rounded-xl shadow-2xl p-4 min-w-[260px]"
                style={{ 
                    pointerEvents: 'auto',
                    transform: shouldShowOnLeft ? 'translateX(-100%)' : 'translateX(0)',
                    zIndex: 9999,
                    position: 'relative'
                }}
            >
                <div className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">
                    {label}
                </div>
                <div 
                    className="space-y-2 overflow-y-auto pr-1"
                    style={{ maxHeight: '300px' }}
                    onWheel={(e) => e.stopPropagation()}
                >
                    {bars.map((bar: any, index: number) => (
                        <div 
                            key={index} 
                            className="flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5 transition-colors"
                            onClick={() => handleBarClick(bar)}
                        >
                            <div className="flex items-center gap-2">
                                <div 
                                    className="w-3 h-3 rounded-full shadow-sm flex-shrink-0"
                                    style={{ backgroundColor: bar.color }}
                                />
                                <span className="text-xs text-slate-600 truncate max-w-[140px]">{bar.client}</span>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <span className="text-xs font-semibold text-slate-800">
                                    {Number(bar.hours).toFixed(1)}h
                                </span>
                                <span className="text-[10px] text-slate-400 ml-1">
                                    ({((bar.hours / total) * 100).toFixed(1)}%)
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between">
                    <span className="text-xs font-medium text-slate-600">Total</span>
                    <span className="text-xs font-bold text-slate-800">{total.toFixed(1)}h</span>
                </div>
            </div>
        );
    };

    if (flatChartData.length === 0 || clientList.length === 0) {
        return (
            <div className="flex items-center justify-center h-[300px] text-slate-400 text-sm">
                No data available
            </div>
        );
    }

    return (
        <div className="relative" style={{ overflow: 'visible' }}>
            {/* Custom Legend - show all internal clients */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
                {clientList.map((client) => (
                    <div 
                        key={client} 
                        className="flex items-center gap-2 group cursor-pointer"
                        onClick={() => {
                            const details = teamData.filter(row => {
                                const rawName = row['Deal/Matter Name']?.toString();
                                return rawName && fieldsMatch(rawName, client);
                            });
                            setDialogTitle(`All records for ${client}`);
                            setDialogData(details);
                            setIsDialogOpen(true);
                        }}
                    >
                        <div 
                            className="w-3 h-3 rounded-full group-hover:scale-110 transition-transform"
                            style={{ backgroundColor: clientColorMap[client] }}
                        />
                        <span className="text-xs font-medium text-slate-600 group-hover:text-slate-800 transition-colors truncate max-w-[100px]">
                            {client}
                        </span>
                    </div>
                ))}
            </div>
            
            <div style={{ overflow: 'visible', minHeight: '500px' }}>
                <ResponsiveContainer width="100%" height={450}>
                    <BarChart data={groupedChartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }} barCategoryGap="15%">
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
                        label={{ value: 'Hours', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: '#64748b' } }} 
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickLine={{ stroke: '#e2e8f0' }}
                    />
                    <Tooltip 
                        content={<PremiumTooltip />}
                        wrapperStyle={{ 
                            pointerEvents: 'auto', 
                            zIndex: 9999,
                            overflow: 'visible',
                            visibility: 'visible'
                        }}
                        allowEscapeViewBox={{ x: true, y: true }}
                        position={{ y: 0 }}
                    />
                    
                    {/* Dynamic bars - one Bar component per position, colored by the client at that position */}
                    {Array.from({ length: maxBarCount }, (_, idx) => (
                        <Bar 
                            key={`bar_${idx}`}
                            dataKey={`bar_${idx}`}
                            name={`Position ${idx + 1}`}
                            radius={[2, 2, 0, 0]}
                            cursor="pointer"
                            onClick={(data: any) => {
                                const barData = data?._bars?.[idx];
                                if (barData) handleBarClick(barData);
                            }}
                            fill={PREMIUM_COLORS[idx % PREMIUM_COLORS.length]}
                            // @ts-ignore - custom shape for dynamic coloring
                            shape={(props: any) => {
                                const { x, y, width, height, payload } = props;
                                if (!payload || payload[`bar_${idx}`] === undefined || payload[`bar_${idx}`] === 0) return null;
                                const color = payload[`bar_${idx}_color`] || PREMIUM_COLORS[idx % PREMIUM_COLORS.length];
                                const barData = payload._bars?.[idx];
                                
                                return (
                                    <rect
                                        x={x}
                                        y={y}
                                        width={width}
                                        height={height}
                                        fill={color}
                                        rx={2}
                                        ry={2}
                                        cursor="pointer"
                                        onClick={() => barData && handleBarClick(barData)}
                                        style={{ 
                                            fillOpacity: 0.85
                                        }}
                                    />
                                );
                            }}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
            </div>
            
            {/* Hint text */}
            <div className="text-xs text-slate-400 text-center mt-2">
                Click on bars or legend items to view detailed records
            </div>
            
            <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} onSave={onDataUpdate ? handleSave : undefined} />
        </div>
    );
};

const VirtualGroupHoursChart = ({ filteredData, onDataUpdate }: { filteredData: any[], onDataUpdate?: (updatedRecords: any[]) => void }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any[]>([]);
    const [dialogTitle, setDialogTitle] = useState('');

    // Handle save from DetailsDialog
    const handleSave = (updatedData: any[]) => {
        if (onDataUpdate) {
            onDataUpdate(updatedData);
        }
    };
    
    // State for fixed tooltip
    const [tooltipData, setTooltipData] = useState<{ payload: any[], label: string } | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState<{ x: number, y: number } | null>(null);
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const isTooltipHovered = useRef(false);

    // Reset tooltip hover state when dialog closes
    useEffect(() => {
        if (!isDialogOpen) {
            isTooltipHovered.current = false;
        }
    }, [isDialogOpen]);

    // Fixed order for Deal/Matter Categories
    const CATEGORY_ORDER = [
        'Investment Related - M&A Deal',
        'Investment Related - Corporate Matter',
        'Investment Related - IPO',
        'Non-Investment Related - Other Departments',
        'Public - Infrastructure & Guidance',
        'Public - Knowledge Accumulation & Sharing',
        'Public - Others',
    ];

    // Premium color palette - matched to CATEGORY_ORDER
    // M&A=Red, Corporate Matter=Blue, IPO=Green, then other categories
    const CHART_COLORS = [
        '#C44E52', // Red - M&A Deal
        '#4C72B0', // Blue - Corporate Matter
        '#55A868', // Green - IPO
        '#84cc16', // Lime - Non-Investment Related
        '#06b6d4', // Cyan - Public Infrastructure
        '#f59e0b', // Amber - Public Knowledge
        '#ec4899', // Pink - Public Others
        '#f97316'  // Orange - fallback
    ];

    const virtualGroupData: { [key: string]: { [key: string]: number } } = {};
    const virtualGroupCategories = new Set<string>();
    const normalizedCategoriesMap: { [key: string]: string } = {};
    
    filteredData.forEach(row => {
        const rawSourcePath = row['Source Path']?.toString();
        const sourcePath = rawSourcePath ? rawSourcePath.replace(/\\s+/g, ' ').trim().replace('工时统计-', '') : '';
        const rawCategory = row['Deal/Matter Category']?.toString().replace(/\\s+/g, ' ').trim();
        const hours = Number(row['Hours']) || 0;

        if (sourcePath && rawCategory && hours > 0) {
            const categoryKey = createNormalizedKey(rawCategory);
            if (!normalizedCategoriesMap[categoryKey]) normalizedCategoriesMap[categoryKey] = normalizeCategoryDisplay(rawCategory);
            const category = normalizedCategoriesMap[categoryKey];
            if (!virtualGroupData[sourcePath]) virtualGroupData[sourcePath] = {};
            virtualGroupData[sourcePath][category] = (virtualGroupData[sourcePath][category] || 0) + hours;
            virtualGroupCategories.add(category);
        }
    });

    // Define group order for sorting
    const GROUP_ORDER = ['1组', '2组', '3组', '4组', '5组', '6组'];

    const virtualGroupChartData = Object.entries(virtualGroupData).map(([sourcePath, categories]) => {
         const totalHours = Object.values(categories).reduce((sum, h) => sum + h, 0);
         const entry: any = { name: sourcePath, totalHours };
         Object.entries(categories).forEach(([cat, hours]) => {
             entry[cat] = hours;
             entry[`${cat}_percent`] = totalHours > 0 ? (hours / totalHours) * 100 : 0;
         });
         return entry;
    }).sort((a, b) => {
        const indexA = GROUP_ORDER.indexOf(a.name);
        const indexB = GROUP_ORDER.indexOf(b.name);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.name.localeCompare(b.name);
    });
    
    // Sort categories by fixed order
    const virtualGroupCategoryList = Array.from(virtualGroupCategories).sort((a, b) => {
        const indexA = CATEGORY_ORDER.findIndex(cat => fieldsMatch(cat, a));
        const indexB = CATEGORY_ORDER.findIndex(cat => fieldsMatch(cat, b));
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    const handleBarClick = (data: any, dataKey: string) => {
        if (!data || !data.name) return;
        const sourcePath = data.name;
        const category = dataKey;
        const details = filteredData.filter(row => {
            const rawSourcePath = row['Source Path']?.toString();
            const rowSourcePath = rawSourcePath ? rawSourcePath.replace(/\\s+/g, ' ').trim().replace('工时统计-', '') : '';
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
            const rowSourcePath = rawSourcePath ? rawSourcePath.replace(/\\s+/g, ' ').trim().replace('工时统计-', '') : '';
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

    // Handle mouse enter on bar - show fixed tooltip
    const handleBarMouseEnter = (data: any) => {
        if (isTooltipHovered.current) return;
        
        const payload = virtualGroupCategoryList
            .filter(cat => data[cat] !== undefined && data[cat] > 0)
            .map(cat => ({
                dataKey: cat,
                value: data[cat],
                name: cat
            }));
        
        setTooltipData({ payload, label: data.name });
        
        // Position tooltip to the right of the chart
        if (chartContainerRef.current) {
            const rect = chartContainerRef.current.getBoundingClientRect();
            setTooltipPosition({ x: rect.width - 360, y: 60 });
        }
    };

    // Handle mouse leave from chart area
    const handleChartMouseLeave = () => {
        // Delay hiding to allow mouse to enter tooltip
        setTimeout(() => {
            if (!isTooltipHovered.current) {
                setTooltipData(null);
                setTooltipPosition(null);
            }
        }, 100);
    };

    // Handle tooltip mouse enter/leave
    const handleTooltipMouseEnter = () => {
        isTooltipHovered.current = true;
    };

    const handleTooltipMouseLeave = () => {
        isTooltipHovered.current = false;
        setTooltipData(null);
        setTooltipPosition(null);
    };

    // Render fixed tooltip
    const renderFixedTooltip = () => {
        if (!tooltipData || !tooltipPosition) return null;
        
        const { payload, label } = tooltipData;
        
        // Sort payload by fixed category order
        const sortedPayload = [...payload].sort((a: any, b: any) => {
            const indexA = CATEGORY_ORDER.findIndex(cat => fieldsMatch(cat, a.dataKey));
            const indexB = CATEGORY_ORDER.findIndex(cat => fieldsMatch(cat, b.dataKey));
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return 0;
        });
        
        const total = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);
        
        return (
            <div 
                ref={tooltipRef}
                className="absolute bg-white/98 backdrop-blur-md border border-slate-200/60 rounded-xl shadow-2xl p-4 min-w-[340px] z-50"
                style={{ 
                    left: tooltipPosition.x, 
                    top: tooltipPosition.y,
                    pointerEvents: 'auto'
                }}
                onMouseEnter={handleTooltipMouseEnter}
                onMouseLeave={handleTooltipMouseLeave}
            >
                <div className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">
                    <span>{label}</span>
                </div>
                <div 
                    className="space-y-1 overflow-y-auto pr-1 custom-scrollbar"
                    style={{ maxHeight: '220px' }}
                >
                    {sortedPayload.map((entry: any, index: number) => {
                        const categoryIndex = virtualGroupCategoryList.indexOf(entry.dataKey);
                        const color = CHART_COLORS[categoryIndex % CHART_COLORS.length];
                        return (
                            <div 
                                key={index} 
                                className="group flex items-center justify-between gap-3 cursor-pointer hover:bg-indigo-50 rounded-lg px-3 py-2 transition-all duration-150 border border-transparent hover:border-indigo-100"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleTooltipItemClick(entry.dataKey, label);
                                    setTooltipData(null);
                                    setTooltipPosition(null);
                                }}
                            >
                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                    <div 
                                        className="w-3 h-3 rounded-sm shadow-sm flex-shrink-0 transition-transform group-hover:scale-110"
                                        style={{ backgroundColor: color }}
                                    />
                                    <span className="text-xs text-slate-600 truncate group-hover:text-indigo-700 transition-colors">{entry.dataKey}</span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <span className="text-xs font-semibold text-slate-800 group-hover:text-indigo-700">
                                        {Number(entry.value).toFixed(1)}h
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        ({total > 0 ? ((Number(entry.value) / total) * 100).toFixed(0) : 0}%)
                                    </span>
                                    <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-xs font-medium text-slate-500">Total</span>
                    <span className="text-sm font-bold text-slate-800">{total.toFixed(1)}h</span>
                </div>
            </div>
        );
    };

    return (
        <div className="relative" ref={chartContainerRef}>
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
            
            <div onMouseLeave={handleChartMouseLeave}>
                <ResponsiveContainer width="100%" height={320}>
                    <BarChart layout="vertical" data={virtualGroupChartData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }} barSize={22}>
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
                        <Tooltip content={() => null} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                        {virtualGroupCategoryList.map((category, index) => (
                            <Bar 
                                key={category} 
                                dataKey={category} 
                                stackId="a" 
                                fill={`url(#barGradient${index % CHART_COLORS.length})`}
                                onClick={(data) => handleBarClick(data, category)} 
                                onMouseEnter={(data) => handleBarMouseEnter(data)}
                                cursor="pointer"
                                radius={index === virtualGroupCategoryList.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>
            
            {/* Fixed Tooltip */}
            {renderFixedTooltip()}
            
            <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} onSave={onDataUpdate ? handleSave : undefined} />
            
            {/* Custom scrollbar styles */}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f1f5f9;
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
            `}</style>
        </div>
    );
};

const AverageMonthlyHourPerPersonChart = ({ teamData, onDataUpdate }: { teamData: any[], onDataUpdate?: (updatedRecords: any[]) => void }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any[]>([]);
    const [dialogTitle, setDialogTitle] = useState('');

    // Handle save from DetailsDialog
    const handleSave = (updatedData: any[]) => {
        if (onDataUpdate) {
            onDataUpdate(updatedData);
        }
    };

    // Premium color palette for groups - high contrast colors
    const GROUP_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

    const monthlyHourPerPersonData: { [key: string]: { [key: string]: { hours: number, users: Set<string> } } } = {};
    const allSourcePaths = new Set<string>();
    
    teamData.forEach(row => {
        const rawSourcePath = row['Source Path']?.toString();
        const sourcePath = rawSourcePath ? rawSourcePath.trim().replace('工时统计-', '').replace(/\\s+/g, ' ') : '';
        if (sourcePath && row['Month'] && row['Name']) {
            allSourcePaths.add(sourcePath);
            const monthKey = normalizeMonthString(row['Month']);
            if (monthKey) {
                const hours = Number(row['Hours']) || 0;
                if (!monthlyHourPerPersonData[monthKey]) monthlyHourPerPersonData[monthKey] = {};
                if (!monthlyHourPerPersonData[monthKey][sourcePath]) monthlyHourPerPersonData[monthKey][sourcePath] = { hours: 0, users: new Set() };
                monthlyHourPerPersonData[monthKey][sourcePath].hours += hours;
                monthlyHourPerPersonData[monthKey][sourcePath].users.add(row['Name']);
            }
        }
    });
    
    const sourcePathList = Array.from(allSourcePaths).sort();
    const avgMonthlyHoursPerGroup = Object.entries(monthlyHourPerPersonData).map(([month, groupData]) => {
        const date = parseMonthString(month) || new Date();
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
            const rowMonth = normalizeMonthString(row['Month']);
            if (!rowMonth) return false;
            const rawSourcePath = row['Source Path'].toString();
            const rowSourcePath = rawSourcePath ? rawSourcePath.trim().replace('工时统计-', '').replace(/\\s+/g, ' ') : '';
            return rowMonth === monthStr && rowSourcePath === sourcePath;
        });
        setDialogTitle(`${sourcePath} - ${monthStr}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    // Handle tooltip item click
    const handleTooltipItemClick = (sourcePath: string, monthStr: string) => {
        const details = teamData.filter(row => {
            if (!row || !row['Month'] || !row['Source Path']) return false;
            const rowMonth = normalizeMonthString(row['Month']);
            if (!rowMonth) return false;
            const rawSourcePath = row['Source Path'].toString();
            const rowSourcePath = rawSourcePath ? rawSourcePath.trim().replace('工时统计-', '').replace(/\\s+/g, ' ') : '';
            return rowMonth === monthStr && rowSourcePath === sourcePath;
        });
        setDialogTitle(`${sourcePath} - ${monthStr}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    // Premium tooltip
    const PremiumAvgTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;
        
        // Calculate total for percentage
        const total = payload.reduce((sum: number, entry: any) => sum + (Number(entry.value) || 0), 0);
        
        return (
            <div className="bg-white/95 backdrop-blur-md border border-slate-200/60 rounded-xl shadow-xl p-4 min-w-[220px]" style={{ pointerEvents: 'auto' }}>
                <div className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">
                    {label}
                </div>
                <div className="space-y-2">
                    {payload.map((entry: any, index: number) => {
                        // Get color from sourcePathList index
                        const sourceIndex = sourcePathList.indexOf(entry.dataKey);
                        const color = GROUP_COLORS[sourceIndex >= 0 ? sourceIndex % GROUP_COLORS.length : index % GROUP_COLORS.length];
                        const percentage = total > 0 ? ((Number(entry.value) || 0) / total) * 100 : 0;
                        return (
                            <div 
                                key={index} 
                                className="flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5 transition-colors"
                                onClick={() => handleTooltipItemClick(entry.dataKey, label)}
                            >
                                <div className="flex items-center gap-2">
                                    <div 
                                        className="w-3 h-3 rounded-sm shadow-sm flex-shrink-0"
                                        style={{ backgroundColor: color }}
                                    />
                                    <span className="text-xs text-slate-600 truncate max-w-[100px]">{entry.name}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-xs font-semibold text-slate-800">
                                        {Number(entry.value).toFixed(2)}h
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        ({percentage.toFixed(0)}%)
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600">Total</span>
                    <span className="text-xs font-bold text-slate-800">{total.toFixed(2)}h</span>
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
                    <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} onSave={onDataUpdate ? handleSave : undefined} />
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
    isGroup,
    percentage,
    onDataUpdate
}: { 
    hours: number, 
    dealName: string, 
    category: string, 
    filteredData: any[],
    isGroup?: boolean,
    percentage?: number,
    onDataUpdate?: (updatedRecords: any[]) => void
}) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any[]>([]);
    const [dialogTitle, setDialogTitle] = useState('');

    // Handle save from DetailsDialog
    const handleSave = (updatedData: any[]) => {
        if (onDataUpdate) {
            onDataUpdate(updatedData);
        }
    };

    const handleClick = () => {
        let details: any[] = [];
        
        if (isGroup) {
            // For group tables, match by name only (already filtered by source path)
            details = filteredData.filter(row => {
                const rowName = normalizeCategoryDisplay(row['Deal/Matter Name']?.toString());
                return fieldsMatch(rowName, dealName);
            });
        } else {
            // For M&A and Corporate Matter tables, match by name and category
            details = filteredData.filter(row => {
                const rowName = normalizeCategoryDisplay(row['Deal/Matter Name']?.toString());
                const rowCategory = normalizeCategoryDisplay(row['Deal/Matter Category']?.toString());
                return fieldsMatch(rowName, dealName) && fieldsMatch(rowCategory, category);
            });
        }
        
        setDialogTitle(`${dealName} - ${category}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    return (
        <>
            <div 
                onClick={handleClick}
                className={`flex flex-col items-end cursor-pointer hover:scale-105 transition-transform ${isGroup ? 'gap-0' : ''}`}
            >
                <span className={`font-semibold text-indigo-600 hover:text-indigo-800 tabular-nums underline decoration-dotted underline-offset-2 ${isGroup ? 'text-xs leading-tight' : 'text-sm'}`}>
                    {hours.toFixed(1)}h
                </span>
                {percentage !== undefined && (
                    <span className={`text-slate-400 ${isGroup ? 'text-[9px] leading-tight' : 'text-[10px]'}`}>
                        {percentage.toFixed(1)}%
                    </span>
                )}
            </div>
            <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} onSave={onDataUpdate ? handleSave : undefined} />
        </>
    );
};

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
  
  const currentYear = new Date().getFullYear();
  const defaultYears = Array.from({ length: 11 }, (_, i) => (currentYear - 5 + i).toString());
  const yearsToShow = availableYears.length > 0 ? availableYears : defaultYears;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "group relative inline-flex items-center gap-2 px-3 py-2.5 -mx-3 -my-2",
            "text-neutral-900 transition-colors duration-75",
            "hover:bg-neutral-100 active:bg-neutral-200 rounded-lg",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400",
            "cursor-pointer select-none touch-manipulation",
            !selectedYear && "text-neutral-400"
          )}
        >
          <span className="text-lg font-semibold tracking-tight text-neutral-800 tabular-nums">
            {selectedYear || '选择年份'}
          </span>
          <svg 
            className={cn(
              "w-4 h-4 text-neutral-500 transition-transform duration-75",
              open && "rotate-180"
            )}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[200px] p-0 border-0 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] rounded-2xl overflow-hidden animate-duration-75"
        align="start"
        sideOffset={8}
      >
        <div className="bg-white">
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
                    "relative py-3.5 px-2 rounded-xl text-sm font-medium transition-colors duration-75",
                    "hover:bg-neutral-100 active:bg-neutral-200 touch-manipulation",
                    isSelected 
                      ? "bg-neutral-900 text-white hover:bg-neutral-800 active:bg-neutral-700" 
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
  onSelect,
}: {
  selectedYear: string | null;
  selectedMonth: string | null;
  onSelect: (year: string, month: string) => void;
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
            "group relative inline-flex items-center gap-2 px-3 py-2.5 -mx-3 -my-2",
            "text-neutral-900 transition-colors duration-75",
            "hover:bg-neutral-100 active:bg-neutral-200 rounded-lg",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400",
            "cursor-pointer select-none touch-manipulation",
            !selectedMonth && "text-neutral-400"
          )}
        >
          <span className="text-lg font-semibold tracking-tight text-neutral-800 tabular-nums">
            {selectedMonth !== null ? monthLabels[parseInt(selectedMonth)] : '选择月份'}
          </span>
          <svg 
            className={cn(
              "w-4 h-4 text-neutral-500 transition-transform duration-75",
              open && "rotate-180"
            )}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[280px] p-0 border-0 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] rounded-2xl overflow-hidden animate-duration-75"
        align="start"
        sideOffset={8}
      >
        <div className="bg-white">
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
            <button 
              onClick={() => setViewYear(prev => prev - 1)}
              className="w-10 h-10 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 active:bg-neutral-200 transition-colors duration-75 touch-manipulation"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-lg font-semibold tracking-tight text-neutral-800">{viewYear}</span>
            <button 
              onClick={() => setViewYear(prev => prev + 1)}
              className="w-10 h-10 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 active:bg-neutral-200 transition-colors duration-75 touch-manipulation"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-1 p-3">
            {months.map((month) => {
              const isSelected = selectedMonth !== null && parseInt(selectedMonth) === month && selectedYear === viewYear.toString();
              const isCurrentMonth = new Date().getMonth() === month && new Date().getFullYear() === viewYear;
              
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
            "group relative inline-flex items-center gap-2 px-3 py-2.5 -mx-3 -my-2",
            "text-neutral-900 transition-colors duration-75",
            "hover:bg-neutral-100 active:bg-neutral-200 rounded-lg",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400",
            "cursor-pointer select-none touch-manipulation",
            !selectedQuarter && "text-neutral-400"
          )}
        >
          <span className={cn(
            "text-lg font-semibold tracking-tight tabular-nums",
            selectedQuarter !== null ? "text-neutral-800" : "text-neutral-400"
          )}>
            {selectedLabel}
          </span>
          <svg 
            className={cn(
              "w-4 h-4 text-neutral-500 transition-transform duration-75",
              open && "rotate-180"
            )}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[200px] p-0 border-0 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] rounded-2xl overflow-hidden animate-duration-75"
        align="start"
        sideOffset={8}
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
                  "w-full py-3.5 px-4 rounded-xl text-sm font-medium transition-colors duration-75 text-left",
                  "hover:bg-neutral-100 active:bg-neutral-200 touch-manipulation",
                  isSelected 
                    ? "bg-neutral-900 text-white hover:bg-neutral-800 active:bg-neutral-700" 
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
            "group relative inline-flex items-center gap-2 px-3 py-2.5 -mx-3 -my-2",
            "text-neutral-900 transition-colors duration-75",
            "hover:bg-neutral-100 active:bg-neutral-200 rounded-lg",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400",
            "cursor-pointer select-none touch-manipulation",
            !selectedSemiannual && "text-neutral-400"
          )}
        >
          <span className={cn(
            "text-lg font-semibold tracking-tight tabular-nums",
            selectedSemiannual !== null ? "text-neutral-800" : "text-neutral-400"
          )}>
            {selectedLabel}
          </span>
          <svg 
            className={cn(
              "w-4 h-4 text-neutral-500 transition-transform duration-75",
              open && "rotate-180"
            )}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[160px] p-0 border-0 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] rounded-2xl overflow-hidden animate-duration-75"
        align="start"
        sideOffset={8}
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
                  "w-full py-3.5 px-4 rounded-xl text-sm font-medium transition-colors duration-75 text-left",
                  "hover:bg-neutral-100 active:bg-neutral-200 touch-manipulation",
                  isSelected 
                    ? "bg-neutral-900 text-white hover:bg-neutral-800 active:bg-neutral-700" 
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
const PeriodFilter = ({ 
    period, setPeriod, 
    selectedYear, setSelectedYear, 
    selectedPeriodValue, setSelectedPeriodValue, 
    customStartDate, setCustomStartDate, 
    customEndDate, setCustomEndDate,
    availableYears,
    periodOptions
}: any) => {
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
                    <MonthPicker value={customStartDate} onChange={setCustomStartDate} variant="minimal" />
                    <span className="text-neutral-300 text-sm">至</span>
                    <MonthPicker value={customEndDate} onChange={setCustomEndDate} variant="minimal" />
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
    const [isPending, startTransition] = useTransition();

    // 使用 useTransition 包装周期切换，让 UI 更快响应
    const handlePeriodChange = useCallback((newPeriod: Period) => {
        startTransition(() => {
            setPeriod(newPeriod);
        });
    }, []);

    const availableYears = useMemo(() => {
        const validData = data.filter(row => row && (row._parsedDate || row['Month']));
        if (!validData || validData.length === 0) return [];
        const years = [...new Set(validData.map(row => {
            const d = row._parsedDate || parseMonthString(row['Month']);
            return d ? d.getFullYear() : NaN;
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
    }, [availableYears, data, selectedYear]);

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
                 const d = row._parsedDate || (row.Month ? parseMonthString(row.Month) : null);
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
                    <div className="flex justify-start">
                        <PeriodFilter 
                            period={period} setPeriod={handlePeriodChange}
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
            <CardContent className={isPending ? "opacity-70 transition-opacity duration-150" : ""}>
                {children(filteredInfo.filteredData, filteredInfo.totalHours, filteredInfo.trend)}
            </CardContent>
        </Card>
    );
};

// Investment Work Category Section - wrapper with shared time filter
const InvestmentWorkCategorySection = ({ teamData, onDataUpdate }: { teamData: any[], onDataUpdate?: (updatedRecords: any[]) => void }) => {
    const [period, setPeriod] = useState<Period>('monthly');
    const [selectedYear, setSelectedYear] = useState<string | null>(null);
    const [selectedPeriodValue, setSelectedPeriodValue] = useState<string | null>(null);
    const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
    const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
    
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
    }, [availableYears, teamData, selectedYear]);

    useEffect(() => {
        if (period !== 'monthly') {
            setSelectedPeriodValue(null);
        }
    }, [period]);

    return (
        <div className="space-y-4">
            {/* Time filter above both charts */}
            <div>
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
            
            {/* Two-column layout for comparison and trend */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <InvestmentWorkCategoryComparison 
                    teamData={teamData} 
                    period={period}
                    selectedYear={selectedYear}
                    selectedPeriodValue={selectedPeriodValue}
                    customStartDate={customStartDate}
                    customEndDate={customEndDate}
                    onDataUpdate={onDataUpdate}
                />
                <DraftingReviewingMonthlyTrend teamData={teamData} />
            </div>
        </div>
    );
};

// Investment Work Category Comparison Component - shows Work Category distribution by Deal/Matter Category
interface InvestmentWorkCategoryComparisonProps {
    teamData: any[];
    period: Period;
    selectedYear: string | null;
    selectedPeriodValue: string | null;
    customStartDate: Date | undefined;
    customEndDate: Date | undefined;
    onDataUpdate?: (updatedRecords: any[]) => void;
}

const InvestmentWorkCategoryComparison = ({ 
    teamData, 
    period, 
    selectedYear, 
    selectedPeriodValue, 
    customStartDate, 
    customEndDate,
    onDataUpdate
}: InvestmentWorkCategoryComparisonProps) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any[]>([]);
    const [dialogTitle, setDialogTitle] = useState('');

    // State for fixed tooltip (like VirtualGroupHoursChart)
    const [tooltipData, setTooltipData] = useState<{ payload: any[], label: string } | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState<{ x: number, y: number } | null>(null);
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const isTooltipHovered = useRef(false);

    // Reset tooltip hover state when dialog closes
    useEffect(() => {
        if (!isDialogOpen) {
            isTooltipHovered.current = false;
        }
    }, [isDialogOpen]);

    // Handle save from DetailsDialog
    const handleSave = (updatedData: any[]) => {
        if (onDataUpdate) {
            onDataUpdate(updatedData);
        }
    };

    // Investment-related categories to filter
    const investmentCategories = [
        'Investment Related - M&A Deal',
        'Investment Related - IPO',
        'Investment Related - Corporate Matter'
    ];

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

    // Process chart data - group by Work Category (X-axis) and Deal/Matter Category (stacked bars)
    const chartData = useMemo(() => {
        // First filter to only investment-related categories
        const investmentData = filteredData.filter(row => {
            const category = row['Deal/Matter Category']?.toString();
            return investmentCategories.some(invCat => fieldsMatch(invCat, category));
        });

        // Group by Work Category, then by Deal/Matter Category
        const workCategoryGroups: { [workCat: string]: { [dealCat: string]: number } } = {};
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
                workCategoryMap[workCatKey] = normalizeCategoryDisplay(rawWorkCategory);
            }
            const workCategory = workCategoryMap[workCatKey];

            if (!workCategoryGroups[workCategory]) {
                workCategoryGroups[workCategory] = {};
            }
            workCategoryGroups[workCategory][matchedDealCategory] = (workCategoryGroups[workCategory][matchedDealCategory] || 0) + hours;
        });

        // Calculate totals for each work category to sort
        const workCatTotals: { [key: string]: number } = {};
        Object.entries(workCategoryGroups).forEach(([workCat, dealCats]) => {
            workCatTotals[workCat] = Object.values(dealCats).reduce((sum, hours) => sum + hours, 0);
        });

        // Sort work categories by total hours (descending)
        const sortedWorkCategories = Object.keys(workCategoryGroups).sort((a, b) => workCatTotals[b] - workCatTotals[a]);

        // Convert to chart format - each entry is a Work Category with Deal/Matter Category values
        const data = sortedWorkCategories.map(workCategory => {
            const entry: any = { 
                category: workCategory,
                fullCategory: workCategory
            };
            investmentCategories.forEach(dealCat => {
                const shortLabel = dealCat.replace('Investment Related - ', '');
                entry[shortLabel] = workCategoryGroups[workCategory]?.[dealCat] || 0;
            });
            return entry;
        });

        // Deal/Matter categories for legend (short labels)
        const dealCategoryLabels = investmentCategories.map(dc => dc.replace('Investment Related - ', ''));

        return { data, dealCategories: dealCategoryLabels, fullDealCategories: investmentCategories };
    }, [filteredData]);

    // Colors for Deal/Matter Categories (3 colors)
    const DEAL_CATEGORY_COLORS = ['#C44E52', '#55A868', '#4C72B0']; // Red (M&A), Green (IPO), Blue (Corporate Matter)

    const handleBarClick = (barData: any, dealCategoryLabel: string) => {
        if (!barData || !barData.fullCategory) return;
        const workCategory = barData.fullCategory;
        const fullDealCategory = investmentCategories.find(dc => dc.includes(dealCategoryLabel)) || dealCategoryLabel;
        
        const details = filteredData.filter(row => {
            const rowDealCat = row['Deal/Matter Category']?.toString();
            const rowWorkCat = row['Work Category']?.toString();
            return fieldsMatch(rowDealCat, fullDealCategory) && fieldsMatch(rowWorkCat, workCategory);
        });
        
        setDialogTitle(`${workCategory} - ${fullDealCategory}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    const handleLegendClick = (e: any) => {
        if (!e || !e.dataKey) return;
        const dealCategoryLabel = e.dataKey;
        const fullDealCategory = investmentCategories.find(dc => dc.includes(dealCategoryLabel)) || dealCategoryLabel;
        
        const details = filteredData.filter(row => {
            const rowDealCat = row['Deal/Matter Category']?.toString();
            return fieldsMatch(rowDealCat, fullDealCategory);
        });
        
        setDialogTitle(`All records for ${fullDealCategory}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    // Handle tooltip item click
    const handleTooltipItemClick = (dealCategoryLabel: string, workCategory: string) => {
        const fullDealCategory = investmentCategories.find(dc => dc.includes(dealCategoryLabel)) || dealCategoryLabel;
        const details = filteredData.filter(row => {
            const rowDealCat = row['Deal/Matter Category']?.toString();
            const rowWorkCat = row['Work Category']?.toString();
            return fieldsMatch(rowDealCat, fullDealCategory) && fieldsMatch(rowWorkCat, workCategory);
        });
        setDialogTitle(`${workCategory} - ${fullDealCategory}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    // Handle mouse enter on bar - show fixed tooltip
    const handleBarMouseEnter = (data: any) => {
        if (isTooltipHovered.current) return;
        
        const payload = chartData.dealCategories
            .filter(cat => data[cat] !== undefined && data[cat] > 0)
            .map(cat => ({
                dataKey: cat,
                value: data[cat],
                name: cat
            }));
        
        setTooltipData({ payload, label: data.fullCategory || data.category });
        
        // Position tooltip to the right side of the chart (outside the chart area)
        if (chartContainerRef.current) {
            const rect = chartContainerRef.current.getBoundingClientRect();
            // Position tooltip at the far right, outside the chart bars
            setTooltipPosition({ x: rect.width - 20, y: 0 });
        }
    };

    // Handle mouse leave from chart area
    const handleChartMouseLeave = () => {
        // Delay hiding to allow mouse to enter tooltip
        setTimeout(() => {
            if (!isTooltipHovered.current) {
                setTooltipData(null);
                setTooltipPosition(null);
            }
        }, 100);
    };

    // Handle tooltip mouse enter/leave
    const handleTooltipMouseEnter = () => {
        isTooltipHovered.current = true;
    };

    const handleTooltipMouseLeave = () => {
        isTooltipHovered.current = false;
        setTooltipData(null);
        setTooltipPosition(null);
    };

    // Render fixed tooltip
    const renderFixedTooltip = () => {
        if (!tooltipData || !tooltipPosition) return null;
        
        const { payload, label } = tooltipData;
        
        // Sort payload by hours (descending)
        const sortedPayload = [...payload].sort((a: any, b: any) => (b.value || 0) - (a.value || 0));
        
        const total = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);
        
        return (
            <div 
                ref={tooltipRef}
                className="absolute bg-white/98 backdrop-blur-md border border-slate-200/60 rounded-xl shadow-2xl p-4 min-w-[300px] z-50"
                style={{ 
                    right: 0,
                    top: tooltipPosition.y,
                    pointerEvents: 'auto'
                }}
                onMouseEnter={handleTooltipMouseEnter}
                onMouseLeave={handleTooltipMouseLeave}
            >
                <div className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">
                    <span>Work Category: {label}</span>
                </div>
                <div 
                    className="space-y-1 overflow-y-auto pr-1 custom-scrollbar"
                    style={{ maxHeight: '200px' }}
                >
                    {sortedPayload.map((entry: any, index: number) => {
                        const categoryIndex = chartData.dealCategories.indexOf(entry.dataKey);
                        const color = DEAL_CATEGORY_COLORS[categoryIndex % DEAL_CATEGORY_COLORS.length];
                        return (
                            <div 
                                key={index} 
                                className="group flex items-center justify-between gap-3 cursor-pointer hover:bg-indigo-50 rounded-lg px-3 py-2 transition-all duration-150 border border-transparent hover:border-indigo-100"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleTooltipItemClick(entry.dataKey, label);
                                    setTooltipData(null);
                                    setTooltipPosition(null);
                                }}
                            >
                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                    <div 
                                        className="w-3 h-3 rounded-sm shadow-sm flex-shrink-0 transition-transform group-hover:scale-110"
                                        style={{ backgroundColor: color }}
                                    />
                                    <span className="text-xs text-slate-600 truncate group-hover:text-indigo-700 transition-colors">{entry.dataKey}</span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <span className="text-xs font-semibold text-slate-800 group-hover:text-indigo-700">
                                        {Number(entry.value).toFixed(1)}h
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        ({total > 0 ? ((Number(entry.value) / total) * 100).toFixed(0) : 0}%)
                                    </span>
                                    <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-xs font-medium text-slate-500">Total</span>
                    <span className="text-sm font-bold text-slate-800">{total.toFixed(1)}h</span>
                </div>

            </div>
        );
    };

    return (
        <Card className="border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-200">
            <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium">Comparison of Work Category by Deal/Matter Category (Investment Related)</CardTitle>
            </CardHeader>
            <CardContent>
                {chartData.data.length > 0 && chartData.dealCategories.length > 0 ? (
                    <div 
                        ref={chartContainerRef}
                        className="relative"
                        onMouseLeave={handleChartMouseLeave}
                    >
                        <div className="text-xs text-slate-400 mb-3 flex items-center gap-1.5">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                            Hover on bars to see details, click to view data
                        </div>
                        
                        {/* Custom Legend - Deal/Matter Categories */}
                        <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
                            {chartData.dealCategories.map((dealCat, index) => (
                                <div 
                                    key={dealCat} 
                                    className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-slate-100 cursor-pointer transition-colors"
                                    onClick={() => handleLegendClick({ dataKey: dealCat })}
                                >
                                    <div 
                                        className="w-3 h-3 rounded-sm"
                                        style={{ backgroundColor: DEAL_CATEGORY_COLORS[index % DEAL_CATEGORY_COLORS.length] }}
                                    />
                                    <span className="text-xs text-slate-600 hover:text-slate-800">{dealCat}</span>
                                </div>
                            ))}
                        </div>
                        
                        <ResponsiveContainer width="100%" height={380}>
                            <BarChart data={chartData.data} margin={{ top: 20, right: 30, left: 40, bottom: 100 }} barSize={40}>
                                <defs>
                                    {DEAL_CATEGORY_COLORS.map((color, index) => (
                                        <linearGradient key={`dealCatGrad${index}`} id={`dealCatGradient${index}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={color} stopOpacity={0.95}/>
                                            <stop offset="100%" stopColor={color} stopOpacity={0.7}/>
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} vertical={false} />
                                <XAxis 
                                    dataKey="category" 
                                    tick={({ x, y, payload }) => {
                                        // 截断逻辑：保留前三个单词（按 / 或空格分隔）
                                        const words = payload.value.split(/[\/\s]+/);
                                        let text = payload.value;
                                        if (words.length > 3) {
                                            text = words.slice(0, 3).join('/') + '...';
                                        } else if (payload.value.length > 25) {
                                            text = payload.value.substring(0, 25) + '...';
                                        }
                                        return (
                                            <g transform={`translate(${x},${y})`}>
                                                <text 
                                                    x={0} 
                                                    y={0} 
                                                    dy={8} 
                                                    textAnchor="end" 
                                                    fill="#475569" 
                                                    fontSize={10}
                                                    transform="rotate(-45)"
                                                >
                                                    <title>{payload.value}</title>
                                                    {text}
                                                </text>
                                            </g>
                                        );
                                    }}
                                    interval={0}
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
                                {chartData.dealCategories.map((dealCat, index) => (
                                    <Bar 
                                        key={dealCat} 
                                        dataKey={dealCat} 
                                        name={dealCat} 
                                        stackId="dealCategory"
                                        fill={`url(#dealCatGradient${index % DEAL_CATEGORY_COLORS.length})`}
                                        onClick={(data) => handleBarClick(data, dealCat)}
                                        onMouseEnter={(data) => handleBarMouseEnter(data)}
                                        cursor="pointer"
                                        // Custom shape to ensure minimum clickable/hoverable height
                                        shape={(props: any) => {
                                            const { x, y, width, height, fill } = props;
                                            const minHeight = 8; // Minimum height for interaction
                                            const actualHeight = Math.max(height || 0, minHeight);
                                            const adjustedY = height < minHeight ? y - (minHeight - height) : y;
                                            
                                            return (
                                                <rect
                                                    x={x}
                                                    y={adjustedY}
                                                    width={width}
                                                    height={actualHeight}
                                                    fill={fill}
                                                    cursor="pointer"
                                                />
                                            );
                                        }}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                        
                        {/* Fixed Tooltip */}
                        {renderFixedTooltip()}
                    </div>
                ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        <p>当期无数据</p>
                    </div>
                )}
                <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} onSave={onDataUpdate ? handleSave : undefined} />
            </CardContent>
        </Card>
    );
};

// Drafting/reviewing/revising Monthly Trend with MoM Component
const DraftingReviewingMonthlyTrend = ({ teamData }: { teamData: any[] }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any[]>([]);
    const [dialogTitle, setDialogTitle] = useState('');

    // Investment-related categories
    const investmentCategories = [
        { key: 'Investment Related - M&A Deal', label: 'M&A Deal', color: '#C44E52' },
        { key: 'Investment Related - IPO', label: 'IPO', color: '#55A868' },
        { key: 'Investment Related - Corporate Matter', label: 'Corporate Matter', color: '#4C72B0' }
    ];

    // Target work category
    const targetWorkCategory = 'Drafting/reviewing/revising legal documents';

    // Process chart data
    const chartData = useMemo(() => {
        // Get all months from data and filter >= 2025/10
        const monthThreshold = '2025/10';
        const allMonths = new Set<string>();
        
        teamData.forEach(row => {
            if (row._parsedDate) {
                const monthStr = format(row._parsedDate, 'yyyy/MM');
                if (monthStr >= monthThreshold) {
                    allMonths.add(monthStr);
                }
            }
        });
        
        const sortedMonths = Array.from(allMonths).sort();
        
        // Aggregate total hours by month for the target work category (all deal categories combined)
        const monthlyTotalHours: { [month: string]: number } = {};
        
        // Initialize all months
        sortedMonths.forEach(month => {
            monthlyTotalHours[month] = 0;
        });
        
        // Filter and aggregate data
        teamData.forEach(row => {
            if (!row._parsedDate) return;
            
            const monthStr = format(row._parsedDate, 'yyyy/MM');
            if (monthStr < monthThreshold) return;
            
            const rawDealCat = row['Deal/Matter Category']?.toString();
            const rawWorkCat = row['Work Category']?.toString();
            const hours = Number(row['Hours']) || 0;
            
            if (!rawDealCat || !rawWorkCat || hours <= 0) return;
            
            // Check if it's the target work category
            if (!fieldsMatch(rawWorkCat, targetWorkCategory)) return;
            
            // Check if it's an investment category
            const isInvestmentCat = investmentCategories.some(({ key }) => fieldsMatch(rawDealCat, key));
            if (!isInvestmentCat) return;
            
            monthlyTotalHours[monthStr] += hours;
        });
        
        // Convert to chart format and calculate overall MoM
        const data = sortedMonths.map((month, index) => {
            const entry: any = {
                month: month,
                fullMonth: month
            };
            
            // Total hours for this month (bar chart)
            const totalMonthlyHours = monthlyTotalHours[month] || 0;
            entry['Total Hours'] = totalMonthlyHours;
            
            // Calculate overall MoM percentage for the target work category (line chart)
            if (index > 0) {
                const prevMonth = sortedMonths[index - 1];
                const prevHours = monthlyTotalHours[prevMonth] || 0;
                if (prevHours > 0) {
                    entry['MoM'] = ((totalMonthlyHours - prevHours) / prevHours) * 100;
                } else {
                    entry['MoM'] = totalMonthlyHours > 0 ? 100 : 0;
                }
            } else {
                entry['MoM'] = 0;
            }
            
            return entry;
        });
        
        return { data, months: sortedMonths };
    }, [teamData]);

    // Handle bar click - show all three deal categories combined
    const handleBarClick = (data: any) => {
        if (!data || !data.fullMonth) return;
        const month = data.fullMonth;
        
        const details = teamData.filter(row => {
            if (!row._parsedDate) return false;
            const rowMonth = format(row._parsedDate, 'yyyy/MM');
            const rowDealCat = row['Deal/Matter Category']?.toString();
            const rowWorkCat = row['Work Category']?.toString();
            const isInvestmentCategory = investmentCategories.some(cat => fieldsMatch(rowDealCat, cat.key));
            return rowMonth === month && 
                   isInvestmentCategory && 
                   fieldsMatch(rowWorkCat, targetWorkCategory);
        });
        
        setDialogTitle(`${month} - All Deal/Matter Categories - ${targetWorkCategory}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    // Custom tooltip
    const CustomTooltipContent = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;
        
        // Separate bars and lines
        const barEntries = payload.filter((p: any) => p.dataKey === 'Total Hours');
        const lineEntries = payload.filter((p: any) => p.dataKey === 'MoM');
        
        return (
            <div className="bg-white/95 backdrop-blur-md border border-slate-200/60 rounded-xl shadow-xl p-4 min-w-[240px]">
                <div className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">
                    {label}
                </div>
                {barEntries.length > 0 && (
                    <div className="space-y-2 mb-3">
                        <div className="text-xs text-slate-500 font-medium">总用时</div>
                        {barEntries.map((entry: any, index: number) => (
                            <div key={index} className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#6366f1' }} />
                                    <span className="text-xs text-slate-600">总用时</span>
                                </div>
                                <span className="text-xs font-semibold text-slate-800">
                                    {Number(entry.value).toFixed(1)}h
                                </span>
                            </div>
                        ))}
                    </div>
                )}
                {lineEntries.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                        <div className="text-xs text-slate-500 font-medium mb-1">MoM%</div>
                        {lineEntries.map((entry: any, index: number) => {
                            const value = Number(entry.value);
                            const isPositive = value >= 0;
                            return (
                                <div key={index} className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <div 
                                            className="w-3 h-0.5 rounded"
                                            style={{ backgroundColor: '#10b981' }}
                                        />
                                        <span className="text-xs text-slate-600">MoM%</span>
                                    </div>
                                    <span className={`text-xs font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                        {isPositive ? '+' : ''}{value.toFixed(1)}%
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <Card className="border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-200">
            <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium">
                    Monthly Trend of "Drafting/reviewing/revising legal documents" (Investment Related)
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                    
                </p>
            </CardHeader>
            <CardContent>
                {chartData.data.length > 0 ? (
                    <div className="relative">
                        <div className="text-xs text-slate-400 mb-3 flex items-center gap-1.5">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                            Click on bars to view detailed data
                        </div>
                        
                        {/* Legend */}
                        <div className="flex flex-wrap items-center justify-center gap-6 mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#6366f1' }} />
                                <span className="text-xs text-slate-600">总用时</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div 
                                    className="w-3 h-0.5 rounded"
                                    style={{ backgroundColor: '#10b981' }}
                                />
                                <span className="text-xs text-slate-600">MoM%</span>
                            </div>
                        </div>
                        
                        <ResponsiveContainer width="100%" height={380}>
                            <ComposedChart data={chartData.data} margin={{ top: 20, right: 60, left: 20, bottom: 20 }}>
                                <defs>
                                    <linearGradient id="totalHoursGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9}/>
                                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.6}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} vertical={false} />
                                <XAxis 
                                    dataKey="month" 
                                    tick={{ fontSize: 11, fill: '#475569' }}
                                    axisLine={{ stroke: '#e2e8f0' }}
                                    tickLine={false}
                                />
                                <YAxis 
                                    yAxisId="left"
                                    label={{ value: 'Hours', angle: -90, position: 'insideLeft', offset: 10, style: { fill: '#64748b', fontSize: 12 } }}
                                    tick={{ fontSize: 11, fill: '#64748b' }}
                                    axisLine={{ stroke: '#e2e8f0' }}
                                    tickLine={false}
                                />
                                <YAxis 
                                    yAxisId="right"
                                    orientation="right"
                                    label={{ value: 'MoM%', angle: 90, position: 'insideRight', offset: 10, style: { fill: '#64748b', fontSize: 12 } }}
                                    tick={{ fontSize: 11, fill: '#64748b' }}
                                    axisLine={{ stroke: '#e2e8f0' }}
                                    tickLine={false}
                                    tickFormatter={(value) => `${value}%`}
                                />
                                <Tooltip content={<CustomTooltipContent />} />
                                
                                {/* Bar for total hours */}
                                <Bar 
                                    yAxisId="left"
                                    dataKey="Total Hours"
                                    name="总用时"
                                    fill="url(#totalHoursGradient)"
                                    barSize={40}
                                    onClick={(data) => handleBarClick(data)}
                                    cursor="pointer"
                                />
                                
                                {/* Line for MoM */}
                                <Line 
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="MoM"
                                    name="MoM%"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                                    activeDot={{ r: 6, strokeWidth: 2 }}
                                />
                            </ComposedChart>
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

// Work Category Trends by Deal/Matter Categories Component
const WorkCategoryTrendsByDealMatter = ({ teamData, onDataUpdate }: { teamData: any[], onDataUpdate?: (updatedRecords: any[]) => void }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any[]>([]);
    const [dialogTitle, setDialogTitle] = useState('');

    // Handle save from DetailsDialog
    const handleSave = (updatedData: any[]) => {
        if (onDataUpdate) {
            onDataUpdate(updatedData);
        }
    };

    // Deal/Matter categories mapping
    const dealCategories = [
        { key: 'Investment Related - M&A Deal', label: 'M&A Deal' },
        { key: 'Investment Related - IPO', label: 'IPO' },
        { key: 'Investment Related - Corporate Matter', label: 'Corporate Matter' }
    ];

    // Premium color palette for work categories
    const WORK_CATEGORY_COLORS = [
        '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', 
        '#ec4899', '#84cc16', '#f97316', '#a855f7', '#14b8a6', 
        '#e11d48', '#22c55e', '#eab308', '#3b82f6', '#d946ef'
    ];

    // Process data for each deal category
    const trendData = useMemo(() => {
        // Get all months from data
        const allMonths = new Set<string>();
        teamData.forEach(row => {
            if (row._parsedDate) {
                allMonths.add(format(row._parsedDate, 'yyyy/MM'));
            }
        });
        const sortedMonths = Array.from(allMonths).sort();
        
        // Filter threshold: 2025/10
        const filterThreshold = '2025/10';
        
        // Generate months for x-axis starting from 2025/10
        const fullYearMonths: string[] = [];
        if (sortedMonths.length > 0) {
            const latestMonth = sortedMonths[sortedMonths.length - 1];
            const latestYear = parseInt(latestMonth.split('/')[0]);
            // Start from October (10)
            for (let m = 10; m <= 12; m++) {
                const monthStr = `${latestYear}/${m.toString().padStart(2, '0')}`;
                if (monthStr <= latestMonth) {
                    fullYearMonths.push(monthStr);
                }
            }
        }

        const result: { [dealKey: string]: { data: any[], workCategories: string[], colorMap: { [wc: string]: string }, maxBars: number } } = {};

        dealCategories.forEach(({ key: dealCategory, label }) => {
            // Filter data for this deal category
            const categoryData = teamData.filter(row => {
                const rowDealCat = row['Deal/Matter Category']?.toString();
                return fieldsMatch(rowDealCat, dealCategory);
            });

            // Aggregate by month and work category
            const workCategoryMap: { [key: string]: string } = {}; // normalized -> display
            const monthlyData: { [month: string]: { [workCat: string]: number } } = {};

            // Initialize all months
            fullYearMonths.forEach(month => {
                monthlyData[month] = {};
            });

            categoryData.forEach(row => {
                if (!row._parsedDate) return;
                const month = format(row._parsedDate, 'yyyy/MM');
                const rawWorkCat = row['Work Category']?.toString();
                const hours = Number(row['Hours']) || 0;

                if (!rawWorkCat || hours <= 0) return;

                // Normalize work category name - remove leading underscores/special chars (input method issues)
                const cleanedWorkCat = normalizeCategoryDisplay(rawWorkCat.replace(/^[_\s]+/, ''));
                const workCatKey = createNormalizedKey(cleanedWorkCat);
                if (!workCategoryMap[workCatKey]) {
                    workCategoryMap[workCatKey] = cleanedWorkCat;
                }
                const workCategory = workCategoryMap[workCatKey];

                if (!monthlyData[month]) {
                    monthlyData[month] = {};
                }
                monthlyData[month][workCategory] = (monthlyData[month][workCategory] || 0) + hours;
            });

            // Get all unique work categories that have data (only from months >= filterThreshold)
            const allWorkCategories = new Set<string>();
            Object.entries(monthlyData).forEach(([month, monthData]) => {
                if (month >= filterThreshold) {
                    Object.entries(monthData).forEach(([wc, hours]) => {
                        if (hours > 0) allWorkCategories.add(wc);
                    });
                }
            });

            // Sort work categories by total hours for color assignment (only from filtered months)
            const workCatTotals: { [wc: string]: number } = {};
            Array.from(allWorkCategories).forEach(wc => {
                workCatTotals[wc] = Object.entries(monthlyData)
                    .filter(([month]) => month >= filterThreshold)
                    .reduce((sum, [_, md]) => sum + (md[wc] || 0), 0);
            });
            const sortedWorkCategories = Array.from(allWorkCategories).sort((a, b) => workCatTotals[b] - workCatTotals[a]);

            // Create color map for work categories
            const colorMap: { [wc: string]: string } = {};
            sortedWorkCategories.forEach((wc, index) => {
                colorMap[wc] = WORK_CATEGORY_COLORS[index % WORK_CATEGORY_COLORS.length];
            });

            // Find max number of bars needed
            let maxBars = 0;
            fullYearMonths.forEach(month => {
                if (month >= filterThreshold) {
                    const count = Object.keys(monthlyData[month] || {}).filter(wc => (monthlyData[month][wc] || 0) > 0).length;
                    if (count > maxBars) maxBars = count;
                }
            });

            // Convert to chart data format with position-based keys (sorted by hours per month)
            const chartData = fullYearMonths.map(month => {
                const entry: any = { month };
                if (month >= filterThreshold) {
                    // Get work categories for this month sorted by hours (descending)
                    const monthWorkCats = Object.entries(monthlyData[month] || {})
                        .filter(([_, hours]) => hours > 0)
                        .sort((a, b) => b[1] - a[1]);
                    
                    // Use position-based keys
                    monthWorkCats.forEach(([wc, hours], idx) => {
                        entry[`bar${idx}`] = hours;
                        entry[`bar${idx}_name`] = wc;
                        entry[`bar${idx}_color`] = colorMap[wc];
                    });
                }
                return entry;
            });

            result[label] = { data: chartData, workCategories: sortedWorkCategories, colorMap, maxBars };
        });

        // Calculate Drafting trend data for each deal category (filtered from 2025/10, excluding 2025/09)
        const draftingFilterThreshold = '2025/10';
        const draftingTrendResult: { [dealKey: string]: { data: any[] } } = {};
        
        dealCategories.forEach(({ key: dealCategory, label }) => {
            // Filter data for this deal category and "Drafting/reviewing/revising legal documents" work category
            const draftingData = teamData.filter(row => {
                const rowDealCat = row['Deal/Matter Category']?.toString();
                const rowWorkCat = row['Work Category']?.toString();
                return fieldsMatch(rowDealCat, dealCategory) && 
                       rowWorkCat && rowWorkCat.toLowerCase().includes('drafting');
            });

            // Aggregate by month
            const monthlyHours: { [month: string]: number } = {};
            
            draftingData.forEach(row => {
                if (!row._parsedDate) return;
                const month = format(row._parsedDate, 'yyyy/MM');
                if (month < draftingFilterThreshold) return; // Filter out data before 2025/09
                const hours = Number(row['Hours']) || 0;
                monthlyHours[month] = (monthlyHours[month] || 0) + hours;
            });

            // Get sorted months starting from 2025/09
            const draftingMonths = Object.keys(monthlyHours).sort();
            
            // Calculate MoM trend
            const chartData = draftingMonths.map((month, index) => {
                const hours = monthlyHours[month] || 0;
                let mom = 0;
                if (index > 0) {
                    const prevMonth = draftingMonths[index - 1];
                    const prevHours = monthlyHours[prevMonth] || 0;
                    if (prevHours > 0) {
                        mom = ((hours - prevHours) / prevHours) * 100;
                    }
                }
                return {
                    month,
                    hours,
                    MoM: mom
                };
            });

            draftingTrendResult[label] = { data: chartData };
        });

        return { ...result, draftingTrend: draftingTrendResult };
    }, [teamData]);

    const handleDotClick = (entry: any, workCategory: string, dealCategory: string) => {
        if (!entry || !entry.month) return;
        
        const monthStr = entry.month;
        const dealKey = dealCategories.find(d => d.label === dealCategory)?.key || dealCategory;
        
        const details = teamData.filter(row => {
            if (!row || !row._parsedDate || !row['Work Category'] || !row['Deal/Matter Category']) return false;
            const rowMonth = format(row._parsedDate, 'yyyy/MM');
            const rowWorkCat = row['Work Category']?.toString();
            const rowDealCat = row['Deal/Matter Category']?.toString();
            return rowMonth === monthStr && fieldsMatch(rowWorkCat, workCategory) && fieldsMatch(rowDealCat, dealKey);
        });
        
        setDialogTitle(`${dealCategory} - ${workCategory} - ${monthStr}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    // Single chart component for each deal category
    const DealCategoryTrendChart = ({ dealLabel, data, workCategories, colorMap, maxBars, draftingData }: { dealLabel: string, data: any[], workCategories: string[], colorMap: { [wc: string]: string }, maxBars: number, draftingData: any[] }) => {
        // Handle bar click
        const handleBarClick = (barData: any, barIndex: number) => {
            if (!barData || !barData.month) return;
            const workCategory = barData[`bar${barIndex}_name`];
            if (workCategory) {
                handleDotClick(barData, workCategory, dealLabel);
            }
        };

        // Handle drafting bar click
        const handleDraftingBarClick = (barData: any) => {
            if (!barData || !barData.month) return;
            handleDotClick(barData, 'Drafting/reviewing/revising legal documents', dealLabel);
        };

        // Custom tooltip
        const TrendTooltip = ({ active, payload, label }: any) => {
            if (!active || !payload || !payload.length) return null;
            
            // Extract actual data from position-based keys
            const validItems: { name: string, value: number, color: string }[] = [];
            if (payload[0]?.payload) {
                const entry = payload[0].payload;
                for (let i = 0; i < maxBars; i++) {
                    const value = entry[`bar${i}`];
                    const name = entry[`bar${i}_name`];
                    const color = entry[`bar${i}_color`];
                    if (value > 0 && name) {
                        validItems.push({ name, value, color });
                    }
                }
            }
            
            if (validItems.length === 0) return null;
            
            const total = validItems.reduce((sum, item) => sum + item.value, 0);
            // Already sorted by hours (descending) from data processing
            
            return (
                <div 
                    className="bg-white/95 backdrop-blur-md border border-slate-200/60 rounded-xl shadow-xl p-4 min-w-[260px]"
                    style={{ pointerEvents: 'auto' }}
                >
                    <div className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">
                        {label}
                    </div>
                    <div 
                        className="space-y-2 overflow-y-auto pr-1"
                        style={{ maxHeight: '200px', pointerEvents: 'auto' }}
                    >
                        {validItems.map((item, index) => {
                            const percentage = total > 0 ? (item.value / total) * 100 : 0;
                            return (
                                <div 
                                    key={index} 
                                    className="flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5 transition-colors"
                                    onClick={() => handleDotClick({ month: label }, item.name, dealLabel)}
                                >
                                    <div className="flex items-center gap-2">
                                        <div 
                                            className="w-3 h-3 rounded-sm shadow-sm flex-shrink-0"
                                            style={{ backgroundColor: item.color }}
                                        />
                                        <span className="text-xs text-slate-600 truncate max-w-[120px]">{item.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs font-semibold text-slate-800">
                                            {Number(item.value).toFixed(1)}h
                                        </span>
                                        <span className="text-xs text-slate-400">
                                            ({percentage.toFixed(0)}%)
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
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
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{dealLabel}</CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Legend - show at top for both charts */}
                    {data.length > 0 && workCategories.length > 0 && (
                        <div className="mb-4">
                            <div className="text-xs text-slate-400 mb-2 flex items-center gap-1.5">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                Click on bars to view details
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                                {workCategories.map((wc) => (
                                    <div key={wc} className="flex items-center gap-1.5">
                                        <div 
                                            className="w-3 h-3 rounded-sm"
                                            style={{ backgroundColor: colorMap[wc] }}
                                        />
                                        <span className="text-xs text-slate-600">{wc}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left: Work Category Bar Chart */}
                        <div>
                            {data.length > 0 && workCategories.length > 0 ? (
                                <div className="relative">
                                    
                                    <ResponsiveContainer width="100%" height={350}>
                                        <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }} barSize={12}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} vertical={false} />
                                            <XAxis 
                                                dataKey="month" 
                                                tick={{ fontSize: 11, fill: '#64748b' }} 
                                                axisLine={{ stroke: '#e2e8f0' }} 
                                                tickLine={false}
                                            />
                                            <YAxis 
                                                tick={{ fontSize: 11, fill: '#64748b' }} 
                                                axisLine={{ stroke: '#e2e8f0' }} 
                                                tickLine={false}
                                                label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748b' } }}
                                            />
                                            <Tooltip 
                                                content={<TrendTooltip />}
                                                wrapperStyle={{ pointerEvents: 'auto' }}
                                            />
                                            {Array.from({ length: maxBars }, (_, idx) => (
                                                <Bar 
                                                    key={`bar${idx}`}
                                                    dataKey={`bar${idx}`}
                                                    onClick={(barData) => handleBarClick(barData, idx)}
                                                    cursor="pointer"
                                                    radius={[4, 4, 0, 0]}
                                                >
                                                    {data.map((entry, index) => (
                                                        <Cell 
                                                            key={`cell-${index}`} 
                                                            fill={entry[`bar${idx}_color`] || '#e2e8f0'} 
                                                        />
                                                    ))}
                                                </Bar>
                                            ))}
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                                    <p className="text-sm">当期无数据</p>
                                </div>
                            )}
                        </div>
                        
                        {/* Right: Drafting/reviewing/revising legal documents Trends */}
                        <div className="pt-[70px]">
                            {draftingData && draftingData.length > 0 ? (
                                <div className="relative">
                                    <div className="text-sm font-medium text-slate-700 mb-4">Drafting/reviewing/revising legal documents Trends</div>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <ComposedChart data={draftingData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} vertical={false} />
                                            <XAxis 
                                                dataKey="month" 
                                                tick={{ fontSize: 11, fill: '#64748b' }} 
                                                axisLine={{ stroke: '#e2e8f0' }} 
                                                tickLine={false}
                                            />
                                            <YAxis 
                                                yAxisId="left"
                                                tick={{ fontSize: 11, fill: '#64748b' }} 
                                                axisLine={{ stroke: '#e2e8f0' }} 
                                                tickLine={false}
                                                label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748b' } }}
                                            />
                                            <YAxis 
                                                yAxisId="right"
                                                orientation="right"
                                                tick={{ fontSize: 11, fill: '#64748b' }} 
                                                axisLine={{ stroke: '#e2e8f0' }} 
                                                tickLine={false}
                                                label={{ value: 'MoM%', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: '#64748b' } }}
                                            />
                                            <Tooltip 
                                                formatter={(value: number, name: string) => [
                                                    name === 'hours' ? `${value.toFixed(1)}h` : `${value.toFixed(1)}%`,
                                                    name === 'hours' ? 'Total Hours' : 'MoM%'
                                                ]}
                                            />
                                            <Legend iconType="rect" wrapperStyle={{ paddingTop: '8px' }} />
                                            <Bar 
                                                yAxisId="left"
                                                dataKey="hours" 
                                                name="Total Hours" 
                                                fill="#3b82f6" 
                                                radius={[4, 4, 0, 0]}
                                                onClick={handleDraftingBarClick}
                                                cursor="pointer"
                                                barSize={30}
                                            />
                                            <Line 
                                                yAxisId="right"
                                                type="monotone" 
                                                dataKey="MoM" 
                                                name="MoM%" 
                                                stroke="#10b981" 
                                                strokeWidth={2}
                                                dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                                            />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                                    <p className="text-sm">当期无数据</p>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <Card className="border-slate-200/60 shadow-sm">
            <CardHeader>
                <CardTitle className="text-sm font-medium">Work Category Trends by Deal/Matter Category (Investment Related)</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4 grid-cols-1">
                    {dealCategories.map(({ label }) => (
                        <DealCategoryTrendChart 
                            key={label}
                            dealLabel={label}
                            data={(trendData as any)[label]?.data || []}
                            workCategories={(trendData as any)[label]?.workCategories || []}
                            colorMap={(trendData as any)[label]?.colorMap || {}}
                            maxBars={(trendData as any)[label]?.maxBars || 0}
                            draftingData={(trendData as any).draftingTrend?.[label]?.data || []}
                        />
                    ))}
                </div>
                <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} onSave={onDataUpdate ? handleSave : undefined} />
            </CardContent>
        </Card>
    );
};

const InvestmentLegalCenterPanel = ({ data, onDataUpdate }: { data: any[], onDataUpdate?: (updatedRecords: any[]) => void }) => {
    // Source Path group filter state
    const [selectedGroup, setSelectedGroup] = useState<string>('all');
    
    // Available groups for filtering
    const GROUP_OPTIONS = ['all', '1组', '2组', '3组', '4组', '5组', '6组'];
    
    // Pre-process data once: filter team and parse dates
    const allTeamData = useMemo(() => {
        return data
            .filter(row => row && row['团队'] === '投资法务中心')
            .map(row => ({
                ...row,
                _parsedDate: row['Month'] ? parseMonthString(row['Month']) : null
            }));
    }, [data]);
    
    // Filter by selected group based on Source Path
    const teamData = useMemo(() => {
        if (selectedGroup === 'all') return allTeamData;
        return allTeamData.filter(row => {
            const rawSourcePath = row['Source Path']?.toString() || '';
            const sourcePath = rawSourcePath.trim().replace('工时统计-', '').replace(/\s+/g, ' ');
            return sourcePath.includes(selectedGroup);
        });
    }, [allTeamData, selectedGroup]);

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
            const date = parseMonthString(month) || new Date();
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
            {/* Source Path Group Filter - Refined Pill/Tag Style */}
            <div className="relative">
                <div className="flex items-center gap-4 p-3 bg-gradient-to-r from-slate-50/80 to-white rounded-xl border border-slate-200/60 shadow-sm">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10">
                            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                        </div>
                        <span className="text-sm font-semibold text-slate-700 tracking-tight">Virtual Group</span>
                    </div>
                    
                    <div className="h-6 w-px bg-slate-200"></div>
                    
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {GROUP_OPTIONS.map(group => (
                            <button
                                key={group}
                                onClick={() => setSelectedGroup(group)}
                                className={cn(
                                    "relative px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ease-out",
                                    selectedGroup === group
                                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]"
                                        : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80 hover:border-slate-300"
                                )}
                            >
                                {group === 'all' ? '全部' : group}
                                {selectedGroup === group && group !== 'all' && (
                                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white ring-2 ring-white">
                                        ✓
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                    
                    {selectedGroup !== 'all' && (
                        <div className="ml-auto flex items-center gap-2">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
                                <span className="text-xs font-medium text-blue-700">
                                    {teamData.length} 条记录
                                </span>
                            </div>
                            <button
                                onClick={() => setSelectedGroup('all')}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                清除
                            </button>
                        </div>
                    )}
                </div>
            </div>
            
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
                        <BSCPieChartSection filteredData={filteredData} totalHours={totalHours} onDataUpdate={onDataUpdate} />
                    )}
                </FilterSection>
            </div>

            {/* Trend Charts - No Filter */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle className="text-sm font-medium">Comparison of Total Working Hours</CardTitle></CardHeader>
                    <CardContent className="pt-8">
                        <ResponsiveContainer width="100%" height={300}>
                            <ComposedChart data={trendData.monthlyTrends} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                <YAxis yAxisId="left" label={{ value: 'Hours', angle: -90, position: 'insideLeft', dx: -10, dy: 20, fontSize: 11 }} tick={{ fontSize: 12 }} />
                                <YAxis yAxisId="right" orientation="right" label={{ value: 'MoM%', angle: 90, position: 'insideRight', dy: 25, fontSize: 11 }} tick={{ fontSize: 12 }}/>
                                <Tooltip formatter={(value: number) => Number(value).toFixed(2)} />
                                <Legend iconType="rect" />
                                <Bar yAxisId="left" dataKey="totalHours" name="Total Hours" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                                <Line yAxisId="right" type="monotone" dataKey="totalHoursTrend" name="MoM%" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: "#10b981" }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-sm font-medium">Comparison of Monthly Avg Working Hours per person</CardTitle></CardHeader>
                    <CardContent className="pt-8">
                         <ResponsiveContainer width="100%" height={300}>
                            <ComposedChart data={trendData.monthlyTrends} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                <YAxis yAxisId="left" label={{ value: 'Hours', angle: -90, position: 'insideLeft', dx: -10, dy: 20, fontSize: 11 }} tick={{ fontSize: 12 }} />
                                <YAxis yAxisId="right" orientation="right" label={{ value: 'MoM%', angle: 90, position: 'insideRight', dy: 25, fontSize: 11 }} tick={{ fontSize: 12 }}/>
                                <Tooltip formatter={(value: number) => Number(value).toFixed(2)} />
                                <Legend content={() => (
                                    <div className="flex justify-center gap-6 mt-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#f59e0b' }}></div>
                                            <span className="text-sm text-gray-600">MoM%</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#0ea5e9' }}></div>
                                            <span className="text-sm text-gray-600">Avg Hours/Person</span>
                                        </div>
                                    </div>
                                )} />
                                <Bar yAxisId="left" dataKey="avgHoursPerUser" name="Avg Hours/Person" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                                <Line yAxisId="right" type="monotone" dataKey="avgHoursTrend" name="MoM%" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: "#f59e0b" }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Pie Chart Section - Full Width */}
            <FilterSection data={teamData} title="Hours Allocation by Deal/Matters Categories">
                {(filteredData, totalHours) => (
                     <DealCategoryPieChartSection filteredData={filteredData} totalHours={totalHours} onDataUpdate={onDataUpdate} />
                )}
            </FilterSection>
                
            {/* Utilization Trend - Full Width */}
            <Card className="border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-200">
                <CardHeader><CardTitle className="text-sm font-medium">Working Hour Utilization Trends by Deal/Matter Categories</CardTitle></CardHeader>
                <CardContent>
                    <UtilizationTrendChart data={trendData.utilizationTrends} teamData={teamData} onDataUpdate={onDataUpdate} />
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                <FilterSection data={teamData} title="Working Hours of M&A Deals - Per Target Companies">
                    {(filteredData) => {
                        const mAndADealsAgg: { [key: string]: { hours: number, name: string } } = {};
                        filteredData.filter(row => fieldsMatch(row['Deal/Matter Category'], 'Investment Related - M&A Deal') && row['Deal/Matter Name']).forEach(row => {
                                const rawName = row['Deal/Matter Name'].toString();
                                const name = normalizeCategoryDisplay(rawName);
                                if (!name) return;
                                const key = createNormalizedKey(name);
                                const hours = Number(row['Hours']) || 0;
                                if (!mAndADealsAgg[key]) mAndADealsAgg[key] = { hours: 0, name: name };
                                mAndADealsAgg[key].hours += hours;
                            });
                        const totalHours = Object.values(mAndADealsAgg).reduce((sum, item) => sum + item.hours, 0);
                        const mAndADeals = Object.values(mAndADealsAgg).map(({ name, hours }) => ({ 
                            name, 
                            hours,
                            percentage: totalHours > 0 ? (hours / totalHours) * 100 : 0
                        })).sort((a, b) => b.hours - a.hours);
                        const maxHours = mAndADeals.length > 0 ? Math.max(...mAndADeals.map(d => d.hours)) : 0;

                        return (
                            <div className="max-h-[420px] overflow-y-auto rounded-lg border border-slate-200/60">
                                <table className="w-full">
                                    <thead className="sticky top-0 z-10">
                                        <tr className="bg-gradient-to-r from-rose-50 to-orange-50 border-b border-slate-200/60">
                                            <th className="text-left py-1.5 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">Deal/Matter Name</th>
                                            <th className="text-right py-1.5 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wider w-24">Hours</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {mAndADeals.length > 0 ? mAndADeals.map((deal, idx) => (
                                            <tr 
                                                key={deal.name} 
                                                className="group hover:bg-gradient-to-r hover:from-rose-50/50 hover:to-transparent transition-all duration-200"
                                            >
                                                <td className="py-px px-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-slate-400 font-medium w-5 flex-shrink-0">{idx + 1}.</span>
                                                        <div 
                                                            className="w-1 h-3 rounded-full bg-gradient-to-b from-rose-400 to-rose-500 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                                        />
                                                        <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors font-medium truncate">
                                                            {deal.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-px px-3 text-right">
                                                    <ClickableHoursCell hours={deal.hours} dealName={deal.name} category="Investment Related - M&A Deal" filteredData={filteredData} percentage={deal.percentage} onDataUpdate={onDataUpdate} />
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
                                const name = normalizeCategoryDisplay(rawName);
                                if (!name) return;
                                const key = createNormalizedKey(name);
                                const hours = Number(row['Hours']) || 0;
                                if (!corporateMattersAgg[key]) corporateMattersAgg[key] = { hours: 0, name: name };
                                corporateMattersAgg[key].hours += hours;
                            });
                        const totalHours = Object.values(corporateMattersAgg).reduce((sum, item) => sum + item.hours, 0);
                        const corporateMatters = Object.values(corporateMattersAgg).map(({ name, hours }) => ({ 
                            name, 
                            hours,
                            percentage: totalHours > 0 ? (hours / totalHours) * 100 : 0
                        })).sort((a, b) => b.hours - a.hours);
                        const maxHours = corporateMatters.length > 0 ? Math.max(...corporateMatters.map(d => d.hours)) : 0;

                        return (
                            <div className="max-h-[420px] overflow-y-auto rounded-lg border border-slate-200/60">
                                <table className="w-full">
                                    <thead className="sticky top-0 z-10">
                                        <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200/60">
                                            <th className="text-left py-1.5 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">Deal/Matter Name</th>
                                            <th className="text-right py-1.5 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wider w-24">Hours</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {corporateMatters.length > 0 ? corporateMatters.map((matter, idx) => (
                                            <tr 
                                                key={matter.name} 
                                                className="group hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent transition-all duration-200"
                                            >
                                                <td className="py-px px-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-slate-400 font-medium w-5 flex-shrink-0">{idx + 1}.</span>
                                                        <div 
                                                            className="w-1 h-3 rounded-full bg-gradient-to-b from-blue-400 to-indigo-500 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                                        />
                                                        <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors font-medium truncate">
                                                            {matter.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-px px-3 text-right">
                                                    <ClickableHoursCell hours={matter.hours} dealName={matter.name} category="Investment Related - Corporate Matter" filteredData={filteredData} percentage={matter.percentage} onDataUpdate={onDataUpdate} />
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
                    <VirtualGroupHoursChart filteredData={filteredData} onDataUpdate={onDataUpdate} />
                )}
            </FilterSection>

            {/* Average Monthly Hour - Trend Chart - No Filter */}
            <AverageMonthlyHourPerPersonChart teamData={teamData} onDataUpdate={onDataUpdate} />

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
                                const groupFilteredData = filteredData.filter(row => {
                                    const rawSourcePath = row['Source Path']?.toString();
                                    const sourcePath = rawSourcePath ? rawSourcePath.trim() : '';
                                    return sourcePath && sourcePath.endsWith(targetSuffix);
                                });
                                groupFilteredData.forEach(row => {
                                    const rawName = row['Deal/Matter Name']?.toString();
                                    const name = rawName ? normalizeCategoryDisplay(rawName) : '';
                                    if (name) {
                                        const key = createNormalizedKey(name);
                                        const hours = Number(row['Hours']) || 0;
                                        if (!groupDataMap[key]) groupDataMap[key] = { hours: 0, name: name };
                                        groupDataMap[key].hours += hours;
                                    }
                                });
                                const groupTotalHours = Object.values(groupDataMap).reduce((sum, item) => sum + item.hours, 0);
                                const data = Object.values(groupDataMap).map(({ name, hours }) => ({ 
                                    name, 
                                    hours,
                                    percentage: groupTotalHours > 0 ? (hours / groupTotalHours) * 100 : 0
                                })).sort((a, b) => b.hours - a.hours);
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
                                        <div className="h-[310px] overflow-y-auto">
                                            <table className="w-full">
                                                <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm">
                                                    <tr className="border-b border-slate-100">
                                                        <th className="text-left py-1 px-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                                                        <th className="text-right py-1 px-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider w-20">Hours</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {data.length > 0 ? data.map((item, idx) => (
                                                        <tr 
                                                            key={idx} 
                                                            className={`group hover:bg-gradient-to-r ${colorScheme.bgHover} hover:to-transparent transition-all duration-200`}
                                                        >
                                                            <td className="py-px px-2">
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-[10px] text-slate-400 w-4 flex-shrink-0">{idx + 1}.</span>
                                                                    <div 
                                                                        className={`w-1 h-3 rounded-full bg-gradient-to-b ${colorScheme.from} ${colorScheme.to} opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0`}
                                                                    />
                                                                    <span className="text-[11px] text-slate-600 group-hover:text-slate-800 transition-colors truncate max-w-[110px]" title={item.name}>
                                                                        {item.name}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="py-px px-2 text-right">
                                                                <ClickableHoursCell 
                                                                    hours={item.hours} 
                                                                    dealName={item.name} 
                                                                    category={groupName} 
                                                                    filteredData={groupFilteredData} 
                                                                    isGroup={true}
                                                                    percentage={item.percentage}
                                                                    onDataUpdate={onDataUpdate}
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

            {/* Investment Work Category Section with shared time filter */}
            <InvestmentWorkCategorySection teamData={teamData} onDataUpdate={onDataUpdate} />

            {/* Work Category Trends by Deal/Matter Categories */}
            <WorkCategoryTrendsByDealMatter teamData={teamData} onDataUpdate={onDataUpdate} />
        </div>
    );
}

const WorkCategoryComparisonChart = ({ data, workCategoryList, teamData, onDataUpdate }: { data: any[], workCategoryList: string[], teamData: any[], onDataUpdate?: (updatedRecords: any[]) => void }) => {
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
            const rowMonth = normalizeMonthString(row['Month']);
            if (!rowMonth) return false;
            const rawCat = row['Work Category']?.toString();
            if (!rawCat) return false;
            return rowMonth === monthStr && fieldsMatch(rawCat, categoryName);
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

    const handleSave = (updatedRecords: any[]) => {
        if (onDataUpdate) {
            onDataUpdate(updatedRecords);
        }
    };

    // Premium tooltip - matching InternalClientMonthlyTrendChart style
    const PremiumCategoryTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;
        
        const total = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);
        
        // 按工时排序
        const sortedPayload = [...payload].sort((a: any, b: any) => (b.value || 0) - (a.value || 0));
        
        // Determine tooltip position based on month - show on left side starting from October
        const shouldShowOnLeft = (() => {
            if (!label) return false;
            // Extract month number from format like "2025/10" or "2025-10"
            const monthMatch = label.match(/[\/\-](\d{1,2})$/);
            if (monthMatch) {
                const monthNum = parseInt(monthMatch[1], 10);
                return monthNum >= 10; // October (10), November (11), December (12)
            }
            return false;
        })();
        
        const handleTooltipItemClick = (categoryName: string) => {
            const monthStr = label;
            const details = teamData.filter(row => {
                if (!row || !row['Month'] || !row['Work Category']) return false;
                const rowMonth = normalizeMonthString(row['Month']);
                if (!rowMonth) return false;
                const rawCat = row['Work Category']?.toString();
                if (!rawCat) return false;
                return rowMonth === monthStr && fieldsMatch(rawCat, categoryName);
            });
            
            setDialogTitle(`${categoryName} - ${monthStr}`);
            setDialogData(details);
            setIsDialogOpen(true);
        };
        
        return (
            <div 
                className="bg-white border border-slate-200 rounded-xl shadow-2xl p-4 min-w-[260px]"
                style={{ 
                    pointerEvents: 'auto',
                    transform: shouldShowOnLeft ? 'translateX(-100%)' : 'translateX(0)',
                    zIndex: 9999,
                    position: 'relative'
                }}
            >
                <div className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">
                    {label}
                </div>
                <div 
                    className="space-y-2 overflow-y-auto pr-1"
                    style={{ maxHeight: '300px' }}
                    onWheel={(e) => e.stopPropagation()}
                >
                    {sortedPayload.map((entry: any, index: number) => {
                        // 找到该 category 在 workCategoryList 中的索引以获取正确颜色
                        const categoryIndex = workCategoryList?.findIndex((cat: string) => cat === entry.name) ?? index;
                        const color = CATEGORY_COLORS[categoryIndex % CATEGORY_COLORS.length];
                        const percent = total > 0 ? ((Number(entry.value) / total) * 100).toFixed(1) : 0;
                        return (
                            <div 
                                key={index} 
                                className="flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5 transition-colors"
                                onClick={() => handleTooltipItemClick(entry.name)}
                                title={entry.name}
                            >
                                <div className="flex items-center gap-2">
                                    <div 
                                        className="w-3 h-3 rounded-full shadow-sm flex-shrink-0"
                                        style={{ backgroundColor: color }}
                                    />
                                    <span className="text-xs text-slate-600 truncate max-w-[140px]">{entry.name}</span>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <span className="text-xs font-semibold text-slate-800">
                                        {Number(entry.value).toFixed(1)}h
                                    </span>
                                    <span className="text-[10px] text-slate-400 ml-1">
                                        ({percent}%)
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between">
                    <span className="text-xs font-medium text-slate-600">Total</span>
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
                <CardContent style={{ overflow: 'visible' }}>
                    <div className="relative" style={{ overflow: 'visible' }}>
                        <div className="text-xs text-slate-400 mb-3 flex items-center gap-1.5">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                            Click on legend labels or bars to view detailed data
                        </div>
                        
                        {/* Custom Legend */}
                        <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
                            {workCategoryList?.map((category, index) => (
                                <div 
                                    key={category} 
                                    className="flex items-center gap-2 group cursor-pointer"
                                    onClick={() => handleLegendClick({ dataKey: category })}
                                >
                                    <div 
                                        className="w-3 h-3 rounded-full group-hover:scale-110 transition-transform"
                                        style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                                    />
                                    <span className="text-xs font-medium text-slate-600 group-hover:text-slate-800 transition-colors truncate max-w-[100px]">{category}</span>
                                </div>
                            ))}
                        </div>
                        
                        <div style={{ overflow: 'visible', minHeight: '500px' }}>
                            <ResponsiveContainer width="100%" height={450}>
                                <BarChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }} barCategoryGap="15%">
                                    <defs>
                                        {CATEGORY_COLORS.map((color, index) => (
                                            <linearGradient key={`catGrad${index}`} id={`catGradient${index}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={color} stopOpacity={0.9}/>
                                                <stop offset="100%" stopColor={color} stopOpacity={0.7}/>
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} vertical={false} />
                                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
                                    <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: '#64748b' } }} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
                                    <Tooltip 
                                        content={<PremiumCategoryTooltip />}
                                        wrapperStyle={{ 
                                            pointerEvents: 'auto', 
                                            zIndex: 9999,
                                            overflow: 'visible',
                                            visibility: 'visible'
                                        }}
                                        allowEscapeViewBox={{ x: true, y: true }}
                                        position={{ y: 0 }}
                                    />
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
                        
                        {/* Hint text */}
                        <div className="text-xs text-slate-400 text-center mt-2">
                            Click on bars or legend items to view detailed records
                        </div>
                    </div>
                </CardContent>
            </Card>
            <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} onSave={onDataUpdate ? handleSave : undefined} />
        </>
    );
};

// BSC Items Comparison Chart Component
const BSCItemsComparisonChart = ({ teamData, onDataUpdate }: { teamData: any[], onDataUpdate?: (updatedRecords: any[]) => void }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any[]>([]);
    const [dialogTitle, setDialogTitle] = useState('');

    // Color palette for BSC items
    const BSC_COLORS = [
        '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', 
        '#ec4899', '#84cc16', '#f97316', '#8b5cf6', '#14b8a6',
        '#f43f5e', '#0ea5e9', '#a855f7', '#22c55e', '#eab308',
        '#3b82f6', '#d946ef', '#64748b', '#0d9488', '#dc2626'
    ];

    // Helper function to check valid OKR/BSC Tag
    const isValidOkrBscTag = (tag: string | undefined | null): boolean => {
        if (!tag) return false;
        const cleanTag = tag.toString().replace(/^_/, '').trim().toLowerCase();
        return cleanTag === 'okr' || cleanTag === 'bsc';
    };

    // Process data for chart - grouped bar chart with bars sorted by hours within each month
    const { chartData, bscItemList, bscItemColorMap, maxBarsPerMonth } = useMemo(() => {
        // Step 1 & 2: Filter by team (already done) and OKR/BSC Tag
        const filteredData = teamData.filter(row => isValidOkrBscTag(row['OKR/BSC Tag']));

        // Step 3: Aggregate by Month and OKR/BSC Item
        const monthItemAgg: { [month: string]: { [item: string]: number } } = {};
        const itemTotals: { [item: string]: number } = {};
        const normalizedItemMap: { [key: string]: string } = {};

        filteredData.forEach(row => {
            const rawMonth = row['Month'];
            const rawItem = row['OKR/BSC Item']?.toString();
            const hours = Number(row['Hours']) || 0;

            if (!rawMonth || !rawItem || hours <= 0) return;

            const monthStr = normalizeMonthString(rawMonth);
            if (!monthStr) return;

            // Normalize item name to handle input variations
            const cleanItem = normalizeCategoryDisplay(rawItem);
            const itemKey = createNormalizedKey(cleanItem);
            
            if (!normalizedItemMap[itemKey]) {
                normalizedItemMap[itemKey] = cleanItem;
            }
            const displayItem = normalizedItemMap[itemKey];

            if (!monthItemAgg[monthStr]) monthItemAgg[monthStr] = {};
            monthItemAgg[monthStr][displayItem] = (monthItemAgg[monthStr][displayItem] || 0) + hours;
            itemTotals[displayItem] = (itemTotals[displayItem] || 0) + hours;
        });

        // Get all unique items sorted by total hours (for legend and color mapping)
        const sortedItems = Object.entries(itemTotals)
            .sort((a, b) => b[1] - a[1])
            .map(([item]) => item);

        // Create color map
        const colorMap: { [item: string]: string } = {};
        sortedItems.forEach((item, idx) => {
            colorMap[item] = BSC_COLORS[idx % BSC_COLORS.length];
        });

        // Create chart data: each month has bars sorted by hours (descending)
        // Use position-based keys (bar0, bar1, bar2...) with item and color info
        const sortedMonths = Object.keys(monthItemAgg).sort();
        let maxBars = 0;
        
        const data = sortedMonths.map(month => {
            const monthData = monthItemAgg[month];
            // Sort items by hours within this month (descending)
            const sortedMonthItems = Object.entries(monthData)
                .sort((a, b) => b[1] - a[1]);
            
            maxBars = Math.max(maxBars, sortedMonthItems.length);
            
            const entry: any = { month };
            sortedMonthItems.forEach(([item, hours], idx) => {
                entry[`bar${idx}`] = hours;
                entry[`bar${idx}_item`] = item;
                entry[`bar${idx}_color`] = colorMap[item];
            });
            return entry;
        });

        return { chartData: data, bscItemList: sortedItems, bscItemColorMap: colorMap, maxBarsPerMonth: maxBars };
    }, [teamData]);

    const handleBarClick = (barData: any, barIndex: number) => {
        if (!barData || !barData.month) return;
        const monthStr = barData.month;
        const itemName = barData[`bar${barIndex}_item`];
        if (!itemName) return;
        
        const details = teamData.filter(row => {
            if (!isValidOkrBscTag(row['OKR/BSC Tag'])) return false;
            const rawMonth = row['Month'];
            const rawItem = row['OKR/BSC Item']?.toString();
            if (!rawMonth || !rawItem) return false;
            
            const rowMonth = normalizeMonthString(rawMonth);
            return rowMonth === monthStr && fieldsMatch(rawItem, itemName);
        });
        
        setDialogTitle(`${itemName} - ${monthStr}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    const handleLegendClick = (item: string) => {
        const details = teamData.filter(row => {
            if (!isValidOkrBscTag(row['OKR/BSC Tag'])) return false;
            const rawItem = row['OKR/BSC Item']?.toString();
            return rawItem && fieldsMatch(rawItem, item);
        });
        
        setDialogTitle(`All records for ${item}`);
        setDialogData(details);
        setIsDialogOpen(true);
    };

    const handleSave = (updatedRecords: any[]) => {
        if (onDataUpdate) {
            onDataUpdate(updatedRecords);
        }
    };

    // Custom Tooltip for grouped bar chart
    const BSCItemsTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;
        
        // Filter out bars with no value and sort by value descending
        const validBars = payload
            .filter((entry: any) => entry.value > 0)
            .sort((a: any, b: any) => (b.value || 0) - (a.value || 0));
        
        if (validBars.length === 0) return null;
        
        const total = validBars.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);
        
        // Determine tooltip position based on month - show on left side starting from October
        const shouldShowOnLeft = (() => {
            if (!label) return false;
            // Extract month number from format like "2025/10" or "2025-10"
            const monthMatch = label.match(/[\/\-](\d{1,2})$/);
            if (monthMatch) {
                const monthNum = parseInt(monthMatch[1], 10);
                return monthNum >= 10; // October (10), November (11), December (12)
            }
            return false;
        })();
        
        const handleTooltipItemClick = (itemName: string) => {
            const monthStr = label;
            const details = teamData.filter(row => {
                if (!isValidOkrBscTag(row['OKR/BSC Tag'])) return false;
                const rawMonth = row['Month'];
                const rawItem = row['OKR/BSC Item']?.toString();
                if (!rawMonth || !rawItem) return false;
                
                const rowMonth = normalizeMonthString(rawMonth);
                return rowMonth === monthStr && fieldsMatch(rawItem, itemName);
            });
            
            setDialogTitle(`${itemName} - ${monthStr}`);
            setDialogData(details);
            setIsDialogOpen(true);
        };
        
        return (
            <div 
                className="bg-white border border-slate-200 rounded-xl shadow-2xl p-4 min-w-[280px]"
                style={{ 
                    pointerEvents: 'auto',
                    transform: shouldShowOnLeft ? 'translateX(-100%)' : 'translateX(0)',
                    zIndex: 9999,
                    position: 'relative'
                }}
            >
                <div className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">
                    {label}
                </div>
                <div 
                    className="space-y-2 overflow-y-auto pr-1"
                    style={{ maxHeight: '300px' }}
                    onWheel={(e) => e.stopPropagation()}
                >
                    {validBars.map((entry: any, index: number) => {
                        const barIndex = parseInt(entry.dataKey.replace('bar', ''));
                        const itemName = entry.payload[`bar${barIndex}_item`];
                        const itemColor = entry.payload[`bar${barIndex}_color`];
                        return (
                            <div 
                                key={index} 
                                className="flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5 transition-colors"
                                onClick={() => handleTooltipItemClick(itemName)}
                                title={itemName}
                            >
                                <div className="flex items-center gap-2">
                                    <div 
                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: itemColor }}
                                    />
                                    <span className="text-xs text-slate-600 truncate max-w-[160px]">{itemName}</span>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <span className="text-xs font-semibold text-slate-800">
                                        {Number(entry.value).toFixed(1)}h
                                    </span>
                                    <span className="text-[10px] text-slate-400 ml-1">
                                        ({((entry.value / total) * 100).toFixed(1)}%)
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between">
                    <span className="text-xs font-medium text-slate-600">Total</span>
                    <span className="text-xs font-bold text-slate-800">{total.toFixed(1)}h</span>
                </div>
            </div>
        );
    };

    if (chartData.length === 0 || bscItemList.length === 0) {
        return (
            <div className="flex items-center justify-center h-[300px] text-slate-400 text-sm">
                No BSC Items data available
            </div>
        );
    }

    return (
        <>
            <div className="relative" style={{ overflow: 'visible' }}>
                <div className="text-xs text-slate-400 mb-3 flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    Click on legend labels or bars to view detailed data
                </div>
                
                {/* Custom Legend */}
                <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
                    {bscItemList.map((item) => (
                        <div 
                            key={item} 
                            className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-slate-100 cursor-pointer transition-colors"
                            onClick={() => handleLegendClick(item)}
                        >
                            <div 
                                className="w-3 h-3 rounded-sm"
                                style={{ backgroundColor: bscItemColorMap[item] }}
                            />
                            <span className="text-xs text-slate-600 hover:text-slate-800 truncate max-w-[150px]">{item}</span>
                        </div>
                    ))}
                </div>
                
                <div style={{ overflow: 'visible', minHeight: '500px' }}>
                    <ResponsiveContainer width="100%" height={450}>
                        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} vertical={false} />
                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                            <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: '#64748b' } }} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                            <Tooltip 
                                content={<BSCItemsTooltip />} 
                                cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                                wrapperStyle={{ pointerEvents: 'auto', zIndex: 9999, overflow: 'visible', visibility: 'visible' }}
                                allowEscapeViewBox={{ x: true, y: true }}
                                position={{ y: 0 }}
                            />
                            {Array.from({ length: maxBarsPerMonth }, (_, idx) => (
                                <Bar 
                                    key={`bar${idx}`} 
                                    dataKey={`bar${idx}`}
                                onClick={(barData) => handleBarClick(barData, idx)} 
                                cursor="pointer"
                                radius={[2, 2, 0, 0]}
                            >
                                {chartData.map((entry, entryIdx) => (
                                    <Cell 
                                        key={`cell-${entryIdx}`} 
                                        fill={entry[`bar${idx}_color`] || 'transparent'}
                                    />
                                ))}
                            </Bar>
                        ))}
                    </BarChart>
                </ResponsiveContainer>
                </div>
            </div>
            <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} onSave={onDataUpdate ? handleSave : undefined} />
        </>
    );
};

const CorporateFinancePanel = ({ data, onDataUpdate }: { data: any[], onDataUpdate?: (updatedRecords: any[]) => void }) => {
    // Pre-process data once: filter team and parse dates
    const teamData = useMemo(() => {
        return data
            .filter(row => row && row['团队'] === '公司及国际金融事务中心')
            .map(row => ({
                ...row,
                _parsedDate: row['Month'] ? parseMonthString(row['Month']) : null
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
            const date = parseMonthString(month) || new Date();
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
            const category = normalizeCategoryDisplay(rawCat);
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

                        // Handle save from DetailsDialog
                        const handleSave = (updatedData: any[]) => {
                            if (onDataUpdate) {
                                onDataUpdate(updatedData);
                            }
                        };

                        const bscHours: { [key: string]: { hours: number; name: string } } = {};
                        filteredData.forEach(row => {
                            const rawTag = row['OKR/BSC Tag']?.toString() || 'uncategoried';
                            const tag = normalizeCategoryDisplay(rawTag);
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
                                                            (entry.payload as any).name
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
                                <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} onSave={onDataUpdate ? handleSave : undefined} />
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
                            <ComposedChart data={trendData.monthlyTrends} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                <YAxis yAxisId="left" label={{ value: 'Hours', angle: -90, position: 'insideLeft', dx: -10, dy: 20, fontSize: 11 }} tick={{ fontSize: 12 }} />
                                <YAxis yAxisId="right" orientation="right" label={{ value: 'MoM%', angle: 90, position: 'insideRight', dy: 25, fontSize: 11 }} tick={{ fontSize: 12 }}/>
                                <Tooltip formatter={(value: number) => Number(value).toFixed(2)} />
                                <Legend iconType="rect" />
                                <Bar yAxisId="left" dataKey="totalHours" name="Total Hours" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                                <Line yAxisId="right" type="monotone" dataKey="totalHoursTrend" name="MoM%" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: "#10b981" }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-sm font-medium">Comparison of Monthly Avg Working Hours per person</CardTitle></CardHeader>
                    <CardContent className="pt-8">
                         <ResponsiveContainer width="100%" height={300}>
                            <ComposedChart data={trendData.monthlyTrends} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                <YAxis yAxisId="left" label={{ value: 'Hours', angle: -90, position: 'insideLeft', dx: -10, dy: 20, fontSize: 11 }} tick={{ fontSize: 12 }} />
                                <YAxis yAxisId="right" orientation="right" label={{ value: 'MoM%', angle: 90, position: 'insideRight', dy: 25, fontSize: 11 }} tick={{ fontSize: 12 }}/>
                                <Tooltip formatter={(value: number) => Number(value).toFixed(2)} />
                                <Legend content={() => (
                                    <div className="flex justify-center gap-6 mt-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#f59e0b' }}></div>
                                            <span className="text-sm text-gray-600">MoM%</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#0ea5e9' }}></div>
                                            <span className="text-sm text-gray-600">Avg Hours/Person</span>
                                        </div>
                                    </div>
                                )} />
                                <Bar yAxisId="left" dataKey="avgHoursPerUser" name="Avg Hours/Person" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                                <Line yAxisId="right" type="monotone" dataKey="avgHoursTrend" name="MoM%" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: "#f59e0b" }} />
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

                        // Handle save from DetailsDialog
                        const handleSave = (updatedData: any[]) => {
                            if (onDataUpdate) {
                                onDataUpdate(updatedData);
                            }
                        };

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
                                            <div className="w-[45%] min-w-[180px] pl-4">
                                                <ResponsiveContainer width="100%" height={220}>
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
                                                                (entry.payload as any).name
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
                                            </div>
                                            {/* Custom Legend */}
                                            <div className="flex-1 space-y-1 overflow-hidden">
                                                {virtualGroupPieData.map((entry, index) => (
                                                    <div 
                                                        key={entry.name}
                                                        className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all group"
                                                        onClick={() => handleLegendClick({ value: entry.name })}
                                                    >
                                                        <div 
                                                            className="w-2.5 h-2.5 rounded flex-shrink-0 group-hover:scale-110 transition-transform"
                                                            style={{ backgroundColor: VG_COLORS[index % VG_COLORS.length] }}
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-[10px] font-medium text-slate-700 dark:text-slate-200 truncate">
                                                                {entry.name}
                                                            </div>
                                                        </div>
                                                        <div className="text-right flex-shrink-0">
                                                            <div className="text-[10px] font-semibold" style={{ color: VG_COLORS[index % VG_COLORS.length] }}>
                                                                {entry.value.toFixed(0)}h
                                                            </div>
                                                            <div className="text-[9px] text-slate-500">
                                                                {entry.percentage.toFixed(1)}%
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                ) : <div className="h-full flex items-center justify-center text-muted-foreground"><p>当期无虚拟组数据</p></div>}
                                <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} onSave={onDataUpdate ? handleSave : undefined} />
                            </div>
                        );
                    }}
                </FilterSection>

                {/* Virtual Group Comparison - Trend - No Filter */}
                <Card>
                    <CardHeader><CardTitle className="text-sm font-medium">Comparison of Virtual Groups</CardTitle></CardHeader>
                    <CardContent className="pt-16 pb-12">
                        <VirtualGroupTrendChart data={trendData.virtualGroupTrendData} teamData={teamData} groupList={trendData.virtualGroupList || []} onDataUpdate={onDataUpdate} />
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 grid-cols-1">
                 <FilterSection data={teamData} title="Working Hours (Internal Client)">
                    {(filteredData) => {
                        const [isDialogOpen, setIsDialogOpen] = useState(false);
                        const [dialogData, setDialogData] = useState<any[]>([]);
                        const [dialogTitle, setDialogTitle] = useState('');

                        // Handle save from DetailsDialog
                        const handleSave = (updatedData: any[]) => {
                            if (onDataUpdate) {
                                onDataUpdate(updatedData);
                            }
                        };

                        const internalClientAgg: { [key: string]: { hours: number, displayName: string } } = {};
                        filteredData.forEach(row => {
                            const rawName = row['Deal/Matter Name']?.toString();
                            if (!rawName) return;
                            const cleanName = normalizeCategoryDisplay(rawName);
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

                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const handleLegendClick = (_e: any) => {
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
                                <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} onSave={onDataUpdate ? handleSave : undefined} />
                            </div>
                        );
                    }}
                </FilterSection>

                {/* Monthly Internal Client Hours Trend Chart */}
                <Card className="border-slate-200/60 shadow-sm hover:shadow-md transition-shadow duration-300" style={{ overflow: 'visible' }}>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-slate-800">Monthly Working Hours by Internal Client</CardTitle>
                    </CardHeader>
                    <CardContent style={{ overflow: 'visible' }}>
                        <InternalClientMonthlyTrendChart teamData={teamData} onDataUpdate={onDataUpdate} />
                    </CardContent>
                </Card>

                 <FilterSection data={teamData} title="Working Hours (Work Category)">
                    {(filteredData) => {
                        const [isDialogOpen, setIsDialogOpen] = useState(false);
                        const [dialogData, setDialogData] = useState<any[]>([]);
                        const [dialogTitle, setDialogTitle] = useState('');

                        const workCategoryAgg: { [key: string]: { hours: number, displayName: string } } = {};
                        filteredData.forEach(row => {
                            const rawCat = row['Work Category']?.toString();
                            if (!rawCat) return;
                            const category = normalizeCategoryDisplay(rawCat);
                            const normalizedKey = createNormalizedKey(category);
                            const hours = Number(row['Hours']) || 0;
                            if (hours > 0) {
                                if (!workCategoryAgg[normalizedKey]) workCategoryAgg[normalizedKey] = { hours: 0, displayName: category };
                                workCategoryAgg[normalizedKey].hours += hours;
                            }
                        });
                        const workCategoryData = Object.values(workCategoryAgg).map(item => ({ name: item.displayName, hours: item.hours })).sort((a, b) => b.hours - a.hours);
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const _maxHours = workCategoryData.length > 0 ? Math.max(...workCategoryData.map(d => d.hours)) : 0;

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

                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const handleLegendClick = (_e: any) => {
                            const details = filteredData.filter(row => {
                                const rawCat = row['Work Category']?.toString();
                                return rawCat && rawCat.trim();
                            });
                            setDialogTitle('All Work Categories');
                            setDialogData(details);
                            setIsDialogOpen(true);
                        };

                        const handleSave = (updatedRecords: any[]) => {
                            if (onDataUpdate) {
                                onDataUpdate(updatedRecords);
                            }
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
                                <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} onSave={onDataUpdate ? handleSave : undefined} />
                            </div>
                        );
                    }}
                </FilterSection>
            </div>

            {/* Work Category Comparison - Trend - No Filter */}
            <WorkCategoryComparisonChart data={trendData.workCategoryTrendData} workCategoryList={trendData.workCategoryList || []} teamData={teamData} onDataUpdate={onDataUpdate} />

            {/* Working Hours (BSC items) - New Section */}
            <FilterSection data={teamData} title="Working Hours (BSC items)">
                {(filteredData) => {
                    const [isDialogOpen, setIsDialogOpen] = useState(false);
                    const [dialogData, setDialogData] = useState<any[]>([]);
                    const [dialogTitle, setDialogTitle] = useState('');

                    // Premium color scheme matching Groups 1-6 style
                    const BSC_COLOR_SCHEME = {
                        from: 'from-indigo-400',
                        to: 'to-violet-500',
                        bg: 'from-indigo-50',
                        bgHover: 'hover:from-indigo-50/50',
                        gradient: ['#6366f1', '#8b5cf6']
                    };

                    // Step 1: Filter by team "公司及国际金融事务中心" (already done by teamData)
                    // Step 2: Filter by OKR/BSC Tag - must be "OKR" or "BSC" (case-insensitive, ignore leading underscore)
                    const isValidOkrBscTag = (tag: string | undefined | null): boolean => {
                        if (!tag) return false;
                        // Remove leading underscore and trim, then compare case-insensitively
                        const cleanTag = tag.toString().replace(/^_/, '').trim().toLowerCase();
                        return cleanTag === 'okr' || cleanTag === 'bsc';
                    };

                    // Filter data by OKR/BSC Tag
                    const okrBscFilteredData = filteredData.filter(row => isValidOkrBscTag(row['OKR/BSC Tag']));

                    // Step 3: Aggregate hours by OKR/BSC Item
                    const bscItemsAgg: { [key: string]: { hours: number, displayName: string } } = {};
                    okrBscFilteredData.forEach(row => {
                        const rawItem = row['OKR/BSC Item']?.toString();
                        if (!rawItem) return;
                        const cleanItem = normalizeCategoryDisplay(rawItem);
                        if (!cleanItem) return;
                        const normalizedKey = createNormalizedKey(cleanItem);
                        const hours = Number(row['Hours']) || 0;
                        if (hours > 0) {
                            if (!bscItemsAgg[normalizedKey]) bscItemsAgg[normalizedKey] = { hours: 0, displayName: cleanItem };
                            bscItemsAgg[normalizedKey].hours += hours;
                        }
                    });

                    // Calculate total hours from filtered data
                    const totalHours = Object.values(bscItemsAgg).reduce((sum, item) => sum + item.hours, 0);

                    const bscItemsData = Object.values(bscItemsAgg)
                        .map(item => ({ 
                            name: item.displayName, 
                            hours: item.hours,
                            percentage: totalHours > 0 ? (item.hours / totalHours) * 100 : 0
                        }))
                        .sort((a, b) => b.hours - a.hours);

                    const handleHoursClick = (itemName: string) => {
                        const details = okrBscFilteredData.filter(row => {
                            const rawItem = row['OKR/BSC Item']?.toString();
                            if (!rawItem) return false;
                            return fieldsMatch(rawItem, itemName);
                        });
                        setDialogTitle(`Details for ${itemName}`);
                        setDialogData(details);
                        setIsDialogOpen(true);
                    };

                    const handleTotalClick = () => {
                        setDialogTitle('All BSC Items Details');
                        setDialogData(okrBscFilteredData);
                        setIsDialogOpen(true);
                    };

                    const handleSave = (updatedRecords: any[]) => {
                        if (onDataUpdate) {
                            onDataUpdate(updatedRecords);
                        }
                    };

                    return (
                        <div className="relative">
                            <div className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                Click on hours to view detailed data
                            </div>
                            <div className="rounded-xl border border-slate-200/60 overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
                                {/* Header */}
                                <div className={`bg-gradient-to-r ${BSC_COLOR_SCHEME.bg} to-white px-4 py-3 border-b border-slate-100`}>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${BSC_COLOR_SCHEME.from} ${BSC_COLOR_SCHEME.to}`} />
                                        <h4 className="text-sm font-semibold text-slate-700">BSC Items Breakdown</h4>
                                        <span className="ml-auto text-xs text-slate-400">{bscItemsData.length} items · Total: {totalHours.toFixed(1)}h</span>
                                    </div>
                                </div>
                                
                                {/* Table Content */}
                                <div className="max-h-[400px] overflow-y-auto">
                                    <table className="w-full">
                                        <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm">
                                            <tr className="border-b border-slate-100">
                                                <th className="text-left py-2.5 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">OKR/BSC Item</th>
                                                <th className="text-right py-2.5 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider w-28">Hours</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {bscItemsData.length > 0 ? bscItemsData.map((item, idx) => (
                                                <tr 
                                                    key={idx} 
                                                    className={`group hover:bg-gradient-to-r ${BSC_COLOR_SCHEME.bgHover} hover:to-transparent transition-all duration-200`}
                                                >
                                                    <td className="py-3 px-4">
                                                        <span className="text-sm text-slate-600 group-hover:text-slate-800 transition-colors" title={item.name}>
                                                            {item.name}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <span 
                                                            className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 tabular-nums cursor-pointer underline decoration-dotted underline-offset-2"
                                                            onClick={() => handleHoursClick(item.name)}
                                                        >
                                                            {item.hours.toFixed(1)}h
                                                        </span>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan={2} className="text-center py-8 text-slate-300 text-sm">当期无BSC Items数据</td>
                                                </tr>
                                            )}
                                        </tbody>
                                        {bscItemsData.length > 0 && (
                                            <tfoot className="sticky bottom-0 bg-slate-50/95 backdrop-blur-sm border-t border-slate-200">
                                                <tr>
                                                    <td className="py-2.5 px-4 text-sm font-semibold text-slate-700">Total</td>
                                                    <td className="py-2.5 px-4 text-right">
                                                        <span 
                                                            className="text-sm font-bold text-indigo-600 hover:text-indigo-800 tabular-nums cursor-pointer underline decoration-dotted underline-offset-2"
                                                            onClick={handleTotalClick}
                                                        >
                                                            {totalHours.toFixed(1)}h
                                                        </span>
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            </div>
                            <DetailsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={dialogTitle} data={dialogData} onSave={onDataUpdate ? handleSave : undefined} />
                        </div>
                    );
                }}
            </FilterSection>

            {/* (13) Comparison of BSC Items */}
            <Card className="border-slate-200/60 shadow-sm hover:shadow-md transition-shadow duration-300" style={{ overflow: 'visible' }}>
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-slate-800">Comparison of BSC Items</CardTitle>
                </CardHeader>
                <CardContent style={{ overflow: 'visible' }}>
                    <BSCItemsComparisonChart teamData={teamData} onDataUpdate={onDataUpdate} />
                </CardContent>
            </Card>
        </div>
    );
}

export function TeamDimensionTab({ data, onDataUpdate, dataSourceType }: { data: any[], onDataUpdate?: (updatedRecords: any[]) => void, dataSourceType?: 'excel' | 'timesheet' | 'merged' | null }) {
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

  // 无数据时的展示
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-neutral-500">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-lg font-medium">请先导入工时数据</p>
          <p className="text-sm text-neutral-400 mt-1">导入数据后可查看分团队工时分析</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 py-2 bg-transparent min-h-screen">
      {/* 工时记录数据来源提示 */}
      {dataSourceType === 'timesheet' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 flex-shrink-0">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <div className="text-sm text-blue-800">
            <span className="font-medium">提示：</span>
            当前数据来源于工时记录。您可以在此修改数据并导出，修改不会影响原始工时记录。
          </div>
        </div>
      )}
      
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
                {activeSubTab === 'investment-legal' && <InvestmentLegalCenterPanel data={data} onDataUpdate={onDataUpdate} />}
              </TabsContent>
              <TabsContent value="corporate-finance" className="mt-6 space-y-6 focus-visible:outline-none animate-in fade-in-50 duration-300">
                {activeSubTab === 'corporate-finance' && <CorporateFinancePanel data={data} onDataUpdate={onDataUpdate} />}
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}
