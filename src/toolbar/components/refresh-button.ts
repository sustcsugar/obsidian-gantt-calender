import { setIcon } from 'obsidian';

/**
 * 渲染共享的刷新按钮
 */
export function renderRefreshButton(
  container: HTMLElement,
  onRefresh: () => Promise<void>,
  title: string = '刷新'
): void {
  const btn = container.createEl('button', { cls: 'calendar-view-compact-btn icon-btn', attr: { title } });
  setIcon(btn, 'rotate-ccw');
  btn.addEventListener('click', onRefresh);
}
