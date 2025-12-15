import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { TimesheetEntry, TimesheetFormData, TimesheetStats, LeaveRecord, LeaveFormData } from '@/types/timesheet';
import { useAuth } from './AuthContext';
import { timesheetApi } from '@/api';

// API 模式开关 - 设置为 true 使用后端 API，false 使用 localStorage
const USE_API = true;

// 看板数据格式（与Excel导入格式兼容）
export interface DashboardDataRow {
  Month: string;
  Name: string;
  '团队': string;
  Hours: number;
  'Deal/Matter Category'?: string;
  'Deal/Matter Name'?: string;
  'OKR/BSC Tag'?: string;
  'OKR/BSC Item'?: string;
  'Work Category'?: string;
  'Narrative (Optional)'?: string;
  'Source Path'?: string;
  [key: string]: string | number | undefined;
}

interface TimesheetContextType {
  entries: TimesheetEntry[];
  leaveRecords: LeaveRecord[];
  loading: boolean;
  useApi: boolean;
  // CRUD操作
  addEntry: (data: TimesheetFormData) => Promise<{ success: boolean; message: string }>;
  updateEntry: (id: string, data: TimesheetFormData) => Promise<{ success: boolean; message: string }>;
  deleteEntry: (id: string) => Promise<{ success: boolean; message: string }>;
  // 批量删除
  deleteEntries: (ids: string[]) => Promise<{ success: boolean; message: string; count: number }>;
  // 批量提交草稿
  submitEntries: (ids: string[]) => Promise<{ success: boolean; message: string }>;
  // 批量导入历史数据
  importEntries: (entries: TimesheetEntry[]) => Promise<{ success: boolean; message: string; count: number }>;
  // 请假记录操作
  addLeaveRecord: (data: LeaveFormData) => Promise<{ success: boolean; message: string }>;
  updateLeaveRecord: (id: string, data: LeaveFormData) => Promise<{ success: boolean; message: string }>;
  deleteLeaveRecord: (id: string) => Promise<{ success: boolean; message: string }>;
  // 查询方法
  getEntriesByUser: (userId: string) => TimesheetEntry[];
  getEntriesByTeam: (teamId: string) => TimesheetEntry[];
  getEntriesByDateRange: (startDate: string, endDate: string) => TimesheetEntry[];
  getLeaveRecordsByUser: (userId: string) => LeaveRecord[];
  getLeaveRecordsByDateRange: (userId: string, startDate: string, endDate: string) => LeaveRecord[];
  getLeaveDaysByDateRange: (userId: string, startDate: string, endDate: string) => number;
  getStats: () => TimesheetStats;
  getUserStats: (userId: string) => TimesheetStats;
  // 获取看板数据（已提交的工时记录转换为看板格式）
  getDashboardData: () => DashboardDataRow[];
  getSubmittedEntries: () => TimesheetEntry[];
  // 刷新数据
  refreshEntries: () => Promise<void>;
}

const TimesheetContext = createContext<TimesheetContextType | undefined>(undefined);

const STORAGE_KEY = 'task_platform_timesheet_entries';
const LEAVE_STORAGE_KEY = 'task_platform_leave_records';

export function TimesheetProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // 从 API 加载数据
  const loadFromApi = async () => {
    try {
      // 管理员获取所有用户数据，普通用户只获取自己的数据
      const isAdmin = user?.role === 'admin' || user?.role === 'manager';
      const response = isAdmin 
        ? await timesheetApi.getTeamEntries({})  // 管理员获取所有团队数据
        : await timesheetApi.getEntries();       // 普通用户获取自己的数据
      
      if (response.success && response.data) {
        // 转换 API 数据格式为本地格式
        const apiEntries: TimesheetEntry[] = response.data.map((entry: any) => ({
          id: entry.id,
          userId: String(entry.user_id),
          userName: entry.real_name || entry.username,
          teamId: entry.data?.teamId || entry.team || '',
          teamName: entry.data?.teamName || entry.center || '',
          groupName: entry.user_group || entry.data?.userGroup || '',
          date: entry.date,
          hours: entry.hours,
          data: entry.data || {},
          description: entry.data?.description || '',
          createdAt: entry.created_at,
          updatedAt: entry.updated_at,
          status: entry.status as 'draft' | 'submitted',
        }));
        setEntries(apiEntries);
        return true;
      }
    } catch (error) {
      console.log('API 加载失败，回退到本地存储');
    }
    return false;
  };

  // 从 localStorage 加载数据
  const loadFromLocalStorage = () => {
    try {
      const storedEntries = localStorage.getItem(STORAGE_KEY);
      const entryList: TimesheetEntry[] = storedEntries ? JSON.parse(storedEntries) : [];
      setEntries(entryList);

      const storedLeaveRecords = localStorage.getItem(LEAVE_STORAGE_KEY);
      const leaveList: LeaveRecord[] = storedLeaveRecords ? JSON.parse(storedLeaveRecords) : [];
      setLeaveRecords(leaveList);
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
    }
  };

  // 刷新数据
  const refreshEntries = async () => {
    if (USE_API && user) {
      const success = await loadFromApi();
      if (!success) {
        loadFromLocalStorage();
      }
    } else {
      loadFromLocalStorage();
    }
  };

  // 初始化：从 API 或 localStorage 加载数据
  useEffect(() => {
    const initTimesheet = async () => {
      setLoading(true);
      try {
        if (USE_API && user) {
          const success = await loadFromApi();
          if (!success) {
            loadFromLocalStorage();
          }
        } else {
          loadFromLocalStorage();
        }
      } catch (error) {
        console.error('Failed to initialize timesheet:', error);
        loadFromLocalStorage();
      } finally {
        setLoading(false);
      }
    };

    initTimesheet();
  }, [user]);

  // 保存到 localStorage
  const saveEntries = (newEntries: TimesheetEntry[]) => {
    setEntries(newEntries);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newEntries));
  };

  // 保存请假记录到 localStorage
  const saveLeaveRecords = (newRecords: LeaveRecord[]) => {
    setLeaveRecords(newRecords);
    localStorage.setItem(LEAVE_STORAGE_KEY, JSON.stringify(newRecords));
  };

  // 添加工时记录（草稿状态）
  const addEntry = async (data: TimesheetFormData): Promise<{ success: boolean; message: string }> => {
    if (!user) {
      return { success: false, message: '请先登录' };
    }

    const entryId = `entry-${Date.now()}`;
    const newEntry: TimesheetEntry = {
      id: entryId,
      userId: user.id,
      userName: user.name,
      teamId: user.team || '',
      teamName: user.team || '',
      groupName: user.group || '',
      date: data.date,
      hours: data.hours,
      data: data.data,
      description: data.description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
    };

    // 尝试 API 保存
    if (USE_API) {
      try {
        // 从表单数据中获取小组信息（投资法务中心使用 sourcePath 字段）
        const userGroup = data.data?.sourcePath as string || user.group || '';
        
        const response = await timesheetApi.createEntry({
          id: entryId,
          date: data.date,
          hours: data.hours,
          status: 'draft',
          user_group: userGroup,
          data: {
            ...data.data,
            teamId: user.team || '',
            teamName: user.team || '',
            userGroup: userGroup,
            description: data.description,
          },
        });
        if (response.success) {
          // 刷新数据
          await refreshEntries();
          return { success: true, message: '草稿保存成功' };
        }
      } catch (error: any) {
        console.log('API 保存失败，使用本地存储:', error.message);
      }
    }

    // 本地保存
    saveEntries([newEntry, ...entries]);
    return { success: true, message: '草稿保存成功' };
  };

  // 更新工时记录
  const updateEntry = async (id: string, data: TimesheetFormData): Promise<{ success: boolean; message: string }> => {
    const entryIndex = entries.findIndex(e => e.id === id);
    if (entryIndex === -1) {
      return { success: false, message: '记录不存在' };
    }

    // 尝试 API 更新
    if (USE_API) {
      try {
        const response = await timesheetApi.updateEntry(id, {
          date: data.date,
          hours: data.hours,
          data: {
            ...data.data,
            description: data.description,
          },
        });
        if (response.success) {
          await refreshEntries();
          return { success: true, message: '工时记录更新成功' };
        }
      } catch (error: any) {
        console.log('API 更新失败，使用本地存储:', error.message);
      }
    }

    // 本地更新
    const updatedEntries = [...entries];
    updatedEntries[entryIndex] = {
      ...updatedEntries[entryIndex],
      date: data.date,
      hours: data.hours,
      data: data.data,
      description: data.description,
      updatedAt: new Date().toISOString(),
    };

    saveEntries(updatedEntries);
    return { success: true, message: '工时记录更新成功' };
  };

  // 删除工时记录
  const deleteEntry = async (id: string): Promise<{ success: boolean; message: string }> => {
    // 尝试 API 删除
    if (USE_API) {
      try {
        const response = await timesheetApi.deleteEntry(id);
        if (response.success) {
          await refreshEntries();
          return { success: true, message: '工时记录删除成功' };
        }
      } catch (error: any) {
        console.log('API 删除失败，使用本地存储:', error.message);
      }
    }

    // 本地删除
    saveEntries(entries.filter(e => e.id !== id));
    return { success: true, message: '工时记录删除成功' };
  };

  // 批量删除工时记录
  const deleteEntries = async (ids: string[]): Promise<{ success: boolean; message: string; count: number }> => {
    // 尝试 API 批量删除
    if (USE_API) {
      try {
        // 使用批量删除接口
        const response = await timesheetApi.batchDelete(ids);
        if (response.success) {
          await refreshEntries();
          return { success: true, message: `成功删除 ${response.data?.count || ids.length} 条记录`, count: response.data?.count || ids.length };
        } else {
          return { success: false, message: response.message || '删除失败', count: 0 };
        }
      } catch (error: any) {
        console.log('API 批量删除失败，使用本地存储:', error.message);
      }
    }

    // 本地删除
    const idsSet = new Set(ids);
    const newEntries = entries.filter(e => !idsSet.has(e.id));
    const deletedCount = entries.length - newEntries.length;
    saveEntries(newEntries);
    return { success: true, message: `成功删除 ${deletedCount} 条记录`, count: deletedCount };
  };

  // 批量提交草稿
  const submitEntries = async (ids: string[]): Promise<{ success: boolean; message: string }> => {
    // 尝试 API 批量提交
    if (USE_API) {
      try {
        const response = await timesheetApi.batchSubmit(ids);
        if (response.success) {
          await refreshEntries();
          return { success: true, message: response.message || `成功提交 ${ids.length} 条工时记录` };
        }
      } catch (error: any) {
        console.log('API 批量提交失败，使用本地存储:', error.message);
      }
    }

    // 本地提交
    const updatedEntries = entries.map(e => {
      if (ids.includes(e.id) && e.status === 'draft') {
        return { ...e, status: 'submitted' as const, updatedAt: new Date().toISOString() };
      }
      return e;
    });
    saveEntries(updatedEntries);
    return { success: true, message: `成功提交 ${ids.length} 条工时记录` };
  };

  // 批量导入历史数据
  const importEntries = async (newEntries: TimesheetEntry[]): Promise<{ success: boolean; message: string; count: number }> => {
    if (newEntries.length === 0) {
      return { success: false, message: '没有可导入的数据', count: 0 };
    }

    // 尝试 API 批量导入
    if (USE_API) {
      try {
        // 转换为后端需要的格式
        const entriesToImport = newEntries.map(entry => ({
          id: entry.id,
          user_id: Number(entry.userId) || 0,
          username: String(entry.userName || entry.data?.userName || ''),
          date: entry.date,
          hours: entry.hours,
          status: entry.status || 'submitted',
          user_group: entry.groupName || entry.data?.sourcePath || '',
          data: {
            ...entry.data,
            teamId: entry.teamId,
            teamName: entry.teamName,
            userGroup: entry.groupName || entry.data?.sourcePath || '',
            description: entry.description || '',
          },
        }));
        
        // 使用批量导入接口
        const response = await timesheetApi.batchImport(entriesToImport);
        if (response.success) {
          await refreshEntries();
          return { success: true, message: `成功导入 ${response.data?.count || newEntries.length} 条工时记录`, count: response.data?.count || newEntries.length };
        } else {
          return { success: false, message: response.message || '导入失败', count: 0 };
        }
      } catch (error: any) {
        console.log('API 批量导入失败，使用本地存储:', error.message);
      }
    }
    
    // 本地导入
    // 合并新数据到现有数据（新数据在前）
    const mergedEntries = [...newEntries, ...entries];
    saveEntries(mergedEntries);
    
    return { success: true, message: `成功导入 ${newEntries.length} 条工时记录`, count: newEntries.length };
  };

  // 根据用户ID获取记录
  const getEntriesByUser = (userId: string): TimesheetEntry[] => {
    return entries.filter(e => e.userId === userId);
  };

  // 根据团队ID获取记录
  const getEntriesByTeam = (teamId: string): TimesheetEntry[] => {
    return entries.filter(e => e.teamId === teamId);
  };

  // 根据日期范围获取记录
  const getEntriesByDateRange = (startDate: string, endDate: string): TimesheetEntry[] => {
    return entries.filter(e => e.date >= startDate && e.date <= endDate);
  };

  // 添加请假记录
  const addLeaveRecord = async (data: LeaveFormData): Promise<{ success: boolean; message: string }> => {
    if (!user) {
      return { success: false, message: '请先登录' };
    }

    const newRecord: LeaveRecord = {
      id: `leave-${Date.now()}`,
      userId: user.id,
      userName: user.name,
      teamId: user.team || '',
      teamName: user.team || '',
      startDate: data.startDate,
      endDate: data.endDate,
      days: data.days,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveLeaveRecords([newRecord, ...leaveRecords]);
    return { success: true, message: '请假记录保存成功' };
  };

  // 更新请假记录
  const updateLeaveRecord = async (id: string, data: LeaveFormData): Promise<{ success: boolean; message: string }> => {
    const recordIndex = leaveRecords.findIndex(r => r.id === id);
    if (recordIndex === -1) {
      return { success: false, message: '记录不存在' };
    }

    const updatedRecords = [...leaveRecords];
    updatedRecords[recordIndex] = {
      ...updatedRecords[recordIndex],
      startDate: data.startDate,
      endDate: data.endDate,
      days: data.days,
      updatedAt: new Date().toISOString(),
    };

    saveLeaveRecords(updatedRecords);
    return { success: true, message: '请假记录更新成功' };
  };

  // 删除请假记录
  const deleteLeaveRecord = async (id: string): Promise<{ success: boolean; message: string }> => {
    saveLeaveRecords(leaveRecords.filter(r => r.id !== id));
    return { success: true, message: '请假记录删除成功' };
  };

  // 根据用户ID获取请假记录
  const getLeaveRecordsByUser = (userId: string): LeaveRecord[] => {
    return leaveRecords.filter(r => r.userId === userId);
  };

  // 根据日期范围获取用户请假记录
  const getLeaveRecordsByDateRange = (userId: string, startDate: string, endDate: string): LeaveRecord[] => {
    return leaveRecords.filter(r => r.userId === userId && r.startDate <= endDate && r.endDate >= startDate);
  };

  // 获取用户在指定日期范围内的请假天数
  const getLeaveDaysByDateRange = (userId: string, startDate: string, endDate: string): number => {
    return leaveRecords
      .filter(r => r.userId === userId && r.startDate <= endDate && r.endDate >= startDate)
      .reduce((sum, r) => sum + r.days, 0);
  };

  // 获取当前用户的统计数据
  const getStats = (): TimesheetStats => {
    const userEntries = user ? entries.filter(e => e.userId === user.id) : [];
    return calculateStats(userEntries);
  };

  // 获取指定用户的统计数据
  const getUserStats = (userId: string): TimesheetStats => {
    const userEntries = entries.filter(e => e.userId === userId);
    return calculateStats(userEntries);
  };

  // 计算统计数据
  const calculateStats = (entryList: TimesheetEntry[]): TimesheetStats => {
    const today = new Date().toISOString().split('T')[0];
    const weekStart = getWeekStart(new Date()).toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const todayHours = entryList
      .filter(e => e.date === today)
      .reduce((sum, e) => sum + e.hours, 0);

    const weekHours = entryList
      .filter(e => e.date >= weekStart)
      .reduce((sum, e) => sum + e.hours, 0);

    const monthHours = entryList
      .filter(e => e.date >= monthStart)
      .reduce((sum, e) => sum + e.hours, 0);

    return {
      todayHours,
      weekHours,
      monthHours,
      totalEntries: entryList.length,
    };
  };

  // 获取已提交的工时记录
  const getSubmittedEntries = (): TimesheetEntry[] => {
    return entries.filter(e => e.status === 'submitted');
  };

  // 将工时记录转换为看板数据格式
  const getDashboardData = (): DashboardDataRow[] => {
    const submittedEntries = getSubmittedEntries();
    
    return submittedEntries.map(entry => {
      // 将日期转换为 YYYY-MM 格式
      const dateParts = entry.date.split('-');
      const month = `${dateParts[0]}-${dateParts[1]}`;
      
      // 基础数据
      const row: DashboardDataRow = {
        Month: month,
        Name: entry.userName,
        '团队': entry.teamName,
        Hours: entry.hours,
      };
      
      const data = entry.data;
      const teamName = entry.teamName;
      
      // 根据团队名称进行字段映射
      if (teamName === '投资法务中心') {
        // 投资法务中心字段映射
        if (data.category) row['Deal/Matter Category'] = String(data.category);
        if (data.dealName) row['Deal/Matter Name'] = String(data.dealName);
        if (data.bscTag) row['OKR/BSC Tag'] = String(data.bscTag);
        if (data.bscItem) row['OKR/BSC Item'] = String(data.bscItem);
        if (data.workCategory) row['Work Category'] = String(data.workCategory);
        if (data.sourcePath) row['Source Path'] = String(data.sourcePath);
      } else if (teamName === '业务管理及合规检测中心') {
        // 业务管理及合规检测中心字段映射
        if (data.category) row['Deal/Matter Category'] = String(data.category);
        if (data.task) row['Deal/Matter Name'] = String(data.task);
        if (data.tag) {
          // 移除前缀下划线
          const tagValue = String(data.tag).replace(/^_/, '');
          row['OKR/BSC Tag'] = tagValue;
        }
        if (data.keyTask) row['OKR/BSC Item'] = String(data.keyTask);
        if (data.workType) row['Work Category'] = String(data.workType);
      } else if (teamName === '公司及国际金融事务中心') {
        // 公司及国际金融事务中心字段映射
        if (data.virtualGroup) row['Deal/Matter Category'] = String(data.virtualGroup);
        if (data.internalClient) row['Deal/Matter Name'] = String(data.internalClient);
        if (data.tag) {
          // 移除前缀下划线
          const tagValue = String(data.tag).replace(/^_/, '');
          row['OKR/BSC Tag'] = tagValue;
        }
        if (data.item) row['OKR/BSC Item'] = String(data.item);
        if (data.workCategory) row['Work Category'] = String(data.workCategory);
      }
      
      // 描述字段（通用）
      if (entry.description || data.description) {
        row['Narrative (Optional)'] = String(entry.description || data.description || '');
      }
      
      return row;
    });
  };

  return (
    <TimesheetContext.Provider
      value={{
        entries,
        leaveRecords,
        loading,
        useApi: USE_API,
        addEntry,
        updateEntry,
        deleteEntry,
        deleteEntries,
        submitEntries,
        importEntries,
        addLeaveRecord,
        updateLeaveRecord,
        deleteLeaveRecord,
        getEntriesByUser,
        getEntriesByTeam,
        getEntriesByDateRange,
        getLeaveRecordsByUser,
        getLeaveRecordsByDateRange,
        getLeaveDaysByDateRange,
        getStats,
        getUserStats,
        getDashboardData,
        getSubmittedEntries,
        refreshEntries,
      }}
    >
      {children}
    </TimesheetContext.Provider>
  );
}

// 获取本周开始日期（周一）
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function useTimesheet() {
  const context = useContext(TimesheetContext);
  if (context === undefined) {
    throw new Error('useTimesheet must be used within a TimesheetProvider');
  }
  return context;
}
