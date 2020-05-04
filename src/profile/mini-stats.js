// #ifndef RELEASE_BUILD

Object.assign(pc, function () {
    'use strict';

    // render 2d textured quads

    var Render2d = function (device, maxQuads) {
        maxQuads = maxQuads || 128;

        var vertexShader =
            'attribute vec4 vertex_position;' +
            'varying vec2 uv0;' +
            'void main(void) {' +
            '    gl_Position = vec4(vertex_position.xy * 2.0 - 1.0, 0.5, 1.0);' +
            '    uv0 = vertex_position.zw;' +
            '}';

        var fragmentShader =
            'varying vec2 uv0;\n' +
            'uniform sampler2D source;\n' +
            'uniform vec4 clr;\n' +
            'void main (void) {\n' +
            '    gl_FragColor = texture2D(source, uv0) * clr;\n' +
            '}\n';

        var format = new pc.VertexFormat(device, [{
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
            var sw = this.device.width / window.devicePixelRatio;
            var sh = this.device.height / window.devicePixelRatio;
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

            this.data.set([
                x0, y0, u0, v0,
                x1, y0, u1, v0,
                x1, y1, u1, v1,
                x0, y0, u0, v0,
                x1, y1, u1, v1,
                x0, y1, u0, v1
            ], 6 * 4 * quad);
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
            device.setBlendFunctionSeparate(pc.BLENDMODE_SRC_ALPHA,
                                            pc.BLENDMODE_ONE_MINUS_SRC_ALPHA,
                                            pc.BLENDMODE_ONE,
                                            pc.BLENDMODE_ONE);
            device.setBlendEquationSeparate(pc.BLENDEQUATION_ADD, pc.BLENDEQUATION_ADD);
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

    // Word atlas

    var WordAtlas = function (words) {
        var canvas = document.createElement('canvas');
        canvas.width = 90;
        canvas.height = 64;

        // configure the context
        var context = canvas.getContext('2d', { alpha: true });
        context.font = '10px "Lucida Console", Monaco, monospace';
        context.textAlign = "left";
        context.textBaseline = "alphabetic";
        context.fillStyle = "rgb(255, 255, 255)";

        var padding = 5;
        var x = padding;
        var y = padding;
        var placements = [];
        var i;

        for (i = 0; i < words.length; ++i) {
            // measurement word
            var measurement = context.measureText(words[i]);

            var l = Math.ceil(-measurement.actualBoundingBoxLeft);
            var r = Math.ceil(measurement.actualBoundingBoxRight);
            var a = Math.ceil(measurement.actualBoundingBoxAscent);
            var d = Math.ceil(measurement.actualBoundingBoxDescent);

            var w = l + r;
            var h = a + d;

            // wrap text
            if (x + w >= canvas.width) {
                x = padding;
                y += 16;
            }

            // render the word
            context.fillText(words[i], x - l, y + a);

            var placement = {
                l: l,
                r: r,
                a: a,
                d: d,
                x: x,
                y: y,
                w: w,
                h: h
            };

            x += placement.w + padding;
            placements.push(placement);
        }

        var wordMap = { };
        words.forEach(function (w, i) {
            wordMap[w] = i;
        });

        this.source = context.getImageData(0, 0, canvas.width, canvas.height);
        this.words = words;
        this.wordMap = wordMap;
        this.placements = placements;
        this.texture = null;
    };

    Object.assign(WordAtlas.prototype, {
        init: function (texture) {
            // copy context alpha channel into texture
            var source = this.source;
            var dest = texture.lock();
            for (var y = 0; y < source.height; ++y) {
                for (var x = 0; x < source.width; ++x) {
                    var offset = (x + y * texture.width) * 4;
                    dest[offset] = 255;
                    dest[offset + 1] = 255;
                    dest[offset + 2] = 255;
                    dest[offset + 3] = source.data[(x + (source.height - 1 - y) * source.width) * 4 + 3];
                }
            }
            this.texture = texture;
        },

        render: function (render2d, word, x, y) {
            if (this.texture) {
                var p = this.placements[this.wordMap[word]];
                var padding = 1;
                if (p) {
                    render2d.quad(this.texture,
                                  x + p.l - padding,
                                  y - p.d + padding,
                                  p.w + padding * 2,
                                  p.h + padding * 2,
                                  p.x - padding,
                                  64 - p.y - p.h - padding);
                    return p.w;
                }
            }
            return 0;
        }
    });

    // Realtime performance graph

    var Graph = function (app, timer) {
        this.device = app.graphicsDevice;
        this.timer = timer;
        this.enabled = false;

        this.avgTotal = 0;
        this.avgTimer = 0;
        this.avgCount = 0;
        this.timingText = "";

        this.texture = null;
        this.width = 0;
        this.height = 0;
        this.yOffset = 0;
        this.slivver = null;
        this.cursor = 0;

        app.on('frameupdate', this.update.bind(this));
    };

    Object.assign(Graph.prototype, {
        init: function (texture, width, height, yOffset) {
            this.texture = texture;
            this.width = width;
            this.height = height;
            this.yOffset = yOffset;
            this.slivver = new Uint8Array(height * 4);
            this.cursor = 0;
        },

        update: function (ms) {
            if (!this.texture) {
                return;
            }

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
                    [255, 96, 96, 255],
                    [96, 255, 96, 255],
                    [96, 96, 255, 255],
                    [196, 196, 196, 255]
                ];

                var black = [0, 0, 0, 255];

                // update texture with new timings
                var slivver = this.slivver;
                var w = this.width;
                var h = this.height;
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

                // write slivver to the texture
                var gl = this.device.gl;
                this.device.bindTexture(this.texture);
                gl.texSubImage2D(gl.TEXTURE_2D, 0, this.cursor, this.yOffset, 1, h, gl.RGBA, gl.UNSIGNED_BYTE, this.slivver);

                this.cursor++;
                if (this.cursor === w) {
                    this.cursor = 0;
                }
            }
        },

        render: function (render2d, x, y) {
            var texture = this.texture;
            if (texture) {
                render2d.quad(texture, x, y, this.width, this.height, this.cursor, this.yOffset);
            }
        }
    });

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

    // MiniStats rendering of CPU and GPU timing information

    var MiniStats = function (app) {
        var device = app.graphicsDevice;

        var render2d = new Render2d(device);
        var wordAtlas = new WordAtlas(["Frame", "CPU", "GPU", "ms", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "."]);
        var graphs = [];
        graphs.push({
            name: 'Frame',
            graph: new Graph(app, new FrameTimer(app))
        });
        graphs.push({
            name: 'CPU',
            graph: new Graph(app, new pc.CpuTimer(app))
        });
        if (device.extDisjointTimerQuery) {
            graphs.push({
                name: 'GPU',
                graph: new Graph(app, new pc.GpuTimer(app))
            });
        }

        // initialize the graphs to the specified size
        var init = function (size) {
            var i;

            // create a texture to store the graphs and word atlas
            var texture = new pc.Texture(device, {
                name: 'mini-stats',
                width: size.width,
                height: 64 + size.height * graphs.length,
                mipmaps: false
            });

            var source = texture.lock();
            for (i = 0; i < source.length / 4; ++i) {
                source[i * 4] = 0;
                source[i * 4 + 1] = 0;
                source[i * 4 + 2] = 0;
                source[i * 4 + 3] = 255;
            }

            // word atlas uses top 64 rows of pixels
            wordAtlas.init(texture);

            var yOffset = 64;
            for (i = 0; i < graphs.length; ++i) {
                graphs[i].graph.init(texture, size.width, size.height, yOffset);
                graphs[i].graph.enabled = size.graphs;
                yOffset += size.height;
            }

            texture.unlock();
            // wrap u for graphs, but not v because otherwise words atlas interferes
            texture.addressU = pc.ADDRESS_REPEAT;
            texture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
            device.setTexture(texture, 0);
        };

        var gspacing = 2;
        var clr = [1, 1, 1, 0.5];

        var render = function (render2d, size) {
            var i, j, gx, gy, graph;

            // render graphs
            gx = gy = 0;
            for (i = 0; i < graphs.length; ++i) {
                graph = graphs[i];
                graph.graph.render(render2d, gx, gy);
                gy += size.height + gspacing;
            }

            // render text
            gx = gy = 0;
            for (i = 0; i < graphs.length; ++i) {
                graph = graphs[i];
                var x = gx + 1;
                var y = gy + size.height - 13;

                // name
                x += wordAtlas.render(render2d, graph.name, x, y);

                // space
                x += 10;

                // timing
                var timingText = graph.graph.timingText;
                for (j = 0; j < timingText.length; ++j) {
                    x += wordAtlas.render(render2d, timingText[j], x, y);
                }

                // ms
                wordAtlas.render(render2d, 'ms', x, y);

                gy += size.height + gspacing;
            }

            render2d.render(clr);
        };

        // possible graph sizes
        var sizes = [
            { width: 100, height: 16, graphs: false },
            { width: 128, height: 32, graphs: true },
            { width: 256, height: 64, graphs: true }
        ];

        // the currently selected graph size
        var size = sizes[0];

        // create click region so we can resize
        var div = document.createElement('div');
        div.style.cssText = 'position:fixed;bottom:0;left:0;background:transparent;';
        document.body.appendChild(div);

        var resize = function (size) {
            init(size);
            div.style.width = size.width + "px";
            div.style.height = size.height * graphs.length + gspacing * (graphs.length - 1) + "px";
        };

        resize(size);

        div.addEventListener('mouseenter', function (event) {
            clr[3] = 1.0;
        });

        div.addEventListener('mouseleave', function (event) {
            clr[3] = 0.5;
        });

        div.addEventListener('click', function (event) {
            event.preventDefault();
            size = sizes[(sizes.indexOf(size) + 1) % sizes.length];
            resize(size);
        });

        device.on("resizecanvas", function () {
            var rect = device.canvas.getBoundingClientRect();
            div.style.left = rect.left + "px";
            div.style.bottom = (window.innerHeight - rect.bottom) + "px";
        });

        app.on('postrender', function () {
            render(render2d, size);
        });
    };

    return {
        MiniStats: MiniStats
    };
}());

// #endif
