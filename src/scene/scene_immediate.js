pc.extend(pc.Application.prototype, function () {

    // Sensible default value; buffers will be doubled and reallocated when it's not enough
    var gizmoMeshNumLines = 128;

    var gizmoVertexFormat = null;
    var gizmoVb = null;
    var gizmoVbRam = null;
    var gizmoMesh = null;
    var gizmoMeshLinesUsed = 0;
    var gizmoMaterial = null;
    var gizmoMeshInstance = null;

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

    function _initGizmos(linesToAdd) {

        // Increase buffer size, if it's not enough
        while((gizmoMeshLinesUsed + linesToAdd) > gizmoMeshNumLines) {
            gizmoVb = null;
            gizmoMeshNumLines *= 2;
        }

        // Initialize basic data (once per app run)
        if (!gizmoVertexFormat) {
            gizmoVertexFormat = new pc.VertexFormat(this.graphicsDevice, [
                    { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.ELEMENTTYPE_FLOAT32 },
                    { semantic: pc.SEMANTIC_COLOR, components: 4, type: pc.ELEMENTTYPE_UINT8, normalize: true }
                ]);
            gizmoMesh = new pc.Mesh();
            gizmoMesh.primitive[0].type = pc.PRIMITIVE_LINES;
            gizmoMesh.primitive[0].base = 0;
            gizmoMesh.primitive[0].indexed = false;

            gizmoMaterial = new pc.BasicMaterial();
            gizmoMaterial.vertexColors = true;
            gizmoMaterial.update();

            this.on('preRender', this._preRenderImmediate, this);
        }

        // (Re)allocate line buffer
        if (!gizmoVb) {
            gizmoVb = new pc.VertexBuffer(this.graphicsDevice, gizmoVertexFormat, gizmoMeshNumLines * 2, pc.BUFFER_DYNAMIC);
            gizmoMesh.vertexBuffer = gizmoVb;
            gizmoVbRam = new DataView(gizmoVb.lock());

            if (!gizmoMeshInstance) {
                var node = {worldTransform: pc.Mat4.IDENTITY};
                gizmoMeshInstance = new pc.MeshInstance(node, gizmoMesh, gizmoMaterial);
            }
        }

    }

    // Draw straight line at this frame
    // color2 is optional
    function renderLine(pointA, pointB, color, color2) {
        this._initGizmos(1);

        // Copy line data into buffer
        // actual VB will be updated/drawCall added at preRender event
        if (!color2) color2 = color;

        var offset = gizmoMeshLinesUsed * 2 * gizmoVertexFormat.size;
        gizmoVbRam.setFloat32(offset, pointA.x, true); offset += 4;
        gizmoVbRam.setFloat32(offset, pointA.y, true); offset += 4;
        gizmoVbRam.setFloat32(offset, pointA.z, true); offset += 4;
        gizmoVbRam.setUint8(offset, color.r * 255); offset += 1;
        gizmoVbRam.setUint8(offset, color.g * 255); offset += 1;
        gizmoVbRam.setUint8(offset, color.b * 255); offset += 1;
        gizmoVbRam.setUint8(offset, color.a * 255); offset += 1;

        gizmoVbRam.setFloat32(offset, pointB.x, true); offset += 4;
        gizmoVbRam.setFloat32(offset, pointB.y, true); offset += 4;
        gizmoVbRam.setFloat32(offset, pointB.z, true); offset += 4;
        gizmoVbRam.setUint8(offset, color2.r * 255); offset += 1;
        gizmoVbRam.setUint8(offset, color2.g * 255); offset += 1;
        gizmoVbRam.setUint8(offset, color2.b * 255); offset += 1;
        gizmoVbRam.setUint8(offset, color2.a * 255); offset += 1;

        gizmoMeshLinesUsed++;
    }

    // Draw array of straight lines at this frame
    // color can be const or array
    // both arrays must have equal length and be divisible by 2
    function renderLines(position, color) {
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
        this._initGizmos(position.length / 2);

        var offset = gizmoMeshLinesUsed * 2 * gizmoVertexFormat.size;
        var clr;
        for(var i=0; i<position.length; i++) {
            gizmoVbRam.setFloat32(offset, position[i].x, true); offset += 4;
            gizmoVbRam.setFloat32(offset, position[i].y, true); offset += 4;
            gizmoVbRam.setFloat32(offset, position[i].z, true); offset += 4;
            clr = multiColor? color[i] : color;
            gizmoVbRam.setUint8(offset, clr.r * 255); offset += 1;
            gizmoVbRam.setUint8(offset, clr.g * 255); offset += 1;
            gizmoVbRam.setUint8(offset, clr.b * 255); offset += 1;
            gizmoVbRam.setUint8(offset, clr.a * 255); offset += 1;
        }
        gizmoMeshLinesUsed += position.length / 2;
    }

    function _preRenderImmediate() {
        if (gizmoMeshLinesUsed > 0) {
            gizmoVb.setData(gizmoVbRam.buffer);
            gizmoMesh.primitive[0].count = gizmoMeshLinesUsed * 2;
            this.scene.immediateDrawCalls.push(gizmoMeshInstance);
            gizmoMeshLinesUsed = 0;
            pc.fuck = gizmoVbRam;
        }
    }

    return {
        renderMeshInstance: renderMeshInstance,
        renderMesh: renderMesh,
        renderLine: renderLine,
        renderLines: renderLines,
        _initGizmos: _initGizmos,
        _preRenderImmediate: _preRenderImmediate
    };
}());
