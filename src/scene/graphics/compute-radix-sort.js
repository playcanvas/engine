import { Debug } from '../../core/debug.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Compute } from '../../platform/graphics/compute.js';
import { Shader } from '../../platform/graphics/shader.js';
import { StorageBuffer } from '../../platform/graphics/storage-buffer.js';
import { BindGroupFormat, BindStorageBufferFormat, BindUniformBufferFormat } from '../../platform/graphics/bind-group-format.js';
import { UniformBufferFormat, UniformFormat } from '../../platform/graphics/uniform-buffer-format.js';
import { BUFFERUSAGE_COPY_SRC, BUFFERUSAGE_COPY_DST, SHADERLANGUAGE_WGSL, SHADERSTAGE_COMPUTE, UNIFORMTYPE_UINT } from '../../platform/graphics/constants.js';
import { createScanKernel, getScanKernelName } from './scan-kernel-factory.js';
import { radixSort4bitSource } from '../shader-lib/wgsl/chunks/radix-sort/compute-radix-sort-4bit.js';
import { radixSortReorderSource } from '../shader-lib/wgsl/chunks/radix-sort/compute-radix-sort-reorder.js';
import { radixSort8bitHistogramSource } from '../shader-lib/wgsl/chunks/radix-sort/compute-radix-sort-histogram-8bit.js';
import { radixSort8bitReorderSource } from '../shader-lib/wgsl/chunks/radix-sort/compute-radix-sort-reorder-8bit.js';
import { radixSort8bitSubgroupReorderSource } from '../shader-lib/wgsl/chunks/radix-sort/compute-radix-sort-reorder-8bit-subgroup.js';
import { radixSort8bitSubgroupPackedReorderSource } from '../shader-lib/wgsl/chunks/radix-sort/compute-radix-sort-reorder-8bit-subgroup-packed.js';
import { radixSort8bitSubgroupRankedReorderSource } from '../shader-lib/wgsl/chunks/radix-sort/compute-radix-sort-reorder-8bit-subgroup-ranked.js';
import { radixSort8bitSubgroupCoalescedReorderSource } from '../shader-lib/wgsl/chunks/radix-sort/compute-radix-sort-reorder-8bit-subgroup-coalesced.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { CsdldfScanKernel } from './csdldf-scan-kernel.js'
 * @import { PrefixSumKernel } from './prefix-sum-kernel.js'
 */

// Workgroup / batching constants shared by both 4-bit and 8-bit modes. These
// only depend on the thread-block layout, not on the radix width, and do not
// need to change when switching modes (making mode swaps cheap: no buffer
// realloc, just shader rebuild).
const WORKGROUP_SIZE_X = 16;
const WORKGROUP_SIZE_Y = 16;
const THREADS_PER_WORKGROUP = WORKGROUP_SIZE_X * WORKGROUP_SIZE_Y; // 256
const ELEMENTS_PER_THREAD = 8;
const ELEMENTS_PER_WORKGROUP = THREADS_PER_WORKGROUP * ELEMENTS_PER_THREAD; // 2048

// Per-mode radix constants. 8-bit halves the number of passes but needs 16x
// larger block sums and 8 KB of shared memory in the reorder shader, so it is
// gated on `device.supportsSubgroups` as a forward-compatibility signal for
// the planned subgroup-ranked scatter optimisation.
const RADIX_CONFIG = {
    4: { bitsPerPass: 4, bucketCount: 16 },
    8: { bitsPerPass: 8, bucketCount: 256 }
};

/**
 * A compute-based GPU radix sort implementation using 4-bit radix (16 buckets).
 * Provides stable sorting of 32-bit unsigned integer keys, returning sorted indices.
 * WebGPU only.
 *
 * **Performance characteristics:**
 * - 4 passes for 16-bit keys, 8 passes for 32-bit keys
 * - Each pass processes 4 bits (16 buckets)
 * - Workgroup size: 16x16 = 256 threads, 8 elements per thread = 2048 elements/workgroup
 *
 * **Algorithm (per pass):**
 * 1. **Histogram**: Each thread extracts 4-bit digits from its elements and
 *    contributes to a per-workgroup histogram using shared memory atomics.
 * 2. **Prefix Sum**: Hierarchical Blelloch scan on block histograms to compute
 *    global offsets for each (digit, workgroup) pair.
 * 3. **Ranked Scatter**: Re-reads keys in rounds, computes local ranks using
 *    per-digit 256-bit bitmasks and hardware popcount, then scatters using:
 *    `position = global_prefix[digit][workgroup] + cumulative_local_rank`
 *
 * Based on "Fast 4-way parallel radix sorting on GPUs" algorithm, implemented
 * following [WebGPU-Radix-Sort](https://github.com/kishimisu/WebGPU-Radix-Sort)
 * by kishimisu (MIT License).
 *
 * @example
 * // Create the radix sort instance (reusable)
 * const radixSort = new ComputeRadixSort(device);
 *
 * // Create a storage buffer with keys to sort
 * const keys = new Uint32Array([5, 2, 8, 1, 9, 3]);
 * const keysBuffer = new StorageBuffer(device, keys.byteLength, BUFFERUSAGE_COPY_DST);
 * keysBuffer.write(keys);
 *
 * // Sort and get indices buffer (keys with values [5,2,8,1,9,3] → indices [3,1,5,0,2,4])
 * const sortedIndices = radixSort.sort(keysBuffer, keys.length, 16); // 16-bit sort
 *
 * // Use sortedIndices buffer in subsequent GPU operations
 * // Clean up when done
 * radixSort.destroy();
 *
 * @category Graphics
 * @ignore
 */
class ComputeRadixSort {
    /**
     * The graphics device.
     *
     * @type {GraphicsDevice}
     */
    device;

    /**
     * Current element count.
     */
    _elementCount = 0;

    /**
     * Number of workgroups actually dispatched for the current sort.
     * Derived from `elementCount` (not `capacity`) so that smaller sorts issue
     * fewer workgroups even when buffers are sized for a larger high-water
     * mark.
     */
    _workgroupCount = 0;

    /**
     * Allocated workgroup capacity (buffer sizing). Buffers are only
     * reallocated when this value changes. Always `>= _workgroupCount`.
     */
    _allocatedWorkgroupCount = 0;

    /**
     * Minimum element capacity for internal buffers. When set, `_allocateBuffers` uses
     * `max(elementCount, capacity)` as the effective size. The caller can lower this value
     * to request shrinkage; actual reallocation is deferred to the next sort call.
     * After allocation, this is updated to reflect the effective element count.
     */
    capacity = 0;

    /**
     * Current number of bits for which passes are created.
     */
    _numBits = 0;

    /**
     * Internal keys buffer 0 (ping-pong).
     *
     * @type {StorageBuffer|null}
     */
    _keys0 = null;

    /**
     * Internal keys buffer 1 (ping-pong).
     *
     * @type {StorageBuffer|null}
     */
    _keys1 = null;

    /**
     * Internal values/indices buffer 0 (ping-pong).
     *
     * @type {StorageBuffer|null}
     */
    _values0 = null;

    /**
     * Internal values/indices buffer 1 (ping-pong).
     *
     * @type {StorageBuffer|null}
     */
    _values1 = null;

    /**
     * Block sums buffer (16 per workgroup).
     *
     * @type {StorageBuffer|null}
     */
    _blockSums = null;

    /**
     * Output sorted indices buffer.
     *
     * @type {StorageBuffer|null}
     */
    _sortedIndices = null;

    /**
     * Prefix sum kernel for block sums. Either a CSDLDF single-pass scan
     * (when the device supports subgroups) or a hierarchical Blelloch scan.
     *
     * @type {CsdldfScanKernel | PrefixSumKernel | null}
     */
    _prefixSumKernel = null;

    /**
     * Dispatch dimensions.
     */
    _dispatchSize = new Vec2(1, 1);

    /**
     * Cached bind group format for histogram shader (created lazily for current mode).
     *
     * @type {BindGroupFormat|null}
     */
    _histogramBindGroupFormat = null;

    /**
     * Cached bind group format for reorder shader (created lazily for current mode).
     *
     * @type {BindGroupFormat|null}
     */
    _reorderBindGroupFormat = null;

    /**
     * Uniform buffer format for runtime uniforms.
     *
     * @type {UniformBufferFormat|null}
     */
    _uniformBufferFormat = null;

    /**
     * Cached compute passes. Each entry contains {histogramCompute, reorderCompute} for one pass.
     *
     * @type {Array<{histogramCompute: Compute, reorderCompute: Compute}>}
     */
    _passes = [];

    /**
     * Whether the current passes are for indirect sort mode.
     */
    _indirect = false;

    /**
     * Whether the current passes expect caller-supplied initial values on pass 0.
     */
    _hasInitialValues = false;

    /**
     * Whether the last pass skips writing sorted keys (only values are written).
     * When true, `sortedKeys` will contain stale data after sorting.
     */
    _skipLastPassKeyWrite = false;

    /**
     * Forced scan kernel choice. See {@link createScanKernel}.
     *
     * @type {'auto' | 'csdldf' | 'blelloch'}
     * @private
     */
    _scanKernelChoice = 'auto';

    /**
     * Resolved radix width used by the current instance (4 or 8).
     *
     * @type {4 | 8}
     * @private
     */
    _radixBits = 4;

    /**
     * Bits processed per pass (equal to `_radixBits`).
     *
     * @type {number}
     * @private
     */
    _bitsPerPass = 4;

    /**
     * Number of histogram buckets per pass (`2 ** _bitsPerPass`).
     *
     * @type {number}
     * @private
     */
    _bucketCount = 16;

    /**
     * Reorder shader variant for 8-bit mode. Ignored when `_radixBits === 4`.
     *
     * @type {'shared-mem' | 'subgroup' | 'subgroup-packed' | 'subgroup-ranked' | 'subgroup-coalesced'}
     * @private
     */
    _reorderVariant = 'shared-mem';

    /**
     * GPU profiler dispatch tag that identifies the active shader variant.
     * Cached so both `_createPasses` and `_execute` stay in sync.
     *
     * @type {string}
     * @private
     */
    _profilerTag = 'RadixSort4bit';

    /**
     * Creates a new ComputeRadixSort instance.
     *
     * @param {GraphicsDevice} device - The graphics device (must support compute).
     * @param {object} [options] - Options.
     * @param {'auto' | 'csdldf' | 'blelloch'} [options.scanKernel] - Which
     * prefix scan kernel to use for block sums. `'auto'` (default) maps to
     * Blelloch. `'csdldf'` requires `device.supportsSubgroups` and is
     * currently opt-in while an NVIDIA correctness issue at large partition
     * counts is being investigated.
     * @param {'auto' | 4 | 8} [options.radixBits] - Radix width per pass.
     * `'auto'` (default) picks 8 when the device supports subgroups, 4
     * otherwise. Passing 8 explicitly requires `device.supportsSubgroups`.
     * @param {'auto' | 'shared-mem' | 'subgroup' | 'subgroup-packed' | 'subgroup-ranked' | 'subgroup-coalesced'} [options.reorderVariant] -
     * Reorder shader variant for 8-bit mode (ignored in 4-bit mode).
     * `'shared-mem'` (default when `'auto'`) uses per-digit shared-memory
     * bitmasks for ranking. `'subgroup'` uses per-bit subgroup-ballot
     * intersection trading shared-memory atomic traffic for hardware subgroup
     * ops. `'subgroup-packed'` is the same as `'subgroup'` but packs the
     * per-subgroup counts 4-to-a-u32 (2 KB shared memory vs 8 KB) to improve
     * occupancy on shared-memory-limited GPUs. `'subgroup-ranked'` ports the
     * `RankKeysWGE16` ranking scheme from b0nes164/GPUSorting (MIT): per-warp
     * atomicAdds into private histogram rows + a circular-shift inclusive
     * scan to derive per-warp digit bases, avoiding the per-key inter-warp
     * sum loop of the other subgroup variants. `'subgroup-coalesced'` extends
     * `'subgroup-ranked'` by staging keys and values through shared memory so
     * the final global scatter is coalesced within each warp (targets GPUs
     * like NVIDIA where the non-coalesced scatter dominates reorder time).
     * All subgroup variants are currently correct only for sgSize == 32.
     */
    constructor(device, { scanKernel = 'auto', radixBits = 'auto', reorderVariant = 'auto' } = {}) {
        Debug.assert(device.supportsCompute, 'ComputeRadixSort requires compute shader support (WebGPU)');
        this.device = device;
        this._scanKernelChoice = scanKernel;

        // Resolve radix width once at construction. 8-bit is gated on subgroup
        // support even though the current shared-memory shader does not use
        // subgroup ops directly - this lets the 4-bit path stay as a pure
        // fallback, and enables the optional subgroup-ballot reorder variant
        // in 8-bit mode.
        const effective = radixBits === 'auto' ? (device.supportsSubgroups ? 8 : 4) : radixBits;
        Debug.assert(effective === 4 || effective === 8,
            `ComputeRadixSort: radixBits must be 4 or 8, got ${radixBits}`);
        Debug.assert(effective === 4 || device.supportsSubgroups,
            'ComputeRadixSort: radixBits=8 requires device.supportsSubgroups');

        this._radixBits = /** @type {4 | 8} */ (effective);
        this._bitsPerPass = RADIX_CONFIG[effective].bitsPerPass;
        this._bucketCount = RADIX_CONFIG[effective].bucketCount;

        // Default the 8-bit reorder variant to the shared-memory shader — it
        // matches the historical behaviour and does not rely on the sgSize==32
        // assumption baked into the subgroup shader.
        this._reorderVariant = reorderVariant === 'auto' ? 'shared-mem' : reorderVariant;
        Debug.assert(
            this._reorderVariant === 'shared-mem' ||
            this._reorderVariant === 'subgroup' ||
            this._reorderVariant === 'subgroup-packed' ||
            this._reorderVariant === 'subgroup-ranked' ||
            this._reorderVariant === 'subgroup-coalesced',
            `ComputeRadixSort: reorderVariant must be 'shared-mem', 'subgroup', 'subgroup-packed', 'subgroup-ranked' or 'subgroup-coalesced', got ${reorderVariant}`);
        Debug.assert(this._reorderVariant === 'shared-mem' || effective === 8,
            'ComputeRadixSort: subgroup reorder variants are only supported in 8-bit mode');

        if (this._radixBits === 8 && this._reorderVariant === 'subgroup') {
            this._profilerTag = 'RadixSort8bitSG';
        } else if (this._radixBits === 8 && this._reorderVariant === 'subgroup-packed') {
            this._profilerTag = 'RadixSort8bitSGP';
        } else if (this._radixBits === 8 && this._reorderVariant === 'subgroup-ranked') {
            this._profilerTag = 'RadixSort8bitSGR';
        } else if (this._radixBits === 8 && this._reorderVariant === 'subgroup-coalesced') {
            this._profilerTag = 'RadixSort8bitSGC';
        } else {
            this._profilerTag = `RadixSort${this._radixBits}bit`;
        }

        // Create uniform buffer format (shared by both direct and indirect modes)
        this._uniformBufferFormat = new UniformBufferFormat(device, [
            new UniformFormat('workgroupCount', UNIFORMTYPE_UINT),
            new UniformFormat('elementCount', UNIFORMTYPE_UINT)
        ]);
    }

    /**
     * Destroys the ComputeRadixSort instance and releases all resources.
     */
    destroy() {
        this._destroyBuffers();
        this._destroyPasses();

        this._histogramBindGroupFormat?.destroy();
        this._reorderBindGroupFormat?.destroy();

        this._histogramBindGroupFormat = null;
        this._reorderBindGroupFormat = null;
        this._uniformBufferFormat = null;
    }

    /**
     * Destroys all cached passes and their shaders.
     *
     * @private
     */
    _destroyPasses() {
        for (const pass of this._passes) {
            pass.histogramCompute.shader?.destroy();
            pass.reorderCompute.shader?.destroy();
        }
        this._passes.length = 0;
        this._numBits = 0;
    }

    /**
     * Destroys internal buffers (not passes or bind group formats).
     *
     * @private
     */
    _destroyBuffers() {
        this._keys0?.destroy();
        this._keys1?.destroy();
        this._values0?.destroy();
        this._values1?.destroy();
        this._blockSums?.destroy();
        this._sortedIndices?.destroy();
        this._prefixSumKernel?.destroy();

        this._keys0 = null;
        this._keys1 = null;
        this._values0 = null;
        this._values1 = null;
        this._blockSums = null;
        this._sortedIndices = null;
        this._prefixSumKernel = null;
        this._workgroupCount = 0;
        this._allocatedWorkgroupCount = 0;
    }

    /**
     * Gets the sorted indices (or values) buffer.
     *
     * @type {StorageBuffer|null}
     */
    get sortedIndices() {
        return this._sortedIndices;
    }

    /**
     * Gets the sorted keys buffer after the last sort operation. The keys end up
     * in one of the internal ping-pong buffers depending on the number of passes.
     *
     * @type {StorageBuffer|null}
     */
    get sortedKeys() {
        if (!this._keys0) return null;
        const numPasses = this._numBits / this._bitsPerPass;
        return (numPasses % 2 === 0) ? this._keys1 : this._keys0;
    }

    /**
     * Short name identifying the prefix scan kernel selected for this
     * instance: `'csdldf'` for the single-pass CSDLDF scan, or `'blelloch'`
     * for the hierarchical Blelloch scan. Useful for logging and debug
     * overlays.
     *
     * @type {'csdldf' | 'blelloch'}
     */
    get scanKernelName() {
        return getScanKernelName(this.device, this._scanKernelChoice);
    }

    /**
     * Resolved radix width in bits for this instance (4 or 8). Useful for
     * logging and debug overlays.
     *
     * @type {4 | 8}
     */
    get radixBits() {
        return this._radixBits;
    }

    /**
     * Active reorder shader variant for 8-bit mode. Always `'shared-mem'` in
     * 4-bit mode. Useful for logging and debug overlays.
     *
     * @type {'shared-mem' | 'subgroup' | 'subgroup-packed' | 'subgroup-ranked' | 'subgroup-coalesced'}
     */
    get reorderVariant() {
        return this._radixBits === 8 ? this._reorderVariant : 'shared-mem';
    }

    /**
     * Ensures bind group formats exist for the given mode. Destroys and recreates
     * them if switching between direct and indirect modes.
     *
     * @param {boolean} indirect - Whether to create indirect sort formats.
     * @private
     */
    _ensureBindGroupFormats(indirect) {
        if (this._histogramBindGroupFormat && this._indirect === indirect) {
            return;
        }

        // Destroy existing formats if switching mode
        this._histogramBindGroupFormat?.destroy();
        this._reorderBindGroupFormat?.destroy();

        const device = this.device;

        const histogramEntries = [
            new BindStorageBufferFormat('input', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('block_sums', SHADERSTAGE_COMPUTE, false),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
        ];

        const reorderEntries = [
            new BindStorageBufferFormat('inputKeys', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('outputKeys', SHADERSTAGE_COMPUTE, false),
            new BindStorageBufferFormat('prefix_block_sum', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('inputValues', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('outputValues', SHADERSTAGE_COMPUTE, false),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
        ];

        if (indirect) {
            histogramEntries.push(new BindStorageBufferFormat('sortElementCount', SHADERSTAGE_COMPUTE, true));
            reorderEntries.push(new BindStorageBufferFormat('sortElementCount', SHADERSTAGE_COMPUTE, true));
        }

        this._histogramBindGroupFormat = new BindGroupFormat(device, histogramEntries);
        this._reorderBindGroupFormat = new BindGroupFormat(device, reorderEntries);
    }

    /**
     * Creates cached compute passes for all bit offsets.
     *
     * @param {number} numBits - Number of bits to sort.
     * @param {boolean} indirect - Whether to create indirect sort passes.
     * @param {boolean} hasInitialValues - Whether pass 0 reads from caller-supplied initial values.
     * @param {boolean} skipLastPassKeyWrite - Whether the last pass skips writing keys.
     * @private
     */
    _createPasses(numBits, indirect, hasInitialValues, skipLastPassKeyWrite) {
        // Destroy old passes and their shaders
        this._destroyPasses();
        this._numBits = numBits;

        // Ensure bind group formats match the requested mode (must happen before
        // updating _indirect, since _ensureBindGroupFormats compares against it)
        this._ensureBindGroupFormats(indirect);
        this._indirect = indirect;
        this._hasInitialValues = hasInitialValues;
        this._skipLastPassKeyWrite = skipLastPassKeyWrite;

        const numPasses = numBits / this._bitsPerPass;
        const suffix = indirect ? '-Indirect' : '';
        const tag = this._profilerTag;
        const histogramSource = this._radixBits === 8 ? radixSort8bitHistogramSource : radixSort4bitSource;
        let reorderSource;
        if (this._radixBits === 8) {
            if (this._reorderVariant === 'subgroup') {
                reorderSource = radixSort8bitSubgroupReorderSource;
            } else if (this._reorderVariant === 'subgroup-packed') {
                reorderSource = radixSort8bitSubgroupPackedReorderSource;
            } else if (this._reorderVariant === 'subgroup-ranked') {
                reorderSource = radixSort8bitSubgroupRankedReorderSource;
            } else if (this._reorderVariant === 'subgroup-coalesced') {
                reorderSource = radixSort8bitSubgroupCoalescedReorderSource;
            } else {
                reorderSource = radixSort8bitReorderSource;
            }
        } else {
            reorderSource = radixSortReorderSource;
        }

        for (let pass = 0; pass < numPasses; pass++) {
            const bitOffset = pass * this._bitsPerPass;
            const isFirstPass = pass === 0 && !hasInitialValues;
            const isLastPass = skipLastPassKeyWrite && pass === numPasses - 1;

            const histogramShader = this._createShader(
                `${tag}-Histogram${suffix}-${bitOffset}`,
                histogramSource,
                bitOffset,
                false,
                false,
                this._histogramBindGroupFormat,
                indirect
            );

            const reorderShader = this._createShader(
                `${tag}-Reorder${suffix}-${bitOffset}`,
                reorderSource,
                bitOffset,
                isFirstPass,
                isLastPass,
                this._reorderBindGroupFormat,
                indirect
            );

            const histogramCompute = new Compute(this.device, histogramShader, `${tag}-Histogram${suffix}-${bitOffset}`);
            const reorderCompute = new Compute(this.device, reorderShader, `${tag}-Reorder${suffix}-${bitOffset}`);

            this._passes.push({ histogramCompute, reorderCompute });
        }
    }

    /**
     * Allocates or resizes internal buffers and creates passes if needed.
     *
     * @param {number} elementCount - Number of elements to sort.
     * @param {number} numBits - Number of bits to sort.
     * @param {boolean} indirect - Whether passes should use indirect dispatch.
     * @param {boolean} hasInitialValues - Whether pass 0 reads caller-supplied initial values.
     * @param {boolean} skipLastPassKeyWrite - Whether the last pass skips writing keys.
     * @private
     */
    _allocateBuffers(elementCount, numBits, indirect, hasInitialValues, skipLastPassKeyWrite) {
        // Buffer sizing is driven by `capacity` (the high-water mark) to avoid
        // realloc churn when the workload shrinks. Dispatch and scan sizes
        // must track the CURRENT sort's elementCount - otherwise a 1M sort
        // following a 30M sort still dispatches 30M-worth of workgroups and
        // scans over a 30M block_sums array, doing mostly-no-op work but
        // still paying per-workgroup fixed costs.
        const effectiveCount = Math.max(elementCount, this.capacity);
        const allocWorkgroupCount = Math.ceil(effectiveCount / ELEMENTS_PER_WORKGROUP);
        const currentWorkgroupCount = Math.max(1, Math.ceil(elementCount / ELEMENTS_PER_WORKGROUP));

        const buffersNeedRealloc = allocWorkgroupCount !== this._allocatedWorkgroupCount || !this._keys0;

        // Recreate passes when numBits, indirect mode, initial-values mode, or key-write mode changes
        const passesNeedRecreate = numBits !== this._numBits || indirect !== this._indirect ||
            hasInitialValues !== this._hasInitialValues || skipLastPassKeyWrite !== this._skipLastPassKeyWrite;

        if (buffersNeedRealloc) {

            // Destroy old buffers
            this._destroyBuffers();

            // Store the new capacity
            this._allocatedWorkgroupCount = allocWorkgroupCount;
            this.capacity = effectiveCount;

            const elementSize = effectiveCount * 4;
            const blockSumSize = this._bucketCount * allocWorkgroupCount * 4;

            // Create ping-pong buffers for keys and values
            this._keys0 = new StorageBuffer(this.device, elementSize, BUFFERUSAGE_COPY_SRC | BUFFERUSAGE_COPY_DST);
            this._keys1 = new StorageBuffer(this.device, elementSize, BUFFERUSAGE_COPY_SRC | BUFFERUSAGE_COPY_DST);
            this._values0 = new StorageBuffer(this.device, elementSize, BUFFERUSAGE_COPY_SRC | BUFFERUSAGE_COPY_DST);
            this._values1 = new StorageBuffer(this.device, elementSize, BUFFERUSAGE_COPY_SRC | BUFFERUSAGE_COPY_DST);

            // Create block sums buffer (16 per workgroup)
            this._blockSums = new StorageBuffer(this.device, blockSumSize, BUFFERUSAGE_COPY_SRC | BUFFERUSAGE_COPY_DST);

            // Create output buffer
            this._sortedIndices = new StorageBuffer(this.device, elementSize, BUFFERUSAGE_COPY_SRC | BUFFERUSAGE_COPY_DST);

            // Create prefix sum kernel for block sums. The factory picks a
            // single-pass CSDLDF scan when subgroups are available, otherwise
            // a hierarchical Blelloch scan. The radix sort reorder shader
            // requires an exclusive scan over the block sums.
            this._prefixSumKernel = createScanKernel(this.device, {
                exclusive: true,
                force: this._scanKernelChoice
            });
            Debug.log(`ComputeRadixSort: using '${this.scanKernelName}' scan kernel`);
        }

        // Update current working size and dispatch dimensions (must be after
        // _destroyBuffers which resets _workgroupCount)
        this._workgroupCount = currentWorkgroupCount;
        Compute.calcDispatchSize(currentWorkgroupCount, this._dispatchSize, this.device.limits.maxComputeWorkgroupsPerDimension || 65535);

        // Resize prefix kernel to match the CURRENT scan size. The allocated
        // block_sums buffer is larger (sized for capacity), but the scan only
        // needs to operate over the compact range we'll actually populate.
        this._prefixSumKernel.resize(this._blockSums, this._bucketCount * currentWorkgroupCount);

        if (passesNeedRecreate) {
            this._createPasses(numBits, indirect, hasInitialValues, skipLastPassKeyWrite);
        }
    }

    /**
     * Creates a shader with constants embedded.
     *
     * @param {string} name - Shader name.
     * @param {string} source - Shader source.
     * @param {number} currentBit - Current bit offset for this pass.
     * @param {boolean} isFirstPass - Whether this is the first pass (uses GID for indices).
     * @param {BindGroupFormat} bindGroupFormat - Bind group format.
     * @param {boolean} indirect - Whether to add the USE_INDIRECT_SORT define.
     * @returns {Shader} The created shader.
     * @private
     */
    _createShader(name, source, currentBit, isFirstPass, isLastPass, bindGroupFormat, indirect) {
        const cdefines = new Map();
        cdefines.set('{WORKGROUP_SIZE_X}', WORKGROUP_SIZE_X);
        cdefines.set('{WORKGROUP_SIZE_Y}', WORKGROUP_SIZE_Y);
        cdefines.set('{THREADS_PER_WORKGROUP}', THREADS_PER_WORKGROUP);
        cdefines.set('{ELEMENTS_PER_THREAD}', ELEMENTS_PER_THREAD);
        cdefines.set('{CURRENT_BIT}', currentBit);
        cdefines.set('{IS_FIRST_PASS}', isFirstPass ? 1 : 0);
        cdefines.set('{IS_LAST_PASS}', isLastPass ? 1 : 0);
        // Subgroup reorder variants use MAX_SUBGROUPS to size per-warp
        // shared-memory buffers; non-subgroup variants ignore the token.
        // See the sg_size notes in compute-onesweep-radix-sort.js for why
        // this has to be per-device and not hardcoded to 8.
        const sgSize = this.device.maxSubgroupSize || 32;
        cdefines.set('{MAX_SUBGROUPS}', Math.max(1, Math.ceil(THREADS_PER_WORKGROUP / sgSize)));
        if (indirect) {
            cdefines.set('USE_INDIRECT_SORT', '');
        }

        return new Shader(this.device, {
            name: name,
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: source,
            cdefines: cdefines,
            computeBindGroupFormat: bindGroupFormat,
            computeUniformBufferFormats: { uniforms: this._uniformBufferFormat }
        });
    }

    /**
     * Executes the GPU radix sort using direct dispatch.
     *
     * @param {StorageBuffer} keysBuffer - Input storage buffer containing u32 keys.
     * @param {number} elementCount - Number of elements to sort.
     * @param {number} [numBits] - Number of bits to sort (must be multiple of 4). Defaults to 16.
     * @param {StorageBuffer} [initialValues] - Optional buffer of initial values for pass 0.
     * When provided, the sort produces output values derived from this buffer instead of
     * sequential indices. The buffer is only read, never modified.
     * @param {boolean} [skipLastPassKeyWrite] - When true, the last pass skips writing sorted
     * keys for a small performance gain. Only use when sorted keys are not needed after sorting.
     * @returns {StorageBuffer} Storage buffer containing sorted indices (or values if
     * initialValues was provided).
     */
    sort(keysBuffer, elementCount, numBits = 16, initialValues, skipLastPassKeyWrite = false) {
        Debug.assert(keysBuffer, 'ComputeRadixSort.sort: keysBuffer is required');
        Debug.assert(elementCount > 0, 'ComputeRadixSort.sort: elementCount must be > 0');
        Debug.assert(numBits % this._bitsPerPass === 0, `ComputeRadixSort.sort: numBits must be a multiple of ${this._bitsPerPass}`);

        return this._execute(keysBuffer, elementCount, numBits, false, -1, null, initialValues, skipLastPassKeyWrite);
    }

    /**
     * Executes the GPU radix sort using indirect dispatch. Only sorts `visibleCount`
     * elements (GPU-written) instead of the full buffer, reducing sort cost proportionally.
     *
     * @param {StorageBuffer} keysBuffer - Input storage buffer containing u32 keys.
     * @param {number} maxElementCount - Maximum number of elements (buffer allocation size).
     * @param {number} numBits - Number of bits to sort (must be multiple of 4).
     * @param {number} dispatchSlot - Slot index in the device's indirect dispatch buffer.
     * @param {StorageBuffer} sortElementCountBuffer - GPU-written buffer containing visible count.
     * @param {StorageBuffer} [initialValues] - Optional buffer of initial values for pass 0.
     * When provided, the sort produces output values derived from this buffer instead of
     * sequential indices. The buffer is only read, never modified.
     * @param {boolean} [skipLastPassKeyWrite] - When true, the last pass skips writing sorted
     * keys for a small performance gain. Only use when sorted keys are not needed after sorting.
     * @returns {StorageBuffer} Storage buffer containing sorted values.
     */
    sortIndirect(keysBuffer, maxElementCount, numBits, dispatchSlot, sortElementCountBuffer, initialValues, skipLastPassKeyWrite = false) {
        Debug.assert(keysBuffer, 'ComputeRadixSort.sortIndirect: keysBuffer is required');
        Debug.assert(maxElementCount > 0, 'ComputeRadixSort.sortIndirect: maxElementCount must be > 0');
        Debug.assert(numBits % this._bitsPerPass === 0, `ComputeRadixSort.sortIndirect: numBits must be a multiple of ${this._bitsPerPass}`);
        Debug.assert(sortElementCountBuffer, 'ComputeRadixSort.sortIndirect: sortElementCountBuffer is required');

        return this._execute(keysBuffer, maxElementCount, numBits, true, dispatchSlot, sortElementCountBuffer, initialValues, skipLastPassKeyWrite);
    }

    /**
     * Shared execution logic for both direct and indirect radix sort.
     *
     * @param {StorageBuffer} keysBuffer - Input keys buffer.
     * @param {number} elementCount - Number of elements (or max elements for indirect).
     * @param {number} numBits - Number of bits to sort.
     * @param {boolean} indirect - Whether to use indirect dispatch.
     * @param {number} dispatchSlot - Indirect dispatch slot index (-1 for direct).
     * @param {StorageBuffer|null} sortElementCountBuffer - GPU-written element count (null for direct).
     * @param {StorageBuffer} [initialValues] - Optional initial values buffer for pass 0.
     * @param {boolean} [skipLastPassKeyWrite] - When true, the last pass skips writing sorted
     * keys for a small performance gain. Only use when sorted keys are not needed after sorting.
     * @returns {StorageBuffer} Storage buffer containing sorted values.
     * @private
     */
    _execute(keysBuffer, elementCount, numBits, indirect, dispatchSlot, sortElementCountBuffer, initialValues, skipLastPassKeyWrite = false) {
        this._elementCount = elementCount;
        const hasInitialValues = !!initialValues;

        // Allocate buffers and create passes if needed
        this._allocateBuffers(elementCount, numBits, indirect, hasInitialValues, skipLastPassKeyWrite);

        const device = this.device;
        const numPasses = numBits / this._bitsPerPass;
        const suffix = indirect ? '-Indirect' : '';

        // When initial values are provided, pass 0 reads from that buffer (IS_FIRST_PASS=0).
        // Otherwise pass 0 uses GID as the value (IS_FIRST_PASS=1), ignoring currentValues.
        let currentKeys = keysBuffer;
        let currentValues = initialValues ?? this._values0;
        let nextKeys = this._keys0;
        let nextValues = this._values1;

        for (let pass = 0; pass < numPasses; pass++) {
            const { histogramCompute, reorderCompute } = this._passes[pass];
            const isLastPass = (pass === numPasses - 1);

            // For indirect sort, clear block sums before each pass using clear() which
            // encodes a clearBuffer command into the command encoder. This is critical:
            // write() uses queue.writeBuffer() which executes BEFORE the command buffer,
            // so all clears would happen before any dispatch. clear() executes in-order
            // within the command buffer, ensuring each pass sees zeroed inactive slots.
            if (indirect) {
                this._blockSums.clear();
            }

            // Phase 1: Compute per-workgroup histograms
            histogramCompute.setParameter('input', currentKeys);
            histogramCompute.setParameter('block_sums', this._blockSums);
            histogramCompute.setParameter('workgroupCount', this._workgroupCount);
            histogramCompute.setParameter('elementCount', elementCount);

            if (indirect) {
                histogramCompute.setParameter('sortElementCount', sortElementCountBuffer);
                histogramCompute.setupIndirectDispatch(dispatchSlot);
            } else {
                histogramCompute.setupDispatch(this._dispatchSize.x, this._dispatchSize.y, 1);
            }
            device.computeDispatch([histogramCompute], `${this._profilerTag}-Histogram${suffix}`);

            // Phase 2: Prefix sum on block sums
            this._prefixSumKernel.dispatch(device);

            // Phase 3: Ranked scatter - recompute local ranks in shared memory and scatter
            const outputValues = isLastPass ? this._sortedIndices : nextValues;

            reorderCompute.setParameter('inputKeys', currentKeys);
            reorderCompute.setParameter('outputKeys', nextKeys);
            reorderCompute.setParameter('prefix_block_sum', this._blockSums);
            reorderCompute.setParameter('inputValues', currentValues);
            reorderCompute.setParameter('outputValues', outputValues);
            reorderCompute.setParameter('workgroupCount', this._workgroupCount);
            reorderCompute.setParameter('elementCount', elementCount);

            if (indirect) {
                reorderCompute.setParameter('sortElementCount', sortElementCountBuffer);
                reorderCompute.setupIndirectDispatch(dispatchSlot);
            } else {
                reorderCompute.setupDispatch(this._dispatchSize.x, this._dispatchSize.y, 1);
            }
            device.computeDispatch([reorderCompute], `${this._profilerTag}-Reorder${suffix}`);

            // Swap buffers for next pass (skip on last pass - not needed)
            if (!isLastPass) {
                currentKeys = nextKeys;
                nextKeys = (currentKeys === this._keys0) ? this._keys1 : this._keys0;
                const tempValues = currentValues;
                currentValues = nextValues;
                nextValues = tempValues;
            }
        }

        return this._sortedIndices;
    }
}

export { ComputeRadixSort, ELEMENTS_PER_WORKGROUP as RADIX_SORT_ELEMENTS_PER_WORKGROUP };
