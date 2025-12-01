# 工时数据看板 (Dashboard) 技术实现文档

## 1. 项目概述
本项目是一个基于 React + Tailwind CSS + Recharts 的工时数据可视化看板。它支持 Excel 数据导入，并提供多维度的工时分析，包括部门总览、团队维度（投资法务中心/公司及国际金融事务中心）以及项目维度的深入分析。

## 2. 核心技术栈
- **前端框架**: React (Vite)
- **UI 组件库**: Shadcn/UI (基于 Radix UI)
- **样式库**: Tailwind CSS
- **图表库**: Recharts
- **数据处理**: XLSX (SheetJS), date-fns
- **工具库**: lucide-react (图标)

## 3. 目录结构
主要组件位于 `src/components/dashboard/` 目录下：

- `DashboardPage.tsx`: 页面入口，处理文件上传和顶级 Tab 切换（部门总览/分团队预览）。
- `TeamDimensionTab.tsx`: "分团队预览"的核心组件，包含两个子面板：
    - `InvestmentLegalCenterPanel`: 投资法务中心分析面板。
    - `CorporateFinancePanel`: 公司及国际金融事务中心分析面板。
    - 包含通用的 `FilterSection`, `PeriodFilter`, `DetailsDialog` 组件。
- `ProjectDimensionTab.tsx`: "项目维度"分析组件（注：该文件存在，但在当前 DashboardPage 中主要被用作子 Tab 或独立视图，视具体业务逻辑而定）。
- `MonthPicker.tsx`: 自定义月份选择器组件。

## 4. 核心功能与实现细节

### 4.1 数据流与状态管理
- **数据源**: 用户上传 Excel (`.xlsx`, `.xls`) 文件。
- **解析**: `DashboardPage` 使用 `XLSX.read` 解析文件，将原始 JSON 数据存储在 `rawData` 状态中。
- **数据分发**: `rawData` 通过 props 传递给子组件 (`TeamDimensionTab`, `DepartmentOverviewTab`)。
- **组件内状态**: 各分析面板内部维护自己的筛选状态（如 `period`, `selectedYear` 等），利用 `useMemo` 基于原始数据实时计算图表所需的数据结构。

### 4.2 TeamDimensionTab 组件 (TeamDimensionTab.tsx)
这是本次优化的重点组件。

#### 4.2.1 布局与导航
- **现代化 UI**: 采用吸顶式导航栏 (`sticky top-0`)，通过 `backdrop-blur` 实现毛玻璃效果。
- **Tab 切换**: 使用 Shadcn Tabs 组件，定制了 Pill 样式的切换器，带有平滑过渡动画。
- **响应式**: 使用 `container mx-auto max-w-7xl` 控制最大宽度，适配大屏显示。

#### 4.2.2 筛选器逻辑 (FilterSection)
- **复用性**: 封装了 `FilterSection` 组件，统一处理时间筛选逻辑。
- **筛选维度**: 支持 月度、季度、半年度、年度、自定义时间段。
- **智能默认值**: 根据数据自动推断最新的年份和月份作为默认选中项。
- **数据过滤**: 内部使用 `date-fns` 比较日期，筛选出符合条件的 `filteredData` 并计算 `totalHours`，通过 Render Props 模式传递给子组件进行渲染。

#### 4.2.3 图表交互 - 点击穿透 (Drill-down)
- **需求**: 点击饼图/柱状图查看底层详细数据。
- **实现**:
    - **DealCategoryPieChartSection**: 处理 "Investment Legal Hours Allocation by Deal/Matters Categories" 模块。
    - **BSCPieChartSection**: 处理 BSC 维度模块。
    - **DetailsDialog**: 通用弹窗组件，接收数据数组并以表格形式展示。支持键盘 `Esc` 关闭。
    - **交互逻辑**: Recharts 的 `Pie` 组件绑定 `onClick` 事件，获取点击扇区的 `name`，反向过滤原始数据，打开 `DetailsDialog` 展示详情。

#### 4.2.4 关键数据指标计算
- **工时聚合**: 使用 JavaScript `reduce` 或 `forEach` 遍历数据行，根据 `Deal/Matter Category`、`Virtual Group` 等字段累加 `Hours`。
- **人均工时**: 结合 `getWorkdaysInMonth` (计算当月工作日) 和 `20.83` (标准人月天数) 系数，计算标准化的人均工时。
    - 公式: `(总工时 / 活跃人数) * (20.83 / 当月工作日)`
    - 区分地区: 投资法务中心使用 CN 日历，公司金融中心使用 HK 日历。

### 4.3 ProjectDimensionTab 组件 (ProjectDimensionTab.tsx)
- 提供基于项目的深度分析，包括热力图 (Heatmap) 和散点图 (Scatter Chart)。
- **热力图**: 展示 `Internal Client` (列) 与 `Virtual Groups` (行) 的交叉工时分布，通过颜色深浅表示工时多少。
- **散点图**: 展示项目工时分布，X 轴为分类，Y 轴为工时，用于发现异常值或主要耗时项目。

## 5. 样式规范 (Tailwind CSS)
- **颜色**:
  - 主色: Blue-500 (`#3b82f6`) / Blue-700 (`#1d4ed8`)
  - 背景: Slate-50 (`bg-slate-50/50`)
  - 边框: Slate-200 (`border-slate-200`)
- **卡片**: 统一使用 `border-slate-200/60 shadow-sm hover:shadow-md transition-all` 风格。
- **字体**: 默认 sans-serif，强调数字展示。

## 6. 后续优化建议
- **性能**: 对于极大数据量，考虑将 Excel 解析放在 Web Worker 中进行。
- **类型安全**: 完善 `any` 类型的定义，建立完整的 `TimeEntry` 接口。
- **配置化**: 将硬编码的分类名称（如 "Investment Related - IPO"）提取到配置文件中。
