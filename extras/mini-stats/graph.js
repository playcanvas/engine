// Realtime performance graph visual
function Graph(name, app, timer, texture, yOffset) {
    this.name = name;
    this.device = app.graphicsDevice;
    this.timer = timer;
    this.enabled = false;

    this.avgTotal = 0;
    this.avgTimer = 0;
    this.avgCount = 0;
    this.timingText = "";

    this.texture = texture;
    this.yOffset = yOffset;
    this.cursor = 0;
    this.sample = new Uint8Array(4);

    this.sample.set([0, 0, 0, 255]);

    app.on('frameupdate', this.update.bind(this));

    this.counter = 0;
}

Object.assign(Graph.prototype, {
    update: function (ms) {
        var timings = this.timer.timings;

        // calculate stacked total
        var total = timings.reduce(function (a, v) {
            return a + v;
        }, 0);

        // update averages
        this.avgTotal += total;
        this.avgTimer += ms;
        this.avgCount++;
        if (this.avgTimer > 1000) {
            this.timingText = (this.avgTotal / this.avgCount).toFixed(1);
            this.avgTimer = 0;
            this.avgTotal = 0;
            this.avgCount = 0;
        }

        if (this.enabled) {
            // update timings
            var value = 0;
            for (var i = 0; i < timings.length; ++i) {
                value = Math.min(255, value + Math.floor(timings[i] * (255.0 / 48.0))); // full graph height represents 48ms
                this.sample[i] = value;
            }

            // write latest sample to the texture
            var gl = this.device.gl;
            this.device.bindTexture(this.texture);
            gl.texSubImage2D(gl.TEXTURE_2D,
                             0,
                             this.cursor,
                             this.yOffset,
                             1,
                             1,
                             gl.RGBA,
                             gl.UNSIGNED_BYTE,
                             this.sample);

            // update cursor position
            this.cursor++;
            if (this.cursor === this.texture.width) {
                this.cursor = 0;
            }
        }
    },

    render: function (render2d, x, y, w, h) {
        if (this.enabled) {
            render2d.quad(this.texture,
                          x + w,
                          y,
                          -w,
                          h,
                          this.cursor,
                          0.5 + this.yOffset,
                          -w, 0);
        }
    }
});

export { Graph };
