class GpuTimer {
    constructor(device) {
        this.device = device;
        device.gpuProfiler.enabled = true;

        this.enabled = true;
        this.unitsName = 'ms';
        this.decimalPlaces = 1;

        this._timings = [];
    }

    get timings() {
        this._timings[0] = this.device.gpuProfiler._frameTime;
        return this._timings;
    }
}

export { GpuTimer };
