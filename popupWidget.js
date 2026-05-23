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
        let usage = this._store.getUsage(this._range).filter(a => a.seconds >= 60);
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
            return h + _('h') + ' ' + m + _('m');
        return m + _('m');
    }

    destroy() {
    }
};
