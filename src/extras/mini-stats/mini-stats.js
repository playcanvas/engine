import { math } from '../../core/math/math.js';
import { Texture } from '../../platform/graphics/texture.js';
import { ADDRESS_REPEAT, FILTER_LINEAR } from '../../platform/graphics/constants.js';
import { LAYERID_UI } from '../../scene/constants.js';
import { CpuTimer } from './cpu-timer.js';
import { GpuTimer } from './gpu-timer.js';
import { StatsTimer } from './stats-timer.js';
import { Graph } from './graph.js';
import { WordAtlas } from './word-atlas.js';
import { Render2d } from './render2d.js';

/**
 * @import { AppBase } from '../../framework/app-base.js'
 * @import { AppStats } from '../../framework/app-stats.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 */

const cpuStatDisplayNames = {
    scriptUpdate: 'Script update',
    scriptPostUpdate: 'Script post-update',
    animUpdate: 'Animation',
    physicsTime: 'Physics',
    renderTime: 'Render',
    gsplatSort: 'Splat sort'
};
const vramStatDisplayNames = { tex: 'Textures', geom: 'Geometry', buffers: 'Buffers' };
const cpuStatNames = ['renderTime', 'scriptUpdate', 'scriptPostUpdate', 'animUpdate', 'physicsTime', 'gsplatSort'];
const vramStatNames = ['tex', 'geom', 'buffers'];

// Packed RGBA bytes for the vertex color attribute. The overlay is authored in display space.
const BACKGROUND = 0xff231b15;
const GROUP_BACKGROUND = 0xff372b22;
const BORDER = 0xff4e3d30;
const TEXT = 0xfffaf5f2;
const MUTED = 0xffc8b8ad;
const graphColors = [0xff6db1d9, 0xfff7b884, 0xffb6d16d, 0xffdda0b8];

const graphOrder = graph => (graph.label === 'Draw calls' ? 0 : graph.name === 'Frame' ? 1 : graph.group + 2);
const compareGraphs = (a, b) => graphOrder(a) - graphOrder(b);

/**
 * @typedef {object} MiniStatsSizeOptions
 * @property {number} width - Width of the graph area.
 * @property {number} height - Height of the graph area.
 * @property {number} spacing - Spacing between graphs.
 * @property {boolean} graphs - Whether to show graphs.
 * @property {boolean} [detailed] - Show category headers and sub-counters. Defaults to true for
 * sizes after the first, or when graphs are enabled.
 * @property {boolean} [peak] - Show a peak column in the detailed view. Defaults to the graphs setting.
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
 * @property {number} [multiplier=1] - Multiplier applied to sampled values, for example to convert
 * bytes to megabytes.
 * @property {number} [watermark] - Watermark - shown as a line on the graph, useful for displaying
 * a budget.
 */

/**
 * @typedef {object} MiniStatsOptions
 * @property {MiniStatsSizeOptions[]} sizes - Sizes of area to render individual graphs in and
 * spacing between individual graphs.
 * @property {number} startSizeIndex - Index into sizes array for initial setting.
 * @property {number} textRefreshRate - Text update interval and averaging window in ms (500 in the
 * default options). Each update shows the arithmetic mean and peak of the frame samples collected
 * since the previous update, then starts a new window. Graph history samples every frame.
 * @property {MiniStatsProcessorOptions} cpu - CPU graph options.
 * @property {MiniStatsProcessorOptions} gpu - GPU graph options.
 * @property {MiniStatsGraphOptions[]} stats - Array of options to render additional graphs based
 * on stats collected into Application.stats.
 * @property {number} [gpuTimingMinSize] - Minimum size index at which to show GPU pass timing
 * graphs. Defaults to 1.
 * @property {number} [cpuTimingMinSize] - Minimum size index at which to show CPU sub-timing
 * graphs (script, anim, physics, render). Defaults to 1.
 * @property {number} [vramTimingMinSize] - Minimum size index at which to show VRAM subcategory
 * graphs. Defaults to 1.
 */

/**
 * MiniStats is a small graphical overlay that displays realtime performance metrics. By default,
 * it shows CPU and GPU durations, frame intervals, draw call count and estimated GPU resource
 * memory. It can also display additional counters from {@link AppBase#stats}.
 *
 * The default CPU timings, including render time, draw call count and memory estimates are
 * available in all builds. GPU timing requires device support and is enabled when MiniStats
 * creates its GPU timer. Some additional counters, such as {@link AppStats#primitiveCount},
 * require a debug or profiler build. See {@link AppStats} for measurement scope and availability.
 */
class MiniStats {
    /**
     * Create a new MiniStats instance.
     *
     * @param {AppBase} app - The application.
     * @param {MiniStatsOptions} [options] - Options for the MiniStats instance.
     * @example
     * const miniStats = new MiniStats(app);
     */
    constructor(app, options = MiniStats.getDefaultOptions()) {
        this.app = app;
        this.device = app.graphicsDevice;
        this.sizes = options.sizes.map(size => ({ ...size }));
        this.graphRows = new Map();
        this.freeRows = [];
        this.nextRowIndex = 0;
        this.gpuPassGraphs = new Map();
        this.cpuGraphs = new Map();
        this.vramGraphs = new Map();
        this.gpuTimingMinSize = options.gpuTimingMinSize ?? 1;
        this.cpuTimingMinSize = options.cpuTimingMinSize ?? 1;
        this.vramTimingMinSize = options.vramTimingMinSize ?? 1;
        this.textRefreshRate = options.textRefreshRate;
        this._averageLabel = `Avg (${this.textRefreshRate / 1000}s)`;
        this.frameIndex = 0;
        this._enabled = true;
        this._destroyed = false;
        this._geometryDirty = true;
        this._layoutDirty = true;
        this._scroll = 0;
        this._maxScroll = 0;
        this._overallHeight = 0;
        this.clr = [1, 1, 1, 0.95];
        this.initGraphs(app, this.device, options);

        const words = ['Metric', this._averageLabel, 'Peak', 'ms', 'MB'];
        for (const graph of this.graphs) {
            words.push(graph.label, graph.timer.unitsName || '');
        }
        words.push(...Object.values(cpuStatDisplayNames), ...Object.values(vramStatDisplayNames));
        this.wordAtlas = new WordAtlas(this.device, words);
        this.render2d = new Render2d(this.device);
        this.drawLayer = app.scene.layers.getLayerById(LAYERID_UI);

        const div = document.createElement('div');
        div.id = 'mini-stats';
        div.style.cssText = 'position:fixed;background:transparent;cursor:pointer;touch-action:none;user-select:none;';
        div.setAttribute('role', 'button');
        div.tabIndex = 0;
        div.title = 'Click to change size. Scroll or drag to view more metrics.';
        document.body.appendChild(div);
        this.div = div;
        let dragging = false;
        let pointerY = 0;
        let startY = 0;
        div.addEventListener('mouseenter', () => {
            this.opacity = 1;
        });
        div.addEventListener('mouseleave', () => {
            this.opacity = 0.95;
        });
        div.addEventListener('click', (event) => {
            event.preventDefault();
            if (this._enabled && !dragging) this.activeSizeIndex = (this.activeSizeIndex + 1) % this.sizes.length;
            dragging = false;
        });
        div.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.activeSizeIndex = (this.activeSizeIndex + 1) % this.sizes.length;
            }
        });
        div.addEventListener('wheel', (event) => {
            if (this._maxScroll > 0) {
                event.preventDefault();
                const multiplier = event.deltaMode === 1 ? this.height : event.deltaMode === 2 ? this._panelHeight : 1;
                this.scroll(event.deltaY * multiplier);
            }
        }, { passive: false });
        div.addEventListener('pointerdown', (event) => {
            dragging = false;
            startY = pointerY = event.clientY;
            if (event.pointerType !== 'mouse') div.setPointerCapture(event.pointerId);
        });
        div.addEventListener('pointermove', (event) => {
            if (event.buttons && event.pointerType !== 'mouse' && this._maxScroll > 0) {
                dragging ||= Math.abs(event.clientY - startY) > 5;
                if (dragging) this.scroll(pointerY - event.clientY);
                pointerY = event.clientY;
            }
        });

        this.device.on('resizecanvas', this.updateDiv, this);
        this.device.on('losecontext', this.loseContext, this);
        app.on('frameupdate', this.update, this);
        app.on('postrender', this.postRender, this);
        app.on('destroy', this.destroy, this);
        this.activeSizeIndex = options.startSizeIndex;
    }

    /**
     * Destroy the MiniStats instance and release its event listeners, textures and mesh.
     *
     * @example
     * miniStats.destroy();
     */
    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;
        this.device.off('resizecanvas', this.updateDiv, this);
        this.device.off('losecontext', this.loseContext, this);
        this.app.off('frameupdate', this.update, this);
        this.app.off('postrender', this.postRender, this);
        this.app.off('destroy', this.destroy, this);
        this.removeQueuedMesh();
        for (let i = 0; i < this.graphs.length; i++) this.graphs[i].destroy();
        this.gpuPassGraphs.clear();
        this.cpuGraphs.clear();
        this.vramGraphs.clear();
        this.graphRows.clear();
        this.wordAtlas.destroy();
        this.texture.destroy();
        this.render2d.destroy();
        this.div.remove();
    }

    /**
     * Predefined stat groups included via {@link MiniStats.getDefaultOptions}.
     *
     * @type {Object<string, MiniStatsGraphOptions[]>}
     * @ignore
     */
    static statPresets = {
        gsplats: [
            { name: 'GSplats', stats: ['frame.gsplats'], decimalPlaces: 3, multiplier: 1 / 1000000, unitsName: 'M', watermark: 10 }
        ],
        gsplatsCopy: [
            { name: 'GsplatsCopy', stats: ['frame.gsplatBufferCopy'], decimalPlaces: 1, multiplier: 1, unitsName: '%', watermark: 100 }
        ]
    };

    /**
     * Returns options for three sizes: compact core counters, grouped averages, and grouped
     * averages and peaks with graph history. Draw calls and frame time appear first, followed by
     * ungrouped counters in their configured order, then CPU, GPU and VRAM.
     *
     * @param {string[]} [extraStats] - Presets to include: 'gsplats' or 'gsplatsCopy'.
     * @returns {MiniStatsOptions} The default options for MiniStats.
     * @example
     * const options = MiniStats.getDefaultOptions(['gsplats']);
     * options.sizes[2].width = 280;
     * const miniStats = new MiniStats(app, options);
     */
    static getDefaultOptions(extraStats = []) {
        const options = {
            sizes: [
                { width: 128, height: 22, spacing: 0, graphs: false, detailed: false, peak: false },
                { width: 176, height: 20, spacing: 0, graphs: false, detailed: true, peak: false },
                { width: 224, height: 22, spacing: 0, graphs: true, detailed: true, peak: true }
            ],
            startSizeIndex: 0,
            textRefreshRate: 500,
            cpu: { enabled: true, watermark: 33 },
            gpu: { enabled: true, watermark: 33 },
            stats: [
                { name: 'DrawCalls', stats: ['drawCalls.total'], watermark: 1000 },
                { name: 'Frame', stats: ['frame.ms'], decimalPlaces: 1, unitsName: 'ms', watermark: 33 },
                { name: 'VRAM', stats: ['vram.totalUsed'], decimalPlaces: 1, multiplier: 1 / (1024 * 1024), unitsName: 'MB', watermark: 1024 }
            ],
            gpuTimingMinSize: 1,
            cpuTimingMinSize: 1,
            vramTimingMinSize: 1
        };
        for (const name of extraStats) options.stats.push(...(MiniStats.statPresets[name] ?? []));
        return options;
    }

    /**
     * Selects the corresponding entry in the sizes array.
     *
     * @type {number}
     * @ignore
     */
    set activeSizeIndex(value) {
        const size = this.sizes[value];
        if (!size) return;
        this._activeSizeIndex = value;
        this._detailed = size.detailed ?? (value > 0 || size.graphs);
        this._showPeak = this._detailed && (size.peak ?? size.graphs);
        this.gspacing = size.spacing;
        this._scroll = 0;
        if (!this._detailed || value < this.gpuTimingMinSize) this.clearSubGraphs(this.gpuPassGraphs);
        if (!this._detailed || value < this.cpuTimingMinSize) this.clearSubGraphs(this.cpuGraphs);
        if (!this._detailed || value < this.vramTimingMinSize) this.clearSubGraphs(this.vramGraphs);
        this.resize(size.width, size.height, size.graphs);
        this.div.setAttribute('aria-label', !this._detailed ? 'MiniStats: compact counters. Change size.' :
            size.graphs ? 'MiniStats: averages, peaks and history. Change size.' : 'MiniStats: grouped averages. Change size.');
    }

    /** @type {number} @ignore */
    get activeSizeIndex() {
        return this._activeSizeIndex;
    }

    /** @type {number} @ignore */
    set opacity(value) {
        this.clr[3] = value;
    }

    /** @type {number} @ignore */
    get opacity() {
        return this.clr[3];
    }

    /** @type {number} @ignore */
    get overallHeight() {
        return this._overallHeight;
    }

    /**
     * Whether the overlay and its counter sampling are enabled. Defaults to true.
     *
     * @type {boolean}
     */
    set enabled(value) {
        if (value !== this._enabled) {
            this._enabled = value;
            for (let i = 0; i < this.graphs.length; i++) {
                this.graphs[i].enabled = value && this._showGraphs;
                this.graphs[i].timer.enabled = value;
            }
            this.div.style.display = value ? 'block' : 'none';
            if (!value) this.removeQueuedMesh();
        }
    }

    /** @type {boolean} */
    get enabled() {
        return this._enabled;
    }

    /** @private */
    removeQueuedMesh() {
        // postrender submits the overlay for the next frame. Remove that pending reference
        // before freeing the mesh, including when its UI layer was not rendered this frame.
        const queued = this.app.scene.immediate?.layerMeshInstances.get(this.drawLayer);
        if (queued) {
            for (let i = queued.length - 1; i >= 0; i--) {
                if (queued[i] === this.render2d.meshInstance) queued.splice(i, 1);
            }
        }
    }

    /**
     * @private
     * @param {AppBase} app - The application.
     * @param {GraphicsDevice} device - The graphics device.
     * @param {MiniStatsOptions} options - Counter configuration.
     */
    initGraphs(app, device, options) {
        this.graphs = [];
        if (options.cpu.enabled) {
            this.cpuGraph = new Graph('CPU', app, options.cpu.watermark, options.textRefreshRate, new CpuTimer(app));
            this.cpuGraph.group = 1;
            this.graphs.push(this.cpuGraph);
        }
        if (options.gpu.enabled) {
            this.gpuGraph = new Graph('GPU', app, options.gpu.watermark, options.textRefreshRate, new GpuTimer(device));
            this.gpuGraph.group = 2;
            this.graphs.push(this.gpuGraph);
        }
        for (const entry of options.stats ?? []) {
            const timer = new StatsTimer(app, entry.stats, entry.decimalPlaces, entry.unitsName, entry.multiplier);
            const graph = new Graph(entry.name, app, entry.watermark, options.textRefreshRate, timer);
            if (entry.name === 'VRAM') {
                graph.group = 3;
                this.vramGraph = graph;
            }
            this.graphs.push(graph);
        }
        this.graphs.sort(compareGraphs);
        this.texture = new Texture(device, {
            name: 'mini-stats-graph-texture',
            width: 1,
            height: 1,
            mipmaps: false,
            minFilter: FILTER_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_REPEAT,
            addressV: ADDRESS_REPEAT
        });
        for (const graph of this.graphs) {
            graph.texture = this.texture;
            this.allocateRow(graph);
        }
    }

    /**
     * @private
     * @param {number} width - Panel width in CSS pixels.
     * @param {number} height - Row height in CSS pixels.
     * @param {boolean} showGraphs - Whether to collect and display history.
     */
    resize(width, height, showGraphs) {
        this.width = width;
        this.height = height;
        this._showGraphs = showGraphs;
        for (let i = 0; i < this.graphs.length; i++) this.graphs[i].enabled = this._enabled && showGraphs;
        this.updateDiv();
    }

    /** @private */
    updateDiv() {
        const rect = this.device.canvas.getBoundingClientRect();
        this.render2d.targetWidth = rect.width;
        this.render2d.targetHeight = rect.height;
        let total = this._detailed ? 31 : 8;
        let previousGroup = -1;
        for (let i = 0; i < this.graphs.length; i++) {
            const group = this.graphs[i].group;
            if (this._detailed && i > 0 && group !== previousGroup) total += 5;
            total += this.height + (i ? this.gspacing : 0);
            previousGroup = group;
        }
        this._overallHeight = total;
        this._fixedRows = 0;
        while (this._fixedRows < this.graphs.length && (this.graphs[this._fixedRows].label === 'Draw calls' || this.graphs[this._fixedRows].name === 'Frame')) {
            this._fixedRows++;
        }
        this._panelWidth = Math.max(0, Math.min(this.width, rect.width - 16));
        this._panelHeight = Math.max(0, Math.min(total, rect.height - 16));
        this._maxScroll = Math.max(0, total - this._panelHeight);
        this._scroll = Math.min(this._scroll, this._maxScroll);
        this.div.style.left = `${rect.left + 8}px`;
        this.div.style.bottom = `${window.innerHeight - rect.bottom + 8}px`;
        this.div.style.width = `${this._panelWidth}px`;
        this.div.style.height = `${this._panelHeight}px`;
        this._layoutDirty = false;
        this._geometryDirty = true;
    }

    /**
     * @private
     * @param {number} delta - Scroll distance in CSS pixels.
     */
    scroll(delta) {
        const value = math.clamp(this._scroll + delta, 0, this._maxScroll);
        if (value !== this._scroll) {
            this._scroll = value;
            this._geometryDirty = true;
        }
    }

    /**
     * @private
     * @param {number} ms - Elapsed frame time in milliseconds.
     */
    update(ms) {
        if (!this._enabled) return;
        const data = this._showGraphs ? this.texture.lock() : null;
        for (let i = 0; i < this.graphs.length; i++) {
            const changed = this.graphs[i].update(ms, data);
            if (changed & (this._showPeak ? 3 : 1)) this._geometryDirty = true;
        }
        if (data) this.texture.unlock();
    }

    /** @private */
    render() {
        if (this._layoutDirty) this.updateDiv();
        if (this._geometryDirty) {
            this.rebuildGeometry();
            this._geometryDirty = false;
        } else if (this._showGraphs) {
            for (let i = 0; i < this.graphs.length; i++) this.render2d.graphCursor(this.graphs[i]);
        }
        this.render2d.render(this.app, this.drawLayer, this.texture, this.wordAtlas.texture, this.clr);
    }

    /** @private */
    rebuildGeometry() {
        const renderer = this.render2d;
        const atlas = this.wordAtlas;
        const x = 8;
        const bottom = 8;
        const width = this._panelWidth;
        const top = bottom + this._panelHeight;
        const right = x + width - 10;
        const avgRight = right - (this._showPeak ? 44 : 0);
        renderer.startFrame();
        renderer.setClip(x, bottom, width, this._panelHeight);
        renderer.rect(x, bottom, width, this._panelHeight, BACKGROUND);
        let rowTop = top - 4;
        if (this._detailed) {
            const baseline = top - 16;
            atlas.render(renderer, 'Metric', x + 10, baseline, 0, MUTED);
            atlas.render(renderer, this._averageLabel, avgRight - atlas.measure(this._averageLabel), baseline, 0, MUTED);
            if (this._showPeak) atlas.render(renderer, 'Peak', right - atlas.measure('Peak'), baseline, 0, MUTED);
            renderer.rect(x, top - 23, width, 1, BORDER);
            rowTop = top - 27;
            renderer.setClip(x, bottom, width, this._panelHeight - 23);
        }
        let previousGroup = -1;
        for (let i = 0; i < this.graphs.length; i++) {
            // Keep draw calls and frame time visible even when a long pass list is scrolled.
            if (i === this._fixedRows) {
                renderer.setClip(x, bottom, width, Math.max(0, rowTop - bottom));
                rowTop += this._scroll;
            }
            const graph = this.graphs[i];
            graph.quad = -1;
            if (this._detailed && i > 0 && graph.group !== previousGroup) rowTop -= 5;
            const y = rowTop - this.height;
            if (y < top && rowTop > bottom) {
                const heading = this._detailed && graph.group > 0 && !graph.parent;
                const color = graphColors[graph.group];
                if (heading) {
                    renderer.rect(x, y, width, this.height, GROUP_BACKGROUND);
                    renderer.rect(x, y + 5, 2, this.height - 10, color);
                }
                if (this._showGraphs) renderer.graph(graph, x, y, width, this.height, color);
                const baseline = Math.round(y + (this.height - 14) / 2 + 3);
                const units = graph.timer.unitsName || '';
                const valueWidth = atlas.measure(graph.timingText, 1);
                let valueRight = avgRight;
                if (!this._detailed && units) {
                    const unitsWidth = atlas.measure(units);
                    atlas.render(renderer, units, right - unitsWidth, baseline, 0, MUTED);
                    valueRight -= unitsWidth + 4;
                }
                const valueX = Math.max(x + 10, valueRight - valueWidth);
                atlas.render(renderer, graph.timingText, valueX, baseline, 1, TEXT, valueRight - valueX);
                if (this._showPeak) {
                    const peakWidth = atlas.measure(graph.maxText);
                    atlas.render(renderer, graph.maxText, right - Math.min(peakWidth, 40), baseline, 0, MUTED, 40);
                }
                const labelX = x + 10 + (this._detailed && graph.parent ? 5 : 0);
                const labelStyle = heading ? 1 : 0;
                const labelWidth = atlas.render(renderer, graph.label, labelX, baseline, labelStyle, heading ? TEXT : MUTED,
                    valueX - labelX - 8 - (this._detailed && units && !graph.parent ? atlas.measure(units) + 4 : 0));
                if (this._detailed && units && !graph.parent) {
                    atlas.render(renderer, units, labelX + labelWidth + 4, baseline, 0, MUTED, valueX - labelX - labelWidth - 8);
                }
            }
            rowTop = y - this.gspacing;
            previousGroup = graph.group;
        }
    }

    /** @private */
    loseContext() {
        for (let i = 0; i < this.graphs.length; i++) this.graphs[i].loseContext();
        this.render2d.dirty = true;
    }

    /**
     * @private
     * @param {Graph} graph - The graph receiving a persistent history row.
     * @returns {number} Allocated row index.
     */
    allocateRow(graph) {
        const row = this.freeRows.length ? this.freeRows.pop() : this.nextRowIndex++;
        this.ensureTextureHeight(this.nextRowIndex);
        this.graphRows.set(graph, row);
        graph.yOffset = row;
        graph.needsClear = true;
        return row;
    }

    /**
     * @private
     * @param {number} requiredRows - Minimum number of texture rows.
     */
    ensureTextureHeight(requiredRows) {
        let maxWidth = 1;
        for (let i = 0; i < this.sizes.length; i++) maxWidth = Math.max(maxWidth, this.sizes[i].width);
        const width = math.nextPowerOfTwo(maxWidth);
        const height = math.nextPowerOfTwo(Math.max(1, requiredRows));
        if (width > this.texture.width || height > this.texture.height) {
            const oldWidth = this.texture.width;
            const oldHeight = this.texture.height;
            const oldData = this.texture.lock();
            this.texture.unlock();
            this.texture.resize(Math.max(width, oldWidth), Math.max(height, oldHeight));
            const data = this.texture.lock();
            for (let row = 0; row < oldHeight; row++) {
                data.set(oldData.subarray(row * oldWidth * 4, (row + 1) * oldWidth * 4), row * this.texture.width * 4);
            }
            this.texture.unlock();
            this._geometryDirty = true;
        }
    }

    /**
     * @private
     * @param {Graph} graph - The sub-counter to remove.
     */
    removeGraph(graph) {
        const index = this.graphs.indexOf(graph);
        if (index !== -1) this.graphs.splice(index, 1);
        this.freeRows.push(this.graphRows.get(graph));
        this.graphRows.delete(graph);
        graph.destroy();
        this._layoutDirty = true;
    }

    /**
     * @private
     * @param {Map<string, Graph>} map - Sub-counters to remove.
     */
    clearSubGraphs(map) {
        map.forEach(this.removeGraph, this);
        map.clear();
    }

    /**
     * @private
     * @param {Map<string, Graph>} map - Sub-counter lookup.
     * @param {Graph} parent - The category total.
     * @param {string} name - The literal stat key.
     * @param {number} value - Current sampled value.
     * @param {string} prefix - The stats object containing the key.
     * @param {boolean} delayed - Wait for a positive sample before adding the row.
     */
    updateSubStat(map, parent, name, value, prefix, delayed) {
        if (!parent) return;
        let graph = map.get(name);
        if (!graph) {
            if (delayed && !(value > 0)) return;
            const units = prefix === 'vram' ? 'MB' : 'ms';
            const timer = new StatsTimer(this.app, [name], 1, units, prefix === 'vram' ? 1 / (1024 * 1024) : 1);
            // GPU pass names are literal Map keys and may themselves contain dots.
            timer.paths[0] = [prefix, name];
            graph = new Graph(name, this.app, parent.watermark, this.textRefreshRate, timer);
            graph.label = prefix === 'frame' ? cpuStatDisplayNames[name] : prefix === 'vram' ? vramStatDisplayNames[name] : name;
            graph.parent = parent;
            graph.group = parent.group;
            graph.statName = name;
            graph.texture = this.texture;
            graph.enabled = this._showGraphs;
            this.allocateRow(graph);
            let index = this.graphs.indexOf(parent) + 1;
            while (index < this.graphs.length && this.graphs[index].parent === parent) index++;
            this.graphs.splice(index, 0, graph);
            map.set(name, graph);
            this._layoutDirty = true;
        }
        graph.watermark = parent.watermark;
        if (value > 0) graph.lastNonZeroFrame = this.frameIndex;
    }

    /**
     * @private
     * @param {number} value - Pass duration in milliseconds.
     * @param {string} name - Literal GPU pass name.
     */
    updateGpuPass(value, name) {
        this.updateSubStat(this.gpuPassGraphs, this.gpuGraph, name, value, 'gpu', true);
    }

    /** @private */
    postRender() {
        if (!this._enabled) return;
        this.frameIndex++;
        if (this._detailed) {
            if (this.gpuGraph && this.activeSizeIndex >= this.gpuTimingMinSize) {
                this.app.stats.gpu?.forEach(this.updateGpuPass, this);
                for (let i = this.graphs.length - 1; i >= 0; i--) {
                    const graph = this.graphs[i];
                    if (graph.parent === this.gpuGraph && this.frameIndex - graph.lastNonZeroFrame > 240) {
                        this.gpuPassGraphs.delete(graph.statName);
                        this.removeGraph(graph);
                    }
                }
            }
            if (this.cpuGraph && this.activeSizeIndex >= this.cpuTimingMinSize) {
                const frame = this.app.stats.frame;
                for (let i = 0; i < cpuStatNames.length; i++) {
                    const name = cpuStatNames[i];
                    this.updateSubStat(this.cpuGraphs, this.cpuGraph, name, frame[name], 'frame', i >= 3);
                }
            }
            if (this.vramGraph && this.activeSizeIndex >= this.vramTimingMinSize) {
                const vram = this.app.stats.vram;
                const count = this.device.isWebGPU ? 3 : 2;
                for (let i = 0; i < count; i++) {
                    const name = vramStatNames[i];
                    this.updateSubStat(this.vramGraphs, this.vramGraph, name, vram[name], 'vram', false);
                }
            }
        }
        this.render();
    }
}

export { MiniStats };
