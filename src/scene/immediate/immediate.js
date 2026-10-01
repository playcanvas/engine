import { Debug } from '../../core/debug.js';
import { SEMANTIC_COLOR, SEMANTIC_POSITION, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../platform/graphics/constants.js';

import { BLEND_NORMAL } from '../constants.js';
import { ShaderMaterial } from '../materials/shader-material.js';
import { ImmediateBatches } from './immediate-batches.js';
import { LineWriter } from './line-writer.js';

import { Vec3 } from '../../core/math/vec3.js';
import { ShaderChunks } from '../shader-lib/shader-chunks.js';

const tempPoints = [];
const vec = new Vec3();

class Immediate {
    constructor(device) {
        this.device = device;
        this.cubeLocalPos = null;
        this.cubeWorldPos = null;

        // map of Layer to ImmediateBatches, storing line batches for a layer
        this.batchesMap = new Map();

        // set of all batches that were used in the frame
        this.allBatches = new Set();

        // single cursor handed out by allocateLines, so allocating costs no garbage
        this.lineWriter = new LineWriter();

        // line materials
        this._materialDepth = null;
        this._materialNoDepth = null;
    }

    // creates material for line rendering
    createMaterial(depthTest) {
        const material = new ShaderMaterial({
            uniqueName: 'ImmediateLine',
            vertexGLSL: ShaderChunks.get(this.device, SHADERLANGUAGE_GLSL).get('immediateLineVS'),
            fragmentGLSL: ShaderChunks.get(this.device, SHADERLANGUAGE_GLSL).get('immediateLinePS'),
            vertexWGSL: ShaderChunks.get(this.device, SHADERLANGUAGE_WGSL).get('immediateLineVS'),
            fragmentWGSL: ShaderChunks.get(this.device, SHADERLANGUAGE_WGSL).get('immediateLinePS'),
            attributes: {
                vertex_position: SEMANTIC_POSITION,
                vertex_color: SEMANTIC_COLOR
            }
        });
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

    /**
     * Allocates space for exactly `vertexCount` line vertices and returns a cursor positioned at
     * the start of it, letting a caller generate lines straight into the batch instead of building
     * an array to be copied in.
     *
     * The space is accounted for immediately, so the caller must fill all of it. The cursor is a
     * single reused instance and is only valid until the next allocation - use it inside the
     * function that writes the data, and do not keep hold of it. For the same reason an allocation
     * must not straddle rendering, as the batch may be submitted while it is still being written.
     *
     * @param {number} vertexCount - The number of vertices to allocate. Two vertices per segment.
     * @param {import('../../core/math/color.js').Color} color - The color used by
     * {@link LineWriter#segment}.
     * @param {boolean} depthTest - Whether the lines are depth tested.
     * @param {import('../layer.js').Layer} layer - The layer to render the lines into.
     * @returns {LineWriter} The cursor to write the vertices with.
     * @ignore
     */
    allocateLines(vertexCount, color, depthTest, layer) {
        const writer = this.lineWriter;
        Debug.assert(writer.filled,
            'Immediate#allocateLines was called while a previous allocation was still unfilled. A cursor must be filled by the function that allocated it.');

        const batch = this.getBatch(layer, depthTest);
        const first = batch.allocate(vertexCount);
        writer.reset(batch._positions, batch._colors, first, vertexCount, color);
        return writer;
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

    // This is called just before the layer is rendered to allow lines for the layer to be added from inside
    // the frame getting rendered
    onPreRenderLayer(layer, visibleList, transparent) {

        // update line batches for the specified sub-layer
        this.batchesMap.forEach((batches, batchLayer) => {
            if (batchLayer === layer) {
                batches.onPreRender(visibleList, transparent);
            }
        });
    }

    // called after the frame was rendered, clears data
    onPostRender() {

        // clean up line batches
        this.allBatches.forEach(batch => batch.clear());
        this.allBatches.clear();
    }
}

export { Immediate };
