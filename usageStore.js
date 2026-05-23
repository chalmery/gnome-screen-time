import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const STORE_DIR = GLib.build_filenamev([
    GLib.get_user_data_dir(), 'gnome-shell', 'screen-time'
]);
const STORE_FILE = GLib.build_filenamev([STORE_DIR, 'usage.json']);
const AUTOSAVE_INTERVAL = 30;

export class UsageStore {
    constructor(settings) {
        this._settings = settings;
        this._data = {};
        this._dirty = false;
        this._ensureDir();
        this._load();
        this._autoSaveId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, AUTOSAVE_INTERVAL,
            () => { this._save(); return GLib.SOURCE_CONTINUE; }
        );
        this._settingsId = settings.connect(
            'changed::retention-days', () => { this._cleanup(); }
        );
    }

    _getRetentionDays() {
        return this._settings.get_int('retention-days');
    }

    _ensureDir() {
        let dir = Gio.File.new_for_path(STORE_DIR);
        if (!dir.query_exists(null))
            dir.make_directory_with_parents(null);
    }

    _load() {
        let file = Gio.File.new_for_path(STORE_FILE);
        if (!file.query_exists(null)) return;
        try {
            let [ok, bytes] = file.load_contents(null);
            if (ok) {
                this._data = JSON.parse(new TextDecoder().decode(bytes));
                this._cleanup();
            }
        } catch (e) {
            log('[ScreenTime] load error: ' + e.message);
        }
    }

    _save() {
        if (!this._dirty) return;
        try {
            let json = JSON.stringify(this._data, null, 2);
            let file = Gio.File.new_for_path(STORE_FILE);
            file.replace_contents(
                new TextEncoder().encode(json),
                null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null
            );
            this._dirty = false;
        } catch (e) {
            log('[ScreenTime] save error: ' + e.message);
        }
    }

    _cleanup() {
        let days = this._getRetentionDays();
        if (days <= 0) return;
        let cutoff = GLib.DateTime.new_now_local().add_days(-days);
        let cutoffKey = cutoff.format('%Y-%m-%d');
        for (let key in this._data) {
            if (key < cutoffKey) {
                delete this._data[key];
                this._dirty = true;
            }
        }
    }

    addTime(appId, displayName, seconds) {
        let today = GLib.DateTime.new_now_local().format('%Y-%m-%d');
        if (!this._data[today])
            this._data[today] = {};
        if (!this._data[today][appId])
            this._data[today][appId] = { displayName, seconds: 0 };
        this._data[today][appId].seconds += Math.round(seconds);
        this._data[today][appId].displayName = displayName;
        this._dirty = true;
    }

    getUsage(range) {
        let dates = this._datesFor(range, GLib.DateTime.new_now_local());
        let agg = {};
        for (let date of dates) {
            let day = this._data[date];
            if (!day) continue;
            for (let id in day) {
                if (!agg[id])
                    agg[id] = { displayName: day[id].displayName, seconds: 0 };
                agg[id].seconds += day[id].seconds;
            }
        }
        let result = [];
        for (let id in agg)
            result.push({ appId: id, ...agg[id] });
        result.sort((a, b) => b.seconds - a.seconds);
        return result;
    }

    _datesFor(range, now) {
        let dates = [];
        let d;
        switch (range) {
        case 'today':
            dates.push(now.format('%Y-%m-%d'));
            break;
        case 'yesterday':
            dates.push(now.add_days(-1).format('%Y-%m-%d'));
            break;
        case 'week': {
            let offset = now.get_day_of_week() - 1;
            d = now.add_days(-offset);
            while (d.format('%Y-%m-%d') <= now.format('%Y-%m-%d')) {
                dates.push(d.format('%Y-%m-%d'));
                d = d.add_days(1);
            }
            break;
        }
        case 'month':
            d = GLib.DateTime.new_local(now.get_year(), now.get_month(), 1, 0, 0, 0);
            while (d.format('%Y-%m-%d') <= now.format('%Y-%m-%d')) {
                dates.push(d.format('%Y-%m-%d'));
                d = d.add_days(1);
            }
            break;
        }
        return dates;
    }

    destroy() {
        if (this._autoSaveId) {
            GLib.source_remove(this._autoSaveId);
            this._autoSaveId = null;
        }
        if (this._settingsId) {
            this._settings.disconnect(this._settingsId);
            this._settingsId = null;
        }
        this._save();
    }
}
