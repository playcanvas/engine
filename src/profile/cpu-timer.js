Object.assign(pc, function () {
    'use strict';

    var CpuTimer = function () {
        this._frameIndex = 0;
        this._frameTimings = [];
        this._timings = [];
        this._prevTimings = [];
    };

    Object.assign(CpuTimer.prototype, {
        // mark the beginning of the frame
        begin: function (name) {
            // end previous frame timings
            if (this._frameIndex < this._frameTimings.length) {
                this._frameTimings.splice(this._frameIndex);
            }
            var tmp = this._prevTimings;
            this._prevTimings = this._timings;
            this._timings = this._frameTimings;
            this._frameTimings = tmp;
            this._frameIndex = 0;

            this.mark(name);
        },

        // mark
        mark: function (name) {
            var timestamp = pc.now();

            // end previous mark
            var prev;
            if (this._frameIndex > 0) {
                prev = this._frameTimings[this._frameIndex - 1];
                prev[1] = timestamp - prev[1];
            } else if (this._timings.length > 0) {
                prev = this._timings[this._timings.length - 1]
                prev[1] = timestamp - prev[1];
            }

            if (this._frameIndex >= this._frameTimings.length) {
                this._frameTimings.push([name, timestamp]);
            } else {
                var timing = this._frameTimings[this._frameIndex];
                timing[0] = name;
                timing[1] = timestamp;
            }
            this._frameIndex++;
        }
    });

    return {
        CpuTimer: CpuTimer
    };
}());
