Object.assign(pc, function () {
    'use strict';

    var CpuTimer = function () {
        this._prevTimestamp = pc.now();
        this._frameIndex = 0;
        this._frameTimings = [];
        this._timings = [];
        this._prevTimings = [];
    };

    Object.assign(CpuTimer.prototype, {
        // mark the beginning of the frame
        begin: function (name) {
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
            if (this._frameIndex >= this._frameTimings.length) {
                this._frameTimings.push([name, (timestamp - this._prevTimestamp)]);
            } else {
                var timing = this._frameTimings[this._frameIndex];
                timing[0] = name;
                timing[1] = (timestamp - this._prevTimestamp);
            }
            this._frameIndex++;
            this._prevTimestamp = timestamp;
        }
    });

    return {
        CpuTimer: CpuTimer
    };
}());
