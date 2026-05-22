# Screen Time 扩展实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI Usage Monitor 骨架重命名为 Screen Time，实现完整的应用使用时长追踪 GNOME 扩展

**Architecture:** 4 个模块 — UsageStore（JSON 持久化）、UsageTracker（焦点监听+计时）、PanelIndicator（面板圆点）、PopupWidget（macOS 风格弹窗），由 extension.js 组装

**Tech Stack:** GNOME Shell 47/48, GJS (SpiderMonkey), St (Clutter), GLib/Gio, Meta/Shell

---

### Task 1: 重命名项目

**Files:**
- Modify: `metadata.json`
- Modify: `extension.js`
- Modify: `.gitignore`

- [ ] **Step 1: 更新 metadata.json**

写入完整内容：

```json
{
  "name": "Screen Time",
  "description": "Track application usage time in GNOME panel",
  "uuid": "screen-time@chalmery",
  "shell-version": ["47", "48"],
  "version": 1,
  "url": "https://github.com/chalmery/screen-time"
}
```

- [ ] **Step 2: 更新 .gitignore**

追加 `.superpowers/`：

```
.claude/
.vscode/
.superpowers/
```

- [ ] **Step 3: 语法检查**

Run: `cat metadata.json | python3 -m json.tool > /dev/null`
Expected: 无错误（JSON 有效）

- [ ] **Step 4: 提交**

```bash
git add metadata.json .gitignore
git commit -m "refactor: rename project to Screen Time (metadata)"
```

---

### Task 2: 创建 UsageStore（JSON 持久化模块）

**Files:**
- Create: `usageStore.js`

- [ ] **Step 1: 创建 usageStore.js**

```js
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const STORE_DIR = GLib.build_filenamev([
    GLib.get_user_data_dir(), 'gnome-shell', 'screen-time'
]);
const STORE_FILE = GLib.build_filenamev([STORE_DIR, 'usage.json']);
const RETENTION_DAYS = 90;
const AUTOSAVE_INTERVAL = 30;

export class UsageStore {
    constructor() {
        this._data = {};
        this._dirty = false;
        this._ensureDir();
        this._load();
        this._autoSaveId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, AUTOSAVE_INTERVAL,
            () => { this._save(); return GLib.SOURCE_CONTINUE; }
        );
    }

    _ensureDir() {
        let dir = Gio.File.new_for_path(STORE_DIR);
        if (!dir.query_exists(null))
            dir.make_directory_with_parents(null);
    }

    _load() {
        let file = Gio.File.new_for_path(STORE_FILE);
        if (!file.query_exists(null)) return;
        try {
            let [ok, bytes] = file.load_contents(null);
            if (ok) {
                this._data = JSON.parse(new TextDecoder().decode(bytes));
                this._cleanup();
            }
        } catch (e) {
            log('[ScreenTime] load error: ' + e.message);
        }
    }

    _save() {
        if (!this._dirty) return;
        try {
            let json = JSON.stringify(this._data, null, 2);
            let file = Gio.File.new_for_path(STORE_FILE);
            file.replace_contents(
                new TextEncoder().encode(json),
                null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null
            );
            this._dirty = false;
        } catch (e) {
            log('[ScreenTime] save error: ' + e.message);
        }
    }

    _cleanup() {
        let d = new Date();
        d.setDate(d.getDate() - RETENTION_DAYS);
        let cutoff = d.toISOString().split('T')[0];
        for (let key in this._data) {
            if (key < cutoff) {
                delete this._data[key];
                this._dirty = true;
            }
        }
    }

    addTime(appId, displayName, seconds) {
        let today = new Date().toISOString().split('T')[0];
        if (!this._data[today])
            this._data[today] = {};
        if (!this._data[today][appId])
            this._data[today][appId] = { displayName, seconds: 0 };
        this._data[today][appId].seconds += Math.round(seconds);
        this._data[today][appId].displayName = displayName;
        this._dirty = true;
    }

    getUsage(range) {
        let now = new Date();
        let dates = this._datesFor(range, now);
        let agg = {};
        for (let date of dates) {
            let day = this._data[date];
            if (!day) continue;
            for (let id in day) {
                if (!agg[id])
                    agg[id] = { displayName: day[id].displayName, seconds: 0 };
                agg[id].seconds += day[id].seconds;
            }
        }
        let result = [];
        for (let id in agg) {
            result.push({ appId: id, ...agg[id] });
        }
        result.sort((a, b) => b.seconds - a.seconds);
        return result;
    }

    _datesFor(range, now) {
        let dates = [];
        let d;
        switch (range) {
        case 'today':
            dates.push(now.toISOString().split('T')[0]);
            break;
        case 'yesterday':
            d = new Date(now); d.setDate(d.getDate() - 1);
            dates.push(d.toISOString().split('T')[0]);
            break;
        case 'week': {
            let dow = now.getDay();
            let offset = dow === 0 ? 6 : dow - 1;
            d = new Date(now); d.setDate(d.getDate() - offset);
            while (d <= now) {
                dates.push(d.toISOString().split('T')[0]);
                d.setDate(d.getDate() + 1);
            }
            break;
        }
        case 'month':
            d = new Date(now.getFullYear(), now.getMonth(), 1);
            while (d <= now) {
                dates.push(d.toISOString().split('T')[0]);
                d.setDate(d.getDate() + 1);
            }
            break;
        }
        return dates;
    }

    destroy() {
        if (this._autoSaveId) {
            GLib.source_remove(this._autoSaveId);
            this._autoSaveId = null;
        }
        this._save();
    }
}
```

- [ ] **Step 2: 语法检查**

Run: `gjs -c usageStore.js`
Expected: 无错误输出（空输出即通过）

- [ ] **Step 3: 提交**

```bash
git add usageStore.js
git commit -m "feat: add UsageStore for JSON persistence"
```

---

### Task 3: 创建 UsageTracker（焦点监听 + 计时）

**Files:**
- Create: `usageTracker.js`

- [ ] **Step 1: 创建 usageTracker.js**

```js
import Shell from 'gi://Shell';

const MAX_INTERVAL = 600; // cap 10 min to avoid suspend garbage

export class UsageTracker {
    constructor(store) {
        this._store = store;
        this._lastTime = Date.now();
        this._appId = null;
        this._appName = null;
        this._id = global.display.connect(
            'notify::focus-window',
            this._onFocus.bind(this)
        );
    }

    _onFocus(display) {
        let now = Date.now();
        let secs = (now - this._lastTime) / 1000;
        secs = Math.min(secs, MAX_INTERVAL);

        if (this._appId && secs > 0)
            this._store.addTime(this._appId, this._appName, secs);

        let win = display.focus_window;
        if (win) {
            let tracker = Shell.WindowTracker.get_default();
            let app = tracker.get_window_app(win);
            this._appId = app.get_id();
            this._appName = app.get_name();
        } else {
            this._appId = null;
            this._appName = null;
        }
        this._lastTime = now;
    }

    destroy() {
        if (this._id) {
            global.display.disconnect(this._id);
            this._id = null;
        }
        // flush last segment
        if (this._appId) {
            let secs = Math.min(
                (Date.now() - this._lastTime) / 1000, MAX_INTERVAL
            );
            if (secs > 0)
                this._store.addTime(this._appId, this._appName, secs);
        }
    }
}
```

- [ ] **Step 2: 语法检查**

Run: `gjs -c usageTracker.js`
Expected: 无错误输出

- [ ] **Step 3: 提交**

```bash
git add usageTracker.js
git commit -m "feat: add UsageTracker for window focus monitoring"
```

---

### Task 4: 创建 PanelIndicator（面板圆点指示器）

**Files:**
- Create: `panelIndicator.js`

- [ ] **Step 1: 创建 panelIndicator.js**

```js
import St from 'gi://St';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { panel } from 'resource:///org/gnome/shell/ui/panel.js';

const DOT_BLUE = '#3584e4';
const DOT_GRAY = '#999999';

export class PanelIndicator {
    constructor() {
        this._button = new PanelMenu.Button(0.0, 'Screen Time', false);
        this._dot = new St.Label({
            text: '●',
            y_align: St.Align.MIDDLE,
        });
        this._dot.set_style(
            'font-size: 14px; color: ' + DOT_BLUE + ';'
        );
        this._button.add_child(this._dot);
    }

    addToPanel(uuid) {
        panel.addToStatusArea(uuid, this._button);
    }

    setTracking(active) {
        this._dot.set_style(
            'font-size: 14px; color: ' +
            (active ? DOT_BLUE : DOT_GRAY) + ';'
        );
    }

    get menu() {
        return this._button.menu;
    }

    destroy() {
        this._button.destroy();
    }
}
```

- [ ] **Step 2: 语法检查**

Run: `gjs -c panelIndicator.js 2>&1`
Expected: 可能有关于 St/PanelMenu 的 unresolved import 警告（gjs -c 在无 GNOME Shell 环境时无法解析 gi 导入），忽略，只要没有语法错误即可

- [ ] **Step 3: 提交**

```bash
git add panelIndicator.js
git commit -m "feat: add PanelIndicator with dot icon"
```

---

### Task 5: 创建 PopupWidget（macOS 风格弹窗）

**Files:**
- Create: `popupWidget.js`

- [ ] **Step 1: 创建 popupWidget.js**

```js
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const COLORS = ['#3584e4', '#33d17a', '#e5a50a', '#9141ac',
                '#ed333b', '#ff7800', '#865e3c', '#1c71d8'];

export class PopupWidget {
    constructor(menu, store) {
        this._menu = menu;
        this._store = store;
        this._range = 'today';

        this._menu.connect('open-state-changed', (m, open) => {
            if (open) this._refresh();
        });
    }

    _refresh() {
        this._range = 'today';
        this._build();
    }

    _build() {
        this._menu.removeAll();
        let usage = this._store.getUsage(this._range);
        let total = usage.reduce((s, a) => s + a.seconds, 0);

        // Header
        let header = new PopupMenu.PopupBaseMenuItem({ activate: false });
        let headerBox = new St.BoxLayout({ vertical: true });
        let title = new St.Label({
            text: '屏幕使用时间', // 屏幕使用时间
            style: 'font-size: 15px; font-weight: 600; color: #1a1a1a;'
        });
        headerBox.add_child(title);
        if (total > 0) {
            let sub = new St.Label({
                text: this._rangeLabel() + ' ' + this._formatTime(total),
                style: 'font-size: 12px; color: #999; margin-top: 2px;'
            });
            headerBox.add_child(sub);
        }
        header.add_child(headerBox);
        this._menu.addMenuItem(header);

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // App cards
        if (usage.length === 0) {
            let empty = new PopupMenu.PopupBaseMenuItem({ activate: false });
            empty.add_child(new St.Label({
                text: '暂无数据', // 暂无数据
                style: 'font-size: 13px; color: #999; padding: 20px;'
            }));
            this._menu.addMenuItem(empty);
        } else {
            for (let i = 0; i < usage.length; i++) {
                this._addAppRow(usage[i], total, COLORS[i % COLORS.length]);
            }
        }

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Date tabs
        this._addDateTabs();
    }

    _addAppRow(app, total, color) {
        let item = new PopupMenu.PopupBaseMenuItem({ activate: false });
        let pct = total > 0 ? Math.round(app.seconds / total * 100) : 0;

        let row = new St.BoxLayout({
            vertical: true,
            style: 'margin: 0 12px 4px 12px; padding: 12px; ' +
                   'background-color: #f8f9fb; border-radius: 8px; width: 290px;'
        });

        // Top row: name + time + percentage
        let topRow = new St.BoxLayout();
        let nameLabel = new St.Label({
            text: app.displayName,
            style: 'font-size: 13px; font-weight: 600; color: #333;'
        });
        topRow.add_child(nameLabel);
        let spacer = new St.BoxLayout({ style: 'width: 100px;' });
        topRow.add_child(spacer);
        let infoLabel = new St.Label({
            text: this._formatTime(app.seconds) + ' · ' + pct + '%',
            style: 'font-size: 13px; font-weight: 600; color: ' + color + ';'
        });
        topRow.add_child(infoLabel);
        row.add_child(topRow);

        // Progress bar
        let barBg = new St.Widget({
            style: 'margin-top: 8px; height: 5px; background-color: #e5e5e5; ' +
                   'border-radius: 3px;'
        });
        let barFill = new St.Widget({
            style: 'height: 5px; background-color: ' + color + '; ' +
                   'border-radius: 3px; width: ' + Math.max(pct, 2) + '%;'
        });
        barBg.add_child(barFill);
        row.add_child(barBg);

        item.add_child(row);
        this._menu.addMenuItem(item);
    }

    _addDateTabs() {
        let tabs = [
            { range: 'today',     label: '今天' },     // 今天
            { range: 'yesterday', label: '昨天' },     // 昨天
            { range: 'week',      label: '本周' },     // 本周
            { range: 'month',     label: '本月' },     // 本月
        ];
        let item = new PopupMenu.PopupBaseMenuItem({ activate: false });
        let box = new St.BoxLayout({ style: 'padding: 4px 12px;' });

        for (let t of tabs) {
            let active = this._range === t.range;
            let btn = new St.Button({
                label: t.label,
                style: 'font-size: 11px; padding: 4px 12px; margin: 0 2px; ' +
                       'border-radius: 6px; ' +
                       'background-color: ' + (active ? '#3584e4' : '#eee') + '; ' +
                       'color: ' + (active ? '#fff' : '#666') + ';'
            });
            let range = t.range;
            btn.connect('clicked', () => {
                this._range = range;
                this._build();
            });
            box.add_child(btn);
        }
        item.add_child(box);
        this._menu.addMenuItem(item);
    }

    _rangeLabel() {
        switch (this._range) {
        case 'today':     return '今天';
        case 'yesterday': return '昨天';
        case 'week':      return '本周';
        case 'month':     return '本月';
        }
        return '';
    }

    _formatTime(totalSecs) {
        let h = Math.floor(totalSecs / 3600);
        let m = Math.floor((totalSecs % 3600) / 60);
        if (h > 0) return h + 'h ' + m + 'm';
        return m + 'm';
    }

    destroy() {
        // menu is owned by PanelMenu.Button, nothing to clean here
    }
}
```

- [ ] **Step 2: 语法检查**

Run: `gjs -c popupWidget.js 2>&1`
Expected: 可能报 St/PopupMenu 的 unresolved import（gjs 独立运行时无 GNOME Shell 环境），忽略即可

- [ ] **Step 3: 提交**

```bash
git add popupWidget.js
git commit -m "feat: add PopupWidget with macOS-style cards and date tabs"
```

---

### Task 6: 重写 extension.js（组装入口）

**Files:**
- Modify: `extension.js`

- [ ] **Step 1: 重写 extension.js**

```js
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { PanelIndicator } from './panelIndicator.js';
import { PopupWidget } from './popupWidget.js';
import { UsageTracker } from './usageTracker.js';
import { UsageStore } from './usageStore.js';

export default class ScreenTimeExtension extends Extension {
    enable() {
        this._store = new UsageStore();
        this._indicator = new PanelIndicator();
        this._indicator.addToPanel(this.uuid);
        this._popup = new PopupWidget(this._indicator.menu, this._store);
        this._tracker = new UsageTracker(this._store);
    }

    disable() {
        this._tracker?.destroy();
        this._tracker = null;
        this._popup?.destroy();
        this._popup = null;
        this._indicator?.destroy();
        this._indicator = null;
        this._store?.destroy();
        this._store = null;
    }
}
```

- [ ] **Step 2: 语法检查**

Run: `gjs -c extension.js 2>&1`
Expected: 可能报 gi/resource imports 的 unresolved 警告，忽略即可

- [ ] **Step 3: 提交**

```bash
git add extension.js
git commit -m "feat: wire Screen Time extension modules"
```

---

### Task 7: 安装并验证

**Files:** 无新建，验证已有文件

- [ ] **Step 1: 创建扩展符号链接**

```bash
mkdir -p ~/.local/share/gnome-shell/extensions/screen-time@chalmery \
  && ln -sf /home/yangcc/code/gnome/ai-usage-monitor/{extension.js,metadata.json,usageStore.js,usageTracker.js,panelIndicator.js,popupWidget.js} \
     ~/.local/share/gnome-shell/extensions/screen-time@chalmery/
```

- [ ] **Step 2: 启用扩展**

在 X11 会话中按 `Alt+F2`，输入 `r` 重启 GNOME Shell，然后运行：

```bash
gnome-extensions enable screen-time@chalmery
```

- [ ] **Step 3: 验证面板显示**

检查 GNOME 面板右侧是否出现蓝色 `●` 圆点

- [ ] **Step 4: 验证弹窗**

点击圆点，确认弹出窗口显示"屏幕使用时间"标题和日期标签。切换几个应用窗口后再点击，确认应用列表有数据显示

- [ ] **Step 5: 验证数据持久化**

```bash
cat ~/.local/share/gnome-shell/screen-time/usage.json
```

确认 JSON 文件存在且包含当日使用数据

- [ ] **Step 6: 提交（如有微调）**

如有微调，amend 或追加提交
