import GObject from 'gi://GObject';
import St from 'gi://St';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {panel} from 'resource:///org/gnome/shell/ui/panel.js';

export default class AIUsageMonitorExtension extends Extension {
    enable() {
        this._indicator = new St.Label({
            text: '🤖 0',
            y_align: St.Align.MIDDLE,
        });
        panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
