import { math } from '../../core/math/math.js';
import { Texture } from '../../platform/graphics/texture.js';
import { ADDRESS_REPEAT, FILTER_NEAREST } from '../../platform/graphics/constants.js';
import { LAYERID_UI } from '../../scene/constants.js';

import { CpuTimer } from './cpu-timer.js';
import { GpuTimer } from './gpu-timer.js';
import { StatsTimer } from './stats-timer.js';
import { Graph } from './graph.js';
import { WordAtlas } from './word-atlas.js';
import { Render2d } from './render2d.js';

/**
 * MiniStats is a small graphical overlay that displays realtime performance metrics. By default,
 * it shows CPU and GPU utilization, frame timings and draw call count. It can also be configured
 * to display additional graphs based on data collected into {@link AppBase#stats}.
 */
class MiniStats {
    /**
     * Create a new MiniStats instance.
     *
     * @param {import('../../framework/app-base.js').AppBase} app - The application.
     * @param {object} [options] - Options for the MiniStats instance.
     * @param {object[]} [options.sizes] - Sizes of area to render individual graphs in and spacing
     * between individual graphs.
     * @param {number} [options.sizes[].width] - Width of the graph area.
     * @param {number} [options.sizes[].height] - Height of the graph area.
     * @param {number} [options.sizes[].spacing] - Spacing between graphs.
     * @param {boolean} [options.sizes[].graphs] - Whether to show graphs.
     * @param {number} [options.startSizeIndex] - Index into sizes array for initial setting.
     * @param {number} [options.textRefreshRate] - Refresh rate of text stats in ms.
     * @param {object} [options.cpu] - CPU graph options.
     * @param {boolean} [options.cpu.enabled] - Whether to show the CPU graph.
     * @param {number} [options.cpu.watermark] - Watermark - shown as a line on the graph, useful for
     * displaying a budget.
     * @param {object} [options.gpu] - GPU graph options.
     * @param {boolean} [options.gpu.enabled] - Whether to show the GPU graph.
     * @param {number} [options.gpu.watermark] - Watermark - shown as a line on the graph, useful for
     * displaying a budget.
     * @param {object[]} [options.stats] - Array of options to render additional graphs based on
     * stats collected into {@link AppBase#stats}.
     * @param {string} [options.stats[].name] - Display name.
     * @param {string[]} options.stats[].stats - Path to data inside {@link AppBase#stats}.
     * @param {number} [options.stats[].decimalPlaces] - Number of decimal places (defaults to none).
     * @param {string} [options.stats[].unitsName] - Units (defaults to "").
     * @param {number} [options.stats[].watermark] - Watermark - shown as a line on the graph, useful
     * for displaying a budget.
     * @example
     * // create a new MiniStats instance using default options
     * const miniStats = new pc.MiniStats(app);
     */
    constructor(app, options) {
        const device = app.graphicsDevice;

        options = options || MiniStats.getDefaultOptions();

        // create graphs
        this.initGraphs(app, device, options);

        // extract list of words
        const words = new Set(
            ['', 'ms', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.']
                .concat(this.graphs.map(graph => graph.name))
                .concat(options.stats ? options.stats.map(stat => stat.unitsName) : [])
                .filter(item => !!item)
        );

        this.wordAtlas = new WordAtlas(device, words);
        this.sizes = options.sizes;
        this._activeSizeIndex = options.startSizeIndex;

        // create click region so we can resize
        const div = document.createElement('div');
        div.setAttribute('id', 'mini-stats');
        div.style.cssText = 'position:fixed;bottom:0;left:0;background:transparent;';
        document.body.appendChild(div);

        div.addEventListener('mouseenter', (event) => {
            this.opacity = 1.0;
        });

        div.addEventListener('mouseleave', (event) => {
            this.opacity = 0.7;
        });

        div.addEventListener('click', (event) => {
            event.preventDefault();
            if (this._enabled) {
                this.activeSizeIndex = (this.activeSizeIndex + 1) % this.sizes.length;
                this.resize(this.sizes[this.activeSizeIndex].width, this.sizes[this.activeSizeIndex].height, this.sizes[this.activeSizeIndex].graphs);
            }
        });

        device.on('resizecanvas', this.updateDiv, this);
        device.on('losecontext', this.loseContext, this);
        app.on('postrender', this.postRender, this);

        this.app = app;
        this.drawLayer = app.scene.layers.getLayerById(LAYERID_UI);
        this.device = device;
        this.render2d = new Render2d(device);
        this.div = div;

        this.width = 0;
        this.height = 0;
        this.gspacing = 2;
        this.clr = [1, 1, 1, 0.5];

        this._enabled = true;

        // initial resize
        this.activeSizeIndex = this._activeSizeIndex;
    }

    /**
     * Destroy the MiniStats instance.
     *
     * @example
     * miniStats.destroy();
     */
    destroy() {
        this.device.off('resizecanvas', this.updateDiv, this);
        this.device.off('losecontext', this.loseContext, this);
        this.app.off('postrender', this.postRender, this);

        this.graphs.forEach(graph => graph.destroy());
        this.wordAtlas.destroy();
        this.texture.destroy();
    }

    /**
     * Returns the default options for MiniStats. The default options configure the overlay to
     * show the following graphs:
     *
     * - CPU utilization
     * - GPU utilization
     * - Overall frame time
     * - Draw call count
     *
     * @returns {object} The default options for MiniStats.
     * @example
     * const options = pc.MiniStats.getDefaultOptions();
     */
    static getDefaultOptions() {
        return {

            // sizes of area to render individual graphs in and spacing between individual graphs
            sizes: [
                { width: 100, height: 16, spacing: 0, graphs: false },
                { width: 128, height: 32, spacing: 2, graphs: true },
                { width: 256, height: 64, spacing: 2, graphs: true }
            ],

            // index into sizes array for initial setting
            startSizeIndex: 0,

            // refresh rate of text stats in ms
            textRefreshRate: 500,

            // cpu graph options
            cpu: {
                enabled: true,
                watermark: 33
            },

            // gpu graph options
            gpu: {
                enabled: true,
                watermark: 33
            },

            // array of options to render additional graphs based on stats collected into Application.stats
            stats: [
                {
                    // display name
                    name: 'Frame',

                    // path to data inside Application.stats
                    stats: ['frame.ms'],

                    // number of decimal places (defaults to none)
                    decimalPlaces: 1,

                    // units (defaults to "")
                    unitsName: 'ms',

                    // watermark - shown as a line on the graph, useful for displaying a budget
                    watermark: 33
                },

                // total number of draw calls
                {
                    name: 'DrawCalls',
                    stats: ['drawCalls.total'],
                    watermark: 1000
                }
            ]
        };
    }

    /**
     * Sets the active size index. Setting the active size index will resize the overlay to the
     * size specified by the corresponding entry in the sizes array.
     *
     * @type {number}
     * @ignore
     */
    set activeSizeIndex(value) {
        this._activeSizeIndex = value;
        this.gspacing = this.sizes[value].spacing;
        this.resize(this.sizes[value].width, this.sizes[value].height, this.sizes[value].graphs);
    }

    /**
     * Gets the active size index.
     *
     * @type {number}
     * @ignore
     */
    get activeSizeIndex() {
        return this._activeSizeIndex;
    }

    /**
     * Sets the opacity of the MiniStats overlay.
     *
     * @type {number}
     * @ignore
     */
    set opacity(value) {
        this.clr[3] = value;
    }

    /**
     * Gets the opacity of the MiniStats overlay.
     *
     * @type {number}
     * @ignore
     */
    get opacity() {
        return this.clr[3];
    }

    /**
     * Gets the overall height of the MiniStats overlay.
     *
     * @type {number}
     * @ignore
     */
    get overallHeight() {
        const graphs = this.graphs;
        const spacing = this.gspacing;
        return this.height * graphs.length + spacing * (graphs.length - 1);
    }

    /**
     * Sets the enabled state of the MiniStats overlay.
     *
     * @type {boolean}
     */
    set enabled(value) {
        if (value !== this._enabled) {
            this._enabled = value;
            for (let i = 0; i < this.graphs.length; ++i) {
                this.graphs[i].enabled = value;
                this.graphs[i].timer.enabled = value;
            }
        }
    }

    /**
     * Gets the enabled state of the MiniStats overlay.
     *
     * @type {boolean}
     */
    get enabled() {
        return this._enabled;
    }

    /**
     * Create the graphs requested by the user and add them to the MiniStats instance.
     *
     * @param {import('../../framework/app-base.js').AppBase} app - The application.
     * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics device.
     * @param {object} options - Options for the MiniStats instance.
     * @private
     */
    initGraphs(app, device, options) {
        this.graphs = [];

        if (options.cpu.enabled) {
            const timer = new CpuTimer(app);
            const graph = new Graph('CPU', app, options.cpu.watermark, options.textRefreshRate, timer);
            this.graphs.push(graph);
        }

        if (options.gpu.enabled) {
            const timer = new GpuTimer(device);
            const graph = new Graph('GPU', app, options.gpu.watermark, options.textRefreshRate, timer);
            this.graphs.push(graph);
        }

        if (options.stats) {
            options.stats.forEach((entry) => {
                const timer = new StatsTimer(app, entry.stats, entry.decimalPlaces, entry.unitsName, entry.multiplier);
                const graph = new Graph(entry.name, app, entry.watermark, options.textRefreshRate, timer);
                this.graphs.push(graph);
            });
        }

        const maxWidth = options.sizes.reduce((max, v) => {
            return v.width > max ? v.width : max;
        }, 0);

        this.texture = new Texture(device, {
            name: 'mini-stats-graph-texture',
            width: math.nextPowerOfTwo(maxWidth),
            height: math.nextPowerOfTwo(this.graphs.length),
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_REPEAT,
            addressV: ADDRESS_REPEAT
        });

        this.graphs.forEach((graph, i) => {
            graph.texture = this.texture;
            graph.yOffset = i;
        });
    }

    /**
     * Render the MiniStats overlay. This is called automatically when the `postrender` event is
     * fired by the application.
     *
     * @private
     */
    render() {
        const graphs = this.graphs;
        const wordAtlas = this.wordAtlas;
        const render2d = this.render2d;
        const width = this.width;
        const height = this.height;
        const gspacing = this.gspacing;

        render2d.startFrame();

        for (let i = 0; i < graphs.length; ++i) {
            const graph = graphs[i];

            let y = i * (height + gspacing);

            // render the graph
            graph.render(render2d, 0, y, width, height);

            // render the text
            let x = 1;
            y += height - 13;

            // name + space
            x += wordAtlas.render(render2d, graph.name, x, y) + 10;

            // timing
            const timingText = graph.timingText;
            for (let j = 0; j < timingText.length; ++j) {
                x += wordAtlas.render(render2d, timingText[j], x, y);
            }

            // units
            if (graph.timer.unitsName) {
                x += 3;
                wordAtlas.render(render2d, graph.timer.unitsName, x, y);
            }
        }

        render2d.render(this.app, this.drawLayer, this.texture, this.wordAtlas.texture, this.clr, height);
    }

    /**
     * Resize the MiniStats overlay.
     *
     * @param {number} width - The new width.
     * @param {number} height - The new height.
     * @param {boolean} showGraphs - Whether to show the graphs.
     * @private
     */
    resize(width, height, showGraphs) {
        const graphs = this.graphs;
        for (let i = 0; i < graphs.length; ++i) {
            graphs[i].enabled = showGraphs;
        }

        this.width = width;
        this.height = height;

        this.updateDiv();
    }

    /**
     * Update the size and position of the MiniStats overlay. This is called automatically when the
     * `resizecanvas` event is fired by the graphics device.
     *
     * @private
     */
    updateDiv() {
        const rect = this.device.canvas.getBoundingClientRect();
        this.div.style.left = rect.left + 'px';
        this.div.style.bottom = (window.innerHeight - rect.bottom) + 'px';
        this.div.style.width = this.width + 'px';
        this.div.style.height = this.overallHeight + 'px';
    }

    /**
     * Called when the graphics device is lost.
     *
     * @private
     */
    loseContext() {
        this.graphs.forEach(graph => graph.loseContext());
    }

    /**
     * Called when the `postrender` event is fired by the application.
     *
     * @private
     */
    postRender() {
        if (this._enabled) {
            this.render();
        }
    }
}

export { MiniStats };
