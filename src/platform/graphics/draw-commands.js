import { Debug } from '../../core/debug.js';
import { BUFFERUSAGE_COPY_DST, BUFFERUSAGE_INDIRECT } from './constants.js';
import { StorageBuffer } from './storage-buffer.js';

/**
 * Container holding parameters for multi-draw commands.
 *
 * Obtain an instance via {@link MeshInstance#setMultiDraw} and populate it using
 * {@link DrawCommands#add} followed by {@link DrawCommands#update}.
 *
 * @category Graphics
 */
class DrawCommands {
    /**
     * Graphics device used to determine backend (WebGPU vs WebGL).
     *
     * @type {import('./graphics-device.js').GraphicsDevice}
     * @ignore
     */
    device;

    /**
     * Size of single index in bytes for WebGL multi-draw (1, 2 or 4). 0 represents non-indexed draw.
     *
     * @type {number}
     * @ignore
     */
    indexSizeBytes;

    /**
     * Maximum number of multi-draw calls the space is allocated for. Ignored for indirect draw commands.
     *
     * @type {number}
     * @private
     */
    _maxCount = 0;

    /**
     * Maximum number of multi-draw calls the space is allocated for.
     *
     * @type {number}
     */
    get maxCount() {
        return this._maxCount;
    }

    /**
     * Five integers to describe a draw, WebGPU only.
     * [ indexCount/vertexCount, instanceCount, firstIndex/firstVertex, baseVertex(signed), firstInstance ]
     *
     * @type {Uint32Array|null}
     * @ignore
     */
    gpuIndirect = null;

    /**
     * Signed view over gpuIndirect to write baseVertex, WebGPU only.
     *
     * @type {Int32Array|null}
     * @ignore
     */
    gpuIndirectSigned = null;

    /**
     * GPU storage buffer backing AoS data, WebGPU only.
     *
     * @type {StorageBuffer|null}
     * @ignore
     */
    storage = null;

    /**
     * Per-draw counts. WebGL only.
     *
     * @type {Int32Array|null}
     * @ignore
     */
    glCounts = null;

    /**
     * Per-draw index byte offsets. WebGL only.
     *
     * @type {Int32Array|null}
     * @ignore
     */
    glOffsetsBytes = null;

    /**
     * Per-draw instance counts. WebGL only.
     *
     * @type {Int32Array|null}
     * @ignore
     */
    glInstanceCounts = null;

    /**
     * Number of draw calls to perform.
     *
     * @type {number}
     * @private
     */
    _count = 1;

    /**
     * Number of draw calls to perform.
     *
     * @type {number}
     */
    get count() {
        return this._count;
    }

    /**
     * Slot index of the first indirect draw call. Ignored for multi-draw commands.
     *
     * @type {number}
     * @ignore
     */
    slotIndex = 0;

    /**
     * @param {import('./graphics-device.js').GraphicsDevice} device - The graphics device.
     * @param {number} [indexSizeBytes] - Size of index in bytes for WebGL multi-draw (1, 2 or 4).
     * @ignore
     */
    constructor(device, indexSizeBytes = 0) {
        this.device = device;
        this.indexSizeBytes = indexSizeBytes;
    }

    /**
     * @ignore
     */
    destroy() {
        this.storage?.destroy();
        this.storage = null;
    }

    /**
     * Allocates persistent storage for the draw commands.
     *
     * @param {number} maxCount - Maximum number of draw calls to allocate storage for.
     * @ignore
     */
    allocate(maxCount) {
        this._maxCount = maxCount;

        if (this.device.isWebGPU) {
            this.gpuIndirect = new Uint32Array(5 * maxCount);
            this.gpuIndirectSigned = new Int32Array(this.gpuIndirect.buffer);
            this.storage = new StorageBuffer(this.device, this.gpuIndirect.byteLength, BUFFERUSAGE_INDIRECT | BUFFERUSAGE_COPY_DST);
        } else {
            this.glCounts = new Int32Array(maxCount);
            this.glOffsetsBytes = new Int32Array(maxCount);
            this.glInstanceCounts = new Int32Array(maxCount);
        }
    }

    /**
     * Writes one draw command into the allocated storage.
     *
     * @param {number} i - Draw index to update.
     * @param {number} indexOrVertexCount - Number of indices or vertices to draw.
     * @param {number} instanceCount - Number of instances to draw (use 1 if not instanced).
     * @param {number} firstIndexOrVertex - Starting index (in indices, not bytes) or starting vertex.
     * @param {number} [baseVertex] - Signed base vertex (WebGPU only). Defaults to 0.
     * @param {number} [firstInstance] - First instance (WebGPU only). Defaults to 0.
     */
    add(i, indexOrVertexCount, instanceCount, firstIndexOrVertex, baseVertex = 0, firstInstance = 0) {
        Debug.assert(i >= 0 && i < this._maxCount);

        if (this.device.isWebGPU) {
            const o = i * 5;
            this.gpuIndirect[o + 0] = indexOrVertexCount;
            this.gpuIndirect[o + 1] = instanceCount;
            this.gpuIndirect[o + 2] = firstIndexOrVertex;
            this.gpuIndirectSigned[o + 3] = baseVertex;
            this.gpuIndirect[o + 4] = firstInstance;
        } else {
            // WebGL: SoA lists for WEBGL_multi_draw (elements variants)
            this.glCounts[i] = indexOrVertexCount;
            this.glOffsetsBytes[i] = (firstIndexOrVertex * this.indexSizeBytes);
            this.glInstanceCounts[i] = instanceCount;
        }
    }

    /**
     * Finalize and set draw count after all commands have been added.
     *
     * @param {number} count - Number of draws to execute.
     */
    update(count) {
        this._count = count;

        // upload only the used portion of data to the storage buffer
        if (this.device.isWebGPU && this.storage && this.gpuIndirect) {
            if (this._count > 0) {
                const used = this._count * 5; // 5 uints per draw
                this.storage.write(0, this.gpuIndirect, 0, used);
            }
        }
    }
}

export { DrawCommands };
