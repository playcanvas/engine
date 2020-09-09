import { CpuTimer } from './cpu-timer.js';
import { GpuTimer } from './gpu-timer.js';
import { Graph } from './graph.js';
import { WordAtlas } from './word-atlas.js';
import { FrameTimer } from './frame-timer.js';
import { Render2d } from './render2d.js';

// MiniStats rendering of CPU and GPU timing information
function MiniStats(app) {
    var device = app.graphicsDevice;

    // create the texture for storing word atlas and graph data
    var texture = new pc.Texture(device, {
        name: 'mini-stats',
        width: 256,
        height: 32,
        mipmaps: false,
        minFilter: pc.FILTER_NEAREST,
        magFilter: pc.FILTER_NEAREST
    });

    var wordAtlas = new WordAtlas(
        texture,
        ["Frame", "CPU", "GPU", "ms", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "."]
    );

    // initialize data bottom 4 rows with black
    var dest = texture.lock();
    for (var i = 0; i < texture.width * 4; ++i) {
        dest.set([0, 0, 0, 255], i * 4);
    }
    texture.unlock();

    // ensure texture is uploaded
    device.setTexture(texture, 0);

    // create graphs
    var graphs = [
        new Graph('Frame', app, new FrameTimer(app), texture, 1),
        new Graph('CPU', app, new CpuTimer(app), texture, 2)
    ];
    if (device.extDisjointTimerQuery) {
        graphs.push(new Graph('GPU', app, new GpuTimer(app), texture, 3));
    }

    var sizes = [
        { width: 100, height: 16, graphs: false },
        { width: 128, height: 32, graphs: true },
        { width: 256, height: 64, graphs: true }
    ];
    var size = 0;

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
            size = (size + 1) % sizes.length;
            self.resize(sizes[size].width, sizes[size].height, sizes[size].graphs);
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
    this.wordAtlas = wordAtlas;
    this.render2d = new Render2d(device);
    this.graphs = graphs;
    this.div = div;

    this.width = 0;
    this.height = 0;
    this.gspacing = 2;
    this.clr = [1, 1, 1, 0.5];

    this._enabled = true;

    this.resize(sizes[size].width, sizes[size].height, sizes[size].graphs);
}

Object.defineProperties(MiniStats.prototype, {
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
            return this.height * graphs.length + this.gspacing * (graphs.length - 1);
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

            // ms
            wordAtlas.render(render2d, 'ms', x, y);
        }

        render2d.render(this.clr);
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
