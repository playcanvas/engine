// Stats timer interface for graph
class StatsTimer {
    constructor(app, statNames, decimalPlaces, unitsName, multiplier) {
        this.app = app;
        this.values = [];

        // supporting up to 3 stats
        this.statNames = statNames;
        if (this.statNames.length > 3)
            this.statNames.length = 3;

        this.unitsName = unitsName;
        this.decimalPlaces = decimalPlaces;
        this.multiplier = multiplier || 1;

        // recursively look up properties of objects specified in a string
        const resolve = (path, obj) => {
            return path.split('.').reduce((prev, curr) => {
                return prev ? prev[curr] : null;
            }, obj || this);
        };

        app.on('frameupdate', (ms) => {
            for (let i = 0; i < this.statNames.length; i++) {

                // read specified stat from app.stats object
                this.values[i] = resolve(this.statNames[i], this.app.stats) * this.multiplier;
            }
        });
    }

    get timings() {
        return this.values;
    }
}

export { StatsTimer };
