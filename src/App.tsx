import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { TimesheetProvider } from './contexts/TimesheetContext';
import { DashboardPage } from './components/dashboard/DashboardPage';
import { Sidebar } from './components/layout/Sidebar';
import { TimesheetPage } from './components/timesheet/TimesheetPage';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { PermissionManagementPage } from './components/admin/PermissionManagementPage';
import { DataManagementPage } from './components/admin/DataManagementPage';
import { AIStatisticsPage } from './components/admin/AIStatisticsPage';

function AppContent() {
  const { isAuthenticated, loading, user } = useAuth();
  const [activeMenu, setActiveMenu] = useState<string>(() => {
    // 从 localStorage 恢复菜单状态
    return localStorage.getItem('activeMenu') || 'timesheet';
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // 检测是否为移动端
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setIsSidebarCollapsed(true);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 保存菜单状态到 localStorage
  useEffect(() => {
    localStorage.setItem('activeMenu', activeMenu);
  }, [activeMenu]);

  // 检查用户是否有权限访问看板
  const canAccessDashboard = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'exporter';

  // 处理菜单切换（移动端自动关闭侧边栏）
  const handleMenuChange = (menu: string) => {
    setActiveMenu(menu);
    if (isMobile) {
      setIsMobileSidebarOpen(false);
    }
  };

  // 加载中
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 flex items-center justify-center animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              <path d="M9 14v3" />
              <path d="M12 12v5" />
              <path d="M15 10v7" />
            </svg>
          </div>
          <p className="text-slate-500 text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  // 未登录 - 显示登录/注册页面
  if (!isAuthenticated) {
    if (authMode === 'login') {
      return <LoginPage onSwitchToRegister={() => setAuthMode('register')} />;
    }
    return <RegisterPage onSwitchToLogin={() => setAuthMode('login')} />;
  }

  // 已登录 - 显示主应用
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* 移动端遮罩层 */}
      {isMobile && isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* 移动端顶部导航栏 */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 z-20 flex items-center px-4 md:hidden">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="flex items-center gap-2 ml-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 text-white shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                <path d="M9 14v3" />
                <path d="M12 12v5" />
                <path d="M15 10v7" />
              </svg>
            </div>
            <span className="text-base font-semibold text-slate-800">任务记录</span>
          </div>
        </div>
      )}

      <Sidebar 
        activeMenu={activeMenu} 
        onMenuChange={handleMenuChange}
        isCollapsed={isSidebarCollapsed}
        onCollapsedChange={setIsSidebarCollapsed}
        isMobile={isMobile}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />
      <main 
        className="flex-1 transition-all duration-300 ease-out"
        style={{ 
          marginLeft: isMobile ? 0 : (isSidebarCollapsed ? '72px' : '240px'),
          paddingTop: isMobile ? '56px' : 0
        }}
      >
        {activeMenu === 'dashboard' && canAccessDashboard && <DashboardPage />}
        {activeMenu === 'dashboard' && !canAccessDashboard && <TimesheetPage />}
        {activeMenu === 'timesheet' && <TimesheetPage />}
        {activeMenu === 'permissions' && <PermissionManagementPage />}
        {activeMenu === 'dataManagement' && <DataManagementPage />}
        {activeMenu === 'aiStatistics' && <AIStatisticsPage />}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <TimesheetProvider>
          <AppContent />
        </TimesheetProvider>
      </OrganizationProvider>
    </AuthProvider>
  );
}

export default App;
