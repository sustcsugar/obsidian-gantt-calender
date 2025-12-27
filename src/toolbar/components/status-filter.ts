export type StatusValue = 'all' | 'completed' | 'uncompleted';

/**
 * 渲染可复用的状态筛选下拉框
 */
export function renderStatusFilter(
  container: HTMLElement,
  current: StatusValue,
  onChange: (v: StatusValue) => void
): void {
  const group = container.createDiv('toolbar-right-task-status-group');
  group.createEl('span', { text: '状态', cls: 'toolbar-right-task-status-label' });

  const select = group.createEl('select', { cls: 'toolbar-right-task-status-select' });
  select.innerHTML = `
    <option value="all">全部</option>
    <option value="uncompleted">未完成</option>
    <option value="completed">已完成</option>
  `;
  select.value = current;
  select.addEventListener('change', (e) => {
    const v = (e.target as HTMLSelectElement).value as StatusValue;
    onChange(v);
  });
}
