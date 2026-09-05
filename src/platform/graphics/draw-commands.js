import { Debug } from '../../core/debug.js';

/**
 * Container holding parameters for multi-draw commands.
 *
 * Obtain an instance via {@link MeshInstance#setMultiDraw} and populate it using {@link add}
 * followed by {@link update}.
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
     * Platform-specific implementation.
     *
     * @type {any}
     * @ignore
     */
    impl = null;

    /**
     * Number of draw calls to perform.
     *
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
     * @ignore
     */
    slotIndex = 0;

    // #if _PROFILER
    /** @private */
    _primitiveCount = 0;

    /** @private */
    _primitiveType = -1;

    /** @private */
    _primitiveInstanced = false;
    // #endif

    /**
     * @param {import('./graphics-device.js').GraphicsDevice} device - The graphics device.
     * @param {number} [indexSizeBytes] - Size of index in bytes for WebGL multi-draw (1, 2 or 4).
     * @ignore
     */
    constructor(device, indexSizeBytes = 0) {
        this.device = device;
        this.indexSizeBytes = indexSizeBytes;
        this.impl = device.createDrawCommandImpl(this);
    }

    /** @ignore */
    destroy() {
        this.impl?.destroy?.();
        this.impl = null;
    }

    /**
     * Allocates persistent storage for the draw commands.
     *
     * @param {number} maxCount - Maximum number of draw calls to allocate storage for.
     * @ignore
     */
    allocate(maxCount) {
        this._maxCount = maxCount;
        this.impl.allocate?.(maxCount);
        // #if _PROFILER
        this._primitiveType = -1;
        // #endif
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
        this.impl.add(i, indexOrVertexCount, instanceCount, firstIndexOrVertex, baseVertex, firstInstance);
    }

    /**
     * Finalize and set draw count after all commands have been added.
     *
     * @param {number} count - Number of draws to execute.
     */
    update(count) {
        this._count = count;
        this.impl.update?.(count);
        // #if _PROFILER
        this._primitiveType = -1;
        // #endif
    }

    // #if _PROFILER
    /**
     * Count primitives using the topology at submission time, which is not known when commands
     * are populated. Cache the result across passes and frames until update is called again.
     *
     * @param {number} type - Primitive topology.
     * @param {boolean} [instanced] - Whether to apply per-command instance counts. Defaults to true.
     * @returns {number} Primitive count, or zero for GPU-authored indirect commands.
     * @ignore
     */
    getPrimitiveCount(type, instanced = true) {
        if (this._primitiveType !== type || this._primitiveInstanced !== instanced) {
            this._primitiveCount = this.impl.getPrimitiveCount?.(this._count, type, instanced) ?? 0;
            this._primitiveType = type;
            this._primitiveInstanced = instanced;
        }
        return this._primitiveCount;
    }
    // #endif
}

export { DrawCommands };
