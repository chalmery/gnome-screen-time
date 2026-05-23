# Screen Time

<p align="center">
  <img src="assets/image.png" alt="Screen Time" width="400">
</p>

GNOME Shell 面板上的应用使用时间追踪器，类似 macOS 的屏幕使用时间。

## 功能

- GNOME 面板图标，点击弹出使用时间统计
- 按应用展示今日/昨天/本周/本月使用时长
- 进度条直观显示各应用占比
- 数据本地存储，不联网

## 支持的版本

GNOME Shell 47 / 48 / 49 / 50

## 安装

```bash
git clone https://github.com/chalmery/gnome-screen-time.git
cp -r gnome-screen-time ~/.local/share/gnome-shell/extensions/screen-time@chalmery
```

然后重启 GNOME Shell（`Alt+F2` → `r`），在「扩展」应用中启用即可。

## 开源协议

MIT
