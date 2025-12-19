import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface LanguageSwitcherProps {
  variant?: 'icon' | 'text' | 'dropdown';
  className?: string;
}

export function LanguageSwitcher({ variant = 'icon', className }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  
  const currentLang = i18n.language?.startsWith('zh') ? 'zh' : 'en';
  
  const toggleLanguage = () => {
    const newLang = currentLang === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(newLang);
  };

  // 图标样式（用于登录页右上角）
  if (variant === 'icon') {
    return (
      <button
        onClick={toggleLanguage}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
          "bg-white/80 hover:bg-white border border-slate-200",
          "text-sm font-medium text-slate-600 hover:text-slate-900",
          "transition-all duration-200 shadow-sm hover:shadow",
          className
        )}
        title={currentLang === 'zh' ? 'Switch to English' : '切换到中文'}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="1.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <span>{currentLang === 'zh' ? 'EN' : '中'}</span>
      </button>
    );
  }

  // 文字样式（用于侧边栏菜单项）
  if (variant === 'text') {
    return (
      <button
        onClick={toggleLanguage}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-lg",
          "text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100",
          "transition-colors duration-200",
          className
        )}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="1.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <span>{currentLang === 'zh' ? 'English' : '中文'}</span>
      </button>
    );
  }

  // 下拉样式（备用）
  return (
    <div className={cn("relative", className)}>
      <select
        value={currentLang}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="appearance-none bg-white border border-slate-200 rounded-lg px-3 py-1.5 pr-8 text-sm cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="zh">中文</option>
        <option value="en">English</option>
      </select>
      <svg 
        className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"
        xmlns="http://www.w3.org/2000/svg" 
        width="14" 
        height="14" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2"
      >
        <path d="M6 9l6 6 6-6"/>
      </svg>
    </div>
  );
}
