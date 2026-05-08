import { Debug, DebugHelper } from '../../../core/debug.js';
import { BUFFERUSAGE_COPY_DST, BUFFERUSAGE_COPY_SRC } from '../../../platform/graphics/constants.js';
import { StorageBuffer } from '../../../platform/graphics/storage-buffer.js';

/**
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 */

/**
 * Abstract base class for the compute radix sort backends ({@link ComputeRadixSortMultipass}
 * and {@link ComputeRadixSortOneSweep}). Not intended for direct use; always accessed via the
 * {@link ComputeRadixSort} facade.
 *
 * Backends share the same public `sort` / `sortIndirect` / `prepareIndirect` API so the facade
 * can forward calls without inspecting the concrete implementation.
 *
 * @category Graphics
 * @ignore
 */
class ComputeRadixSortBase {
    /**
     * The graphics device.
     *
     * @type {GraphicsDevice}
     */
    device;

    /**
     * Whether this sorter instance was created for indirect-dispatch use only. When `true`,
     * only indirect-mode shaders are compiled and {@link sort} is unavailable.
     *
     * @type {boolean}
     */
    _indirect = false;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {boolean} [indirect] - Whether the instance is for indirect dispatch only.
     */
    constructor(device, indirect = false) {
        this.device = device;
        this._indirect = indirect;
    }

    /**
     * Minimum element capacity for internal buffers. Set by the caller as a high-water mark to
     * avoid reallocation churn when the workload shrinks; can be lowered to request shrinkage at
     * the next sort call. Concrete backends size allocations using max(element count for the sort,
     * `capacity`); reallocation is deferred until the next sort when that effective size changes.
     * Updated by implementations after allocation.
     *
     * @type {number}
     */
    capacity = 0;

    /**
     * Current element count for the last or in-progress sort.
     *
     * @type {number}
     * @protected
     */
    _elementCount = 0;

    /**
     * Number of key bits the current passes are built for.
     *
     * @type {number}
     * @protected
     */
    _numBits = 0;

    /**
     * Whether the current sort uses caller-supplied initial values on pass 0.
     *
     * @type {boolean}
     * @protected
     */
    _hasInitialValues = false;

    /**
     * When true, the last pass skips writing sorted keys (values only); {@link sortedKeys} may be stale.
     *
     * @type {boolean}
     * @protected
     */
    _skipLastPassKeyWrite = false;

    /**
     * Internal keys buffer 0 (ping-pong).
     *
     * @type {StorageBuffer|null}
     * @protected
     */
    _keys0 = null;

    /**
     * Internal keys buffer 1 (ping-pong).
     *
     * @type {StorageBuffer|null}
     * @protected
     */
    _keys1 = null;

    /**
     * Internal values/indices buffer 0 (ping-pong).
     *
     * @type {StorageBuffer|null}
     * @protected
     */
    _values0 = null;

    /**
     * Internal values/indices buffer 1 (ping-pong).
     *
     * @type {StorageBuffer|null}
     * @protected
     */
    _values1 = null;

    /**
     * Output sorted indices (or caller values) buffer.
     *
     * @type {StorageBuffer|null}
     * @protected
     */
    _sortedIndices = null;

    /**
     * Stable metadata buffer returned by {@link prepareIndirect}. Preallocated as four `u32`
     * entries; concrete backends assign `[slotCount, g0, g1, g2]` after `super(device)`. The caller
     * uploads its contents into a GPU uniform unchanged.
     *
     * @type {Uint32Array}
     * @protected
     */
    _indirectInfo = new Uint32Array(4);

    /**
     * Returns the sorted indices (or values, when `initialValues` was passed) buffer of the last
     * completed sort.
     *
     * @type {StorageBuffer|null}
     */
    get sortedIndices() {
        return this._sortedIndices;
    }

    /**
     * Returns the sorted keys buffer after the last sort. Keys live in one of the internal
     * ping-pong buffers depending on pass count and {@link radixBits}.
     *
     * @type {StorageBuffer|null}
     */
    get sortedKeys() {
        if (!this._keys0) {
            return null;
        }
        const radix = this.radixBits;
        const numPasses = this._numBits / radix;
        return (numPasses % 2 === 0) ? this._keys1 : this._keys0;
    }

    /**
     * Radix width in bits for this backend. Callers can align their key bit counts to the radix
     * boundary generically without knowing which backend is active.
     *
     * @type {number}
     * @abstract
     */
    get radixBits() {
        Debug.error('ComputeRadixSortBase.radixBits must be implemented by a subclass');
        return 0;
    }

    /**
     * Executes a direct-dispatch radix sort. See subclass docs for argument semantics.
     *
     * @param {StorageBuffer} keysBuffer - Input keys buffer.
     * @param {number} elementCount - Number of elements to sort.
     * @param {number} [numBits] - Number of bits to sort.
     * @param {StorageBuffer} [initialValues] - Optional initial values buffer for pass 0.
     * @param {boolean} [skipLastPassKeyWrite] - Skip writing keys on the last pass.
     * @returns {StorageBuffer} Sorted values buffer.
     * @abstract
     */
    sort(keysBuffer, elementCount, numBits, initialValues, skipLastPassKeyWrite) {
        Debug.error('ComputeRadixSortBase.sort must be implemented by a subclass');
        return /** @type {any} */ (null);
    }

    /**
     * Executes an indirect-dispatch radix sort using workgroup counts pre-written into
     * `device.indirectDispatchBuffer` (typically by a shader that included the
     * `sortIndirectArgsCS` WGSL chunk). See subclass docs for argument semantics.
     *
     * @param {StorageBuffer} keysBuffer - Input keys buffer.
     * @param {number} maxElementCount - Maximum elements (allocation size).
     * @param {number} numBits - Number of bits to sort.
     * @param {number} sortSlotBase - Base indirect dispatch slot index. The backend uses
     * `slotCount` consecutive slots starting at this index; see {@link prepareIndirect}.
     * @param {StorageBuffer} sortElementCountBuffer - GPU-written element count buffer.
     * @param {StorageBuffer} [initialValues] - Optional initial values buffer for pass 0.
     * @param {boolean} [skipLastPassKeyWrite] - Skip writing keys on the last pass.
     * @returns {StorageBuffer} Sorted values buffer.
     * @abstract
     */
    sortIndirect(keysBuffer, maxElementCount, numBits, sortSlotBase, sortElementCountBuffer, initialValues, skipLastPassKeyWrite) {
        Debug.error('ComputeRadixSortBase.sortIndirect must be implemented by a subclass');
        return /** @type {any} */ (null);
    }

    /**
     * Returns stable sort metadata describing how many indirect dispatch slots this backend uses
     * and the elements-per-workgroup granularity of each slot. The returned 4-element Uint32
     * array is sorter-owned and never reallocated across calls, so it can be uploaded directly as
     * a uniform `vec4<u32>` and reused as the `slotInfo` argument to the `writeSortIndirectArgs`
     * WGSL helper (see `sortIndirectArgsCS` chunk):
     *
     * ```
     * [slotCount, g0, g1, g2]   // g_i = elements-per-workgroup for slot i; unused entries = 0
     * ```
     *
     * The caller must reserve `slotCount` consecutive slots in `device.indirectDispatchBuffer`
     * via {@link GraphicsDevice#getIndirectDispatchSlot} and pass the resulting base to
     * {@link sortIndirect}.
     *
     * @returns {Uint32Array} Sorter-owned 4-element Uint32 array (stable across calls).
     */
    prepareIndirect() {
        return this._indirectInfo;
    }

    /**
     * Allocates ping-pong key/value buffers and the sorted output buffer (`u32` per element).
     *
     * @param {number} effectiveCount - Element high-water count (same units as `capacity` sizing).
     * @protected
     */
    _allocatePingPongElementBuffers(effectiveCount) {
        const elementSize = effectiveCount * 4;
        const usage = BUFFERUSAGE_COPY_SRC | BUFFERUSAGE_COPY_DST;
        const device = this.device;
        this._keys0 = new StorageBuffer(device, elementSize, usage);
        this._keys1 = new StorageBuffer(device, elementSize, usage);
        this._values0 = new StorageBuffer(device, elementSize, usage);
        this._values1 = new StorageBuffer(device, elementSize, usage);
        this._sortedIndices = new StorageBuffer(device, elementSize, usage);
        DebugHelper.setName(this._keys0, 'ComputeRadixSort.keys0');
        DebugHelper.setName(this._keys1, 'ComputeRadixSort.keys1');
        DebugHelper.setName(this._values0, 'ComputeRadixSort.values0');
        DebugHelper.setName(this._values1, 'ComputeRadixSort.values1');
        DebugHelper.setName(this._sortedIndices, 'ComputeRadixSort.sortedIndices');
    }

    /**
     * Destroys ping-pong keys/values and sorted output buffers owned by the base.
     *
     * @protected
     */
    _destroyPingPongBuffers() {
        this._keys0?.destroy();
        this._keys1?.destroy();
        this._values0?.destroy();
        this._values1?.destroy();
        this._sortedIndices?.destroy();

        this._keys0 = null;
        this._keys1 = null;
        this._values0 = null;
        this._values1 = null;
        this._sortedIndices = null;
    }

    /**
     * Releases resources owned by this backend.
     */
    destroy() {
    }
}

export { ComputeRadixSortBase };
