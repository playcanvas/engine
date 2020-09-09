// Frame timer interface for graph
var FrameTimer = function (app) {
    this.ms = 0;
    var self = this;
    app.on('frameupdate', function (ms) {
        self.ms = ms;
    });
};

Object.defineProperty(FrameTimer.prototype, 'timings', {
    get: function () {
        return [this.ms];
    }
});

export { FrameTimer };
