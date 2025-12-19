import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Department, Team, Group } from '@/types/organization';
import type { UserRole, UserRegion } from '@/types/user';
import { RoleLabels, RoleColors, RegionLabels, RegionColors } from '@/types/user';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { configApi, backupApi, type AiMode } from '@/api/index';

const ROLES: UserRole[] = ['admin', 'user', 'manager', 'exporter'];
const REGIONS: UserRegion[] = ['CN', 'HK', 'OTHER'];

const AI_MODE_LABELS: Record<AiMode, string> = {
  off: '关闭',
  selective: '选择性开放',
  all: '全量开放',
};

const AI_MODE_COLORS: Record<AiMode, string> = {
  off: 'bg-slate-100 text-slate-600',
  selective: 'bg-amber-100 text-amber-700',
  all: 'bg-emerald-100 text-emerald-700',
};

type TabType = 'users' | 'teams' | 'groups' | 'departments';

export function PermissionManagementPage() {
  const { user: currentUser, users, addUser, deleteUser, updateUserRole, updateUserRegion, updateUserField, importUsers, refreshUsers, refreshCurrentUser } = useAuth();
  const {
    departments,
    teams,
    groups,
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
    getTeamsByDepartment,
    getGroupsByTeam,
    getTeamNames,
    getGroupNames,
    getTeamById,
  } = useOrganization();

  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sendingReminder, setSendingReminder] = useState(false);

  // 用户管理状态
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showDeleteUserConfirm, setShowDeleteUserConfirm] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editingRegion, setEditingRegion] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{ userId: string; field: 'username' | 'email'; value: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 部门表单
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptForm, setDeptForm] = useState({ name: '', description: '' });
  const [showDeleteDeptConfirm, setShowDeleteDeptConfirm] = useState<string | null>(null);

  // 团队表单
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeamData, setEditingTeamData] = useState<Team | null>(null);
  const [teamForm, setTeamForm] = useState({ name: '', departmentId: '', description: '' });
  const [showDeleteTeamConfirm, setShowDeleteTeamConfirm] = useState<string | null>(null);

  // 小组表单
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroupData, setEditingGroupData] = useState<Group | null>(null);
  const [groupForm, setGroupForm] = useState({ name: '', teamId: '', description: '' });
  const [showDeleteGroupConfirm, setShowDeleteGroupConfirm] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);

  // AI配置状态
  const [aiMode, setAiMode] = useState<AiMode>('off');
  const [editingAiMode, setEditingAiMode] = useState(false);
  const [aiModeLoading, setAiModeLoading] = useState(false);

  // 获取动态团队列表
  const TEAMS = getTeamNames();

  // 加载AI配置
  useEffect(() => {
    const loadAiConfig = async () => {
      try {
        const response = await configApi.getAiConfig();
        if (response.success && response.data) {
          setAiMode(response.data.aiMode);
        }
      } catch (error) {
        console.error('Failed to load AI config:', error);
      }
    };
    loadAiConfig();
  }, []);

  // 更新AI模式
  const handleUpdateAiMode = async (mode: AiMode) => {
    setAiModeLoading(true);
    try {
      const response = await configApi.updateAiConfig(mode);
      if (response.success) {
        setAiMode(mode);
        showMessage('success', `AI模式已切换为: ${AI_MODE_LABELS[mode]}`);
      } else {
        showMessage('error', response.message || '更新失败');
      }
    } catch (error) {
      showMessage('error', '更新AI配置失败');
    } finally {
      setAiModeLoading(false);
      setEditingAiMode(false);
    }
  };

  // 更新用户AI权限
  const handleUpdateUserAiEnabled = async (userId: string, aiEnabled: boolean) => {
    try {
      const response = await configApi.updateUserAiEnabled(parseInt(userId), aiEnabled);
      if (response.success) {
        // 刷新用户列表（不刷新页面）
        await refreshUsers();
        // 如果修改的是当前登录用户，刷新当前用户状态
        if (currentUser && currentUser.id === userId) {
          await refreshCurrentUser();
        }
        showMessage('success', aiEnabled ? 'AI权限已开启' : 'AI权限已关闭');
      } else {
        showMessage('error', response.message || '更新失败');
      }
    } catch (error) {
      showMessage('error', '更新用户AI权限失败');
    }
  };

  // 新用户表单
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    role: 'user' as UserRole,
    region: 'CN' as UserRegion,
    team: '',
    group: '',
  });

  // 显示消息
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // ========== 用户管理方法 ==========
  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.team && u.team.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await addUser({
      ...newUserForm,
      department: '合规交易部',
    });
    if (result.success) {
      showMessage('success', result.message);
      setShowAddUserModal(false);
      setNewUserForm({ username: '', password: '', name: '', email: '', role: 'user', region: 'CN', team: '', group: '' });
    } else {
      showMessage('error', result.message);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const result = await deleteUser(userId);
    showMessage(result.success ? 'success' : 'error', result.message);
    setShowDeleteUserConfirm(null);
  };

  const handleUpdateRole = async (userId: string, role: UserRole) => {
    const result = await updateUserRole(userId, role);
    showMessage(result.success ? 'success' : 'error', result.message);
    setEditingRole(null);
  };

  const handleSendReminder = async () => {
    setSendingReminder(true);
    try {
      const response = await backupApi.sendReminder();
      showMessage(response.success ? 'success' : 'error', response.success ? '工时提醒邮件已发送' : (response.message || '发送失败'));
    } catch (error) {
      showMessage('error', '发送失败，请稍后重试');
    } finally {
      setSendingReminder(false);
    }
  };

  const handleUpdateRegion = async (userId: string, region: UserRegion) => {
    const result = await updateUserRegion(userId, region);
    showMessage(result.success ? 'success' : 'error', result.message);
    setEditingRegion(null);
  };

  const handleUpdateField = async () => {
    if (!editingField) return;
    const result = await updateUserField(editingField.userId, editingField.field, editingField.value);
    showMessage(result.success ? 'success' : 'error', result.message);
    setEditingField(null);
  };

  const handleUpdateUserTeam = async (userId: string, team: string) => {
    const result = await updateUserField(userId, 'team', team);
    showMessage(result.success ? 'success' : 'error', result.message);
    setEditingTeam(null);
  };

  const handleImportUsers = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet) as any[];

        const usersToImport = json.map(row => {
          let region: UserRegion = 'CN';
          const regionStr = row['地区'] || row['region'] || '';
          if (regionStr === '中国香港' || regionStr === 'HK' || regionStr === '香港') {
            region = 'HK';
          } else if (regionStr === '海外/其他' || regionStr === 'OTHER' || regionStr === '海外' || regionStr === '其他') {
            region = 'OTHER';
          }

          return {
            username: row['用户名'] || row['username'] || '',
            password: row['密码'] || row['password'] || '123456',
            name: row['姓名'] || row['name'] || '',
            email: row['邮箱'] || row['email'] || '',
            role: (row['角色'] || row['role'] || 'user') as UserRole,
            region,
            team: row['团队'] || row['team'] || '',
            department: '合规交易部',
          };
        }).filter(u => u.username && u.name);

        const result = await importUsers(usersToImport);
        showMessage(result.success ? 'success' : 'error', result.message);
      } catch (err) {
        showMessage('error', '导入失败，请检查文件格式');
      }
    };
    reader.readAsArrayBuffer(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    const template = [
      { '用户名': 'zhangsan', '密码': '123456', '姓名': '张三', '邮箱': 'zhangsan@example.com', '角色': 'user', '地区': '中国内地', '团队': '投资法务中心' },
      { '用户名': 'lisi', '密码': '123456', '姓名': '李四', '邮箱': 'lisi@example.com', '角色': 'user', '地区': '中国香港', '团队': '公司及国际金融事务中心' },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '用户导入模板');
    XLSX.writeFile(wb, '用户导入模板.xlsx');
  };

  // ========== 部门管理方法 ==========
  const filteredDepts = departments.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.description && d.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const openDeptModal = (dept?: Department) => {
    if (dept) {
      setEditingDept(dept);
      setDeptForm({ name: dept.name, description: dept.description || '' });
    } else {
      setEditingDept(null);
      setDeptForm({ name: '', description: '' });
    }
    setShowDeptModal(true);
  };

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    let result;
    if (editingDept) {
      result = await updateDepartment(editingDept.id, deptForm);
    } else {
      result = await addDepartment(deptForm);
    }
    if (result.success) {
      showMessage('success', result.message);
      setShowDeptModal(false);
    } else {
      showMessage('error', result.message);
    }
  };

  const handleDeleteDept = async (id: string) => {
    const result = await deleteDepartment(id);
    showMessage(result.success ? 'success' : 'error', result.message);
    setShowDeleteDeptConfirm(null);
  };

  // ========== 团队管理方法 ==========
  const filteredTeams = teams.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const openTeamModal = (team?: Team) => {
    if (team) {
      setEditingTeamData(team);
      setTeamForm({ name: team.name, departmentId: team.departmentId, description: team.description || '' });
    } else {
      setEditingTeamData(null);
      setTeamForm({ name: '', departmentId: departments[0]?.id || '', description: '' });
    }
    setShowTeamModal(true);
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    let result;
    if (editingTeamData) {
      result = await updateTeam(editingTeamData.id, teamForm);
    } else {
      result = await addTeam(teamForm);
    }
    if (result.success) {
      showMessage('success', result.message);
      setShowTeamModal(false);
    } else {
      showMessage('error', result.message);
    }
  };

  const handleDeleteTeam = async (id: string) => {
    const result = await deleteTeam(id);
    showMessage(result.success ? 'success' : 'error', result.message);
    setShowDeleteTeamConfirm(null);
  };

  // ========== 小组管理方法 ==========
  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (g.description && g.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const openGroupModal = (group?: Group) => {
    if (group) {
      setEditingGroupData(group);
      setGroupForm({ name: group.name, teamId: group.teamId, description: group.description || '' });
    } else {
      setEditingGroupData(null);
      // 默认选择投资法务中心
      const defaultTeam = teams.find(t => t.name === '投资法务中心');
      setGroupForm({ name: '', teamId: defaultTeam?.id || teams[0]?.id || '', description: '' });
    }
    setShowGroupModal(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    let result;
    if (editingGroupData) {
      result = await updateGroup(editingGroupData.id, groupForm);
    } else {
      result = await addGroup(groupForm);
    }
    showMessage(result.success ? 'success' : 'error', result.message);
    if (result.success) {
      setShowGroupModal(false);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    const result = await deleteGroup(id);
    showMessage(result.success ? 'success' : 'error', result.message);
    setShowDeleteGroupConfirm(null);
  };

  const handleUpdateUserGroup = async (userId: string, group: string) => {
    const result = await updateUserField(userId, 'group' as any, group);
    showMessage(result.success ? 'success' : 'error', result.message);
    setEditingGroup(null);
  };

  // 权限检查
  if (currentUser?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">无访问权限</h2>
          <p className="text-slate-500">只有管理员可以访问权限管理页面</p>
        </div>
      </div>
    );
  }

  // 获取添加按钮文本和动作
  const getAddButtonConfig = () => {
    switch (activeTab) {
      case 'users':
        return { text: '添加用户', action: () => setShowAddUserModal(true) };
      case 'teams':
        return { text: '添加团队', action: () => openTeamModal() };
      case 'groups':
        return { text: '添加小组', action: () => openGroupModal() };
      case 'departments':
        return { text: '添加部门', action: () => openDeptModal() };
    }
  };

  const addButtonConfig = getAddButtonConfig();

  return (
    <div className="min-h-screen section-gradient relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-100/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-100/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 space-y-6 p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-2 animate-fade-in-down">
          <div>
            <h1 className="text-4xl font-bold text-neutral-900 tracking-tight" style={{ fontWeight: 700 }}>权限管理</h1>
            <p className="text-neutral-500 mt-2 text-sm font-medium">管理用户、团队和部门</p>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === 'users' && (
              <>
                <Button
                  onClick={handleDownloadTemplate}
                  variant="ghost"
                  className="h-9 px-4 rounded-lg border border-slate-200/60 bg-white/60 hover:bg-slate-50/80 text-slate-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" x2="12" y1="15" y2="3" />
                  </svg>
                  下载模板
                </Button>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="ghost"
                  className="h-9 px-4 rounded-lg border border-slate-200/60 bg-white/60 hover:bg-slate-50/80 text-slate-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" x2="12" y1="3" y2="15" />
                  </svg>
                  批量导入
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportUsers}
                  className="hidden"
                />
              </>
            )}
            <Button
              onClick={addButtonConfig.action}
              className="h-9 px-4 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/30"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {addButtonConfig.text}
            </Button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={cn(
            "flex items-center gap-2 px-4 py-3 rounded-xl animate-fade-in-up",
            message.type === 'success' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
          )}>
            {message.type === 'success' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            {message.text}
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 animate-fade-in-up">
          <Card className="card-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-neutral-600">总用户数</CardTitle>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neutral-900">{users.length}</div>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-neutral-600">团队数量</CardTitle>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neutral-900">{teams.length}</div>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-neutral-600">部门数量</CardTitle>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
                <path d="M3 21h18" />
                <path d="M5 21V7l8-4v18" />
                <path d="M19 21V11l-6-4" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neutral-900">{departments.length}</div>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-neutral-600">小组数量</CardTitle>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neutral-900">{groups.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* AI功能配置 */}
        <Card className="card-premium animate-fade-in-up">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
                    <circle cx="7.5" cy="14.5" r="1.5" />
                    <circle cx="16.5" cy="14.5" r="1.5" />
                  </svg>
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-neutral-900">AI 工时助手配置</CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">控制AI功能的开放范围</p>
                </div>
              </div>
              <Popover open={editingAiMode} onOpenChange={setEditingAiMode}>
                <PopoverTrigger asChild>
                  <button
                    disabled={aiModeLoading}
                    className={cn(
                      "px-4 py-2 rounded-xl text-sm font-medium cursor-pointer hover:opacity-80 transition-all flex items-center gap-2",
                      AI_MODE_COLORS[aiMode],
                      aiModeLoading && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {aiModeLoading ? (
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <>
                        {aiMode === 'off' && (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                          </svg>
                        )}
                        {aiMode === 'selective' && (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                        )}
                        {aiMode === 'all' && (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                          </svg>
                        )}
                      </>
                    )}
                    {AI_MODE_LABELS[aiMode]}
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2 bg-white/95 backdrop-blur-sm border border-slate-200/80 shadow-xl rounded-xl" align="end">
                  <div className="space-y-1">
                    <button
                      onClick={() => handleUpdateAiMode('off')}
                      className={cn(
                        "w-full text-left px-3 py-2.5 text-sm rounded-lg transition-all flex items-center gap-3",
                        aiMode === 'off' ? "bg-slate-100 text-slate-700 font-medium" : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium">关闭</div>
                        <div className="text-xs text-slate-400">所有人不可用</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleUpdateAiMode('selective')}
                      className={cn(
                        "w-full text-left px-3 py-2.5 text-sm rounded-lg transition-all flex items-center gap-3",
                        aiMode === 'selective' ? "bg-amber-50 text-amber-700 font-medium" : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium">选择性开放</div>
                        <div className="text-xs text-slate-400">仅指定用户可用</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleUpdateAiMode('all')}
                      className={cn(
                        "w-full text-left px-3 py-2.5 text-sm rounded-lg transition-all flex items-center gap-3",
                        aiMode === 'all' ? "bg-emerald-50 text-emerald-700 font-medium" : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium">全量开放</div>
                        <div className="text-xs text-slate-400">所有人可用</div>
                      </div>
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          {aiMode === 'selective' && (
            <CardContent className="pt-0">
              <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100">
                <div className="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 mt-0.5 flex-shrink-0">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <div className="text-sm text-amber-700">
                    <p className="font-medium mb-1">选择性开放模式</p>
                    <p className="text-amber-600">在下方用户列表中，点击"AI"列的开关来控制每个用户的AI功能权限。</p>
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Tabs */}
        <div className="flex gap-2 animate-fade-in-up">
          <button
            onClick={() => setActiveTab('users')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === 'users'
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
            )}
          >
            用户管理
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === 'teams'
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
            )}
          >
            团队管理
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === 'groups'
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
            )}
          >
            小组管理
          </button>
          <button
            onClick={() => setActiveTab('departments')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === 'departments'
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
            )}
          >
            部门管理
          </button>
        </div>

        {/* Content */}
        <Card className="card-premium animate-fade-in-up">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base font-semibold text-neutral-900">
                  {activeTab === 'users' ? '用户列表' : activeTab === 'teams' ? '团队列表' : activeTab === 'groups' ? '小组列表' : '部门列表'}
                </CardTitle>
                {activeTab === 'users' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSendReminder}
                    disabled={sendingReminder}
                    className="h-8 px-3 text-xs bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 hover:text-blue-700"
                  >
                    {sendingReminder ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-1.5 h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        发送中...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                          <polyline points="22,6 12,13 2,6"></polyline>
                        </svg>
                        发送工时提醒
                      </>
                    )}
                  </Button>
                )}
              </div>
              <div className="relative">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <Input
                  placeholder="搜索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64 h-9 rounded-lg border-slate-200"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* 用户列表 */}
            {activeTab === 'users' && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-3 px-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider">用户</th>
                      <th className="text-left py-3 px-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider">用户名</th>
                      <th className="text-left py-3 px-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider">邮箱</th>
                      <th className="text-left py-3 px-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider">团队</th>
                      <th className="text-left py-3 px-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider">小组</th>
                      <th className="text-left py-3 px-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider">地区</th>
                      <th className="text-left py-3 px-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider">角色</th>
                      {aiMode === 'selective' && (
                        <th className="text-center py-3 px-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider">AI</th>
                      )}
                      <th className="text-left py-3 px-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider">创建时间</th>
                      <th className="text-right py-3 px-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-600 text-xs font-medium flex-shrink-0">
                              {u.name.charAt(0)}
                            </div>
                            <span className="font-medium text-slate-800 text-xs">{u.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2">
                          {editingField?.userId === u.id && editingField?.field === 'username' ? (
                            <Input
                              value={editingField.value}
                              onChange={(e) => setEditingField({ ...editingField, value: e.target.value })}
                              onBlur={handleUpdateField}
                              onKeyDown={(e) => e.key === 'Enter' && handleUpdateField()}
                              className="h-7 px-2 text-xs w-24 rounded border-slate-200"
                              autoFocus
                            />
                          ) : (
                            <span
                              onClick={() => u.username !== 'admin' && setEditingField({ userId: u.id, field: 'username', value: u.username })}
                              className={cn("text-slate-600 text-xs", u.username !== 'admin' && "cursor-pointer hover:text-blue-500")}
                            >
                              {u.username}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2">
                          {editingField?.userId === u.id && editingField?.field === 'email' ? (
                            <Input
                              value={editingField.value}
                              onChange={(e) => setEditingField({ ...editingField, value: e.target.value })}
                              onBlur={handleUpdateField}
                              onKeyDown={(e) => e.key === 'Enter' && handleUpdateField()}
                              className="h-7 px-2 text-xs w-36 rounded border-slate-200"
                              autoFocus
                            />
                          ) : (
                            <span
                              onClick={() => u.username !== 'admin' && setEditingField({ userId: u.id, field: 'email', value: u.email })}
                              className={cn("text-slate-600 text-xs", u.username !== 'admin' && "cursor-pointer hover:text-blue-500")}
                            >
                              {u.email}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2">
                          {u.username !== 'admin' ? (
                            <Popover open={editingTeam === u.id} onOpenChange={(open) => setEditingTeam(open ? u.id : null)}>
                              <PopoverTrigger asChild>
                                <button className="text-slate-600 text-xs cursor-pointer hover:text-blue-500 transition-colors text-left">
                                  {u.team || '-'}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48 p-1.5 bg-white/95 backdrop-blur-sm border border-slate-200/80 shadow-xl rounded-xl" align="start">
                                <div className="space-y-0.5 max-h-64 overflow-y-auto">
                                  <button
                                    onClick={() => handleUpdateUserTeam(u.id, '')}
                                    className={cn(
                                      "w-full text-left px-3 py-2 text-xs rounded-lg transition-all",
                                      !u.team ? "bg-blue-50 text-blue-600 font-medium" : "text-slate-600 hover:bg-slate-50"
                                    )}
                                  >
                                    <div className="flex items-center gap-2">
                                      {!u.team && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                                      <span className={!u.team ? "" : "ml-[20px]"}>-</span>
                                    </div>
                                  </button>
                                  {TEAMS.map(team => (
                                    <button
                                      key={team}
                                      onClick={() => handleUpdateUserTeam(u.id, team)}
                                      className={cn(
                                        "w-full text-left px-3 py-2 text-xs rounded-lg transition-all",
                                        u.team === team ? "bg-blue-50 text-blue-600 font-medium" : "text-slate-600 hover:bg-slate-50"
                                      )}
                                    >
                                      <div className="flex items-center gap-2">
                                        {u.team === team && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                                        <span className={u.team === team ? "" : "ml-[20px]"}>{team}</span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <span className="text-slate-600 text-xs">{u.team || '-'}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2">
                          {u.username !== 'admin' && u.team === '投资法务中心' ? (
                            <Popover open={editingGroup === u.id} onOpenChange={(open) => setEditingGroup(open ? u.id : null)}>
                              <PopoverTrigger asChild>
                                <button className="text-slate-600 text-xs cursor-pointer hover:text-blue-500 transition-colors text-left">
                                  {u.group || '-'}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-40 p-1.5 bg-white/95 backdrop-blur-sm border border-slate-200/80 shadow-xl rounded-xl" align="start">
                                <div className="space-y-0.5 max-h-64 overflow-y-auto">
                                  <button
                                    onClick={() => handleUpdateUserGroup(u.id, '')}
                                    className={cn(
                                      "w-full text-left px-3 py-2 text-xs rounded-lg transition-all",
                                      !u.group ? "bg-amber-50 text-amber-600 font-medium" : "text-slate-600 hover:bg-slate-50"
                                    )}
                                  >
                                    <div className="flex items-center gap-2">
                                      {!u.group && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                                      <span className={!u.group ? "" : "ml-[20px]"}>-</span>
                                    </div>
                                  </button>
                                  <button
                                    onClick={() => handleUpdateUserGroup(u.id, '全部')}
                                    className={cn(
                                      "w-full text-left px-3 py-2 text-xs rounded-lg transition-all",
                                      u.group === '全部' ? "bg-amber-50 text-amber-600 font-medium" : "text-slate-600 hover:bg-slate-50"
                                    )}
                                  >
                                    <div className="flex items-center gap-2">
                                      {u.group === '全部' && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                                      <span className={u.group === '全部' ? "" : "ml-[20px]"}>全部</span>
                                    </div>
                                  </button>
                                  {getGroupNames(u.team).map(group => (
                                    <button
                                      key={group}
                                      onClick={() => handleUpdateUserGroup(u.id, group)}
                                      className={cn(
                                        "w-full text-left px-3 py-2 text-xs rounded-lg transition-all",
                                        u.group === group ? "bg-amber-50 text-amber-600 font-medium" : "text-slate-600 hover:bg-slate-50"
                                      )}
                                    >
                                      <div className="flex items-center gap-2">
                                        {u.group === group && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                                        <span className={u.group === group ? "" : "ml-[20px]"}>{group}</span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <span className="text-slate-400 text-xs">{u.team === '投资法务中心' ? (u.group || '-') : '-'}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2">
                          {u.username !== 'admin' ? (
                            <Popover open={editingRegion === u.id} onOpenChange={(open) => setEditingRegion(open ? u.id : null)}>
                              <PopoverTrigger asChild>
                                <button
                                  className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-medium cursor-pointer hover:opacity-80 transition-opacity",
                                    RegionColors[u.region || 'CN']
                                  )}
                                >
                                  {RegionLabels[u.region || 'CN']}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-36 p-1.5 bg-white/95 backdrop-blur-sm border border-slate-200/80 shadow-xl rounded-xl" align="start">
                                <div className="space-y-0.5">
                                  {REGIONS.map(region => (
                                    <button
                                      key={region}
                                      onClick={() => handleUpdateRegion(u.id, region)}
                                      className={cn(
                                        "w-full text-left px-3 py-2 text-xs rounded-lg transition-all",
                                        (u.region || 'CN') === region ? "bg-blue-50 text-blue-600 font-medium" : "text-slate-600 hover:bg-slate-50"
                                      )}
                                    >
                                      <div className="flex items-center gap-2">
                                        {(u.region || 'CN') === region && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                                        <span className={(u.region || 'CN') === region ? "" : "ml-[20px]"}>{RegionLabels[region]}</span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", RegionColors[u.region || 'CN'])}>
                              {RegionLabels[u.region || 'CN']}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2">
                          {u.username !== 'admin' ? (
                            <Popover open={editingRole === u.id} onOpenChange={(open) => setEditingRole(open ? u.id : null)}>
                              <PopoverTrigger asChild>
                                <button
                                  className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-medium cursor-pointer hover:opacity-80 transition-opacity",
                                    RoleColors[u.role]
                                  )}
                                >
                                  {RoleLabels[u.role]}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-32 p-1.5 bg-white/95 backdrop-blur-sm border border-slate-200/80 shadow-xl rounded-xl" align="start">
                                <div className="space-y-0.5">
                                  {ROLES.map(role => (
                                    <button
                                      key={role}
                                      onClick={() => handleUpdateRole(u.id, role)}
                                      className={cn(
                                        "w-full text-left px-3 py-2 text-xs rounded-lg transition-all",
                                        u.role === role ? "bg-blue-50 text-blue-600 font-medium" : "text-slate-600 hover:bg-slate-50"
                                      )}
                                    >
                                      <div className="flex items-center gap-2">
                                        {u.role === role && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                                        <span className={u.role === role ? "" : "ml-[20px]"}>{RoleLabels[role]}</span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", RoleColors[u.role])}>
                              {RoleLabels[u.role]}
                            </span>
                          )}
                        </td>
                        {aiMode === 'selective' && (
                          <td className="py-2.5 px-2 text-center">
                            <button
                              onClick={() => handleUpdateUserAiEnabled(u.id, !u.aiEnabled)}
                              className={cn(
                                "w-10 h-5 rounded-full relative transition-all duration-200",
                                u.aiEnabled ? "bg-violet-500" : "bg-slate-200"
                              )}
                            >
                              <span
                                className={cn(
                                  "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200",
                                  u.aiEnabled ? "left-5" : "left-0.5"
                                )}
                              />
                            </button>
                          </td>
                        )}
                        <td className="py-2.5 px-2 text-slate-500 text-xs">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          {u.username !== 'admin' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowDeleteUserConfirm(u.id)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 团队列表 */}
            {activeTab === 'teams' && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">团队名称</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">所属部门</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">描述</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">创建时间</th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeams.map((team) => (
                      <tr key={team.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-600">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                              </svg>
                            </div>
                            <span className="font-medium text-slate-800">{team.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-medium">
                            {getDepartmentById(team.departmentId)?.name || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{team.description || '-'}</td>
                        <td className="py-3 px-4 text-slate-500 text-sm">
                          {new Date(team.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openTeamModal(team)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-blue-500 hover:bg-blue-50"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowDeleteTeamConfirm(team.id)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 小组列表 */}
            {activeTab === 'groups' && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">小组名称</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">所属团队</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">描述</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">创建时间</th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGroups.map((group) => (
                      <tr key={group.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center text-amber-600">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                              </svg>
                            </div>
                            <span className="font-medium text-slate-800">{group.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-medium">
                            {getTeamById(group.teamId)?.name || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{group.description || '-'}</td>
                        <td className="py-3 px-4 text-slate-500 text-sm">
                          {new Date(group.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openGroupModal(group)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-blue-500 hover:bg-blue-50"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowDeleteGroupConfirm(group.id)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 部门列表 */}
            {activeTab === 'departments' && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">部门名称</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">描述</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">团队数</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">创建时间</th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDepts.map((dept) => (
                      <tr key={dept.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center text-indigo-600">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 21h18" />
                                <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
                              </svg>
                            </div>
                            <span className="font-medium text-slate-800">{dept.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{dept.description || '-'}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-medium">
                            {getTeamsByDepartment(dept.id).length} 个团队
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-sm">
                          {new Date(dept.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDeptModal(dept)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-blue-500 hover:bg-blue-50"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowDeleteDeptConfirm(dept.id)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add User Modal - Refined Design */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop with subtle gradient */}
          <div 
            className="absolute inset-0 bg-gradient-to-br from-slate-900/60 via-slate-800/50 to-slate-900/60 backdrop-blur-md transition-opacity duration-300" 
            onClick={() => setShowAddUserModal(false)} 
          />
          
          {/* Modal Container */}
          <div className="relative z-10 w-full max-w-lg bg-white rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] animate-fade-in-up overflow-hidden">
            {/* Header with gradient accent */}
            <div className="relative px-8 pt-8 pb-6">
              {/* Decorative gradient bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <line x1="19" y1="8" x2="19" y2="14" />
                      <line x1="22" y1="11" x2="16" y2="11" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 tracking-tight">添加新用户</h2>
                    <p className="text-sm text-slate-500 mt-0.5">填写以下信息创建用户账户</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAddUserModal(false)} 
                  className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all duration-200 hover:rotate-90"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Form Content */}
            <form onSubmit={handleAddUser} className="px-8 pb-8">
              {/* Two-column grid for basic info */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    用户名
                  </label>
                  <Input 
                    value={newUserForm.username} 
                    onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })} 
                    placeholder="请输入用户名"
                    className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 bg-slate-50/50 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all duration-200" 
                    required 
                  />
                </div>
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    密码
                  </label>
                  <Input 
                    type="password" 
                    value={newUserForm.password} 
                    onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })} 
                    placeholder="请输入密码"
                    className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 bg-slate-50/50 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all duration-200" 
                    required 
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    姓名
                  </label>
                  <Input 
                    value={newUserForm.name} 
                    onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })} 
                    placeholder="请输入真实姓名"
                    className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 bg-slate-50/50 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all duration-200" 
                    required 
                  />
                </div>
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    邮箱
                  </label>
                  <Input 
                    type="email" 
                    value={newUserForm.email} 
                    onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })} 
                    placeholder="example@company.com"
                    className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 bg-slate-50/50 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all duration-200" 
                    required 
                  />
                </div>
              </div>
              
              {/* Full width team select */}
              <div className="mb-4">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  所属团队
                </label>
                <div className="relative">
                  <select 
                    value={newUserForm.team} 
                    onChange={(e) => setNewUserForm({ ...newUserForm, team: e.target.value, group: '' })} 
                    className="w-full h-12 px-4 pr-10 rounded-xl border-2 border-slate-200 bg-slate-50/50 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 appearance-none cursor-pointer text-slate-700" 
                    required
                  >
                    <option value="" className="text-slate-400">请选择团队</option>
                    {TEAMS.map(team => <option key={team} value={team}>{team}</option>)}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* 小组选择 - 仅投资法务中心显示 */}
              {newUserForm.team === '投资法务中心' && (
                <div className="mb-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    所属小组
                  </label>
                  <div className="relative">
                    <select 
                      value={newUserForm.group} 
                      onChange={(e) => setNewUserForm({ ...newUserForm, group: e.target.value })} 
                      className="w-full h-12 px-4 pr-10 rounded-xl border-2 border-slate-200 bg-slate-50/50 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 appearance-none cursor-pointer text-slate-700"
                    >
                      <option value="">请选择小组</option>
                      <option value="1组">1组</option>
                      <option value="2组">2组</option>
                      <option value="3组">3组</option>
                      <option value="4组">4组</option>
                      <option value="5组">5组</option>
                      <option value="6组">6组</option>
                      <option value="全部">全部</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Two-column for region and role */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    国家/地区
                  </label>
                  <div className="relative">
                    <select 
                      value={newUserForm.region} 
                      onChange={(e) => setNewUserForm({ ...newUserForm, region: e.target.value as UserRegion })} 
                      className="w-full h-12 px-4 pr-10 rounded-xl border-2 border-slate-200 bg-slate-50/50 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 appearance-none cursor-pointer text-slate-700"
                    >
                      {REGIONS.map(region => <option key={region} value={region}>{RegionLabels[region]}</option>)}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    角色权限
                  </label>
                  <div className="relative">
                    <select 
                      value={newUserForm.role} 
                      onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as UserRole })} 
                      className="w-full h-12 px-4 pr-10 rounded-xl border-2 border-slate-200 bg-slate-50/50 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 appearance-none cursor-pointer text-slate-700"
                    >
                      {ROLES.map(role => <option key={role} value={role}>{RoleLabels[role]}</option>)}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-4 pt-2">
                <Button 
                  type="button" 
                  onClick={() => setShowAddUserModal(false)} 
                  variant="ghost" 
                  className="flex-1 h-12 rounded-xl border-2 border-slate-200 text-slate-600 font-medium hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
                >
                  取消
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white font-medium shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                  添加用户
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirm Modal */}
      {showDeleteUserConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDeleteUserConfirm(null)} />
          <div className="relative z-10 w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl animate-fade-in-up p-6">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">确认删除</h3>
              <p className="text-slate-500 text-sm mb-6">删除后无法恢复，确定要删除该用户吗？</p>
              <div className="flex gap-3">
                <Button onClick={() => setShowDeleteUserConfirm(null)} variant="ghost" className="flex-1 h-10 rounded-xl border border-slate-200">取消</Button>
                <Button onClick={() => handleDeleteUser(showDeleteUserConfirm)} className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white">删除</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Department Modal */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowDeptModal(false)} />
          <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent pointer-events-none" />
            <div className="relative flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 21h18" />
                    <path d="M5 21V7l8-4v18" />
                    <path d="M19 21V11l-6-4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">{editingDept ? '编辑部门' : '添加部门'}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{editingDept ? '修改部门信息' : '创建新的部门'}</p>
                </div>
              </div>
              <button onClick={() => setShowDeptModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all duration-200">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSaveDept} className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  部门名称 <span className="text-red-400">*</span>
                </label>
                <Input
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  placeholder="请输入部门名称"
                  className="w-full h-12 px-4 rounded-xl border-2 border-slate-200"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  描述 <span className="text-slate-400 text-xs font-normal">（可选）</span>
                </label>
                <textarea
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  className="w-full h-28 px-4 py-3 rounded-xl border-2 border-slate-200 resize-none focus:outline-none focus:border-indigo-400 text-sm"
                  placeholder="请输入部门描述..."
                />
              </div>
              <div className="flex gap-3 pt-3">
                <Button type="button" onClick={() => setShowDeptModal(false)} variant="ghost" className="flex-1 h-11 rounded-xl border-2 border-slate-200">取消</Button>
                <Button type="submit" className="flex-1 h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                  {editingDept ? '保存更改' : '创建部门'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Team Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowTeamModal(false)} />
          <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent pointer-events-none" />
            <div className="relative flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">{editingTeamData ? '编辑团队' : '添加团队'}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{editingTeamData ? '修改团队信息' : '创建新的团队'}</p>
                </div>
              </div>
              <button onClick={() => setShowTeamModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all duration-200">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSaveTeam} className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  团队名称 <span className="text-red-400">*</span>
                </label>
                <Input
                  value={teamForm.name}
                  onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                  placeholder="请输入团队名称"
                  className="w-full h-12 px-4 rounded-xl border-2 border-slate-200"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  所属部门 <span className="text-red-400">*</span>
                </label>
                <select
                  value={teamForm.departmentId}
                  onChange={(e) => setTeamForm({ ...teamForm, departmentId: e.target.value })}
                  className="w-full h-12 px-4 rounded-xl border-2 border-slate-200"
                  required
                >
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  描述 <span className="text-slate-400 text-xs font-normal">（可选）</span>
                </label>
                <textarea
                  value={teamForm.description}
                  onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                  className="w-full h-28 px-4 py-3 rounded-xl border-2 border-slate-200 resize-none focus:outline-none focus:border-blue-400 text-sm"
                  placeholder="请输入团队描述..."
                />
              </div>
              <div className="flex gap-3 pt-3">
                <Button type="button" onClick={() => setShowTeamModal(false)} variant="ghost" className="flex-1 h-11 rounded-xl border-2 border-slate-200">取消</Button>
                <Button type="submit" className="flex-1 h-11 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 text-white">
                  {editingTeamData ? '保存更改' : '创建团队'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Department Confirm */}
      {showDeleteDeptConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowDeleteDeptConfirm(null)} />
          <div className="relative z-10 w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="relative p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/25">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">确认删除部门</h3>
              <p className="text-slate-500 text-sm mb-6">删除后无法恢复，关联的团队也会受到影响</p>
              <div className="flex gap-3">
                <Button onClick={() => setShowDeleteDeptConfirm(null)} variant="ghost" className="flex-1 h-11 rounded-xl border-2 border-slate-200">取消</Button>
                <Button onClick={() => handleDeleteDept(showDeleteDeptConfirm)} className="flex-1 h-11 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white">确认删除</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Team Confirm */}
      {showDeleteTeamConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowDeleteTeamConfirm(null)} />
          <div className="relative z-10 w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="relative p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/25">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">确认删除团队</h3>
              <p className="text-slate-500 text-sm mb-6">删除后无法恢复，团队成员将失去归属</p>
              <div className="flex gap-3">
                <Button onClick={() => setShowDeleteTeamConfirm(null)} variant="ghost" className="flex-1 h-11 rounded-xl border-2 border-slate-200">取消</Button>
                <Button onClick={() => handleDeleteTeam(showDeleteTeamConfirm)} className="flex-1 h-11 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white">确认删除</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowGroupModal(false)} />
          <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent pointer-events-none" />
            <div className="relative flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">{editingGroupData ? '编辑小组' : '添加小组'}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{editingGroupData ? '修改小组信息' : '创建新的小组'}</p>
                </div>
              </div>
              <button onClick={() => setShowGroupModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all duration-200">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSaveGroup} className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  小组名称 <span className="text-red-400">*</span>
                </label>
                <Input
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  placeholder="请输入小组名称"
                  className="w-full h-12 px-4 rounded-xl border-2 border-slate-200"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  所属团队 <span className="text-red-400">*</span>
                </label>
                <select
                  value={groupForm.teamId}
                  onChange={(e) => setGroupForm({ ...groupForm, teamId: e.target.value })}
                  className="w-full h-12 px-4 rounded-xl border-2 border-slate-200"
                  required
                >
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  描述 <span className="text-slate-400 text-xs font-normal">（可选）</span>
                </label>
                <textarea
                  value={groupForm.description}
                  onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                  className="w-full h-28 px-4 py-3 rounded-xl border-2 border-slate-200 resize-none focus:outline-none focus:border-amber-400 text-sm"
                  placeholder="请输入小组描述..."
                />
              </div>
              <div className="flex gap-3 pt-3">
                <Button type="button" onClick={() => setShowGroupModal(false)} variant="ghost" className="flex-1 h-11 rounded-xl border-2 border-slate-200">取消</Button>
                <Button type="submit" className="flex-1 h-11 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white">
                  {editingGroupData ? '保存更改' : '创建小组'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Group Confirm */}
      {showDeleteGroupConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowDeleteGroupConfirm(null)} />
          <div className="relative z-10 w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="relative p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/25">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">确认删除小组</h3>
              <p className="text-slate-500 text-sm mb-6">删除后无法恢复，小组成员将失去归属</p>
              <div className="flex gap-3">
                <Button onClick={() => setShowDeleteGroupConfirm(null)} variant="ghost" className="flex-1 h-11 rounded-xl border-2 border-slate-200">取消</Button>
                <Button onClick={() => handleDeleteGroup(showDeleteGroupConfirm)} className="flex-1 h-11 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white">确认删除</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
