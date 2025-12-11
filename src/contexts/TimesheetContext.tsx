import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { TimesheetEntry, TimesheetFormData, TimesheetStats, LeaveRecord, LeaveFormData } from '@/types/timesheet';
import { useAuth } from './AuthContext';

interface TimesheetContextType {
  entries: TimesheetEntry[];
  leaveRecords: LeaveRecord[];
  loading: boolean;
  // CRUD操作
  addEntry: (data: TimesheetFormData) => Promise<{ success: boolean; message: string }>;
  updateEntry: (id: string, data: TimesheetFormData) => Promise<{ success: boolean; message: string }>;
  deleteEntry: (id: string) => Promise<{ success: boolean; message: string }>;
  // 批量提交草稿
  submitEntries: (ids: string[]) => Promise<{ success: boolean; message: string }>;
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
}

const TimesheetContext = createContext<TimesheetContextType | undefined>(undefined);

const STORAGE_KEY = 'task_platform_timesheet_entries';
const LEAVE_STORAGE_KEY = 'task_platform_leave_records';

export function TimesheetProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // 初始化：从 localStorage 加载数据
  useEffect(() => {
    const initTimesheet = () => {
      try {
        const storedEntries = localStorage.getItem(STORAGE_KEY);
        const entryList: TimesheetEntry[] = storedEntries ? JSON.parse(storedEntries) : [];
        setEntries(entryList);

        const storedLeaveRecords = localStorage.getItem(LEAVE_STORAGE_KEY);
        const leaveList: LeaveRecord[] = storedLeaveRecords ? JSON.parse(storedLeaveRecords) : [];
        setLeaveRecords(leaveList);
      } catch (error) {
        console.error('Failed to initialize timesheet:', error);
      } finally {
        setLoading(false);
      }
    };

    initTimesheet();
  }, []);

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

    const newEntry: TimesheetEntry = {
      id: `entry-${Date.now()}`,
      userId: user.id,
      userName: user.name,
      teamId: user.team || '',
      teamName: user.team || '',
      date: data.date,
      hours: data.hours,
      data: data.data,
      description: data.description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
    };

    saveEntries([newEntry, ...entries]);
    return { success: true, message: '草稿保存成功' };
  };

  // 更新工时记录
  const updateEntry = async (id: string, data: TimesheetFormData): Promise<{ success: boolean; message: string }> => {
    const entryIndex = entries.findIndex(e => e.id === id);
    if (entryIndex === -1) {
      return { success: false, message: '记录不存在' };
    }

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
    saveEntries(entries.filter(e => e.id !== id));
    return { success: true, message: '工时记录删除成功' };
  };

  // 批量提交草稿
  const submitEntries = async (ids: string[]): Promise<{ success: boolean; message: string }> => {
    const updatedEntries = entries.map(e => {
      if (ids.includes(e.id) && e.status === 'draft') {
        return { ...e, status: 'submitted' as const, updatedAt: new Date().toISOString() };
      }
      return e;
    });
    saveEntries(updatedEntries);
    return { success: true, message: `成功提交 ${ids.length} 条工时记录` };
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

  return (
    <TimesheetContext.Provider
      value={{
        entries,
        leaveRecords,
        loading,
        addEntry,
        updateEntry,
        deleteEntry,
        submitEntries,
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
