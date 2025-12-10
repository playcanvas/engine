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
 * @import { AppBase } from '../../framework/app-base.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 */

/**
 * @typedef {object} MiniStatsSizeOptions
 * @property {number} width - Width of the graph area.
 * @property {number} height - Height of the graph area.
 * @property {number} spacing - Spacing between graphs.
 * @property {boolean} graphs - Whether to show graphs.
 */

/**
 * @typedef {object} MiniStatsProcessorOptions
 * @property {boolean} enabled - Whether to show the graph.
 * @property {number} watermark - Watermark - shown as a line on the graph, useful for displaying a
 * budget.
 */

/**
 * @typedef {object} MiniStatsGraphOptions
 * @property {string} name - Display name.
 * @property {string[]} stats - Path to data inside Application.stats.
 * @property {number} [decimalPlaces] - Number of decimal places (defaults to none).
 * @property {string} [unitsName] - Units (defaults to "").
 * @property {number} [watermark] - Watermark - shown as a line on the graph, useful for displaying
 * a budget.
 */

/**
 * @typedef {object} MiniStatsOptions
 * @property {MiniStatsSizeOptions[]} sizes - Sizes of area to render individual graphs in and
 * spacing between individual graphs.
 * @property {number} startSizeIndex - Index into sizes array for initial setting.
 * @property {number} textRefreshRate - Refresh rate of text stats in ms.
 * @property {MiniStatsProcessorOptions} cpu - CPU graph options.
 * @property {MiniStatsProcessorOptions} gpu - GPU graph options.
 * @property {MiniStatsGraphOptions[]} stats - Array of options to render additional graphs based
 * on stats collected into Application.stats.
 * @property {boolean} [showGpuPasses] - Enable dynamic GPU pass tracking and display of individual
 * render pass timings. Defaults to true.
 */

/**
 * MiniStats is a small graphical overlay that displays realtime performance metrics. By default,
 * it shows CPU and GPU utilization, frame timings and draw call count. It can also be configured
 * to display additional graphs based on data collected into {@link AppBase#stats}.
 */
class MiniStats {
    /**
     * Create a new MiniStats instance.
     *
     * @param {AppBase} app - The application.
     * @param {MiniStatsOptions} [options] - Options for the MiniStats instance.
     * @example
     * // create a new MiniStats instance using default options
     * const miniStats = new pc.MiniStats(app);
     */
    constructor(app, options = MiniStats.getDefaultOptions()) {
        const device = app.graphicsDevice;

        // create graphs
        this.initGraphs(app, device, options);

        // extract list of words
        const words = new Set(
            ['', 'ms', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '-', ' ']
            .concat(this.graphs.map(graph => graph.name))
            .concat(options.stats ? options.stats.map(stat => stat.unitsName) : [])
            .filter(item => !!item)
        );

        // always add lowercase and uppercase letters (needed for "max" display and GPU pass names)
        for (let i = 97; i <= 122; i++) {
            words.add(String.fromCharCode(i));
        }
        for (let i = 65; i <= 90; i++) {
            words.add(String.fromCharCode(i));
        }

        this.wordAtlas = new WordAtlas(device, words);
        this.sizes = options.sizes;
        this._activeSizeIndex = options.startSizeIndex;

        // if GPU pass tracking is enabled, use the last width for medium/large sizes
        if (options.showGpuPasses) {
            const lastWidth = this.sizes[this.sizes.length - 1].width;
            for (let i = 1; i < this.sizes.length - 1; i++) {
                this.sizes[i].width = lastWidth;
            }
        }

        // create click region so we can resize
        const div = document.createElement('div');
        div.setAttribute('id', 'mini-stats');
        div.style.cssText = 'position:fixed;bottom:0;left:0;background:transparent;';
        document.body.appendChild(div);

        div.addEventListener('mouseenter', (event) => {
            this.opacity = 1.0;
        });

        div.addEventListener('mouseleave', (event) => {
            // larger sizes have higher default opacity
            this.opacity = this._activeSizeIndex > 0 ? 0.85 : 0.7;
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
        // initial opacity depends on starting size
        this.clr = [1, 1, 1, options.startSizeIndex > 0 ? 0.85 : 0.7];

        this._enabled = true;

        // GPU pass tracking
        this.showGpuPasses = options.showGpuPasses;
        this.gpuPassGraphs = new Map(); // Map<passName, { graph, lastNonZeroFrame }>
        this.frameIndex = 0;
        this.textRefreshRate = options.textRefreshRate;

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
        this.gpuPassGraphs.clear();
        this.wordAtlas.destroy();
        this.texture.destroy();
        this.div.remove();
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
            ],

            // enable GPU pass tracking
            showGpuPasses: true
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

        // update opacity based on size (larger sizes have higher default opacity)
        this.opacity = value > 0 ? 0.85 : 0.7;

        // delete GPU pass graphs when switching to smallest size, they'll be recreated when switching back
        if (this.gpuPassGraphs && value === 0) {
            for (const passData of this.gpuPassGraphs.values()) {
                // remove from graphs array
                const index = this.graphs.indexOf(passData.graph);
                if (index !== -1) {
                    this.graphs.splice(index, 1);
                }
                passData.graph.destroy();
            }
            this.gpuPassGraphs.clear();

            // update yOffset for remaining graphs
            this.graphs.forEach((graph, i) => {
                graph.yOffset = i;
            });

            // resize texture if needed
            this.resizeTexture();
        }
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
     * @param {AppBase} app - The application.
     * @param {GraphicsDevice} device - The graphics device.
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

        this.texture = new Texture(device, {
            name: 'mini-stats-graph-texture',
            width: 1,
            height: 1,
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

            // timing (average value)
            const timingText = graph.timingText;
            for (let j = 0; j < timingText.length; ++j) {
                x += wordAtlas.render(render2d, timingText[j], x, y);
            }

            // max value (only on larger sizes)
            if (graph.maxText && this._activeSizeIndex > 0) {
                x += 5;
                x += wordAtlas.render(render2d, 'max', x, y);
                x += 5;

                const maxText = graph.maxText;
                for (let j = 0; j < maxText.length; ++j) {
                    x += wordAtlas.render(render2d, maxText[j], x, y);
                }
            }

            // units (at the end, after both average and max)
            if (graph.timer.unitsName) {
                x += wordAtlas.render(render2d, graph.timer.unitsName, x, y);
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
        this.div.style.left = `${rect.left}px`;
        this.div.style.bottom = `${window.innerHeight - rect.bottom}px`;
        this.div.style.width = `${this.width}px`;
        this.div.style.height = `${this.overallHeight}px`;
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
     * Update GPU pass graphs dynamically based on timing data.
     *
     * @private
     */
    updateGpuPassGraphs() {
        if (!this.showGpuPasses) {
            return;
        }

        // don't create GPU pass graphs on smallest size
        if (this._activeSizeIndex === 0) {
            return;
        }

        const gpuStats = this.app.stats.gpu;
        if (!gpuStats) {
            return;
        }

        const removeAfterFrames = 240;  // frames with 0 timing before removing pass
        const passesToRemove = [];
        const initialGraphCount = this.graphs.length;

        // check existing GPU passes for removal
        for (const [passName, passData] of this.gpuPassGraphs) {
            const timing = gpuStats.get(passName) || 0;

            if (timing > 0) {
                // update last non-zero frame
                passData.lastNonZeroFrame = this.frameIndex;
            } else if (removeAfterFrames > 0) {
                // check if we should remove this pass
                if (this.frameIndex - passData.lastNonZeroFrame > removeAfterFrames) {
                    passesToRemove.push(passName);
                }
            }
        }

        // remove passes that have been zero for too long
        for (const passName of passesToRemove) {
            const passData = this.gpuPassGraphs.get(passName);
            if (passData) {
                // remove from graphs array
                const index = this.graphs.indexOf(passData.graph);
                if (index !== -1) {
                    this.graphs.splice(index, 1);
                }
                passData.graph.destroy();
                this.gpuPassGraphs.delete(passName);
            }
        }

        // scan for new GPU passes
        for (const [passName, timing] of gpuStats) {
            if (!this.gpuPassGraphs.has(passName)) {
                // create new graph for this pass
                const graphName = `  ${passName}`;  // indent with 2 spaces

                // initial watermark (will be synced to main GPU graph)
                const watermark = 10.0;

                const timer = new StatsTimer(this.app, [`gpu.${passName}`], 1, 'ms', 1);
                const graph = new Graph(graphName, this.app, watermark, this.textRefreshRate, timer);

                graph.texture = this.texture;

                // match the current display mode (graphs enabled/disabled)
                const currentSize = this.sizes[this._activeSizeIndex];
                graph.enabled = currentSize.graphs;

                // find the GPU graph index and insert before it (graphs render bottom to top)
                let gpuGraphIndex = this.graphs.findIndex(g => g.name === 'GPU');
                if (gpuGraphIndex === -1) {
                    gpuGraphIndex = 0;  // fallback to start if GPU graph not found
                }

                // find where to insert - right before the GPU graph, after any existing GPU pass graphs
                let insertIndex = gpuGraphIndex;
                for (let i = gpuGraphIndex - 1; i >= 0; i--) {
                    // check if this is an indented GPU pass (starts with spaces after trim would show content)
                    if (this.graphs[i].name.startsWith(' ')) {
                        insertIndex = i;
                    } else {
                        break;
                    }
                }

                // insert the new graph at the correct position
                this.graphs.splice(insertIndex, 0, graph);

                this.gpuPassGraphs.set(passName, {
                    graph: graph,
                    lastNonZeroFrame: timing > 0 ? this.frameIndex : this.frameIndex - removeAfterFrames - 1
                });
            }
        }

        // update yOffset and resize texture if any graphs were added or removed
        if (this.graphs.length !== initialGraphCount) {
            this.graphs.forEach((graph, i) => {
                graph.yOffset = i;
            });
            this.resizeTexture();
        }

        // sync all GPU pass watermarks to match main GPU graph
        const mainGpuGraph = this.graphs.find(g => g.name === 'GPU');
        if (mainGpuGraph) {
            for (const passData of this.gpuPassGraphs.values()) {
                passData.graph.watermark = mainGpuGraph.watermark;
            }
        }

        this.frameIndex++;
    }

    /**
     * Resize the texture to accommodate the current number of graphs.
     *
     * @private
     */
    resizeTexture() {
        const maxWidth = this.sizes[this.sizes.length - 1].width;
        const requiredWidth = math.nextPowerOfTwo(maxWidth);
        const requiredHeight = math.nextPowerOfTwo(this.graphs.length);

        this.texture.resize(requiredWidth, requiredHeight);
    }

    /**
     * Called when the `postrender` event is fired by the application.
     *
     * @private
     */
    postRender() {
        if (this._enabled) {
            this.updateGpuPassGraphs();
            this.render();
        }
    }
}

export { MiniStats };
