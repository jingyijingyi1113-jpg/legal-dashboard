import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, Area, ReferenceLine 
} from 'recharts';
import { parseMonthString, normalizeMonthString, getWorkdaysInMonth } from '@/lib/date-utils';
import { cn } from "@/lib/utils";
import { useAuth } from '@/contexts/AuthContext';
import { useTimesheet } from '@/contexts/TimesheetContext';

interface AnomalyDetectionTabProps {
  data: any[];
}

// 时间周期类型
type SubmissionPeriod = 'monthly' | 'quarterly' | 'semiannually' | 'annually' | 'custom';

// 人员工时提交状态
interface UserSubmissionStatus {
  userId: string;
  userName: string;
  team: string;
  group?: string; // 仅投资法务中心
  submittedHours: number;
  historicalAvgHours: number;
  historicalStdDev: number;
  status: 'normal' | 'warning' | 'anomaly' | 'missing';
  statusLabel: string;
  deviation: number; // 偏离度百分比
}

interface MonthlyForecastData {
  month: string;
  totalHours: number;
  isActual: boolean;
  forecast?: number;
  upperBound?: number;
  lowerBound?: number;
  confidenceRange?: [number, number];
}

interface YearlyForecastItem {
  month: string;
  forecast: number;
  upperBound: number;
  lowerBound: number;
  linearForecast: number;
  maForecast: number;
  esForecast: number;
}

// 计算均值
const calculateMean = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
};

// 计算标准差
const calculateStdDev = (values: number[], mean: number): number => {
  if (values.length < 2) return 0;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1));
};

// 简单线性回归
const linearRegression = (data: { x: number; y: number }[]): { slope: number; intercept: number; r2: number } => {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };

  const sumX = data.reduce((sum, d) => sum + d.x, 0);
  const sumY = data.reduce((sum, d) => sum + d.y, 0);
  const sumXY = data.reduce((sum, d) => sum + d.x * d.y, 0);
  const sumX2 = data.reduce((sum, d) => sum + d.x * d.x, 0);
  const sumY2 = data.reduce((sum, d) => sum + d.y * d.y, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R² 计算
  const meanY = sumY / n;
  const ssTotal = data.reduce((sum, d) => sum + Math.pow(d.y - meanY, 2), 0);
  const ssResidual = data.reduce((sum, d) => sum + Math.pow(d.y - (slope * d.x + intercept), 2), 0);
  const r2 = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

  return { slope, intercept, r2 };
};

// 移动平均预测
const movingAverageForecast = (values: number[], windowSize: number = 3): number => {
  if (values.length === 0) return 0;
  const window = values.slice(-windowSize);
  return calculateMean(window);
};

// 指数平滑预测
const exponentialSmoothing = (values: number[], alpha: number = 0.3): number => {
  if (values.length === 0) return 0;
  let forecast = values[0];
  for (let i = 1; i < values.length; i++) {
    forecast = alpha * values[i] + (1 - alpha) * forecast;
  }
  return forecast;
};

export function AnomalyDetectionTab({ data }: AnomalyDetectionTabProps) {
  const { t } = useTranslation();
  const [forecastMonths, setForecastMonths] = useState<number>(1); // 预测月数：1-12
  
  // 人员工时提交情况状态
  const [submissionTeam, setSubmissionTeam] = useState<string>('业务管理及合规检测中心');
  const [submissionPeriod, setSubmissionPeriod] = useState<SubmissionPeriod>('monthly');
  const [submissionYear, setSubmissionYear] = useState<string>(new Date().getFullYear().toString());
  const [submissionPeriodValue, setSubmissionPeriodValue] = useState<string>((new Date().getMonth()).toString());
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  // 自定义模式的年月选择
  const [customStartYear, setCustomStartYear] = useState<string>(new Date().getFullYear().toString());
  const [customStartMonth, setCustomStartMonth] = useState<string>((new Date().getMonth()).toString());
  const [customEndYear, setCustomEndYear] = useState<string>(new Date().getFullYear().toString());
  const [customEndMonth, setCustomEndMonth] = useState<string>((new Date().getMonth()).toString());
  // 获取用户列表和工时数据
  const { users } = useAuth();
  const { leaveRecords } = useTimesheet();

  // 处理月度数据并预测
  const forecastData = useMemo(() => {
    if (!data || data.length === 0) return { chartData: [], prediction: null, stats: null, yearlyForecast: [] };

    // 按月聚合工时
    const monthlyAgg: { [key: string]: number } = {};
    data.forEach(item => {
      if (item.Month && item.Hours) {
        const month = normalizeMonthString(item.Month);
        if (month) {
          monthlyAgg[month] = (monthlyAgg[month] || 0) + (Number(item.Hours) || 0);
        }
      }
    });

    // 排序月份
    const sortedMonths = Object.keys(monthlyAgg).sort();
    if (sortedMonths.length < 3) {
      return { chartData: [], prediction: null, stats: null, yearlyForecast: [] };
    }

    const monthlyValues = sortedMonths.map(m => monthlyAgg[m]);
    const mean = calculateMean(monthlyValues);
    const stdDev = calculateStdDev(monthlyValues, mean);

    // 线性回归预测
    const regressionData = monthlyValues.map((y, i) => ({ x: i + 1, y }));
    const { slope, intercept, r2 } = linearRegression(regressionData);
    
    // 计算残差标准差用于置信区间
    const residuals = monthlyValues.map((y, i) => y - (slope * (i + 1) + intercept));
    const residualStdDev = calculateStdDev(residuals, 0);
    const confidenceMultiplier = 1.96; // 95% 置信区间

    // 生成未来12个月的预测
    const lastMonth = parseMonthString(sortedMonths[sortedMonths.length - 1]);
    const yearlyForecast: YearlyForecastItem[] = [];
    
    if (lastMonth) {
      // 用于移动平均和指数平滑的扩展值数组
      let extendedValues = [...monthlyValues];
      
      for (let i = 1; i <= 12; i++) {
        const nextDate = new Date(lastMonth);
        nextDate.setMonth(nextDate.getMonth() + i);
        const nextMonth = normalizeMonthString(nextDate);
        
        const nextIndex = monthlyValues.length + i;
        const linearForecast = slope * nextIndex + intercept;
        
        // 移动平均 - 使用扩展后的数组
        const maForecast = movingAverageForecast(extendedValues, 3);
        
        // 指数平滑 - 使用扩展后的数组
        const esForecast = exponentialSmoothing(extendedValues, 0.3);
        
        // 综合预测
        const combinedForecast = (linearForecast * 0.4 + maForecast * 0.35 + esForecast * 0.25);
        
        // 置信区间随预测距离扩大
        const distanceFactor = Math.sqrt(i); // 预测越远，不确定性越大
        const upperBound = combinedForecast + confidenceMultiplier * residualStdDev * distanceFactor;
        const lowerBound = Math.max(0, combinedForecast - confidenceMultiplier * residualStdDev * distanceFactor);
        
        yearlyForecast.push({
          month: nextMonth,
          forecast: combinedForecast,
          upperBound,
          lowerBound,
          linearForecast,
          maForecast,
          esForecast,
        });
        
        // 将预测值加入扩展数组，用于后续预测
        extendedValues.push(combinedForecast);
      }
    }

    // 第一个月的预测（向后兼容）
    const firstPrediction = yearlyForecast[0];

    // 构建图表数据 - 包含历史数据和选定的预测月数
    const chartData: MonthlyForecastData[] = sortedMonths.map(month => ({
      month,
      totalHours: monthlyAgg[month],
      isActual: true,
    }));

    // 添加预测数据点（根据选择的月数）
    for (let i = 0; i < forecastMonths && i < yearlyForecast.length; i++) {
      const pred = yearlyForecast[i];
      chartData.push({
        month: pred.month,
        totalHours: 0,
        isActual: false,
        forecast: pred.forecast,
        upperBound: pred.upperBound,
        lowerBound: pred.lowerBound,
        confidenceRange: [pred.lowerBound, pred.upperBound],
      });
    }

    // 添加趋势线数据
    const trendData = chartData.map((item, index) => ({
      ...item,
      trend: slope * (index + 1) + intercept,
    }));

    return {
      chartData: trendData,
      prediction: firstPrediction ? {
        month: firstPrediction.month,
        value: firstPrediction.forecast,
        upperBound: firstPrediction.upperBound,
        lowerBound: firstPrediction.lowerBound,
        linearForecast: firstPrediction.linearForecast,
        maForecast: firstPrediction.maForecast,
        esForecast: firstPrediction.esForecast,
        r2,
      } : null,
      stats: {
        mean,
        stdDev,
        min: Math.min(...monthlyValues),
        max: Math.max(...monthlyValues),
        monthCount: monthlyValues.length,
        slope,
        trend: slope > 0 ? '上升' : slope < 0 ? '下降' : '平稳',
        residualStdDev,
      },
      yearlyForecast,
    };
  }, [data, forecastMonths]);

  // 计算环比变化
  const momChanges = useMemo(() => {
    if (!forecastData.chartData || forecastData.chartData.length < 2) return [];
    
    return forecastData.chartData
      .filter(d => d.isActual)
      .map((item, index, arr) => {
        if (index === 0) return { ...item, momChange: 0, momPercent: 0 };
        const prev = arr[index - 1].totalHours;
        const change = item.totalHours - prev;
        const percent = prev > 0 ? (change / prev) * 100 : 0;
        return { ...item, momChange: change, momPercent: percent };
      });
  }, [forecastData.chartData]);

  // 三个团队列表
  const teamList = ['业务管理及合规检测中心', '投资法务中心', '公司及国际金融事务中心'];
  
  // 获取需要检查的用户列表（排除没有团队归属的admin和exporter）
  const checkableUsers = useMemo(() => {
    return users.filter(u => {
      // 必须有团队归属
      if (!u.team) return false;
      // 排除没有团队归属的admin（系统管理员）
      if (u.role === 'admin' && !u.team) return false;
      // 排除数据导出者
      if (u.role === 'exporter') return false;
      // 包含有团队归属的管理员、管理者和普通用户
      return ['admin', 'manager', 'user'].includes(u.role);
    });
  }, [users]);

  // 计算选定时间范围
  const getDateRange = useMemo(() => {
    const year = parseInt(submissionYear);
    let startDate: Date;
    let endDate: Date;
    
    if (submissionPeriod === 'monthly') {
      const month = parseInt(submissionPeriodValue);
      startDate = new Date(year, month, 1);
      endDate = new Date(year, month + 1, 0);
    } else if (submissionPeriod === 'quarterly') {
      const quarter = parseInt(submissionPeriodValue);
      startDate = new Date(year, quarter * 3, 1);
      endDate = new Date(year, (quarter + 1) * 3, 0);
    } else if (submissionPeriod === 'semiannually') {
      const half = parseInt(submissionPeriodValue);
      startDate = new Date(year, half * 6, 1);
      endDate = new Date(year, (half + 1) * 6, 0);
    } else if (submissionPeriod === 'annually') {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31);
    } else {
      // custom - 使用年月选择器
      const startY = parseInt(customStartYear);
      const startM = parseInt(customStartMonth);
      const endY = parseInt(customEndYear);
      const endM = parseInt(customEndMonth);
      startDate = new Date(startY, startM, 1);
      endDate = new Date(endY, endM + 1, 0);
    }
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
      startDate,
      endDate,
    };
  }, [submissionYear, submissionPeriod, submissionPeriodValue, customStartYear, customStartMonth, customEndYear, customEndMonth]);

  // 从上传数据中提取用户工时信息（基于 data prop）
  const dataBasedUserHours = useMemo(() => {
    // 按用户名和月份汇总工时
    const userMonthlyHours: { [userName: string]: { monthlyHours: { [month: string]: number }; team?: string; group?: string } } = {};
    
    if (!data || data.length === 0) return userMonthlyHours;
    
    data.forEach(row => {
      const userName = row.Name?.toString()?.toLowerCase() || '';
      const month = row.Month?.toString() || '';
      const hours = parseFloat(row.Hours) || 0;
      const team = row['团队']?.toString() || '';
      const sourcePath = row['Source Path']?.toString() || '';
      
      if (!userName || !month) return;
      
      if (!userMonthlyHours[userName]) {
        userMonthlyHours[userName] = { monthlyHours: {}, team };
      }
      
      // 提取小组信息
      if (sourcePath && sourcePath.includes('工时统计-')) {
        userMonthlyHours[userName].group = sourcePath.replace('工时统计-', '').trim();
      }
      
      userMonthlyHours[userName].monthlyHours[month] = (userMonthlyHours[userName].monthlyHours[month] || 0) + hours;
    });
    
    return userMonthlyHours;
  }, [data]);

  // 计算人员工时提交情况（基于上传的数据）
  const userSubmissionData = useMemo((): UserSubmissionStatus[] => {
    const { start, end, startDate, endDate } = getDateRange;
    
    // 从上传数据中获取当前团队的用户列表
    const dataUsers = Object.entries(dataBasedUserHours)
      .filter(([_, info]) => info.team === submissionTeam)
      .map(([userName, info]) => ({
        userName,
        team: info.team || '',
        group: info.group,
      }));
    
    // 如果上传数据中没有该团队的用户，则使用系统用户列表
    const teamUsers = dataUsers.length > 0 
      ? dataUsers 
      : checkableUsers.filter(u => u.team === submissionTeam).map(u => ({
          userName: (u.name || u.username).toLowerCase(),
          team: u.team || '',
          group: undefined,
          userId: u.id,
          region: u.region,
        }));
    
    // 计算每个用户的工时情况
    return teamUsers.map(user => {
      const userNameLower = user.userName.toLowerCase();
      const userHoursData = dataBasedUserHours[userNameLower] || { monthlyHours: {} };
      
      // 获取所有月份的工时数据
      const allMonths = Object.keys(userHoursData.monthlyHours);
      
      // 当前周期的月份范围
      const currentPeriodMonths: string[] = [];
      const tempDate = new Date(startDate);
      while (tempDate <= endDate) {
        const monthStr = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}`;
        currentPeriodMonths.push(monthStr);
        tempDate.setMonth(tempDate.getMonth() + 1);
      }
      
      // 当前周期提交的工时
      const submittedHours = currentPeriodMonths.reduce((sum, month) => {
        return sum + (userHoursData.monthlyHours[month] || 0);
      }, 0);
      
      // 历史月份（排除当前周期）
      const historicalMonths = allMonths.filter(month => {
        const [year, mon] = month.split('-').map(Number);
        const monthDate = new Date(year, mon - 1, 1);
        return monthDate < startDate;
      });
      
      // 计算历史月均
      const historicalValues = historicalMonths.map(month => userHoursData.monthlyHours[month] || 0);
      const historicalAvgHours = historicalValues.length > 0 
        ? historicalValues.reduce((sum, v) => sum + v, 0) / historicalValues.length 
        : 0;
      const historicalStdDev = historicalValues.length > 1 
        ? calculateStdDev(historicalValues, historicalAvgHours) 
        : 0;
      
      // 获取用户的请假天数（从系统用户匹配）
      const systemUser = checkableUsers.find(u => 
        (u.name || u.username).toLowerCase() === userNameLower
      );
      const userLeaveRecords = systemUser ? leaveRecords.filter(r => 
        r.userId === systemUser.id &&
        r.startDate <= end &&
        r.endDate >= start
      ) : [];
      const leaveDays = userLeaveRecords.reduce((sum, r) => sum + r.days, 0);
      
      // 计算当前周期应有的工作日数
      let workdays = 0;
      const region = systemUser?.region || 'CN';
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        workdays += getWorkdaysInMonth(year, month, region);
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
      
      // 扣除请假天数后的预期工时（每天8小时）
      const expectedWorkdays = Math.max(0, workdays - leaveDays);
      const expectedHours = expectedWorkdays * 8;
      
      // 计算偏离度
      let deviation = 0;
      let status: 'normal' | 'warning' | 'anomaly' | 'missing' = 'normal';
      let statusLabel = '正常';
      
      if (submittedHours === 0) {
        status = 'missing';
        statusLabel = '未提交';
        deviation = -100;
      } else if (historicalAvgHours > 0) {
        // 与历史平均对比
        deviation = ((submittedHours - historicalAvgHours) / historicalAvgHours) * 100;
        
        // 使用标准差判断异常
        if (historicalStdDev > 0) {
          const zScore = Math.abs(submittedHours - historicalAvgHours) / historicalStdDev;
          if (zScore > 2) {
            status = 'anomaly';
            statusLabel = deviation > 0 ? '异常偏高' : '异常偏低';
          } else if (zScore > 1) {
            status = 'warning';
            statusLabel = deviation > 0 ? '略高' : '略低';
          }
        } else {
          // 没有足够历史数据时，使用简单百分比判断
          if (Math.abs(deviation) > 50) {
            status = 'anomaly';
            statusLabel = deviation > 0 ? '异常偏高' : '异常偏低';
          } else if (Math.abs(deviation) > 25) {
            status = 'warning';
            statusLabel = deviation > 0 ? '略高' : '略低';
          }
        }
      } else if (expectedHours > 0) {
        // 没有历史数据时，与预期工时对比
        deviation = ((submittedHours - expectedHours) / expectedHours) * 100;
        if (Math.abs(deviation) > 50) {
          status = 'anomaly';
          statusLabel = deviation > 0 ? '异常偏高' : '异常偏低';
        } else if (Math.abs(deviation) > 25) {
          status = 'warning';
          statusLabel = deviation > 0 ? '略高' : '略低';
        }
      }
      
      return {
        userId: systemUser?.id || `data-user-${userNameLower}`,
        userName: user.userName,
        team: user.team,
        group: user.group || userHoursData.group,
        submittedHours,
        historicalAvgHours,
        historicalStdDev,
        status,
        statusLabel,
        deviation,
      };
    }).sort((a, b) => {
      // 排序：未提交 > 异常 > 警告 > 正常
      const statusOrder = { missing: 0, anomaly: 1, warning: 2, normal: 3 };
      return statusOrder[a.status] - statusOrder[b.status];
    });
  }, [data, dataBasedUserHours, checkableUsers, submissionTeam, leaveRecords, getDateRange]);

  // 统计汇总
  const submissionStats = useMemo(() => {
    const total = userSubmissionData.length;
    const missing = userSubmissionData.filter(u => u.status === 'missing').length;
    const anomaly = userSubmissionData.filter(u => u.status === 'anomaly').length;
    const warning = userSubmissionData.filter(u => u.status === 'warning').length;
    const normal = userSubmissionData.filter(u => u.status === 'normal').length;
    const totalHours = userSubmissionData.reduce((sum, u) => sum + u.submittedHours, 0);
    
    return { total, missing, anomaly, warning, normal, totalHours };
  }, [userSubmissionData]);

  // 可用年份列表
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());
  }, []);

  // 计算年度预测汇总 - 必须在条件返回之前调用
  const yearlyStats = useMemo(() => {
    const yearlyForecast = forecastData.yearlyForecast;
    if (!yearlyForecast || yearlyForecast.length === 0) return null;
    
    const selectedForecasts = yearlyForecast.slice(0, forecastMonths);
    const totalForecast = selectedForecasts.reduce((sum, f) => sum + f.forecast, 0);
    const avgForecast = totalForecast / selectedForecasts.length;
    const totalUpperBound = selectedForecasts.reduce((sum, f) => sum + f.upperBound, 0);
    const totalLowerBound = selectedForecasts.reduce((sum, f) => sum + f.lowerBound, 0);
    
    return {
      totalForecast,
      avgForecast,
      totalUpperBound,
      totalLowerBound,
      monthCount: selectedForecasts.length,
    };
  }, [forecastData.yearlyForecast, forecastMonths]);

  // 条件返回 - 所有 hooks 已在此之前调用
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-neutral-500">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-lg font-medium">{t('dashboard.empty.title')}</p>
          <p className="text-sm text-neutral-400 mt-1">{t('dashboard.empty.anomalySubtitle')}</p>
        </div>
      </div>
    );
  }

  if (!forecastData.prediction) {
    return (
      <div className="flex items-center justify-center h-64 text-neutral-500">
        <div className="text-center">
          <p className="text-lg font-medium">数据不足</p>
          <p className="text-sm text-neutral-400 mt-1">需要至少3个月的数据才能进行预测分析</p>
        </div>
      </div>
    );
  }

  const { prediction, stats, yearlyForecast } = forecastData;

  return (
    <div className="space-y-8">
      {/* 工时预测维度 */}
      <div className="space-y-6">
        {/* 维度标题 */}
        <div className="flex items-center gap-3 animate-fade-in-up">
          <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></div>
          <div>
            <h2 className="text-xl font-bold text-neutral-900">工时预测分析</h2>
            <p className="text-sm text-neutral-500 mt-0.5">基于历史数据预测未来工时趋势</p>
          </div>
        </div>

        {/* 预测月数选择器 */}
        <div className="flex items-center justify-between animate-fade-in-up">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-neutral-600">预测范围:</span>
            <div className="flex items-center gap-1 p-1 bg-neutral-100/80 rounded-full">
              {[1, 3, 6, 12].map((months) => (
                <button
                  key={months}
                  onClick={() => setForecastMonths(months)}
                  className={cn(
                    "px-4 py-2 text-xs font-medium rounded-full transition-colors duration-75",
                    "cursor-pointer select-none touch-manipulation",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400",
                    forecastMonths === months
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-700 hover:bg-white/60"
                  )}
                >
                  {months === 1 ? '次月' : months === 12 ? '未来一年' : `${months}个月`}
                </button>
              ))}
            </div>
          </div>
          {yearlyStats && forecastMonths > 1 && (
            <div className="flex items-center gap-6 text-sm">
              <div className="text-neutral-500">
                预测总工时: <span className="font-semibold text-neutral-800">{yearlyStats.totalForecast.toFixed(0)}</span> 小时
              </div>
              <div className="text-neutral-500">
                月均预测: <span className="font-semibold text-neutral-800">{yearlyStats.avgForecast.toFixed(0)}</span> 小时
              </div>
            </div>
          )}
        </div>

        {/* 预测概览卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-fade-in-up">
        <Card className="card-premium bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-blue-700">
              {forecastMonths === 1 ? '次月预测工时' : `${forecastMonths}个月预测总工时`}
            </CardTitle>
            <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900">
              {forecastMonths === 1 
                ? (prediction?.value?.toFixed(0) ?? '-')
                : (yearlyStats?.totalForecast?.toFixed(0) ?? '-')}
            </div>
            <p className="text-xs text-blue-600 mt-1 font-medium">
              {forecastMonths === 1 
                ? (prediction?.month ?? '-')
                : `${yearlyForecast[0]?.month ?? '-'} - ${yearlyForecast[forecastMonths - 1]?.month ?? '-'}`}
            </p>
          </CardContent>
        </Card>

        <Card className="card-premium bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-emerald-700">95% 置信区间</CardTitle>
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-900">
              {forecastMonths === 1 
                ? `${prediction?.lowerBound?.toFixed(0) ?? '-'} - ${prediction?.upperBound?.toFixed(0) ?? '-'}`
                : `${yearlyStats?.totalLowerBound?.toFixed(0) ?? '-'} - ${yearlyStats?.totalUpperBound?.toFixed(0) ?? '-'}`}
            </div>
            <p className="text-xs text-emerald-600 mt-1 font-medium">
              区间宽度: {forecastMonths === 1 
                ? (prediction ? (prediction.upperBound - prediction.lowerBound).toFixed(0) : '-')
                : (yearlyStats ? (yearlyStats.totalUpperBound - yearlyStats.totalLowerBound).toFixed(0) : '-')} 小时
            </p>
          </CardContent>
        </Card>

        <Card className="card-premium bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-amber-700">历史均值</CardTitle>
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-900">{stats?.mean?.toFixed(0) ?? '-'}</div>
            <p className="text-xs text-amber-600 mt-1 font-medium">
              标准差: ±{stats?.stdDev?.toFixed(0) ?? '-'}
            </p>
          </CardContent>
        </Card>

        <Card className="card-premium bg-gradient-to-br from-purple-50 to-pink-50 border-purple-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-purple-700">趋势方向</CardTitle>
            <svg className={`w-5 h-5 ${stats?.slope && stats.slope > 0 ? 'text-emerald-500' : stats?.slope && stats.slope < 0 ? 'text-rose-500' : 'text-neutral-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {stats?.slope && stats.slope > 0 ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              ) : stats?.slope && stats.slope < 0 ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
              )}
            </svg>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${stats?.slope && stats.slope > 0 ? 'text-emerald-600' : stats?.slope && stats.slope < 0 ? 'text-rose-600' : 'text-neutral-600'}`}>
              {stats?.trend}
            </div>
            <p className="text-xs text-purple-600 mt-1 font-medium">
              R² = {(prediction.r2 * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 预测图表 */}
      <Card className="card-premium animate-fade-in-up">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-neutral-900">
                {forecastMonths === 1 ? '次月工时预测' : `未来${forecastMonths}个月工时预测`}
              </CardTitle>
              <p className="text-sm text-neutral-500 mt-1">基于历史数据的综合预测模型（线性回归 + 移动平均 + 指数平滑）</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-neutral-600">实际工时</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-neutral-600">预测值</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-amber-500" style={{ width: 12 }}></div>
                <span className="text-neutral-600">趋势线</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200"></div>
                <span className="text-neutral-600">置信区间</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={forecastData.chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <defs>
                <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis 
                dataKey="month" 
                stroke="rgba(0,0,0,0.4)" 
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={{ stroke: 'rgba(0,0,0,0.1)' }}
                angle={forecastMonths > 6 ? -45 : 0}
                textAnchor={forecastMonths > 6 ? "end" : "middle"}
                height={forecastMonths > 6 ? 60 : 30}
              />
              <YAxis 
                stroke="rgba(0,0,0,0.4)" 
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickLine={{ stroke: 'rgba(0,0,0,0.1)' }}
                label={{ value: '工时 (小时)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#64748b' }, dx: -10 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255,255,255,0.95)', 
                  border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    totalHours: '实际工时',
                    forecast: '预测工时',
                    trend: '趋势线',
                    upperBound: '置信上限',
                    lowerBound: '置信下限',
                  };
                  return [value.toFixed(1), labels[name] || name];
                }}
              />
              <Legend />
              
              {/* 置信区间上限 */}
              <Area
                type="monotone"
                dataKey="upperBound"
                stroke="none"
                fill="url(#confidenceGradient)"
                name="置信上限"
                dot={false}
                activeDot={false}
              />
              
              {/* 置信区间下限线 */}
              <Line 
                type="monotone" 
                dataKey="lowerBound" 
                name="置信下限" 
                stroke="#10b981" 
                strokeWidth={1}
                strokeDasharray="3 3"
                dot={false}
                opacity={0.5}
              />
              
              {/* 历史均值参考线 */}
              {stats?.mean != null && (
                <ReferenceLine 
                  y={stats.mean} 
                  stroke="#94a3b8" 
                  strokeDasharray="5 5" 
                  label={{ value: `均值: ${stats.mean.toFixed(0)}`, position: 'right', fill: '#64748b', fontSize: 11 }}
                />
              )}
              
              {/* 实际工时柱状图 */}
              <Bar 
                dataKey="totalHours" 
                name="实际工时" 
                fill="#3b82f6" 
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
              />
              
              {/* 预测值 */}
              <Bar 
                dataKey="forecast" 
                name="预测工时" 
                fill="#10b981" 
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
              />
              
              {/* 趋势线 */}
              <Line 
                type="monotone" 
                dataKey="trend" 
                name="趋势线" 
                stroke="#f59e0b" 
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 未来12个月预测明细表 - 仅在选择多月预测时显示 */}
      {forecastMonths > 1 && yearlyForecast.length > 0 && (
        <Card className="card-premium animate-fade-in-up">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-neutral-900">
              未来{forecastMonths}个月预测明细
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="text-left py-3 px-4 font-semibold text-neutral-600">月份</th>
                    <th className="text-right py-3 px-4 font-semibold text-neutral-600">综合预测</th>
                    <th className="text-right py-3 px-4 font-semibold text-neutral-600">线性回归</th>
                    <th className="text-right py-3 px-4 font-semibold text-neutral-600">移动平均</th>
                    <th className="text-right py-3 px-4 font-semibold text-neutral-600">指数平滑</th>
                    <th className="text-right py-3 px-4 font-semibold text-neutral-600">置信下限</th>
                    <th className="text-right py-3 px-4 font-semibold text-neutral-600">置信上限</th>
                  </tr>
                </thead>
                <tbody>
                  {yearlyForecast.slice(0, forecastMonths).map((item, index) => (
                    <tr key={item.month} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                      <td className="py-3 px-4 font-medium text-neutral-800">{item.month}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-600">{item.forecast.toFixed(0)}</td>
                      <td className="py-3 px-4 text-right font-mono text-neutral-600">{item.linearForecast.toFixed(0)}</td>
                      <td className="py-3 px-4 text-right font-mono text-neutral-600">{item.maForecast.toFixed(0)}</td>
                      <td className="py-3 px-4 text-right font-mono text-neutral-600">{item.esForecast.toFixed(0)}</td>
                      <td className="py-3 px-4 text-right font-mono text-neutral-500">{item.lowerBound.toFixed(0)}</td>
                      <td className="py-3 px-4 text-right font-mono text-neutral-500">{item.upperBound.toFixed(0)}</td>
                    </tr>
                  ))}
                  {/* 汇总行 */}
                  <tr className="bg-neutral-50 font-semibold">
                    <td className="py-3 px-4 text-neutral-800">合计</td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700">
                      {yearlyForecast.slice(0, forecastMonths).reduce((sum, f) => sum + f.forecast, 0).toFixed(0)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-neutral-700">
                      {yearlyForecast.slice(0, forecastMonths).reduce((sum, f) => sum + f.linearForecast, 0).toFixed(0)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-neutral-700">
                      {yearlyForecast.slice(0, forecastMonths).reduce((sum, f) => sum + f.maForecast, 0).toFixed(0)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-neutral-700">
                      {yearlyForecast.slice(0, forecastMonths).reduce((sum, f) => sum + f.esForecast, 0).toFixed(0)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-neutral-600">
                      {yearlyForecast.slice(0, forecastMonths).reduce((sum, f) => sum + f.lowerBound, 0).toFixed(0)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-neutral-600">
                      {yearlyForecast.slice(0, forecastMonths).reduce((sum, f) => sum + f.upperBound, 0).toFixed(0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 预测方法详情 */}
      {prediction && (
        <div className="grid gap-4 md:grid-cols-3 animate-fade-in-up">
          <Card className="card-premium">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                线性回归预测
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neutral-900">{prediction.linearForecast.toFixed(0)}</div>
              <p className="text-xs text-neutral-500 mt-2">
                基于历史趋势的线性外推，权重 40%
              </p>
              <div className="mt-3 pt-3 border-t border-neutral-100">
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500">斜率</span>
                  <span className="font-medium text-neutral-700">{stats?.slope?.toFixed(2) ?? '-'}/月</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-premium">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                移动平均预测
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neutral-900">{prediction.maForecast.toFixed(0)}</div>
              <p className="text-xs text-neutral-500 mt-2">
                近3个月移动平均，权重 35%
              </p>
              <div className="mt-3 pt-3 border-t border-neutral-100">
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500">窗口大小</span>
                  <span className="font-medium text-neutral-700">3 个月</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-premium">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                指数平滑预测
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neutral-900">{prediction.esForecast.toFixed(0)}</div>
              <p className="text-xs text-neutral-500 mt-2">
                加权历史数据，权重 25%
              </p>
              <div className="mt-3 pt-3 border-t border-neutral-100">
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500">平滑系数 α</span>
                  <span className="font-medium text-neutral-700">0.3</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 预测维度底部汇总卡片 */}
      {(stats || prediction) && (
        <Card className="card-premium animate-fade-in-up bg-gradient-to-r from-slate-50 to-blue-50/30 border-slate-200">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500 font-medium">历史数据</div>
                    <div className="text-lg font-bold text-neutral-900">{stats?.monthCount ?? 0} 个月</div>
                  </div>
                </div>
                <div className="w-px h-10 bg-neutral-200"></div>
                <div>
                  <div className="text-xs text-neutral-500 font-medium">历史月均工时</div>
                  <div className="text-lg font-bold text-neutral-900">{stats?.mean?.toFixed(0) ?? '-'} <span className="text-sm font-normal text-neutral-500">小时</span></div>
                </div>
                <div className="w-px h-10 bg-neutral-200"></div>
                <div>
                  <div className="text-xs text-neutral-500 font-medium">波动范围</div>
                  <div className="text-lg font-bold text-neutral-900">{stats?.min?.toFixed(0) ?? '-'} - {stats?.max?.toFixed(0) ?? '-'} <span className="text-sm font-normal text-neutral-500">小时</span></div>
                </div>
                <div className="w-px h-10 bg-neutral-200"></div>
                <div>
                  <div className="text-xs text-neutral-500 font-medium">模型拟合度 R²</div>
                  <div className="text-lg font-bold text-neutral-900">{prediction ? (prediction.r2 * 100).toFixed(1) : '-'}%</div>
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-neutral-200">
                <span className={`w-2 h-2 rounded-full ${stats?.slope && stats.slope > 0 ? 'bg-emerald-500' : stats?.slope && stats.slope < 0 ? 'bg-rose-500' : 'bg-neutral-400'}`}></span>
                <span className="text-sm font-medium text-neutral-700">
                  趋势: <span className={stats?.slope && stats.slope > 0 ? 'text-emerald-600' : stats?.slope && stats.slope < 0 ? 'text-rose-600' : 'text-neutral-600'}>{stats?.trend ?? '-'}</span>
                </span>
                <span className="text-xs text-neutral-400">({stats?.slope && stats.slope > 0 ? '+' : ''}{stats?.slope?.toFixed(1) ?? '-'}/月)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
      {/* 月度环比变化表 */}
      <Card className="card-premium animate-fade-in-up">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-gradient-to-b from-amber-500 to-orange-600 rounded-full"></div>
            <CardTitle className="text-lg font-semibold text-neutral-900">历史月度环比变化</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-3 px-4 font-semibold text-neutral-600">月份</th>
                  <th className="text-right py-3 px-4 font-semibold text-neutral-600">总工时</th>
                  <th className="text-right py-3 px-4 font-semibold text-neutral-600">环比变化</th>
                  <th className="text-right py-3 px-4 font-semibold text-neutral-600">环比率</th>
                  <th className="text-center py-3 px-4 font-semibold text-neutral-600">状态</th>
                </tr>
              </thead>
              <tbody>
                {momChanges.map((item, index) => {
                  const isAnomaly = stats && Math.abs(item.momPercent) > 2 * (stats.stdDev / stats.mean * 100);
                  return (
                    <tr key={item.month} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                      <td className="py-3 px-4 font-medium text-neutral-800">{item.month}</td>
                      <td className="py-3 px-4 text-right font-mono text-neutral-700">{item.totalHours.toFixed(1)}</td>
                      <td className={`py-3 px-4 text-right font-mono ${item.momChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {index === 0 ? '-' : `${item.momChange >= 0 ? '+' : ''}${item.momChange.toFixed(1)}`}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono ${item.momPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {index === 0 ? '-' : `${item.momPercent >= 0 ? '+' : ''}${item.momPercent.toFixed(1)}%`}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {index === 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600">
                            基准
                          </span>
                        ) : isAnomaly ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            异常波动
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                            正常
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 人员工时提交情况 */}
      <div className="space-y-6">
        {/* 维度标题 */}
        <div className="flex items-center gap-3 animate-fade-in-up">
          <div className="w-1 h-8 bg-gradient-to-b from-violet-500 to-purple-600 rounded-full"></div>
          <div>
            <h2 className="text-xl font-bold text-neutral-900">人员工时提交情况</h2>
            <p className="text-sm text-neutral-500 mt-0.5">监测个人工时提交状态与异常情况</p>
          </div>
        </div>

        {/* 团队Tab切换 */}
        <Tabs value={submissionTeam} onValueChange={setSubmissionTeam} className="animate-fade-in-up">
          <div className="flex flex-col gap-4">
            <TabsList className="flex h-auto items-center justify-start gap-1 bg-neutral-100/80 p-1 rounded-full w-fit">
              {teamList.map((team) => (
                <TabsTrigger
                  key={team}
                  value={team}
                  className={cn(
                    "px-4 py-2 text-xs font-medium rounded-full transition-colors duration-75",
                    "data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm",
                    "text-neutral-500 hover:text-neutral-700"
                  )}
                >
                  {team.replace('中心', '')}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* 时间筛选器 - 左对齐 */}
            <div className="flex items-center gap-6">
              {/* PERIOD 标签和周期选项 */}
              <div className="flex items-center gap-4">
                <span className="text-xs font-medium text-neutral-400 tracking-wider">PERIOD</span>
                <div className="flex items-center bg-neutral-100/80 rounded-full p-1">
                  {(['monthly', 'quarterly', 'semiannually', 'annually', 'custom'] as SubmissionPeriod[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setSubmissionPeriod(p);
                        if (p === 'annually') setSubmissionPeriodValue('0');
                        else if (p === 'semiannually') setSubmissionPeriodValue('0');
                        else if (p === 'quarterly') setSubmissionPeriodValue(Math.floor(new Date().getMonth() / 3).toString());
                        else if (p === 'monthly') setSubmissionPeriodValue(new Date().getMonth().toString());
                      }}
                      className={cn(
                        "px-4 py-2 text-sm font-medium rounded-full transition-all duration-150",
                        submissionPeriod === p
                          ? "bg-white text-neutral-900 shadow-sm"
                          : "text-neutral-500 hover:text-neutral-700"
                      )}
                    >
                      {p === 'monthly' ? '月度' : p === 'quarterly' ? '季度' : p === 'semiannually' ? '半年度' : p === 'annually' ? '年度' : '自定义'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 年份和月份/季度/半年度选择 - 非自定义模式 */}
              {submissionPeriod !== 'custom' && (
                <div className="flex items-center gap-2">
                  {/* 年份选择 */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1.5 text-xl font-semibold text-neutral-800 hover:text-neutral-600 transition-colors">
                        {submissionYear}
                        <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-32 p-2 bg-white shadow-lg border border-neutral-200" align="start">
                      <div className="space-y-1">
                        {availableYears.map((year) => (
                          <button
                            key={year}
                            onClick={() => setSubmissionYear(year)}
                            className={cn(
                              "w-full px-3 py-2 text-sm rounded-lg text-left transition-colors",
                              submissionYear === year
                                ? "bg-neutral-900 text-white"
                                : "text-neutral-600 hover:bg-neutral-100"
                            )}
                          >
                            {year}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <span className="text-neutral-300 mx-1">·</span>

                  {/* 月份选择 */}
                  {submissionPeriod === 'monthly' && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-1.5 text-xl font-semibold text-neutral-800 hover:text-neutral-600 transition-colors">
                          {parseInt(submissionPeriodValue) + 1}月
                          <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-2 bg-white shadow-lg border border-neutral-200" align="start">
                        <div className="grid grid-cols-3 gap-1">
                          {Array.from({ length: 12 }, (_, i) => (
                            <button
                              key={i}
                              onClick={() => setSubmissionPeriodValue(i.toString())}
                              className={cn(
                                "px-2 py-2 text-sm rounded-lg text-center transition-colors",
                                submissionPeriodValue === i.toString()
                                  ? "bg-neutral-900 text-white"
                                  : "text-neutral-600 hover:bg-neutral-100"
                              )}
                            >
                              {i + 1}月
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}

                  {/* 季度选择 */}
                  {submissionPeriod === 'quarterly' && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-1.5 text-xl font-semibold text-neutral-800 hover:text-neutral-600 transition-colors">
                          Q{parseInt(submissionPeriodValue) + 1}
                          <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-32 p-2 bg-white shadow-lg border border-neutral-200" align="start">
                        <div className="space-y-1">
                          {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => (
                            <button
                              key={q}
                              onClick={() => setSubmissionPeriodValue(i.toString())}
                              className={cn(
                                "w-full px-3 py-2 text-sm rounded-lg text-left transition-colors",
                                submissionPeriodValue === i.toString()
                                  ? "bg-neutral-900 text-white"
                                  : "text-neutral-600 hover:bg-neutral-100"
                              )}
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}

                  {/* 半年度选择 */}
                  {submissionPeriod === 'semiannually' && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-1.5 text-xl font-semibold text-neutral-800 hover:text-neutral-600 transition-colors">
                          {submissionPeriodValue === '0' ? '上半年' : '下半年'}
                          <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-32 p-2 bg-white shadow-lg border border-neutral-200" align="start">
                        <div className="space-y-1">
                          {['上半年', '下半年'].map((h, i) => (
                            <button
                              key={h}
                              onClick={() => setSubmissionPeriodValue(i.toString())}
                              className={cn(
                                "w-full px-3 py-2 text-sm rounded-lg text-left transition-colors",
                                submissionPeriodValue === i.toString()
                                  ? "bg-neutral-900 text-white"
                                  : "text-neutral-600 hover:bg-neutral-100"
                              )}
                            >
                              {h}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              )}

              {/* 自定义日期范围 - 使用年月下拉选择器 */}
              {submissionPeriod === 'custom' && (
                <div className="flex items-center gap-3">
                  {/* 开始年份 */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1 text-lg font-medium text-neutral-700 hover:text-neutral-900 transition-colors">
                        {customStartYear || '----'}
                        <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-32 p-2 bg-white shadow-lg border border-neutral-200" align="start">
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {availableYears.map((year) => (
                          <button
                            key={year}
                            onClick={() => setCustomStartYear(year)}
                            className={cn(
                              "w-full px-3 py-2 text-sm rounded-lg text-left transition-colors",
                              customStartYear === year
                                ? "bg-neutral-900 text-white"
                                : "text-neutral-600 hover:bg-neutral-100"
                            )}
                          >
                            {year}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* 开始月份 */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1 text-lg font-medium text-neutral-700 hover:text-neutral-900 transition-colors">
                        {customStartMonth ? `${parseInt(customStartMonth) + 1}月` : '--'}
                        <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-2 bg-white shadow-lg border border-neutral-200" align="start">
                      <div className="grid grid-cols-3 gap-1">
                        {Array.from({ length: 12 }, (_, i) => (
                          <button
                            key={i}
                            onClick={() => setCustomStartMonth(i.toString())}
                            className={cn(
                              "px-2 py-2 text-sm rounded-lg text-center transition-colors",
                              customStartMonth === i.toString()
                                ? "bg-neutral-900 text-white"
                                : "text-neutral-600 hover:bg-neutral-100"
                            )}
                          >
                            {i + 1}月
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <span className="text-neutral-400 text-sm mx-1">至</span>

                  {/* 结束年份 */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1 text-lg font-medium text-neutral-700 hover:text-neutral-900 transition-colors">
                        {customEndYear || '----'}
                        <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-32 p-2 bg-white shadow-lg border border-neutral-200" align="start">
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {availableYears.map((year) => (
                          <button
                            key={year}
                            onClick={() => setCustomEndYear(year)}
                            className={cn(
                              "w-full px-3 py-2 text-sm rounded-lg text-left transition-colors",
                              customEndYear === year
                                ? "bg-neutral-900 text-white"
                                : "text-neutral-600 hover:bg-neutral-100"
                            )}
                          >
                            {year}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* 结束月份 */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1 text-lg font-medium text-neutral-700 hover:text-neutral-900 transition-colors">
                        {customEndMonth ? `${parseInt(customEndMonth) + 1}月` : '--'}
                        <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-2 bg-white shadow-lg border border-neutral-200" align="start">
                      <div className="grid grid-cols-3 gap-1">
                        {Array.from({ length: 12 }, (_, i) => (
                          <button
                            key={i}
                            onClick={() => setCustomEndMonth(i.toString())}
                            className={cn(
                              "px-2 py-2 text-sm rounded-lg text-center transition-colors",
                              customEndMonth === i.toString()
                                ? "bg-neutral-900 text-white"
                                : "text-neutral-600 hover:bg-neutral-100"
                            )}
                          >
                            {i + 1}月
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          </div>

          {/* 统计概览卡片 */}
          <div className="grid gap-4 md:grid-cols-5 mt-6">
            <Card className="card-premium bg-gradient-to-br from-slate-50 to-neutral-50 border-slate-200">
              <CardContent className="pt-4 pb-3">
                <div className="text-2xl font-bold text-neutral-900">{submissionStats.total}</div>
                <p className="text-xs text-neutral-500 mt-1 font-medium">总人数</p>
              </CardContent>
            </Card>
            <Card className="card-premium bg-gradient-to-br from-rose-50 to-red-50 border-rose-200">
              <CardContent className="pt-4 pb-3">
                <div className="text-2xl font-bold text-rose-600">{submissionStats.missing}</div>
                <p className="text-xs text-rose-500 mt-1 font-medium">未提交</p>
              </CardContent>
            </Card>
            <Card className="card-premium bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
              <CardContent className="pt-4 pb-3">
                <div className="text-2xl font-bold text-amber-600">{submissionStats.anomaly}</div>
                <p className="text-xs text-amber-500 mt-1 font-medium">异常</p>
              </CardContent>
            </Card>
            <Card className="card-premium bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
              <CardContent className="pt-4 pb-3">
                <div className="text-2xl font-bold text-yellow-600">{submissionStats.warning}</div>
                <p className="text-xs text-yellow-500 mt-1 font-medium">警告</p>
              </CardContent>
            </Card>
            <Card className="card-premium bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200">
              <CardContent className="pt-4 pb-3">
                <div className="text-2xl font-bold text-emerald-600">{submissionStats.normal}</div>
                <p className="text-xs text-emerald-500 mt-1 font-medium">正常</p>
              </CardContent>
            </Card>
          </div>

          {/* 人员列表 */}
          {teamList.map((team) => (
            <TabsContent key={team} value={team} className="mt-6">
              <Card className="card-premium">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-neutral-900">
                      {team} - 人员工时提交明细
                    </CardTitle>
                    <div className="text-sm text-neutral-500">
                      共 <span className="font-semibold text-neutral-700">{userSubmissionData.length}</span> 人 · 
                      总工时 <span className="font-semibold text-neutral-700">{submissionStats.totalHours.toFixed(1)}</span> 小时
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {userSubmissionData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                      <svg className="w-12 h-12 mb-3 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <p className="text-sm font-medium">该团队暂无需检查的人员</p>
                      <p className="text-xs mt-1">请确认用户列表中已配置团队归属</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-neutral-200">
                            <th className="text-left py-3 px-4 font-semibold text-neutral-600">姓名</th>
                            {team === '投资法务中心' && (
                              <th className="text-left py-3 px-4 font-semibold text-neutral-600">组</th>
                            )}
                            <th className="text-right py-3 px-4 font-semibold text-neutral-600">当期已提交工时</th>
                            <th className="text-right py-3 px-4 font-semibold text-neutral-600">历史月均</th>
                            <th className="text-right py-3 px-4 font-semibold text-neutral-600">偏离度</th>
                            <th className="text-center py-3 px-4 font-semibold text-neutral-600">状态</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userSubmissionData.map((user) => (
                            <tr key={user.userId} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                              <td className="py-3 px-4 font-medium text-neutral-800">{user.userName}</td>
                              {team === '投资法务中心' && (
                                <td className="py-3 px-4 text-neutral-600">{user.group || '-'}</td>
                              )}
                              <td className="py-3 px-4 text-right font-mono text-neutral-700">
                                {user.submittedHours.toFixed(1)} h
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-neutral-500">
                                {user.historicalAvgHours > 0 ? `${user.historicalAvgHours.toFixed(1)} h` : '-'}
                              </td>
                              <td className={cn(
                                "py-3 px-4 text-right font-mono",
                                user.deviation > 0 ? "text-emerald-600" : user.deviation < 0 ? "text-rose-600" : "text-neutral-500"
                              )}>
                                {user.status === 'missing' ? '-' : `${user.deviation >= 0 ? '+' : ''}${user.deviation.toFixed(1)}%`}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={cn(
                                  "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                                  user.status === 'normal' && "bg-emerald-100 text-emerald-700",
                                  user.status === 'warning' && "bg-yellow-100 text-yellow-700",
                                  user.status === 'anomaly' && "bg-amber-100 text-amber-700",
                                  user.status === 'missing' && "bg-rose-100 text-rose-700"
                                )}>
                                  {user.statusLabel}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
