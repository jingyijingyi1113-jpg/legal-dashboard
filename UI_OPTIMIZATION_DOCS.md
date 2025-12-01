# UI 优化技术文档 - 导航与布局升级 v2

## 1. 概述
本次更新针对 `DashboardPage` 和 `TeamDimensionTab` 组件进行了深度视觉分层设计，实现了类似现代文档平台（如飞书/Notion/知乎）的双层导航体系。

## 2. 导航设计规范

### 2.1 一级导航 (DashboardPage)
用于区分主要功能模块（部门总览 vs 分团队预览）。
- **视觉风格**：
  - **字体**：17px (`text-[17px]`)，半粗体 (`font-semibold`)，深灰 (`text-gray-700`)。
  - **激活状态**：
    - 底部指示器：3px 蓝色实线 (`border-b-[3px] border-[#3b82f6]`)。
    - 文字颜色：主题蓝 (`text-[#3b82f6]`)。
  - **交互**：
    - 悬停时文字加深 (`hover:text-black`)。
    - 点击区域高度 `h-14` (56px)。
- **布局特性**：
  - 吸顶 (`sticky top-0`)。
  - 背景透明，但在滚动时依靠父容器背景。

### 2.2 二级导航 (子页面内部)
用于模块内部的维度切换（如：工时维度/项目维度，或不同团队中心）。
- **视觉风格**：
  - **字体**：14px (`text-sm`)，常规字重 (`font-normal`)，中灰 (`text-slate-500`)。
  - **激活状态**：
    - 背景：淡蓝色胶囊背景 (`bg-blue-50`)。
    - 文字颜色：深蓝色 (`text-blue-600`)。
    - 无边框，强调轻量化。
  - **交互**：
    - 悬停时背景变浅灰 (`hover:bg-slate-100`)，文字变深 (`hover:text-slate-900`)。
    - 紧凑高度 `h-9` (36px)。
- **布局特性**：
  - 吸顶位置：`top-[3.5rem]` (紧接一级导航下方)。
  - 带有毛玻璃背景 (`backdrop-blur`)，确保内容滚动时导航清晰可见。

## 3. 修改文件列表
本次优化主要涉及以下文件：
1.  `/Users/jingyiding/CodeBuddy/20251127100303/src/components/dashboard/DashboardPage.tsx` (一级导航容器)
2.  `/Users/jingyiding/CodeBuddy/20251127100303/src/components/dashboard/TeamDimensionTab.tsx` (二级导航 - 分团队)
3.  UI 文档: `/Users/jingyiding/CodeBuddy/20251127100303/UI_OPTIMIZATION_DOCS.md`

## 4. 技术细节 (Tailwind CSS)
- **颜色变量**：
  - Primary: `#3b82f6` (Blue-500)
  - Text Primary: `text-gray-700` / `text-slate-900`
  - Text Secondary: `text-slate-500`
  - Background Hover: `bg-slate-100`
  - Background Active: `bg-blue-50`
- **布局工具类**：
  - `sticky`: 实现吸顶。
  - `backdrop-blur`: 实现背景模糊。
  - `z-10`/`z-20`: 确保层级覆盖。

---
*文档更新时间：2025-11-29*
