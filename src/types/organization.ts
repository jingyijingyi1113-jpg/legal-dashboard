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

// 组织架构统计
export interface OrganizationStats {
  totalDepartments: number;
  totalTeams: number;
  teamsPerDepartment: Record<string, number>;
}
