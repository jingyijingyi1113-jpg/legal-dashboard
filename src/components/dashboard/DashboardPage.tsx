import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import { getWorkdaysInMonth } from '@/lib/date-utils';
import { MonthPicker } from './MonthPicker';
import { ProjectDimensionTab } from './ProjectDimensionTab';
import { TeamDimensionTab } from './TeamDimensionTab';

import { format, parse } from 'date-fns';

interface MonthlyData {
    month: string;
    totalHours: number;
    activeUsers: number;
    avgHoursPerUser: number;
    totalHoursTrend: number;
    avgHoursTrend: number;
  }

export function DashboardPage() {
  const [rawData, setRawData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<string>('overview');

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet) as any[];
        setRawData(json);
        processTimeData(json);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const processTimeData = (data: any[]) => {
    const monthlyAgg: { [key: string]: { [key: string]: { hours: number; users: Set<string> } } } = {};

    data.forEach(item => {
        if (item.Month && typeof item.Month === 'string' && item.Name) {
            const month = item.Month.substring(0, 7);
            const team = item['团队'] || 'Unknown';

            if (!monthlyAgg[month]) {
                monthlyAgg[month] = {};
            }
            if (!monthlyAgg[month][team]) {
                monthlyAgg[month][team] = { hours: 0, users: new Set() };
            }
            monthlyAgg[month][team].hours += Number(item['Hours']) || 0;
            const name = item.Name.toString().replace(/\s+/g, ' ').trim();
            monthlyAgg[month][team].users.add(name);
        }
    });

    const sortedMonths = Object.keys(monthlyAgg).sort();

    const coreData = sortedMonths.map(month => {
        const date = parse(month, 'yyyy/MM', new Date());
        const year = date.getFullYear();
        const monthNum = date.getMonth() + 1;
        const cnWorkdays = getWorkdaysInMonth(year, monthNum, 'CN');
        const hkWorkdays = getWorkdaysInMonth(year, monthNum, 'HK');

        let totalHours = 0;
        let departmentAvgHours = 0;
        let contributingTeams = 0;

        const teamsData = monthlyAgg[month];
        const allUsers = new Set<string>();

        for (const team in teamsData) {
            const teamData = teamsData[team];
            totalHours += teamData.hours;
            teamData.users.forEach(user => allUsers.add(user));

            let timeCoefficient = 1;
            if (team === '投资法务中心') {
                timeCoefficient = cnWorkdays > 0 ? 20.83 / cnWorkdays : 0;
            } else if (team === '公司及国际金融事务中心') {
                timeCoefficient = hkWorkdays > 0 ? 20.83 / hkWorkdays : 0;
            }

            if (teamData.users.size > 0 && timeCoefficient > 0) {
                const teamAvgHours = (teamData.hours / teamData.users.size) * timeCoefficient;
                departmentAvgHours += teamAvgHours;
                contributingTeams++;
            }
        }

        const totalActiveUsers = allUsers.size;
        const avgHoursPerUser = contributingTeams > 0 ? departmentAvgHours / contributingTeams : 0;

        return {
            month,
            totalHours,
            activeUsers: totalActiveUsers,
            avgHoursPerUser,
        };
    });

    const finalData: MonthlyData[] = coreData.map((currentMonthData, index) => {
        let totalHoursTrend = 0;
        let avgHoursTrend = 0;

        if (index > 0) {
            const prevMonthData = coreData[index - 1];
            if (prevMonthData.totalHours > 0) {
                totalHoursTrend = ((currentMonthData.totalHours - prevMonthData.totalHours) / prevMonthData.totalHours) * 100;
            }
            if (prevMonthData.avgHoursPerUser > 0) {
                avgHoursTrend = ((currentMonthData.avgHoursPerUser - prevMonthData.avgHoursPerUser) / prevMonthData.avgHoursPerUser) * 100;
            }
        }

        return {
            ...currentMonthData,
            totalHoursTrend,
            avgHoursTrend,
        };
    });

    setMonthlyData(finalData);
    if (finalData.length > 0) {
        const latestMonth = finalData[finalData.length - 1].month;
        setSelectedDate(parse(latestMonth, 'yyyy/MM', new Date()));
    }
  };

  const displayedData = useMemo(() => {
    const monthStr = format(selectedDate, 'yyyy/MM');
    const data = monthlyData.find(d => d.month === monthStr);
    if (!data) return { totalHours: 0, activeUsers: 0, avgHours: 0, totalHoursTrend: 0, avgHoursTrend: 0 };
    return {
      totalHours: data.totalHours,
      activeUsers: data.activeUsers,
      avgHours: data.avgHoursPerUser,
      totalHoursTrend: data.totalHoursTrend,
      avgHoursTrend: data.avgHoursTrend
    };
  }, [selectedDate, monthlyData]);

  const TimeDimensionTab = () => (
    <TabsContent value="time-dimension" className="space-y-6">
        <div className="flex items-center space-x-3 animate-fade-in-up">
            <MonthPicker value={selectedDate} onChange={setSelectedDate} />
        </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-fade-in-up">
            <Card className="card-premium">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-semibold text-neutral-600">部门总用时</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-neutral-900">{displayedData.totalHours.toFixed(2)}</div>
                <p className={`text-xs font-medium mt-2 ${displayedData.totalHoursTrend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    环比: {displayedData.totalHoursTrend.toFixed(2)}%
                </p>
              </CardContent>
            </Card>
            <Card className="card-premium md:col-span-1 lg:col-span-3">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-neutral-600">部门整体情况</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 divide-x divide-neutral-200/50">
                  <div className="flex flex-col items-center p-3">
                      <div className="text-2xl font-bold text-neutral-900">{displayedData.activeUsers}</div>
                      <p className="text-xs text-neutral-500 mt-1 font-medium">活跃人数</p>
                  </div>
                  <div className="flex flex-col items-center p-3">
                      <div className="text-2xl font-bold text-neutral-900">{displayedData.totalHours.toFixed(2)}</div>
                      <p className="text-xs text-neutral-500 mt-1 font-medium">总用时</p>
                  </div>
                  <div className="flex flex-col items-center p-3">
                      <div className="text-2xl font-bold text-neutral-900">{displayedData.avgHours.toFixed(2)}</div>
                      <p className="text-xs text-neutral-500 mt-1 font-medium">人均用时</p>
                  </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 animate-fade-in-up">
            <Card className="card-premium">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold text-neutral-900">总用时月度趋势</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="month" stroke="rgba(0,0,0,0.3)" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" label={{ value: '小时', angle: -90, position: 'insideLeft' }} stroke="rgba(0,0,0,0.3)" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: '%', angle: -90, position: 'insideRight' }} stroke="rgba(0,0,0,0.3)" tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => value.toFixed(2)} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="totalHours" name="总用时" fill="#2563eb" radius={[8, 8, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="totalHoursTrend" name="环比 (%)" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="card-premium">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold text-neutral-900">月度人均用时趋势</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="month" stroke="rgba(0,0,0,0.3)" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" label={{ value: '小时', angle: -90, position: 'insideLeft' }} stroke="rgba(0,0,0,0.3)" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: '%', angle: -90, position: 'insideRight' }} stroke="rgba(0,0,0,0.3)" tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => value.toFixed(2)} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="avgHoursPerUser" name="人均用时" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="avgHoursTrend" name="环比 (%)" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
    </TabsContent>
  );

  const DepartmentOverviewTab = () => (
      <TabsContent value="overview" className="space-y-6 focus-visible:outline-none">
        <Tabs defaultValue="time-dimension" className="space-y-6">
          <div className="bg-slate-50/95 backdrop-blur supports-[backdrop-filter]:bg-slate-50/60 border-b border-slate-200/60 -mx-6 px-6 pt-2 pb-0">
            <TabsList className="flex h-auto items-center justify-start gap-2 bg-transparent p-0 w-full">
                <TabsTrigger 
                  value="time-dimension"
                  className="relative h-9 rounded-md border-0 bg-transparent px-4 py-2 font-normal text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 data-[state=active]:shadow-none text-sm"
                >
                  工时维度
                </TabsTrigger>
                <TabsTrigger 
                  value="project-dimension"
                  className="relative h-9 rounded-md border-0 bg-transparent px-4 py-2 font-normal text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 data-[state=active]:shadow-none text-sm"
                >
                  项目维度
                </TabsTrigger>
            </TabsList>
          </div>
            <TimeDimensionTab />
            <TabsContent value="project-dimension" className="mt-6 focus-visible:outline-none">
                <ProjectDimensionTab data={rawData} />
            </TabsContent>
        </Tabs>
      </TabsContent>
  );

  return (
    <div className="min-h-screen section-gradient relative overflow-hidden">
      {/* Ambient background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-teal-100/20 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative z-10 space-y-6 p-6">
        <div className='flex justify-between items-center mb-2 animate-fade-in-down'>
          <div>
            <h1 className="text-4xl font-bold text-neutral-900 tracking-tight">工时数据看板</h1>
            <p className="text-neutral-500 mt-2 text-sm font-medium">实时工时统计与趋势分析</p>
          </div>
          <div className="flex items-center gap-4">
            <Button asChild variant="outline" className="shadow-elevation-2 hover:shadow-elevation-3 transition-all duration-300 hover:border-blue-300 group bg-white/80 backdrop-blur-sm">
              <label htmlFor="file-upload" className="cursor-pointer flex items-center gap-2.5 px-4 py-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 group-hover:rotate-12 transition-transform"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                <span className="font-semibold text-neutral-700">导入数据</span>
              </label>
            </Button>
            <Input id="file-upload" type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xls" />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="glass-effect -mx-6 px-6 shadow-elevation-2 transition-all duration-200 rounded-xl">
            <TabsList className="flex h-14 items-center justify-start gap-8 bg-transparent p-0 w-full">
              <TabsTrigger 
                value="overview"
                className="nav-tab-enhanced relative text-neutral-600 hover:text-neutral-900 data-[state=active]:text-blue-600 data-[state=active]:font-semibold transition-colors duration-300 text-[17px]"
              >
                部门总览
                <span className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full scale-x-0 data-[state=active]:scale-x-100 transition-transform duration-300 origin-left"></span>
              </TabsTrigger>
              <TabsTrigger 
                value="team"
                className="nav-tab-enhanced relative text-neutral-600 hover:text-neutral-900 data-[state=active]:text-blue-600 data-[state=active]:font-semibold transition-colors duration-300 text-[17px]"
              >
                分团队预览
                <span className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full scale-x-0 data-[state=active]:scale-x-100 transition-transform duration-300 origin-left"></span>
              </TabsTrigger>
              <TabsTrigger 
                value="personal" 
                disabled
                className="nav-tab-enhanced relative text-neutral-400 cursor-not-allowed opacity-50 hover:opacity-50 transition-opacity duration-300 text-[17px]"
              >
                个人工时预览 (待完善)
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="container mx-auto max-w-7xl animate-fade-in-up">
            <DepartmentOverviewTab />
            <TabsContent value="team" className="m-0 focus-visible:outline-none">
              {activeTab === 'team' && <TeamDimensionTab data={rawData} />}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
