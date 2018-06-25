Object.assign(pc.Application.prototype, function () {

    var tempGraphNode = new pc.GraphNode();
    var identityGraphNode = new pc.GraphNode();
    var meshInstanceArray = [];

    var _deprecationWarning = false;


    var ImmediateData = function (device) {
        this.lineVertexFormat = new pc.VertexFormat(device, [
            { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 },
            { semantic: pc.SEMANTIC_COLOR, components: 4, type: pc.TYPE_UINT8, normalize: true }
        ]);
        this.lineBatches = [];
        this.layers = [];
        this.layerToBatch = {};
        this.quadMesh = null;
        this.cubeLocalPos = null;
        this.cubeWorldPos = null;
        this.identityGraphNode = new pc.GraphNode();
    };

    ImmediateData.prototype.addLayer = function (layer) {
        if (this.layers.indexOf(layer) < 0) {
            this.layers.push(layer);
        }
    };

    ImmediateData.prototype.getLayerIdx = function (layer) {
        return this.layerToBatch[layer.id];
    };

    ImmediateData.prototype.addLayerIdx = function (idx, layer) {
        this.layerToBatch[layer.id] = idx;
    };

    var LineBatch = function () {
        // Sensible default value; buffers will be doubled and reallocated when it's not enough
        this.numLinesAllocated = 128;

        this.vb = null;
        this.vbRam = null;
        this.mesh = null;
        this.linesUsed = 0;
        this.material = null;
        this.meshInstance = null;

        this.layer = null;
    };

    Object.assign(LineBatch.prototype, {
        init: function (device, vertexFormat, layer, linesToAdd) {
            // Allocate basic stuff once per batch
            if (!this.mesh) {
                this.mesh = new pc.Mesh();
                this.mesh.primitive[0].type = pc.PRIMITIVE_LINES;
                this.mesh.primitive[0].base = 0;
                this.mesh.primitive[0].indexed = false;

                this.material = new pc.BasicMaterial();
                this.material.vertexColors = true;
                this.material.blend = true;
                this.material.blendType = pc.BLEND_NORMAL;
                this.material.update();
            }

            this.layer = layer;

            // Increase buffer size, if it's not enough
            while ((this.linesUsed + linesToAdd) > this.numLinesAllocated) {
                if (this.vb) {
                    this.vb.destroy();
                    this.vb = null;
                }
                this.numLinesAllocated *= 2;
            }

            this.vertexFormat = vertexFormat;

            // (Re)allocate line buffer
            if (!this.vb) {
                this.vb = new pc.VertexBuffer(device, vertexFormat, this.numLinesAllocated * 2, pc.BUFFER_DYNAMIC);
                this.mesh.vertexBuffer = this.vb;
                this.vbRam = new DataView(this.vb.lock());

                if (!this.meshInstance) {
                    identityGraphNode.worldTransform = pc.Mat4.IDENTITY;
                    identityGraphNode._dirtyWorld = identityGraphNode._dirtyNormal = false;
                    this.meshInstance = new pc.MeshInstance(identityGraphNode, this.mesh, this.material);
                    this.meshInstance.cull = false;
                }
            }
        },

        addLines: function (position, color) {
            // Append lines to buffer
            var multiColor = !!color.length;
            var offset = this.linesUsed * 2 * this.vertexFormat.size;
            var clr;
            for (var i = 0; i < position.length; i++) {
                this.vbRam.setFloat32(offset, position[i].x, true); offset += 4;
                this.vbRam.setFloat32(offset, position[i].y, true); offset += 4;
                this.vbRam.setFloat32(offset, position[i].z, true); offset += 4;
                clr = multiColor ? color[i] : color;
                this.vbRam.setUint8(offset, clr.r * 255); offset += 1;
                this.vbRam.setUint8(offset, clr.g * 255); offset += 1;
                this.vbRam.setUint8(offset, clr.b * 255); offset += 1;
                this.vbRam.setUint8(offset, clr.a * 255); offset += 1;
            }
            this.linesUsed += position.length / 2;
        },

        finalize: function () {
            // Update batch vertex buffer/issue drawcall if there are any lines
            if (this.linesUsed > 0) {
                this.vb.setData(this.vbRam.buffer);
                this.mesh.primitive[0].count = this.linesUsed * 2;
                meshInstanceArray[0] = this.meshInstance;
                this.layer.addMeshInstances(meshInstanceArray, true);
                this.linesUsed = 0;
            }
        }
    });

    function _initImmediate() {
        // Init global line drawing data once
        if (!this._immediateData) {
            this._immediateData = new ImmediateData(this.graphicsDevice);

            this.on('prerender', this._preRenderImmediate, this);
            this.on('postrender', this._postRenderImmediate, this);
        }
    }

    function _addLines(position, color, options) {
        if (options.layer === undefined) options.layer = this.scene.layers.getLayerById(pc.LAYERID_IMMEDIATE);
        if (options.depthTest === undefined) options.depthTest = true;

        this._initImmediate();

        var layer = options.layer;
        this._immediateData.addLayer(layer);

        var idx = this._immediateData.getLayerIdx(layer);
        if (idx === undefined) {
            // Init used batch once
            var batch = new LineBatch();
            batch.init(this.graphicsDevice, this._immediateData.lineVertexFormat, layer, position.length / 2);
            batch.material.depthTest = options.depthTest;
            if (options.mask) batch.meshInstance.mask = options.mask;

            idx = this._immediateData.lineBatches.push(batch) - 1; // push into list and get index
            this._immediateData.addLayerIdx(idx, layer);
        } else {
            // Possibly reallocate buffer if it's small
            this._immediateData.lineBatches[idx].init(this.graphicsDevice, this._immediateData.lineVertexFormat, layer, position.length / 2);
            this._immediateData.lineBatches[idx].material.depthTest = options.depthTest;
            if (options.mask) this._immediateData.lineBatches[idx].meshInstance.mask = options.mask;
        }
        // Append
        this._immediateData.lineBatches[idx].addLines(position, color);
    }

    /**
     * @function
     * @name pc.Application#renderLine
     * @description Renders a line. Line start and end coordinates are specified in
     * world-space. If a single color is supplied, the line will be flat-shaded with
     * that color. If two colors are supplied, the line will be smooth shaded between
     * those colors. It is also possible to control which scene layer the line is
     * rendered into. By default, lines are rendered into the immediate layer
     * {@link pc.LAYERID_IMMEDIATE}.
     * @param {pc.Vec3} start - The start world-space coordinate of the line.
     * @param {pc.Vec3} end - The end world-space coordinate of the line.
     * @param {pc.Color} color - The start color of the line.
     * @param {pc.Color} [endColor] - The end color of the line.
     * @param {Object} [options] - Options to set rendering properties
     * @param {pc.Layer} [options.layer] - The layer to render the line into. Defaults
     * to {@link pc.LAYERID_IMMEDIATE}.
     * @example
     * // Render a 1-unit long white line
     * var start = new pc.Vec3(0, 0, 0);
     * var end = new pc.Vec3(1, 0, 0);
     * var color = new pc.Color(1, 1, 1);
     * app.renderLine(start, end, color);
     * @example
     * // Render a 1-unit long line that is smooth-shaded from white to red
     * var start = new pc.Vec3(0, 0, 0);
     * var end = new pc.Vec3(1, 0, 0);
     * var startColor = new pc.Color(1, 1, 1);
     * var endColor = new pc.Color(1, 0, 0);
     * app.renderLine(start, end, startColor, endColor);
     * @example
     * // Render a 1-unit long white line into the world layer
     * var start = new pc.Vec3(0, 0, 0);
     * var end = new pc.Vec3(1, 0, 0);
     * var color = new pc.Color(1, 1, 1);
     * var worldLayer = app.scene.layers.getLayerById(pc.LAYERID_WORLD);
     * app.renderLine(start, end, color, {
     *     layer: worldLayer
     * });
     * @example
     * // Render a 1-unit long line that is smooth-shaded from white to red into the world layer
     * var start = new pc.Vec3(0, 0, 0);
     * var end = new pc.Vec3(1, 0, 0);
     * var startColor = new pc.Color(1, 1, 1);
     * var endColor = new pc.Color(1, 0, 0);
     * var worldLayer = app.scene.layers.getLayerById(pc.LAYERID_WORLD);
     * app.renderLine(start, end, color, {
     *     layer: worldLayer
     * });
     */
    function renderLine(start, end, color) {
        var endColor = color;
        var options;

        var arg3 = arguments[3];
        var arg4 = arguments[4];

        if (arg3 instanceof pc.Color) {
            // passed in end color
            endColor = arg3;

            if (typeof arg4 === 'number') {
                if (!_deprecationWarning) {
                    console.warn("lineBatch argument is deprecated for renderLine. Use options.layer instead");
                    _deprecationWarning = true;
                }
                // compatibility: convert linebatch id into options
                if (arg4 === pc.LINEBATCH_OVERLAY) {
                    options = {
                        layer: this.scene.layers.getLayerById(pc.LAYERID_IMMEDIATE),
                        depthTest: false
                    };
                } else {
                    options = {
                        layer: this.scene.layers.getLayerById(pc.LAYERID_IMMEDIATE),
                        depthTest: true
                    };
                }
            } else {
                // use passed in options
                options = arg4;
            }
        } else if (typeof arg3 === 'number') {
            if (!_deprecationWarning) {
                console.warn("lineBatch argument is deprecated for renderLine. Use options.layer instead");
                _deprecationWarning = true;
            }

            endColor = color;

            // compatibility: convert linebatch id into options
            if (arg3 === pc.LINEBATCH_OVERLAY) {
                options = {
                    layer: this.scene.layers.getLayerById(pc.LAYERID_IMMEDIATE),
                    depthTest: false
                };
            } else {
                options = {
                    layer: this.scene.layers.getLayerById(pc.LAYERID_IMMEDIATE),
                    depthTest: true
                };
            }
        } else if (arg3) {
            // options passed in
            options = arg3;
        } else {
            // no arg3, use default options
            options = {
                layer: this.scene.layers.getLayerById(pc.LAYERID_IMMEDIATE),
                depthTest: true
            };
        }

        this._addLines([start, end], [color, endColor], options);
    }

    /**
     * @function
     * @name pc.Application#renderLines
     * @description Draw an array of lines.
     * @param {pc.Vec3[]} position An array of points to draw lines between
     * @param {pc.Color[]} color An array of colors to color the lines. This must be the same size as the position array
     * @param {Object} [options] Options to set rendering properties
     * @param {pc.Layer} [options.layer] The layer to render the line into
     * @example
     * var points = [new pc.Vec3(0,0,0), new pc.Vec3(1,0,0), new pc.Vec3(1,1,0), new pc.Vec3(1,1,1)];
     * var colors = [new pc.Color(1,0,0), new pc.Color(1,1,0), new pc.Color(0,1,1), new pc.Color(0,0,1)];
     * app.renderLines(points, colors);
     */
    function renderLines(position, color, options) {
        if (!options) {
            // default option
            options = {
                layer: this.scene.layers.getLayerById(pc.LAYERID_IMMEDIATE),
                depthTest: true
            };
        } else if (typeof options === 'number') {
            if (!_deprecationWarning) {
                console.warn("lineBatch argument is deprecated for renderLine. Use options.layer instead");
                _deprecationWarning = true;
            }

            // backwards compatibility, LINEBATCH_OVERLAY lines have depthtest disabled
            if (options === pc.LINEBATCH_OVERLAY) {
                options = {
                    layer: this.scene.layers.getLayerById(pc.LAYERID_IMMEDIATE),
                    depthTest: false
                };
            } else {
                options = {
                    layer: this.scene.layers.getLayerById(pc.LAYERID_IMMEDIATE),
                    depthTest: true
                };
            }
        }

        var multiColor = !!color.length;
        if (multiColor) {
            if (position.length !== color.length) {
                pc.log.error("renderLines: position/color arrays have different lengths");
                return;
            }
        }
        if (position.length % 2 !== 0) {
            pc.log.error("renderLines: array length is not divisible by 2");
            return;
        }
        this._addLines(position, color, options);
    }

    // Draw lines forming a transformed unit-sized cube at this frame
    // lineType is optional
    function renderWireCube(matrix, color, options) {
        // if (lineType===undefined) lineType = pc.LINEBATCH_WORLD;

        var i;

        this._initImmediate();

        // Init cube data once
        if (!this._immediateData.cubeLocalPos) {
            var x = 0.5;
            this._immediateData.cubeLocalPos = [new pc.Vec3(-x, -x, -x), new pc.Vec3(-x, x, -x), new pc.Vec3(x, x, -x), new pc.Vec3(x, -x, -x),
                new pc.Vec3(-x, -x, x), new pc.Vec3(-x, x, x), new pc.Vec3(x, x, x), new pc.Vec3(x, -x, x)];
            this._immediateData.cubeWorldPos = [new pc.Vec3(), new pc.Vec3(), new pc.Vec3(), new pc.Vec3(),
                new pc.Vec3(), new pc.Vec3(), new pc.Vec3(), new pc.Vec3()];
        }

        var cubeLocalPos = this._immediateData.cubeLocalPos;
        var cubeWorldPos = this._immediateData.cubeWorldPos;

        // Transform and append lines
        for (i = 0; i < 8; i++) {
            matrix.transformPoint(cubeLocalPos[i], cubeWorldPos[i]);
        }
        this.renderLines([
            cubeWorldPos[0], cubeWorldPos[1],
            cubeWorldPos[1], cubeWorldPos[2],
            cubeWorldPos[2], cubeWorldPos[3],
            cubeWorldPos[3], cubeWorldPos[0],

            cubeWorldPos[4], cubeWorldPos[5],
            cubeWorldPos[5], cubeWorldPos[6],
            cubeWorldPos[6], cubeWorldPos[7],
            cubeWorldPos[7], cubeWorldPos[4],

            cubeWorldPos[0], cubeWorldPos[4],
            cubeWorldPos[1], cubeWorldPos[5],
            cubeWorldPos[2], cubeWorldPos[6],
            cubeWorldPos[3], cubeWorldPos[7]
        ], color, options);
    }

    function _preRenderImmediate() {
        for (var i = 0; i < this._immediateData.lineBatches.length; i++) {
            if (this._immediateData.lineBatches[i]) {
                this._immediateData.lineBatches[i].finalize();
            }
        }
    }

    function _postRenderImmediate() {
        for (var i = 0; i < this._immediateData.layers.length; i++) {
            this._immediateData.layers[i].clearMeshInstances(true);
        }

        this._immediateData.layers.length = 0;
    }

    // Draw meshInstance at this frame
    function renderMeshInstance(meshInstance, options) {
        if (!options) {
            options = {
                layer: this.scene.layers.getLayerById(pc.LAYERID_IMMEDIATE)
            };
        }

        this._initImmediate();

        this._immediateData.addLayer(options.layer);

        meshInstanceArray[0] = meshInstance;
        options.layer.addMeshInstances(meshInstanceArray, true);
    }

    // Draw mesh at this frame
    function renderMesh(mesh, material, matrix, options) {
        if (!options) {
            options = {
                layer: this.scene.layers.getLayerById(pc.LAYERID_IMMEDIATE)
            };
        }

        this._initImmediate();
        tempGraphNode.worldTransform = matrix;
        tempGraphNode._dirtyWorld = tempGraphNode._dirtyNormal = false;

        var instance = new pc.MeshInstance(tempGraphNode, mesh, material);
        instance.cull = false;

        if (options.mask) instance.mask = options.mask;
        this._immediateData.addLayer(options.layer);

        meshInstanceArray[0] = instance;
        options.layer.addMeshInstances(meshInstanceArray, true);
    }

    // Draw quad of size [-0.5, 0.5] at this frame
    function renderQuad(matrix, material, options) {
        if (!options) {
            options = {
                layer: this.scene.layers.getLayerById(pc.LAYERID_IMMEDIATE)
            };
        }

        this._initImmediate();

        // Init quad data once
        if (!this._immediateData.quadMesh) {
            var format = new pc.VertexFormat(this.graphicsDevice, [
                { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 }
            ]);
            var quadVb = new pc.VertexBuffer(this.graphicsDevice, format, 4);
            var iterator = new pc.VertexIterator(quadVb);
            iterator.element[pc.SEMANTIC_POSITION].set(-0.5, -0.5, 0);
            iterator.next();
            iterator.element[pc.SEMANTIC_POSITION].set(0.5, -0.5, 0);
            iterator.next();
            iterator.element[pc.SEMANTIC_POSITION].set(-0.5, 0.5, 0);
            iterator.next();
            iterator.element[pc.SEMANTIC_POSITION].set(0.5, 0.5, 0);
            iterator.end();
            this._immediateData.quadMesh = new pc.Mesh();
            this._immediateData.quadMesh.vertexBuffer = quadVb;
            this._immediateData.quadMesh.primitive[0].type = pc.PRIMITIVE_TRISTRIP;
            this._immediateData.quadMesh.primitive[0].base = 0;
            this._immediateData.quadMesh.primitive[0].count = 4;
            this._immediateData.quadMesh.primitive[0].indexed = false;
        }

        // Issue quad drawcall
        tempGraphNode.worldTransform = matrix;
        tempGraphNode._dirtyWorld = tempGraphNode._dirtyNormal = false;

        var quad = new pc.MeshInstance(tempGraphNode, this._immediateData.quadMesh, material);
        quad.cull = false;
        meshInstanceArray[0] = quad;

        this._immediateData.addLayer(options.layer);

        options.layer.addMeshInstances(meshInstanceArray, true);
    }

    return {
        renderMeshInstance: renderMeshInstance,
        renderMesh: renderMesh,
        renderLine: renderLine,
        renderLines: renderLines,
        renderQuad: renderQuad,
        renderWireCube: renderWireCube,
        _addLines: _addLines,
        _initImmediate: _initImmediate,
        _preRenderImmediate: _preRenderImmediate,
        _postRenderImmediate: _postRenderImmediate
    };
}());
