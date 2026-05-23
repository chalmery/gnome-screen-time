import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ScreenTimePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage();
        window.add(page);

        // -- Retention group --
        const retentionGroup = new Adw.PreferencesGroup({
            title: _('Data Retention'),
        });
        page.add(retentionGroup);

        const retentionRow = new Adw.SpinRow({
            title: _('Retention Days'),
            subtitle: _('Number of days to keep usage data. 0 = keep forever.'),
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 365,
                step_increment: 1,
            }),
            value: settings.get_int('retention-days'),
            snap_to_ticks: true,
        });
        settings.bind('retention-days', retentionRow, 'value',
            Gio.SettingsBindFlags.DEFAULT);
        retentionGroup.add(retentionRow);

        // -- Interval group --
        const intervalGroup = new Adw.PreferencesGroup({
            title: _('Tracking'),
        });
        page.add(intervalGroup);

        const intervalRow = new Adw.SpinRow({
            title: _('Max Interval'),
            subtitle: _('Maximum seconds between focus events before capping.'),
            adjustment: new Gtk.Adjustment({
                lower: 60,
                upper: 3600,
                step_increment: 10,
            }),
            value: settings.get_int('max-interval'),
            snap_to_ticks: true,
        });
        settings.bind('max-interval', intervalRow, 'value',
            Gio.SettingsBindFlags.DEFAULT);
        intervalGroup.add(intervalRow);

        // -- Language group --
        const langGroup = new Adw.PreferencesGroup({
            title: _('Language'),
            description: _('Requires restarting the extension to take effect.'),
        });
        page.add(langGroup);

        const langList = new Gtk.StringList();
        langList.append(_('System Default'));
        langList.append(_('Chinese'));
        langList.append(_('English'));

        const langRow = new Adw.ComboRow({
            title: _('Interface Language'),
            model: langList,
            selected: settings.get_enum('language'),
        });
        langRow.connect('notify::selected', () => {
            settings.set_enum('language', langRow.selected);
        });
        langGroup.add(langRow);

        window.set_focus(null);
    }
}
