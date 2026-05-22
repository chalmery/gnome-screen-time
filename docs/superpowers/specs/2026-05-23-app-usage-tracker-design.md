# 应用使用时长追踪 GNOME 扩展 - 设计文档

## 概述

通过监听窗口焦点变化来追踪应用使用时长的 GNOME Shell 扩展。面板圆点指示器，点击弹出 macOS Screen Time 风格的使用统计面板。

## 架构

```
Extension (入口)
  ├── PanelIndicator   - 面板圆点指示器
  ├── PopupWidget      - 点击弹出统计面板（macOS 风格）
  ├── UsageTracker     - 监听窗口焦点，累加计时
  └── UsageStore       - JSON 文件读写、过期清理
```

**数据流：** GNOME Shell 窗口焦点信号 → UsageTracker 计算上一应用的使用时长 → 累加到 UsageStore → PopupWidget 打开时从 UsageStore 读取展示

## 组件详情

### PanelIndicator

- 实心圆点 `●`（Unicode 字符），24px，垂直居中
- 活跃追踪时显示蓝色 `#3584e4`，无窗口活动时显示灰色 `#999`
- 位于 GNOME 面板右侧系统托盘区域

### PopupWidget

- 点击面板圆点打开，再次点击或点击别处关闭
- 默认展示"今天"的数据
- 顶部：标题"屏幕使用时间" + 今日总时长
- 每个应用一行：应用名、时长、占总时间百分比、渐变进度条
- 底部日期标签：`今天 | 昨天 | 本周 | 本月`，点击切换视图
- 宽度约 320px，高度自适应，锚定在面板下方
- 采用方案 C 确认的 macOS 风格卡片设计

### UsageTracker

- 订阅 GNOME Shell 的 `notify::focus-window` 信号（通过 Meta.Workspace）
- 窗口切换时：计算距离上次焦点事件的时间差，累加到之前聚焦的应用
- 不做 AFK/空闲检测，仅追踪窗口活跃时长
- 最快每秒更新一次（快速切换时去抖）

### UsageStore

- 读写 JSON 到 `~/.local/share/gnome-shell/ai-usage-monitor/usage.json`
- 数据结构：

```json
{
  "2026-05-23": {
    "firefox.desktop": { "displayName": "Firefox", "seconds": 4980 },
    "code.desktop":    { "displayName": "VS Code", "seconds": 7500 }
  }
}
```

- 顶层 key 为日期字符串（YYYY-MM-DD）
- 每个日期下以应用 ID（desktop 文件名）为 key，记录显示名称和累计秒数
- 每 30 秒将内存中变更写入磁盘一次（非每次焦点切换都写）
- 启动时：加载文件，删除超过 90 天的旧数据（后续可配置）
- 启动时：如果父目录不存在则创建

## 不做（Out of Scope）

- 不做应用分类
- 不做 AFK/空闲检测
- 不涉及网络或外部服务
- 不做多设备同步

## 后续可配置项

- 数据保留天数（默认 90 天）
- 可能加入空闲检测开关
- 后续通过 GSettings schema 实现

## 数据过期清理

- 加载时删除超过 90 天的条目
- 写入时同样检查，确保过期数据不残留磁盘
- 90 天窗口初期硬编码，后续迁移到 GSettings

## 文件结构

```
extension.js           - 入口，组装所有模块
panelIndicator.js      - PanelIndicator 面板指示器
popupWidget.js         - PopupWidget 弹窗 + 日期切换
usageTracker.js        - UsageTracker 焦点监听 + 计时
usageStore.js          - UsageStore JSON 持久化
schemas/               - GSettings schema（后续）
```
