import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Department, Team, Group, DepartmentFormData, TeamFormData, GroupFormData } from '@/types/organization';
import { organizationApi } from '@/api/index';

interface OrganizationContextType {
  departments: Department[];
  teams: Team[];
  groups: Group[];
  loading: boolean;
  // 刷新数据
  refreshData: () => Promise<void>;
  // 部门操作
  addDepartment: (data: DepartmentFormData) => Promise<{ success: boolean; message: string }>;
  updateDepartment: (id: string, data: DepartmentFormData) => Promise<{ success: boolean; message: string }>;
  deleteDepartment: (id: string) => Promise<{ success: boolean; message: string }>;
  // 团队操作
  addTeam: (data: TeamFormData) => Promise<{ success: boolean; message: string }>;
  updateTeam: (id: string, data: TeamFormData) => Promise<{ success: boolean; message: string }>;
  deleteTeam: (id: string) => Promise<{ success: boolean; message: string }>;
  // 小组操作
  addGroup: (data: GroupFormData) => Promise<{ success: boolean; message: string }>;
  updateGroup: (id: string, data: GroupFormData) => Promise<{ success: boolean; message: string }>;
  deleteGroup: (id: string) => Promise<{ success: boolean; message: string }>;
  // 查询方法
  getDepartmentById: (id: string) => Department | undefined;
  getTeamById: (id: string) => Team | undefined;
  getGroupById: (id: string) => Group | undefined;
  getTeamsByDepartment: (departmentId: string) => Team[];
  getGroupsByTeam: (teamId: string) => Group[];
  getTeamNames: () => string[];
  getGroupNames: (teamName?: string) => string[];
  getTeamByName: (name: string) => Team | undefined;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  // 从后端加载数据
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [deptRes, teamRes, groupRes] = await Promise.all([
        organizationApi.getDepartments(),
        organizationApi.getTeams(),
        organizationApi.getGroups(),
      ]);

      if (deptRes.success && deptRes.data) {
        setDepartments(deptRes.data.map(d => ({
          id: d.id,
          name: d.name,
          description: d.description,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        })));
      }

      if (teamRes.success && teamRes.data) {
        setTeams(teamRes.data.map(t => ({
          id: t.id,
          name: t.name,
          departmentId: t.departmentId,
          description: t.description,
          leaderId: t.leaderId?.toString(),
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })));
      }

      if (groupRes.success && groupRes.data) {
        setGroups(groupRes.data.map(g => ({
          id: g.id,
          name: g.name,
          teamId: g.teamId,
          description: g.description,
          leaderId: g.leaderId?.toString(),
          createdAt: g.createdAt,
          updatedAt: g.updatedAt,
        })));
      }
    } catch (error) {
      console.error('Failed to load organization data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    // 检查是否已登录
    const token = sessionStorage.getItem('auth_token');
    if (token) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [loadData]);

  // 监听登录事件
  useEffect(() => {
    const handleLogin = () => {
      loadData();
    };
    window.addEventListener('auth:login', handleLogin);
    return () => window.removeEventListener('auth:login', handleLogin);
  }, [loadData]);

  const refreshData = async () => {
    await loadData();
  };

  // 添加部门
  const addDepartment = async (data: DepartmentFormData): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await organizationApi.createDepartment(data);
      if (res.success) {
        await loadData();
        return { success: true, message: '部门添加成功' };
      }
      return { success: false, message: res.message || '添加失败' };
    } catch (error: any) {
      return { success: false, message: error.message || '添加失败' };
    }
  };

  // 更新部门
  const updateDepartment = async (id: string, data: DepartmentFormData): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await organizationApi.updateDepartment(id, data);
      if (res.success) {
        await loadData();
        return { success: true, message: '部门更新成功' };
      }
      return { success: false, message: res.message || '更新失败' };
    } catch (error: any) {
      return { success: false, message: error.message || '更新失败' };
    }
  };

  // 删除部门
  const deleteDepartment = async (id: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await organizationApi.deleteDepartment(id);
      if (res.success) {
        await loadData();
        return { success: true, message: '部门删除成功' };
      }
      return { success: false, message: res.message || '删除失败' };
    } catch (error: any) {
      return { success: false, message: error.message || '删除失败' };
    }
  };

  // 添加团队
  const addTeam = async (data: TeamFormData): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await organizationApi.createTeam(data);
      if (res.success) {
        await loadData();
        return { success: true, message: '团队添加成功' };
      }
      return { success: false, message: res.message || '添加失败' };
    } catch (error: any) {
      return { success: false, message: error.message || '添加失败' };
    }
  };

  // 更新团队
  const updateTeam = async (id: string, data: TeamFormData): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await organizationApi.updateTeam(id, data);
      if (res.success) {
        await loadData();
        return { success: true, message: '团队更新成功' };
      }
      return { success: false, message: res.message || '更新失败' };
    } catch (error: any) {
      return { success: false, message: error.message || '更新失败' };
    }
  };

  // 删除团队
  const deleteTeam = async (id: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await organizationApi.deleteTeam(id);
      if (res.success) {
        await loadData();
        return { success: true, message: '团队删除成功' };
      }
      return { success: false, message: res.message || '删除失败' };
    } catch (error: any) {
      return { success: false, message: error.message || '删除失败' };
    }
  };

  // 添加小组
  const addGroup = async (data: GroupFormData): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await organizationApi.createGroup(data);
      if (res.success) {
        await loadData();
        return { success: true, message: '小组添加成功' };
      }
      return { success: false, message: res.message || '添加失败' };
    } catch (error: any) {
      return { success: false, message: error.message || '添加失败' };
    }
  };

  // 更新小组
  const updateGroup = async (id: string, data: GroupFormData): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await organizationApi.updateGroup(id, data);
      if (res.success) {
        await loadData();
        return { success: true, message: '小组更新成功' };
      }
      return { success: false, message: res.message || '更新失败' };
    } catch (error: any) {
      return { success: false, message: error.message || '更新失败' };
    }
  };

  // 删除小组
  const deleteGroup = async (id: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await organizationApi.deleteGroup(id);
      if (res.success) {
        await loadData();
        return { success: true, message: '小组删除成功' };
      }
      return { success: false, message: res.message || '删除失败' };
    } catch (error: any) {
      return { success: false, message: error.message || '删除失败' };
    }
  };

  // 根据ID获取部门
  const getDepartmentById = (id: string): Department | undefined => {
    return departments.find(d => d.id === id);
  };

  // 根据ID获取团队
  const getTeamById = (id: string): Team | undefined => {
    return teams.find(t => t.id === id);
  };

  // 根据ID获取小组
  const getGroupById = (id: string): Group | undefined => {
    return groups.find(g => g.id === id);
  };

  // 获取某部门下的所有团队
  const getTeamsByDepartment = (departmentId: string): Team[] => {
    return teams.filter(t => t.departmentId === departmentId);
  };

  // 获取某团队下的所有小组
  const getGroupsByTeam = (teamId: string): Group[] => {
    return groups.filter(g => g.teamId === teamId);
  };

  // 获取所有团队名称列表
  const getTeamNames = (): string[] => {
    return teams.map(t => t.name);
  };

  // 获取小组名称列表（可选按团队名称筛选）
  const getGroupNames = (teamName?: string): string[] => {
    if (teamName) {
      const team = teams.find(t => t.name === teamName);
      if (team) {
        return groups.filter(g => g.teamId === team.id).map(g => g.name);
      }
      return [];
    }
    return groups.map(g => g.name);
  };

  // 根据名称获取团队
  const getTeamByName = (name: string): Team | undefined => {
    return teams.find(t => t.name === name);
  };

  return (
    <OrganizationContext.Provider
      value={{
        departments,
        teams,
        groups,
        loading,
        refreshData,
        addDepartment,
        updateDepartment,
        deleteDepartment,
        addTeam,
        updateTeam,
        deleteTeam,
        addGroup,
        updateGroup,
        deleteGroup,
        getDepartmentById,
        getTeamById,
        getGroupById,
        getTeamsByDepartment,
        getGroupsByTeam,
        getTeamNames,
        getGroupNames,
        getTeamByName,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}
