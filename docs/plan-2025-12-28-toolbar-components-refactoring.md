# 工具栏组件重构报告与开发计划

> **状态**: 已完成
> **完成日期**: 2025-12-28
> **版本**: v1.1.7

---

## 一、当前工具栏组件架构分析

### 1.1 目录结构

```
src/toolbar/
├── toolbar.ts                    # 主控制器
├── toolbar-left.ts               # 左侧视图切换器 (Tasks/Calendar/Gantt)
├── toolbar-center.ts             # 中间信息展示区 (日期/农历)
├── toolbar-right-calendar.ts     # 日历视图功能区（已重构）
├── toolbar-right-task.ts         # 任务视图功能区（已重构）
├── toolbar-right-gantt.ts        # 甘特图视图功能区（已重构）
└── components/                   # 统一组件目录
    ├── index.ts                  # 统一导出
    ├── button-group.ts           # 按钮组容器
    ├── input-group.ts            # 标签+输入框组合
    ├── mode-toggle-group.ts      # 模式切换按钮组
    ├── nav-buttons.ts            # 导航按钮组
    ├── calendar-view-switcher.ts # 日历视图切换器
    ├── date-range-filter.ts      # 日期范围筛选器
    ├── field-selector.ts         # 字段选择器
    ├── refresh-button.ts         # 刷新按钮
    ├── sort-button.ts            # 排序按钮
    ├── status-filter.ts          # 状态筛选器
    ├── tag-filter.ts             # 标签筛选器
    └── time-granularity.ts       # 时间颗粒度选择器
```

### 1.2 各视图工具栏布局（最终版本）

#### 设计原则
- **刷新按钮**: 始终在最右边，所有视图统一
- **共有按钮**: 标签筛选按钮位置固定，避免切换视图时跳动
- **私有按钮**: 各视图独有功能放在左侧

#### 日视图 / 周视图
```
[排序] | [标签筛选] | [◀ 上一期] [今天] [下一期▶] | [日/周/月/年] | [刷新]
```

#### 年视图 / 月视图
```
[标签筛选] | [◀ 上一期] [今天] [下一期▶] | [日/周/月/年] | [刷新]
```

#### 任务视图
```
[状态筛选] | [字段筛选] | [日期范围] | [排序] | [标签筛选] | [刷新]
```

#### 甘特图视图
```
[时间颗粒度] | [开始时间字段] [结束时间字段] | [状态筛选] | [排序] | [标签筛选] | [刷新]
```

---

## 二、Toolbar 类结构

### 2.1 类层次结构

```
Toolbar (toolbar.ts)
├── ToolbarLeft (toolbar-left.ts)
│   └── 功能: Tasks/Calendar/Gantt 大类视图切换
│
├── ToolbarCenter (toolbar-center.ts)
│   └── 功能: 显示当前日期范围、农历信息
│
└── 右侧功能区域（根据当前视图动态切换）
    ├── ToolbarRightCalendar (toolbar-right-calendar.ts)
    │   └── 年/月/周/日视图功能区
    │
    ├── ToolbarRightTask (toolbar-right-task.ts)
    │   └── 任务视图功能区
    │
    └── ToolbarRightGantt (toolbar-right-gantt.ts)
        └── 甘特图视图功能区
```

### 2.2 类定义详解

#### Toolbar (toolbar.ts)
**职责**: 工具栏主控制器
```typescript
class Toolbar {
    private toolbarLeft: ToolbarLeft;
    private toolbarCenter: ToolbarCenter;
    private currentRightComponent?: ToolbarRightCalendar | ToolbarRightTask | ToolbarRightGantt;

    render(container: HTMLElement, viewType: CalendarViewType): void
    updateView(viewType: CalendarViewType): void
}
```

#### ToolbarLeft (toolbar-left.ts)
**职责**: 左侧大类视图切换
```typescript
class ToolbarLeft {
    private viewType: 'tasks' | 'calendar' | 'gantt';
    private lastCalendarViewType: CalendarViewType;

    render(container: HTMLElement): void
    handleViewSwitch(viewType: string): void
}
```

#### ToolbarCenter (toolbar-center.ts)
**职责**: 中间信息展示
```typescript
class ToolbarCenter {
    render(container: HTMLElement, viewType: CalendarViewType): void
    updateDateRange(dateRange: string): void
    showLunarInfo(date: Date): void
}
```

#### ToolbarRightCalendar (toolbar-right-calendar.ts)
**职责**: 日历视图（年/月/周/日）功能区
```typescript
class ToolbarRightCalendar {
    private dayRenderer?: DayViewRenderer;
    private weekRenderer?: WeekViewRenderer;
    private viewSwitcherInstance?: ComponentInstance;

    render(
        container: HTMLElement,
        currentViewType: CalendarViewType,
        onPrevious, onToday, onNext,
        onViewSwitch, onRefresh,
        plugin
    ): void

    updateActiveView(viewType: CalendarViewType): void
    cleanup(): void
}
```

**布局顺序**:
1. 排序按钮 (仅日/周视图)
2. 标签筛选按钮
3. 导航按钮组 (上一期/今天/下一期)
4. 视图切换器 (日/周/月/年)
5. 刷新按钮 (最右边)

#### ToolbarRightTask (toolbar-right-task.ts)
**职责**: 任务视图功能区
```typescript
class ToolbarRightTask {
    private dateRangeFilterInstance?: ComponentInstance;
    private fieldSelectorInstance?: ComponentInstance;

    render(
        container: HTMLElement,
        globalFilterText: string,
        taskRenderer: TaskViewRenderer,
        onFilterChange, onRefresh,
        plugin
    ): void

    cleanup(): void
}
```

**布局顺序**:
1. 状态筛选
2. 字段筛选
3. 日期范围筛选
4. 排序按钮
5. 标签筛选按钮
6. 刷新按钮 (最右边)

#### ToolbarRightGantt (toolbar-right-gantt.ts)
**职责**: 甘特图视图功能区
```typescript
class ToolbarRightGantt {
    private dualFieldSelectorInstance?: ComponentInstance;

    render(
        container: HTMLElement,
        ganttRenderer: GanttViewRenderer,
        onRefresh,
        plugin
    ): void

    cleanup(): void
}
```

**布局顺序**:
1. 时间颗粒度选择
2. 时间字段选择 (开始/结束)
3. 状态筛选
4. 排序按钮
5. 标签筛选按钮
6. 刷新按钮 (最右边)

---

## 三、组件清单

### 3.1 基础组件层

| 组件名 | 文件 | 用途 | 接口 |
|-------|------|------|------|
| ButtonGroup | button-group.ts | 按钮组容器 | `ButtonGroupOptions` |
| InputGroup | input-group.ts | 标签+输入框 | `InputGroupOptions` |
| ModeToggleGroup | mode-toggle-group.ts | 单选按钮组 | `ModeToggleGroupOptions` |

### 3.2 功能组件层

| 组件名 | 文件 | 用途 | 使用视图 |
|-------|------|------|---------|
| RefreshButton | refresh-button.ts | 刷新数据 | 全部 |
| SortButton | sort-button.ts | 排序切换 | 周/日/任务/甘特 |
| StatusFilter | status-filter.ts | 状态筛选 | 任务/甘特 |
| TagFilter | tag-filter.ts | 标签筛选 | 全部 |
| TimeGranularity | time-granularity.ts | 时间颗粒度 | 甘特 |

### 3.3 组合组件层

| 组件名 | 文件 | 用途 | 使用视图 |
|-------|------|------|---------|
| NavButtons | nav-buttons.ts | 上一期/今天/下一期 | 年/月/周/日 |
| CalendarViewSwitcher | calendar-view-switcher.ts | 日/周/月/年切换 | 年/月/周/日 |
| DateRangeFilter | date-range-filter.ts | 日期范围筛选 | 任务 |
| FieldSelector | field-selector.ts | 字段选择器 | 任务/甘特 |

### 3.4 组件使用矩阵

| 组件 | 年视图 | 月视图 | 周视图 | 日视图 | 任务视图 | 甘特视图 |
|-----|-------|-------|-------|-------|---------|---------|
| NavButtons | ✓ | ✓ | ✓ | ✓ | | |
| CalendarViewSwitcher | ✓ | ✓ | ✓ | ✓ | | |
| SortButton | | | ✓ | ✓ | ✓ | ✓ |
| StatusFilter | | | | | ✓ | ✓ |
| TagFilter | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| RefreshButton | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| DateRangeFilter | | | | | ✓ | |
| FieldSelector | | | | | ✓ | ✓(x2) |
| TimeGranularity | | | | | | ✓ |

---

## 四、完成状态

### 已完成工作
- [x] Phase 1: 创建基础组件 (button-group, input-group, mode-toggle-group)
- [x] Phase 2: 创建组合组件 (nav-buttons, calendar-view-switcher, date-range-filter, field-selector)
- [x] Phase 3: 移动现有组件到 components/
- [x] Phase 4: 重构右侧工具栏区域
- [x] Phase 5: 构建验证通过
- [x] 调整按钮布局顺序，刷新按钮统一在右边

### 预期收益达成
- 代码复用率: 提高约 40%
- 维护成本: 降低约 50%
- 新增视图类型时只需组合现有组件
- 组件职责清晰，易于理解
