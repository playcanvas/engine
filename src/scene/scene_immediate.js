pc.extend(pc.Application.prototype, function () {

    var lineVertexFormat = null;
    var lineBatches = [];
    var LINE_BATCH_WORLD = 0;
    var LINE_BATCH_OVERLAY = 1;

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

    function _addLines(batchId, position, color) {
        // Init global line drawing data once
        if (!lineVertexFormat) {
            lineVertexFormat = new pc.VertexFormat(this.graphicsDevice, [
                    { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.ELEMENTTYPE_FLOAT32 },
                    { semantic: pc.SEMANTIC_COLOR, components: 4, type: pc.ELEMENTTYPE_UINT8, normalize: true }
                ]);
            this.on('preRender', this._preRenderImmediate, this);
        }
        if (!lineBatches[batchId]) {
            // Init used batch once
            lineBatches[batchId] = new lineBatch();
            lineBatches[batchId].init(this.graphicsDevice, position.length / 2);
            if (batchId===LINE_BATCH_OVERLAY) {
                lineBatches[batchId].material.depthTest = false;
                lineBatches[batchId].meshInstance.layer = pc.LAYER_GIZMO;
            }
        } else {
            // Possibly reallocate buffer if it's small
            lineBatches[batchId].init(this.graphicsDevice, position.length / 2);
        }
        // Append
        lineBatches[batchId].addLines(position, color);
    }

    // Draw straight line at this frame
    // Possible usage:
    // renderLine(start, end, color)
    // renderLine(start, end, color, endColor)
    // renderLine(start, end, color, onTop)
    // renderLine(start, end, color, endColor, onTop)
    function renderLine(start, end, color, arg3, arg4) {
        var endColor = color;
        var onTop = false;
        if (arg3) {
            if (arg3===true || arg3===false) {
                onTop = arg3;
            } else {
                endColor = arg3;
                if (arg4) onTop = arg4;
            }
        }
        this._addLines(onTop? LINE_BATCH_OVERLAY : LINE_BATCH_WORLD, [start, end], [color, endColor]);
    }

    // Draw array of straight lines at this frame
    // color can be const or array
    // both arrays must have equal length and be divisible by 2
    // onTop is optional
    function renderLines(position, color, onTop) {
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
        this._addLines(onTop? LINE_BATCH_OVERLAY : LINE_BATCH_WORLD, position, color);
    }

    function _preRenderImmediate() {
        for(var i=0; i<2; i++) {
            if (lineBatches[i]) {
                lineBatches[i].finalize(this.scene.immediateDrawCalls);
            }
        }
    }

    return {
        renderMeshInstance: renderMeshInstance,
        renderMesh: renderMesh,
        renderLine: renderLine,
        renderLines: renderLines,
        _addLines: _addLines,
        _preRenderImmediate: _preRenderImmediate
    };
}());
