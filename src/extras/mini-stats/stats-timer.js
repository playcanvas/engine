// Stats timer interface for graph
class StatsTimer {
    constructor(app, statNames, decimalPlaces, unitsName, multiplier) {
        this.app = app;
        this.values = [];

        // support one or more stats and accumulate them in the graph total
        this.statNames = statNames;

        this.unitsName = unitsName;
        this.decimalPlaces = decimalPlaces;
        this.multiplier = multiplier || 1;

        // recursively look up properties of objects specified in a string
        const resolve = (path, obj) => {
            return path.split('.').reduce((prev, curr) => {
                if (!prev) return null;
                // handle Map objects
                if (prev instanceof Map) {
                    return prev.get(curr);
                }
                return prev[curr];
            }, obj || this);
        };

        app.on('frameupdate', (ms) => {
            for (let i = 0; i < this.statNames.length; i++) {

                // read specified stat from app.stats object
                const value = resolve(this.statNames[i], this.app.stats);
                this.values[i] = (value ?? 0) * this.multiplier;
            }
        });
    }

    get timings() {
        return this.values;
    }
}

export { StatsTimer };
