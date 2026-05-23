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
