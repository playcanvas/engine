import { DebugHelper } from '../../core/debug.js';
import { StorageBuffer } from '../../platform/graphics/storage-buffer.js';
import { BUFFERUSAGE_COPY_SRC } from '../../platform/graphics/constants.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 */

/**
 * Transient GPU scratch shared by the GPU-sort (hybrid) rendering path within a single
 * {@link GSplatManager} — the forward {@link GSplatHybridRenderer} and the directional
 * {@link GSplatShadowRenderer}. The manager creates one instance while a GPU-sort renderer is in use
 * and injects it into both paths' {@link GSplatIntervalCompaction}; it is freed when the manager
 * switches to a non-GPU-sort renderer or is destroyed. The CPU-sort (quad) path uses none of this.
 *
 * Buffers here are written + read at disjoint points in the frame (the forward sort in
 * `update()`, the shadow cull in `updateShadows()`), so a single shared allocation is safe — the
 * backend serialises them with the usual read/write barriers. It is per-manager (hence per-world),
 * so separate cameras/layers never contend on the same buffer.
 *
 * Starts with just the compaction candidate-index list; further shared scratch can be added here as
 * the hybrid path grows.
 *
 * @ignore
 */
class GSplatHybridRendererScratch {
    /** @type {GraphicsDevice} */
    device;

    /**
     * Dense compacted work-buffer index list produced by {@link GSplatIntervalCompaction} (the
     * coarse-cull survivors). Sized to the work buffer's active splat count; grows monotonically.
     *
     * @type {StorageBuffer|null}
     */
    compactedSplatIds = null;

    /** @type {number} */
    _allocatedCompacted = 0;

    /**
     * @param {GraphicsDevice} device - The graphics device (must support compute).
     */
    constructor(device) {
        this.device = device;
    }

    /**
     * Ensures the shared candidate-index scratch holds at least `capacity` u32 entries, growing it
     * if needed. Returns the buffer so the caller can bind it.
     *
     * @param {number} capacity - Required entry count (work-buffer total active splats).
     * @returns {StorageBuffer} The candidate-index scratch buffer.
     */
    ensureCompactedSplatIds(capacity) {
        if (capacity > this._allocatedCompacted) {
            this.compactedSplatIds?.destroy();
            this._allocatedCompacted = capacity;
            this.compactedSplatIds = new StorageBuffer(this.device, capacity * 4, BUFFERUSAGE_COPY_SRC);
            DebugHelper.setName(this.compactedSplatIds, 'GSplatHybridRendererScratch.compactedSplatIds');
        }
        return this.compactedSplatIds;
    }

    destroy() {
        this.compactedSplatIds?.destroy();
        this.compactedSplatIds = null;
        this._allocatedCompacted = 0;
    }
}

export { GSplatHybridRendererScratch };
