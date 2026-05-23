import St from 'gi://St';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const ROW_W = 230;
const BAR_W = ROW_W - 16;
const BAR_BG = 'rgba(255,255,255,0.08)';
const MAX_VISIBLE = 5;
const COLORS = ['#3584e4', '#33d17a', '#e5a50a', '#9141ac', '#ed333b'];

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
        let usage = this._store.getUsage(this._range).filter(a => a.seconds >= 60);
        let total = usage.reduce((s, a) => s + a.seconds, 0);

        // Header: title left, total time right (prominent)
        let header = new PopupMenu.PopupBaseMenuItem({activate: false});
        header.track_hover = false;
        header.actor.style = 'padding: 0;';

        let headerRow = new St.BoxLayout({
            x_expand: true,
            style: 'padding: 4px 10px 6px 10px;',
        });
        let title = new St.Label({
            text: _('Screen Time'),
            style: 'font-size: 12px; font-weight: 700;',
        });
        headerRow.add_child(title);

        let spacer = new St.BoxLayout({x_expand: true});
        headerRow.add_child(spacer);

        if (total > 0) {
            let totalLabel = new St.Label({
                text: this._formatTime(total),
                style: 'font-size: 12px; font-weight: 700;',
            });
            headerRow.add_child(totalLabel);
        }
        header.add_child(headerRow);
        this._menu.addMenuItem(header);

        if (total > 0) {
            let subItem = new PopupMenu.PopupBaseMenuItem({activate: false});
            subItem.track_hover = false;
            subItem.actor.style = 'padding: 0;';
            let subLabel = new St.Label({
                text: this._rangeLabel(),
                style: 'font-size: 10px; padding: 0 10px 4px 10px; color: #999;',
            });
            subItem.add_child(subLabel);
            this._menu.addMenuItem(subItem);
        }

        // Separator
        let sep1 = new PopupMenu.PopupSeparatorMenuItem();
        sep1.actor.style = 'margin: 2px 10px;';
        this._menu.addMenuItem(sep1);

        // App cards
        if (usage.length === 0) {
            let empty = new PopupMenu.PopupBaseMenuItem({activate: false});
            empty.track_hover = false;
            empty.actor.style = 'padding: 0;';
            empty.add_child(new St.Label({
                text: _('No Data'),
                style: 'font-size: 12px; padding: 12px; color: #999;',
            }));
            this._menu.addMenuItem(empty);
        } else {
            let topApps = usage.slice(0, MAX_VISIBLE);
            let otherApps = usage.slice(MAX_VISIBLE);

            for (let i = 0; i < topApps.length; i++) {
                this._addAppRow(topApps[i], total, COLORS[i % COLORS.length]);
            }

            if (otherApps.length > 0) {
                let otherTotal = otherApps.reduce((s, a) => s + a.seconds, 0);
                let otherPct = Math.round(otherTotal / total * 100);
                this._addOtherAppsRow(otherApps, otherTotal, otherPct, total,
                    COLORS[topApps.length % COLORS.length]);
            }
        }

        let sep2 = new PopupMenu.PopupSeparatorMenuItem();
        sep2.actor.style = 'margin: 2px 10px;';
        this._menu.addMenuItem(sep2);

        this._addDateTabs();
    }

    _addAppRow(app, total, color) {
        let item = new PopupMenu.PopupBaseMenuItem({activate: false});
        item.track_hover = false;
        item.actor.style = 'padding: 0;';
        let pct = Math.round(app.seconds / total * 100);
        let fillW = Math.round(BAR_W * pct / 100);

        let row = new St.BoxLayout({
            vertical: true,
            style: 'padding: 4px 10px; width: ' + ROW_W + 'px;',
        });

        let topRow = new St.BoxLayout();
        let nameLabel = new St.Label({
            text: app.displayName,
            style: 'font-size: 11px; font-weight: 500; color: #ddd;',
        });
        topRow.add_child(nameLabel);

        let spacer = new St.BoxLayout({x_expand: true});
        topRow.add_child(spacer);

        let infoLabel = new St.Label({
            text: this._formatTime(app.seconds) + ' · ' + pct + '%',
            style: 'font-size: 10px; color: #aaa;',
        });
        topRow.add_child(infoLabel);
        row.add_child(topRow);

        let barContainer = new St.BoxLayout({
            style: 'margin-top: 3px; height: 4px; width: ' + BAR_W + 'px; ' +
                   'background-color: ' + BAR_BG + '; border-radius: 3px;',
        });
        let barFill = new St.Widget({
            style: 'height: 4px; background-color: ' + color + '; border-radius: 3px;',
            x_expand: false,
        });
        barFill.set_width(fillW);
        barContainer.add_child(barFill);
        row.add_child(barContainer);

        item.add_child(row);
        this._menu.addMenuItem(item);
        return item;
    }

    _addOtherAppsRow(otherApps, otherTotal, otherPct, total, color) {
        let item = new PopupMenu.PopupBaseMenuItem({activate: false});
        item.track_hover = false;
        item.actor.style = 'padding: 0;';
        let fillW = Math.round(BAR_W * otherPct / 100);

        let row = new St.BoxLayout({
            vertical: true,
            style: 'padding: 4px 10px; width: ' + ROW_W + 'px;',
        });

        let topRow = new St.BoxLayout();
        let nameLabel = new St.Label({
            text: _('Other %d apps').replace('%d', otherApps.length.toString()),
            style: 'font-size: 11px; font-weight: 500; color: #888;',
        });
        topRow.add_child(nameLabel);

        let spacer = new St.BoxLayout({x_expand: true});
        topRow.add_child(spacer);

        let infoLabel = new St.Label({
            text: this._formatTime(otherTotal) + ' · ' + otherPct + '%',
            style: 'font-size: 10px; color: #888;',
        });
        topRow.add_child(infoLabel);

        let expandArrow = new St.Label({
            text: ' ▸',
            style: 'font-size: 10px; color: #888;',
        });
        topRow.add_child(expandArrow);
        row.add_child(topRow);

        let barContainer = new St.BoxLayout({
            style: 'margin-top: 3px; height: 4px; width: ' + BAR_W + 'px; ' +
                   'background-color: ' + BAR_BG + '; border-radius: 3px;',
        });
        let barFill = new St.Widget({
            style: 'height: 4px; background-color: ' + color + '; border-radius: 3px;',
        });
        barFill.set_width(fillW);
        barContainer.add_child(barFill);
        row.add_child(barContainer);

        let btn = new St.Button({
            child: row,
            style: 'padding: 0;',
        });
        item.add_child(btn);
        this._menu.addMenuItem(item);

        let expanded = false;
        let otherItems = [];

        for (let i = 0; i < otherApps.length; i++) {
            let appItem = this._addAppRow(otherApps[i], total,
                COLORS[(MAX_VISIBLE + i) % COLORS.length]);
            appItem.actor.hide();
            otherItems.push(appItem);
        }

        btn.connect('clicked', () => {
            expanded = !expanded;
            expandArrow.text = expanded ? ' ▾' : ' ▸';
            for (let oi of otherItems) {
                if (expanded)
                    oi.actor.show();
                else
                    oi.actor.hide();
            }
        });
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
        item.actor.style = 'padding: 0;';
        let box = new St.BoxLayout({style: 'padding: 4px 8px;'});

        for (let t of tabs) {
            let active = this._range === t.range;
            let btn = new St.Button({
                label: t.label,
                style: 'font-size: 11px; padding: 2px 8px; margin: 0 1px; ' +
                       'border-radius: 6px; ' +
                       'background-color: ' + (active ? '#3584e4' : 'rgba(255,255,255,0.06)') + '; ' +
                       'color: ' + (active ? '#fff' : '#999') + ';',
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
        if (h > 0 && m > 0)
            return h + _('h') + m + _('m');
        if (h > 0)
            return h + _('h');
        return m + _('m');
    }

    destroy() {
    }
};
