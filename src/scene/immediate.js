pc.extend(pc.Application.prototype, function () {

    var lineVertexFormat = null;
    var lineBatches = [];
    var quadMesh = null;
    var cubeLocalPos = null;
    var cubeWorldPos = null;

    var lineBatch = function () {
        // Sensible default value; buffers will be doubled and reallocated when it's not enough
        this.numLinesAllocated = 128;

        this.vb = null;
        this.vbRam = null;
        this.mesh = null;
        this.linesUsed = 0;
        this.material = null;
        this.meshInstance = null;
    };

    lineBatch.prototype = {
        init: function (device, linesToAdd) {
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

            // Increase buffer size, if it's not enough
            while((this.linesUsed + linesToAdd) > this.numLinesAllocated) {
                this.vb = null;
                this.numLinesAllocated *= 2;
            }

            // (Re)allocate line buffer
            if (!this.vb) {
                this.vb = new pc.VertexBuffer(device, lineVertexFormat, this.numLinesAllocated * 2, pc.BUFFER_DYNAMIC);
                this.mesh.vertexBuffer = this.vb;
                this.vbRam = new DataView(this.vb.lock());

                if (!this.meshInstance) {
                    var node = {worldTransform: pc.Mat4.IDENTITY};
                    this.meshInstance = new pc.MeshInstance(node, this.mesh, this.material);
                }
            }
        },

        addLines: function(position, color) {
            // Append lines to buffer
            var multiColor = !!color.length;
            var offset = this.linesUsed * 2 * lineVertexFormat.size;
            var clr;
            for(var i=0; i<position.length; i++) {
                this.vbRam.setFloat32(offset, position[i].x, true); offset += 4;
                this.vbRam.setFloat32(offset, position[i].y, true); offset += 4;
                this.vbRam.setFloat32(offset, position[i].z, true); offset += 4;
                clr = multiColor? color[i] : color;
                this.vbRam.setUint8(offset, clr.r * 255); offset += 1;
                this.vbRam.setUint8(offset, clr.g * 255); offset += 1;
                this.vbRam.setUint8(offset, clr.b * 255); offset += 1;
                this.vbRam.setUint8(offset, clr.a * 255); offset += 1;
            }
            this.linesUsed += position.length / 2;
        },

        finalize: function(drawCalls) {
            // Update batch vertex buffer/issue drawcall if there are any lines
            if (this.linesUsed > 0) {
                this.vb.setData(this.vbRam.buffer);
                this.mesh.primitive[0].count = this.linesUsed * 2;
                drawCalls.push(this.meshInstance);
                this.linesUsed = 0;
            }
        }
    };

    function _addLines(batchId, position, color) {
        // Init global line drawing data once
        if (!lineVertexFormat) {
            lineVertexFormat = new pc.VertexFormat(this.graphicsDevice, [
                    { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.ELEMENTTYPE_FLOAT32 },
                    { semantic: pc.SEMANTIC_COLOR, components: 4, type: pc.ELEMENTTYPE_UINT8, normalize: true }
                ]);
            this.on('prerender', this._preRenderImmediate, this);
        }
        if (!lineBatches[batchId]) {
            // Init used batch once
            lineBatches[batchId] = new lineBatch();
            lineBatches[batchId].init(this.graphicsDevice, position.length / 2);
            if (batchId===pc.LINEBATCH_OVERLAY) {
                lineBatches[batchId].material.depthTest = false;
                lineBatches[batchId].meshInstance.layer = pc.LAYER_GIZMO;
            }
            else if (batchId===pc.LINEBATCH_GIZMO) {
                lineBatches[batchId].meshInstance.layer = pc.LAYER_GIZMO;
            }
        } else {
            // Possibly reallocate buffer if it's small
            lineBatches[batchId].init(this.graphicsDevice, position.length / 2);
        }
        // Append
        lineBatches[batchId].addLines(position, color);
    }

    /**
     * @function
     * @name pc.Application#renderLine
     * @description Draw a line in one color
     * @param {pc.Vec3} start The start of the line
     * @param {pc.Vec3} end The end of the line
     * @param {pc.Color} color The color of the line
     * @example
     * var start = new pc.Vec3(0,0,0);
     * var end = new pc.Vec3(1,0,0);
     * var color = new pc.Color(1,1,1);
     * app.renderLine(start, end, color);
     */
    /**
     * @function
     * @name pc.Application#renderLine^2
     * @description Draw a line which blends between two colors
     * @param {pc.Vec3} start The start of the line
     * @param {pc.Vec3} end The end of the line
     * @param {pc.Color} startColor The start color of the line
     * @param {pc.Color} endColor The end color of the line
     * @example
     * var start = new pc.Vec3(0,0,0);
     * var end = new pc.Vec3(1,0,0);
     * var startColor = new pc.Color(1,1,1);
     * var endColor = new pc.Color(1,0,0);
     * app.renderLine(start, end, startColor, endColor);
     */
    /**
     * @function
     * @name pc.Application#renderLine^3
     * @description Draw a line of one color with specified line type
     * @param {pc.Vec3} start The start of the line
     * @param {pc.Vec3} end The end of the line
     * @param {pc.Color} color The color of the line
     * @param {Number} lineType The type of rendering to use: pc.LINEBATCH_WORLD, pc.LINEBATCH_OVERLAY, pc.LINEBATCH_GIZMO. Default is pc.LINEBATCH_WORLD
     * @example
     * var start = new pc.Vec3(0,0,0);
     * var end = new pc.Vec3(1,0,0);
     * var color = new pc.Color(1,1,1);
     * app.renderLine(start, end, color, pc.LINEBATCH_OVERLAY);
     */
    /**
     * @function
     * @name pc.Application#renderLine^4
     * @description Draw a line which blends between two colors with specified line type
     * @param {pc.Vec3} start The start of the line
     * @param {pc.Vec3} end The end of the line
     * @param {pc.Color} startColor The start color of the line
     * @param {pc.Color} endColor The end color of the line
     * @param {Number} lineType The type of rendering to use: pc.LINEBATCH_WORLD, pc.LINEBATCH_OVERLAY, pc.LINEBATCH_GIZMO. Default is pc.LINEBATCH_WORLD
     * @example
     * var start = new pc.Vec3(0,0,0);
     * var end = new pc.Vec3(1,0,0);
     * var startColor = new pc.Color(1,1,1);
     * var endColor = new pc.Color(1,0,0);
     * app.renderLine(start, end, startColor, endColor, pc.LINEBATCH_OVERLAY);
     */
    function renderLine(start, end, color, arg3, arg4) {
        var endColor = color;
        var lineType = pc.LINEBATCH_WORLD;
        if (arg3) {
            if (typeof(arg3) === 'number') {
                lineType = arg3;
            } else {
                endColor = arg3;
                if (arg4) lineType = arg4;
            }
        }
        this._addLines(lineType, [start, end], [color, endColor]);
    }

    /**
     * @function
     * @name pc.Application#renderLines
     * @description Draw an array of lines.
     * @param {pc.Vec3[]} position An array of points to draw lines between
     * @param {pc.Color[]} color An array of colors to color the lines. This must be the same size as the position array
     * @param {Number} [lineType] The type of rendering to use: pc.LINEBATCH_WORLD, pc.LINEBATCH_OVERLAY, pc.LINEBATCH_GIZMO. Default is pc.LINEBATCH_WORLD
     * @example
     * var points = [new pc.Vec3(0,0,0), new pc.Vec3(1,0,0), new pc.Vec3(1,1,0), new pc.Vec3(1,1,1)];
     * var colors = [new pc.Color(1,0,0), new pc.Color(1,1,0), new pc.Color(0,1,1), new pc.Color(0,0,1)];
     * app.renderLines(points, colors);
    */
    function renderLines(position, color, lineType) {
        if (lineType===undefined) lineType = pc.LINEBATCH_WORLD;
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
        this._addLines(lineType, position, color);
    }

    // Draw lines forming a transformed unit-sized cube at this frame
    // lineType is optional
    function renderWireCube(matrix, color, lineType) {
        if (lineType===undefined) lineType = pc.LINEBATCH_WORLD;
        var i;
        // Init cube data once
        if (!cubeLocalPos) {
            var x = 0.5;
            cubeLocalPos = [new pc.Vec3(-x, -x, -x), new pc.Vec3(-x, x, -x), new pc.Vec3(x, x, -x), new pc.Vec3(x, -x, -x),
                            new pc.Vec3(-x, -x, x), new pc.Vec3(-x, x, x), new pc.Vec3(x, x, x), new pc.Vec3(x, -x, x)];
            cubeWorldPos = [new pc.Vec3(), new pc.Vec3(), new pc.Vec3(), new pc.Vec3(),
                            new pc.Vec3(), new pc.Vec3(), new pc.Vec3(), new pc.Vec3()];
        }
        // Transform and append lines
        for(i=0; i<8; i++) {
            matrix.transformPoint(cubeLocalPos[i], cubeWorldPos[i]);
        }
        this.renderLines([cubeWorldPos[0],cubeWorldPos[1],
                     cubeWorldPos[1],cubeWorldPos[2],
                     cubeWorldPos[2],cubeWorldPos[3],
                     cubeWorldPos[3],cubeWorldPos[0],

                     cubeWorldPos[4],cubeWorldPos[5],
                     cubeWorldPos[5],cubeWorldPos[6],
                     cubeWorldPos[6],cubeWorldPos[7],
                     cubeWorldPos[7],cubeWorldPos[4],

                     cubeWorldPos[0],cubeWorldPos[4],
                     cubeWorldPos[1],cubeWorldPos[5],
                     cubeWorldPos[2],cubeWorldPos[6],
                     cubeWorldPos[3],cubeWorldPos[7]
                     ], color, lineType);
    }

    function _preRenderImmediate() {
        for(var i=0; i<3; i++) {
            if (lineBatches[i]) {
                lineBatches[i].finalize(this.scene.immediateDrawCalls);
            }
        }
    }

    // Draw meshInstance at this frame
    function renderMeshInstance(meshInstance) {
        this.scene.immediateDrawCalls.push(meshInstance);
    }

    // Draw mesh at this frame
    function renderMesh(mesh, material, matrix) {
        var node = {worldTransform: matrix};
        var instance = new pc.MeshInstance(node, mesh, material);
        this.scene.immediateDrawCalls.push(instance);
    }

    // Draw quad of size [-0.5, 0.5] at this frame
    // layer is optional
    function renderQuad(matrix, material, layer) {
        // Init quad data once
        if (!quadMesh) {
            var format = new pc.VertexFormat(this.graphicsDevice, [
                    { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.ELEMENTTYPE_FLOAT32 }
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
            quadMesh = new pc.Mesh();
            quadMesh.vertexBuffer = quadVb;
            quadMesh.primitive[0].type = pc.PRIMITIVE_TRISTRIP;
            quadMesh.primitive[0].base = 0;
            quadMesh.primitive[0].count = 4;
            quadMesh.primitive[0].indexed = false;
        }
        // Issue quad drawcall
        var node = {worldTransform: matrix};
        var quad = new pc.MeshInstance(node, quadMesh, material);
        if (layer) quad.layer = layer;
        this.scene.immediateDrawCalls.push(quad);
    }

    return {
        renderMeshInstance: renderMeshInstance,
        renderMesh: renderMesh,
        renderLine: renderLine,
        renderLines: renderLines,
        renderQuad: renderQuad,
        renderWireCube: renderWireCube,
        _addLines: _addLines,
        _preRenderImmediate: _preRenderImmediate
    };
}());
