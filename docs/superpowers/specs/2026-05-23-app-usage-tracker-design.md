# App Usage Tracker GNOME Extension - Design Spec

## Overview

A GNOME Shell extension that tracks application usage time by monitoring window focus. Shows usage stats in a panel popup, macOS Screen Time style.

## Architecture

```
Extension (entry point)
  ├── PanelIndicator   - Panel dot indicator
  ├── PopupWidget      - Click-to-show usage stats popup (macOS style)
  ├── UsageTracker     - Listens to window focus changes, accumulates time
  └── UsageStore       - JSON file read/write, expiration cleanup
```

**Data flow:** GNOME Shell window-focus signal → UsageTracker calculates time spent in previous app → accumulates into UsageStore → PopupWidget reads from UsageStore on open

## Component Details

### PanelIndicator

- A filled circle `●` (Unicode), 24px, vertically centered
- Blue `#3584e4` while tracking is active, gray `#999` when idle
- Positioned in the system tray area of the GNOME panel

### PopupWidget

- Opens on click of the panel indicator, closes on second click or click-away
- Shows "today" by default on open
- Header row: "Screen Time" title + today's total time
- Each app row: app name, duration, percentage of total, gradient progress bar
- Bottom date tabs: `Today | Yesterday | This Week | This Month` — clicking switches the view
- Width ~320px, auto-height, anchored to panel
- Reuses the visual design from the approved mockup (Scheme C)

### UsageTracker

- Subscribes to GNOME Shell's `notify::focus-window` signal via Meta.Workspace
- On window change: computes elapsed time since last focus event, adds to the previously focused app
- No AFK / idle detection — tracks window active time only
- Updates at most once per second (debounces rapid switches)

### UsageStore

- Reads/writes JSON to `~/.local/share/gnome-shell/ai-usage-monitor/usage.json`
- Data structure:

```json
{
  "2026-05-23": {
    "firefox.desktop": { "displayName": "Firefox", "seconds": 4980 },
    "code.desktop":    { "displayName": "VS Code", "seconds": 7500 }
  }
}
```

- Top-level keys are date strings (YYYY-MM-DD)
- Each date maps app IDs (desktop file names) to display name and accumulated seconds
- Writes to disk every 30 seconds of accumulated changes (not on every focus switch)
- On startup: loads file, removes entries older than 90 days (configurable later)
- On startup: creates parent directory if missing

## Non-Features (Out of Scope)

- No app categorization
- No AFK / idle detection
- No network or external service integration
- No multi-device sync

## Configurability (Future)

- Data retention period (default 90 days)
- Potentially: idle detection toggle
- Handled via GSettings schema when implemented

## Data Expiration

- On load, truncate entries older than 90 days
- On write, same check — ensures stale data never persists on disk
- The 90-day window is hardcoded initially; move to GSettings in a follow-up

## Files

```
extension.js           - Entry point, wires all modules
panelIndicator.js      - PanelIndicator
popupWidget.js         - PopupWidget (popup + date-switching)
usageTracker.js        - UsageTracker (focus monitoring)
usageStore.js          - UsageStore (JSON persistence)
schemas/               - GSettings schema (future)
```
