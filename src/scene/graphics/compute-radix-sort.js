import { Debug } from '../../core/debug.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Compute } from '../../platform/graphics/compute.js';
import { Shader } from '../../platform/graphics/shader.js';
import { StorageBuffer } from '../../platform/graphics/storage-buffer.js';
import { BindGroupFormat, BindStorageBufferFormat, BindUniformBufferFormat } from '../../platform/graphics/bind-group-format.js';
import { UniformBufferFormat, UniformFormat } from '../../platform/graphics/uniform-buffer-format.js';
import { BUFFERUSAGE_COPY_SRC, BUFFERUSAGE_COPY_DST, SHADERLANGUAGE_WGSL, SHADERSTAGE_COMPUTE, UNIFORMTYPE_UINT } from '../../platform/graphics/constants.js';
import { PrefixSumKernel } from './prefix-sum-kernel.js';
import { radixSort4bitSource } from '../shader-lib/wgsl/chunks/radix-sort/compute-radix-sort-4bit.js';
import { radixSortReorderSource } from '../shader-lib/wgsl/chunks/radix-sort/compute-radix-sort-reorder.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 */

// Workgroup / batching constants. The reorder shader processes ELEMENTS_PER_THREAD
// keys per thread to amortise shared-memory bitmask traffic.
const WORKGROUP_SIZE_X = 16;
const WORKGROUP_SIZE_Y = 16;
const THREADS_PER_WORKGROUP = WORKGROUP_SIZE_X * WORKGROUP_SIZE_Y; // 256
const ELEMENTS_PER_THREAD = 8;
const ELEMENTS_PER_WORKGROUP = THREADS_PER_WORKGROUP * ELEMENTS_PER_THREAD; // 2048

// 4-bit radix: 16 buckets per pass, 8 passes for 32-bit keys. Chosen as the
// portable fallback across all non-subgroup and non-NVIDIA devices after
// benchmarking wider radixes (6-bit, 8-bit shared, 8-bit subgroup variants)
// on Apple M1/M2/M4, NVIDIA, and Android Mali/IMG — 4-bit is the single
// most consistent winner or close-second in every target range.
const BITS_PER_PASS = 4;
const BUCKET_COUNT = 16; // 2 ** BITS_PER_PASS

/**
 * A compute-based GPU radix sort implementation using a 4-bit radix (16 buckets).
 * Provides stable sorting of 32-bit unsigned integer keys, returning sorted
 * indices. WebGPU only.
 *
 * **Performance characteristics:**
 * - 4 passes for 16-bit keys, 8 passes for 32-bit keys
 * - Each pass processes 4 bits (16 buckets)
 * - Workgroup size: 16x16 = 256 threads, 8 elements per thread = 2048 elements/workgroup
 * - Works on every WebGPU device (no subgroup intrinsics required)
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
     * Block sums buffer (BUCKET_COUNT entries per workgroup).
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
     * Prefix sum kernel for block sums (hierarchical Blelloch scan).
     *
     * @type {PrefixSumKernel|null}
     */
    _prefixSumKernel = null;

    /**
     * Dispatch dimensions.
     */
    _dispatchSize = new Vec2(1, 1);

    /**
     * Cached bind group format for histogram shader.
     *
     * @type {BindGroupFormat|null}
     */
    _histogramBindGroupFormat = null;

    /**
     * Cached bind group format for reorder shader.
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
     * Creates a new ComputeRadixSort instance.
     *
     * @param {GraphicsDevice} device - The graphics device (must support compute).
     */
    constructor(device) {
        Debug.assert(device.supportsCompute, 'ComputeRadixSort requires compute shader support (WebGPU)');
        this.device = device;

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
        const numPasses = this._numBits / BITS_PER_PASS;
        return (numPasses % 2 === 0) ? this._keys1 : this._keys0;
    }

    /**
     * Radix width in bits. Always 4 for this implementation. Exposed so
     * callers can align key-bit counts to the radix boundary generically
     * across sort backends.
     *
     * @type {number}
     */
    get radixBits() {
        return BITS_PER_PASS;
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

        const numPasses = numBits / BITS_PER_PASS;
        const suffix = indirect ? '-Indirect' : '';

        for (let pass = 0; pass < numPasses; pass++) {
            const bitOffset = pass * BITS_PER_PASS;
            const isFirstPass = pass === 0 && !hasInitialValues;
            const isLastPass = skipLastPassKeyWrite && pass === numPasses - 1;

            const histogramShader = this._createShader(
                `RadixSort4bit-Histogram${suffix}-${bitOffset}`,
                radixSort4bitSource,
                bitOffset,
                false,
                false,
                this._histogramBindGroupFormat,
                indirect
            );

            const reorderShader = this._createShader(
                `RadixSort4bit-Reorder${suffix}-${bitOffset}`,
                radixSortReorderSource,
                bitOffset,
                isFirstPass,
                isLastPass,
                this._reorderBindGroupFormat,
                indirect
            );

            const histogramCompute = new Compute(this.device, histogramShader, `RadixSort4bit-Histogram${suffix}-${bitOffset}`);
            const reorderCompute = new Compute(this.device, reorderShader, `RadixSort4bit-Reorder${suffix}-${bitOffset}`);

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
            const blockSumSize = BUCKET_COUNT * allocWorkgroupCount * 4;

            // Create ping-pong buffers for keys and values
            this._keys0 = new StorageBuffer(this.device, elementSize, BUFFERUSAGE_COPY_SRC | BUFFERUSAGE_COPY_DST);
            this._keys1 = new StorageBuffer(this.device, elementSize, BUFFERUSAGE_COPY_SRC | BUFFERUSAGE_COPY_DST);
            this._values0 = new StorageBuffer(this.device, elementSize, BUFFERUSAGE_COPY_SRC | BUFFERUSAGE_COPY_DST);
            this._values1 = new StorageBuffer(this.device, elementSize, BUFFERUSAGE_COPY_SRC | BUFFERUSAGE_COPY_DST);

            // Create block sums buffer (BUCKET_COUNT entries per workgroup)
            this._blockSums = new StorageBuffer(this.device, blockSumSize, BUFFERUSAGE_COPY_SRC | BUFFERUSAGE_COPY_DST);

            // Create output buffer
            this._sortedIndices = new StorageBuffer(this.device, elementSize, BUFFERUSAGE_COPY_SRC | BUFFERUSAGE_COPY_DST);

            // Create prefix sum kernel (hierarchical Blelloch scan, exclusive).
            // The radix sort reorder shader requires an exclusive scan over
            // the block sums.
            this._prefixSumKernel = new PrefixSumKernel(this.device);
        }

        // Update current working size and dispatch dimensions (must be after
        // _destroyBuffers which resets _workgroupCount)
        this._workgroupCount = currentWorkgroupCount;
        Compute.calcDispatchSize(currentWorkgroupCount, this._dispatchSize, this.device.limits.maxComputeWorkgroupsPerDimension || 65535);

        // Resize prefix kernel to match the CURRENT scan size. The allocated
        // block_sums buffer is larger (sized for capacity), but the scan only
        // needs to operate over the compact range we'll actually populate.
        this._prefixSumKernel.resize(this._blockSums, BUCKET_COUNT * currentWorkgroupCount);

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
     * @param {boolean} isLastPass - Whether this is the last pass and can skip writing keys.
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
        Debug.assert(numBits % BITS_PER_PASS === 0, `ComputeRadixSort.sort: numBits must be a multiple of ${BITS_PER_PASS}`);

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
        Debug.assert(numBits % BITS_PER_PASS === 0, `ComputeRadixSort.sortIndirect: numBits must be a multiple of ${BITS_PER_PASS}`);
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
        const numPasses = numBits / BITS_PER_PASS;
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
            device.computeDispatch([histogramCompute], `RadixSort4bit-Histogram${suffix}`);

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
            device.computeDispatch([reorderCompute], `RadixSort4bit-Reorder${suffix}`);

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
