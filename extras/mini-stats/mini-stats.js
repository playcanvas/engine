import { CpuTimer } from './cpu-timer.js';
import { GpuTimer } from './gpu-timer.js';
import { StatsTimer } from './stats-timer.js';
import { Graph } from './graph.js';
import { WordAtlas } from './word-atlas.js';
import { Render2d } from './render2d.js';
import { Color } from '../../src/core/color.js';
import { math } from '../../src/math/math.js';

// MiniStats rendering of CPU and GPU timing information
function MiniStats(app, options) {

    var device = app.graphicsDevice;
    options = options || MiniStats.getDefaultOptions();

    // create graphs based on options
    var graphs = this.initGraphs(app, device, options);

    // extract words needed
    var words = ["", "ms", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "."];

    // graph names
    graphs.forEach(function (graph) {
        words.push(graph.name);
    });

    // stats units
    if (options.stats) {
        options.stats.forEach(function (stat) {
            if (stat.unitsName)
                words.push(stat.unitsName);
        });
    }

    // remove duplicates
    words = words.filter(function (item, index) {
        return words.indexOf(item) >= index;
    });

    // create word atlas
    var maxWidth = options.sizes.reduce(function (max, v) {
        return v.width > max ? v.width : max;
    }, 0);
    var wordAtlasData = this.initWordAtlas(device, words, maxWidth, graphs.length);
    var texture = wordAtlasData.texture;

    // assign texture to graphs
    graphs.forEach(function (graph, i) {
        graph.texture = texture;
        graph.yOffset = i;
    });

    this.sizes = options.sizes;
    this._activeSizeIndex = options.startSizeIndex;

    var self = this;

    // create click region so we can resize
    var div = document.createElement('div');
    div.style.cssText = 'position:fixed;bottom:0;left:0;background:transparent;';
    document.body.appendChild(div);

    div.addEventListener('mouseenter', function (event) {
        self.opacity = 1.0;
    });

    div.addEventListener('mouseleave', function (event) {
        self.opacity = 0.5;
    });

    div.addEventListener('click', function (event) {
        event.preventDefault();
        if (self._enabled) {
            self.activeSizeIndex = (self.activeSizeIndex + 1) % self.sizes.length;
            self.resize(self.sizes[self.activeSizeIndex].width, self.sizes[self.activeSizeIndex].height, self.sizes[self.activeSizeIndex].graphs);
        }
    });

    device.on("resizecanvas", function () {
        self.updateDiv();
    });

    app.on('postrender', function () {
        if (self._enabled) {
            self.render();
        }
    });

    this.device = device;
    this.texture = texture;
    this.wordAtlas = wordAtlasData.atlas;
    this.render2d = new Render2d(device, options.colors);
    this.graphs = graphs;
    this.div = div;

    this.width = 0;
    this.height = 0;
    this.gspacing = 2;
    this.clr = [1, 1, 1, 0.5];

    this._enabled = true;

    // initial resize
    this.activeSizeIndex = this._activeSizeIndex;
}

MiniStats.getDefaultOptions = function () {
    return {

        // sizes of area to render individual graphs in and spacing between indivudual graphs
        sizes: [
            { width: 128, height: 16, spacing: 0, graphs: false },
            { width: 128, height: 32, spacing: 2, graphs: true },
            { width: 256, height: 64, spacing: 2, graphs: true }
        ],

        // index into sizes array for initial setting
        startSizeIndex: 0,

        // refresh rate of text stats in ms
        textRefreshRate: 500,

        // colors used to render graphs
        colors: {
            graph0: new Color(0.7, 0.2, 0.2, 1),
            graph1: new Color(0.2, 0.7, 0.2, 1),
            graph2: new Color(0.2, 0.2, 0.7, 1),
            watermark: new Color(0.4, 0.4, 0.2, 1),
            background: new Color(0, 0, 0, 1.0)
        },

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

        // array of options to render additional graphs based on stats collected into pc.Application.stats
        stats: [
            {
                // display name
                name: "Frame",

                // path to data inside pc.Application.stats
                stats: ["frame.ms"],

                // number of decimal places (defaults to none)
                decimalPlaces: 1,

                // units (defaults to "")
                unitsName: "ms",

                // watermark - shown as a line on the graph, useful for displaying a budget
                watermark: 33
            },

            // total number of draw calls
            {
                name: "DrawCalls",
                stats: ["drawCalls.total"],
                watermark: 1000
            }
        ]
    };
};

Object.defineProperties(MiniStats.prototype, {
    activeSizeIndex: {
        get: function () {
            return this._activeSizeIndex;
        },
        set: function (value) {
            this._activeSizeIndex = value;
            this.gspacing = this.sizes[value].spacing;
            this.resize(this.sizes[value].width, this.sizes[value].height, this.sizes[value].graphs);
        }
    },

    opacity: {
        get: function () {
            return this.clr[3];
        },
        set: function (value) {
            this.clr[3] = value;
        }
    },

    overallHeight: {
        get: function () {
            var graphs = this.graphs;
            var spacing = this.gspacing;
            return this.height * graphs.length + spacing * (graphs.length - 1);
        }
    },

    enabled: {
        get: function () {
            return this._enabled;
        },
        set: function (value) {
            if (value !== this._enabled) {
                this._enabled = value;
                for (var i = 0; i < this.graphs.length; ++i) {
                    this.graphs[i].enabled = value;
                    this.graphs[i].timer.enabled = value;
                }
            }
        }
    }
});

Object.assign(MiniStats.prototype, {

    initWordAtlas: function (device, words, maxWidth, numGraphs) {

        // create the texture for storing word atlas and graph data
        var texture = new pc.Texture(device, {
            name: 'mini-stats',
            width: math.nextPowerOfTwo(maxWidth),
            height: 64,
            mipmaps: false,
            minFilter: pc.FILTER_NEAREST,
            magFilter: pc.FILTER_NEAREST
        });

        var wordAtlas = new WordAtlas(texture, words);

        var dest = texture.lock();
        for (var i = 0; i < texture.width * numGraphs; ++i) {
            dest.set([0, 0, 0, 255], i * 4);
        }
        texture.unlock();

        // ensure texture is uploaded
        device.setTexture(texture, 0);

        return { atlas: wordAtlas, texture: texture };
    },

    initGraphs: function (app, device, options) {

        var graphs = [];
        if (options.cpu.enabled) {
            graphs.push(new Graph('CPU', app, options.cpu.watermark, options.textRefreshRate, new CpuTimer(app)));
        }

        if (options.gpu.enabled && device.extDisjointTimerQuery) {
            graphs.push(new Graph('GPU', app, options.gpu.watermark, options.textRefreshRate, new GpuTimer(app)));
        }

        if (options.stats) {
            options.stats.forEach(function (entry) {
                graphs.push(new Graph(entry.name, app, entry.watermark, options.textRefreshRate, new StatsTimer(app, entry.stats, entry.decimalPlaces, entry.unitsName, entry.multiplier)));
            });
        }

        return graphs;
    },

    render: function () {
        var graphs = this.graphs;
        var wordAtlas = this.wordAtlas;
        var render2d = this.render2d;
        var width = this.width;
        var height = this.height;
        var gspacing = this.gspacing;

        var i, j, x, y, graph;

        for (i = 0; i < graphs.length; ++i) {
            graph = graphs[i];

            y = i * (height + gspacing);

            // render the graph
            graph.render(render2d, 0, y, width, height);

            // render the text
            x = 1;
            y += height - 13;

            // name + space
            x += wordAtlas.render(render2d, graph.name, x, y) + 10;

            // timing
            var timingText = graph.timingText;
            for (j = 0; j < timingText.length; ++j) {
                x += wordAtlas.render(render2d, timingText[j], x, y);
            }

            // units
            if (graph.timer.unitsName) {
                x += 3;
                wordAtlas.render(render2d, graph.timer.unitsName, x, y);
            }
        }

        render2d.render(this.clr, height);
    },

    resize: function (width, height, showGraphs) {
        var graphs = this.graphs;
        for (var i = 0; i < graphs.length; ++i) {
            graphs[i].enabled = showGraphs;
        }

        this.width = width;
        this.height = height;

        this.updateDiv();
    },

    updateDiv: function () {
        var rect = this.device.canvas.getBoundingClientRect();
        this.div.style.left = rect.left + "px";
        this.div.style.bottom = (window.innerHeight - rect.bottom) + "px";
        this.div.style.width = this.width + "px";
        this.div.style.height = this.overallHeight + "px";
    }
});

export { MiniStats };
