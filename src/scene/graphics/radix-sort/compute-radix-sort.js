import { Debug } from '../../../core/debug.js';
import { RADIX_SORT_AUTO, RADIX_SORT_PORTABLE, RADIX_SORT_ONESWEEP } from '../../constants.js';
import { ComputeRadixSortMultipass } from './compute-radix-sort-multipass.js';
import { ComputeRadixSortOneSweep } from './compute-radix-sort-onesweep.js';

/**
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 * @import { StorageBuffer } from '../../../platform/graphics/storage-buffer.js'
 * @import { ComputeRadixSortBase } from './compute-radix-sort-base.js'
 */

/**
 * WebGPU compute radix sort for 32-bit unsigned integer keys. The backend
 * is picked automatically from the device's capabilities, or selected
 * explicitly via the `kind` option (see {@link RADIX_SORT_AUTO},
 * {@link RADIX_SORT_PORTABLE}, {@link RADIX_SORT_ONESWEEP}).
 *
 * Available backends:
 *  - **Portable** ({@link RADIX_SORT_PORTABLE}): Runs on every WebGPU device
 *    (no subgroup intrinsics required). Default fallback.
 *  - **OneSweep** ({@link RADIX_SORT_ONESWEEP}): Single-sweep 8-bit radix
 *    sort. Currently supported for NVIDIA only.
 *
 * Indirect dispatch:
 *  Use {@link prepareIndirect} to obtain the dispatch-slot metadata
 *  (a stable `vec4<u32>` describing slot count and granularity), reserve
 *  the reported number of slots via
 *  {@link GraphicsDevice#getIndirectDispatchSlot}, and write dispatch args
 *  from a compute shader using the `writeSortIndirectArgs` helper (WGSL
 *  chunk `sortIndirectArgsCS`). Then call {@link sortIndirect} with the
 *  slot base and a GPU-written element-count buffer.
 *
 * @example
 * import { ComputeRadixSort, StorageBuffer, BUFFERUSAGE_COPY_SRC, BUFFERUSAGE_COPY_DST } from 'playcanvas';
 *
 * const radixSort = new ComputeRadixSort(device);
 * const keys = new Uint32Array([5, 2, 8, 1, 9, 3]);
 * const keysBuffer = new StorageBuffer(device, keys.byteLength, BUFFERUSAGE_COPY_SRC | BUFFERUSAGE_COPY_DST);
 * keysBuffer.write(keys);
 *
 * // Sort and get the sorted-indices buffer (keys [5,2,8,1,9,3] → index order [3,1,5,0,2,4] for a 16-bit sort)
 * const sortedIndices = radixSort.sort(keysBuffer, keys.length, 16);
 *
 * // Use sortedIndices in subsequent GPU operations, then clean up:
 * radixSort.destroy();
 *
 * @category Graphics
 * @ignore
 */
class ComputeRadixSort {
    /**
     * The active backend implementation.
     *
     * @type {ComputeRadixSortBase}
     * @private
     */
    _impl;

    /**
     * @param {GraphicsDevice} device - The graphics device (must support compute).
     * @param {object} [options] - Options.
     * @param {number} [options.kind] - Which radix sort backend to use. One of
     * {@link RADIX_SORT_AUTO} (default), {@link RADIX_SORT_PORTABLE} or
     * {@link RADIX_SORT_ONESWEEP}.
     * @param {boolean} [options.indirect] - When `true`, the instance is configured for
     * indirect-dispatch use only. Only indirect-mode shaders are compiled (avoiding the cost of
     * compiling unused direct-mode pipelines); {@link sort} is unavailable and will assert.
     * Defaults to `false`.
     */
    constructor(device, options = {}) {
        const kind = options.kind ?? RADIX_SORT_AUTO;
        const indirect = options.indirect ?? false;

        let chosen = kind;
        if (kind === RADIX_SORT_AUTO) {
            chosen = this._canUseOneSweep(device) ? RADIX_SORT_ONESWEEP : RADIX_SORT_PORTABLE;
        }

        if (chosen === RADIX_SORT_ONESWEEP) {
            // Hard hardware prerequisites (compute, subgroups, subgroupSize
            // <= 32, valid minSubgroupSize) are asserted inside the OneSweep
            // constructor. Here we only warn on soft policy mismatches
            // (non-NVIDIA vendors), so callers can opt in for experimentation
            // on devices where OneSweep has not been validated.
            if (!this._canUseOneSweep(device)) {
                Debug.warnOnce('ComputeRadixSort: RADIX_SORT_ONESWEEP requested on a device that is not a validated OneSweep target (non-NVIDIA, or missing compute / subgroups / subgroupSize <= 32). OneSweep may hang or produce incorrect results. Consider RADIX_SORT_PORTABLE or RADIX_SORT_AUTO.');
            }
            this._impl = new ComputeRadixSortOneSweep(device, indirect);
        } else {
            this._impl = new ComputeRadixSortMultipass(device, indirect);
        }
    }

    /**
     * Returns true when the current device is a good fit for the OneSweep
     * backend. OneSweep relies on forward-thread-progress guarantees for its
     * chained-scan lookback (producer/consumer across workgroups) and on
     * 32-lane subgroup masks in the binning shader.
     *
     * @param {GraphicsDevice} device - Graphics device to inspect.
     * @returns {boolean} True if OneSweep should be preferred.
     * @private
     */
    _canUseOneSweep(device) {
        if (!device.supportsCompute || !device.supportsSubgroups) return false;
        // Adapter info may omit subgroup sizes (both stay 0); do not auto-select OneSweep then.
        if (!device.minSubgroupSize || !device.maxSubgroupSize || device.maxSubgroupSize > 32) return false;
        // Only enable on NVIDIA for now; validated on Turing+ and Ampere.
        // Other vendors either lack forward-progress guarantees (Apple) or
        // have shown correctness issues in the lookback (Mali / Imagination /
        // some Adreno).
        const vendor = device.gpuAdapter?.info?.vendor?.toLowerCase?.();
        return vendor === 'nvidia';
    }

    /**
     * Returns the sorted indices (or values, when `initialValues` was passed
     * to the last {@link sort} / {@link sortIndirect} call) buffer of the
     * last completed sort.
     *
     * @type {StorageBuffer|null}
     */
    get sortedIndices() {
        return this._impl.sortedIndices;
    }

    /**
     * Returns the sorted keys buffer of the last completed sort, or `null`
     * if the last pass skipped writing keys (`skipLastPassKeyWrite=true`).
     *
     * @type {StorageBuffer|null}
     */
    get sortedKeys() {
        return this._impl.sortedKeys;
    }

    /**
     * Radix width in bits of the active backend. Callers can align key bit
     * counts to this boundary generically without knowing which backend is
     * in use.
     *
     * @type {number}
     */
    get radixBits() {
        return this._impl.radixBits;
    }

    /**
     * High-water mark for internal buffer allocation. Setting this raises
     * the floor for the next sort's allocation; lowering it requests
     * shrinkage at the next sort call.
     *
     * @type {number}
     */
    set capacity(value) {
        this._impl.capacity = value;
    }

    get capacity() {
        return this._impl.capacity;
    }

    /**
     * Executes a direct-dispatch radix sort of `elementCount` u32 keys.
     *
     * @param {StorageBuffer} keysBuffer - Input u32 keys buffer (read-only).
     * @param {number} elementCount - Number of elements to sort.
     * @param {number} [numBits] - Number of bits to sort. Must be a multiple
     * of {@link radixBits}. Defaults to 16.
     * @param {StorageBuffer} [initialValues] - Optional caller-supplied
     * initial values for pass 0. When omitted, pass 0 synthesises sequential
     * indices and the sort returns sorted indices.
     * @param {boolean} [skipLastPassKeyWrite] - Skip writing sorted keys on
     * the last pass (marginal perf win; only use when sorted keys aren't
     * needed afterwards).
     * @returns {StorageBuffer} Sorted values buffer (same as
     * {@link sortedIndices}).
     */
    sort(keysBuffer, elementCount, numBits = 16, initialValues, skipLastPassKeyWrite) {
        Debug.assert(!this._impl._indirect, 'ComputeRadixSort.sort: this instance was created with indirect:true and only supports sortIndirect');
        Debug.assert(keysBuffer, 'ComputeRadixSort.sort: keysBuffer is required');
        Debug.assert(elementCount > 0, 'ComputeRadixSort.sort: elementCount must be > 0');
        Debug.assert(numBits % this.radixBits === 0, `ComputeRadixSort.sort: numBits must be a multiple of radixBits (${this.radixBits}), got ${numBits}`);
        return this._impl.sort(keysBuffer, elementCount, numBits, initialValues, skipLastPassKeyWrite);
    }

    /**
     * Executes an indirect-dispatch radix sort using workgroup counts
     * pre-written into `device.indirectDispatchBuffer` (typically by a
     * compute shader that included the `sortIndirectArgsCS` WGSL chunk and
     * called `writeSortIndirectArgs`). See {@link prepareIndirect} for the
     * slot metadata and the required slot count.
     *
     * @param {StorageBuffer} keysBuffer - Input u32 keys buffer (read-only).
     * @param {number} maxElementCount - Maximum element count; sizes internal
     * buffers. The GPU-written count in `sortElementCountBuffer[0]` must be
     * `<= maxElementCount`.
     * @param {number} numBits - Number of bits to sort.
     * @param {number} sortSlotBase - Base indirect dispatch slot index. The
     * backend uses `slotCount` consecutive slots starting here (see
     * {@link prepareIndirect}).
     * @param {StorageBuffer} sortElementCountBuffer - GPU-written storage
     * buffer; element `[0]` holds the actual number of keys to sort.
     * @param {StorageBuffer} [initialValues] - Optional initial values for
     * pass 0.
     * @param {boolean} [skipLastPassKeyWrite] - Skip writing keys on the
     * last pass.
     * @returns {StorageBuffer} Sorted values buffer.
     */
    sortIndirect(keysBuffer, maxElementCount, numBits, sortSlotBase, sortElementCountBuffer, initialValues, skipLastPassKeyWrite) {
        Debug.assert(this._impl._indirect, 'ComputeRadixSort.sortIndirect: this instance was created without indirect:true');
        Debug.assert(keysBuffer, 'ComputeRadixSort.sortIndirect: keysBuffer is required');
        Debug.assert(maxElementCount > 0, 'ComputeRadixSort.sortIndirect: maxElementCount must be > 0');
        Debug.assert(numBits % this.radixBits === 0, `ComputeRadixSort.sortIndirect: numBits must be a multiple of radixBits (${this.radixBits}), got ${numBits}`);
        Debug.assert(sortElementCountBuffer, 'ComputeRadixSort.sortIndirect: sortElementCountBuffer is required');
        return this._impl.sortIndirect(keysBuffer, maxElementCount, numBits, sortSlotBase, sortElementCountBuffer, initialValues, skipLastPassKeyWrite);
    }

    /**
     * Returns stable metadata describing how many indirect dispatch slots
     * this backend needs and the elements-per-workgroup granularity of each
     * slot. Forwarded unchanged from the active backend.
     *
     * The returned 4-element `Uint32Array` is sorter-owned and never
     * reallocated; upload it directly as a uniform `vec4<u32>` and pass it
     * as the `slotInfo` argument to the `writeSortIndirectArgs` WGSL helper:
     *
     * ```
     * [slotCount, g0, g1, g2]   // g_i = elements-per-workgroup for slot i;
     *                           // unused entries = 0
     * ```
     *
     * The caller must then reserve `slotCount` consecutive slots in
     * `device.indirectDispatchBuffer` via
     * {@link GraphicsDevice#getIndirectDispatchSlot} and pass the resulting
     * base index to {@link sortIndirect}.
     *
     * @returns {Uint32Array} Sorter-owned 4-element Uint32 array.
     */
    prepareIndirect() {
        Debug.assert(this._impl._indirect, 'ComputeRadixSort.prepareIndirect: this instance was created without indirect:true');
        return this._impl.prepareIndirect();
    }

    /**
     * Releases all GPU resources owned by this sorter.
     */
    destroy() {
        this._impl.destroy();
    }
}

export { ComputeRadixSort };
