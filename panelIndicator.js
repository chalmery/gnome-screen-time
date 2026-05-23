import St from 'gi://St';
import GObject from 'gi://GObject';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export const PanelIndicator = class extends PanelMenu.Button {
    static {
        GObject.registerClass(this);
    }

    _init() {
        super._init(0.5, _('Screen Time'));

        const hbox = new St.BoxLayout({
            style_class: 'panel-status-menu-box',
        });
        this._icon = new St.Icon({
            icon_name: 'preferences-system-time-symbolic',
            style_class: 'system-status-icon',
        });
        hbox.add_child(this._icon);
        this.add_child(hbox);
    }

    addToPanel(uuid) {
        Main.panel.addToStatusArea(uuid, this);
    }

    setTracking(active) {
        this._icon.opacity = active ? 255 : 128;
    }

    destroy() {
        super.destroy();
    }
};
