// 用户角色类型
export type UserRole = 'admin' | 'user' | 'manager' | 'exporter';

// 用户地区类型
export type UserRegion = 'CN' | 'HK' | 'OTHER';

// 角色显示名称
export const RoleLabels: Record<UserRole, string> = {
  admin: '管理员',
  user: '普通用户',
  manager: '管理者',
  exporter: '数据导出者',
};

// 地区显示名称
export const RegionLabels: Record<UserRegion, string> = {
  CN: '中国内地',
  HK: '中国香港',
  OTHER: '海外/其他',
};

// 角色颜色
export const RoleColors: Record<UserRole, string> = {
  admin: 'bg-red-100 text-red-700',
  user: 'bg-slate-100 text-slate-700',
  manager: 'bg-blue-100 text-blue-700',
  exporter: 'bg-emerald-100 text-emerald-700',
};

// 地区颜色
export const RegionColors: Record<UserRegion, string> = {
  CN: 'bg-orange-100 text-orange-700',
  HK: 'bg-purple-100 text-purple-700',
  OTHER: 'bg-teal-100 text-teal-700',
};

// 用户接口
export interface User {
  id: string;
  username: string;
  password?: string; // 可选，从 API 获取时不包含密码
  name: string;
  email: string;
  role: UserRole;
  region?: UserRegion; // 国家/地区
  team?: string;
  group?: string; // 小组（团队下的子分组）
  department?: string;
  createdAt: string;
  updatedAt: string;
}

// 登录表单数据
export interface LoginFormData {
  username: string;
  password: string;
}

// 注册表单数据
export interface RegisterFormData {
  username: string;
  password: string;
  confirmPassword: string;
  name: string;
  email: string;
  team?: string;
}

// 修改密码表单数据
export interface ChangePasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// 认证状态
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
}
