/**
 * @license
 * PlayCanvas Engine v1.34.0-dev revision 7397d249
 * Copyright 2011-2020 PlayCanvas Ltd. All rights reserved.
 */
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(global = global || self, factory(global.pcx = {}));
}(this, (function (exports) { 'use strict';

	function CpuTimer(app) {
		this._frameIndex = 0;
		this._frameTimings = [];
		this._timings = [];
		this._prevTimings = [];
		this.enabled = true;
		app.on('frameupdate', this.begin.bind(this, 'update'));
		app.on('framerender', this.mark.bind(this, 'render'));
		app.on('frameend', this.mark.bind(this, 'other'));
	}
	Object.assign(CpuTimer.prototype, {
		begin: function (name) {
			if (!this.enabled) {
				return;
			}
			if (this._frameIndex < this._frameTimings.length) {
				this._frameTimings.splice(this._frameIndex);
			}
			var tmp = this._prevTimings;
			this._prevTimings = this._timings;
			this._timings = this._frameTimings;
			this._frameTimings = tmp;
			this._frameIndex = 0;
			this.mark(name);
		},
		mark: function (name) {
			if (!this.enabled) {
				return;
			}
			var timestamp = pc.now();
			var prev;
			if (this._frameIndex > 0) {
				prev = this._frameTimings[this._frameIndex - 1];
				prev[1] = timestamp - prev[1];
			} else if (this._timings.length > 0) {
				prev = this._timings[this._timings.length - 1];
				prev[1] = timestamp - prev[1];
			}
			if (this._frameIndex >= this._frameTimings.length) {
				this._frameTimings.push([name, timestamp]);
			} else {
				var timing = this._frameTimings[this._frameIndex];
				timing[0] = name;
				timing[1] = timestamp;
			}
			this._frameIndex++;
		}
	});
	Object.defineProperty(CpuTimer.prototype, 'timings', {
		get: function () {
			return this._timings.slice(0, -1).map(function (v) {
				return v[1];
			});
		}
	});

	function GpuTimer(app) {
		this._gl = app.graphicsDevice.gl;
		this._ext = app.graphicsDevice.extDisjointTimerQuery;
		this._freeQueries = [];
		this._frameQueries = [];
		this._frames = [];
		this._timings = [];
		this._prevTimings = [];
		this.enabled = true;
		app.on('frameupdate', this.begin.bind(this, 'update'));
		app.on('framerender', this.mark.bind(this, 'render'));
		app.on('frameend', this.end.bind(this));
	}
	Object.assign(GpuTimer.prototype, {
		begin: function (name) {
			if (!this.enabled) {
				return;
			}
			if (this._frameQueries.length > 0) {
				this.end();
			}
			this._checkDisjoint();
			if (this._frames.length > 0) {
				if (this._resolveFrameTimings(this._frames[0], this._prevTimings)) {
					var tmp = this._prevTimings;
					this._prevTimings = this._timings;
					this._timings = tmp;
					this._freeQueries = this._freeQueries.concat(this._frames.splice(0, 1)[0]);
				}
			}
			this.mark(name);
		},
		mark: function (name) {
			if (!this.enabled) {
				return;
			}
			if (this._frameQueries.length > 0) {
				this._gl.endQuery(this._ext.TIME_ELAPSED_EXT);
			}
			var query = this._allocateQuery();
			query[0] = name;
			this._gl.beginQuery(this._ext.TIME_ELAPSED_EXT, query[1]);
			this._frameQueries.push(query);
		},
		end: function () {
			if (!this.enabled) {
				return;
			}
			this._gl.endQuery(this._ext.TIME_ELAPSED_EXT);
			this._frames.push(this._frameQueries);
			this._frameQueries = [];
		},
		_checkDisjoint: function () {
			var disjoint = this._gl.getParameter(this._ext.GPU_DISJOINT_EXT);
			if (disjoint) {
				this._freeQueries = [this._frames, [this._frameQueries], [this._freeQueries]].flat(2);
				this._frameQueries = [];
				this._frames = [];
			}
		},
		_allocateQuery: function () {
			return (this._freeQueries.length > 0) ?
				this._freeQueries.splice(-1, 1)[0] : ["", this._gl.createQuery()];
		},
		_resolveFrameTimings: function (frame, timings) {
			if (!this._gl.getQueryParameter(frame[frame.length - 1][1], this._gl.QUERY_RESULT_AVAILABLE)) {
				return false;
			}
			for (var i = 0; i < frame.length; ++i) {
				timings[i] = [frame[i][0], this._gl.getQueryParameter(frame[i][1], this._gl.QUERY_RESULT) * 0.000001];
			}
			return true;
		}
	});
	Object.defineProperty(GpuTimer.prototype, 'timings', {
		get: function () {
			return this._timings.map(function (v) {
				return v[1];
			});
		}
	});

	function Render2d(device, maxQuads) {
		maxQuads = maxQuads || 128;
		var vertexShader =
			'attribute vec2 vertex_position;\n' +
			'attribute vec4 vertex_texCoord0;\n' +
			'uniform vec4 screenAndTextureSize;\n' +
			'varying vec4 uv0;\n' +
			'void main(void) {\n' +
			'	vec2 pos = vertex_position.xy / screenAndTextureSize.xy;\n' +
			'	gl_Position = vec4(pos * 2.0 - 1.0, 0.5, 1.0);\n' +
			'	uv0 = vec4(vertex_texCoord0.xy / screenAndTextureSize.zw, vertex_texCoord0.zw);\n' +
			'}\n';
		var fragmentShader =
			'varying vec4 uv0;\n' +
			'uniform vec4 clr;\n' +
			'uniform sampler2D source;\n' +
			'void main (void) {\n' +
			'	vec4 tex = texture2D(source, uv0.xy);\n' +
			'	if (tex.rgb != vec3(1, 1, 1)) {\n' +
			'	   if (uv0.w < tex.r)\n' +
			'		   tex = vec4(1.0, 0.3, 0.3, 1.0);\n' +
			'	   else if (uv0.w < tex.g)\n' +
			'		   tex = vec4(0.3, 1.0, 0.3, 1.0);\n' +
			'	   else\n' +
			'		   tex = vec4(0.0, 0.0, 0.0, 1.0);\n' +
			'	}\n' +
			'	gl_FragColor = tex * clr;\n' +
			'}\n';
		var format = new pc.VertexFormat(device, [{
			semantic: pc.SEMANTIC_POSITION,
			components: 2,
			type: pc.TYPE_FLOAT32
		}, {
			semantic: pc.SEMANTIC_TEXCOORD0,
			components: 4,
			type: pc.TYPE_FLOAT32
		}]);
		var indices = new Uint16Array(maxQuads * 6);
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
		this.indexBuffer = new pc.IndexBuffer(device, pc.INDEXFORMAT_UINT16, maxQuads * 6, pc.BUFFER_STATIC, indices);
		this.prims = [];
		this.prim = null;
		this.primIndex = -1;
		this.quads = 0;
		this.clrId = device.scope.resolve('clr');
		this.clr = new Float32Array(4);
		this.screenTextureSizeId = device.scope.resolve('screenAndTextureSize');
		this.screenTextureSize = new Float32Array(4);
	}
	Object.assign(Render2d.prototype, {
		quad: function (texture, x, y, w, h, u, v, uw, uh) {
			var quad = this.quads++;
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
			var x1 = x + w;
			var y1 = y + h;
			var u1 = u + (uw === undefined ? w : uw);
			var v1 = v + (uh === undefined ? h : uh);
			this.data.set([
				x,  y,  u,  v,  0, 0,
				x1, y,  u1, v,  1, 0,
				x1, y1, u1, v1, 1, 1,
				x,  y1, u,  v1, 0, 1
			], 4 * 6 * quad);
		},
		render: function (clr) {
			var device = this.device;
			var buffer = this.buffer;
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
			var pr = Math.min(device.maxPixelRatio, window.devicePixelRatio);
			this.clr.set(clr, 0);
			this.clrId.setValue(this.clr);
			this.screenTextureSize[0] = device.width / pr;
			this.screenTextureSize[1] = device.height / pr;
			for (var i = 0; i <= this.primIndex; ++i) {
				var prim = this.prims[i];
				this.screenTextureSize[2] = prim.texture.width;
				this.screenTextureSize[3] = prim.texture.height;
				this.screenTextureSizeId.setValue(this.screenTextureSize);
				device.constantTexSource.setValue(prim.texture);
				device.draw(prim);
			}
			device.updateEnd();
			this.prim = null;
			this.primIndex = -1;
			this.quads = 0;
		}
	});
	function WordAtlas(texture, words) {
		var canvas = document.createElement('canvas');
		canvas.width = texture.width;
		canvas.height = texture.height;
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
			var measurement = context.measureText(words[i]);
			var l = Math.ceil(-measurement.actualBoundingBoxLeft);
			var r = Math.ceil(measurement.actualBoundingBoxRight);
			var a = Math.ceil(measurement.actualBoundingBoxAscent);
			var d = Math.ceil(measurement.actualBoundingBoxDescent);
			var w = l + r;
			var h = a + d;
			if (x + w >= canvas.width) {
				x = padding;
				y += 16;
			}
			context.fillText(words[i], x - l, y + a);
			placements.push({
				l: l, r: r, a: a, d: d,
				x: x, y: y, w: w, h: h
			});
			x += w + padding;
		}
		var wordMap = { };
		words.forEach(function (w, i) {
			wordMap[w] = i;
		});
		this.words = words;
		this.wordMap = wordMap;
		this.placements = placements;
		this.texture = texture;
		var source = context.getImageData(0, 0, canvas.width, canvas.height);
		var dest = texture.lock();
		for (y = 0; y < source.height; ++y) {
			for (x = 0; x < source.width; ++x) {
				var offset = (x + y * texture.width) * 4;
				dest[offset] = 255;
				dest[offset + 1] = 255;
				dest[offset + 2] = 255;
				dest[offset + 3] = source.data[(x + (source.height - 1 - y) * source.width) * 4 + 3];
			}
		}
	}
	Object.assign(WordAtlas.prototype, {
		render: function (render2d, word, x, y) {
			var p = this.placements[this.wordMap[word]];
			if (p) {
				var padding = 1;
				render2d.quad(this.texture,
							  x + p.l - padding,
							  y - p.d + padding,
							  p.w + padding * 2,
							  p.h + padding * 2,
							  p.x - padding,
							  64 - p.y - p.h - padding);
				return p.w;
			}
			return 0;
		}
	});
	function Graph(name, app, timer, texture, yOffset) {
		this.name = name;
		this.device = app.graphicsDevice;
		this.timer = timer;
		this.enabled = false;
		this.avgTotal = 0;
		this.avgTimer = 0;
		this.avgCount = 0;
		this.timingText = "";
		this.texture = texture;
		this.yOffset = yOffset;
		this.cursor = 0;
		this.sample = new Uint8Array(4);
		this.sample.set([0, 0, 0, 255]);
		app.on('frameupdate', this.update.bind(this));
		this.counter = 0;
	}
	Object.assign(Graph.prototype, {
		update: function (ms) {
			var timings = this.timer.timings;
			var total = timings.reduce(function (a, v) {
				return a + v;
			}, 0);
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
				var value = 0;
				for (var i = 0; i < timings.length; ++i) {
					value = Math.min(255, value + Math.floor(timings[i] * (255.0 / 48.0)));
					this.sample[i] = value;
				}
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
				this.cursor++;
				if (this.cursor === this.texture.width) {
					this.cursor = 0;
				}
			}
		},
		render: function (render2d, x, y, w, h) {
			if (this.enabled) {
				render2d.quad(this.texture,
							  x + w,
							  y,
							  -w,
							  h,
							  this.cursor,
							  0.5 + this.yOffset,
							  -w, 0);
			}
		}
	});
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
	function MiniStats(app) {
		var device = app.graphicsDevice;
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
		var dest = texture.lock();
		for (var i = 0; i < texture.width * 4; ++i) {
			dest.set([0, 0, 0, 255], i * 4);
		}
		texture.unlock();
		device.setTexture(texture, 0);
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
				graph.render(render2d, 0, y, width, height);
				x = 1;
				y += height - 13;
				x += wordAtlas.render(render2d, graph.name, x, y) + 10;
				var timingText = graph.timingText;
				for (j = 0; j < timingText.length; ++j) {
					x += wordAtlas.render(render2d, timingText[j], x, y);
				}
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

	exports.MiniStats = MiniStats;

	Object.defineProperty(exports, '__esModule', { value: true });

})));
