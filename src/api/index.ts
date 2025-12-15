// API 请求模块
import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';

// API 基础地址 - 开发环境使用本地，生产环境使用服务器地址
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001';

// 创建 axios 实例
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 自动添加 token
apiClient.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 统一处理错误
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      
      // 401 未授权 - token 过期或无效
      if (status === 401) {
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('current_user');
        // 可以在这里触发重新登录
        window.dispatchEvent(new CustomEvent('auth:logout'));
      }
      
      return Promise.reject({
        status,
        message: data?.message || '请求失败',
        data: data,
      });
    }
    
    // 网络错误
    return Promise.reject({
      status: 0,
      message: '网络连接失败，请检查网络',
    });
  }
);

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

// 用户类型
export interface User {
  id: number;
  username: string;
  realName: string;
  email?: string;
  team: string;
  center: string;
  role: string;
  region?: string;
  group?: string;
}

// 部门类型
export interface Department {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// 团队类型
export interface TeamData {
  id: string;
  name: string;
  departmentId: string;
  description?: string;
  leaderId?: number;
  createdAt: string;
  updatedAt: string;
}

// 小组类型
export interface GroupData {
  id: string;
  name: string;
  teamId: string;
  description?: string;
  leaderId?: number;
  createdAt: string;
  updatedAt: string;
}

// 工时记录类型
export interface TimesheetEntry {
  id: string;
  user_id: number;
  username: string;
  date: string;
  hours: number;
  status: 'draft' | 'submitted';
  data: Record<string, any>;
  created_at: string;
  updated_at: string;
  submitted_at?: string;
}

// 模板字段类型
export interface TemplateField {
  key: string;
  label: string;
  type: 'select' | 'number' | 'text' | 'date';
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
  placeholder?: string;
}

// 模板类型
export interface Template {
  id?: number;
  center: string;
  team?: string;
  name: string;
  fields: TemplateField[];
}

// ==================== 认证 API ====================

export const authApi = {
  // 用户登录
  login: (username: string, password: string): Promise<ApiResponse<{ token: string; user: User }>> => {
    return apiClient.post('/api/auth/login', { username, password });
  },

  // 用户注册
  register: (data: {
    username: string;
    password: string;
    realName: string;
    email?: string;
    team: string;
    center: string;
  }): Promise<ApiResponse<{ token: string; user: User }>> => {
    return apiClient.post('/api/auth/register', data);
  },

  // 获取当前用户信息
  getCurrentUser: (): Promise<ApiResponse<User>> => {
    return apiClient.get('/api/auth/me');
  },

  // 修改密码
  changePassword: (oldPassword: string, newPassword: string): Promise<ApiResponse> => {
    return apiClient.post('/api/auth/change-password', { oldPassword, newPassword });
  },

  // 获取所有用户（管理员）
  getAllUsers: (): Promise<ApiResponse<User[]>> => {
    return apiClient.get('/api/auth/users');
  },
};

// ==================== 工时记录 API ====================

export const timesheetApi = {
  // 获取当前用户的工时记录
  getEntries: (params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<ApiResponse<TimesheetEntry[]>> => {
    return apiClient.get('/api/timesheet/entries', { params });
  },

  // 创建工时记录
  createEntry: (data: {
    id?: string;
    date: string;
    hours: number;
    status?: 'draft' | 'submitted';
    user_group?: string;
    data: Record<string, any>;
  }): Promise<ApiResponse<{ id: string }>> => {
    return apiClient.post('/api/timesheet/entries', data);
  },

  // 获取单条工时记录
  getEntry: (entryId: string): Promise<ApiResponse<TimesheetEntry>> => {
    return apiClient.get(`/api/timesheet/entries/${entryId}`);
  },

  // 更新工时记录
  updateEntry: (entryId: string, data: {
    date?: string;
    hours?: number;
    data?: Record<string, any>;
  }): Promise<ApiResponse> => {
    return apiClient.put(`/api/timesheet/entries/${entryId}`, data);
  },

  // 删除工时记录
  deleteEntry: (entryId: string): Promise<ApiResponse> => {
    return apiClient.delete(`/api/timesheet/entries/${entryId}`);
  },

  // 提交工时记录
  submitEntry: (entryId: string): Promise<ApiResponse> => {
    return apiClient.post(`/api/timesheet/entries/${entryId}/submit`);
  },

  // 批量提交工时记录
  batchSubmit: (ids: string[]): Promise<ApiResponse> => {
    return apiClient.post('/api/timesheet/entries/batch-submit', { ids });
  },

  // 批量导入工时记录（管理员专用）
  batchImport: (entries: Array<{
    id: string;
    user_id: number;
    username: string;
    date: string;
    hours: number;
    status: 'draft' | 'submitted';
    data: Record<string, any>;
  }>): Promise<ApiResponse<{ count: number }>> => {
    return apiClient.post('/api/timesheet/entries/batch-import', { entries });
  },

  // 批量删除工时记录（管理员专用）
  batchDelete: (ids: string[]): Promise<ApiResponse<{ count: number }>> => {
    return apiClient.post('/api/timesheet/entries/batch-delete', { ids });
  },

  // 获取团队工时记录（管理员/组长）
  getTeamEntries: (params?: {
    center?: string;
    team?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<ApiResponse<TimesheetEntry[]>> => {
    return apiClient.get('/api/timesheet/team-entries', { params });
  },

  // 获取工时统计
  getStats: (): Promise<ApiResponse<{
    todayHours: number;
    weekHours: number;
    monthHours: number;
    totalEntries: number;
  }>> => {
    return apiClient.get('/api/timesheet/stats');
  },
};

// ==================== 模板 API ====================

export const templateApi = {
  // 获取所有模板
  getAllTemplates: (): Promise<ApiResponse<Template[]>> => {
    return apiClient.get('/api/templates');
  },

  // 获取指定中心的模板
  getTemplateByCenter: (center: string, team?: string): Promise<ApiResponse<Template>> => {
    return apiClient.get(`/api/templates/${encodeURIComponent(center)}`, {
      params: team ? { team } : undefined,
    });
  },

  // 创建或更新模板（管理员）
  saveTemplate: (data: {
    center: string;
    team?: string;
    name: string;
    fields: TemplateField[];
  }): Promise<ApiResponse> => {
    return apiClient.post('/api/templates', data);
  },

  // 获取当前用户的模板
  getMyTemplate: (): Promise<ApiResponse<Template>> => {
    return apiClient.get('/api/my-template');
  },
};

// ==================== 用户管理 API ====================

export const userApi = {
  // 获取所有用户（管理员）
  getAllUsers: (): Promise<ApiResponse<any[]>> => {
    return apiClient.get('/api/auth/users');
  },

  // 创建用户（管理员）
  createUser: (data: {
    username: string;
    password?: string;
    name: string;
    email?: string;
    team?: string;
    department?: string;
    role?: string;
    region?: string;
    group?: string;
  }): Promise<ApiResponse<{ id: number }>> => {
    return apiClient.post('/api/auth/users', data);
  },

  // 更新用户（管理员）
  updateUser: (userId: number, data: {
    username?: string;
    name?: string;
    email?: string;
    team?: string;
    role?: string;
    region?: string;
    group?: string;
    password?: string;
  }): Promise<ApiResponse> => {
    return apiClient.put(`/api/auth/users/${userId}`, data);
  },

  // 删除用户（管理员）
  deleteUser: (userId: number): Promise<ApiResponse> => {
    return apiClient.delete(`/api/auth/users/${userId}`);
  },

  // 批量导入用户（管理员）
  batchImport: (users: Array<{
    username: string;
    password?: string;
    name: string;
    email?: string;
    team?: string;
    department?: string;
    role?: string;
    region?: string;
    group?: string;
  }>): Promise<ApiResponse<{ count: number }>> => {
    return apiClient.post('/api/auth/users/batch-import', { users });
  },
};

// ==================== 组织架构 API ====================

export const organizationApi = {
  // 获取所有部门
  getDepartments: (): Promise<ApiResponse<Department[]>> => {
    return apiClient.get('/api/organization/departments');
  },

  // 创建部门
  createDepartment: (data: { name: string; description?: string }): Promise<ApiResponse<{ id: string }>> => {
    return apiClient.post('/api/organization/departments', data);
  },

  // 更新部门
  updateDepartment: (deptId: string, data: { name: string; description?: string }): Promise<ApiResponse> => {
    return apiClient.put(`/api/organization/departments/${deptId}`, data);
  },

  // 删除部门
  deleteDepartment: (deptId: string): Promise<ApiResponse> => {
    return apiClient.delete(`/api/organization/departments/${deptId}`);
  },

  // 获取所有团队
  getTeams: (): Promise<ApiResponse<TeamData[]>> => {
    return apiClient.get('/api/organization/teams');
  },

  // 创建团队
  createTeam: (data: { name: string; departmentId: string; description?: string }): Promise<ApiResponse<{ id: string }>> => {
    return apiClient.post('/api/organization/teams', data);
  },

  // 更新团队
  updateTeam: (teamId: string, data: { name: string; departmentId: string; description?: string }): Promise<ApiResponse> => {
    return apiClient.put(`/api/organization/teams/${teamId}`, data);
  },

  // 删除团队
  deleteTeam: (teamId: string): Promise<ApiResponse> => {
    return apiClient.delete(`/api/organization/teams/${teamId}`);
  },

  // 获取所有小组
  getGroups: (teamId?: string): Promise<ApiResponse<GroupData[]>> => {
    return apiClient.get('/api/organization/groups', { params: teamId ? { teamId } : undefined });
  },

  // 创建小组
  createGroup: (data: { name: string; teamId: string; description?: string }): Promise<ApiResponse<{ id: string }>> => {
    return apiClient.post('/api/organization/groups', data);
  },

  // 更新小组
  updateGroup: (groupId: string, data: { name: string; teamId: string; description?: string }): Promise<ApiResponse> => {
    return apiClient.put(`/api/organization/groups/${groupId}`, data);
  },

  // 删除小组
  deleteGroup: (groupId: string): Promise<ApiResponse> => {
    return apiClient.delete(`/api/organization/groups/${groupId}`);
  },
};

// 导出 axios 实例供特殊情况使用
export { apiClient };

// 默认导出所有 API
export default {
  auth: authApi,
  timesheet: timesheetApi,
  template: templateApi,
  user: userApi,
  organization: organizationApi,
};
