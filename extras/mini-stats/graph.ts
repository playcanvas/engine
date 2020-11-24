import { CpuTimer } from './cpu-timer';
import { GpuTimer } from './gpu-timer';
import { Render2d } from './render2d';
import { StatsTimer } from './stats-timer';

// Realtime performance graph visual
class Graph {
    name: string;
    device: pc.GraphicsDevice;
    timer: CpuTimer | GpuTimer | StatsTimer;
    watermark: number;
    enabled: boolean;
    textRefreshRate: number;
    avgTotal: number;
    avgTimer: number;
    avgCount: number;
    timingText: string;
    texture: pc.Texture;
    yOffset: number;
    cursor: number;
    sample: Uint8ClampedArray;
    counter: number;

    constructor(name: string, app: pc.Application, watermark: number, textRefreshRate: number, timer: CpuTimer | GpuTimer | StatsTimer) {
        this.name = name;
        this.device = app.graphicsDevice;
        this.timer = timer;
        this.watermark = watermark;
        this.enabled = false;
        this.textRefreshRate = textRefreshRate;

        this.avgTotal = 0;
        this.avgTimer = 0;
        this.avgCount = 0;
        this.timingText = "";

        this.texture = null;
        this.yOffset = 0;
        this.cursor = 0;
        this.sample = new Uint8ClampedArray(4);
        this.sample.set([0, 0, 0, 255]);

        app.on('frameupdate', this.update.bind(this));

        this.counter = 0;
    }

    update(ms: number): void {
        var timings = this.timer.timings;

        // calculate stacked total
        var total = timings.reduce(function (a, v) {
            return a + v;
        }, 0);

        // update averages
        this.avgTotal += total;
        this.avgTimer += ms;
        this.avgCount++;

        if (this.avgTimer > this.textRefreshRate) {
            this.timingText = (this.avgTotal / this.avgCount).toFixed(this.timer.decimalPlaces);
            this.avgTimer = 0;
            this.avgTotal = 0;
            this.avgCount = 0;
        }

        if (this.enabled) {
            // update timings
            var value = 0;
            var range = 1.5 * this.watermark;
            for (var i = 0; i < timings.length; ++i) {

                // scale the value into the range
                value += Math.floor(timings[i] / range * 255);
                this.sample[i] = value;
            }

            // .a store watermark
            this.sample[3] = this.watermark / range * 255;

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
    }

    render(render2d: Render2d, x: number, y: number, w: number, h: number) {
        render2d.quad(this.texture,
                      x + w,
                      y,
                      -w,
                      h,
                      this.cursor,
                      0.5 + this.yOffset,
                      -w, 0,
                      this.enabled);
    }
}

export { Graph };
