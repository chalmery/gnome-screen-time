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
            text: '屏幕使用时间',
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
                text: '暂无数据',
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
            { range: 'today',     label: '今天' },
            { range: 'yesterday', label: '昨天' },
            { range: 'week',      label: '本周' },
            { range: 'month',     label: '本月' },
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
