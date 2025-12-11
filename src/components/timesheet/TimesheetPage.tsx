import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { TimesheetEntryForm } from './TimesheetEntry';
import { TimesheetHistory } from './TimesheetHistory';

type TabType = 'entry' | 'history';

export function TimesheetPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('entry');

  // 从历史记录复制时切换到录入页
  const handleCopyFromHistory = () => {
    setActiveTab('entry');
  };

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
            <h1 className="text-4xl font-bold text-neutral-900 tracking-tight" style={{ fontWeight: 700 }}>工时记录</h1>
            <p className="text-neutral-500 mt-2 text-sm font-medium">
              {user?.team ? `当前团队：${user.team}` : '记录您的日常工时'}
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
              工时录入
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
              历史数据
            </button>
          </div>
        </div>

        {/* Tab 内容 */}
        <div className="animate-fade-in-up">
          {activeTab === 'entry' ? (
            <TimesheetEntryForm />
          ) : (
            <TimesheetHistory onCopyEntry={handleCopyFromHistory} />
          )}
        </div>
      </div>
    </div>
  );
}
