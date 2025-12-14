import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { MonthPicker } from './MonthPicker';

// 团队列表
const TEAMS = [
  { value: 'all', label: '全部团队' },
  { value: '投资法务中心', label: '投资法务中心' },
  { value: '公司及国际金融事务中心', label: '公司及国际金融事务中心' },
  { value: '业务管理及合规检测中心', label: '业务管理及合规检测中心' },
];

// 投资法务中心的小组列表
const INVESTMENT_LEGAL_GROUPS = [
  { value: 'all', label: '全部' },
  { value: '1组', label: '1组' },
  { value: '2组', label: '2组' },
  { value: '3组', label: '3组' },
  { value: '4组', label: '4组' },
  { value: '5组', label: '5组' },
  { value: '6组', label: '6组' },
];

// 周期类型
type Period = 'monthly' | 'quarterly' | 'semiannually' | 'annually' | 'custom';

const periodLabels: Record<Period, string> = {
  monthly: '月度',
  quarterly: '季度',
  semiannually: '半年度',
  annually: '年度',
  custom: '自定义'
};

interface LoadTimesheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userTeam?: string;
  userRole?: string;
  onConfirm: (filters: {
    team?: string;
    group?: string;
    period: Period;
    year?: string;
    periodValue?: string;
    startDate?: Date;
    endDate?: Date;
  }) => void;
}

export function LoadTimesheetDialog({
  open,
  onOpenChange,
  userTeam,
  userRole,
  onConfirm,
}: LoadTimesheetDialogProps) {
  const isAdmin = userRole === 'admin';
  const isInvestmentLegalManager = userRole === 'manager' && userTeam === '投资法务中心';
  const isOtherManager = userRole === 'manager' && userTeam !== '投资法务中心';
  
  const [selectedTeam, setSelectedTeam] = useState<string>(userTeam || '');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [period, setPeriod] = useState<Period>('monthly');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedPeriodValue, setSelectedPeriodValue] = useState<string | null>(null);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [yearOpen, setYearOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);

  // 年份从2025开始
  const availableYears = ['2025', '2026', '2027', '2028', '2029', '2030'];

  const quarters = [
    { value: 'Q1', label: 'Q1', sub: '1-3月' },
    { value: 'Q2', label: 'Q2', sub: '4-6月' },
    { value: 'Q3', label: 'Q3', sub: '7-9月' },
    { value: 'Q4', label: 'Q4', sub: '10-12月' },
  ];

  const semiannuals = [
    { value: 'H1', label: 'H1', sub: '上半年' },
    { value: 'H2', label: 'H2', sub: '下半年' },
  ];

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1).padStart(2, '0'),
    label: `${i + 1}月`,
  }));

  const showTeamSelector = isAdmin;
  const showGroupSelector = isInvestmentLegalManager || (isAdmin && selectedTeam === '投资法务中心');

  const handleConfirm = () => {
    onConfirm({
      team: isAdmin ? selectedTeam : userTeam,
      group: showGroupSelector && selectedGroup !== 'all' ? selectedGroup : undefined,
      period,
      year: period !== 'custom' ? selectedYear : undefined,
      periodValue: period !== 'custom' && period !== 'annually' ? selectedPeriodValue || undefined : undefined,
      startDate: period === 'custom' ? customStartDate : undefined,
      endDate: period === 'custom' ? customEndDate : undefined,
    });
    onOpenChange(false);
  };

  const getTitle = () => {
    if (isOtherManager) return `加载工时记录`;
    return '加载工时记录';
  };

  const getSubtitle = () => {
    if (isOtherManager) return userTeam;
    return '选择筛选条件';
  };

  const getPeriodDisplayText = () => {
    if (period === 'monthly') return selectedPeriodValue ? `${parseInt(selectedPeriodValue)}月` : '选择月份';
    if (period === 'quarterly') return selectedPeriodValue || '选择季度';
    if (period === 'semiannually') return selectedPeriodValue || '选择半年';
    return '';
  };

  const getPeriodOptions = () => {
    if (period === 'monthly') return months.map(m => ({ value: m.value, label: m.label }));
    if (period === 'quarterly') return quarters;
    if (period === 'semiannually') return semiannuals;
    return [];
  };

  const getSelectedTeamLabel = () => {
    const team = TEAMS.find(t => t.value === selectedTeam);
    return team ? team.label : '选择团队';
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ left: 0, right: 0, top: 0, bottom: 0, marginLeft: 0 }}>
      {/* 遮罩 */}
      <div 
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      
      {/* 弹窗 */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* 头部 */}
        <div className="px-6 pt-6 pb-5">
          <h2 className="text-xl font-semibold text-slate-900">{getTitle()}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{getSubtitle()}</p>
        </div>

        {/* 内容 */}
        <div className="px-6 pb-6 space-y-5">
          {/* 团队选择 - 优化的卡片式选择器 */}
          {showTeamSelector && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500">团队</label>
              <Popover open={teamOpen} onOpenChange={setTeamOpen}>
                <PopoverTrigger asChild>
                  <button className={cn(
                    "w-full flex items-center justify-between px-4 py-3 text-sm rounded-xl border transition-all",
                    teamOpen 
                      ? "border-blue-400 ring-2 ring-blue-100 bg-white" 
                      : "border-slate-200 bg-slate-50 hover:border-slate-300"
                  )}>
                    <span className={selectedTeam ? "text-slate-900 font-medium" : "text-slate-400"}>
                      {getSelectedTeamLabel()}
                    </span>
                    <svg className={cn(
                      "w-4 h-4 text-slate-400 transition-transform",
                      teamOpen && "rotate-180"
                    )} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </PopoverTrigger>
                <PopoverContent 
                  className="z-[10000] w-[calc(100vw-4rem)] max-w-[calc(24rem-3rem)] p-2 rounded-xl border-slate-200 shadow-xl bg-white" 
                  align="start" 
                  sideOffset={4}
                >
                  <div className="space-y-1">
                    {TEAMS.map((team) => {
                      const isSelected = selectedTeam === team.value;
                      return (
                        <button
                          key={team.value}
                          onClick={() => { 
                            setSelectedTeam(team.value); 
                            setTeamOpen(false);
                            if (team.value !== '投资法务中心') {
                              setSelectedGroup('all');
                            }
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors",
                            isSelected
                              ? "bg-blue-50 text-blue-700"
                              : "text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          <span className={cn(
                            "text-sm",
                            isSelected && "font-medium"
                          )}>{team.label}</span>
                          {isSelected && (
                            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* 小组选择 - 蓝色主题 */}
          {showGroupSelector && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500">小组</label>
              <div className="flex gap-1.5 flex-wrap">
                {INVESTMENT_LEGAL_GROUPS.map((group) => (
                  <button
                    key={group.value}
                    onClick={() => setSelectedGroup(group.value)}
                    className={cn(
                      "px-3 py-1.5 text-sm rounded-lg transition-colors",
                      selectedGroup === group.value
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    {group.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 时间范围 */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-slate-500">时间范围</label>
            
            {/* 周期切换 - 蓝色主题 */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
              {(['monthly', 'quarterly', 'semiannually', 'annually', 'custom'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPeriod(p);
                    setSelectedPeriodValue(null);
                  }}
                  className={cn(
                    "flex-1 py-2 text-xs font-medium rounded-md transition-colors",
                    period === p
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {periodLabels[p]}
                </button>
              ))}
            </div>

            {/* 年份 + 期间选择 */}
            {period !== 'custom' ? (
              <div className="flex gap-2">
                {/* 年份 */}
                <Popover open={yearOpen} onOpenChange={setYearOpen}>
                  <PopoverTrigger asChild>
                    <button className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-all",
                      yearOpen 
                        ? "border-blue-400 ring-2 ring-blue-100 bg-white" 
                        : "border-slate-200 bg-slate-50 hover:border-slate-300"
                    )}>
                      <span className="text-slate-900 font-medium">{selectedYear}</span>
                      <svg className={cn(
                        "w-3.5 h-3.5 text-slate-400 transition-transform",
                        yearOpen && "rotate-180"
                      )} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="z-[10000] w-48 p-2 rounded-xl border-slate-200 bg-white shadow-xl" align="start" sideOffset={4}>
                    <div className="grid grid-cols-3 gap-1">
                      {availableYears.map((year) => (
                        <button
                          key={year}
                          onClick={() => { setSelectedYear(year); setYearOpen(false); }}
                          className={cn(
                            "py-2 text-sm rounded-lg transition-colors",
                            selectedYear === year
                              ? "bg-blue-600 text-white"
                              : "text-slate-600 hover:bg-slate-100"
                          )}
                        >
                          {year}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* 期间（月/季/半年） */}
                {period !== 'annually' && (
                  <Popover open={periodOpen} onOpenChange={setPeriodOpen}>
                    <PopoverTrigger asChild>
                      <button className={cn(
                        "flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-all",
                        periodOpen 
                          ? "border-blue-400 ring-2 ring-blue-100 bg-white" 
                          : "border-slate-200 bg-slate-50 hover:border-slate-300"
                      )}>
                        <span className={selectedPeriodValue ? "text-slate-900 font-medium" : "text-slate-400"}>
                          {getPeriodDisplayText()}
                        </span>
                        <svg className={cn(
                          "w-3.5 h-3.5 text-slate-400 transition-transform",
                          periodOpen && "rotate-180"
                        )} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent 
                      className={cn(
                        "z-[10000] p-2 rounded-xl border-slate-200 bg-white shadow-xl",
                        period === 'monthly' ? "w-56" : "w-44"
                      )} 
                      align="start" 
                      sideOffset={4}
                    >
                      <div className={cn(
                        "grid gap-1",
                        period === 'monthly' ? "grid-cols-4" : "grid-cols-2"
                      )}>
                        {getPeriodOptions().map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => { setSelectedPeriodValue(opt.value); setPeriodOpen(false); }}
                            className={cn(
                              "py-2 text-sm rounded-lg transition-colors",
                              selectedPeriodValue === opt.value
                                ? "bg-blue-600 text-white"
                                : "text-slate-600 hover:bg-slate-100"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            ) : (
              /* 自定义范围 */
              <div className="flex items-center gap-2">
                <MonthPicker value={customStartDate} onChange={setCustomStartDate} variant="minimal" />
                <span className="text-slate-300">—</span>
                <MonthPicker value={customEndDate} onChange={setCustomEndDate} variant="minimal" />
              </div>
            )}
          </div>
        </div>

        {/* 底部 */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg text-sm"
          >
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
          >
            确定
          </Button>
        </div>
      </div>
    </div>
  );
}
