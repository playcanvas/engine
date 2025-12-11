// Realtime performance graph visual
class Graph {
    constructor(name, app, watermark, textRefreshRate, timer) {
        this.app = app;
        this.name = name;
        this.device = app.graphicsDevice;
        this.timer = timer;
        this.watermark = watermark;
        this.enabled = false;
        this.textRefreshRate = textRefreshRate;

        this.avgTotal = 0;
        this.avgTimer = 0;
        this.avgCount = 0;
        this.maxValue = 0;
        this.timingText = '';
        this.maxText = '';

        this.texture = null;
        this.yOffset = 0;
        this.graphType = 0.0;
        this.cursor = 0;
        this.sample = new Uint8ClampedArray(4);
        this.sample.set([0, 0, 0, 255]);
        this.needsClear = false;

        this.counter = 0;

        this.app.on('frameupdate', this.update, this);
    }

    destroy() {
        this.app.off('frameupdate', this.update, this);
    }

    // called when context was lost, function releases all context related resources
    loseContext() {
        // if timer implements loseContext
        if (this.timer && (typeof this.timer.loseContext === 'function')) {
            this.timer.loseContext();
        }
    }

    update(ms) {
        const timings = this.timer.timings;

        // calculate stacked total
        const total = timings.reduce((a, v) => a + v, 0);

        // update averages and max
        this.avgTotal += total;
        this.avgTimer += ms;
        this.avgCount++;
        this.maxValue = Math.max(this.maxValue, total);

        if (this.avgTimer > this.textRefreshRate) {
            this.timingText = (this.avgTotal / this.avgCount).toFixed(this.timer.decimalPlaces);
            this.maxText = this.maxValue.toFixed(this.timer.decimalPlaces);
            this.avgTimer = 0;
            this.avgTotal = 0;
            this.avgCount = 0;
            this.maxValue = 0;
        }

        if (this.enabled) {
            // update timings
            let value = 0;
            const range = 1.5 * this.watermark;
            for (let i = 0; i < timings.length; ++i) {
                // scale the value into the range
                value += Math.floor(timings[i] / range * 255);
                this.sample[i] = value;
            }

            // .a store watermark
            this.sample[3] = this.watermark / range * 255;

            // bounds check - skip if texture is too small
            if (this.yOffset >= this.texture.height) {
                return;
            }

            // write latest sample
            const data = this.texture.lock();

            // clear entire row if needed (when row is newly allocated)
            if (this.needsClear) {
                const rowOffset = this.yOffset * this.texture.width * 4;
                data.fill(0, rowOffset, rowOffset + this.texture.width * 4);
                this.needsClear = false;
            }

            data.set(this.sample, (this.cursor + this.yOffset * this.texture.width) * 4);
            this.texture.unlock();

            // update cursor position
            this.cursor++;
            if (this.cursor === this.texture.width) {
                this.cursor = 0;
            }
        }
    }

    render(render2d, x, y, w, h) {
        render2d.quad(x + w, y, -w, h,
            this.enabled ? this.cursor : 0,
            this.enabled ? 0.5 + this.yOffset : this.texture.height - 1,
            -w, 0,
            this.texture,
            this.graphType);
    }
}

export { Graph };
