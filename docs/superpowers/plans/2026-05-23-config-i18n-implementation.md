# 配置页面 + i18n 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Screen Time 扩展添加标准 GSettings 配置页面和 gettext 国际化支持

**Architecture:** GSettings schema 定义配置 → extension.js 初始化翻译和配置 → 注入 UsageStore/UsageTracker → prefs.js 提供 GTK 配置 UI → popupWidget.js 所有字符串走 `_()`

**Tech Stack:** GNOME Shell 47-50, GJS (ESM), Gio.Settings, GLib.gettext, GTK4 (prefs.js), gettext toolchain (xgettext/msgfmt)

---

### Task 1: 创建 GSettings schema

**Files:**
- Create: `schemas/org.gnome.shell.extensions.screen-time.gschema.xml`
- Create: `schemas/gschema.compiled` (binary, 通过编译生成)

- [ ] **Step 1: 创建 schemas 目录并写入 schema XML**

```bash
mkdir -p schemas
```

写入 `schemas/org.gnome.shell.extensions.screen-time.gschema.xml`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<schemalist>
  <enum id="org.gnome.shell.extensions.screen-time.language">
    <value nick="default" value="0"/>
    <value nick="zh_CN" value="1"/>
    <value nick="en" value="2"/>
  </enum>
  <schema id="org.gnome.shell.extensions.screen-time"
          path="/org/gnome/shell/extensions/screen-time/">
    <key name="retention-days" type="i">
      <default>90</default>
      <range min="0" max="365"/>
      <summary>Data retention days</summary>
      <description>Number of days to keep usage data. 0 means keep forever.</description>
    </key>
    <key name="max-interval" type="i">
      <default>600</default>
      <range min="60" max="3600"/>
      <summary>Max tracking interval (seconds)</summary>
      <description>Maximum interval between focus events before capping to prevent skewed data after suspend.</description>
    </key>
    <key name="language" enum="org.gnome.shell.extensions.screen-time.language">
      <default>"default"</default>
      <summary>Interface language</summary>
      <description>Override interface language. Default follows system language.</description>
    </key>
  </schema>
</schemalist>
```

- [ ] **Step 2: 编译 schema**

```bash
glib-compile-schemas schemas/
```

- [ ] **Step 3: 验证 schema 编译成功**

```bash
test -f schemas/gschema.compiled && echo "OK" || echo "FAIL"
```

Expected: `OK`

- [ ] **Step 4: 提交**

```bash
git add schemas/
git commit -m "feat: add GSettings schema for config options"
```

---

### Task 2: 更新 metadata.json 声明 schema

**Files:**
- Modify: `metadata.json`

- [ ] **Step 1: 添加 settings-schema 字段**

读取 [metadata.json](metadata.json)，将内容改为：

```json
{
  "name": "Screen Time",
  "description": "Track application usage time in GNOME panel",
  "uuid": "screen-time@chalmery",
  "shell-version": ["47", "48", "49", "50"],
  "version": 2,
  "url": "https://github.com/chalmery/gnome-screen-time",
  "settings-schema": "org.gnome.shell.extensions.screen-time"
}
```

- [ ] **Step 2: 验证 JSON 有效**

```bash
cat metadata.json | python3 -m json.tool > /dev/null && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: 提交**

```bash
git add metadata.json
git commit -m "feat: declare GSettings schema in metadata"
```

---

### Task 3: 更新 extension.js — 初始化翻译和配置

**Files:**
- Modify: `extension.js`

- [ ] **Step 1: 重写 extension.js**

当前内容见 [extension.js](extension.js)。替换为：

```js
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import GLib from 'gi://GLib';
import { PanelIndicator } from './panelIndicator.js';
import { PopupWidget } from './popupWidget.js';
import { UsageTracker } from './usageTracker.js';
import { UsageStore } from './usageStore.js';

export default class ScreenTimeExtension extends Extension {
    enable() {
        this._settings = this.getSettings();

        let lang = this._settings.get_string('language');
        if (lang !== 'default') {
            let localeDir = GLib.build_filenamev([this.path, 'locale']);
            GLib.setenv('LANGUAGE', lang, true);
            GLib.setenv('LC_MESSAGES', lang, true);
        }

        this._store = new UsageStore(this._settings);
        this._indicator = new PanelIndicator();
        this._indicator.addToPanel(this.uuid);
        this._popup = new PopupWidget(this._indicator.menu, this._store);
        this._tracker = new UsageTracker(this._store, this._settings);
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
        this._settings = null;
    }
}
```

- [ ] **Step 2: 语法检查**

```bash
gjs -c extension.js 2>&1
```

Expected: 可能有 gi/resource imports 的 unresolved 警告（gjs 独立运行时无 GNOME Shell 环境），忽略即可。只要没有 SyntaxError 即通过。

- [ ] **Step 3: 提交**

```bash
git add extension.js
git commit -m "feat: init GSettings and translations in extension entry"
```

---

### Task 4: 更新 usageStore.js — 数据保留天数可配置

**Files:**
- Modify: `usageStore.js`

- [ ] **Step 1: 修改 usageStore.js 接受 Settings 参数**

当前内容见 [usageStore.js](usageStore.js)。改动点：
- 构造函数接受 `settings` 参数
- `RETENTION_DAYS` 从 settings 读取（默认 90）
- 监听 `changed::retention-days` 信号
- `_cleanup` 支持 0 = 永久保存（不清理）

替换为：

```js
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const STORE_DIR = GLib.build_filenamev([
    GLib.get_user_data_dir(), 'gnome-shell', 'screen-time'
]);
const STORE_FILE = GLib.build_filenamev([STORE_DIR, 'usage.json']);
const AUTOSAVE_INTERVAL = 30;

export class UsageStore {
    constructor(settings) {
        this._settings = settings;
        this._data = {};
        this._dirty = false;
        this._ensureDir();
        this._load();
        this._autoSaveId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, AUTOSAVE_INTERVAL,
            () => { this._save(); return GLib.SOURCE_CONTINUE; }
        );
        this._settingsId = settings.connect(
            'changed::retention-days', () => { this._cleanup(); }
        );
    }

    _getRetentionDays() {
        return this._settings.get_int('retention-days');
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
        let days = this._getRetentionDays();
        if (days === 0) return;
        let cutoff = GLib.DateTime.new_now_local().add_days(-days);
        let cutoffKey = cutoff.format('%Y-%m-%d');
        for (let key in this._data) {
            if (key < cutoffKey) {
                delete this._data[key];
                this._dirty = true;
            }
        }
    }

    addTime(appId, displayName, seconds) {
        let today = GLib.DateTime.new_now_local().format('%Y-%m-%d');
        if (!this._data[today])
            this._data[today] = {};
        if (!this._data[today][appId])
            this._data[today][appId] = { displayName, seconds: 0 };
        this._data[today][appId].seconds += Math.round(seconds);
        this._data[today][appId].displayName = displayName;
        this._dirty = true;
    }

    getUsage(range) {
        let dates = this._datesFor(range, GLib.DateTime.new_now_local());
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
        for (let id in agg)
            result.push({ appId: id, ...agg[id] });
        result.sort((a, b) => b.seconds - a.seconds);
        return result;
    }

    _datesFor(range, now) {
        let dates = [];
        let d;
        switch (range) {
        case 'today':
            dates.push(now.format('%Y-%m-%d'));
            break;
        case 'yesterday':
            dates.push(now.add_days(-1).format('%Y-%m-%d'));
            break;
        case 'week': {
            let offset = now.get_day_of_week() - 1;
            d = now.add_days(-offset);
            while (d.format('%Y-%m-%d') <= now.format('%Y-%m-%d')) {
                dates.push(d.format('%Y-%m-%d'));
                d = d.add_days(1);
            }
            break;
        }
        case 'month':
            d = GLib.DateTime.new_local(now.get_year(), now.get_month(), 1, 0, 0, 0);
            while (d.format('%Y-%m-%d') <= now.format('%Y-%m-%d')) {
                dates.push(d.format('%Y-%m-%d'));
                d = d.add_days(1);
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
        if (this._settingsId) {
            this._settings.disconnect(this._settingsId);
            this._settingsId = null;
        }
        this._save();
    }
}
```

- [ ] **Step 2: 语法检查**

```bash
gjs -c usageStore.js 2>&1
```

Expected: 空输出或仅有 gi import 警告

- [ ] **Step 3: 提交**

```bash
git add usageStore.js
git commit -m "feat: make retention days configurable via GSettings"
```

---

### Task 5: 更新 usageTracker.js — 采样间隔可配置

**Files:**
- Modify: `usageTracker.js`

- [ ] **Step 1: 修改 usageTracker.js 接受 Settings 参数**

当前内容见 [usageTracker.js](usageTracker.js)。改动点：
- 构造函数接受 `settings` 参数
- `MAX_INTERVAL` 从 settings 读取（默认 600）
- 监听 `changed::max-interval` 信号

替换为：

```js
import Shell from 'gi://Shell';

export class UsageTracker {
    constructor(store, settings) {
        this._store = store;
        this._settings = settings;
        this._lastTime = Date.now();
        this._appId = null;
        this._appName = null;
        this._id = global.display.connect(
            'notify::focus-window',
            this._onFocus.bind(this)
        );
        this._settingsId = settings.connect(
            'changed::max-interval', () => {}
        );
    }

    _getMaxInterval() {
        return this._settings.get_int('max-interval');
    }

    _onFocus(display) {
        let now = Date.now();
        let secs = (now - this._lastTime) / 1000;
        secs = Math.min(secs, this._getMaxInterval());

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
        if (this._appId) {
            let secs = Math.min(
                (Date.now() - this._lastTime) / 1000, this._getMaxInterval()
            );
            if (secs > 0)
                this._store.addTime(this._appId, this._appName, secs);
        }
        if (this._settingsId) {
            this._settings.disconnect(this._settingsId);
            this._settingsId = null;
        }
    }
}
```

- [ ] **Step 2: 语法检查**

```bash
gjs -c usageTracker.js 2>&1
```

Expected: 空输出或仅有 gi import 警告

- [ ] **Step 3: 提交**

```bash
git add usageTracker.js
git commit -m "feat: make max tracking interval configurable via GSettings"
```

---

### Task 6: 更新 popupWidget.js — 所有 UI 字符串走 _()

**Files:**
- Modify: `popupWidget.js`

- [ ] **Step 1: 重写 popupWidget.js 使用 gettext**

当前内容见 [popupWidget.js](popupWidget.js)。改动点：
- 导入 `gettext as _`
- 所有硬编码中文字符串改为 `_()` 包裹
- `_formatTime` 时间单位做翻译
- `_rangeLabel` 返回翻译后的日期标签

替换为：

```js
import St from 'gi://St';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const ROW_W = 230;
const BAR_W = ROW_W - 16;
const BAR_BG = 'rgba(255,255,255,0.12)';
const BAR_FG = '#eee';

export class PopupWidget {
    constructor(menu, store) {
        this._menu = menu;
        this._store = store;
        this._range = 'today';

        this._build();

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
        let usage = this._store.getUsage(this._range).filter(a => a.seconds >= 15);
        let total = usage.reduce((s, a) => s + a.seconds, 0);

        // Header
        let header = new PopupMenu.PopupBaseMenuItem({activate: false});
        header.track_hover = false;
        let headerBox = new St.BoxLayout({vertical: true,
            style: 'padding: 4px 0;'});
        let title = new St.Label({
            text: _('Screen Time'),
            style: 'font-size: 13px; font-weight: 700;',
        });
        headerBox.add_child(title);
        if (total > 0) {
            let sub = new St.Label({
                text: this._rangeLabel() + ' ' + this._formatTime(total),
                style: 'font-size: 11px; margin-top: 1px; color: #999;',
            });
            headerBox.add_child(sub);
        }
        header.add_child(headerBox);
        this._menu.addMenuItem(header);

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // App cards
        if (usage.length === 0) {
            let empty = new PopupMenu.PopupBaseMenuItem({activate: false});
            empty.track_hover = false;
            empty.add_child(new St.Label({
                text: _('No Data'),
                style: 'font-size: 12px; padding: 12px; color: #999;',
            }));
            this._menu.addMenuItem(empty);
        } else {
            for (let app of usage) {
                this._addAppRow(app, total);
            }
        }

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Date tabs
        this._addDateTabs();
    }

    _addAppRow(app, total) {
        let item = new PopupMenu.PopupBaseMenuItem({activate: false});
        item.track_hover = false;
        let pct = Math.round(app.seconds / total * 100);
        let fillW = Math.round(BAR_W * pct / 100);

        let row = new St.BoxLayout({
            vertical: true,
            style: 'padding: 4px 8px; width: ' + ROW_W + 'px;',
        });

        let topRow = new St.BoxLayout();
        let nameLabel = new St.Label({
            text: app.displayName,
            style: 'font-size: 12px; font-weight: 600;',
        });
        topRow.add_child(nameLabel);

        let spacer = new St.BoxLayout({x_expand: true});
        topRow.add_child(spacer);

        let infoLabel = new St.Label({
            text: this._formatTime(app.seconds) + ' · ' + pct + '%',
            style: 'font-size: 11px; font-weight: 600; color: ' + BAR_FG + ';',
        });
        topRow.add_child(infoLabel);
        row.add_child(topRow);

        // Progress bar
        let barContainer = new St.BoxLayout({
            style: 'margin-top: 3px; height: 3px; width: ' + BAR_W + 'px; ' +
                   'background-color: ' + BAR_BG + '; border-radius: 2px;',
        });
        let barFill = new St.Widget({
            style: 'height: 3px; background-color: ' + BAR_FG + '; border-radius: 2px;',
            x_expand: false,
        });
        barFill.set_width(fillW);
        barContainer.add_child(barFill);
        row.add_child(barContainer);

        item.add_child(row);
        this._menu.addMenuItem(item);
    }

    _addDateTabs() {
        let tabs = [
            {range: 'today',     label: _('Today')},
            {range: 'yesterday', label: _('Yesterday')},
            {range: 'week',      label: _('This Week')},
            {range: 'month',     label: _('This Month')},
        ];
        let item = new PopupMenu.PopupBaseMenuItem({activate: false});
        item.track_hover = false;
        let box = new St.BoxLayout({style: 'padding: 2px 6px;'});

        for (let t of tabs) {
            let active = this._range === t.range;
            let btn = new St.Button({
                label: t.label,
                style: 'font-size: 11px; padding: 2px 8px; margin: 0 1px; ' +
                       'border-radius: 6px; ' +
                       'background-color: ' + (active ? '#fff' : 'rgba(255,255,255,0.08)') + '; ' +
                       'color: ' + (active ? '#222' : '#aaa') + ';',
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
        let labels = {
            today:     _('Today'),
            yesterday: _('Yesterday'),
            week:      _('This Week'),
            month:     _('This Month'),
        };
        return labels[this._range] || '';
    }

    _formatTime(totalSecs) {
        let h = Math.floor(totalSecs / 3600);
        let m = Math.floor((totalSecs % 3600) / 60);
        if (h > 0)
            return _('%dh %dm').replace('%d', h).replace('%d', m);
        return _('%dm').replace('%d', m);
    }

    destroy() {
    }
};
```

- [ ] **Step 2: 语法检查**

```bash
gjs -c popupWidget.js 2>&1
```

Expected: 可能有 St/PopupMenu 的 unresolved import 警告，忽略。只要没有 SyntaxError 即通过。

- [ ] **Step 3: 提交**

```bash
git add popupWidget.js
git commit -m "feat: i18n all UI strings in popup widget"
```

---

### Task 7: 创建翻译文件

**Files:**
- Create: `po/screen-time.pot`
- Create: `po/zh_CN.po`
- Create: `po/en.po`
- Create: `locale/zh_CN/LC_MESSAGES/screen-time@chalmery.mo`
- Create: `locale/en/LC_MESSAGES/screen-time@chalmery.mo`

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p po locale/zh_CN/LC_MESSAGES locale/en/LC_MESSAGES
```

- [ ] **Step 2: 创建 POT 模板**

写入 `po/screen-time.pot`：

```po
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\n"
"Content-Transfer-Encoding: 8bit\n"

msgid "Screen Time"
msgstr ""

msgid "Today"
msgstr ""

msgid "Yesterday"
msgstr ""

msgid "This Week"
msgstr ""

msgid "This Month"
msgstr ""

msgid "No Data"
msgstr ""

msgid "%dh %dm"
msgstr ""

msgid "%dm"
msgstr ""
```

- [ ] **Step 3: 创建中文翻译 .po**

写入 `po/zh_CN.po`：

```po
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\n"
"Content-Transfer-Encoding: 8bit\n"
"Language: zh_CN\n"

msgid "Screen Time"
msgstr "屏幕使用时间"

msgid "Today"
msgstr "今天"

msgid "Yesterday"
msgstr "昨天"

msgid "This Week"
msgstr "本周"

msgid "This Month"
msgstr "本月"

msgid "No Data"
msgstr "暂无数据"

msgid "%dh %dm"
msgstr "%d小时%d分钟"

msgid "%dm"
msgstr "%d分钟"
```

- [ ] **Step 4: 创建英文翻译 .po**

写入 `po/en.po`：

```po
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\n"
"Content-Transfer-Encoding: 8bit\n"
"Language: en\n"

msgid "Screen Time"
msgstr "Screen Time"

msgid "Today"
msgstr "Today"

msgid "Yesterday"
msgstr "Yesterday"

msgid "This Week"
msgstr "This Week"

msgid "This Month"
msgstr "This Month"

msgid "No Data"
msgstr "No Data"

msgid "%dh %dm"
msgstr "%dh %dm"

msgid "%dm"
msgstr "%dm"
```

- [ ] **Step 5: 编译 .mo 文件**

```bash
msgfmt po/zh_CN.po -o locale/zh_CN/LC_MESSAGES/screen-time@chalmery.mo
msgfmt po/en.po -o locale/en/LC_MESSAGES/screen-time@chalmery.mo
```

- [ ] **Step 6: 验证 .mo 文件存在**

```bash
test -f locale/zh_CN/LC_MESSAGES/screen-time@chalmery.mo && \
test -f locale/en/LC_MESSAGES/screen-time@chalmery.mo && echo "OK"
```

Expected: `OK`

- [ ] **Step 7: 提交**

```bash
git add po/ locale/
git commit -m "feat: add Chinese and English translations"
```

---

### Task 8: 创建 prefs.js — GTK 配置页面

**Files:**
- Create: `prefs.js`

- [ ] **Step 1: 创建 prefs.js**

写入 `prefs.js`：

```js
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class ScreenTimePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage();
        window.add(page);

        // -- Retention group --
        const retentionGroup = new Adw.PreferencesGroup({
            title: _('Data Retention'),
        });
        page.add(retentionGroup);

        const retentionRow = new Adw.SpinRow({
            title: _('Retention Days'),
            subtitle: _('Number of days to keep usage data. 0 = keep forever.'),
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 365,
                step_increment: 1,
            }),
            value: settings.get_int('retention-days'),
            snap_to_ticks: true,
        });
        settings.bind('retention-days', retentionRow, 'value',
            Gio.SettingsBindFlags.DEFAULT);
        retentionGroup.add(retentionRow);

        // -- Interval group --
        const intervalGroup = new Adw.PreferencesGroup({
            title: _('Tracking'),
        });
        page.add(intervalGroup);

        const intervalRow = new Adw.SpinRow({
            title: _('Max Interval'),
            subtitle: _('Maximum seconds between focus events before capping (prevents skewed data after suspend).'),
            adjustment: new Gtk.Adjustment({
                lower: 60,
                upper: 3600,
                step_increment: 10,
            }),
            value: settings.get_int('max-interval'),
            snap_to_ticks: true,
        });
        settings.bind('max-interval', intervalRow, 'value',
            Gio.SettingsBindFlags.DEFAULT);
        intervalGroup.add(intervalRow);

        // -- Language group --
        const langGroup = new Adw.PreferencesGroup({
            title: _('Language'),
            description: _('Requires restarting the extension to take effect.'),
        });
        page.add(langGroup);

        const langList = new Gtk.StringList();
        langList.append(_('System Default'));
        langList.append(_('Chinese'));
        langList.append('English');

        const langRow = new Adw.ComboRow({
            title: _('Interface Language'),
            model: langList,
            selected: settings.get_enum('language'),
        });
        langRow.connect('notify::selected', () => {
            settings.set_enum('language', langRow.selected);
        });
        langGroup.add(langRow);
    }
}
```

- [ ] **Step 2: 语法检查**

```bash
gjs -c prefs.js 2>&1
```

Expected: 可能有 gi/resource imports 的 unresolved 警告，忽略。

- [ ] **Step 3: 提交**

```bash
git add prefs.js
git commit -m "feat: add GTK preferences page"
```

---

### Task 9: 创建 Makefile 构建脚本

**Files:**
- Create: `Makefile`

- [ ] **Step 1: 创建 Makefile**

写入 `Makefile`：

```makefile
EXT_DIR = $(HOME)/.local/share/gnome-shell/extensions/screen-time@chalmery

.PHONY: all schema translations install clean

all: schema translations

schema:
	glib-compile-schemas schemas/

translations:
	msgfmt po/zh_CN.po -o locale/zh_CN/LC_MESSAGES/screen-time@chalmery.mo
	msgfmt po/en.po -o locale/en/LC_MESSAGES/screen-time@chalmery.mo

install:
	mkdir -p $(EXT_DIR)
	cp -r extension.js metadata.json panelIndicator.js popupWidget.js \
	      usageStore.js usageTracker.js prefs.js schemas/ locale/ $(EXT_DIR)/

clean:
	rm -f schemas/gschema.compiled
	rm -f locale/zh_CN/LC_MESSAGES/screen-time@chalmery.mo
	rm -f locale/en/LC_MESSAGES/screen-time@chalmery.mo
```

- [ ] **Step 2: 验证 Make 可执行**

```bash
make all && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: 提交**

```bash
git add Makefile
git commit -m "build: add Makefile for schema, translations, and install"
```

---

### Task 10: 安装到本地并验证

- [ ] **Step 1: 编译并安装**

```bash
make all && make install
```

- [ ] **Step 2: 重启 GNOME Shell**

按 `Alt+F2`，输入 `r`，回车。

- [ ] **Step 3: 验证扩展可用**

```bash
gnome-extensions info screen-time@chalmery
```

Expected: 显示扩展信息，状态为 enabled。

- [ ] **Step 4: 验证配置页面**

```bash
gnome-extensions prefs screen-time@chalmery
```

Expected: 打开 GTK 配置窗口，显示三项配置。

- [ ] **Step 5: 验证 i18n**

在 GNOME Extensions 中打开配置，将语言切换为 English → 重新启用扩展 → 点击面板图标，确认弹窗显示英文文本。切换回中文，确认恢复中文。

- [ ] **Step 6: 验证配置持久化**

修改保留天数为 30，关闭配置窗口。重新打开配置，确认值仍为 30。

- [ ] **Step 7: 提交（如有微调）**

如有微调，追加提交。
