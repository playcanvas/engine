class StatsTimer {
    constructor(app, statNames, decimalPlaces = 0, unitsName = '', multiplier = 1) {
        this.app = app;
        this.paths = statNames.map(path => path.split('.'));
        this.values = new Float64Array(statNames.length);
        this.unitsName = unitsName;
        this.decimalPlaces = decimalPlaces;
        this.multiplier = multiplier;
        this.enabled = true;
    }

    get timings() {
        // Resolve from the current stats object, which may be replaced by the application.
        // Paths are parsed once, and no event subscription is needed for a sampled counter.
        for (let i = 0; i < this.paths.length; i++) {
            const path = this.paths[i];
            let value = this.app.stats;
            for (let j = 0; j < path.length && value != null; j++) {
                value = value instanceof Map ? value.get(path[j]) : value[path[j]];
            }
            this.values[i] = (value ?? 0) * this.multiplier;
        }
        return this.values;
    }
}

export { StatsTimer };
