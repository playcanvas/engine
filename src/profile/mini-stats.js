// #ifndef RELEASE

Object.assign(pc, function () {
    'use strict';

    // render 2d textured quads

    var Render2d = function (device, maxQuads) {
        maxQuads = maxQuads || 128;

        var vertexShader =
            'attribute vec4 vertex_position;\n' +       // unnormalized quad position in xy and vertex offset in zw
            'attribute vec2 vertex_texCoord0;\n' +      // unnormalized texture uv
            'uniform vec4 screenAndTextureSize;\n' +    // xy: screen size, zw: texture size
            'varying vec4 uv0;\n' +
            'void main(void) {\n' +
            '    vec2 pos = (vertex_position.xy + vertex_position.zw) / screenAndTextureSize.xy;\n' +
            '    gl_Position = vec4(pos * 2.0 - 1.0, 0.5, 1.0);\n' +
            '    uv0 = vec4(vertex_texCoord0 / screenAndTextureSize.zw, vertex_position.zw / 255.0);\n' +
            '}\n';

        // this fragment shader renders the bits required for text and graphs. The text is identified
        // in the texture by its white color channel. The graph data is specified as a single row of
        // pixels where the R channel denotes the height of the 1st graph and the G channel the height
        // of the second graph (the B channel could also be used, but is currently not).
        var fragmentShader =
            'varying vec4 uv0;\n' +
            'uniform vec4 clr;\n' +
            'uniform sampler2D source;\n' +
            'void main (void) {\n' +
            '    vec4 tex = texture2D(source, uv0.xy);\n' +
            '    if (tex.rgb != vec3(1, 1, 1)) {\n' +
            '       if (uv0.w < tex.r)\n' +
            '           tex = vec4(1.0, 0.3, 0.3, 1.0);\n' +
            '       else if (uv0.w < tex.g)\n' +
            '           tex = vec4(0.3, 1.0, 0.3, 1.0);\n' +
            '       else\n' +
            '           tex = vec4(0.0, 0.0, 0.0, 1.0);\n' +
            '    }\n' +
            '    gl_FragColor = tex * clr;\n' +
            '}\n';

        var format = new pc.VertexFormat(device, [{
            semantic: pc.SEMANTIC_POSITION,
            components: 4,
            type: pc.TYPE_FLOAT32
        }, {
            semantic: pc.SEMANTIC_TEXCOORD0,
            components: 2,
            type: pc.TYPE_FLOAT32
        }]);

        // generate quad indices
        var indices = new Uint32Array(maxQuads * 6);
        for (var i = 0; i < maxQuads; ++i) {
            indices[i * 6 + 0] = i * 4;
            indices[i * 6 + 1] = i * 4 + 1;
            indices[i * 6 + 2] = i * 4 + 2;
            indices[i * 6 + 3] = i * 4;
            indices[i * 6 + 4] = i * 4 + 2;
            indices[i * 6 + 5] = i * 4 + 3;
        }

        this.device = device;
        this.shader = pc.shaderChunks.createShaderFromCode(device,
                                                           vertexShader,
                                                           fragmentShader,
                                                           "mini-stats");
        this.buffer = new pc.VertexBuffer(device, format, maxQuads * 4, pc.BUFFER_STREAM);
        this.data = new Float32Array(this.buffer.numBytes / 4);

        this.indexBuffer = new pc.IndexBuffer(device, pc.INDEXFORMAT_UINT32, maxQuads * 6, pc.BUFFER_STATIC, indices);

        this.prims = [];
        this.prim = null;
        this.primIndex = -1;
        this.quads = 0;

        this.clrId = device.scope.resolve('clr');
        this.clr = new Float32Array(4);

        this.screenTextureSizeId = device.scope.resolve('screenAndTextureSize');
        this.screenTextureSize = new Float32Array(4);
    };

    Object.assign(Render2d.prototype, {
        quad: function (texture, x, y, w, h, u, v, uw, uh) {
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
                        indexed: true,
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

            var u0 = u;
            var v0 = v;
            var u1 = u + (uw === undefined ? w : uw);
            var v1 = v + (uh === undefined ? h : uh);

            this.data.set([
                x, y, 0, 0, u0, v0,
                x, y, w, 0, u1, v0,
                x, y, w, h, u1, v1,
                x, y, 0, h, u0, v1
            ], 4 * 6 * quad);
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
            device.setIndexBuffer(this.indexBuffer);
            device.setShader(this.shader);

            // set shader uniforms
            this.clr.set(clr, 0);
            this.clrId.setValue(this.clr);
            this.screenTextureSize[0] = this.device.width / window.devicePixelRatio;
            this.screenTextureSize[1] = this.device.height / window.devicePixelRatio;

            for (var i = 0; i <= this.primIndex; ++i) {
                var prim = this.prims[i];
                this.screenTextureSize[2] = prim.texture.width;
                this.screenTextureSize[3] = prim.texture.height;
                this.screenTextureSizeId.setValue(this.screenTextureSize);
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
        this.cursor = 0;
        this.sample = new Uint8Array(4);

        app.on('frameupdate', this.update.bind(this));
    };

    Object.assign(Graph.prototype, {
        init: function (texture, width, height, yOffset) {
            this.texture = texture;
            this.width = width;
            this.height = height;
            this.yOffset = yOffset;
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
                // update sample with timings
                var value = 0;

                for (var i = 0; i < timings.length; ++i) {
                    value = Math.min(255, value + Math.floor(timings[i] * (this.height / 48.0)));
                    this.sample[i] = value;
                }

                for (var j = timings.length; j < 4; ++j) {
                    this.sample[j] = 0;
                }

                // write latest sample to the texture
                var gl = this.device.gl;
                this.device.bindTexture(this.texture);
                gl.texSubImage2D(gl.TEXTURE_2D, 0, this.cursor, this.yOffset, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.sample);

                this.cursor++;
                if (this.cursor === this.width) {
                    this.cursor = 0;
                }
            }
        },

        render: function (render2d, x, y) {
            var texture = this.texture;
            if (texture) {
                render2d.quad(texture, x, y, this.width, this.height, this.cursor, this.yOffset, this.width, 0);
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
                height: 64 + graphs.length,
                mipmaps: false
            });

            // word atlas uses top 64 rows of pixels
            wordAtlas.init(texture);

            for (i = 0; i < graphs.length; ++i) {
                graphs[i].graph.init(texture, size.width, size.height, 64 + i);
                graphs[i].graph.enabled = size.graphs;
            }

            texture.unlock();
            // wrap u for graphs, but not v because otherwise words atlas interferes
            texture.addressU = pc.ADDRESS_REPEAT;
            texture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
            texture.magFilter = pc.FILTER_NEAREST;
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
