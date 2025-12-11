import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { UserRole, UserRegion } from '@/types/user';
import { RoleLabels, RoleColors, RegionLabels, RegionColors } from '@/types/user';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

const ROLES: UserRole[] = ['admin', 'user', 'manager', 'exporter'];
const REGIONS: UserRegion[] = ['CN', 'HK', 'OTHER'];

export function UserManagementPage() {
  const { user: currentUser, users, addUser, deleteUser, updateUserRole, updateUserRegion, updateUserField, importUsers } = useAuth();
  const { getTeamNames } = useOrganization();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editingRegion, setEditingRegion] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{ userId: string; field: 'username' | 'email'; value: string } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 获取动态团队列表
  const TEAMS = getTeamNames();

  // 新用户表单
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    role: 'user' as UserRole,
    region: 'CN' as UserRegion,
    team: '',
  });

  // 过滤用户
  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.team && u.team.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 显示消息
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // 添加用户
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await addUser({
      ...newUserForm,
      department: '合规交易部',
    });
    if (result.success) {
      showMessage('success', result.message);
      setShowAddModal(false);
      setNewUserForm({ username: '', password: '', name: '', email: '', role: 'user', region: 'CN', team: '' });
    } else {
      showMessage('error', result.message);
    }
  };

  // 删除用户
  const handleDeleteUser = async (userId: string) => {
    const result = await deleteUser(userId);
    if (result.success) {
      showMessage('success', result.message);
    } else {
      showMessage('error', result.message);
    }
    setShowDeleteConfirm(null);
  };

  // 更新角色
  const handleUpdateRole = async (userId: string, role: UserRole) => {
    const result = await updateUserRole(userId, role);
    if (result.success) {
      showMessage('success', result.message);
    } else {
      showMessage('error', result.message);
    }
    setEditingRole(null);
  };

  // 更新地区
  const handleUpdateRegion = async (userId: string, region: UserRegion) => {
    const result = await updateUserRegion(userId, region);
    if (result.success) {
      showMessage('success', result.message);
    } else {
      showMessage('error', result.message);
    }
    setEditingRegion(null);
  };

  // 更新字段（用户名、邮箱）
  const handleUpdateField = async () => {
    if (!editingField) return;
    const result = await updateUserField(editingField.userId, editingField.field, editingField.value);
    if (result.success) {
      showMessage('success', result.message);
    } else {
      showMessage('error', result.message);
    }
    setEditingField(null);
  };

  // 更新团队
  const handleUpdateTeam = async (userId: string, team: string) => {
    const result = await updateUserField(userId, 'team', team);
    if (result.success) {
      showMessage('success', result.message);
    } else {
      showMessage('error', result.message);
    }
    setEditingTeam(null);
  };

  // 导入用户
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
          // 解析地区
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
    
    // 清空 input 以便重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 下载导入模板
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

  if (currentUser?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">无访问权限</h2>
          <p className="text-slate-500">只有管理员可以访问用户管理页面</p>
        </div>
      </div>
    );
  }

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
            <h1 className="text-4xl font-bold text-neutral-900 tracking-tight" style={{ fontWeight: 700 }}>用户管理</h1>
            <p className="text-neutral-500 mt-2 text-sm font-medium">管理系统用户和权限</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleDownloadTemplate}
              variant="ghost"
              className="h-9 px-4 rounded-lg border border-slate-200/60 bg-white/60 hover:bg-slate-50/80 text-slate-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" x2="12" y1="15" y2="3"/>
              </svg>
              下载模板
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="ghost"
              className="h-9 px-4 rounded-lg border border-slate-200/60 bg-white/60 hover:bg-slate-50/80 text-slate-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" x2="12" y1="3" y2="15"/>
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
            <Button
              onClick={() => setShowAddModal(true)}
              className="h-9 px-4 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/30"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              添加用户
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
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
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
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neutral-900">{users.length}</div>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-neutral-600">管理员</CardTitle>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neutral-900">{users.filter(u => u.role === 'admin').length}</div>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-neutral-600">管理者</CardTitle>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neutral-900">{users.filter(u => u.role === 'manager').length}</div>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-neutral-600">普通用户</CardTitle>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neutral-900">{users.filter(u => u.role === 'user').length}</div>
            </CardContent>
          </Card>
        </div>

        {/* User List */}
        <Card className="card-premium animate-fade-in-up">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-neutral-900">用户列表</CardTitle>
              <div className="relative">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <Input
                  placeholder="搜索用户..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64 h-9 rounded-lg border-slate-200"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-3 px-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider">用户</th>
                    <th className="text-left py-3 px-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider">用户名</th>
                    <th className="text-left py-3 px-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider">邮箱</th>
                    <th className="text-left py-3 px-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider">团队</th>
                    <th className="text-left py-3 px-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider">地区</th>
                    <th className="text-left py-3 px-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider">角色</th>
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
                              <div className="space-y-0.5">
                                <button
                                  onClick={() => handleUpdateTeam(u.id, '')}
                                  className={cn(
                                    "w-full text-left px-3 py-2 text-xs rounded-lg transition-all",
                                    !u.team ? "bg-blue-50 text-blue-600 font-medium" : "text-slate-600 hover:bg-slate-50"
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    {!u.team && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                                    <span className={!u.team ? "" : "ml-[20px]"}>-</span>
                                  </div>
                                </button>
                                {TEAMS.map(team => (
                                  <button
                                    key={team}
                                    onClick={() => handleUpdateTeam(u.id, team)}
                                    className={cn(
                                      "w-full text-left px-3 py-2 text-xs rounded-lg transition-all",
                                      u.team === team ? "bg-blue-50 text-blue-600 font-medium" : "text-slate-600 hover:bg-slate-50"
                                    )}
                                  >
                                    <div className="flex items-center gap-2">
                                      {u.team === team && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
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
                                      {(u.region || 'CN') === region && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
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
                                      {u.role === role && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
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
                      <td className="py-2.5 px-2 text-slate-500 text-xs">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        {u.username !== 'admin' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowDeleteConfirm(u.id)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              <line x1="10" y1="11" x2="10" y2="17"/>
                              <line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl animate-fade-in-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">添加用户</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">用户名</label>
                <Input value={newUserForm.username} onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })} className="w-full h-11 rounded-xl" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">密码</label>
                <Input type="password" value={newUserForm.password} onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })} className="w-full h-11 rounded-xl" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">姓名</label>
                <Input value={newUserForm.name} onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })} className="w-full h-11 rounded-xl" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">邮箱</label>
                <Input type="email" value={newUserForm.email} onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })} className="w-full h-11 rounded-xl" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">团队</label>
                <select value={newUserForm.team} onChange={(e) => setNewUserForm({ ...newUserForm, team: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-slate-200" required>
                  <option value="">请选择团队</option>
                  {TEAMS.map(team => <option key={team} value={team}>{team}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">国家/地区</label>
                <select value={newUserForm.region} onChange={(e) => setNewUserForm({ ...newUserForm, region: e.target.value as UserRegion })} className="w-full h-11 px-4 rounded-xl border border-slate-200">
                  {REGIONS.map(region => <option key={region} value={region}>{RegionLabels[region]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">角色</label>
                <select value={newUserForm.role} onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as UserRole })} className="w-full h-11 px-4 rounded-xl border border-slate-200">
                  {ROLES.map(role => <option key={role} value={role}>{RoleLabels[role]}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" onClick={() => setShowAddModal(false)} variant="ghost" className="flex-1 h-11 rounded-xl border border-slate-200">取消</Button>
                <Button type="submit" className="flex-1 h-11 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white">添加</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(null)} />
          <div className="relative z-10 w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl animate-fade-in-up p-6">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">确认删除</h3>
              <p className="text-slate-500 text-sm mb-6">删除后无法恢复，确定要删除该用户吗？</p>
              <div className="flex gap-3">
                <Button onClick={() => setShowDeleteConfirm(null)} variant="ghost" className="flex-1 h-10 rounded-xl border border-slate-200">取消</Button>
                <Button onClick={() => handleDeleteUser(showDeleteConfirm)} className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white">删除</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
