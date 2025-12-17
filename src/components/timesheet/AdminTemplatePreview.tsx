import { useState, useMemo, useRef, useEffect } from 'react';
import { TEAM_TEMPLATES, getChildOptions } from '@/config/teamTemplates';
import type { TemplateField, FieldOption, TeamTemplate } from '@/types/timesheet';
import { templateApi } from '@/api';

// 自定义下拉选择组件（只读预览版）
interface PreviewSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: FieldOption[];
  placeholder: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

function PreviewSelect({ value, onChange, options, placeholder, disabled, icon }: PreviewSelectProps) {
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
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 280;
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
          group w-full h-10 px-3 rounded-lg text-left
          flex items-center gap-2
          transition-all duration-200 ease-out text-sm
          ${disabled 
            ? 'bg-slate-50 border-slate-100 cursor-not-allowed opacity-60' 
            : 'bg-white border-slate-200 hover:border-blue-300 cursor-pointer'
          }
          ${isOpen 
            ? 'border-blue-400 ring-2 ring-blue-50' 
            : 'border'
          }
        `}
      >
        {icon && (
          <span className={`flex-shrink-0 transition-colors duration-200 ${isOpen ? 'text-blue-500' : 'text-slate-400'}`}>
            {icon}
          </span>
        )}
        <span className={`flex-1 truncate ${selectedOption ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg 
          className={`w-4 h-4 flex-shrink-0 transition-all duration-300 ${isOpen ? 'rotate-180 text-blue-500' : 'text-slate-400'}`}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && !disabled && (
        <div className={`absolute z-50 w-full bg-white rounded-lg border border-slate-200 shadow-xl overflow-hidden animate-in fade-in duration-200 ${dropUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          <div className="p-2 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索..."
                className="w-full h-8 pl-8 pr-2 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>
          
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">无匹配选项</div>
            ) : (
              filteredOptions.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`
                    w-full px-3 py-2 text-left text-xs
                    flex items-center gap-2
                    transition-all duration-150
                    ${option.value === value 
                      ? 'bg-blue-50 text-blue-700 font-medium' 
                      : 'text-slate-700 hover:bg-slate-50'
                    }
                    ${index !== filteredOptions.length - 1 ? 'border-b border-slate-50' : ''}
                  `}
                >
                  <span className={`
                    w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0
                    ${option.value === value 
                      ? 'border-blue-500 bg-blue-500' 
                      : 'border-slate-300'
                    }
                  `}>
                    {option.value === value && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    </div>
  );
}

// 字段图标映射
const fieldIcons: Record<string, React.ReactNode> = {
  category: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  task: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  tag: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  item: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  keyTask: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  workType: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  bscItem: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  virtualGroup: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  internalClient: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  workCategory: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  sourcePath: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  bscTag: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  dealName: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
};

// 团队颜色配置
const teamColors: Record<string, { gradient: string; border: string; text: string; icon: string; shadow: string }> = {
  '业务管理及合规检测中心': {
    gradient: 'from-blue-500 to-indigo-600',
    border: 'border-blue-200',
    text: 'text-blue-600',
    icon: 'from-blue-500 to-indigo-600',
    shadow: 'shadow-blue-200',
  },
  '投资法务中心': {
    gradient: 'from-emerald-500 to-teal-600',
    border: 'border-emerald-200',
    text: 'text-emerald-600',
    icon: 'from-emerald-500 to-teal-600',
    shadow: 'shadow-emerald-200',
  },
  '公司及国际金融事务中心': {
    gradient: 'from-violet-500 to-purple-600',
    border: 'border-violet-200',
    text: 'text-violet-600',
    icon: 'from-violet-500 to-purple-600',
    shadow: 'shadow-violet-200',
  },
};

// 单个模版预览卡片
interface TemplateCardProps {
  template: TeamTemplate;
}

function TemplateCard({ template }: TemplateCardProps) {
  const [formData, setFormData] = useState<Record<string, string | number>>({});
  const colors = teamColors[template.teamName] || teamColors['业务管理及合规检测中心'];

  // 初始化表单数据
  useEffect(() => {
    const initialData: Record<string, string | number> = {};
    template.fields.forEach(field => {
      initialData[field.key] = '';
    });
    setFormData(initialData);
  }, [template]);

  // 处理字段值变化
  const handleFieldChange = (key: string, value: string | number) => {
    const newFormData = { ...formData, [key]: value };
    
    // 如果是父字段变化，清空子字段
    template.fields.forEach(field => {
      if (field.parentField === key) {
        newFormData[field.key] = '';
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

  // 检查字段是否必填
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
    const required = isFieldRequired(field);
    
    switch (field.type) {
      case 'select':
      case 'cascader': {
        const options = getFieldOptions(field);
        const isDisabled = field.parentField && !formData[field.parentField];
        
        return (
          <div key={field.key} className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              {field.label}
              {required && (
                <span className="text-rose-500 text-[10px]">*</span>
              )}
            </label>
            <PreviewSelect
              value={value as string}
              onChange={(val) => handleFieldChange(field.key, val)}
              options={options}
              placeholder={field.placeholder || `请选择${field.label}`}
              disabled={!!isDisabled}
              icon={icon}
            />
            {field.parentField && !formData[field.parentField] && (
              <p className="text-[10px] text-amber-600 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          <div key={field.key} className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              {field.label}
              {field.required && <span className="text-rose-500 text-[10px]">*</span>}
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                className="w-full h-10 pl-9 pr-10 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                小时
              </div>
            </div>
          </div>
        );
      
      case 'text':
      default:
        return (
          <div key={field.key} className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              {field.label}
              {field.required ? (
                <span className="text-rose-500 text-[10px]">*</span>
              ) : (
                <span className="text-slate-400 text-[10px]">（可选）</span>
              )}
            </label>
            <div className="relative">
              <div className="absolute left-3 top-3 text-slate-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              </div>
              <textarea
                placeholder={field.placeholder}
                value={value as string}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                rows={2}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 resize-none"
              />
            </div>
          </div>
        );
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-white border ${colors.border} shadow-lg ${colors.shadow}`}>
      {/* 头部装饰 */}
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${colors.gradient} opacity-10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2`}></div>
      
      {/* 标题栏 */}
      <div className="relative px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br ${colors.icon} shadow-lg ${colors.shadow}`}>
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">{template.teamName}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">工时填写模版预览</p>
          </div>
        </div>
      </div>

      {/* 表单内容 */}
      <div className="relative px-5 py-4 space-y-4 max-h-[500px] overflow-y-auto">
        {/* 日期字段 */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            日期
            <span className="text-rose-500 text-[10px]">*</span>
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <input
              type="date"
              defaultValue={new Date().toISOString().split('T')[0]}
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 cursor-pointer"
            />
          </div>
        </div>

        {template.fields.map(renderField)}
      </div>

      {/* 底部提示 */}
      <div className="relative px-5 pb-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50/80 border border-slate-100">
          <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[10px] text-slate-500">
            此为模版预览，管理员无需填写工时
          </p>
        </div>
      </div>
    </div>
  );
}

export function AdminTemplatePreview() {
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 下载当前模版配置
  const handleDownloadConfig = async () => {
    try {
      const blob = await templateApi.downloadTemplateExcel();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template_config.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('下载失败:', error);
      setUploadResult({ success: false, message: '下载失败，请重试' });
    }
  };

  // 下载空白模版示例
  const handleDownloadSample = async () => {
    try {
      const blob = await templateApi.downloadSampleTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template_sample.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('下载失败:', error);
      setUploadResult({ success: false, message: '下载失败，请重试' });
    }
  };

  // 上传模版文件
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const result = await templateApi.uploadTemplateExcel(file);
      if (result.success) {
        setUploadResult({ success: true, message: result.message || `成功更新 ${result.data?.count || 0} 个模版` });
      } else {
        setUploadResult({ success: false, message: result.message || '上传失败' });
      }
    } catch (error: any) {
      console.error('上传失败:', error);
      setUploadResult({ success: false, message: error.message || '上传失败，请重试' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="min-h-screen section-gradient relative overflow-hidden">
      {/* Ambient background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-indigo-100/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 right-1/4 w-72 h-72 bg-violet-100/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 space-y-6 p-6">
        {/* 页面标题 */}
        <div className="flex justify-between items-center mb-2 animate-fade-in-down">
          <div>
            <h1 className="text-4xl font-bold text-neutral-900 tracking-tight" style={{ fontWeight: 700 }}>工时记录模版</h1>
            <p className="text-neutral-500 mt-2 text-sm font-medium">
              查看各中心的工时填写模版
            </p>
          </div>
          {/* 操作按钮 */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadSample}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm font-medium">下载模版示例</span>
            </button>
            <button
              onClick={handleDownloadConfig}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="text-sm font-medium">导出当前配置</span>
            </button>
            <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200 shadow-sm cursor-pointer">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span className="text-sm font-medium">{uploading ? '上传中...' : '上传模版'}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* 上传结果提示 */}
        {uploadResult && (
          <div className={`animate-fade-in-up flex items-center gap-3 px-4 py-3 rounded-xl border ${
            uploadResult.success 
              ? 'bg-green-50 border-green-100' 
              : 'bg-red-50 border-red-100'
          }`}>
            <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${
              uploadResult.success ? 'bg-green-500' : 'bg-red-500'
            } text-white`}>
              {uploadResult.success ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div>
              <p className={`text-sm font-medium ${uploadResult.success ? 'text-green-800' : 'text-red-800'}`}>
                {uploadResult.success ? '上传成功' : '上传失败'}
              </p>
              <p className={`text-xs mt-0.5 ${uploadResult.success ? 'text-green-600' : 'text-red-600'}`}>
                {uploadResult.message}
              </p>
            </div>
            <button
              onClick={() => setUploadResult(null)}
              className="ml-auto text-slate-400 hover:text-slate-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* 提示信息 */}
        <div className="animate-fade-in-up">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500 text-white">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-800">系统管理员模式</p>
              <p className="text-xs text-blue-600 mt-0.5">作为系统管理员，您可以在此预览各团队的工时填写模版。点击"下载模版示例"获取 Excel 格式说明，修改后上传即可更新模版配置。</p>
            </div>
          </div>
        </div>

        {/* 三个中心的模版卡片 */}
        <div className="grid gap-6 lg:grid-cols-3 animate-fade-in-up">
          {TEAM_TEMPLATES.map((template) => (
            <TemplateCard key={template.teamId} template={template} />
          ))}
        </div>
      </div>
    </div>
  );
}
