Object.assign(pc, function () {
    'use strict';

    var Render2d = function (device, maxQuads) {
        maxQuads = maxQuads || 128;

        var vertexShader = " \
            attribute vec4 vertex_position; \
            varying vec2 uv0; \
            void main(void) { \
                gl_Position = vec4(vertex_position.xy * 2.0 - 1.0, 0.5, 1.0); \
                uv0 = vertex_position.zw; \
            } \
        ";

        var fragmentShader = " \
            varying vec2 uv0; \
            uniform sampler2D source; \
            uniform vec4 clr; \
            void main (void) { \
                gl_FragColor = texture2D(source, uv0) * clr; \
            } \
        ";

        var format = new pc.VertexFormat(device, [ {
            semantic: pc.SEMANTIC_POSITION,
            components: 4,
            type: pc.TYPE_FLOAT32
        }]);

        this.device = device;
        this.shader = pc.shaderChunks.createShaderFromCode(device,
                                                           vertexShader,
                                                           fragmentShader,
                                                           "mini-stats");
        this.buffer = new pc.VertexBuffer(device, format, maxQuads * 6, pc.BUFFER_STREAM);
        this.data = new Float32Array(maxQuads * 6 * 4);
        this.prims = [];
        this.prim = null;
        this.primIndex = -1;
        this.quads = 0;

        this.clrId = device.scope.resolve('clr');
        this.clr = new Float32Array(4);
    };

    Object.assign(Render2d.prototype, {
        quad: function (texture, x, y, w, h, u, v) {
            var quad = this.quads++;

            // update primitive
            var prim = this.prim;
            if (prim && prim.texture === texture) {
                prim.count += 6;
            } else {
                this.primIndex++;
                if (this.primIndex === this.prims.length) {
                    prim = {
                        type: pc.PRIMITIVE_TRIANGLES,
                        indexed: false,
                        base: quad * 6,
                        count: 6,
                        texture: texture
                    };
                    this.prims.push(prim);
                } else {
                    prim = this.prims[this.primIndex];
                    prim.base = quad * 6;
                    prim.count = 6;
                    prim.texture = texture;
                }
                this.prim = prim;
            }

            // update vertex data
            var sw = this.device.width;
            var sh = this.device.height;
            var tw = texture.width;
            var th = texture.height;

            var x0 = x / sw;
            var y0 = y / sh;
            var u0 = u / tw;
            var v0 = v / th;

            var x1 = (x + w) / sw;
            var y1 = (y + h) / sh;
            var u1 = (u + w) / tw;
            var v1 = (v + h) / th;

            this.data.set([x0, y0, u0, v0,
                           x1, y0, u1, v0,
                           x1, y1, u1, v1,
                           x0, y0, u0, v0,
                           x1, y1, u1, v1,
                           x0, y1, u0, v1], 6 * 4 * quad);
        },

        render: function (clr) {
            var device = this.device;
            var buffer = this.buffer;

            // set vertex data (swap storage)
            buffer.setData(this.data.buffer);

            device.updateBegin();
            device.setDepthTest(false);
            device.setDepthWrite(false);
            device.setCullMode(pc.CULLFACE_NONE);
            device.setBlending(true);
            device.setBlendFunction(pc.BLENDMODE_SRC_ALPHA, pc.BLENDMODE_ONE_MINUS_SRC_ALPHA);
            device.setVertexBuffer(buffer, 0);
            device.setShader(this.shader);

            this.clr.set(clr, 0);
            this.clrId.setValue(clr);

            for (var i = 0; i <= this.primIndex; ++i) {
                var prim = this.prims[i];
                device.constantTexSource.setValue(prim.texture);
                device.draw(prim);
            }

            device.updateEnd();

            // reset
            this.prim = null;
            this.primIndex = -1;
            this.quads = 0;
        }
    });

    var RenderText = function (device, words) {
        var canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 32;

        var context = canvas.getContext('2d', { alpha: true });

        context.fillStyle = "rgb(0, 0, 0, 0)";
        context.rect(0, 0, context.width, context.height);
        context.fill();

        // configure the context
        context.font = '10px "Lucida Console", Monaco, monospace';
        context.textAlign = "left";
        context.textBaseline = "alphabetic";
        context.fillStyle = "rgb(255, 255, 255)";

        var padding = 5;
        var x = padding;
        var y = 32 - padding;
        var placements = [ ];
        var i;

        for (i = 0; i < words.length; ++i) {
            // render the word
            context.fillText(words[i], x, y);

            // store measurements
            var measurement = context.measureText(words[i]);

            var placement = {
                x: Math.floor(x + measurement.actualBoundingBoxLeft),
                y: Math.floor(32 - (y - measurement.actualBoundingBoxDescent)),
                w: Math.ceil(measurement.width),
                h: Math.ceil(measurement.actualBoundingBoxAscent + measurement.actualBoundingBoxDescent)
            };

            x += placement.w + padding;
            placements.push(placement);
        }

        // copy context to texture, but make sure entire colour channel is white
        var source = context.getImageData(0, 0, canvas.width, canvas.height).data;

        var texture = new pc.Texture(device, {
            name: 'mini-map-words',
            width: canvas.width,
            height: canvas.height,
            mipmaps: false
        });

        // copy context alpha channel into texture
        var data = texture.lock();
        for (y = 0; y < canvas.height; ++y) {
            for (x = 0; x < canvas.width; ++x) {
                var offset = (x + y * canvas.width) * 4;
                data[offset] = 255;
                data[offset + 1] = 255;
                data[offset + 2] = 255;
                data[offset + 3] = source[(x + (canvas.height - 1 - y) * canvas.width) * 4 + 3];
            }
        }
        texture.unlock();
        texture.upload();

        var wordMap = { };
        words.forEach(function (w, i) {
            wordMap[w] = i;
        });

        this.device = device;
        this.texture = texture;
        this.placements = placements;
        this.shader = this.device.getCopyShader();
        this.wordMap = wordMap;
    };

    Object.assign(RenderText.prototype, {
        render: function (render2d, word, x, y) {
            var placement = this.placements[this.wordMap[word]];
            if (placement) {
                render2d.quad(this.texture, x, y, placement.w, placement.h, placement.x, placement.y);
                return placement.w;
            }
            return 0;
        }
    });

    var Graph = function (app, timer, width, height) {
        this.device = app.graphicsDevice;
        this.name = name;
        this.timer = timer;
        this.enabled = false;

        this.avgTotal = 0;
        this.avgTimer = 0;
        this.avgCount = 0;
        this.timingText = "";

        this.texture = null;
        this.slivver = null;
        this.cursor = 0;

        this.init(width, height);

        app.on('framestart', this.update.bind(this));
    };

    Object.assign(Graph.prototype, {
        init: function (width, height) {
            var texture = new pc.Texture(this.device, {
                name: 'mini-stats',
                width: width,
                height: height,
                mipmaps: false
            });
            var source = texture.lock();
            for (var i = 0; i < source.length/4; ++i) {
                source[i * 4] = 0;
                source[i * 4 + 1] = 0;
                source[i * 4 + 2] = 0;
                source[i * 4 + 3] = 255;
            }
            texture.unlock();
            texture.upload();

            this.texture = texture;
            this.slivver = new Uint8Array(height * 4);
            this.cursor = 0;
        },

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
                var timingColors = [
                    [255,96,96,255],
                    [96,255,96,255],
                    [96,96,255,255],
                    [196,196,196,255]
                ];

                var black = [0, 0, 0, 255];

                // update texture with new timings
                var texture = this.texture;
                var slivver = this.slivver;
                var w = texture.width;
                var h = texture.height;
                var y = 0;
                var index = 0;
                for (var i = 0; i < timings.length; ++i) {
                    var pixels = Math.min(h - y, Math.floor(timings[i] * (h / 48.0)));
                    var color = timingColors[i % timingColors.length];
                    for (var j = 0; j < pixels; ++j) {
                        slivver.set(color, index);
                        index += 4;
                        y++;
                    }
                }

                while (y < h) {
                    slivver.set(black, index);
                    index += 4;
                    y++;
                }

                // update the texture
                var gl = this.device.gl;
                this.device.bindTexture(this.texture);
                gl.texSubImage2D(gl.TEXTURE_2D, 0, this.cursor, 0, 1, h, gl.RGBA, gl.UNSIGNED_BYTE, this.slivver, 0);

                this.cursor++;
                if (this.cursor === w) {
                    this.cursor = 0;
                }
            }
        },

        render: function (render2d, x, y) {
            var texture = this.texture;
            render2d.quad(texture, x, y, texture.width, texture.height, this.cursor, 0);
        },
    });

    var FrameTimer = function (app) {
        this.ms = 0;

        var self = this;

        app.on('framestart', function (ms) {
            self.ms = ms;
        });
    };

    Object.defineProperty(FrameTimer.prototype, 'timings', {
        get: function () {
            return [this.ms];
        }
    });

    var MiniStats = function (app) {
        var device = app.graphicsDevice;

        var sizes = [
            [90, 16],
            [128, 32],
            [256, 64]
        ];
        var size = 0;
        var gw = sizes[size][0];
        var gh = sizes[size][1];

        var graphs = [];
        graphs.push({
            name: 'Frame',
            graph: new Graph(app, new FrameTimer(app), gw, gh)
        });
        graphs.push({
            name: 'CPU',
            graph: new Graph(app, new pc.CpuTimer(app), gw, gh)
        });
        if (device.extDisjointTimerQuery) {
            graphs.push({
                name: 'GPU',
                graph: new Graph(app, new pc.GpuTimer(app), gw, gh)
            });
        }

        var render2d = new Render2d(device);
        var renderText = new RenderText(device, [ "Frame", "CPU", "GPU", "ms", "0", "1", "2", "3", "4" , "5", "6" , "7", "8", "9", "." ]);

        var gspacing = 2;
        var clr = [1, 1, 1, 0.6];

        app.on('frameend', function () {
            var i, j, gx, gy;

            // render graphs
            gx = gy = 0;
            for (i = 0; i < graphs.length; ++i) {
                var graph = graphs[i];
                graph.graph.render(render2d, gx, gy);
                gy += gh + gspacing;
            }

            // render text
            gx = gy = 0;
            for (i = 0; i < graphs.length; ++i) {
                var graph = graphs[i];
                var x = gx;
                var y = gy + gh - 12;

                // name
                x += renderText.render(render2d, graph.name, x, y);

                // space
                x += 10;

                // timing
                var timingText = graph.graph.timingText;
                for (j = 0; j < timingText.length; ++j) {
                    x += renderText.render(render2d, timingText[j], x, y);
                }

                // ms
                renderText.render(render2d, 'ms', x, y);

                gy += gh + gspacing;
            }

            render2d.render(clr);
        });

        // calculate height of all graphs
        var overallHeight = function() {
            return gh * graphs.length + gspacing * (graphs.length - 1);
        };

        // create click region so we can resize
        var div = document.createElement('div');
        div.style.cssText = 'position:fixed;bottom:0;left:0;background:transparent;width:' + gw + 'px;height:' + overallHeight() + 'px';
        document.body.appendChild(div);

        div.addEventListener('mouseenter', function (event) {
            clr[3] = 1.0;
        });

        div.addEventListener('mouseleave', function (event) {
            clr[3] = 0.5;
        });

        div.addEventListener('click', function (event) {
            event.preventDefault();

            size = (size + 1) % sizes.length;
            gw = sizes[size][0];
            gh = sizes[size][1];
            for (i = 0; i < graphs.length; ++i) {
                graphs[i].graph.init(gw, gh);
                graphs[i].graph.enabled = size != 0;
            }

            div.style.width = gw + "px";
            div.style.height = overallHeight() + "px";
        });
    };

    return {
        MiniStats: MiniStats
    };
}());
