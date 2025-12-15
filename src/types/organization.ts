// 部门接口
export interface Department {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// 团队接口
export interface Team {
  id: string;
  name: string;
  departmentId: string;
  description?: string;
  leaderId?: string; // 团队负责人用户ID
  createdAt: string;
  updatedAt: string;
}

// 小组接口（团队下的子分组）
export interface Group {
  id: string;
  name: string;
  teamId: string;
  description?: string;
  leaderId?: string; // 小组负责人用户ID
  createdAt: string;
  updatedAt: string;
}

// 部门表单数据
export interface DepartmentFormData {
  name: string;
  description?: string;
}

// 团队表单数据
export interface TeamFormData {
  name: string;
  departmentId: string;
  description?: string;
  leaderId?: string;
}

// 小组表单数据
export interface GroupFormData {
  name: string;
  teamId: string;
  description?: string;
  leaderId?: string;
}

// 组织架构统计
export interface OrganizationStats {
  totalDepartments: number;
  totalTeams: number;
  totalGroups: number;
  teamsPerDepartment: Record<string, number>;
  groupsPerTeam: Record<string, number>;
}
