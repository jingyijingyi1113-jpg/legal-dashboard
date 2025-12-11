import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Department, Team } from '@/types/organization';
import { cn } from '@/lib/utils';

export function OrganizationPage() {
  const { user: currentUser } = useAuth();
  const {
    departments,
    teams,
    addDepartment,
    updateDepartment,
    deleteDepartment,
    addTeam,
    updateTeam,
    deleteTeam,
    getDepartmentById,
    getTeamsByDepartment,
  } = useOrganization();

  const [activeTab, setActiveTab] = useState<'departments' | 'teams'>('teams');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // 部门表单
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptForm, setDeptForm] = useState({ name: '', description: '' });
  const [showDeleteDeptConfirm, setShowDeleteDeptConfirm] = useState<string | null>(null);

  // 团队表单
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamForm, setTeamForm] = useState({ name: '', departmentId: '', description: '' });
  const [showDeleteTeamConfirm, setShowDeleteTeamConfirm] = useState<string | null>(null);

  // 搜索
  const [searchTerm, setSearchTerm] = useState('');

  // 显示消息
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // 打开添加/编辑部门弹窗
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

  // 保存部门
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

  // 删除部门
  const handleDeleteDept = async (id: string) => {
    const result = await deleteDepartment(id);
    showMessage(result.success ? 'success' : 'error', result.message);
    setShowDeleteDeptConfirm(null);
  };

  // 打开添加/编辑团队弹窗
  const openTeamModal = (team?: Team) => {
    if (team) {
      setEditingTeam(team);
      setTeamForm({ name: team.name, departmentId: team.departmentId, description: team.description || '' });
    } else {
      setEditingTeam(null);
      setTeamForm({ name: '', departmentId: departments[0]?.id || '', description: '' });
    }
    setShowTeamModal(true);
  };

  // 保存团队
  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    let result;
    if (editingTeam) {
      result = await updateTeam(editingTeam.id, teamForm);
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

  // 删除团队
  const handleDeleteTeam = async (id: string) => {
    const result = await deleteTeam(id);
    showMessage(result.success ? 'success' : 'error', result.message);
    setShowDeleteTeamConfirm(null);
  };

  // 过滤团队
  const filteredTeams = teams.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 过滤部门
  const filteredDepts = departments.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.description && d.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 权限检查
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
          <p className="text-slate-500">只有管理员可以访问组织架构管理页面</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen section-gradient relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-100/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-100/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 space-y-6 p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-2 animate-fade-in-down">
          <div>
            <h1 className="text-4xl font-bold text-neutral-900 tracking-tight" style={{ fontWeight: 700 }}>组织架构</h1>
            <p className="text-neutral-500 mt-2 text-sm font-medium">管理部门和团队结构</p>
          </div>
          <Button
            onClick={() => activeTab === 'departments' ? openDeptModal() : openTeamModal()}
            className="h-9 px-4 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/30"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {activeTab === 'departments' ? '添加部门' : '添加团队'}
          </Button>
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
        <div className="grid gap-4 md:grid-cols-3 animate-fade-in-up">
          <Card className="card-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-neutral-600">部门数量</CardTitle>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
                <path d="M3 21h18"/>
                <path d="M9 8h1"/>
                <path d="M9 12h1"/>
                <path d="M9 16h1"/>
                <path d="M14 8h1"/>
                <path d="M14 12h1"/>
                <path d="M14 16h1"/>
                <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/>
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neutral-900">{departments.length}</div>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-neutral-600">团队数量</CardTitle>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neutral-900">{teams.length}</div>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-neutral-600">平均团队数</CardTitle>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
                <path d="M3 3v18h18"/>
                <path d="M18 17V9"/>
                <path d="M13 17V5"/>
                <path d="M8 17v-3"/>
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neutral-900">
                {departments.length > 0 ? (teams.length / departments.length).toFixed(1) : 0}
              </div>
              <p className="text-xs text-neutral-500 mt-1">每部门</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 animate-fade-in-up">
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
              <CardTitle className="text-base font-semibold text-neutral-900">
                {activeTab === 'departments' ? '部门列表' : '团队列表'}
              </CardTitle>
              <div className="relative">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
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
            {activeTab === 'departments' ? (
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
                                <path d="M3 21h18"/>
                                <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/>
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
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowDeleteDeptConfirm(dept.id)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              </svg>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
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
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                <circle cx="9" cy="7" r="4"/>
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
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowDeleteTeamConfirm(team.id)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
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

      {/* Department Modal */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDeptModal(false)} />
          <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl animate-fade-in-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">{editingDept ? '编辑部门' : '添加部门'}</h2>
              <button onClick={() => setShowDeptModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleSaveDept} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">部门名称</label>
                <Input
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  className="w-full h-11 rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">描述（可选）</label>
                <textarea
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  className="w-full h-24 px-4 py-3 rounded-xl border border-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  placeholder="请输入部门描述..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" onClick={() => setShowDeptModal(false)} variant="ghost" className="flex-1 h-11 rounded-xl border border-slate-200">取消</Button>
                <Button type="submit" className="flex-1 h-11 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white">保存</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Team Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowTeamModal(false)} />
          <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl animate-fade-in-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">{editingTeam ? '编辑团队' : '添加团队'}</h2>
              <button onClick={() => setShowTeamModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleSaveTeam} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">团队名称</label>
                <Input
                  value={teamForm.name}
                  onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                  className="w-full h-11 rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">所属部门</label>
                <select
                  value={teamForm.departmentId}
                  onChange={(e) => setTeamForm({ ...teamForm, departmentId: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border border-slate-200"
                  required
                >
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">描述（可选）</label>
                <textarea
                  value={teamForm.description}
                  onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                  className="w-full h-24 px-4 py-3 rounded-xl border border-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  placeholder="请输入团队描述..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" onClick={() => setShowTeamModal(false)} variant="ghost" className="flex-1 h-11 rounded-xl border border-slate-200">取消</Button>
                <Button type="submit" className="flex-1 h-11 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white">保存</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Department Confirm */}
      {showDeleteDeptConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDeleteDeptConfirm(null)} />
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
              <p className="text-slate-500 text-sm mb-6">删除后无法恢复，确定要删除该部门吗？</p>
              <div className="flex gap-3">
                <Button onClick={() => setShowDeleteDeptConfirm(null)} variant="ghost" className="flex-1 h-10 rounded-xl border border-slate-200">取消</Button>
                <Button onClick={() => handleDeleteDept(showDeleteDeptConfirm)} className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white">删除</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Team Confirm */}
      {showDeleteTeamConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDeleteTeamConfirm(null)} />
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
              <p className="text-slate-500 text-sm mb-6">删除后无法恢复，确定要删除该团队吗？</p>
              <div className="flex gap-3">
                <Button onClick={() => setShowDeleteTeamConfirm(null)} variant="ghost" className="flex-1 h-10 rounded-xl border border-slate-200">取消</Button>
                <Button onClick={() => handleDeleteTeam(showDeleteTeamConfirm)} className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white">删除</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
