// Stats timer interface for graph
var StatsTimer = function (app, statNames, decimalPlaces, unitsName, multiplier) {
    this.app = app;
    this.values = [];

    // supporting up to 3 stats
    this.statNames = statNames;
    if (this.statNames.length > 3)
        this.statNames.length = 3;

    this.unitsName = unitsName;
    this.decimalPlaces = decimalPlaces;
    this.multiplier = multiplier || 1;

    var self = this;

    // recursively look up properties of objects specified in a string
    function resolve(path, obj) {
        return path.split('.').reduce(function (prev, curr) {
            return prev ? prev[curr] : null;
        }, obj || self);
    }

    app.on('frameupdate', function (ms) {
        for (var i = 0; i < self.statNames.length; i++) {

            // read specified stat from app.stats object
            self.values[i] = resolve(self.statNames[i], self.app.stats) * self.multiplier;
        }
    });
};

Object.defineProperty(StatsTimer.prototype, 'timings', {
    get: function () {
        return this.values;
    }
});

export { StatsTimer };
