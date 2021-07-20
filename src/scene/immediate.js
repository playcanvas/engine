import { Vec3 } from '../math/vec3.js';
import { Mat4 } from '../math/mat4.js';

import {
    BUFFER_DYNAMIC, PRIMITIVE_LINES, SEMANTIC_POSITION, SEMANTIC_COLOR, TYPE_FLOAT32, TYPE_UINT8,
    PRIMITIVE_TRISTRIP
} from '../graphics/constants.js';

import { VertexBuffer } from '../graphics/vertex-buffer.js';
import { VertexFormat } from '../graphics/vertex-format.js';
import { VertexIterator } from '../graphics/vertex-iterator.js';
import { Shader } from '../graphics/shader.js';
import { shaderChunks } from '../graphics/program-lib/chunks/chunks.js';

import { BLEND_NORMAL } from '../scene/constants.js';
import { BasicMaterial } from '../scene/materials/basic-material.js';
import { GraphNode } from '../scene/graph-node.js';
import { Mesh } from '../scene/mesh.js';
import { MeshInstance } from '../scene/mesh-instance.js';

var identityGraphNode = new GraphNode();

class LineBatch {
    constructor() {
        // Sensible default value; buffers will be doubled and reallocated when it's not enough
        this.numLinesAllocated = 128;

        this.vb = null;
        this.vbRam = null;
        this.mesh = null;
        this.linesUsed = 0;
        this.material = null;
        this.meshInstance = null;
        this.meshInstanceArray = [];

        this.layer = null;
    }

    init(device, vertexFormat, layer, linesToAdd) {
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
                this.meshInstance = new MeshInstance(this.mesh, this.material, identityGraphNode);
                this.meshInstance.cull = false;
            }
        }
    }

    addLines(position, color) {
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
    }

    finalize(meshInstanceArray) {
        // Update batch vertex buffer/issue drawcall if there are any lines
        if (this.linesUsed > 0) {
            this.vb.setData(this.vbRam.buffer);
            this.mesh.primitive[0].count = this.linesUsed * 2;
            meshInstanceArray[0] = this.meshInstance;
            this.layer.addMeshInstances(meshInstanceArray, true);
            this.linesUsed = 0;
        }
    }
}

class ImmediateData {
    constructor(device) {
        this.lineVertexFormat = new VertexFormat(device, [
            { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 },
            { semantic: SEMANTIC_COLOR, components: 4, type: TYPE_UINT8, normalize: true }
        ]);
        this.device = device;
        this.lineBatches = [];
        this.layers = [];
        this.layerToBatch = {};
        this.quadMesh = null;
        this.textureShader = null;
        this.depthTextureShader = null;
        this.cubeLocalPos = null;
        this.cubeWorldPos = null;
        this.meshInstanceArray = [];

        this.usedGraphNodes = [];
        this.freeGraphNodes = [];
    }

    // shared vertex shader for texture quad rendering
    static getTextureVS() {
        return `
            attribute vec2 aPosition;
            uniform mat4 matrix_model;
            varying vec2 uv0;
            void main(void) {
                gl_Position = matrix_model * vec4(aPosition, 0, 1);
                uv0 = aPosition.xy + 0.5;
                uv0.y = 1.0 - uv0.y;
            }
        `;
    }

    // shader used to display texture
    getTextureShader() {

        if (!this.textureShader) {
            const shaderDefinition = {
                attributes: {
                    aPosition: SEMANTIC_POSITION
                },
                vshader: ImmediateData.getTextureVS(),
                fshader: `
                    precision lowp float;
                    varying vec2 uv0;
                    uniform sampler2D colorMap;
                    void main (void) {
                        gl_FragColor = vec4(texture2D(colorMap, uv0).xyz, 1);
                    }
                `
            };
            this.textureShader = new Shader(this.device, shaderDefinition);
        }

        return this.textureShader;
    }

    // shader used to display depth texture
    getDepthTextureShader() {

        if (!this.depthTextureShader) {

            const gl2 = this.device.webgl2 ? "#define GL2" : "";
            const shaderDefinition = {
                attributes: {
                    aPosition: SEMANTIC_POSITION
                },
                vshader: ImmediateData.getTextureVS(),
                fshader: `
                    precision ${this.device.precision} float;
                    ${gl2}
                    ${shaderChunks.screenDepthPS}
                    varying vec2 uv0;
                    void main() {
                        float depth = getLinearScreenDepth(uv0) * camera_params.x;
                        gl_FragColor = vec4(vec3(depth), 1.0);
                    }
                    `
            };
            this.depthTextureShader = new Shader(this.device, shaderDefinition);
        }

        return this.depthTextureShader;
    }

    getQuadMesh() {
        if (!this.quadMesh) {
            // Init quad data once
            var format = new VertexFormat(this.device, [
                { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 }
            ]);
            var quadVb = new VertexBuffer(this.device, format, 4);
            var iterator = new VertexIterator(quadVb);
            iterator.element[SEMANTIC_POSITION].set(-0.5, -0.5, 0);
            iterator.next();
            iterator.element[SEMANTIC_POSITION].set(0.5, -0.5, 0);
            iterator.next();
            iterator.element[SEMANTIC_POSITION].set(-0.5, 0.5, 0);
            iterator.next();
            iterator.element[SEMANTIC_POSITION].set(0.5, 0.5, 0);
            iterator.end();
            this.quadMesh = new Mesh(this.device);
            this.quadMesh.vertexBuffer = quadVb;
            this.quadMesh.primitive[0].type = PRIMITIVE_TRISTRIP;
            this.quadMesh.primitive[0].base = 0;
            this.quadMesh.primitive[0].count = 4;
            this.quadMesh.primitive[0].indexed = false;
        }
        return this.quadMesh;
    }

    // Draw mesh at this frame
    renderMesh(material, matrix, mesh, meshInstance, options) {

        if (!meshInstance) {
            var graphNode = this.getGraphNode(matrix);
            meshInstance = new MeshInstance(mesh, material, graphNode);
            meshInstance.cull = false;
        }

        this.addLayer(options.layer);
        if (options.mask) {
            meshInstance.mask = options.mask;
        }

        this.meshInstanceArray[0] = meshInstance;
        options.layer.addMeshInstances(this.meshInstanceArray, true);
    }

    // Draw lines forming a transformed unit-sized cube at this frame
    renderWireCube(matrix, color, options) {

        if (!this.cubeLocalPos) {
            const x = 0.5;
            this.cubeLocalPos = [
                new Vec3(-x, -x, -x), new Vec3(-x, x, -x), new Vec3(x, x, -x), new Vec3(x, -x, -x),
                new Vec3(-x, -x, x), new Vec3(-x, x, x), new Vec3(x, x, x), new Vec3(x, -x, x)
            ];
            this.cubeWorldPos = [
                new Vec3(), new Vec3(), new Vec3(), new Vec3(),
                new Vec3(), new Vec3(), new Vec3(), new Vec3()
            ];
            const cubeWorldPos = this.cubeWorldPos;
            this.cubePositions = [
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
            ];
        }

        // Transform to world space
        const cubeLocalPos = this.cubeLocalPos;
        const cubeWorldPos = this.cubeWorldPos;
        for (let i = 0; i < 8; i++) {
            matrix.transformPoint(cubeLocalPos[i], cubeWorldPos[i]);
        }

        const lineBatch = this.prepareLineBatch(options.layer, options.depthTest, undefined, this.cubePositions.length);
        lineBatch.addLines(this.cubePositions, color);
    }

    renderWireSphere(center, radius, color, options) {

        const numSegments = 20;

        // preallocate array of positions
        if (!this.spherePoints) {
            this.spherePoints = [];
            for (let i = 0; i < numSegments * 6; i++) {
                this.spherePoints.push(new Vec3());
            }
        }

        const points = this.spherePoints;
        const step = 2 * Math.PI / numSegments;
        let angle = 0;

        for (let i = 0; i < numSegments; i++) {
            const sin0 = Math.sin(angle);
            const cos0 = Math.cos(angle);
            angle += step;
            const sin1 = Math.sin(angle);
            const cos1 = Math.cos(angle);

            points[i * 6].set(center.x + radius * sin0, center.y, center.z + radius * cos0);
            points[i * 6 + 1].set(center.x + radius * sin1, center.y, center.z + radius * cos1);
            points[i * 6 + 2].set(center.x + radius * sin0, center.y + radius * cos0, center.z);
            points[i * 6 + 3].set(center.x + radius * sin1, center.y + radius * cos1, center.z);
            points[i * 6 + 4].set(center.x, center.y + radius * sin0, center.z + radius * cos0);
            points[i * 6 + 5].set(center.x, center.y + radius * sin1, center.z + radius * cos1);
        }

        const lineBatch = this.prepareLineBatch(options.layer, options.depthTest, undefined, points.length);
        lineBatch.addLines(points, color);
    }

    getGraphNode(matrix) {
        let graphNode = null;
        if (this.freeGraphNodes.length > 0) {
            graphNode = this.freeGraphNodes.pop();
        } else {
            graphNode = new GraphNode();
        }
        this.usedGraphNodes.push(graphNode);

        graphNode.worldTransform = matrix;
        graphNode._dirtyWorld = graphNode._dirtyNormal = false;

        return graphNode;
    }

    addLayer(layer) {
        if (this.layers.indexOf(layer) < 0) {
            this.layers.push(layer);
        }
    }

    getLayerIdx(layer) {
        return this.layerToBatch[layer.id];
    }

    addLayerIdx(idx, layer) {
        this.layerToBatch[layer.id] = idx;
    }

    // called before the frame is rendered, preparas data for rendering
    finalize() {
        for (var i = 0; i < this.lineBatches.length; i++) {
            if (this.lineBatches[i]) {
                this.lineBatches[i].finalize(this.meshInstanceArray);
            }
        }
    }

    // called after the frame was rendered, clears data
    clear() {
        for (var i = 0; i < this.layers.length; i++) {
            this.layers[i].clearMeshInstances(true);
        }

        // reuse graph nodes
        const temp = this.freeGraphNodes;
        this.freeGraphNodes = this.usedGraphNodes;
        this.usedGraphNodes = temp;

        this.layers.length = 0;
    }

    prepareLineBatch(layer, depthTest, mask, numLines) {
        this.addLayer(layer);

        var idx = this.getLayerIdx(layer);
        if (idx === undefined) {

            // Init used batch once
            var batch = new LineBatch();
            batch.init(this.device, this.lineVertexFormat, layer, numLines);
            batch.material.depthTest = depthTest;
            if (mask) {
                batch.meshInstance.mask = mask;
            }

            // push into list and get index
            idx = this.lineBatches.push(batch) - 1;
            this.addLayerIdx(idx, layer);

        } else {
            // Possibly reallocate buffer if it's small
            this.lineBatches[idx].init(this.device, this.lineVertexFormat, layer, numLines);
            this.lineBatches[idx].material.depthTest = depthTest;
            if (mask) {
                this.lineBatches[idx].meshInstance.mask = mask;
            }
        }

        return this.lineBatches[idx];
    }
}

export { ImmediateData };
