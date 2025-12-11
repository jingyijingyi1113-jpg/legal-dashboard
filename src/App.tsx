import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { TimesheetProvider } from './contexts/TimesheetContext';
import { DashboardPage } from './components/dashboard/DashboardPage';
import { Sidebar } from './components/layout/Sidebar';
import { TimesheetPage } from './components/timesheet/TimesheetPage';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { UserManagementPage } from './components/admin/UserManagementPage';
import { OrganizationPage } from './components/admin/OrganizationPage';

function AppContent() {
  const { isAuthenticated, loading, user } = useAuth();
  const [activeMenu, setActiveMenu] = useState<string>('timesheet');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // 检查用户是否有权限访问看板
  const canAccessDashboard = user?.role === 'admin' || user?.role === 'manager';

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
      <Sidebar 
        activeMenu={activeMenu} 
        onMenuChange={setActiveMenu}
        isCollapsed={isSidebarCollapsed}
        onCollapsedChange={setIsSidebarCollapsed}
      />
      <main 
        className="flex-1 transition-all duration-300 ease-out"
        style={{ marginLeft: isSidebarCollapsed ? '72px' : '240px' }}
      >
        {activeMenu === 'dashboard' && canAccessDashboard && <DashboardPage />}
        {activeMenu === 'dashboard' && !canAccessDashboard && <TimesheetPage />}
        {activeMenu === 'timesheet' && <TimesheetPage />}
        {activeMenu === 'organization' && <OrganizationPage />}
        {activeMenu === 'users' && <UserManagementPage />}
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
