import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { TimesheetEntryForm } from './TimesheetEntry';
import { TimesheetHistory } from './TimesheetHistory';
import { AdminTemplatePreview } from './AdminTemplatePreview';
import type { TimesheetEntry } from '@/types/timesheet';

type TabType = 'entry' | 'history';

export function TimesheetPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('entry');
  // 直接存储要复制的数据，而不是通过 ref
  const [copyData, setCopyData] = useState<TimesheetEntry | null>(null);
  
  // 回到顶部按钮状态
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // 监听滚动事件
  useEffect(() => {
    const handleScroll = () => {
      // 当滚动超过300px时显示按钮
      setShowScrollTop(window.scrollY > 300);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // 回到顶部函数
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // 判断是否为系统管理员（用户名为admin且没有团队归属）
  const isSystemAdmin = user?.username === 'admin' && !user?.team;

  // 从历史记录复制时切换到录入页并传递数据
  const handleCopyFromHistory = (entry: TimesheetEntry) => {
    setCopyData(entry);
    setActiveTab('entry');
  };

  // 清除复制数据（由子组件调用）
  const clearCopyData = () => {
    setCopyData(null);
  };

  // 系统管理员显示模版预览页面
  if (isSystemAdmin) {
    return <AdminTemplatePreview />;
  }

  return (
    <div className="min-h-screen section-gradient relative overflow-hidden">
      {/* Ambient background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-indigo-100/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 space-y-6 p-6">
        {/* 页面标题 */}
        <div className="flex justify-between items-center mb-2 animate-fade-in-down">
          <div>
            <h1 className="text-4xl font-bold text-neutral-900 tracking-tight" style={{ fontWeight: 700 }}>{t('timesheet.title')}</h1>
            <p className="text-neutral-500 mt-2 text-sm font-medium">
              {user?.team ? t('timesheet.page.currentTeam', { team: user.team }) : t('timesheet.page.recordYourHours')}
            </p>
          </div>
        </div>

        {/* Tab 切换 */}
        <div className="animate-fade-in-up">
          <div className="inline-flex p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setActiveTab('entry')}
              className={`
                px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                flex items-center gap-2
                ${activeTab === 'entry'
                  ? 'bg-white text-blue-600 shadow-md shadow-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900'
                }
              `}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              {t('timesheet.page.entry')}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`
                px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                flex items-center gap-2
                ${activeTab === 'history'
                  ? 'bg-white text-blue-600 shadow-md shadow-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900'
                }
              `}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t('timesheet.page.historyData')}
            </button>
          </div>
        </div>

        {/* Tab 内容 */}
        <div className="animate-fade-in-up">
          {activeTab === 'entry' ? (
            <TimesheetEntryForm copyData={copyData} onCopyDataConsumed={clearCopyData} />
          ) : (
            <TimesheetHistory onCopyEntry={handleCopyFromHistory} />
          )}
        </div>
      </div>
      
      {/* 回到顶部按钮 */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-50 p-3 bg-white border border-slate-200 rounded-full shadow-lg hover:shadow-xl hover:bg-slate-50 transition-all duration-300 group"
          aria-label={t('common.backToTop')}
        >
          <svg 
            className="w-5 h-5 text-slate-600 group-hover:text-slate-800 transition-colors" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      )}
    </div>
  );
}
