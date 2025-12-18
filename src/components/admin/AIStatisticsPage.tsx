import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { aiFeedbackApi, type AIFeedbackStats, type AIFeedbackDaily, type AIFeedbackRecord } from '@/api/index';

export function AIStatisticsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AIFeedbackStats | null>(null);
  const [dailyStats, setDailyStats] = useState<AIFeedbackDaily[]>([]);
  const [recentFeedbacks, setRecentFeedbacks] = useState<AIFeedbackRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'details'>('overview');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, recentRes] = await Promise.all([
        aiFeedbackApi.getStatistics(),
        aiFeedbackApi.getRecent(50),
      ]);

      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data.summary);
        setDailyStats(statsRes.data.daily);
      }

      if (recentRes.success && recentRes.data) {
        setRecentFeedbacks(recentRes.data);
      }
    } catch (error) {
      console.error('Failed to load AI statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return 'text-emerald-600';
    if (accuracy >= 50) return 'text-amber-600';
    return 'text-red-500';
  };

  const getAccuracyBg = (accuracy: number) => {
    if (accuracy >= 80) return 'bg-emerald-100';
    if (accuracy >= 50) return 'bg-amber-100';
    return 'bg-red-100';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
            <circle cx="7.5" cy="14.5" r="1.5" />
            <circle cx="16.5" cy="14.5" r="1.5" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-neutral-900">AI 工时助手精准度统计</h1>
          <p className="text-sm text-slate-500">追踪AI填充准确率，持续优化模型效果</p>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-premium">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600">总会话数</CardTitle>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-neutral-900">{stats?.totalSessions || 0}</div>
            <p className="text-xs text-slate-500 mt-1">已完成的AI辅助录入</p>
          </CardContent>
        </Card>

        <Card className="card-premium">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600">平均精准度</CardTitle>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getAccuracyColor(stats?.avgAccuracy || 0)}`}>
              {stats?.avgAccuracy || 0}%
            </div>
            <p className="text-xs text-slate-500 mt-1">字段匹配准确率</p>
          </CardContent>
        </Card>

        <Card className="card-premium">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600">高精准度</CardTitle>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats?.highAccuracyCount || 0}</div>
            <p className="text-xs text-slate-500 mt-1">≥80% 准确率</p>
          </CardContent>
        </Card>

        <Card className="card-premium">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600">需优化</CardTitle>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats?.lowAccuracyCount || 0}</div>
            <p className="text-xs text-slate-500 mt-1">&lt;50% 准确率</p>
          </CardContent>
        </Card>
      </div>

      {/* 精准度分布 */}
      {stats && stats.totalSessions > 0 && (
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-neutral-900">精准度分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex h-4 rounded-full overflow-hidden bg-slate-100">
                  <div 
                    className="bg-emerald-500 transition-all duration-500"
                    style={{ width: `${(stats.highAccuracyCount / stats.totalSessions) * 100}%` }}
                  />
                  <div 
                    className="bg-amber-400 transition-all duration-500"
                    style={{ width: `${(stats.mediumAccuracyCount / stats.totalSessions) * 100}%` }}
                  />
                  <div 
                    className="bg-red-400 transition-all duration-500"
                    style={{ width: `${(stats.lowAccuracyCount / stats.totalSessions) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-slate-600">高 ({stats.highAccuracyCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <span className="text-slate-600">中 ({stats.mediumAccuracyCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <span className="text-slate-600">低 ({stats.lowAccuracyCount})</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 标签页切换 */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'overview'
              ? 'border-violet-500 text-violet-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          每日趋势
        </button>
        <button
          onClick={() => setActiveTab('details')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'details'
              ? 'border-violet-500 text-violet-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          详细记录
        </button>
      </div>

      {/* 每日趋势 */}
      {activeTab === 'overview' && (
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-neutral-900">每日精准度趋势（近30天）</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyStats.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 text-slate-300">
                  <path d="M3 3v18h18" />
                  <path d="M18 17V9" />
                  <path d="M13 17V5" />
                  <path d="M8 17v-3" />
                </svg>
                <p>暂无数据</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-3 px-2 text-slate-500 font-medium">日期</th>
                      <th className="text-center py-3 px-2 text-slate-500 font-medium">会话数</th>
                      <th className="text-center py-3 px-2 text-slate-500 font-medium">平均精准度</th>
                      <th className="text-center py-3 px-2 text-slate-500 font-medium">总字段</th>
                      <th className="text-center py-3 px-2 text-slate-500 font-medium">匹配字段</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyStats.map((day) => (
                      <tr key={day.date} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="py-3 px-2 font-medium text-slate-700">{day.date}</td>
                        <td className="py-3 px-2 text-center text-slate-600">{day.sessions}</td>
                        <td className="py-3 px-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getAccuracyBg(day.avgAccuracy)} ${getAccuracyColor(day.avgAccuracy)}`}>
                            {day.avgAccuracy}%
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center text-slate-600">{day.totalFields}</td>
                        <td className="py-3 px-2 text-center text-slate-600">{day.totalMatched}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 详细记录 */}
      {activeTab === 'details' && (
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-neutral-900">最近反馈记录</CardTitle>
          </CardHeader>
          <CardContent>
            {recentFeedbacks.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 text-slate-300">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                <p>暂无反馈记录</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentFeedbacks.map((feedback) => (
                  <div key={feedback.id} className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-xs font-medium">
                          {feedback.realName?.charAt(0) || feedback.username?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">{feedback.realName || feedback.username}</p>
                          <p className="text-xs text-slate-400">{new Date(feedback.createdAt).toLocaleString('zh-CN')}</p>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getAccuracyBg(feedback.accuracy)} ${getAccuracyColor(feedback.accuracy)}`}>
                        {feedback.accuracy.toFixed(1)}% ({feedback.matchedCount}/{feedback.fieldCount})
                      </span>
                    </div>
                    
                    <div className="bg-slate-50 rounded-lg p-3 mb-3">
                      <p className="text-xs text-slate-500 mb-1">用户输入：</p>
                      <p className="text-sm text-slate-700">{feedback.userInput}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-violet-50 rounded-lg p-3">
                        <p className="text-violet-600 font-medium mb-2">AI 填充</p>
                        <div className="space-y-1">
                          {Object.entries(feedback.aiResult).slice(0, 5).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-slate-500">{key}:</span>
                              <span className="text-slate-700 truncate max-w-[120px]">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-3">
                        <p className="text-emerald-600 font-medium mb-2">最终提交</p>
                        <div className="space-y-1">
                          {Object.entries(feedback.finalResult).slice(0, 5).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-slate-500">{key}:</span>
                              <span className="text-slate-700 truncate max-w-[120px]">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
