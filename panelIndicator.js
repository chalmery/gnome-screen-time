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
