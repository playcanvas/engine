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
     * First indirect slot, or `-1` for multi-draw.
     *
     * @ignore
     */
    slotIndex = -1;

    /**
     * True if this container is bound to GPU-driven indirect slots.
     *
     * @type {boolean}
     * @ignore
     */
    get isIndirect() {
        return this.slotIndex >= 0;
    }

    /**
     * Total number of primitives across all sub-draws (pre-calculated).
     *
     * @ignore
     */
    primitiveCount = 0;

    /**
     * True if any sub-draw has index/vertex count > 0 and instance count > 0.
     * For indirect draws (`isIndirect`), true when {@link count} > 0.
     *
     * @type {boolean}
     */
    hasDraws = false;

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
        this.slotIndex = -1;
        this.impl.allocate?.(maxCount);
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
     * Sets the draw count and {@link hasDraws}.
     *
     * @param {number} count - Number of draws to execute.
     */
    update(count) {
        this._count = count;
        this.primitiveCount = this.impl.update?.(count) ?? 0;

        // For indirect draws, the CPU cannot inspect the instance counts,
        // so we treat the draw count as the hasDraws flag.
        if (this.isIndirect) {
            this.hasDraws = count > 0;
            return;
        }

        this.hasDraws = this.impl.hasDraws ?? (count > 0);
    }
}

export { DrawCommands };
