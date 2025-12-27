# 工具栏组件重构报告与开发计划

## 一、当前工具栏组件架构分析

### 1.1 目录结构

```
src/toolbar/
├── toolbar.ts                    # 主控制器
├── toolbar-left.ts               # 左侧视图切换器 (Tasks/Calendar/Gantt)
├── toolbar-center.ts             # 中间信息展示区 (日期/农历)
├── toolbar-right-calendar.ts     # 日历视图功能区
├── toolbar-right-task.ts         # 任务视图功能区
├── toolbar-right-gantt.ts        # 甘特图视图功能区
├── refresh-button.ts             # ✅ 已抽象 - 刷新按钮
├── sort-button.ts                # ✅ 已抽象 - 排序按钮
├── status-filter.ts              # ✅ 已抽象 - 状态筛选器
├── tag-filter.ts                 # ✅ 已抽象 - 标签筛选器
└── time-granularity.ts           # ✅ 已抽象 - 时间颗粒度选择器
```

### 1.2 已可复用的统一组件

| 组件文件 | 组件名称 | 使用视图 | 功能描述 |
|---------|---------|---------|---------|
| `refresh-button.ts` | RefreshButton | 所有视图 | 刷新任务数据 |
| `sort-button.ts` | SortButton | 周/日/任务/甘特 | 多字段排序切换 |
| `status-filter.ts` | StatusFilter | 任务/甘特 | 全部/未完成/已完成筛选 |
| `tag-filter.ts` | TagFilter | 所有视图 | 标签多选+AND/OR逻辑 |
| `time-granularity.ts` | TimeGranularity | 甘特 | 日/周/月颗粒度选择 |

### 1.3 各视图工具栏右侧按钮配置

#### 年视图 / 月视图
```
[◀ 上一期] [今天] [下一期▶] | [日/周/月/年] | [刷新] | [标签筛选]
```

#### 周视图 / 日视图
```
[◀ 上一期] [今天] [下一期▶] | [日/周/月/年] | [排序] | [刷新] | [标签筛选]
```

#### 任务视图
```
[状态筛选▼] [字段筛选▼] | [日期范围] | [排序] | [刷新] | [标签筛选]
```

#### 甘特图视图
```
[日/周/月] | [开始字段▼] [结束字段▼] | [状态▼] | [排序] | [刷新] | [标签筛选]
```

### 1.4 重复代码模式分析

#### 高度重复的组件（需要抽象）

| 组件 | 重复位置 | 重复次数 | 优先级 |
|-----|---------|---------|-------|
| 导航按钮组 | 年/月/周/日视图 | 4次 | 高 |
| 视图切换器 | 年/月/周/日视图 | 4次 | 高 |
| 日期范围筛选器 | 任务视图 | 1次 | 中 |
| 字段选择器 | 任务/甘特视图 | 2次 | 中 |

## 二、重构目标

### 2.1 核心目标
1. 将所有工具栏按钮组件分离为独立的、可复用的统一组件
2. 统一组件命名规范和接口设计
3. 便于管理、复用和组合使用
4. 减少重复代码，提高可维护性

### 2.2 设计原则
- **单一职责**：每个组件只负责一种功能
- **配置驱动**：通过配置对象控制组件行为
- **状态隔离**：组件不直接管理状态，通过回调通信
- **样式一致**：统一的 CSS 类名和样式规范

## 三、组件重构计划

### 第一阶段：导航类组件（高优先级）

#### 3.1.1 导航按钮组组件
**新文件**: `src/toolbar/components/nav-buttons.ts`

**功能**:
- 上一期按钮（◀）
- 今天按钮
- 下一期按钮（▶）

**接口设计**:
```typescript
interface NavButtonsOptions {
    onPrevious: () => void;
    onToday: () => void;
    onNext: () => void;
    todayText?: string;  // 默认 "今天"
}
```

**替换位置**:
- `toolbar-right-calendar.ts` 中的导航按钮渲染逻辑 (lines 51-63)

#### 3.1.2 视图切换器组件
**新文件**: `src/toolbar/components/calendar-view-switcher.ts`

**功能**:
- 日/周/月/年 视图快速切换
- 当前视图高亮显示

**接口设计**:
```typescript
interface CalendarViewSwitcherOptions {
    currentView: 'year' | 'month' | 'week' | 'day';
    onViewChange: (view: 'year' | 'month' | 'week' | 'day') => void;
}
```

**替换位置**:
- `toolbar-right-calendar.ts` 中的视图切换渲染逻辑 (lines 66-79)

### 第二阶段：筛选类组件（中优先级）

#### 3.2.1 模式切换按钮组组件
**新文件**: `src/toolbar/components/mode-toggle-group.ts`

**功能**:
- 通用的单选按钮组
- 支持自定义按钮文本和值
- 高亮当前选中状态
- 互斥选择（单选）

**接口设计**:
```typescript
interface ModeOption {
    value: string;
    label: string;
    title?: string;
}

interface ModeToggleGroupOptions {
    options: ModeOption[];
    currentValue: string;
    onChange: (value: string) => void;
    buttonClass?: string;  // 自定义按钮样式类
}
```

**替换位置**:
- `toolbar-right-calendar.ts` - 日/周/月/年视图切换 (lines 74-79)
- `toolbar-right-task.ts` - 全/日/周/月日期模式切换 (lines 110-147)
- `time-granularity.ts` - 日/周/月颗粒度选择（可重构使用）

#### 3.2.2 日期范围筛选器组件
**新文件**: `src/toolbar/components/date-range-filter.ts`

**功能**:
- 日期输入框（开始/结束）
- 快捷按钮：全/日/周/月
- 自定义日期范围选择

**接口设计**:
```typescript
interface DateRangeFilterOptions {
    getCurrentRange: () => DateRange;
    onRangeChange: (range: DateRange) => void;
    placeholder?: string;
}

interface DateRange {
    type: 'all' | 'day' | 'week' | 'month' | 'custom';
    startDate?: Date;
    endDate?: Date;
}
```

**替换位置**:
- `toolbar-right-task.ts` 中的日期筛选渲染逻辑

#### 3.2.2 字段选择器组件
**新文件**: `src/toolbar/components/field-selector.ts`

**功能**:
- 下拉选择时间字段类型
- 支持不同场景（开始时间/结束时间/筛选字段）
- 带标签的 select 组件

**接口设计**:
```typescript
type DateFieldType = 'created' | 'start' | 'scheduled' | 'due' | 'completion' | 'cancelled';

interface FieldSelectorOptions {
    currentField: DateFieldType;
    onFieldChange: (field: DateFieldType) => void;
    label?: string;
    excludeFields?: DateFieldType[];  // 排除某些字段选项
}

// 或者更通用的标签选择器
interface LabeledSelectOptions {
    label: string;
    options: Array<{ value: string; label: string; icon?: string }>;
    currentValue: string;
    onChange: (value: string) => void;
    selectClass?: string;
}
```

**替换位置**:
- `toolbar-right-task.ts` 中的字段筛选 (lines 44-68)
- `toolbar-right-gantt.ts` 中的时间字段选择 (lines 46-73)

#### 3.2.3 输入组组件
**新文件**: `src/toolbar/components/input-group.ts`

**功能**:
- 标签 + 输入框的组合
- 支持日期、文本等输入类型
- 统一的布局和样式

**接口设计**:
```typescript
interface InputGroupOptions {
    label: string;
    inputType: 'text' | 'date' | 'number';
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    groupClass?: string;
    inputClass?: string;
}
```

**替换位置**:
- `toolbar-right-task.ts` 中的日期输入组 (lines 71-108)

#### 3.2.4 按钮组容器组件
**新文件**: `src/toolbar/components/button-group.ts`

**功能**:
- 创建统一的按钮组容器
- 统一按钮样式和间距
- 支持垂直/水平布局

**接口设计**:
```typescript
interface ButtonGroupOptions {
    orientation?: 'horizontal' | 'vertical';
    groupClass?: string;
    buttons: Array<{
        text: string;
        icon?: string;
        title?: string;
        onClick: () => void;
        active?: boolean;
        buttonClass?: string;
    }>;
}
```

**替换位置**:
- `toolbar-right-calendar.ts` 中的导航按钮组 (lines 51-63)
- `toolbar-right-task.ts` 中的模式按钮组 (lines 110-147)

### 第三阶段：组件统一整理（中优先级）

#### 3.3.1 统一组件目录结构
```
src/toolbar/
├── components/
│   ├── index.ts                      # 统一导出所有组件
│   │
│   # === 基础组件 ===
│   ├── button-group.ts               # 【新增】按钮组容器
│   ├── input-group.ts                # 【新增】输入组（标签+输入框）
│   ├── mode-toggle-group.ts          # 【新增】模式切换按钮组（单选）
│   │
│   # === 功能组件 ===
│   ├── refresh-button.ts             # 刷新按钮（移动）
│   ├── sort-button.ts                # 排序按钮（移动）
│   ├── status-filter.ts              # 状态筛选器（移动）
│   ├── tag-filter.ts                 # 标签筛选器（移动）
│   ├── time-granularity.ts           # 时间颗粒度选择器（移动）
│   │
│   # === 组合组件 ===
│   ├── nav-buttons.ts                # 【新增】导航按钮组（上一期/今天/下一期）
│   ├── calendar-view-switcher.ts     # 【新增】日历视图切换器（日/周/月/年）
│   ├── date-range-filter.ts          # 【新增】日期范围筛选器
│   └── field-selector.ts             # 【新增】字段选择器
│
├── toolbar.ts                        # 主控制器
├── toolbar-left.ts                   # 左侧视图切换器
├── toolbar-center.ts                 # 中间信息展示区
├── toolbar-right-calendar.ts         # 日历视图功能区（重构）
├── toolbar-right-task.ts             # 任务视图功能区（重构）
└── toolbar-right-gantt.ts            # 甘特图视图功能区（重构）
```

#### 3.3.2 统一接口规范
所有组件遵循统一的 Options 接口模式：
```typescript
interface ComponentOptions {
    // 状态获取
    getCurrentState?: () => any;
    // 状态变更回调
    onChange?: (newState: any) => void;
    // 自定义配置
    [key: string]: any;
}
```

#### 3.3.3 统一返回值规范
所有组件返回统一的清理函数对象：
```typescript
interface ComponentResult {
    cleanup: () => void;  // 清理事件监听器等资源
}
```

### 第四阶段：重构右侧区域实现（高优先级）

#### 3.4.1 重构 toolbar-right-calendar.ts
- 使用 `NavButtons` 组件
- 使用 `CalendarViewSwitcher` 组件
- 复用 `SortButton`、`RefreshButton`、`TagFilter`

#### 3.4.2 重构 toolbar-right-task.ts
- 使用 `DateRangeFilter` 组件
- 使用 `FieldSelector` 组件
- 复用 `StatusFilter`、`SortButton`、`RefreshButton`、`TagFilter`

#### 3.4.3 重构 toolbar-right-gantt.ts
- 使用 `FieldSelector` 组件（开始/结束时间）
- 复用 `TimeGranularity`、`StatusFilter`、`SortButton`、`RefreshButton`、`TagFilter`

## 四、开发计划列表

### Phase 1: 创建基础组件

- [ ] 创建 `src/toolbar/components/` 目录
- [ ] 创建 `button-group.ts` - 通用按钮组容器
- [ ] 创建 `input-group.ts` - 标签+输入框组合
- [ ] 创建 `mode-toggle-group.ts` - 单选按钮组
- [ ] 创建 `components/index.ts` 统一导出文件

### Phase 2: 创建组合组件

- [ ] 创建 `nav-buttons.ts` - 导航按钮组（上一期/今天/下一期）
- [ ] 创建 `calendar-view-switcher.ts` - 日历视图切换器
- [ ] 创建 `date-range-filter.ts` - 日期范围筛选器
- [ ] 创建 `field-selector.ts` - 字段选择器

### Phase 3: 移动现有可复用组件

- [ ] 将 `refresh-button.ts` 移动到 `components/`
- [ ] 将 `sort-button.ts` 移动到 `components/`
- [ ] 将 `status-filter.ts` 移动到 `components/`
- [ ] 将 `tag-filter.ts` 移动到 `components/`
- [ ] 将 `time-granularity.ts` 移动到 `components/`
- [ ] 更新所有导入路径

### Phase 4: 重构右侧工具栏区域

- [ ] 重构 `toolbar-right-calendar.ts` 使用新组件
  - 使用 `NavButtons` 替换导航按钮
  - 使用 `ModeToggleGroup` 替换视图切换器
  - 复用 `SortButton`、`RefreshButton`、`TagFilter`
- [ ] 重构 `toolbar-right-task.ts` 使用新组件
  - 使用 `FieldSelector` 替换字段筛选
  - 使用 `DateRangeFilter` 替换日期筛选
  - 使用 `ModeToggleGroup` 替换日期模式切换
  - 复用 `StatusFilter`、`SortButton`、`RefreshButton`、`TagFilter`
- [ ] 重构 `toolbar-right-gantt.ts` 使用新组件
  - 使用 `FieldSelector` 替换时间字段选择（开始/结束）
  - 复用 `TimeGranularity`、`StatusFilter`、`SortButton`、`RefreshButton`、`TagFilter`

### Phase 5: 测试与验证

- [ ] 验证年视图工具栏功能
- [ ] 验证月视图工具栏功能
- [ ] 验证周视图工具栏功能
- [ ] 验证日视图工具栏功能
- [ ] 验证任务视图工具栏功能
- [ ] 验证甘特图视图工具栏功能

## 五、影响文件清单

### 需要修改的文件
1. `src/toolbar/toolbar.ts` - 更新导入路径
2. `src/toolbar/toolbar-right-calendar.ts` - 重构使用新组件
3. `src/toolbar/toolbar-right-task.ts` - 重构使用新组件
4. `src/toolbar/toolbar-right-gantt.ts` - 重构使用新组件

### 需要创建的文件（新增4个基础组件）
1. `src/toolbar/components/button-group.ts`
2. `src/toolbar/components/input-group.ts`
3. `src/toolbar/components/mode-toggle-group.ts`
4. `src/toolbar/components/index.ts`

### 需要创建的文件（新增4个组合组件）
5. `src/toolbar/components/nav-buttons.ts`
6. `src/toolbar/components/calendar-view-switcher.ts`
7. `src/toolbar/components/date-range-filter.ts`
8. `src/toolbar/components/field-selector.ts`

### 需要移动的文件
1. `src/toolbar/refresh-button.ts` → `src/toolbar/components/`
2. `src/toolbar/sort-button.ts` → `src/toolbar/components/`
3. `src/toolbar/status-filter.ts` → `src/toolbar/components/`
4. `src/toolbar/tag-filter.ts` → `src/toolbar/components/`
5. `src/toolbar/time-granularity.ts` → `src/toolbar/components/`

## 六、风险评估

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| 导入路径错误导致编译失败 | 中 | 使用绝对路径或统一 alias |
| 组件接口不兼容 | 低 | 保持现有接口不变 |
| 样式丢失 | 低 | 保持 CSS 类名不变 |
| 回调函数传递错误 | 中 | 充分测试各视图交互 |

## 七、预期收益

1. **代码复用率**: 提高约 40%（原计划30%，新增基础组件后更高）
2. **维护成本**: 降低约 50%
3. **新增功能**: 新增视图类型时只需组合现有组件
4. **代码可读性**: 组件职责清晰，易于理解

## 八、完整组件清单

### 基础组件层（3个新组件）
| 组件名 | 文件 | 用途 | 复用场景 |
|-------|------|------|---------|
| ButtonGroup | button-group.ts | 按钮组容器 | 所有按钮组布局 |
| InputGroup | input-group.ts | 标签+输入框 | 日期/文本输入 |
| ModeToggleGroup | mode-toggle-group.ts | 单选按钮组 | 视图/模式切换 |

### 功能组件层（5个已有+移动）
| 组件名 | 文件 | 用途 | 使用视图 |
|-------|------|------|---------|
| RefreshButton | refresh-button.ts | 刷新数据 | 全部 |
| SortButton | sort-button.ts | 排序切换 | 周/日/任务/甘特 |
| StatusFilter | status-filter.ts | 状态筛选 | 任务/甘特 |
| TagFilter | tag-filter.ts | 标签筛选 | 全部 |
| TimeGranularity | time-granularity.ts | 时间颗粒度 | 甘特 |

### 组合组件层（4个新组件）
| 组件名 | 文件 | 用途 | 使用视图 |
|-------|------|------|---------|
| NavButtons | nav-buttons.ts | 上一期/今天/下一期 | 年/月/周/日 |
| CalendarViewSwitcher | calendar-view-switcher.ts | 日/周/月/年切换 | 年/月/周/日 |
| DateRangeFilter | date-range-filter.ts | 日期范围筛选 | 任务 |
| FieldSelector | field-selector.ts | 字段选择器 | 任务/甘特 |

### 组件依赖关系
```
ButtonGroup ──┬──→ NavButtons
              ├──→ ModeToggleGroup ──┬──→ CalendarViewSwitcher
              │                      └──→ DateRangeFilter
              └──→ TimeGranularity (可重构)

InputGroup ──→ FieldSelector
             └──→ DateRangeFilter
```

### 组件使用矩阵
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
