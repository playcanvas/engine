var debugLayerFront = null;
var debugLayerBack = null;

var DebugLines = function (app, camera) {
    if (!debugLayerFront) {
        // construct the debug layer
        debugLayerFront = new pc.Layer({
            enabled: true,
            name: 'Debug Layer',
            opaqueSortMode: pc.SORTMODE_NONE,
            transparentSortMode: pc.SORTMODE_NONE,
            passThrough: true
        });

        debugLayerBack = new pc.Layer({
            enabled: true,
            name: 'Debug Layer Behind',
            opaqueSortMode: pc.SORTMODE_NONE,
            transparentSortMode: pc.SORTMODE_NONE,
            passThrough: true,
            overrideClear: true,
            clearDepthBuffer: true
        });

        app.scene.layers.pushTransparent(debugLayerFront);
        app.scene.layers.pushTransparent(debugLayerBack);
        camera.camera.layers = camera.camera.layers.concat([debugLayerFront.id, debugLayerBack.id]);
    }

    var device = app.graphicsDevice;

    var vertexFormat = new pc.VertexFormat(device, [
        { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 },
        { semantic: pc.SEMANTIC_COLOR, components: 4, type: pc.TYPE_UINT8, normalize: true }
    ]);

    // construct the mesh
    var mesh = new pc.Mesh();
    mesh.vertexBuffer = new pc.VertexBuffer(device, vertexFormat, 1024, pc.BUFFER_DYNAMIC);
    mesh.primitive[0].type = pc.PRIMITIVE_LINES;
    mesh.primitive[0].base = 0;
    mesh.primitive[0].indexed = false;
    mesh.primitive[0].count = 0;

    // construct the material
    var material = new pc.BasicMaterial();
    material.blendType = pc.BLEND_NORMAL;
    material.update();

    // construct the mesh instance
    var meshInstance = new pc.MeshInstance(new pc.GraphNode(), mesh, material);
    meshInstance.cull = false;
    meshInstance.visible = false;

    debugLayerFront.addMeshInstances([meshInstance], true);

    this.app = app;
    this.mesh = mesh;
    this.meshInstance = meshInstance;
    this.vertexFormat = vertexFormat;
    this.vertexCursor = 0;
    this.vertexData = new Float32Array(this.mesh.vertexBuffer.storage);
    this.colourData = new Uint32Array(this.mesh.vertexBuffer.storage);
};

DebugLines._matrixMad = function (result, mat, factor) {
    if (factor > 0) {
        for (var i = 0; i < 16; ++i) {
            result.data[i] += mat.data[i] * factor;
        }
    }
};

Object.assign(DebugLines.prototype, {

    clear: function () {
        this.vertexCursor = 0;
    },

    box: function (min, max) {
        this.line(new pc.Vec3(min.x, min.y, min.z), new pc.Vec3(max.x, min.y, min.z));
        this.line(new pc.Vec3(max.x, min.y, min.z), new pc.Vec3(max.x, min.y, max.z));
        this.line(new pc.Vec3(max.x, min.y, max.z), new pc.Vec3(min.x, min.y, max.z));
        this.line(new pc.Vec3(min.x, min.y, max.z), new pc.Vec3(min.x, min.y, min.z));

        this.line(new pc.Vec3(min.x, max.y, min.z), new pc.Vec3(max.x, max.y, min.z));
        this.line(new pc.Vec3(max.x, max.y, min.z), new pc.Vec3(max.x, max.y, max.z));
        this.line(new pc.Vec3(max.x, max.y, max.z), new pc.Vec3(min.x, max.y, max.z));
        this.line(new pc.Vec3(min.x, max.y, max.z), new pc.Vec3(min.x, max.y, min.z));

        this.line(new pc.Vec3(min.x, min.y, min.z), new pc.Vec3(min.x, max.y, min.z));
        this.line(new pc.Vec3(max.x, min.y, min.z), new pc.Vec3(max.x, max.y, min.z));
        this.line(new pc.Vec3(max.x, min.y, max.z), new pc.Vec3(max.x, max.y, max.z));
        this.line(new pc.Vec3(min.x, min.y, max.z), new pc.Vec3(min.x, max.y, max.z));
    },

    line: function (v0, v1) {
        if (this.vertexCursor >= this.vertexData.length / 8) {
            var oldVBuffer = this.mesh.vertexBuffer;
            var byteSize = oldVBuffer.numBytes * 2;
            var arrayBuffer = new ArrayBuffer(byteSize);

            this.mesh.vertexBuffer = new pc.VertexBuffer(this.app.graphicsDevice,
                                                         oldVBuffer.format,
                                                         oldVBuffer.numVertices * 2,
                                                         pc.BUFFER_DYNAMIC,
                                                         arrayBuffer);
            this.vertexData = new Float32Array(arrayBuffer);
            this.colourData = new Uint32Array(arrayBuffer);

            this.colourData.set(new Uint32Array(oldVBuffer.storage));
        }

        var vertex = this.vertexCursor;
        var vertexData = this.vertexData;
        var colourData = this.colourData;
        vertexData[vertex * 8 + 0] = v0.x;
        vertexData[vertex * 8 + 1] = v0.y;
        vertexData[vertex * 8 + 2] = v0.z;
        colourData[vertex * 8 + 3] = 0xffffffff;
        vertexData[vertex * 8 + 4] = v1.x;
        vertexData[vertex * 8 + 5] = v1.y;
        vertexData[vertex * 8 + 6] = v1.z;
        colourData[vertex * 8 + 7] = 0xffffffff;
        this.vertexCursor++;
    },

    generateNormals: function (vertexBuffer, worldMat, length, skinMatrices) {
        var it = new pc.VertexIterator(vertexBuffer);
        var positions = it.element[pc.SEMANTIC_POSITION];
        var normals = it.element[pc.SEMANTIC_NORMAL];
        var blendIndices = it.element[pc.SEMANTIC_BLENDINDICES];
        var blendWeights = it.element[pc.SEMANTIC_BLENDWEIGHT];

        var numVertices = vertexBuffer.numVertices;
        var p0 = new pc.Vec3();
        var p1 = new pc.Vec3();
        var skinMat = new pc.Mat4();

        for (var i = 0; i < numVertices; ++i) {
            // get local/morphed positions and normals
            p0.set(positions.get(0), positions.get(1), positions.get(2));
            p1.set(normals.get(0), normals.get(1), normals.get(2));

            if (blendIndices && blendWeights && skinMatrices) {
                // transform by skinning matricess
                skinMat.copy(pc.Mat4.ZERO);
                for (var j = 0; j < 4; ++j) {
                    DebugLines._matrixMad(skinMat,
                                          skinMatrices[blendIndices.get(j)],
                                          blendWeights.get(j));
                }
                skinMat.mul2(worldMat, skinMat);
                skinMat.transformPoint(p0, p0);
                skinMat.transformVector(p1, p1);
            } else {
                worldMat.transformPoint(p0, p0);
                worldMat.transformVector(p1, p1);
            }

            p1.normalize().scale(length).add(p0);

            this.line(p0, p1);

            it.next();
        }
    },

    generateSkeleton: function (node) {
        var self = this;

        var recurse = function (curr) {
            if (curr.enabled) {
                // render child links
                for (var i = 0; i < curr.children.length; ++i) {
                    var child = curr.children[i];
                    self.line(curr.getPosition(), child.getPosition());
                    recurse(child);
                }
            }
        };

        recurse(node);
    },

    update: function () {
        var empty = this.vertexCursor === 0;
        if (!empty) {
            this.meshInstance.visible = true;
            this.mesh.vertexBuffer.unlock();
            this.mesh.primitive[0].count = this.vertexCursor * 2;
            this.vertexCursor = 0;
        } else {
            this.meshInstance.visible = false;
        }
    }
});
