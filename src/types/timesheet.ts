// 字段选项配置
export interface FieldOption {
  value: string;
  label: string;
  children?: FieldOption[]; // 子选项，用于层级关系
}

// 团队模版字段定义
export interface TemplateField {
  key: string;
  label: string;
  type: 'select' | 'cascader' | 'text' | 'number' | 'date';
  required: boolean;
  placeholder?: string;
  options?: FieldOption[];
  parentField?: string; // 父字段key，用于级联选择
  step?: number; // 数字类型的步进值
  min?: number;
  max?: number;
  conditionalRequired?: {  // 条件必填配置
    dependsOn: string;     // 依赖的字段key
    when: string | string[]; // 当依赖字段值为此值时必填
  };
}

// 团队模版配置
export interface TeamTemplate {
  teamId: string;
  teamName: string;
  fields: TemplateField[];
}

// 工时记录条目
export interface TimesheetEntry {
  id: string;
  userId: string;
  userName: string;
  teamId: string;
  teamName: string;
  date: string;
  hours: number;
  data: Record<string, string | number>; // 动态字段数据
  description?: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'submitted'; // 草稿或已提交
}

// 工时记录表单数据
export interface TimesheetFormData {
  date: string;
  hours: number;
  data: Record<string, string | number>;
  description?: string;
}

// 工时统计
export interface TimesheetStats {
  todayHours: number;
  weekHours: number;
  monthHours: number;
  totalEntries: number;
}

// 请假记录
export interface LeaveRecord {
  id: string;
  userId: string;
  userName: string;
  teamId: string;
  teamName: string;
  startDate: string;   // 请假开始日期
  endDate: string;     // 请假结束日期
  days: number;        // 请假天数（支持0.5天）
  createdAt: string;
  updatedAt: string;
}

// 请假表单数据
export interface LeaveFormData {
  startDate: string;
  endDate: string;
  days: number;
}
