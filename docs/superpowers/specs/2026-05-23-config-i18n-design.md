# Screen Time 二期：配置页面 + i18n 设计文档

## 概述

为 Screen Time GNOME Shell 扩展添加标准配置页面（prefs.js），并实现 gettext 国际化。配置项：数据保留天数、追踪采样间隔、界面语言。

## 架构

```
schemas/
  org.gnome.shell.extensions.screen-time.gschema.xml  ← GSettings 定义
prefs.js                                                ← GTK 配置页面
locale/
  zh_CN/LC_MESSAGES/screen-time@chalmery.mo            ← 中文翻译
  en/LC_MESSAGES/screen-time@chalmery.mo               ← 英文翻译
extension.js                                            ← init gettext，读取 Settings 传给模块
usageStore.js                                           ← retention_days 从 Settings 读取
usageTracker.js                                         ← max_interval 从 Settings 读取
popupWidget.js                                          ← 所有 UI 文本走 _()
metadata.json                                           ← 声明 schema 目录
```

**数据流：** GSettings (dconf) ←→ prefs.js GTK 控件绑定 → extension.js 读取 → 注入 UsageStore/UsageTracker → PopupWidget 通过 gettext 显示对应语言文本

## GSettings Schema

三项配置 key：

| Key | 类型 | 默认值 | 说明 |
|-----|------|--------|------|
| `retention-days` | int | 90 | 0 表示永久保存 |
| `max-interval` | int | 600 | 追踪采样间隔上限（秒），范围 60-3600 |
| `language` | enum | default | default / zh_CN / en |

Schema 路径：`/org/gnome/shell/extensions/screen-time/`

metadata.json 需声明 `"settings-schema": "org.gnome.shell.extensions.screen-time"`

## prefs.js — 配置页面

通过 `extension.getSettings()` 获取 Gio.Settings，GTK 控件 bind 到 key：

- **数据保留天数**：Gtk.SpinButton（0-365）+ Gtk.CheckButton「永久保存」，勾选时 spinbutton 置 0 并灰掉
- **追踪采样间隔**：Gtk.SpinButton，范围 60-3600 秒
- **界面语言**：Gtk.DropDown，三个选项：默认 / 中文 / English

底部提示：「语言变更需重新启用扩展生效」

## i18n 实现

### 初始化流程（extension.js enable 时）

1. 读取 `language` GSettings
2. 根据设置确定 locale 目录和语言参数
3. 绑定 gettext domain 到 `screen-time@chalmery`
4. 挂载翻译文件路径 `locale/`
5. 全局 `_()` 函数可用

### 语言选择逻辑

- `default`：不覆盖，走系统 `LANGUAGE` 环境变量
- `zh_CN`：显式加载 `locale/zh_CN/LC_MESSAGES/screen-time@chalmery.mo`
- `en`：显式加载 `locale/en/LC_MESSAGES/screen-time@chalmery.mo`

### 翻译文件生成流程

```bash
# 1. 从 .js 提取可翻译字符串
xgettext --from-code=UTF-8 -o po/screen-time.pot *.js

# 2. 创建/更新 .po
msginit -i po/screen-time.pot -o po/zh_CN.po -l zh_CN
msginit -i po/screen-time.pot -o po/en.po -l en

# 3. 编译 .mo
msgfmt po/zh_CN.po -o locale/zh_CN/LC_MESSAGES/screen-time@chalmery.mo
msgfmt po/en.po -o locale/en/LC_MESSAGES/screen-time@chalmery.mo
```

### 需要翻译的现有字符串

**popupWidget.js：**
- 「屏幕使用时间」→ `_("Screen Time")`
- 「今天」「昨天」「本周」「本月」→ `_("Today")` 等
- 「暂无数据」→ `_("No Data")`
- 时间格式：当前 `h + 'h ' + m + 'm'` → `_("%dh %dm")` 和 `_("%dm")`

## 现有代码改动

### extension.js

- enable 时初始化 gettext 和 GSettings
- 将 Settings 传给 UsageStore 和 UsageTracker 构造函数
- disable 时清理

### usageStore.js

- 构造函数接受 Settings 参数
- `RETENTION_DAYS` → 从 `settings.get_int('retention-days')` 读取
- 监听 `changed::retention-days` 信号刷新配置

### usageTracker.js

- 构造函数接受 Settings 参数
- `MAX_INTERVAL` → 从 `settings.get_int('max-interval')` 读取
- 监听 `changed::max-interval` 信号刷新配置

### popupWidget.js

- 所有硬编码中文字符串改为 `_()` 包裹
- `_formatTime` 使用 `_()` 格式化时间单位
- 构造函数无需变更（不直接依赖 Settings），文本由 gettext 处理

### panelIndicator.js

- 无需变更（无硬编码显示文本）

## 文件变更清单

| 操作 | 文件 |
|------|------|
| 新建 | `schemas/org.gnome.shell.extensions.screen-time.gschema.xml` |
| 新建 | `prefs.js` |
| 新建 | `locale/zh_CN/LC_MESSAGES/screen-time@chalmery.mo` |
| 新建 | `locale/en/LC_MESSAGES/screen-time@chalmery.mo` |
| 新建 | `po/screen-time.pot` |
| 新建 | `po/zh_CN.po` |
| 新建 | `po/en.po` |
| 修改 | `metadata.json` — 加 `settings-schema` |
| 修改 | `extension.js` — init gettext + GSettings |
| 修改 | `usageStore.js` — retention_days 可配置 |
| 修改 | `usageTracker.js` — max_interval 可配置 |
| 修改 | `popupWidget.js` — 所有字符串走 `_()` |
| 新增 | `Makefile` 或构建脚本 — 编译 schema + 翻译 |

## 不做（Out of Scope）

- 不做 AFK/空闲检测
- 不做更多配置项（如过滤阈值）
- 不做在线翻译贡献平台集成

## 构建步骤

安装时需要：
1. `glib-compile-schemas schemas/` — 编译 GSettings schema
2. `msgfmt po/xx.po -o locale/xx/LC_MESSAGES/screen-time@chalmery.mo` — 编译翻译
3. 复制整个扩展目录到 `~/.local/share/gnome-shell/extensions/screen-time@chalmery/`
