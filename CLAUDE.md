# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm install              # Install dependencies
npm run dev             # Development build with hot reload
npm run build           # Production build (runs tsc + esbuild)
```

**Important**: After building, copy `main.js`, `manifest.json`, and `styles.css` to `<Vault>/.obsidian/plugins/obsidian-gantt-calendar/` and reload Obsidian to test.

## Project Overview

This is an Obsidian plugin that provides a calendar view with Gantt chart functionality and task management. It supports both Tasks plugin (emoji) and Dataview plugin (field) task formats.

## Architecture

### Entry Point
- `main.ts` - Plugin lifecycle (onload/onunload), registers views, commands, and event listeners
- `CalendarView.ts` - Main view container that manages all sub-views

### View System
The plugin uses a base class pattern for views:
- `BaseCalendarRenderer` - Shared methods for all views (task rendering, tooltips, link parsing)
- Views extend this base: `YearView`, `MonthView`, `WeekView`, `DayView`, `TaskView`, `GanttView`

### Toolbar System
Three-region layout in `src/toolbar/`:
- **Left**: View toggle (Calendar ↔ Tasks)
- **Center**: Date range/title display
- **Right**: Navigation buttons (different per view)

### Task Management
- `TaskCacheManager` (taskManager.ts) - Singleton pattern, caches all tasks with incremental updates
- `tasks/parser.ts` - Parses Tasks (emoji) and Dataview (field) formats
- `tasks/search.ts` - Filters tasks by date/status

### Task Format Compatibility

**Tasks format (emoji)**:
```
- [ ] 🎯 Task title ⏫ ➕ 2025-01-10 📅 2025-01-15
```

**Dataview format (fields)**:
```
- [ ] 🎯 Task title [priority:: high] [created:: 2025-01-10] [due:: 2025-01-15]
```

Priority levels: `🔺` (highest), `⏫` (high), `🔼` (medium), `🔽` (low), `⏬` (lowest)
Date emojis: `➕` (created), `🛫` (start), `⏳` (scheduled), `📅` (due), `✅` (completion), `❌` (cancelled)

### Lunar Calendar Module
`src/lunar/` handles Chinese calendar conversion, festivals, and solar terms.

## Key Patterns

### File Organization
- Keep `main.ts` minimal - delegate to modules
- Commands in `src/commands/`, context menu commands in `src/contextMenu/`
- Split files >200-300 lines into focused modules
- Use `this.register*` helpers for cleanup on unload

### Task Cache Flow
1. On load: `TaskCacheManager.initialize()` scans all .md files in batches of 50
2. On file change: `updateFileCache()` re-parses affected file
3. Deep comparison (`areTasksEqual`) prevents unnecessary view updates
4. Subscribed views refresh only when tasks actually change

### Adding New Views
1. Extend `BaseCalendarRenderer`
2. Implement `render()` method
3. Register in `CalendarView.ts` view map
4. Add toolbar button if needed

### Command Registration
Use ID prefix pattern:
- `gantt-calendar-common` - simple commands
- `gantt-calendar-editor` - editor operations
- `gantt-calendar-conditional` - availability-checked commands

## Known Issues
- Task tooltip may not disappear after refresh (high priority)
- Refresh button causes severe lag (high priority)

## Configuration
Settings defined in `src/settings.ts` with defaults. User choices persist via `loadData()`/`saveData()`.
CSS variables updated for festival colors on settings change.

## Dependencies
- TypeScript 4.7.4, ES6 target
- esbuild for bundling
- Obsidian API types (`obsidian` package)
- No runtime dependencies - all bundled into `main.js`
