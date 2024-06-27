import { PRIMITIVE_TRISTRIP } from '../../platform/graphics/constants.js';

import { BLEND_NORMAL } from '../constants.js';
import { GraphNode } from '../graph-node.js';
import { Mesh } from '../mesh.js';
import { MeshInstance } from '../mesh-instance.js';
import { BasicMaterial } from '../materials/basic-material.js';
import { createShaderFromCode } from '../shader-lib/utils.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { ImmediateBatches } from './immediate-batches.js';

import { Vec3 } from '../../core/math/vec3.js';
import { ChunkUtils } from '../shader-lib/chunk-utils.js';

const tempPoints = [];
const vec = new Vec3();

class Immediate {
    constructor(device) {
        this.device = device;
        this.quadMesh = null;
        this.textureShader = null;
        this.depthTextureShader = null;
        this.cubeLocalPos = null;
        this.cubeWorldPos = null;

        // map of Layer to ImmediateBatches, storing line batches for a layer
        this.batchesMap = new Map();

        // set of all batches that were used in the frame
        this.allBatches = new Set();

        // set of all layers updated during this frame
        this.updatedLayers = new Set();

        // line materials
        this._materialDepth = null;
        this._materialNoDepth = null;

        // map of meshes instances added to a layer. The key is layer, the value is an array of mesh instances
        this.layerMeshInstances = new Map();
    }

    // creates material for line rendering
    createMaterial(depthTest) {
        const material = new BasicMaterial();
        material.vertexColors = true;
        material.blendType = BLEND_NORMAL;
        material.depthTest = depthTest;
        material.update();
        return material;
    }

    // material for line rendering with depth testing on
    get materialDepth() {
        if (!this._materialDepth) {
            this._materialDepth = this.createMaterial(true);
        }
        return this._materialDepth;
    }

    // material for line rendering with depth testing off
    get materialNoDepth() {
        if (!this._materialNoDepth) {
            this._materialNoDepth = this.createMaterial(false);
        }
        return this._materialNoDepth;
    }

    // returns a batch for rendering lines to a layer with required depth testing state
    getBatch(layer, depthTest) {

        // get batches for the layer
        let batches = this.batchesMap.get(layer);
        if (!batches) {
            batches = new ImmediateBatches(this.device);
            this.batchesMap.set(layer, batches);
        }

        // add it for rendering
        this.allBatches.add(batches);

        // get batch for the material
        const material = depthTest ? this.materialDepth : this.materialNoDepth;
        return batches.getBatch(material, layer);
    }

    getShader(id, fragment) {
        if (!this[id]) {
            // shared vertex shader for textured quad rendering
            const vertex = /* glsl */ `
                attribute vec2 vertex_position;
                uniform mat4 matrix_model;
                varying vec2 uv0;
                void main(void) {
                    gl_Position = matrix_model * vec4(vertex_position, 0, 1);
                    uv0 = vertex_position.xy + 0.5;
                }
            `;

            this[id] = createShaderFromCode(this.device, vertex, fragment, `DebugShader:${id}`);
        }
        return this[id];
    }

    // shader used to display texture
    getTextureShader(encoding) {
        const decodeFunc = ChunkUtils.decodeFunc(encoding);
        return this.getShader(`textureShader-${encoding}`, shaderChunks.decodePS + shaderChunks.gamma2_2PS +
        /* glsl */ `
            varying vec2 uv0;
            uniform sampler2D colorMap;
            void main (void) {
                vec3 linearColor = ${decodeFunc}(texture2D(colorMap, uv0));
                gl_FragColor = vec4(gammaCorrectOutput(linearColor), 1);
            }
        `);
    }

    // shader used to display infilterable texture sampled using texelFetch
    getUnfilterableTextureShader() {
        return this.getShader('textureShaderUnfilterable', /* glsl */ `
            varying vec2 uv0;
            uniform highp sampler2D colorMap;
            void main (void) {
                ivec2 uv = ivec2(uv0 * textureSize(colorMap, 0));
                gl_FragColor = vec4(texelFetch(colorMap, uv, 0).xyz, 1);
            }
        `);
    }

    // shader used to display depth texture
    getDepthTextureShader() {
        return this.getShader('depthTextureShader', /* glsl */ `
            ${shaderChunks.screenDepthPS}
            varying vec2 uv0;
            void main() {
                float depth = getLinearScreenDepth(getImageEffectUV(uv0)) * camera_params.x;
                gl_FragColor = vec4(vec3(depth), 1.0);
            }
        `);
    }

    // creates mesh used to render a quad
    getQuadMesh() {
        if (!this.quadMesh) {
            this.quadMesh = new Mesh(this.device);
            this.quadMesh.setPositions([
                -0.5, -0.5, 0,
                0.5, -0.5, 0,
                -0.5, 0.5, 0,
                0.5, 0.5, 0
            ]);
            this.quadMesh.update(PRIMITIVE_TRISTRIP);
        }
        return this.quadMesh;
    }

    // Draw mesh at this frame
    drawMesh(material, matrix, mesh, meshInstance, layer) {

        // create a mesh instance for the mesh if needed
        if (!meshInstance) {
            const graphNode = this.getGraphNode(matrix);
            meshInstance = new MeshInstance(mesh, material, graphNode);
        }

        // add the mesh instance to an array per layer, they get added to layers before rendering
        let layerMeshInstances = this.layerMeshInstances.get(layer);
        if (!layerMeshInstances) {
            layerMeshInstances = [];
            this.layerMeshInstances.set(layer, layerMeshInstances);
        }
        layerMeshInstances.push(meshInstance);
    }

    drawWireAlignedBox(min, max, color, depthTest, layer, mat) {
        if (mat) {
            const mulPoint = (x, y, z) => {
                vec.set(x, y, z);
                mat.transformPoint(vec, vec);
                tempPoints.push(vec.x, vec.y, vec.z);
            };

            mulPoint(min.x, min.y, min.z); mulPoint(min.x, max.y, min.z);
            mulPoint(min.x, max.y, min.z); mulPoint(max.x, max.y, min.z);
            mulPoint(max.x, max.y, min.z); mulPoint(max.x, min.y, min.z);
            mulPoint(max.x, min.y, min.z); mulPoint(min.x, min.y, min.z);
            mulPoint(min.x, min.y, max.z); mulPoint(min.x, max.y, max.z);
            mulPoint(min.x, max.y, max.z); mulPoint(max.x, max.y, max.z);
            mulPoint(max.x, max.y, max.z); mulPoint(max.x, min.y, max.z);
            mulPoint(max.x, min.y, max.z); mulPoint(min.x, min.y, max.z);
            mulPoint(min.x, min.y, min.z); mulPoint(min.x, min.y, max.z);
            mulPoint(min.x, max.y, min.z); mulPoint(min.x, max.y, max.z);
            mulPoint(max.x, max.y, min.z); mulPoint(max.x, max.y, max.z);
            mulPoint(max.x, min.y, min.z); mulPoint(max.x, min.y, max.z);
        } else {
            tempPoints.push(
                min.x, min.y, min.z, min.x, max.y, min.z,
                min.x, max.y, min.z, max.x, max.y, min.z,
                max.x, max.y, min.z, max.x, min.y, min.z,
                max.x, min.y, min.z, min.x, min.y, min.z,
                min.x, min.y, max.z, min.x, max.y, max.z,
                min.x, max.y, max.z, max.x, max.y, max.z,
                max.x, max.y, max.z, max.x, min.y, max.z,
                max.x, min.y, max.z, min.x, min.y, max.z,
                min.x, min.y, min.z, min.x, min.y, max.z,
                min.x, max.y, min.z, min.x, max.y, max.z,
                max.x, max.y, min.z, max.x, max.y, max.z,
                max.x, min.y, min.z, max.x, min.y, max.z
            );
        }

        const batch = this.getBatch(layer, depthTest);
        batch.addLinesArrays(tempPoints, color);
        tempPoints.length = 0;
    }

    drawWireSphere(center, radius, color, numSegments, depthTest, layer) {

        const step = 2 * Math.PI / numSegments;
        let angle = 0;

        for (let i = 0; i < numSegments; i++) {
            const sin0 = Math.sin(angle);
            const cos0 = Math.cos(angle);
            angle += step;
            const sin1 = Math.sin(angle);
            const cos1 = Math.cos(angle);

            tempPoints.push(center.x + radius * sin0, center.y, center.z + radius * cos0);
            tempPoints.push(center.x + radius * sin1, center.y, center.z + radius * cos1);
            tempPoints.push(center.x + radius * sin0, center.y + radius * cos0, center.z);
            tempPoints.push(center.x + radius * sin1, center.y + radius * cos1, center.z);
            tempPoints.push(center.x, center.y + radius * sin0, center.z + radius * cos0);
            tempPoints.push(center.x, center.y + radius * sin1, center.z + radius * cos1);
        }

        const batch = this.getBatch(layer, depthTest);
        batch.addLinesArrays(tempPoints, color);
        tempPoints.length = 0;
    }

    getGraphNode(matrix) {
        const graphNode = new GraphNode('ImmediateDebug');
        graphNode.worldTransform = matrix;
        graphNode._dirtyWorld = graphNode._dirtyNormal = false;

        return graphNode;
    }

    // This is called just before the layer is rendered to allow lines for the layer to be added from inside
    // the frame getting rendered
    onPreRenderLayer(layer, visibleList, transparent) {

        // update line batches for the specified sub-layer
        this.batchesMap.forEach((batches, batchLayer) => {
            if (batchLayer === layer) {
                batches.onPreRender(visibleList, transparent);
            }
        });

        // only update meshes once for each layer (they're not per sub-layer at the moment)
        if (!this.updatedLayers.has(layer)) {
            this.updatedLayers.add(layer);

            // add mesh instances for specified layer to visible list
            const meshInstances = this.layerMeshInstances.get(layer);
            if (meshInstances) {
                for (let i = 0; i < meshInstances.length; i++) {
                    visibleList.push(meshInstances[i]);
                }
                meshInstances.length = 0;
            }
        }
    }

    // called after the frame was rendered, clears data
    onPostRender() {

        // clean up line batches
        this.allBatches.forEach(batch => batch.clear());
        this.allBatches.clear();

        // all batches need updating next frame
        this.updatedLayers.clear();
    }
}

export { Immediate };
