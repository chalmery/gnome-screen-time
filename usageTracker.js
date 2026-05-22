import Shell from 'gi://Shell';

const MAX_INTERVAL = 600;

export class UsageTracker {
    constructor(store) {
        this._store = store;
        this._lastTime = Date.now();
        this._appId = null;
        this._appName = null;
        this._id = global.display.connect(
            'notify::focus-window',
            this._onFocus.bind(this)
        );
    }

    _onFocus(display) {
        let now = Date.now();
        let secs = (now - this._lastTime) / 1000;
        secs = Math.min(secs, MAX_INTERVAL);

        if (this._appId && secs > 0)
            this._store.addTime(this._appId, this._appName, secs);

        let win = display.focus_window;
        if (win) {
            let tracker = Shell.WindowTracker.get_default();
            let app = tracker.get_window_app(win);
            this._appId = app.get_id();
            this._appName = app.get_name();
        } else {
            this._appId = null;
            this._appName = null;
        }
        this._lastTime = now;
    }

    destroy() {
        if (this._id) {
            global.display.disconnect(this._id);
            this._id = null;
        }
        if (this._appId) {
            let secs = Math.min(
                (Date.now() - this._lastTime) / 1000, MAX_INTERVAL
            );
            if (secs > 0)
                this._store.addTime(this._appId, this._appName, secs);
        }
    }
}
