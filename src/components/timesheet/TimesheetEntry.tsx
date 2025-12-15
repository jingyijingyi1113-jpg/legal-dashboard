import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { useAuth } from '@/contexts/AuthContext';
import { useTimesheet } from '@/contexts/TimesheetContext';
import { getTeamTemplateByName, getChildOptions, DEFAULT_TEMPLATE } from '@/config/teamTemplates';
import type { TemplateField, FieldOption, TimesheetEntry as TimesheetEntryType, LeaveRecord } from '@/types/timesheet';
import { AIAssistant } from './AIAssistant';

// 自定义下拉选择组件
interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: FieldOption[];
  placeholder: string;
  disabled?: boolean;
  required?: boolean;
  icon?: React.ReactNode;
}

function CustomSelect({ value, onChange, options, placeholder, disabled, required, icon }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropUp, setDropUp] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
    // 检测是否需要向上弹出
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 320; // 估算下拉菜单高度
      setDropUp(spaceBelow < dropdownHeight && rect.top > dropdownHeight);
    }
  }, [isOpen]);

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          group w-full h-12 px-4 rounded-xl text-left
          flex items-center gap-3
          transition-all duration-200 ease-out
          ${disabled 
            ? 'bg-slate-50 border-slate-100 cursor-not-allowed opacity-60' 
            : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md hover:shadow-blue-100/50 cursor-pointer'
          }
          ${isOpen 
            ? 'border-blue-400 shadow-lg shadow-blue-100/50 ring-4 ring-blue-50' 
            : 'border'
          }
        `}
      >
        {icon && (
          <span className={`flex-shrink-0 transition-colors duration-200 ${isOpen ? 'text-blue-500' : 'text-slate-400 group-hover:text-blue-400'}`}>
            {icon}
          </span>
        )}
        <span className={`flex-1 truncate ${selectedOption ? 'text-sm text-slate-800 font-medium' : 'text-xs text-slate-400'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg 
          className={`w-5 h-5 flex-shrink-0 transition-all duration-300 ${isOpen ? 'rotate-180 text-blue-500' : 'text-slate-400 group-hover:text-blue-400'}`}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && !disabled && (
        <div className={`absolute z-50 w-full bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden animate-in fade-in duration-200 ${dropUp ? 'bottom-full mb-2 slide-in-from-bottom-2' : 'top-full mt-2 slide-in-from-top-2'}`}>
          {/* 搜索框 */}
          <div className="p-3 border-b border-slate-100 bg-slate-50/50">
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
                className="w-full h-9 pl-9 pr-3 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>
          
          {/* 选项列表 */}
          <div className="max-h-64 overflow-y-auto overscroll-contain">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                <svg className="w-8 h-8 mx-auto mb-2 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                无匹配选项
              </div>
            ) : (
              filteredOptions.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`
                    w-full px-4 py-3 text-left text-sm
                    flex items-center gap-3
                    transition-all duration-150
                    ${option.value === value 
                      ? 'bg-blue-50 text-blue-700 font-medium' 
                      : 'text-slate-700 hover:bg-slate-50'
                    }
                    ${index !== filteredOptions.length - 1 ? 'border-b border-slate-50' : ''}
                  `}
                >
                  <span className={`
                    w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                    transition-all duration-200
                    ${option.value === value 
                      ? 'border-blue-500 bg-blue-500' 
                      : 'border-slate-300'
                    }
                  `}>
                    {option.value === value && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="truncate">{option.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
      
      {/* 隐藏的原生select用于表单验证 */}
      {required && (
        <select
          value={value}
          onChange={() => {}}
          required
          className="absolute opacity-0 pointer-events-none"
          tabIndex={-1}
        >
          <option value="">{placeholder}</option>
          {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      )}
    </div>
  );
}

// 字段图标映射
const fieldIcons: Record<string, React.ReactNode> = {
  category: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  task: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  tag: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  item: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  keyTask: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  workType: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  bscItem: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  virtualGroup: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  internalClient: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  workCategory: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
};

interface TimesheetEntryProps {
  onCopyEntry?: (entry: TimesheetEntryType) => void;
  copyData?: TimesheetEntryType | null;
  onCopyDataConsumed?: () => void;
}

export function TimesheetEntryForm({ onCopyEntry, copyData, onCopyDataConsumed }: TimesheetEntryProps) {
  const { user } = useAuth();
  const { entries, addEntry, updateEntry, deleteEntry, submitEntries, getStats, leaveRecords, addLeaveRecord, updateLeaveRecord, deleteLeaveRecord } = useTimesheet();
  const [formData, setFormData] = useState<Record<string, string | number>>({});
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // 跨月提醒状态
  const [showCrossMonthReminder, setShowCrossMonthReminder] = useState(false);
  const [crossMonthReminderShown, setCrossMonthReminderShown] = useState(false);

  // 请假表单状态
  const [leaveStartDate, setLeaveStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [leaveEndDate, setLeaveEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [leaveDays, setLeaveDays] = useState<string>('1');
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [editingLeaveId, setEditingLeaveId] = useState<string | null>(null);
  
  // 标记是否刚复制了数据，防止被初始化覆盖
  const skipNextInitRef = useRef(false);

  // 获取当前用户的请假记录
  const userLeaveRecords = useMemo(() => {
    if (!user) return [];
    return leaveRecords.filter(r => r.userId === user.id).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [leaveRecords, user]);

  // 处理从历史记录复制的数据
  useEffect(() => {
    if (copyData) {
      // 标记跳过下次初始化
      skipNextInitRef.current = true;
      // 清除编辑状态
      setEditingId(null);
      // 使用今天的日期
      setDate(new Date().toISOString().split('T')[0]);
      // 设置表单数据
      setFormData({ 
        ...copyData.data, 
        hours: copyData.hours, 
        description: copyData.description || '' 
      });
      // 通知父组件数据已被消费
      onCopyDataConsumed?.();
    }
  }, [copyData, onCopyDataConsumed]);

  // 自动计算请假天数（工作日）
  useEffect(() => {
    if (leaveStartDate && leaveEndDate) {
      const start = new Date(leaveStartDate);
      const end = new Date(leaveEndDate);
      if (end >= start) {
        let count = 0;
        const current = new Date(start);
        while (current <= end) {
          const dayOfWeek = current.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            count++;
          }
          current.setDate(current.getDate() + 1);
        }
        setLeaveDays(count.toString());
      }
    }
  }, [leaveStartDate, leaveEndDate]);

  // 获取当前用户的团队模版
  const template = useMemo(() => {
    if (!user?.team) return DEFAULT_TEMPLATE;
    return getTeamTemplateByName(user.team) || DEFAULT_TEMPLATE;
  }, [user?.team]);

  // 初始化表单数据（仅在没有复制数据时执行）
  useEffect(() => {
    if (skipNextInitRef.current) {
      skipNextInitRef.current = false;
      return;
    }
    const initialData: Record<string, string | number> = {};
    template.fields.forEach(field => {
      initialData[field.key] = '';
    });
    setFormData(initialData);
  }, [template]);

  // 跨月提醒检测：月初1-5号时自动提示
  useEffect(() => {
    if (crossMonthReminderShown) return; // 已经提示过就不再提示
    
    const today = new Date();
    const dayOfMonth = today.getDate();
    
    // 仅在月初1-5号显示提醒（测试期间扩展到1-15号）
    if (dayOfMonth >= 1 && dayOfMonth <= 15) {
      setShowCrossMonthReminder(true);
    }
  }, [crossMonthReminderShown]);

  // 处理跨月提醒：选择补录上月
  const handleRecordLastMonth = () => {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    // 默认设置为上月最后一个工作日
    let targetDate = lastDayOfLastMonth;
    while (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
      targetDate.setDate(targetDate.getDate() - 1);
    }
    setDate(targetDate.toISOString().split('T')[0]);
    setShowCrossMonthReminder(false);
    setCrossMonthReminderShown(true);
  };

  // 处理跨月提醒：选择记录本月
  const handleRecordThisMonth = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setShowCrossMonthReminder(false);
    setCrossMonthReminderShown(true);
  };

  // 关闭跨月提醒
  const dismissCrossMonthReminder = () => {
    setShowCrossMonthReminder(false);
    setCrossMonthReminderShown(true);
  };

  // 获取当前用户的草稿记录
  const userDraftEntries = useMemo(() => {
    if (!user) return [];
    return entries.filter(e => e.userId === user.id && e.status === 'draft');
  }, [entries, user]);

  // 统计数据
  const stats = getStats();

  // 处理字段值变化
  const handleFieldChange = (key: string, value: string | number) => {
    const newFormData = { ...formData, [key]: value };
    
    // 如果是父字段变化，清空子字段
    template.fields.forEach(field => {
      if (field.parentField === key) {
        newFormData[field.key] = '';
      }
      // 如果是条件必填的依赖字段变化，且新值不满足条件，清空该字段
      if (field.conditionalRequired && field.conditionalRequired.dependsOn === key) {
        const { when } = field.conditionalRequired;
        const conditionMet = Array.isArray(when) ? when.includes(value as string) : value === when;
        if (!conditionMet) {
          newFormData[field.key] = '';
        }
      }
    });
    
    setFormData(newFormData);
  };

  // 获取字段的选项（支持级联）
  const getFieldOptions = (field: TemplateField): FieldOption[] => {
    if (field.parentField) {
      const parentValue = formData[field.parentField] as string;
      if (!parentValue) return [];
      
      const parentField = template.fields.find(f => f.key === field.parentField);
      if (!parentField?.options) return [];
      
      return getChildOptions(parentValue, parentField.options);
    }
    return field.options || [];
  };

  // 提交表单（保存草稿或更新）
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    // 验证所有必填字段（包括条件必填）
    for (const field of template.fields) {
      const required = isFieldRequired(field);
      const value = formData[field.key];
      if (required && (value === '' || value === undefined || value === null)) {
        alert(`请填写必填项：${field.label}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const hours = parseFloat(formData.hours as string) || 0;
      
      // 验证小时数必须大于0
      if (hours <= 0) {
        alert('小时数必须大于0');
        setSubmitting(false);
        return;
      }
      
      if (editingId) {
        const result = await updateEntry(editingId, {
          date,
          hours,
          data: { ...formData },
          description: formData.description as string,
        });
        if (result.success) {
          setEditingId(null);
          resetForm();
        }
      } else {
        const result = await addEntry({
          date,
          hours,
          data: { ...formData },
          description: formData.description as string,
        });
        if (result.success) {
          resetForm();
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 重置表单
  const resetForm = () => {
    const initialData: Record<string, string | number> = {};
    template.fields.forEach(field => {
      initialData[field.key] = '';
    });
    setFormData(initialData);
    setDate(new Date().toISOString().split('T')[0]);
    setEditingId(null);
  };

  // 删除记录
  const handleDelete = async (id: string) => {
    await deleteEntry(id);
    selectedIds.delete(id);
    setSelectedIds(new Set(selectedIds));
  };

  // 编辑记录
  const handleEdit = (entry: TimesheetEntryType) => {
    setEditingId(entry.id);
    setDate(entry.date);
    setFormData({ ...entry.data, hours: entry.hours, description: entry.description || '' });
  };

  // 复制记录
  const handleCopy = (entry: TimesheetEntryType) => {
    setEditingId(null);
    setDate(new Date().toISOString().split('T')[0]);
    setFormData({ ...entry.data, hours: entry.hours, description: entry.description || '' });
    onCopyEntry?.(entry);
  };

  // 切换选中状态
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.size === userDraftEntries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(userDraftEntries.map(e => e.id)));
    }
  };

  // 批量提交
  const handleBatchSubmit = async () => {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    try {
      await submitEntries(Array.from(selectedIds));
      setSelectedIds(new Set());
    } finally {
      setSubmitting(false);
    }
  };

  // 请假记录提交
  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (leaveSubmitting) return;

    setLeaveSubmitting(true);
    try {
      const days = parseFloat(leaveDays) || 0;
      if (days <= 0) {
        setLeaveSubmitting(false);
        return;
      }

      if (editingLeaveId) {
        await updateLeaveRecord(editingLeaveId, {
          startDate: leaveStartDate,
          endDate: leaveEndDate,
          days,
        });
        setEditingLeaveId(null);
      } else {
        await addLeaveRecord({
          startDate: leaveStartDate,
          endDate: leaveEndDate,
          days,
        });
      }
      resetLeaveForm();
    } finally {
      setLeaveSubmitting(false);
    }
  };

  // 重置请假表单
  const resetLeaveForm = () => {
    setLeaveStartDate(new Date().toISOString().split('T')[0]);
    setLeaveEndDate(new Date().toISOString().split('T')[0]);
    setLeaveDays('1');
    setEditingLeaveId(null);
  };

  // 编辑请假记录
  const handleEditLeave = (record: LeaveRecord) => {
    setEditingLeaveId(record.id);
    setLeaveStartDate(record.startDate);
    setLeaveEndDate(record.endDate);
    setLeaveDays(record.days.toString());
  };

  // 删除请假记录
  const handleDeleteLeave = async (id: string) => {
    await deleteLeaveRecord(id);
  };

  // 检查字段是否必填（包括条件必填）
  const isFieldRequired = (field: TemplateField): boolean => {
    if (field.required) return true;
    if (field.conditionalRequired) {
      const { dependsOn, when } = field.conditionalRequired;
      const dependValue = formData[dependsOn];
      if (Array.isArray(when)) {
        return when.includes(dependValue as string);
      }
      return dependValue === when;
    }
    return false;
  };

  // 渲染表单字段
  const renderField = (field: TemplateField) => {
    const value = formData[field.key] ?? '';
    const icon = fieldIcons[field.key];
    
    switch (field.type) {
      case 'select':
      case 'cascader': {
        const options = getFieldOptions(field);
        const isParentDisabled = field.parentField && !formData[field.parentField];
        const required = isFieldRequired(field);
        
        // 条件禁用逻辑：如果有 conditionalRequired 且条件不满足，则禁用该字段
        let isConditionalDisabled = false;
        if (field.conditionalRequired) {
          const { dependsOn, when } = field.conditionalRequired;
          const dependValue = formData[dependsOn];
          if (Array.isArray(when)) {
            isConditionalDisabled = !when.includes(dependValue as string);
          } else {
            isConditionalDisabled = dependValue !== when;
          }
        }
        
        const isDisabled = !!isParentDisabled || isConditionalDisabled;
        
        return (
          <div key={field.key} className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              {field.label}
              {required && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-100 text-rose-500 text-xs pt-[3px]">*</span>
              )}
              {!required && (
                <span className="text-xs font-normal text-slate-400">（可选）</span>
              )}
            </label>
            <CustomSelect
              value={isDisabled ? '' : value as string}
              onChange={(val) => handleFieldChange(field.key, val)}
              options={options}
              placeholder={isConditionalDisabled ? '无需填写' : (field.placeholder || `请选择${field.label}`)}
              disabled={isDisabled}
              required={required}
              icon={icon}
            />
            {field.parentField && !formData[field.parentField] && (
              <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                请先选择上级分类
              </p>
            )}
          </div>
        );
      }
      
      case 'number':
        return (
          <div key={field.key} className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              {field.label}
              {field.required && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-100 text-rose-500 text-xs pt-[3px]">*</span>
              )}
            </label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <input
                type="number"
                step="any"
                min={field.min || 0}
                max={field.max || 24}
                placeholder={field.placeholder}
                value={value}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                required={field.required}
                className="w-full h-12 pl-12 pr-16 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-800 placeholder:text-xs placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 hover:border-blue-300 hover:shadow-md hover:shadow-blue-100/50 transition-all duration-200"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400 select-none">
                小时
              </div>
            </div>
          </div>
        );
      
      case 'text':
      default:
        return (
          <div key={field.key} className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              {field.label}
              {field.required ? (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-100 text-rose-500 text-xs pt-[3px]">*</span>
              ) : (
                <span className="text-xs font-normal text-slate-400">（可选）</span>
              )}
            </label>
            <div className="relative group">
              <div className="absolute left-4 top-4 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              </div>
              <textarea
                placeholder={field.placeholder}
                value={value as string}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                required={field.required}
                rows={3}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-xs placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 hover:border-blue-300 hover:shadow-md hover:shadow-blue-100/50 transition-all duration-200 resize-none"
              />
            </div>
          </div>
        );
    }
  };

  // 获取记录的显示信息
  const getEntryDisplayInfo = (entry: TimesheetEntryType) => {
    const data = entry.data;
    const category = data.category as string || '';
    const task = data.task as string || data.project as string || '';
    const tag = data.tag as string || '';
    const keyTask = data.keyTask as string || '';
    // narrative/description 可能在 entry.description 或 data.description 中
    const narrative = entry.description as string || data.description as string || '';
    const internalClient = data.internalClient as string || '';
    const workCategory = data.workCategory as string || '';
    // 投资法务中心特有字段
    const dealName = data.dealName as string || '';  // Deal/Matter Name
    const bscTag = data.bscTag as string || '';
    const bscItem = data.bscItem as string || '';
    // 公司及国际金融事务中心特有字段
    const virtualGroup = data.virtualGroup as string || '';
    const item = data.item as string || '';
    return { category, task, tag, keyTask, narrative, internalClient, workCategory, dealName, bscTag, bscItem, virtualGroup, item };
  };

  // 判断是否是投资法务中心
  const isInvestmentLegal = user?.team === '投资法务中心';
  // 判断是否是公司及国际金融事务中心
  const isInternationalFinance = user?.team === '公司及国际金融事务中心';

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-white rounded-xl border border-slate-200/60 shadow-lg shadow-slate-200/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neutral-600">今日工时</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="text-2xl font-bold text-neutral-900">{stats.todayHours.toFixed(1)} h</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/60 shadow-lg shadow-slate-200/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neutral-600">本周工时</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div className="text-2xl font-bold text-neutral-900">{stats.weekHours.toFixed(1)} h</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/60 shadow-lg shadow-slate-200/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neutral-600">本月工时</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </div>
          <div className="text-2xl font-bold text-neutral-900">{stats.monthHours.toFixed(1)} h</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/60 shadow-lg shadow-slate-200/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neutral-600">记录条数</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </div>
          <div className="text-2xl font-bold text-neutral-900">{stats.totalEntries}</div>
        </div>
      </div>

      {/* 跨月提醒弹窗 */}
      {showCrossMonthReminder && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 border border-amber-200 shadow-lg shadow-amber-100/50 p-5">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-100/50 to-orange-100/30 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
          
          <div className="relative flex items-start gap-4">
            <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-200">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <div className="flex-1">
              <h4 className="text-base font-bold text-amber-800 mb-1">跨月工时提醒</h4>
              <p className="text-sm text-amber-700 mb-4">
                当前是月初，您是否需要补录上个月的工时记录？
                <span className="block text-xs text-amber-600 mt-1">
                  选择"补录上月"将自动切换日期到上月最后一个工作日
                </span>
              </p>
              
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleRecordLastMonth}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-sm font-medium shadow-md shadow-amber-200 transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                  </svg>
                  是，补录上月
                </button>
                <button
                  type="button"
                  onClick={handleRecordThisMonth}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium shadow-sm transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  否，记录本月
                </button>
                <button
                  type="button"
                  onClick={dismissCrossMonthReminder}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm text-amber-600 hover:text-amber-700 font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  不再提醒
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 工时录入表单 */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-white to-blue-50/30 border border-slate-200/60 shadow-xl shadow-slate-200/50">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-100/40 to-indigo-100/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-indigo-100/30 to-violet-100/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>
              
              <div className="relative px-6 pt-6 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-xl shadow-lg ${editingId ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-200' : 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-200'}`}>
                    {editingId ? (
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">{editingId ? '修改工时' : '新增工时'}</h3>
                    <p className="text-xs text-slate-500">{editingId ? '编辑已有的工时记录' : '记录您的工作时间'}</p>
                  </div>
                </div>
              </div>

              <div className="mx-6 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>

              <div className="relative px-6 py-5">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      日期
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-100 text-rose-500 text-xs pt-[3px]">*</span>
                    </label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 hover:border-blue-300 hover:shadow-md hover:shadow-blue-100/50 transition-all duration-200 cursor-pointer"
                        required
                      />
                    </div>
                  </div>

                  {template.fields.map(renderField)}

                  <div className="pt-2 space-y-2">
                    <Button 
                      type="submit" 
                      disabled={submitting}
                      className="relative w-full h-12 rounded-xl bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 overflow-hidden group"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                      
                      {submitting ? (
                        <span className="relative flex items-center justify-center gap-2">
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          保存中...
                        </span>
                      ) : (
                        <span className="relative flex items-center justify-center gap-2">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                          </svg>
                          {editingId ? '更新草稿' : '保存草稿'}
                        </span>
                      )}
                    </Button>
                    {editingId && (
                      <Button 
                        type="button"
                        variant="outline"
                        onClick={resetForm}
                        className="w-full h-10 rounded-xl border-slate-200 bg-white/80 text-slate-600 font-medium hover:bg-slate-50 hover:border-slate-300 hover:text-slate-700 transition-all duration-200"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        取消编辑
                      </Button>
                    )}
                  </div>
                </form>
              </div>

              <div className="relative px-6 pb-5">
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-50/80 border border-slate-100">
                  <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-slate-500">
                    带 <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-rose-100 text-rose-500 text-[10px] pt-[2px] mx-0.5">*</span> 的字段为必填项
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 草稿记录列表 + 请假登记 */}
        <div className="lg:col-span-2 flex flex-col h-full">
          {/* 草稿记录 - 占2/3 */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl shadow-slate-200/50 flex flex-col flex-[2]">
            <div className="px-6 py-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                    <line x1="8" y1="6" x2="21" y2="6"/>
                    <line x1="8" y1="12" x2="21" y2="12"/>
                    <line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/>
                    <line x1="3" y1="12" x2="3.01" y2="12"/>
                    <line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                  草稿记录
                  {userDraftEntries.length > 0 && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                      {userDraftEntries.length} 条
                    </span>
                  )}
                  <span className="text-xs font-normal text-rose-500 ml-2">
                    ⚠️ 请勾选记录并点击"提交"按钮完成保存
                  </span>
                </h3>
                <div className="flex items-center gap-3">
                  {userDraftEntries.length > 0 && (
                    <>
                      <button
                        onClick={toggleSelectAll}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {selectedIds.size === userDraftEntries.length ? '取消全选' : '全选'}
                      </button>
                      <Button
                        size="sm"
                        disabled={selectedIds.size === 0 || submitting}
                        onClick={handleBatchSubmit}
                        className="h-8 px-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-xs font-medium rounded-lg shadow-sm"
                      >
                        {submitting ? (
                          <span className="flex items-center gap-1">
                            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                            </svg>
                            提交中
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            提交 {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                          </span>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="p-4 flex-1 overflow-hidden">
              {userDraftEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-neutral-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-50">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <p className="text-sm">暂无草稿记录</p>
                  <p className="text-xs mt-1">请在左侧填写并保存草稿</p>
                </div>
              ) : (
                <div className="space-y-2 h-full overflow-y-auto pr-2">
                  {userDraftEntries.map((entry) => {
                    const { category, task, tag, keyTask, internalClient, workCategory, narrative, dealName, bscTag, bscItem, virtualGroup, item } = getEntryDisplayInfo(entry);
                    const isSelected = selectedIds.has(entry.id);
                    const isEditing = editingId === entry.id;
                    return (
                      <div
                        key={entry.id}
                        className={`flex items-start justify-between p-3 rounded-xl border transition-all duration-200 ${
                          isEditing 
                            ? 'bg-blue-50/80 border-blue-200' 
                            : isSelected 
                              ? 'bg-green-50/80 border-green-200' 
                              : 'bg-slate-50/80 border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <div className="flex items-center mr-3 mt-0.5">
                          <button
                            onClick={() => toggleSelect(entry.id)}
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                              isSelected 
                                ? 'bg-green-500 border-green-500' 
                                : 'border-slate-300 hover:border-green-400'
                            }`}
                          >
                            {isSelected && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          {/* 第一行：根据团队显示不同内容 */}
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {isInvestmentLegal ? (
                              <>
                                {/* 投资法务中心：Deal/Matter Name + Deal/Matter Category + 描述 */}
                                <span className="text-sm font-semibold text-neutral-800 truncate max-w-[180px]" title={dealName}>
                                  {dealName || '未填写'}
                                </span>
                                {category && (
                                  <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-600 truncate max-w-[120px]" title={category}>
                                    {category.length > 15 ? category.substring(0, 15) + '...' : category}
                                  </span>
                                )}
                                {narrative && (
                                  <span 
                                    className="text-xs text-neutral-500 truncate max-w-[150px]"
                                    title={narrative}
                                  >
                                    {narrative.length > 15 ? narrative.substring(0, 15) + '...' : narrative}
                                  </span>
                                )}
                              </>
                            ) : isInternationalFinance ? (
                              <>
                                {/* 公司及国际金融事务中心：Internal Client + Virtual Group + 描述 */}
                                <span className="text-sm font-semibold text-neutral-800 truncate max-w-[180px]" title={internalClient}>
                                  {internalClient || '未填写'}
                                </span>
                                {virtualGroup && (
                                  <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-600 truncate max-w-[120px]" title={virtualGroup}>
                                    {virtualGroup.length > 15 ? virtualGroup.substring(0, 15) + '...' : virtualGroup}
                                  </span>
                                )}
                                {narrative && (
                                  <span 
                                    className="text-xs text-neutral-500 truncate max-w-[150px]"
                                    title={narrative}
                                  >
                                    {narrative.length > 15 ? narrative.substring(0, 15) + '...' : narrative}
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                {/* 其他中心：工作任务 + 事项分类 + Narrative */}
                                <span className="text-sm font-semibold text-neutral-800 truncate max-w-[200px]">
                                  {task || category || '未分类'}
                                </span>
                                {category && task && (
                                  <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-600 truncate max-w-[100px]">
                                    {category.replace(/^_/, '').replace(/_/g, ' ')}
                                  </span>
                                )}
                                {narrative && (
                                  <div className="group/narrative relative flex-1 min-w-0">
                                    <span 
                                      className="text-xs text-neutral-500 truncate block max-w-[200px]"
                                      title={narrative}
                                    >
                                      {narrative.length > 20 ? narrative.substring(0, 20) + '...' : narrative}
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          
                          {/* 第二行：标签信息 */}
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            {isInvestmentLegal ? (
                              <>
                                {/* 投资法务中心：BSC Tag + BSC Item */}
                                {bscTag && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-purple-50 text-purple-600 border border-purple-100">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                                      <line x1="7" y1="7" x2="7.01" y2="7"/>
                                    </svg>
                                    {bscTag}
                                  </span>
                                )}
                                {bscItem && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-amber-50 text-amber-600 border border-amber-100" title={bscItem}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                    </svg>
                                    {bscItem.length > 20 ? bscItem.substring(0, 20) + '...' : bscItem}
                                  </span>
                                )}
                              </>
                            ) : isInternationalFinance ? (
                              <>
                                {/* 公司及国际金融事务中心：Tag + Item */}
                                {tag && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-purple-50 text-purple-600 border border-purple-100" title={tag}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                                      <line x1="7" y1="7" x2="7.01" y2="7"/>
                                    </svg>
                                    {tag.replace(/^_/, '').length > 15 ? tag.replace(/^_/, '').substring(0, 15) + '...' : tag.replace(/^_/, '')}
                                  </span>
                                )}
                                {item && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-amber-50 text-amber-600 border border-amber-100" title={item}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                    </svg>
                                    {item.length > 20 ? item.substring(0, 20) + '...' : item}
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                {/* 其他中心的标签 */}
                                {tag && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-purple-50 text-purple-600 border border-purple-100">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                                      <line x1="7" y1="7" x2="7.01" y2="7"/>
                                    </svg>
                                    {tag}
                                  </span>
                                )}
                                {keyTask && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-amber-50 text-amber-600 border border-amber-100">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                    </svg>
                                    {keyTask.length > 15 ? keyTask.substring(0, 15) + '...' : keyTask}
                                  </span>
                                )}
                                {internalClient && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-green-50 text-green-600 border border-green-100">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                      <circle cx="9" cy="7" r="4"/>
                                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                                    </svg>
                                    {internalClient.length > 12 ? internalClient.substring(0, 12) + '...' : internalClient}
                                  </span>
                                )}
                                {workCategory && !category && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-slate-100 text-slate-600 border border-slate-200">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="3" y="3" width="7" height="7"/>
                                      <rect x="14" y="3" width="7" height="7"/>
                                      <rect x="14" y="14" width="7" height="7"/>
                                      <rect x="3" y="14" width="7" height="7"/>
                                    </svg>
                                    {workCategory}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          
                          {/* 第三行：日期 */}
                          <div className="flex items-center gap-3 text-xs text-neutral-500">
                            <span className="flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                <line x1="16" y1="2" x2="16" y2="6"/>
                                <line x1="8" y1="2" x2="8" y2="6"/>
                                <line x1="3" y1="10" x2="21" y2="10"/>
                              </svg>
                              {entry.date}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 ml-3">
                          <span className="text-base font-semibold text-blue-600 whitespace-nowrap">{entry.hours}h</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(entry)}
                            className="h-7 w-7 p-0 text-neutral-400 hover:text-blue-500 hover:bg-blue-50"
                            title="复制"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(entry)}
                            className={`h-7 w-7 p-0 ${isEditing ? 'text-blue-500 bg-blue-100' : 'text-neutral-400 hover:text-amber-500 hover:bg-amber-50'}`}
                            title="编辑"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(entry.id)}
                            className="h-7 w-7 p-0 text-neutral-400 hover:text-red-500 hover:bg-red-50"
                            title="删除"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
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

          {/* 请假登记 - 占1/3 */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl shadow-slate-200/50 flex-1 mt-4">
            <div className="px-6 py-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  请假登记
                  {userLeaveRecords.length > 0 && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
                      累计 {userLeaveRecords.reduce((sum, r) => sum + r.days, 0)} 天
                    </span>
                  )}
                </h3>
              </div>
            </div>
            <div className="p-4">
              <form onSubmit={handleLeaveSubmit} className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">开始日期</label>
                  <input
                    type="date"
                    value={leaveStartDate}
                    onChange={(e) => setLeaveStartDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-800 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-50 hover:border-orange-300 transition-all cursor-pointer"
                    required
                  />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">结束日期</label>
                  <input
                    type="date"
                    value={leaveEndDate}
                    min={leaveStartDate}
                    onChange={(e) => setLeaveEndDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-800 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-50 hover:border-orange-300 transition-all cursor-pointer"
                    required
                  />
                </div>
                <div className="w-[90px]">
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">天数</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="30"
                      placeholder="1"
                      value={leaveDays}
                      onChange={(e) => setLeaveDays(e.target.value)}
                      required
                      className="w-full h-10 px-3 pr-8 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-800 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-50 hover:border-orange-300 transition-all"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">天</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    type="submit" 
                    disabled={leaveSubmitting}
                    className="h-10 px-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-sm font-medium rounded-lg shadow-sm"
                  >
                    {leaveSubmitting ? (
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                    ) : (
                      editingLeaveId ? '更新' : '保存'
                    )}
                  </Button>
                  {editingLeaveId && (
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={resetLeaveForm}
                      className="h-10 px-3 text-sm"
                    >
                      取消
                    </Button>
                  )}
                </div>
              </form>
              
              {/* 请假记录列表 */}
              {userLeaveRecords.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex flex-wrap gap-2">
                    {userLeaveRecords.slice(0, 5).map((record) => (
                      <div
                        key={record.id}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                          editingLeaveId === record.id 
                            ? 'bg-orange-100 border border-orange-300' 
                            : 'bg-slate-50 border border-slate-100'
                        }`}
                      >
                        <span className="text-slate-600">
                          {record.startDate === record.endDate 
                            ? record.startDate 
                            : `${record.startDate} ~ ${record.endDate}`}
                        </span>
                        <span className="font-medium text-orange-600">{record.days}天</span>
                        <button
                          onClick={() => handleEditLeave(record)}
                          className="text-slate-400 hover:text-amber-500 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteLeave(record.id)}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                    {userLeaveRecords.length > 5 && (
                      <span className="inline-flex items-center px-3 py-1.5 text-sm text-slate-500">
                        +{userLeaveRecords.length - 5} 条
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI 助手 */}
      <AIAssistant 
        fields={template.fields}
        teamName={user?.team || ''}
        onFillForm={(data) => {
          setFormData(prev => ({ ...prev, ...data }));
        }} 
      />
    </div>
  );
}
