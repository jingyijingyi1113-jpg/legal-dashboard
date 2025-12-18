import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, UserRole, UserRegion, LoginFormData, RegisterFormData, ChangePasswordFormData } from '@/types/user';
import { authApi, userApi } from '@/api';

// API 模式开关 - 设置为 true 使用后端 API，false 使用 localStorage
const USE_API = true;

// 默认管理员账户
const DEFAULT_ADMIN: User = {
  id: 'admin-001',
  username: 'admin',
  password: 'admin123', // 实际项目中应该加密
  name: '系统管理员',
  email: 'admin@example.com',
  role: 'admin',
  region: 'CN',
  department: '合规交易部',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// 预置用户列表
const DEFAULT_USERS: User[] = [
  DEFAULT_ADMIN,
  {
    id: 'user-cinndywu',
    username: 'cinndywu',
    password: '123456',
    name: 'cinndywu',
    email: 'cinndywu@tencent.com',
    role: 'admin',
    region: 'CN',
    team: '业务管理及合规检测中心',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user-ivyjyding',
    username: 'ivyjyding',
    password: '123456',
    name: 'ivyjyding',
    email: 'ivyjyding@tencent.com',
    role: 'admin',
    region: 'CN',
    team: '业务管理及合规检测中心',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user-catherineou',
    username: 'catherineou',
    password: '123456',
    name: 'catherineou',
    email: 'catherineou@tencent.com',
    role: 'manager',
    region: 'CN',
    team: '投资法务中心',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user-sallycheung',
    username: 'sallycheung',
    password: '123456',
    name: 'sallycheung',
    email: 'sallycheung@tencent.com',
    role: 'manager',
    region: 'HK',
    team: '公司及国际金融事务中心',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user-chrissyyu',
    username: 'chrissyyu',
    password: '123456',
    name: 'chrissyyu',
    email: 'chrissyyu@tencent.com',
    role: 'user',
    region: 'CN',
    team: '业务管理及合规检测中心',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  users: User[];
  loading: boolean;
  useApi: boolean;
  login: (data: LoginFormData) => Promise<{ success: boolean; message: string }>;
  register: (data: RegisterFormData) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  changePassword: (data: ChangePasswordFormData) => Promise<{ success: boolean; message: string }>;
  addUser: (user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) => Promise<{ success: boolean; message: string }>;
  deleteUser: (userId: string) => Promise<{ success: boolean; message: string }>;
  updateUserRole: (userId: string, role: UserRole) => Promise<{ success: boolean; message: string }>;
  updateUserRegion: (userId: string, region: UserRegion) => Promise<{ success: boolean; message: string }>;
  updateUserField: (userId: string, field: 'username' | 'email' | 'team' | 'group', value: string) => Promise<{ success: boolean; message: string }>;
  importUsers: (users: Omit<User, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<{ success: boolean; message: string; imported: number; failed: number }>;
  refreshUsers: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USERS: 'task_platform_users',
  CURRENT_USER: 'task_platform_current_user',
  AUTH_TOKEN: 'auth_token',
};

// 使用 sessionStorage 存储会话信息（每个窗口/标签页独立）
// 使用 localStorage 存储用户列表（共享数据库）
const sessionStore = {
  getItem: (key: string) => sessionStorage.getItem(key),
  setItem: (key: string, value: string) => sessionStorage.setItem(key, value),
  removeItem: (key: string) => sessionStorage.removeItem(key),
};

const localStore = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: (key: string) => localStorage.removeItem(key),
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // 初始化：从 sessionStorage 加载用户数据，或从 API 获取
  useEffect(() => {
    const initAuth = async () => {
      try {
        // 检查是否有 token，尝试从 API 获取用户信息
        const token = sessionStore.getItem(STORAGE_KEYS.AUTH_TOKEN);
        if (USE_API && token) {
          try {
            const response = await authApi.getCurrentUser();
            if (response.success && response.data) {
              const apiUser = response.data;
              // 转换 API 用户格式为本地格式
              const localUser: User = {
                id: String(apiUser.id),
                username: apiUser.username,
                name: apiUser.realName,
                email: apiUser.email || '',
                role: apiUser.role as UserRole,
                team: apiUser.team,
                group: apiUser.group || (apiUser as any).user_group,
                department: apiUser.center,
                aiEnabled: apiUser.aiEnabled,
                canUseAi: apiUser.canUseAi,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              setUser(localUser);
              sessionStore.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(localUser));
              
              // 如果是管理员，从 API 加载所有用户
              if (localUser.role === 'admin') {
                try {
                  const usersResponse = await userApi.getAllUsers();
                  if (usersResponse.success && usersResponse.data) {
                    const apiUsers = usersResponse.data.map((u: any) => ({
                      id: String(u.id),
                      username: u.username,
                      name: u.name || u.realName || u.username,
                      email: u.email || '',
                      role: u.role as UserRole,
                      region: (u.region || 'CN') as UserRegion,
                      team: u.team,
                      group: u.group,
                      department: u.center,
                      aiEnabled: u.aiEnabled,
                      createdAt: u.createdAt || new Date().toISOString(),
                      updatedAt: u.updatedAt || new Date().toISOString(),
                    }));
                    setUsers(apiUsers);
                    localStore.setItem(STORAGE_KEYS.USERS, JSON.stringify(apiUsers));
                  }
                } catch (error) {
                  console.log('获取用户列表失败:', error);
                }
              }
              
              setLoading(false);
              return;
            }
          } catch (error) {
            console.log('API 认证失败，回退到本地模式');
            sessionStore.removeItem(STORAGE_KEYS.AUTH_TOKEN);
          }
        }

        // 回退到 localStorage 模式
        // 加载用户列表
        const storedUsers = localStore.getItem(STORAGE_KEYS.USERS);
        let userList: User[] = storedUsers ? JSON.parse(storedUsers) : [];
        
        // 确保所有预置用户都存在，并同步更新角色
        let needsUpdate = false;
        for (const defaultUser of DEFAULT_USERS) {
          const existingIndex = userList.findIndex(u => u.username === defaultUser.username);
          if (existingIndex === -1) {
            // 用户不存在，添加
            userList.push(defaultUser);
            needsUpdate = true;
          } else {
            // 用户存在，同步角色和团队信息
            const existingUser = userList[existingIndex];
            if (existingUser.role !== defaultUser.role || existingUser.team !== defaultUser.team) {
              userList[existingIndex] = {
                ...existingUser,
                role: defaultUser.role,
                team: defaultUser.team,
                updatedAt: new Date().toISOString(),
              };
              needsUpdate = true;
            }
          }
        }
        
        if (needsUpdate) {
          localStore.setItem(STORAGE_KEYS.USERS, JSON.stringify(userList));
        }
        setUsers(userList);

        // 加载当前登录用户（从 sessionStorage）
        const storedUser = sessionStore.getItem(STORAGE_KEYS.CURRENT_USER);
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          // 验证用户是否仍存在于用户列表中，并获取最新信息
          const userExists = userList.find(u => u.id === parsedUser.id);
          if (userExists) {
            setUser(userExists);
            // 同步更新 sessionStorage 中的当前用户信息
            if (userExists.role !== parsedUser.role || userExists.team !== parsedUser.team) {
              sessionStore.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(userExists));
            }
          } else {
            sessionStore.removeItem(STORAGE_KEYS.CURRENT_USER);
          }
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // 监听登出事件
    const handleLogout = () => {
      setUser(null);
      sessionStore.removeItem(STORAGE_KEYS.CURRENT_USER);
      sessionStore.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    };
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  // 保存用户列表到 localStorage
  const saveUsers = (newUsers: User[]) => {
    setUsers(newUsers);
    localStore.setItem(STORAGE_KEYS.USERS, JSON.stringify(newUsers));
  };

  // 加载所有用户（管理员权限）
  const loadAllUsers = async () => {
    if (USE_API) {
      try {
        const response = await userApi.getAllUsers();
        console.log('API返回的用户数据:', response.data);
        if (response.success && response.data) {
          const apiUsers = response.data.map((apiUser: any) => {
            const mappedUser = {
              id: String(apiUser.id),
              username: apiUser.username,
              name: apiUser.name || apiUser.realName || apiUser.username,
              email: apiUser.email || '',
              role: apiUser.role as UserRole,
              region: (apiUser.region || 'CN') as UserRegion,
              team: apiUser.team,
              group: apiUser.group,
              department: apiUser.center,
              aiEnabled: apiUser.aiEnabled,
              createdAt: apiUser.createdAt || new Date().toISOString(),
              updatedAt: apiUser.updatedAt || new Date().toISOString(),
            };
            console.log('单个用户映射:', apiUser.username, 'aiEnabled:', apiUser.aiEnabled, '->', mappedUser.aiEnabled);
            return mappedUser;
          });
          console.log('映射后的用户数据:', apiUsers);
          setUsers(apiUsers);
          localStore.setItem(STORAGE_KEYS.USERS, JSON.stringify(apiUsers));
        }
      } catch (error) {
        console.log('获取用户列表失败:', error);
      }
    }
  };

  // 刷新当前用户状态（用于AI权限等更新后）
  const refreshCurrentUser = async () => {
    if (USE_API) {
      try {
        const response = await authApi.getCurrentUser();
        if (response.success && response.data) {
          const apiUser = response.data;
          const localUser: User = {
            id: String(apiUser.id),
            username: apiUser.username,
            name: apiUser.realName,
            email: apiUser.email || '',
            role: apiUser.role as UserRole,
            team: apiUser.team,
            group: apiUser.group || (apiUser as any).user_group,
            department: apiUser.center,
            aiEnabled: apiUser.aiEnabled,
            canUseAi: apiUser.canUseAi,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setUser(localUser);
          sessionStore.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(localUser));
        }
      } catch (error) {
        console.log('刷新当前用户失败:', error);
      }
    }
  };

  // 登录
  const login = async (data: LoginFormData): Promise<{ success: boolean; message: string }> => {
    // 尝试 API 登录
    if (USE_API) {
      try {
        const response = await authApi.login(data.username, data.password);
        if (response.success && response.data) {
          const { token, user: apiUser } = response.data;
          
          // 保存 token 到 sessionStorage
          sessionStore.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
          
          // 转换用户格式
          const localUser: User = {
            id: String(apiUser.id),
            username: apiUser.username,
            name: apiUser.realName,
            email: apiUser.email || '',
            role: apiUser.role as UserRole,
            team: apiUser.team,
            group: apiUser.group || (apiUser as any).user_group,
            department: apiUser.center,
            aiEnabled: apiUser.aiEnabled,
            canUseAi: apiUser.canUseAi,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          setUser(localUser);
          sessionStore.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(localUser));
          
          // 如果是管理员，加载所有用户
          if (localUser.role === 'admin') {
            await loadAllUsers();
          }
          
          // 触发登录事件，通知 OrganizationContext 刷新数据
          window.dispatchEvent(new CustomEvent('auth:login'));
          
          return { success: true, message: '登录成功' };
        }
        return { success: false, message: response.message || '登录失败' };
      } catch (error: any) {
        console.log('API 登录失败，尝试本地登录:', error.message);
        // API 失败，回退到本地登录
      }
    }

    // 本地登录
    const foundUser = users.find(
      u => u.username === data.username && u.password === data.password
    );

    if (foundUser) {
      setUser(foundUser);
      sessionStore.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(foundUser));
      return { success: true, message: '登录成功' };
    }

    return { success: false, message: '用户名或密码错误' };
  };

  // 注册
  const register = async (data: RegisterFormData): Promise<{ success: boolean; message: string }> => {
    // 尝试 API 注册
    if (USE_API) {
      try {
        const response = await authApi.register({
          username: data.username,
          password: data.password,
          realName: data.name,
          email: data.email,
          team: data.team || '业务管理及合规检测中心',
          center: '合规交易部',
        });
        if (response.success) {
          return { success: true, message: '注册成功，请登录' };
        }
        return { success: false, message: response.message || '注册失败' };
      } catch (error: any) {
        console.log('API 注册失败，尝试本地注册:', error.message);
        // API 失败，回退到本地注册
      }
    }

    // 本地注册
    // 检查用户名是否已存在
    if (users.some(u => u.username === data.username)) {
      return { success: false, message: '用户名已存在' };
    }

    // 检查邮箱是否已存在
    if (users.some(u => u.email === data.email)) {
      return { success: false, message: '邮箱已被注册' };
    }

    const newUser: User = {
      id: `user-${Date.now()}`,
      username: data.username,
      password: data.password,
      name: data.name,
      email: data.email,
      role: 'user', // 默认为普通用户
      team: data.team,
      department: '合规交易部',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newUsers = [...users, newUser];
    saveUsers(newUsers);

    return { success: true, message: '注册成功，请登录' };
  };

  // 登出
  const logout = () => {
    setUser(null);
    sessionStore.removeItem(STORAGE_KEYS.CURRENT_USER);
    sessionStore.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    // 清除 Dashboard 数据（只保存筛选条件和数据源类型）
    localStorage.removeItem('dashboard_filters');
    localStorage.removeItem('dashboard_data_source');
  };

  // 修改密码
  const changePassword = async (data: ChangePasswordFormData): Promise<{ success: boolean; message: string }> => {
    if (!user) {
      return { success: false, message: '请先登录' };
    }

    if (data.newPassword !== data.confirmPassword) {
      return { success: false, message: '两次输入的新密码不一致' };
    }

    // 尝试 API 修改密码
    if (USE_API) {
      try {
        const response = await authApi.changePassword(data.currentPassword, data.newPassword);
        if (response.success) {
          return { success: true, message: '密码修改成功' };
        }
        return { success: false, message: response.message || '密码修改失败' };
      } catch (error: any) {
        console.log('API 修改密码失败，尝试本地修改:', error.message);
      }
    }

    // 本地修改密码
    if (user.password !== data.currentPassword) {
      return { success: false, message: '当前密码错误' };
    }

    const updatedUsers = users.map(u => 
      u.id === user.id 
        ? { ...u, password: data.newPassword, updatedAt: new Date().toISOString() }
        : u
    );
    saveUsers(updatedUsers);

    const updatedUser = { ...user, password: data.newPassword, updatedAt: new Date().toISOString() };
    setUser(updatedUser);
    sessionStore.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));

    return { success: true, message: '密码修改成功' };
  };

  // 添加用户（管理员功能）
  const addUser = async (userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; message: string }> => {
    if (!user || user.role !== 'admin') {
      return { success: false, message: '无权限执行此操作' };
    }

    // 使用后端 API
    if (USE_API) {
      try {
        const response = await userApi.createUser({
          username: userData.username,
          password: userData.password || '123456',
          name: userData.name,
          email: userData.email,
          team: userData.team,
          department: userData.department || '合规交易部',
          role: userData.role,
          region: userData.region,
          group: userData.group,
        });
        if (response.success) {
          await loadAllUsers();
          return { success: true, message: '用户添加成功' };
        }
        return { success: false, message: response.message || '添加失败' };
      } catch (error: any) {
        return { success: false, message: error.message || '添加失败' };
      }
    }

    // 本地模式
    if (users.some(u => u.username === userData.username)) {
      return { success: false, message: '用户名已存在' };
    }

    const newUser: User = {
      ...userData,
      id: `user-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveUsers([...users, newUser]);
    return { success: true, message: '用户添加成功' };
  };

  // 删除用户（管理员功能）
  const deleteUser = async (userId: string): Promise<{ success: boolean; message: string }> => {
    if (!user || user.role !== 'admin') {
      return { success: false, message: '无权限执行此操作' };
    }

    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) {
      return { success: false, message: '用户不存在' };
    }

    if (targetUser.username === 'admin') {
      return { success: false, message: '不能删除系统管理员' };
    }

    // 使用后端 API
    if (USE_API) {
      try {
        const response = await userApi.deleteUser(parseInt(userId));
        if (response.success) {
          await loadAllUsers();
          return { success: true, message: '用户删除成功' };
        }
        return { success: false, message: response.message || '删除失败' };
      } catch (error: any) {
        return { success: false, message: error.message || '删除失败' };
      }
    }

    saveUsers(users.filter(u => u.id !== userId));
    return { success: true, message: '用户删除成功' };
  };

  // 更新用户角色（管理员功能）
  const updateUserRole = async (userId: string, role: UserRole): Promise<{ success: boolean; message: string }> => {
    if (!user || user.role !== 'admin') {
      return { success: false, message: '无权限执行此操作' };
    }

    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) {
      return { success: false, message: '用户不存在' };
    }

    if (targetUser.username === 'admin' && role !== 'admin') {
      return { success: false, message: '不能修改系统管理员的角色' };
    }

    // 使用后端 API
    if (USE_API) {
      try {
        const response = await userApi.updateUser(parseInt(userId), { role });
        if (response.success) {
          await loadAllUsers();
          return { success: true, message: '角色更新成功' };
        }
        return { success: false, message: response.message || '更新失败' };
      } catch (error: any) {
        return { success: false, message: error.message || '更新失败' };
      }
    }

    const updatedUsers = users.map(u =>
      u.id === userId
        ? { ...u, role, updatedAt: new Date().toISOString() }
        : u
    );
    saveUsers(updatedUsers);

    return { success: true, message: '角色更新成功' };
  };

  // 更新用户地区（管理员功能）
  const updateUserRegion = async (userId: string, region: UserRegion): Promise<{ success: boolean; message: string }> => {
    if (!user || user.role !== 'admin') {
      return { success: false, message: '无权限执行此操作' };
    }

    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) {
      return { success: false, message: '用户不存在' };
    }

    // 使用后端 API
    if (USE_API) {
      try {
        const response = await userApi.updateUser(parseInt(userId), { region });
        if (response.success) {
          await loadAllUsers();
          // 如果更新的是当前用户，同步更新当前用户状态
          if (userId === user.id) {
            const updatedCurrentUser = { ...user, region, updatedAt: new Date().toISOString() };
            setUser(updatedCurrentUser);
            sessionStore.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedCurrentUser));
          }
          return { success: true, message: '地区更新成功' };
        }
        return { success: false, message: response.message || '更新失败' };
      } catch (error: any) {
        return { success: false, message: error.message || '更新失败' };
      }
    }

    const updatedUsers = users.map(u =>
      u.id === userId
        ? { ...u, region, updatedAt: new Date().toISOString() }
        : u
    );
    saveUsers(updatedUsers);

    // 如果更新的是当前用户，同步更新当前用户状态
    if (userId === user.id) {
      const updatedCurrentUser = { ...user, region, updatedAt: new Date().toISOString() };
      setUser(updatedCurrentUser);
      sessionStore.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedCurrentUser));
    }

    return { success: true, message: '地区更新成功' };
  };

  // 更新用户字段（管理员功能）
  const updateUserField = async (userId: string, field: 'username' | 'email' | 'team' | 'group', value: string): Promise<{ success: boolean; message: string }> => {
    if (!user || user.role !== 'admin') {
      return { success: false, message: '无权限执行此操作' };
    }

    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) {
      return { success: false, message: '用户不存在' };
    }

    if (targetUser.username === 'admin') {
      return { success: false, message: '不能修改系统管理员信息' };
    }

    // 检查用户名唯一性
    if (field === 'username' && users.some(u => u.id !== userId && u.username === value)) {
      return { success: false, message: '用户名已存在' };
    }

    // 检查邮箱唯一性
    if (field === 'email' && users.some(u => u.id !== userId && u.email === value)) {
      return { success: false, message: '邮箱已被使用' };
    }

    // 使用后端 API
    if (USE_API) {
      try {
        const updateData: any = {};
        if (field === 'username') updateData.username = value;
        else if (field === 'email') updateData.email = value;
        else if (field === 'team') updateData.team = value;
        else if (field === 'group') updateData.group = value;
        
        const response = await userApi.updateUser(parseInt(userId), updateData);
        if (response.success) {
          await loadAllUsers();
          // 如果更新的是当前用户，同步更新当前用户状态
          if (userId === user.id) {
            const updatedCurrentUser = { ...user, [field]: value, updatedAt: new Date().toISOString() };
            setUser(updatedCurrentUser);
            sessionStore.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedCurrentUser));
          }
          const fieldLabels: Record<string, string> = { username: '用户名', email: '邮箱', team: '团队', group: '小组' };
          return { success: true, message: `${fieldLabels[field]}更新成功` };
        }
        return { success: false, message: response.message || '更新失败' };
      } catch (error: any) {
        return { success: false, message: error.message || '更新失败' };
      }
    }

    const updatedUsers = users.map(u =>
      u.id === userId
        ? { ...u, [field]: value, updatedAt: new Date().toISOString() }
        : u
    );
    saveUsers(updatedUsers);

    // 如果更新的是当前用户，同步更新当前用户状态
    if (userId === user.id) {
      const updatedCurrentUser = { ...user, [field]: value, updatedAt: new Date().toISOString() };
      setUser(updatedCurrentUser);
      sessionStore.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedCurrentUser));
    }

    const fieldLabels: Record<string, string> = { username: '用户名', email: '邮箱', team: '团队', group: '小组' };
    return { success: true, message: `${fieldLabels[field]}更新成功` };
  };

  // 批量导入用户（管理员功能）
  const importUsers = async (
    importData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>[]
  ): Promise<{ success: boolean; message: string; imported: number; failed: number }> => {
    if (!user || user.role !== 'admin') {
      return { success: false, message: '无权限执行此操作', imported: 0, failed: importData.length };
    }

    // 使用后端 API
    if (USE_API) {
      try {
        const response = await userApi.batchImport(importData.map(u => ({
          username: u.username,
          password: u.password || '123456',
          name: u.name,
          email: u.email,
          team: u.team,
          department: u.department || '合规交易部',
          role: u.role,
          region: u.region,
          group: u.group,
        })));
        if (response.success) {
          await loadAllUsers();
          const count = response.data?.count || 0;
          return { 
            success: true, 
            message: `成功导入 ${count} 个用户`,
            imported: count,
            failed: importData.length - count
          };
        }
        return { success: false, message: response.message || '导入失败', imported: 0, failed: importData.length };
      } catch (error: any) {
        return { success: false, message: error.message || '导入失败', imported: 0, failed: importData.length };
      }
    }

    // 本地模式
    let imported = 0;
    let failed = 0;
    const newUsers: User[] = [...users];

    for (const userData of importData) {
      // 检查用户名是否已存在
      if (newUsers.some(u => u.username === userData.username)) {
        failed++;
        continue;
      }

      const newUser: User = {
        ...userData,
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      newUsers.push(newUser);
      imported++;
    }

    saveUsers(newUsers);

    return {
      success: imported > 0,
      message: `成功导入 ${imported} 个用户，失败 ${failed} 个`,
      imported,
      failed,
    };
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!user,
        user,
        users,
        loading,
        useApi: USE_API,
        login,
        register,
        logout,
        changePassword,
        addUser,
        deleteUser,
        updateUserRole,
        updateUserRegion,
        updateUserField,
        importUsers,
        refreshUsers: loadAllUsers,
        refreshCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
