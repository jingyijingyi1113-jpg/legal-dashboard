import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTimesheet } from '@/contexts/TimesheetContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { timesheetApi } from '@/api';
import type { TimesheetEntry, TemplateField, FieldOption } from '@/types/timesheet';
import { getTeamTemplateByName, getChildOptions } from '@/config/teamTemplates';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

// 自定义下拉框组件
interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  icon?: React.ReactNode;
}

function CustomSelect({ value, onChange, options, placeholder, icon }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  
  const selectedOption = options.find(opt => opt.value === value);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={selectRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200",
          "bg-white border-2 shadow-sm",
          isOpen 
            ? "border-blue-400 ring-4 ring-blue-500/10" 
            : "border-slate-200 hover:border-slate-300 hover:shadow-md",
          "focus:outline-none"
        )}
      >
        {icon && <span className="text-slate-400 flex-shrink-0">{icon}</span>}
        <span className={cn(
          "flex-1 text-left truncate",
          selectedOption ? "text-slate-700" : "text-slate-400"
        )}>
          {selectedOption?.label || placeholder}
        </span>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className={cn(
            "text-slate-400 transition-transform duration-200 flex-shrink-0",
            isOpen && "rotate-180"
          )}
        >
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute z-50 left-0 min-w-full w-max mt-2 py-1.5 bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-200/50 max-h-64 overflow-auto animate-in fade-in-0 zoom-in-95 duration-150">
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3.5 py-2.5 text-sm transition-colors text-left whitespace-nowrap",
                "hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50",
                option.value === value 
                  ? "text-blue-600 font-medium bg-blue-50/50" 
                  : "text-slate-600",
                index === 0 && "rounded-t-lg",
                index === options.length - 1 && "rounded-b-lg"
              )}
            >
              <span className="w-4 flex-shrink-0 flex items-center justify-center">
                {option.value === value && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// 团队颜色配置
const teamColors: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  '投资法务中心': {
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-200',
    dot: 'bg-violet-500'
  },
  '业务管理及合规检测中心': {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    dot: 'bg-sky-500'
  },
  '公司及国际金融事务中心': {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500'
  },
};

// 获取团队颜色
function getTeamColor(teamName: string) {
  return teamColors[teamName] || {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
    dot: 'bg-slate-500'
  };
}

// 获取当月的第几周（如：11月第1周），如果日期无效则返回 "-"
function getWeekOfMonth(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return '-';
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';
  
  const month = date.getMonth() + 1; // 月份从0开始
  const day = date.getDate();
  
  // 获取当月第一天是周几（0=周日, 1=周一, ..., 6=周六）
  const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstDayWeekday = firstDayOfMonth.getDay();
  
  // 计算当前日期是当月的第几周
  // 以周一为一周的开始
  const adjustedFirstDay = firstDayWeekday === 0 ? 6 : firstDayWeekday - 1; // 转换为周一=0
  const weekOfMonth = Math.ceil((day + adjustedFirstDay) / 7);
  
  return `${month}月第${weekOfMonth}周`;
}

// 格式化日期为月份
function formatMonth(dateStr: string): string {
  const parts = dateStr.split('-');
  return `${parts[0]}-${parts[1]}`;
}

// 编辑弹窗组件
interface EditModalProps {
  entry: TimesheetEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, data: Partial<TimesheetEntry>) => void;
}

// 编辑弹窗内的自定义下拉选择组件
interface EditSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: FieldOption[];
  placeholder: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

function EditSelect({ value, onChange, options, placeholder, disabled, icon }: EditSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(opt => opt.value === value);
  
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(opt => 
      opt.label.toLowerCase().includes(term) || 
      opt.value.toLowerCase().includes(term)
    );
  }, [options, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "w-full flex items-center gap-2 px-4 py-3 text-sm rounded-xl transition-all duration-200",
          "border-2 bg-slate-50/50 hover:bg-white",
          disabled 
            ? "border-slate-100 cursor-not-allowed opacity-60" 
            : isOpen 
              ? "border-blue-400 ring-4 ring-blue-500/10" 
              : "border-slate-200 hover:border-slate-300"
        )}
      >
        {icon && <span className="text-slate-400 flex-shrink-0">{icon}</span>}
        <span className={cn(
          "flex-1 text-left truncate",
          selectedOption ? "text-slate-700 font-medium" : "text-slate-400"
        )}>
          {selectedOption?.label || placeholder}
        </span>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className={cn(
            "text-slate-400 transition-transform duration-200 flex-shrink-0",
            isOpen && "rotate-180"
          )}
        >
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
      
      {isOpen && !disabled && (
        <div className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
          {/* 搜索框 */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索选项..."
                className="w-full h-8 pl-9 pr-3 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>
          
          {/* 选项列表 */}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-400">
                无匹配选项
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-sm transition-colors",
                    "hover:bg-slate-50",
                    option.value === value 
                      ? "bg-blue-50 text-blue-700 font-medium" 
                      : "text-slate-700"
                  )}
                >
                  <span className="truncate block">{option.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EditModal({ entry, isOpen, onClose, onSave }: EditModalProps) {
  const [formData, setFormData] = useState<Record<string, string | number>>({});

  // 获取团队模版
  const template = useMemo(() => {
    if (!entry?.teamName) return null;
    return getTeamTemplateByName(entry.teamName);
  }, [entry?.teamName]);

  // 初始化表单数据
  useEffect(() => {
    if (entry) {
      setFormData({
        date: entry.date,
        hours: entry.hours,
        description: entry.description || '',
        ...entry.data,
      });
    }
  }, [entry]);

  if (!isOpen || !entry) return null;

  // 处理字段值变化（支持级联清空）
  const handleFieldChange = (key: string, value: string | number) => {
    const newFormData = { ...formData, [key]: value };
    
    // 如果是父字段变化，清空子字段
    if (template) {
      template.fields.forEach(field => {
        if (field.parentField === key) {
          newFormData[field.key] = '';
        }
      });
    }
    
    setFormData(newFormData);
  };

  // 获取字段的选项（支持级联）
  const getFieldOptions = (field: TemplateField): FieldOption[] => {
    if (field.parentField) {
      const parentValue = formData[field.parentField] as string;
      if (!parentValue) return [];
      
      const parentField = template?.fields.find(f => f.key === field.parentField);
      if (!parentField?.options) return [];
      
      return getChildOptions(parentValue, parentField.options);
    }
    return field.options || [];
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { date, hours, description, ...data } = formData;
    onSave(entry.id, {
      date: String(date),
      hours: Number(hours),
      description: String(description),
      data: data as Record<string, string | number>,
    });
    onClose();
  };

  // 字段图标映射
  const getFieldIcon = (fieldName: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      category: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
        </svg>
      ),
      task: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3L22 4"/>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
      ),
      tag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/>
          <path d="M7 7h.01"/>
        </svg>
      ),
      keyTask: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ),
      workType: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
        </svg>
      ),
      workCategory: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
        </svg>
      ),
      dealName: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      ),
      bscTag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/>
          <path d="M7 7h.01"/>
        </svg>
      ),
      bscItem: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6"/>
          <line x1="8" y1="12" x2="21" y2="12"/>
          <line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/>
          <line x1="3" y1="12" x2="3.01" y2="12"/>
          <line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
      ),
      sourcePath: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
      virtualGroup: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
      internalClient: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16"/>
          <path d="M3 21h18"/>
          <path d="M9 7h1"/>
          <path d="M9 11h1"/>
          <path d="M14 7h1"/>
          <path d="M14 11h1"/>
        </svg>
      ),
      item: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6"/>
          <line x1="8" y1="12" x2="21" y2="12"/>
          <line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/>
          <line x1="3" y1="12" x2="3.01" y2="12"/>
          <line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
      ),
    };
    return iconMap[fieldName] || (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 16v-4"/>
        <path d="M12 8h.01"/>
      </svg>
    );
  };

  // 字段标签映射
  const getFieldLabel = (key: string): string => {
    const labelMap: Record<string, string> = {
      category: '事项分类',
      task: '工作任务',
      tag: '标签',
      keyTask: '关键任务',
      workType: '工作类型',
      workCategory: '工作类别',
      dealName: '项目名称',
      bscTag: 'BSC Tag',
      bscItem: 'BSC Item',
      sourcePath: '小组',
      virtualGroup: 'Virtual Group',
      internalClient: 'Internal Client',
      item: 'Item',
    };
    // 如果有模版，优先使用模版中的标签
    if (template) {
      const field = template.fields.find(f => f.key === key);
      if (field) return field.label;
    }
    return labelMap[key] || key;
  };

  // 渲染字段
  const renderField = (key: string, value: string | number) => {
    // 跳过 hours 和 description，它们单独处理
    if (key === 'hours' || key === 'description') return null;

    const fieldConfig = template?.fields.find(f => f.key === key);
    const icon = getFieldIcon(key);
    const label = getFieldLabel(key);

    // 如果有模版配置且是下拉选择类型
    if (fieldConfig && (fieldConfig.type === 'select' || fieldConfig.type === 'cascader')) {
      const options = getFieldOptions(fieldConfig);
      const isDisabled = fieldConfig.parentField && !formData[fieldConfig.parentField];
      
      return (
        <div key={key} className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-violet-50 text-violet-500">
              {icon}
            </span>
            {label}
            {fieldConfig.required && (
              <span className="text-rose-500 text-xs">*</span>
            )}
          </label>
          <EditSelect
            value={formData[key] as string || ''}
            onChange={(val) => handleFieldChange(key, val)}
            options={options}
            placeholder={fieldConfig.placeholder || `请选择${label}`}
            disabled={!!isDisabled}
            icon={icon}
          />
          {fieldConfig.parentField && !formData[fieldConfig.parentField] && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              请先选择上级分类
            </p>
          )}
        </div>
      );
    }

    // 默认渲染为文本输入框
    return (
      <div key={key} className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-violet-50 text-violet-500">
            {icon}
          </span>
          {label}
        </label>
        <input
          type="text"
          value={formData[key] as string || String(value)}
          onChange={(e) => handleFieldChange(key, e.target.value)}
          className="w-full px-4 py-3 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 bg-slate-50/50 hover:bg-white"
        />
      </div>
    );
  };

  // 获取要渲染的字段列表（按模版顺序）
  const getFieldsToRender = () => {
    if (template) {
      // 使用模版定义的字段顺序，但只渲染 entry.data 中存在的字段
      return template.fields
        .filter(f => f.key !== 'hours' && f.key !== 'description' && f.key in entry.data)
        .map(f => ({ key: f.key, value: entry.data[f.key] }));
    }
    // 没有模版时，直接渲染 entry.data 中的字段
    return Object.entries(entry.data)
      .filter(([key]) => key !== 'hours' && key !== 'description')
      .map(([key, value]) => ({ key, value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 弹窗主体 */}
      <div className="relative z-10 w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
        {/* 头部装饰渐变 */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent pointer-events-none" />
        
        {/* 头部 */}
        <div className="relative px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">编辑记录</h3>
              <p className="text-xs text-slate-500 mt-0.5">{entry.teamName} - 修改工时记录详情</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        
        {/* 表单内容 */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-2 gap-5">
            {/* 日期字段 */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-blue-50 text-blue-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </span>
                日期
              </label>
              <input
                type="date"
                value={formData.date as string || entry.date}
                onChange={(e) => handleFieldChange('date', e.target.value)}
                className="w-full px-4 py-3 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 bg-slate-50/50 hover:bg-white"
              />
            </div>
            
            {/* 小时数字段 */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-cyan-50 text-cyan-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                </span>
                小时数
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="24"
                value={formData.hours as number || entry.hours}
                onChange={(e) => handleFieldChange('hours', parseFloat(e.target.value))}
                className="w-full px-4 py-3 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 bg-slate-50/50 hover:bg-white"
              />
            </div>
            
            {/* 动态字段 - 按模版顺序渲染 */}
            {getFieldsToRender().map(({ key, value }) => renderField(key, value))}
            
            {/* 描述字段 - 跨两列 */}
            <div className="col-span-2 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-amber-50 text-amber-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="17" y1="10" x2="3" y2="10"/>
                    <line x1="21" y1="6" x2="3" y2="6"/>
                    <line x1="21" y1="14" x2="3" y2="14"/>
                    <line x1="17" y1="18" x2="3" y2="18"/>
                  </svg>
                </span>
                描述
              </label>
              <textarea
                value={formData.description as string || entry.description || ''}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                rows={3}
                placeholder="请输入工作描述..."
                className="w-full px-4 py-3 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 bg-slate-50/50 hover:bg-white resize-none"
              />
            </div>
          </div>
          
          {/* 底部按钮 */}
          <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all duration-200"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl hover:from-blue-600 hover:to-indigo-700 shadow-lg shadow-blue-500/25 transition-all duration-200 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              保存更改
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 删除确认弹窗
interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  count: number;
}

function DeleteConfirmModal({ isOpen, onClose, onConfirm, count }: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 弹窗主体 */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
        {/* 头部装饰渐变 */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-br from-red-500/10 via-rose-500/5 to-transparent pointer-events-none" />
        
        <div className="relative p-6">
          {/* 图标 */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/25">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"/>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
            </div>
          </div>
          
          {/* 标题和描述 */}
          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold text-slate-800 mb-2">确认删除</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              确定要删除选中的 <span className="font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{count}</span> 条记录吗？
            </p>
            <p className="text-xs text-slate-400 mt-2 flex items-center justify-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              此操作无法撤销
            </p>
          </div>
          
          {/* 按钮 */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all duration-200"
            >
              取消
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-rose-600 rounded-xl hover:from-red-600 hover:to-rose-700 shadow-lg shadow-red-500/25 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"/>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
              </svg>
              确认删除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 导入预览弹窗
interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (entries: TimesheetEntry[]) => void;
  previewData: ImportPreviewData[];
  fileName: string;
}

interface ImportPreviewData {
  month: string;
  name: string;
  team: string;
  hours: number;
  category: string;
  dealName: string;
  tag: string;
  item: string;
  workCategory: string;
  narrative: string;
  sourcePath: string;
  isValid: boolean;
  errorMessage?: string;
}

function ImportModal({ isOpen, onClose, onConfirm, previewData, fileName }: ImportModalProps) {
  const [importing, setImporting] = useState(false);
  const [showOnlyInvalid, setShowOnlyInvalid] = useState(false);
  
  if (!isOpen) return null;

  const validCount = previewData.filter(d => d.isValid).length;
  const invalidCount = previewData.length - validCount;
  
  // 根据筛选条件显示数据
  const displayData = showOnlyInvalid 
    ? previewData.filter(d => !d.isValid)
    : previewData;

  const handleImport = async () => {
    setImporting(true);
    
    // 将预览数据转换为 TimesheetEntry
    const entriesToImport: TimesheetEntry[] = previewData
      .filter(d => d.isValid)
      .map((row, index) => {
        // 解析月份为日期（默认取该月1号）
        let date = '';
        if (row.month) {
          const monthStr = String(row.month);
          // 支持多种格式：2024-12, 2024/12, 202412
          const match = monthStr.match(/(\d{4})[-/]?(\d{1,2})/);
          if (match) {
            const year = match[1];
            const month = match[2].padStart(2, '0');
            date = `${year}-${month}-01`;
          }
        }

        // 根据团队映射字段
        const data: Record<string, string | number> = {};
        const teamName = row.team;

        if (teamName === '投资法务中心') {
          if (row.category) data.category = row.category;
          if (row.dealName) data.dealName = row.dealName;
          if (row.tag) data.bscTag = row.tag;
          if (row.item) data.bscItem = row.item;
          if (row.workCategory) data.workCategory = row.workCategory;
          if (row.sourcePath) data.sourcePath = row.sourcePath;
        } else if (teamName === '业务管理及合规检测中心') {
          if (row.category) data.category = row.category;
          if (row.dealName) data.task = row.dealName;
          if (row.tag) data.tag = row.tag;
          if (row.item) data.keyTask = row.item;
          if (row.workCategory) data.workType = row.workCategory;
        } else if (teamName === '公司及国际金融事务中心') {
          if (row.category) data.virtualGroup = row.category;
          if (row.dealName) data.internalClient = row.dealName;
          if (row.tag) data.tag = row.tag;
          if (row.item) data.item = row.item;
          if (row.workCategory) data.workCategory = row.workCategory;
        } else {
          // 未知团队，保留原始字段
          if (row.category) data.category = row.category;
          if (row.dealName) data.dealName = row.dealName;
          if (row.tag) data.tag = row.tag;
          if (row.item) data.item = row.item;
          if (row.workCategory) data.workCategory = row.workCategory;
          if (row.sourcePath) data.sourcePath = row.sourcePath;
        }

        return {
          id: `import-${Date.now()}-${index}`,
          userId: `imported-user-${row.name}`,
          userName: row.name,
          teamId: teamName,
          teamName: teamName,
          groupName: row.sourcePath || '', // 小组信息
          date: date,
          hours: row.hours,
          data: data,
          description: row.narrative || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'submitted' as const, // 导入的历史数据直接设为已提交
        };
      });

    onConfirm(entriesToImport);
    setImporting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 弹窗主体 */}
      <div className="relative z-10 w-full max-w-4xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
        {/* 头部装饰渐变 */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent pointer-events-none" />
        
        {/* 头部 */}
        <div className="relative px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">导入预览</h3>
              <p className="text-xs text-slate-500 mt-0.5">{fileName}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* 统计信息 */}
        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">总记录数:</span>
                <span className="text-sm font-semibold text-slate-700">{previewData.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-sm text-slate-500">有效:</span>
                <span className="text-sm font-semibold text-emerald-600">{validCount}</span>
              </div>
              {invalidCount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span className="text-sm text-slate-500">无效:</span>
                  <span className="text-sm font-semibold text-amber-600">{invalidCount}</span>
                </div>
              )}
            </div>
            {/* 筛选按钮 */}
            {invalidCount > 0 && (
              <button
                onClick={() => setShowOnlyInvalid(!showOnlyInvalid)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                  showOnlyInvalid
                    ? "text-amber-700 bg-amber-100 hover:bg-amber-200"
                    : "text-slate-600 bg-slate-100 hover:bg-slate-200"
                )}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
                {showOnlyInvalid ? '显示全部' : '只看无效数据'}
              </button>
            )}
          </div>
        </div>
        
        {/* 预览表格 */}
        <div className="max-h-[400px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">状态</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">月份</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">姓名</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">团队</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">小时数</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">分类</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">错误原因</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayData.slice(0, 100).map((row, index) => (
                <tr key={index} className={cn(
                  "hover:bg-slate-50/50",
                  !row.isValid && "bg-amber-50/50"
                )}>
                  <td className="px-4 py-2.5">
                    {row.isValid ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="12" y1="8" x2="12" y2="12"/>
                          <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                      </span>
                    )}
                  </td>
                  <td className={cn("px-4 py-2.5", !row.month && !row.isValid ? "text-red-500 font-medium" : "text-slate-600")}>{row.month || '-'}</td>
                  <td className={cn("px-4 py-2.5 font-medium", !row.name && !row.isValid ? "text-red-500" : "text-slate-700")}>{row.name || '-'}</td>
                  <td className="px-4 py-2.5">
                    {row.team ? (
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                        getTeamColor(row.team).bg,
                        getTeamColor(row.team).text
                      )}>
                        {row.team}
                      </span>
                    ) : <span className={!row.isValid ? "text-red-500 font-medium" : "text-slate-600"}>-</span>}
                  </td>
                  <td className={cn("px-4 py-2.5", row.hours <= 0 && !row.isValid ? "text-red-500 font-medium" : "text-slate-600")}>{row.hours || 0}h</td>
                  <td className="px-4 py-2.5 text-slate-600 max-w-[150px] truncate" title={row.category}>{row.category || '-'}</td>
                  <td className="px-4 py-2.5">
                    {row.isValid ? (
                      <span className="text-emerald-600 text-xs">-</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600 border border-red-100">
                        {row.errorMessage}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {displayData.length > 100 && (
            <div className="px-4 py-3 text-center text-sm text-slate-500 bg-slate-50">
              仅显示前 100 条记录，共 {displayData.length} 条
            </div>
          )}
        </div>
        
        {/* 底部按钮 */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
          <p className="text-xs text-slate-500">
            将导入 <span className="font-semibold text-emerald-600">{validCount}</span> 条有效记录
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all duration-200"
            >
              取消
            </button>
            <button
              onClick={handleImport}
              disabled={validCount === 0 || importing}
              className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? (
                <>
                  <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  导入中...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  确认导入
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DataManagementPage() {
  const { entries, deleteEntries, updateEntry, importEntries, refreshEntries } = useTimesheet();
  const { teams } = useOrganization();

  // 自动刷新状态
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastKnownCount, setLastKnownCount] = useState<number>(0);
  const [lastKnownUpdated, setLastKnownUpdated] = useState<string>('');
  const AUTO_REFRESH_INTERVAL = 10000; // 10秒检查一次

  // 更新已知状态
  useEffect(() => {
    setLastKnownCount(entries.length);
  }, [entries.length]);

  // 手动刷新（强制全量刷新）
  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshEntries();
      setLastRefreshTime(new Date());
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshEntries]);

  // 定时轮询（先检查是否有更新，有更新才全量刷新）
  useEffect(() => {
    if (!autoRefresh) return;
    
    const checkAndRefresh = async () => {
      try {
        // 先用轻量级接口检查是否有更新
        const checkResult = await timesheetApi.checkUpdates(lastKnownCount, lastKnownUpdated);
        
        if (checkResult.success && checkResult.data) {
          const { count, last_updated, has_updates } = checkResult.data;
          
          // 如果有更新，才进行全量刷新
          if (has_updates || count !== lastKnownCount) {
            await refreshEntries();
            setLastRefreshTime(new Date());
            setLastKnownCount(count);
            if (last_updated) setLastKnownUpdated(last_updated);
          }
        }
      } catch (error) {
        console.error('检查更新失败:', error);
      }
    };

    const interval = setInterval(checkAndRefresh, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshEntries, lastKnownCount, lastKnownUpdated]);

  // 筛选状态
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // 选择状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 弹窗状态
  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // 导入相关状态
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState<ImportPreviewData[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 获取所有可用的年份
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    entries.forEach(entry => {
      const year = entry.date.split('-')[0];
      years.add(year);
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [entries]);

  // 获取所有可用的月份（1-12）
  const availableMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  }, []);

  // 获取所有可用的小组（从 groupName 或 sourcePath 字段）
  const availableGroups = useMemo(() => {
    const groups = new Set<string>();
    entries.forEach(entry => {
      // 优先使用 groupName，其次使用 data.sourcePath
      const groupValue = entry.groupName || entry.data?.sourcePath;
      if (groupValue) {
        groups.add(String(groupValue));
      }
    });
    return Array.from(groups).sort();
  }, [entries]);

  // 筛选后的数据
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      // 按中心筛选
      if (selectedTeam !== 'all' && entry.teamName !== selectedTeam) {
        return false;
      }

      // 按小组筛选
      if (selectedGroup !== 'all') {
        const entryGroup = entry.groupName || entry.data?.sourcePath;
        if (entryGroup !== selectedGroup) {
          return false;
        }
      }

      // 按年份筛选
      if (selectedYear !== 'all') {
        const entryYear = entry.date.split('-')[0];
        if (entryYear !== selectedYear) {
          return false;
        }
      }

      // 按月份筛选
      if (selectedMonth !== 'all') {
        const entryMonth = entry.date.split('-')[1];
        if (entryMonth !== selectedMonth) {
          return false;
        }
      }

      // 关键词搜索
      if (searchKeyword) {
        const keyword = searchKeyword.toLowerCase();
        const matchName = entry.userName.toLowerCase().includes(keyword);
        const matchTeam = entry.teamName.toLowerCase().includes(keyword);
        const matchDesc = entry.description?.toLowerCase().includes(keyword);
        const matchData = Object.values(entry.data).some(v => 
          String(v).toLowerCase().includes(keyword)
        );
        if (!matchName && !matchTeam && !matchDesc && !matchData) {
          return false;
        }
      }

      return true;
    });
  }, [entries, selectedTeam, selectedGroup, selectedYear, selectedMonth, searchKeyword]);

  // 分页后的数据
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEntries.slice(start, start + pageSize);
  }, [filteredEntries, currentPage]);

  const totalPages = Math.ceil(filteredEntries.length / pageSize);

  // 全选/取消全选当前页
  const handleSelectAll = () => {
    if (selectedIds.size === paginatedEntries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedEntries.map(e => e.id)));
    }
  };

  // 全选所有筛选后的数据
  const handleSelectAllFiltered = () => {
    if (selectedIds.size === filteredEntries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEntries.map(e => e.id)));
    }
  };

  // 判断是否全选了所有筛选后的数据
  const isAllFilteredSelected = filteredEntries.length > 0 && selectedIds.size === filteredEntries.length;

  // 单选
  const handleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // 删除选中的记录
  const handleDeleteSelected = async () => {
    const idsToDelete = Array.from(selectedIds);
    await deleteEntries(idsToDelete);
    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
  };

  // 保存编辑
  const handleSaveEdit = async (id: string, data: Partial<TimesheetEntry>) => {
    await updateEntry(id, {
      date: data.date || '',
      hours: data.hours || 0,
      data: data.data || {},
      description: data.description,
    });
  };

  // 导出数据
  const handleExport = (format: 'xlsx' | 'csv') => {
    const exportData = filteredEntries.map(entry => {
      const month = formatMonth(entry.date);
      const weekOfMonth = getWeekOfMonth(entry.date);
      const teamName = entry.teamName;

      // 根据团队映射字段
      let category = '';
      let dealName = '';
      let bscTag = '';
      let bscItem = '';
      let workCategory = '';
      let sourcePath = '';

      if (teamName === '投资法务中心') {
        category = String(entry.data.category || '');
        dealName = String(entry.data.dealName || '');
        bscTag = String(entry.data.bscTag || '');
        bscItem = String(entry.data.bscItem || '');
        workCategory = String(entry.data.workCategory || '');
        sourcePath = String(entry.data.sourcePath || '');
      } else if (teamName === '业务管理及合规检测中心') {
        category = String(entry.data.category || '');
        dealName = String(entry.data.task || '');
        bscTag = String(entry.data.tag || '').replace(/^_/, '');
        bscItem = String(entry.data.keyTask || '');
        workCategory = String(entry.data.workType || '');
      } else if (teamName === '公司及国际金融事务中心') {
        category = String(entry.data.virtualGroup || '');
        dealName = String(entry.data.internalClient || '');
        bscTag = String(entry.data.tag || '').replace(/^_/, '');
        bscItem = String(entry.data.item || '');
        workCategory = String(entry.data.workCategory || '');
      }

      return {
        'Week': weekOfMonth,
        'Month': month,
        'Name': entry.userName,
        'Deal/Matter Category': category,
        'Deal/Matter Name': dealName,
        'OKR/BSC Tag': bscTag,
        'OKR/BSC Item': bscItem,
        'Hours': entry.hours,
        'Work Category': workCategory,
        'Narrative (Optional)': entry.description || '',
        'Source Path': sourcePath,
        '团队': teamName,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '工时数据');

    // 设置列宽
    const colWidths = [
      { wch: 6 },  // Week
      { wch: 10 }, // Month
      { wch: 15 }, // Name
      { wch: 30 }, // Deal/Matter Category
      { wch: 30 }, // Deal/Matter Name
      { wch: 15 }, // OKR/BSC Tag
      { wch: 30 }, // OKR/BSC Item
      { wch: 8 },  // Hours
      { wch: 40 }, // Work Category
      { wch: 40 }, // Narrative
      { wch: 10 }, // Source Path
      { wch: 25 }, // 团队
    ];
    worksheet['!cols'] = colWidths;

    const fileName = `工时数据_${new Date().toISOString().split('T')[0]}`;
    if (format === 'xlsx') {
      XLSX.writeFile(workbook, `${fileName}.xlsx`);
    } else {
      XLSX.writeFile(workbook, `${fileName}.csv`, { bookType: 'csv' });
    }
  };

  // 重置筛选
  const handleResetFilters = () => {
    setSelectedTeam('all');
    setSelectedGroup('all');
    setSelectedYear('all');
    setSelectedMonth('all');
    setSearchKeyword('');
    setCurrentPage(1);
  };

  // 处理Excel文件导入
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];

        // 解析Excel数据为预览格式
        const previewData: ImportPreviewData[] = jsonData.map(row => {
          // 处理月份字段（可能是 Excel 日期序列号或字符串）
          let month = '';
          if (row['Month'] !== undefined && row['Month'] !== null) {
            const monthValue = row['Month'];
            if (typeof monthValue === 'number') {
              // Excel 日期序列号转换
              const excelDate = new Date((monthValue - 25569) * 86400 * 1000);
              if (!isNaN(excelDate.getTime())) {
                month = `${excelDate.getFullYear()}-${String(excelDate.getMonth() + 1).padStart(2, '0')}`;
              }
            } else {
              month = String(monthValue);
            }
          }

          const name = String(row['Name'] || '');
          const team = String(row['团队'] || '');
          const hours = Number(row['Hours'] || row['Ho'] || 0);
          const category = String(row['Deal/Matter Category'] || '');
          const dealName = String(row['Deal/Matter Name'] || row['Deal/M'] || '');
          const tag = String(row['OKR/BSC Tag'] || row['OKR/B'] || '');
          const item = String(row['OKR/BSC Item'] || '');
          const workCategory = String(row['Work Category'] || '');
          const narrative = String(row['Narrative (Optional)'] || '');
          const sourcePath = String(row['Source Path'] || '');

          // 验证数据有效性
          let isValid = true;
          let errorMessage = '';

          if (!month) {
            isValid = false;
            errorMessage = '缺少月份';
          } else if (!name) {
            isValid = false;
            errorMessage = '缺少姓名';
          } else if (!team) {
            isValid = false;
            errorMessage = '缺少团队';
          } else if (hours <= 0) {
            isValid = false;
            errorMessage = '小时数无效';
          }

          return {
            month,
            name,
            team,
            hours,
            category,
            dealName,
            tag,
            item,
            workCategory,
            narrative,
            sourcePath,
            isValid,
            errorMessage,
          };
        });

        setImportPreviewData(previewData);
        setShowImportModal(true);
      } catch (error) {
        console.error('解析Excel文件失败:', error);
        alert('解析Excel文件失败，请检查文件格式');
      }
    };
    reader.readAsArrayBuffer(file);

    // 重置 input 以便可以重复选择同一文件
    event.target.value = '';
  };

  // 确认导入
  const handleConfirmImport = async (entriesToImport: TimesheetEntry[]) => {
    const result = await importEntries(entriesToImport);
    if (result.success) {
      alert(`成功导入 ${result.count} 条记录`);
      setShowImportModal(false);
      setImportPreviewData([]);
      setImportFileName('');
    } else {
      alert(result.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      <div className="p-6 lg:p-8">
        {/* 页面标题 */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-neutral-900 tracking-tight" style={{ fontWeight: 700 }}>数据管理</h1>
            <p className="text-neutral-500 mt-2 text-sm font-medium">管理和导出工时数据</p>
          </div>
          
          {/* 刷新控制区 */}
          <div className="flex items-center gap-3">
            {/* 上次刷新时间 */}
            <span className="text-xs text-slate-400">
              上次刷新: {lastRefreshTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            
            {/* 自动刷新开关 */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                autoRefresh 
                  ? "bg-green-50 text-green-600 border border-green-200" 
                  : "bg-slate-100 text-slate-500 border border-slate-200"
              )}
            >
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                autoRefresh ? "bg-green-500 animate-pulse" : "bg-slate-400"
              )} />
              自动刷新 {autoRefresh ? '开' : '关'}
            </button>
            
            {/* 手动刷新按钮 */}
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all",
                "bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md",
                isRefreshing && "opacity-70 cursor-not-allowed"
              )}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className={cn(isRefreshing && "animate-spin")}
              >
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                <path d="M16 16h5v5"/>
              </svg>
              {isRefreshing ? '刷新中...' : '刷新数据'}
            </button>
          </div>
        </div>

        {/* 筛选区域 - 平铺布局 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5 mb-6">
          {/* 筛选项行 - 使用 flex 平铺 */}
          <div className="flex flex-wrap items-end gap-4">
            {/* 中心筛选 */}
            <div className="flex-1 min-w-[180px]">
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18"/>
                  <path d="M5 21V7l8-4v18"/>
                  <path d="M19 21V11l-6-4"/>
                </svg>
                中心
              </label>
              <CustomSelect
                value={selectedTeam}
                onChange={(value) => {
                  setSelectedTeam(value);
                  setSelectedGroup('all');
                  setCurrentPage(1);
                }}
                options={[
                  { value: 'all', label: '全部中心' },
                  ...teams.map(team => ({ value: team.name, label: team.name }))
                ]}
                placeholder="选择中心"
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 21h18"/>
                    <path d="M5 21V7l8-4v18"/>
                    <path d="M19 21V11l-6-4"/>
                  </svg>
                }
              />
            </div>

            {/* 年份筛选 */}
            <div className="flex-1 min-w-[140px]">
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                年份
              </label>
              <CustomSelect
                value={selectedYear}
                onChange={(value) => {
                  setSelectedYear(value);
                  setCurrentPage(1);
                }}
                options={[
                  { value: 'all', label: '全部年份' },
                  ...availableYears.map(year => ({ value: year, label: `${year}年` }))
                ]}
                placeholder="选择年份"
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                }
              />
            </div>

            {/* 月份筛选 */}
            <div className="flex-1 min-w-[140px]">
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                月份
              </label>
              <CustomSelect
                value={selectedMonth}
                onChange={(value) => {
                  setSelectedMonth(value);
                  setCurrentPage(1);
                }}
                options={[
                  { value: 'all', label: '全部月份' },
                  ...availableMonths.map(month => ({ value: month, label: `${parseInt(month)}月` }))
                ]}
                placeholder="选择月份"
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                }
              />
            </div>

            {/* 小组筛选（仅投资法务中心显示） */}
            {(selectedTeam === '投资法务中心' || selectedTeam === 'all') && availableGroups.length > 0 && (
              <div className="flex-1 min-w-[140px]">
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  小组
                </label>
                <CustomSelect
                  value={selectedGroup}
                  onChange={(value) => {
                    setSelectedGroup(value);
                    setCurrentPage(1);
                  }}
                  options={[
                    { value: 'all', label: '全部小组' },
                    ...availableGroups.map(group => ({ value: group, label: group }))
                  ]}
                  placeholder="选择小组"
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                    </svg>
                  }
                />
              </div>
            )}

            {/* 搜索框 */}
            <div className="flex-[2] min-w-[200px]">
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                搜索
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => {
                    setSearchKeyword(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="搜索姓名、团队、描述..."
                  className="w-full pl-10 pr-10 py-2.5 text-sm font-medium text-slate-700 bg-white border-2 border-slate-200 hover:border-slate-300 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 placeholder:text-slate-400 shadow-sm"
                />
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </div>
                {searchKeyword && (
                  <button
                    onClick={() => setSearchKeyword('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* 重置按钮 */}
            <div className="flex-shrink-0">
              <label className="block text-[11px] font-medium text-transparent mb-2">操作</label>
              <button
                onClick={handleResetFilters}
                className="group flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all duration-200 shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-180 transition-transform duration-300">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
                重置
              </button>
            </div>
          </div>
          
          {/* 活跃筛选标签 */}
          {(selectedTeam !== 'all' || selectedYear !== 'all' || selectedMonth !== 'all' || selectedGroup !== 'all' || searchKeyword) && (
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100">
              <span className="text-xs text-slate-400 font-medium">已选条件:</span>
              {selectedTeam !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg border border-blue-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  {selectedTeam}
                  <button onClick={() => setSelectedTeam('all')} className="ml-0.5 hover:text-blue-900 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </span>
              )}
              {selectedYear !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-lg border border-indigo-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                  {selectedYear}年
                  <button onClick={() => setSelectedYear('all')} className="ml-0.5 hover:text-indigo-900 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </span>
              )}
              {selectedMonth !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-cyan-700 bg-cyan-50 rounded-lg border border-cyan-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                  {parseInt(selectedMonth)}月
                  <button onClick={() => setSelectedMonth('all')} className="ml-0.5 hover:text-cyan-900 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </span>
              )}
              {selectedGroup !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-violet-700 bg-violet-50 rounded-lg border border-violet-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
                  {selectedGroup}
                  <button onClick={() => setSelectedGroup('all')} className="ml-0.5 hover:text-violet-900 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </span>
              )}
              {searchKeyword && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg border border-slate-200">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  "{searchKeyword}"
                  <button onClick={() => setSearchKeyword('')} className="ml-0.5 hover:text-slate-900 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* 操作栏 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">
                共 <span className="font-semibold text-slate-700">{filteredEntries.length}</span> 条记录
                {selectedIds.size > 0 && (
                  <span className="ml-2">
                    ，已选择 <span className="font-semibold text-blue-600">{selectedIds.size}</span> 条
                  </span>
                )}
              </span>

              {/* 全选所有按钮 */}
              {filteredEntries.length > 0 && (
                <button
                  onClick={handleSelectAllFiltered}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                    isAllFilteredSelected
                      ? "text-blue-700 bg-blue-100 hover:bg-blue-200"
                      : "text-slate-600 bg-slate-100 hover:bg-slate-200"
                  )}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {isAllFilteredSelected ? (
                      <>
                        <path d="M9 11l3 3L22 4"/>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                      </>
                    ) : (
                      <>
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <path d="M9 12l2 2 4-4"/>
                      </>
                    )}
                  </svg>
                  {isAllFilteredSelected ? '取消全选' : '全选所有'}
                </button>
              )}

              {selectedIds.size > 0 && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 rounded-lg shadow-lg shadow-red-500/25 transition-all duration-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18"/>
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                  </svg>
                  删除选中 ({selectedIds.size})
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* 隐藏的文件输入框 */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileImport}
                className="hidden"
              />
              
              {/* 导入按钮 */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-lg shadow-lg shadow-emerald-500/25 transition-all duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                导入Excel
              </button>
              
              <button
                onClick={() => handleExport('xlsx')}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-lg shadow-lg shadow-blue-500/25 transition-all duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                导出Excel
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                导出CSV
              </button>
            </div>
          </div>
        </div>

        {/* 数据表格 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={paginatedEntries.length > 0 && selectedIds.size === paginatedEntries.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">周</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">月份</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">姓名</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">团队</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">小组</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">小时数</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">日期</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedEntries.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="9" y1="15" x2="15" y2="15"/>
                        </svg>
                        <span>暂无数据</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(entry.id)}
                          onChange={() => handleSelect(entry.id)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                        {getWeekOfMonth(entry.date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {formatMonth(entry.date)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-slate-800">{entry.userName}</span>
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const colors = getTeamColor(entry.teamName);
                          return (
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border",
                              colors.bg,
                              colors.text,
                              colors.border
                            )}>
                              <span className={cn("w-1.5 h-1.5 rounded-full", colors.dot)}></span>
                              {entry.teamName}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {entry.groupName || entry.data?.sourcePath || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {entry.hours}h
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                          entry.status === 'submitted' 
                            ? "bg-blue-50 text-blue-700" 
                            : "bg-amber-50 text-amber-700"
                        )}>
                          {entry.status === 'submitted' ? '已提交' : '草稿'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {entry.date}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingEntry(entry)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="编辑"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedIds(new Set([entry.id]));
                              setShowDeleteConfirm(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="删除"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18"/>
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
              <div className="text-sm text-slate-500">
                第 {currentPage} / {totalPages} 页
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-2 text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="11 17 6 12 11 7"/>
                    <polyline points="18 17 13 12 18 7"/>
                  </svg>
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
                
                {/* 页码按钮 */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        "w-8 h-8 text-sm font-medium rounded-lg transition-colors",
                        currentPage === pageNum
                          ? "bg-blue-600 text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-2 text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="13 17 18 12 13 7"/>
                    <polyline points="6 17 11 12 6 7"/>
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 编辑弹窗 */}
      <EditModal
        entry={editingEntry}
        isOpen={!!editingEntry}
        onClose={() => setEditingEntry(null)}
        onSave={handleSaveEdit}
      />

      {/* 删除确认弹窗 */}
      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setSelectedIds(new Set());
        }}
        onConfirm={handleDeleteSelected}
        count={selectedIds.size}
      />

      {/* 导入预览弹窗 */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportPreviewData([]);
          setImportFileName('');
        }}
        onConfirm={handleConfirmImport}
        previewData={importPreviewData}
        fileName={importFileName}
      />
    </div>
  );
}
