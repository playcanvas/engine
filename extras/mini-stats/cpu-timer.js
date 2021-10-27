class CpuTimer {
    constructor(app) {
        this._frameIndex = 0;
        this._frameTimings = [];
        this._timings = [];
        this._prevTimings = [];
        this.unitsName = "ms";
        this.decimalPlaces = 1;

        this.enabled = true;

        app.on('frameupdate', this.begin.bind(this, 'update'));
        app.on('framerender', this.mark.bind(this, 'render'));
        app.on('frameend', this.mark.bind(this, 'other'));
    }

    // mark the beginning of the frame
    begin(name) {
        if (!this.enabled) {
            return;
        }

        // end previous frame timings
        if (this._frameIndex < this._frameTimings.length) {
            this._frameTimings.splice(this._frameIndex);
        }
        const tmp = this._prevTimings;
        this._prevTimings = this._timings;
        this._timings = this._frameTimings;
        this._frameTimings = tmp;
        this._frameIndex = 0;

        this.mark(name);
    }

    // mark
    mark(name) {
        if (!this.enabled) {
            return;
        }

        const timestamp = pc.now();

        // end previous mark
        if (this._frameIndex > 0) {
            const prev = this._frameTimings[this._frameIndex - 1];
            prev[1] = timestamp - prev[1];
        } else if (this._timings.length > 0) {
            const prev = this._timings[this._timings.length - 1];
            prev[1] = timestamp - prev[1];
        }

        if (this._frameIndex >= this._frameTimings.length) {
            this._frameTimings.push([name, timestamp]);
        } else {
            const timing = this._frameTimings[this._frameIndex];
            timing[0] = name;
            timing[1] = timestamp;
        }
        this._frameIndex++;
    }

    get timings() {
        // remove the last time point from the list (which is the time spent outside
        // of PlayCanvas)
        return this._timings.slice(0, -1).map(v => v[1]);
    }
}

export { CpuTimer };
