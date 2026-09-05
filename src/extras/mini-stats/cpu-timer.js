import { now } from '../../core/time.js';

class CpuTimer {
    constructor(app) {
        this.app = app;
        this.unitsName = 'ms';
        this.decimalPlaces = 1;
        this.enabled = true;
        this._pending = new Float64Array(2);
        this._timings = new Float64Array(2);
        this._updateStart = 0;
        this._renderStart = 0;
        app.on('frameupdate', this.begin, this);
        app.on('framerender', this.mark, this);
        app.on('frameend', this.end, this);
    }

    begin() {
        if (this.enabled) {
            this._timings.set(this._pending);
            this._updateStart = now();
        }
    }

    mark() {
        if (this.enabled) {
            this._renderStart = now();
            this._pending[0] = this._renderStart - this._updateStart;
        }
    }

    end() {
        if (this.enabled) {
            this._pending[1] = now() - this._renderStart;
        }
    }

    get timings() {
        return this._timings;
    }

    destroy() {
        this.app.off('frameupdate', this.begin, this);
        this.app.off('framerender', this.mark, this);
        this.app.off('frameend', this.end, this);
    }
}

export { CpuTimer };
