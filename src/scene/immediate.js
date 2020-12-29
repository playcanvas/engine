import { Mat4 } from '../math/mat4.js';

import { BUFFER_DYNAMIC, PRIMITIVE_LINES, SEMANTIC_POSITION, SEMANTIC_COLOR, TYPE_FLOAT32, TYPE_UINT8 } from '../graphics/graphics.js';
import { VertexBuffer } from '../graphics/vertex-buffer.js';
import { VertexFormat } from '../graphics/vertex-format.js';

import { BLEND_NORMAL } from '../scene/constants.js';
import { BasicMaterial } from '../scene/materials/basic-material.js';
import { GraphNode } from '../scene/graph-node.js';
import { Mesh } from '../scene/mesh.js';
import { MeshInstance } from '../scene/mesh-instance.js';

var identityGraphNode = new GraphNode();

function ImmediateData(device) {
    this.lineVertexFormat = new VertexFormat(device, [
        { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 },
        { semantic: SEMANTIC_COLOR, components: 4, type: TYPE_UINT8, normalize: true }
    ]);
    this.lineBatches = [];
    this.layers = [];
    this.layerToBatch = {};
    this.quadMesh = null;
    this.cubeLocalPos = null;
    this.cubeWorldPos = null;
}

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

function LineBatch() {
    // Sensible default value; buffers will be doubled and reallocated when it's not enough
    this.numLinesAllocated = 128;

    this.vb = null;
    this.vbRam = null;
    this.mesh = null;
    this.linesUsed = 0;
    this.material = null;
    this.meshInstance = null;

    this.layer = null;
}

Object.assign(LineBatch.prototype, {
    init: function (device, vertexFormat, layer, linesToAdd) {
        // Allocate basic stuff once per batch
        if (!this.mesh) {
            this.mesh = new Mesh(device);
            this.mesh.primitive[0].type = PRIMITIVE_LINES;
            this.mesh.primitive[0].base = 0;
            this.mesh.primitive[0].indexed = false;

            this.material = new BasicMaterial();
            this.material.vertexColors = true;
            this.material.blend = true;
            this.material.blendType = BLEND_NORMAL;
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
            this.vb = new VertexBuffer(device, vertexFormat, this.numLinesAllocated * 2, BUFFER_DYNAMIC);
            this.mesh.vertexBuffer = this.vb;
            this.vbRam = new DataView(this.vb.lock());

            if (!this.meshInstance) {
                identityGraphNode.worldTransform = Mat4.IDENTITY;
                identityGraphNode._dirtyWorld = identityGraphNode._dirtyNormal = false;
                this.meshInstance = new MeshInstance(identityGraphNode, this.mesh, this.material);
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

    finalize: function (meshInstanceArray) {
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

export { ImmediateData, LineBatch };
