import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { RoleLabels, RoleColors } from "@/types/user";
import { ChangePasswordModal } from "@/components/auth/ChangePasswordModal";

interface SidebarProps {
  activeMenu: string;
  onMenuChange: (menu: string) => void;
  isCollapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

const menuItems = [
  {
    id: 'timesheet',
    label: '工时记录',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    roles: ['admin', 'user', 'manager', 'exporter'],
  },
  {
    id: 'dashboard',
    label: '工时数据看板',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18"/>
        <path d="M18 17V9"/>
        <path d="M13 17V5"/>
        <path d="M8 17v-3"/>
      </svg>
    ),
    roles: ['admin', 'manager'],
  },
  {
    id: 'organization',
    label: '部门架构',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18"/>
        <path d="M9 8h1"/>
        <path d="M9 12h1"/>
        <path d="M9 16h1"/>
        <path d="M14 8h1"/>
        <path d="M14 12h1"/>
        <path d="M14 16h1"/>
        <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/>
      </svg>
    ),
    roles: ['admin'],
  },
  {
    id: 'users',
    label: '用户管理',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    roles: ['admin'],
  },
];

export function Sidebar({ activeMenu, onMenuChange, isCollapsed, onCollapsedChange }: SidebarProps) {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // 根据用户角色过滤菜单
  const visibleMenuItems = menuItems.filter(item => 
    user && item.roles.includes(user.role)
  );

  return (
    <>
      <aside 
        className={cn(
          "fixed left-0 top-0 z-40 h-screen transition-all duration-300 ease-out",
          "bg-gradient-to-b from-slate-50/95 via-white/90 to-slate-50/95",
          "backdrop-blur-xl border-r border-slate-200/40",
          isCollapsed ? "w-[72px]" : "w-60"
        )}
      >
        {/* Subtle ambient glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-blue-100/40 rounded-full blur-3xl" />
          <div className="absolute bottom-1/3 -left-10 w-32 h-32 bg-teal-100/30 rounded-full blur-3xl" />
        </div>

        {/* Header */}
        <div className={cn(
          "relative flex items-center h-16 border-b border-slate-200/40",
          isCollapsed ? "justify-center px-3" : "px-5"
        )}>
          <div className={cn(
            "flex items-center gap-3 transition-all duration-300",
            isCollapsed && "justify-center"
          )}>
            {/* Logo mark */}
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl blur-lg opacity-30" />
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
                {/* Clipboard with chart icon */}
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                  <path d="M9 14v3" />
                  <path d="M12 12v5" />
                  <path d="M15 10v7" />
                </svg>
              </div>
            </div>
            
            {/* Brand text */}
            <div className={cn(
              "overflow-hidden transition-all duration-300",
              isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
            )}>
              <span className="text-[20px] font-semibold text-slate-800 tracking-tight whitespace-nowrap">
                任务记录与分析
              </span>
            </div>
          </div>

          {/* Collapse toggle */}
          <button
            onClick={() => onCollapsedChange(!isCollapsed)}
            className={cn(
              "absolute right-0 translate-x-1/2 flex items-center justify-center",
              "w-6 h-6 rounded-full bg-white border border-slate-200/60",
              "text-slate-400 hover:text-slate-600 hover:border-slate-300",
              "shadow-sm hover:shadow transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            )}
            style={{ opacity: 1 }}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="12" 
              height="12" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className={cn(
                "transition-transform duration-300",
                isCollapsed ? "rotate-180" : ""
              )}
            >
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className={cn(
          "relative flex flex-col gap-1 py-4",
          isCollapsed ? "px-3" : "px-3"
        )}>
          {/* Section label */}
          <div className={cn(
            "mb-2 overflow-hidden transition-all duration-300",
            isCollapsed ? "h-0 opacity-0" : "h-auto opacity-100 px-3"
          )}>
            <span className="text-[10px] font-medium tracking-widest text-slate-400 uppercase">
              功能
            </span>
          </div>

          {visibleMenuItems.map((item, index) => {
            const isActive = activeMenu === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onMenuChange(item.id)}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl transition-all duration-200",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30",
                  isCollapsed ? "justify-center px-0 py-3" : "px-3 py-2.5",
                  isActive
                    ? "bg-white text-slate-900 shadow-sm shadow-slate-200/50"
                    : "text-slate-500 hover:text-slate-700 hover:bg-white/60"
                )}
                style={{
                  animationDelay: `${index * 50}ms`
                }}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gradient-to-b from-blue-500 to-blue-600 rounded-r-full" />
                )}

                {/* Icon container */}
                <span className={cn(
                  "relative flex items-center justify-center flex-shrink-0 transition-all duration-200",
                  isCollapsed ? "w-9 h-9" : "w-8 h-8",
                  isActive 
                    ? "text-blue-600" 
                    : "text-slate-400 group-hover:text-slate-600"
                )}>
                  {/* Icon background glow for active state */}
                  {isActive && (
                    <div className="absolute inset-0 bg-blue-100/60 rounded-lg" />
                  )}
                  <span className="relative">
                    {item.icon}
                  </span>
                </span>

                {/* Label */}
                <span className={cn(
                  "text-[13px] font-medium whitespace-nowrap overflow-hidden transition-all duration-300",
                  isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                )}>
                  {item.label}
                </span>

                {/* Tooltip for collapsed state */}
                {isCollapsed && (
                  <div className={cn(
                    "absolute left-full ml-3 px-3 py-1.5 rounded-lg",
                    "bg-slate-800 text-white text-xs font-medium whitespace-nowrap",
                    "opacity-0 invisible group-hover:opacity-100 group-hover:visible",
                    "transition-all duration-200 pointer-events-none",
                    "shadow-lg"
                  )}>
                    {item.label}
                    {/* Tooltip arrow */}
                    <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-800 rotate-45" />
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Divider with gradient */}
        <div className={cn(
          "mx-4 h-px bg-gradient-to-r from-transparent via-slate-200/60 to-transparent",
          isCollapsed && "mx-3"
        )} />

        {/* Footer - User Info */}
        <div className={cn(
          "absolute bottom-0 left-0 right-0 p-3",
          "border-t border-slate-200/40 bg-gradient-to-t from-slate-50/80 to-transparent"
        )}>
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl p-2 transition-all duration-200",
                "hover:bg-white/60",
                isCollapsed && "justify-center"
              )}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-blue-200 text-blue-600 ring-2 ring-white shadow-sm text-sm font-medium">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                {/* Online indicator */}
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full ring-2 ring-white" />
              </div>

              {/* User info */}
              <div className={cn(
                "flex-1 min-w-0 overflow-hidden transition-all duration-300 text-left",
                isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
              )}>
                <p className="text-[13px] font-medium text-slate-700 truncate">{user?.name || '用户'}</p>
                <p className="text-[11px] text-slate-400 truncate">{user?.team || '未分配团队'}</p>
              </div>

              {/* Expand icon */}
              <div className={cn(
                "flex-shrink-0 text-slate-300 transition-transform duration-200",
                isCollapsed && "hidden",
                showUserMenu && "rotate-180"
              )}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </button>

            {/* User dropdown menu */}
            {showUserMenu && !isCollapsed && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-lg border border-slate-200/60 overflow-hidden animate-fade-in-up">
                {/* User info header */}
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-medium text-slate-800">{user?.name}</p>
                  <p className="text-xs text-slate-500">{user?.email}</p>
                  <span className={cn(
                    "inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
                    user?.role && RoleColors[user.role]
                  )}>
                    {user?.role && RoleLabels[user.role]}
                  </span>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowChangePassword(true);
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    修改密码
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    退出登录
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Change Password Modal */}
      <ChangePasswordModal 
        isOpen={showChangePassword} 
        onClose={() => setShowChangePassword(false)} 
      />
    </>
  );
}
