import { Debug } from '../../core/debug.js';
import { Mat4 } from '../../core/math/mat4.js';

import { PRIMITIVE_LINES } from '../../platform/graphics/constants.js';

import { Mesh } from '../mesh.js';
import { MeshInstance } from '../mesh-instance.js';
import { GraphNode } from '../graph-node.js';

/**
 * @import { Color } from '../../core/math/color.js'
 */

const identityGraphNode = new GraphNode();
identityGraphNode.worldTransform = Mat4.IDENTITY;
identityGraphNode._dirtyWorld = identityGraphNode._dirtyNormal = false;

// smallest storage a batch keeps once it has been used, in vertices
const MIN_VERTEX_CAPACITY = 256;

// number of frames a batch must go without needing more than half its storage before the
// remainder is handed back
const SHRINK_FRAME_DELAY = 100;

// helper class storing data for a single batch of line rendering using a single material
class ImmediateBatch {
    /**
     * Packed xyz positions. Only the first `_vertexCount` vertices hold data for the current
     * frame, the rest is spare capacity retained between frames.
     *
     * @type {Float32Array}
     * @private
     */
    _positions = new Float32Array(0);

    /**
     * Packed rgba colors, one per position.
     *
     * @type {Float32Array}
     * @private
     */
    _colors = new Float32Array(0);

    /**
     * Vertices written so far this frame.
     *
     * @type {number}
     * @private
     */
    _vertexCount = 0;

    /**
     * Vertices the buffers can hold without reallocating.
     *
     * @type {number}
     * @private
     */
    _capacity = 0;

    /**
     * Largest vertex count seen since shrinking was last considered.
     *
     * @type {number}
     * @private
     */
    _peakVertexCount = 0;

    /**
     * Frames elapsed since a frame needed more than half the storage.
     *
     * @type {number}
     * @private
     */
    _framesSinceHighUse = 0;

    constructor(device, material, layer) {
        this.material = material;
        this.layer = layer;

        this.mesh = new Mesh(device);
        this.meshInstance = null;
    }

    /**
     * Ensures room for the supplied number of additional vertices, growing by doubling so a batch
     * filled over many calls does not reallocate on each one.
     *
     * @param {number} count - The number of vertices about to be added.
     * @private
     */
    _reserve(count) {
        const required = this._vertexCount + count;
        if (required <= this._capacity) {
            return;
        }

        let capacity = Math.max(this._capacity, MIN_VERTEX_CAPACITY);
        while (capacity < required) {
            capacity *= 2;
        }
        this._setCapacity(capacity);
    }

    /**
     * Reallocates the storage, preserving whatever has already been added this frame.
     *
     * @param {number} capacity - The new capacity in vertices.
     * @private
     */
    _setCapacity(capacity) {
        const positions = new Float32Array(capacity * 3);
        const colors = new Float32Array(capacity * 4);

        const retained = Math.min(this._vertexCount, capacity);
        if (retained > 0) {
            positions.set(this._positions.subarray(0, retained * 3));
            colors.set(this._colors.subarray(0, retained * 4));
        }

        this._positions = positions;
        this._colors = colors;
        this._capacity = capacity;
    }

    /**
     * Claims a range of vertices for the caller to write into directly, and accounts for it
     * immediately. The caller must fill all of it, as unwritten vertices are left at whatever the
     * storage already held.
     *
     * @param {number} count - The number of vertices to claim.
     * @returns {number} The first vertex of the claimed range.
     * @ignore
     */
    allocate(count) {
        this._reserve(count);
        const first = this._vertexCount;
        this._vertexCount += count;
        return first;
    }

    /**
     * Writes a single color to every vertex of a range.
     *
     * @param {Color} color - The color to write.
     * @param {number} first - The first vertex to write.
     * @param {number} count - The number of vertices to write.
     * @private
     */
    _writeUniformColor(color, first, count) {
        const dest = this._colors;
        const { r, g, b, a } = color;
        let c = first * 4;
        for (let i = 0; i < count; i++) {
            dest[c++] = r;
            dest[c++] = g;
            dest[c++] = b;
            dest[c++] = a;
        }
    }

    // add line positions and colors to the batch
    // this function expects position in Vec3 and colors in Color format
    addLines(positions, color) {

        const count = positions.length;
        const first = this._vertexCount;
        this._reserve(count);

        // positions
        const destPos = this._positions;
        let p = first * 3;
        for (let i = 0; i < count; i++) {
            const pos = positions[i];
            destPos[p++] = pos.x;
            destPos[p++] = pos.y;
            destPos[p++] = pos.z;
        }

        // colors
        if (color.length) {
            // multi colored line
            Debug.assert(color.length === count,
                `Expected ${count} colors to match the supplied positions, got ${color.length}.`);

            const destCol = this._colors;
            let c = first * 4;
            for (let i = 0; i < count; i++) {
                const col = color[i];
                destCol[c++] = col.r;
                destCol[c++] = col.g;
                destCol[c++] = col.b;
                destCol[c++] = col.a;
            }
        } else {
            // single colored line
            this._writeUniformColor(color, first, count);
        }

        this._vertexCount += count;
    }

    // add line positions and colors to the batch
    // this function expects positions as arrays of numbers
    // and color as instance of Color or array of number specifying the same number of vertices as positions
    addLinesArrays(positions, color) {

        const floats = positions.length;
        const count = floats / 3;
        const first = this._vertexCount;
        this._reserve(count);

        // positions
        const destPos = this._positions;
        let p = first * 3;
        for (let i = 0; i < floats; i++) {
            destPos[p++] = positions[i];
        }

        // colors
        if (color.length) {
            Debug.assert(color.length === count * 4,
                `Expected ${count * 4} color values to match the supplied positions, got ${color.length}.`);

            const destCol = this._colors;
            const colorFloats = count * 4;
            let c = first * 4;
            for (let i = 0; i < colorFloats; i++) {
                destCol[c++] = color[i];
            }
        } else {
            // single colored line
            this._writeUniformColor(color, first, count);
        }

        this._vertexCount += count;
    }

    onPreRender(visibleList, transparent) {

        // prepare mesh if its transparency matches
        if (this._vertexCount > 0 && this.material.transparent === transparent) {

            // update mesh vertices, using only the part of the storage written this frame
            this.mesh.setPositions(this._positions, 3, this._vertexCount);
            this.mesh.setColors(this._colors, 4, this._vertexCount);
            this.mesh.update(PRIMITIVE_LINES, false);
            if (!this.meshInstance) {
                this.meshInstance = new MeshInstance(this.mesh, this.material, identityGraphNode);

                // the mesh instance is injected straight into the visible list and its bounding
                // box is never computed, so it must not take part in culling
                this.meshInstance.cull = false;
            }

            // inject mesh instance into visible list to be rendered
            visibleList.push(this.meshInstance);
        }
    }

    clear() {
        // lines live for one frame only, but the storage is retained so the next frame does not
        // have to grow it again
        if (this._vertexCount * 2 > this._capacity) {

            // this frame justified the storage, so restart the wait and the peak measurement
            this._framesSinceHighUse = 0;
            this._peakVertexCount = 0;
        } else {
            this._framesSinceHighUse++;
            this._peakVertexCount = Math.max(this._peakVertexCount, this._vertexCount);
        }

        this._vertexCount = 0;

        // after a long enough run of frames that did not need more than half the storage, shrink
        // to fit the largest of them rather than to the last one, so a batch whose usage varies
        // does not have to grow again immediately
        if (this._framesSinceHighUse >= SHRINK_FRAME_DELAY && this._capacity > MIN_VERTEX_CAPACITY) {

            let capacity = MIN_VERTEX_CAPACITY;
            while (capacity < this._peakVertexCount) {
                capacity *= 2;
            }
            if (capacity < this._capacity) {
                this._setCapacity(capacity);
            }

            this._peakVertexCount = 0;
            this._framesSinceHighUse = 0;
        }
    }
}

export { ImmediateBatch };
