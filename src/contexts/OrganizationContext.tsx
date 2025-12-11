import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Department, Team, DepartmentFormData, TeamFormData } from '@/types/organization';

// 默认部门
const DEFAULT_DEPARTMENT: Department = {
  id: 'dept-001',
  name: '合规交易部',
  description: '负责公司合规与交易相关事务',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// 默认团队
const DEFAULT_TEAMS: Team[] = [
  {
    id: 'team-001',
    name: '业务管理及合规检测中心',
    departmentId: 'dept-001',
    description: '负责业务管理和合规检测工作',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'team-002',
    name: '投资法务中心',
    departmentId: 'dept-001',
    description: '负责投资相关法务工作',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'team-003',
    name: '公司及国际金融事务中心',
    departmentId: 'dept-001',
    description: '负责公司及国际金融事务',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

interface OrganizationContextType {
  departments: Department[];
  teams: Team[];
  loading: boolean;
  // 部门操作
  addDepartment: (data: DepartmentFormData) => Promise<{ success: boolean; message: string }>;
  updateDepartment: (id: string, data: DepartmentFormData) => Promise<{ success: boolean; message: string }>;
  deleteDepartment: (id: string) => Promise<{ success: boolean; message: string }>;
  // 团队操作
  addTeam: (data: TeamFormData) => Promise<{ success: boolean; message: string }>;
  updateTeam: (id: string, data: TeamFormData) => Promise<{ success: boolean; message: string }>;
  deleteTeam: (id: string) => Promise<{ success: boolean; message: string }>;
  // 查询方法
  getDepartmentById: (id: string) => Department | undefined;
  getTeamById: (id: string) => Team | undefined;
  getTeamsByDepartment: (departmentId: string) => Team[];
  getTeamNames: () => string[];
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const STORAGE_KEYS = {
  DEPARTMENTS: 'task_platform_departments',
  TEAMS: 'task_platform_teams',
};

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // 初始化：从 localStorage 加载数据
  useEffect(() => {
    const initOrganization = () => {
      try {
        // 加载部门列表
        const storedDepartments = localStorage.getItem(STORAGE_KEYS.DEPARTMENTS);
        let deptList: Department[] = storedDepartments ? JSON.parse(storedDepartments) : [];
        
        // 确保默认部门存在
        if (deptList.length === 0) {
          deptList = [DEFAULT_DEPARTMENT];
          localStorage.setItem(STORAGE_KEYS.DEPARTMENTS, JSON.stringify(deptList));
        }
        setDepartments(deptList);

        // 加载团队列表
        const storedTeams = localStorage.getItem(STORAGE_KEYS.TEAMS);
        let teamList: Team[] = storedTeams ? JSON.parse(storedTeams) : [];
        
        // 确保默认团队存在
        if (teamList.length === 0) {
          teamList = DEFAULT_TEAMS;
          localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(teamList));
        }
        setTeams(teamList);
      } catch (error) {
        console.error('Failed to initialize organization:', error);
      } finally {
        setLoading(false);
      }
    };

    initOrganization();
  }, []);

  // 保存部门到 localStorage
  const saveDepartments = (newDepartments: Department[]) => {
    setDepartments(newDepartments);
    localStorage.setItem(STORAGE_KEYS.DEPARTMENTS, JSON.stringify(newDepartments));
  };

  // 保存团队到 localStorage
  const saveTeams = (newTeams: Team[]) => {
    setTeams(newTeams);
    localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(newTeams));
  };

  // 添加部门
  const addDepartment = async (data: DepartmentFormData): Promise<{ success: boolean; message: string }> => {
    if (departments.some(d => d.name === data.name)) {
      return { success: false, message: '部门名称已存在' };
    }

    const newDepartment: Department = {
      id: `dept-${Date.now()}`,
      name: data.name,
      description: data.description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveDepartments([...departments, newDepartment]);
    return { success: true, message: '部门添加成功' };
  };

  // 更新部门
  const updateDepartment = async (id: string, data: DepartmentFormData): Promise<{ success: boolean; message: string }> => {
    const existingDept = departments.find(d => d.name === data.name && d.id !== id);
    if (existingDept) {
      return { success: false, message: '部门名称已存在' };
    }

    const updatedDepartments = departments.map(d =>
      d.id === id
        ? { ...d, ...data, updatedAt: new Date().toISOString() }
        : d
    );
    saveDepartments(updatedDepartments);
    return { success: true, message: '部门更新成功' };
  };

  // 删除部门
  const deleteDepartment = async (id: string): Promise<{ success: boolean; message: string }> => {
    // 检查是否有团队属于该部门
    const hasTeams = teams.some(t => t.departmentId === id);
    if (hasTeams) {
      return { success: false, message: '该部门下还有团队，请先删除团队' };
    }

    saveDepartments(departments.filter(d => d.id !== id));
    return { success: true, message: '部门删除成功' };
  };

  // 添加团队
  const addTeam = async (data: TeamFormData): Promise<{ success: boolean; message: string }> => {
    if (teams.some(t => t.name === data.name)) {
      return { success: false, message: '团队名称已存在' };
    }

    const newTeam: Team = {
      id: `team-${Date.now()}`,
      name: data.name,
      departmentId: data.departmentId,
      description: data.description,
      leaderId: data.leaderId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveTeams([...teams, newTeam]);
    return { success: true, message: '团队添加成功' };
  };

  // 更新团队
  const updateTeam = async (id: string, data: TeamFormData): Promise<{ success: boolean; message: string }> => {
    const existingTeam = teams.find(t => t.name === data.name && t.id !== id);
    if (existingTeam) {
      return { success: false, message: '团队名称已存在' };
    }

    const updatedTeams = teams.map(t =>
      t.id === id
        ? { ...t, ...data, updatedAt: new Date().toISOString() }
        : t
    );
    saveTeams(updatedTeams);
    return { success: true, message: '团队更新成功' };
  };

  // 删除团队
  const deleteTeam = async (id: string): Promise<{ success: boolean; message: string }> => {
    saveTeams(teams.filter(t => t.id !== id));
    return { success: true, message: '团队删除成功' };
  };

  // 根据ID获取部门
  const getDepartmentById = (id: string): Department | undefined => {
    return departments.find(d => d.id === id);
  };

  // 根据ID获取团队
  const getTeamById = (id: string): Team | undefined => {
    return teams.find(t => t.id === id);
  };

  // 获取某部门下的所有团队
  const getTeamsByDepartment = (departmentId: string): Team[] => {
    return teams.filter(t => t.departmentId === departmentId);
  };

  // 获取所有团队名称列表
  const getTeamNames = (): string[] => {
    return teams.map(t => t.name);
  };

  return (
    <OrganizationContext.Provider
      value={{
        departments,
        teams,
        loading,
        addDepartment,
        updateDepartment,
        deleteDepartment,
        addTeam,
        updateTeam,
        deleteTeam,
        getDepartmentById,
        getTeamById,
        getTeamsByDepartment,
        getTeamNames,
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
