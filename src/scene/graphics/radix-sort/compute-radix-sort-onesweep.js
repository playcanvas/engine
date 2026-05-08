import { Debug, DebugHelper } from '../../../core/debug.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Compute } from '../../../platform/graphics/compute.js';
import { Shader } from '../../../platform/graphics/shader.js';
import { StorageBuffer } from '../../../platform/graphics/storage-buffer.js';
import { BindGroupFormat, BindStorageBufferFormat, BindUniformBufferFormat } from '../../../platform/graphics/bind-group-format.js';
import { UniformBufferFormat, UniformFormat } from '../../../platform/graphics/uniform-buffer-format.js';
import { BUFFERUSAGE_COPY_DST, SHADERLANGUAGE_WGSL, SHADERSTAGE_COMPUTE, UNIFORMTYPE_UINT } from '../../../platform/graphics/constants.js';
import { onesweepGlobalHistSource } from '../../shader-lib/wgsl/chunks/radix-sort/onesweep-global-hist.js';
import { onesweepScanSource } from '../../shader-lib/wgsl/chunks/radix-sort/onesweep-scan.js';
import { onesweepBinningSource } from '../../shader-lib/wgsl/chunks/radix-sort/onesweep-binning.js';
import { ComputeRadixSortBase } from './compute-radix-sort-base.js';

/**
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 */

// DigitBinningPass tile geometry (mirrors the shader defines). KEYS_PER_THREAD=15
// matches the reference's Turing-tuned config; PART_SIZE = D_DIM * KEYS_PER_THREAD.
const D_DIM = 256;
const KEYS_PER_THREAD = 15;
const PART_SIZE = D_DIM * KEYS_PER_THREAD; // 3840

// GlobalHistogram tile geometry.
const G_HIST_DIM = 128;
const G_HIST_PART_SIZE = 32768;

const RADIX = 256;
const MAX_PASSES = 4;

/**
 * Single-sweep GPU radix sort based on OneSweep (Adinets & Merrill, NVIDIA,
 * 2022). For 32-bit keys it issues only:
 *
 *  - 1× GlobalHistogram dispatch (one read of the keys, builds all 4 digit
 *    histograms simultaneously).
 *  - 1× Scan dispatch (exclusive scan of the 256-entry digit histogram per
 *    pass, publishes block 0's inclusive base to the chained lookback).
 *  - N× DigitBinningPass dispatches (one per radix pass), each of which
 *    fuses rank + block-local digit scan + chained-scan lookback +
 *    coalesced scatter into a single kernel.
 *
 * Compared to the classic histogram + scan + reorder pipeline, this halves
 * the number of full passes over the key buffer on the critical path, and
 * eliminates all but one round-trip to device memory for scan results.
 *
 * WGSL ported from [b0nes164/GPUSorting](https://github.com/b0nes164/GPUSorting)
 * (Thomas Smith, MIT License). See {@link ComputeRadixSortMultipass} for the classic
 * multi-pass fallback used on devices where OneSweep's spin-based lookback cannot make
 * forward progress (e.g. Apple Silicon lacking forward-thread progress guarantees).
 *
 * **Requirements:**
 *  - `device.supportsCompute` (WebGPU)
 *  - `device.supportsSubgroups` and a runtime subgroup size <= 32
 *  - The device's lookback must be able to make progress under producer/
 *    consumer partition scheduling (true on NVIDIA Turing+, AMD GCN+, Intel
 *    Gen9+). Apple Silicon and any other device lacking forward-thread-
 *    progress guarantees should use {@link ComputeRadixSortMultipass}
 *    instead.
 *
 * Not exported as a public class; always accessed through the
 * {@link ComputeRadixSort} facade with `kind: RADIX_SORT_ONESWEEP` or
 * `RADIX_SORT_AUTO` on supported hardware.
 *
 * @category Graphics
 * @ignore
 */
class ComputeRadixSortOneSweep extends ComputeRadixSortBase {
    /**
     * Number of DigitBinningPass workgroups actually dispatched for the
     * current sort. Derived from `elementCount` (not `capacity`) so that
     * smaller sorts issue fewer workgroups even when buffers are sized for
     * a larger high-water mark.
     *
     * @type {number}
     */
    _threadBlocks = 0;

    /**
     * Allocated thread-block capacity (buffer sizing). Buffers are only
     * reallocated when this value changes. Always `>= _threadBlocks`.
     *
     * @type {number}
     */
    _allocatedThreadBlocks = 0;

    /**
     * Per-pass 256-entry digit histograms, concatenated across MAX_PASSES
     * passes. Written by GlobalHistogram, consumed by Scan.
     *
     * @type {StorageBuffer|null}
     */
    _globalHist = null;

    /**
     * Chained-scan lookback buffer: `MAX_PASSES × threadBlocks × RADIX` u32.
     * Block 0's slot of each pass is initialised by Scan with FLAG_INCLUSIVE
     * and the global exclusive prefix. Other blocks' slots are populated by
     * DigitBinningPass.
     *
     * @type {StorageBuffer|null}
     */
    _passHist = null;

    /**
     * Atomic counters for partition-tile assignment, one per pass.
     *
     * @type {StorageBuffer|null}
     */
    _index = null;

    /** @type {Vec2} */
    _binningDispatchSize = new Vec2(1, 1);

    /** @type {Vec2} */
    _globalHistDispatchSize = new Vec2(1, 1);

    /** @type {BindGroupFormat|null} */
    _globalHistBindGroupFormat = null;

    /** @type {BindGroupFormat|null} */
    _scanBindGroupFormat = null;

    /** @type {BindGroupFormat|null} */
    _binningBindGroupFormat = null;

    /** @type {UniformBufferFormat|null} */
    _globalHistUniformFormat = null;

    /** @type {UniformBufferFormat|null} */
    _scanUniformFormat = null;

    /** @type {UniformBufferFormat|null} */
    _binningUniformFormat = null;

    /** @type {Shader|null} */
    _globalHistShader = null;

    /** @type {Shader|null} */
    _scanShader = null;

    /** @type {Shader|null} */
    _binningShader = null;

    /** @type {Compute|null} */
    _globalHistCompute = null;

    /** @type {Compute|null} */
    _scanCompute = null;

    /** @type {Compute[]} */
    _binningComputes = [];


    /**
     * @param {GraphicsDevice} device - The graphics device (must support
     * compute and subgroups).
     * @param {boolean} [indirect] - Whether this instance is for indirect dispatch only.
     */
    constructor(device, indirect = false) {
        super(device, indirect);
        // prepareIndirect: slot 0 = DigitBinningPass (PART_SIZE), slot 1 = GlobalHistogram.
        const info = this._indirectInfo;
        info[0] = 2;
        info[1] = PART_SIZE;
        info[2] = G_HIST_PART_SIZE;

        Debug.assert(device.supportsCompute, 'ComputeRadixSortOneSweep requires compute shader support (WebGPU)');
        Debug.assert(device.supportsSubgroups, 'ComputeRadixSortOneSweep requires subgroup support');
        // The OneSweep binning shader uses 32-bit subgroup ballot masks
        // (`subgroupBallot(...).x` and `1u << sgInvId`), which are only
        // valid when the runtime subgroup size is <= 32. On hardware with
        // 64 / 128 lane subgroups (AMD Wave64, future wider architectures)
        // those expressions silently truncate / UB and will corrupt the
        // sort output. Refuse to run rather than producing garbage.
        //
        // We only check the *minimum* runtime size: NVIDIA hardware always
        // executes with 32-wide warps even though the adapter may report a
        // higher max (e.g. Dawn / D3D12 surfaces a spec ceiling of 128).
        // A `minSubgroupSize` of 0 means the adapter omitted the field
        // entirely (older Chrome / Dawn on Windows); accept that — runtime
        // size on validated NVIDIA targets is still 32.
        Debug.assert(device.minSubgroupSize <= 32, 'ComputeRadixSortOneSweep currently requires runtime subgroup size <= 32 (binning shader uses 32-bit subgroup masks)');

        // Create uniform formats (shared between direct and indirect modes), then
        // create bind group formats and shaders for the chosen mode only.
        this._globalHistUniformFormat = new UniformBufferFormat(device, [
            new UniformFormat('numKeys', UNIFORMTYPE_UINT),
            new UniformFormat('threadBlocks', UNIFORMTYPE_UINT),
            new UniformFormat('numPasses', UNIFORMTYPE_UINT),
            new UniformFormat('_pad', UNIFORMTYPE_UINT)
        ]);

        this._scanUniformFormat = new UniformBufferFormat(device, [
            new UniformFormat('threadBlocks', UNIFORMTYPE_UINT),
            new UniformFormat('_pad0', UNIFORMTYPE_UINT),
            new UniformFormat('_pad1', UNIFORMTYPE_UINT),
            new UniformFormat('_pad2', UNIFORMTYPE_UINT)
        ]);

        this._binningUniformFormat = new UniformBufferFormat(device, [
            new UniformFormat('numKeys', UNIFORMTYPE_UINT),
            new UniformFormat('threadBlocks', UNIFORMTYPE_UINT),
            new UniformFormat('pass_', UNIFORMTYPE_UINT),
            new UniformFormat('flags', UNIFORMTYPE_UINT)
        ]);

        const minSubgroupSize = device.minSubgroupSize || device.maxSubgroupSize || 32;
        const maxSubgroups = Math.max(1, Math.ceil(256 / minSubgroupSize));

        const suffix = indirect ? 'Indirect' : '';

        const histGroupEntries = [
            new BindStorageBufferFormat('b_sort', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('b_globalHist', SHADERSTAGE_COMPUTE, false),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
        ];
        const scanGroupEntries = [
            new BindStorageBufferFormat('b_globalHist', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('b_passHist', SHADERSTAGE_COMPUTE, false),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
        ];
        const binGroupEntries = [
            new BindStorageBufferFormat('inputKeys', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('outputKeys', SHADERSTAGE_COMPUTE, false),
            new BindStorageBufferFormat('inputValues', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('outputValues', SHADERSTAGE_COMPUTE, false),
            new BindStorageBufferFormat('b_passHist', SHADERSTAGE_COMPUTE, false),
            new BindStorageBufferFormat('b_index', SHADERSTAGE_COMPUTE, false),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
        ];
        if (indirect) {
            // Each BindStorageBufferFormat must be a separate instance: BindGroupFormat
            // assigns slot numbers by mutating the objects in-place, so sharing a single
            // instance across multiple formats would cause the last format to overwrite
            // the slot on the shared object, producing wrong binding indices for the
            // earlier formats when their bind groups are created.
            histGroupEntries.push(new BindStorageBufferFormat('b_sortElementCount', SHADERSTAGE_COMPUTE, true));
            scanGroupEntries.push(new BindStorageBufferFormat('b_sortElementCount', SHADERSTAGE_COMPUTE, true));
            binGroupEntries.push(new BindStorageBufferFormat('b_sortElementCount', SHADERSTAGE_COMPUTE, true));
        }

        this._globalHistBindGroupFormat = new BindGroupFormat(device, histGroupEntries);
        this._scanBindGroupFormat = new BindGroupFormat(device, scanGroupEntries);
        this._binningBindGroupFormat = new BindGroupFormat(device, binGroupEntries);

        const histDefines = new Map();
        histDefines.set('{G_HIST_DIM}', G_HIST_DIM);
        histDefines.set('{G_HIST_PART_SIZE}', G_HIST_PART_SIZE);
        if (indirect) histDefines.set('USE_INDIRECT_SORT', '');
        this._globalHistShader = new Shader(device, {
            name: `OneSweepGlobalHist${suffix}`,
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: onesweepGlobalHistSource,
            cdefines: histDefines,
            computeBindGroupFormat: this._globalHistBindGroupFormat,
            computeUniformBufferFormats: { uniforms: this._globalHistUniformFormat }
        });

        const scanDefines = new Map();
        scanDefines.set('{MAX_SUBGROUPS}', maxSubgroups);
        scanDefines.set('{PART_SIZE}', PART_SIZE);
        if (indirect) scanDefines.set('USE_INDIRECT_SORT', '');
        this._scanShader = new Shader(device, {
            name: `OneSweepScan${suffix}`,
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: onesweepScanSource,
            cdefines: scanDefines,
            computeBindGroupFormat: this._scanBindGroupFormat,
            computeUniformBufferFormats: { uniforms: this._scanUniformFormat }
        });

        const binDefines = new Map();
        binDefines.set('{D_DIM}', D_DIM);
        binDefines.set('{KEYS_PER_THREAD}', KEYS_PER_THREAD);
        binDefines.set('{MAX_SUBGROUPS}', maxSubgroups);
        if (indirect) binDefines.set('USE_INDIRECT_SORT', '');
        this._binningShader = new Shader(device, {
            name: `OneSweepBinning${suffix}`,
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: onesweepBinningSource,
            cdefines: binDefines,
            computeBindGroupFormat: this._binningBindGroupFormat,
            computeUniformBufferFormats: { uniforms: this._binningUniformFormat }
        });

        this._globalHistCompute = new Compute(device, this._globalHistShader, this._globalHistShader.name);
        this._scanCompute = new Compute(device, this._scanShader, this._scanShader.name);
        // Binning Computes are allocated per-pass in _ensureBinningComputes.
    }

    /**
     * Releases all GPU resources owned by this instance.
     */
    destroy() {
        this._destroyBuffers();

        this._globalHistShader?.destroy();
        this._scanShader?.destroy();
        this._binningShader?.destroy();
        this._globalHistBindGroupFormat?.destroy();
        this._scanBindGroupFormat?.destroy();
        this._binningBindGroupFormat?.destroy();

        this._globalHistShader = null;
        this._scanShader = null;
        this._binningShader = null;
        this._globalHistCompute = null;
        this._scanCompute = null;
        this._binningComputes.length = 0;
        this._globalHistBindGroupFormat = null;
        this._scanBindGroupFormat = null;
        this._binningBindGroupFormat = null;
        this._globalHistUniformFormat = null;
        this._scanUniformFormat = null;
        this._binningUniformFormat = null;

        super.destroy();
    }

    /** @private */
    _destroyBuffers() {
        this._destroyPingPongBuffers();
        this._globalHist?.destroy();
        this._passHist?.destroy();
        this._index?.destroy();

        this._globalHist = null;
        this._passHist = null;
        this._index = null;
        this._allocatedThreadBlocks = 0;
        this._threadBlocks = 0;
    }

    /**
     * Radix width in bits (always 8 for OneSweep). Exposed so callers can
     * align key-bit counts to the radix boundary generically across sort
     * backends.
     *
     * @type {number}
     */
    get radixBits() {
        return 8;
    }

    /**
     * Ensures there are enough Compute objects for the requested pass count.
     * Each pass uses its own Compute (bindings differ because of ping-pong).
     *
     * @param {number} numPasses - Number of radix passes.
     * @private
     */
    _ensureBinningComputes(numPasses) {
        while (this._binningComputes.length < numPasses) {
            this._binningComputes.push(new Compute(this.device, this._binningShader, `OneSweepBinning-${this._binningComputes.length}`));
        }
    }

    /**
     * Allocates or resizes internal buffers.
     *
     * @param {number} elementCount - Number of elements to sort.
     * @private
     */
    _allocateBuffers(elementCount) {
        // Buffer sizing is driven by `capacity` (the high-water mark) to avoid
        // realloc churn when the workload shrinks. Dispatch/clear sizes must
        // track the CURRENT sort's elementCount - otherwise a 1M sort that
        // follows a 30M sort still dispatches 30M-worth of workgroups, most
        // doing no-op ranking but still paying per-workgroup fixed costs
        // (partition atomic, ranking loop, lookback chain, barriers).
        const effectiveCount = Math.max(elementCount, this.capacity);
        const allocThreadBlocks = Math.max(1, Math.ceil(effectiveCount / PART_SIZE));
        const currentThreadBlocks = Math.max(1, Math.ceil(elementCount / PART_SIZE));

        const needRealloc = allocThreadBlocks !== this._allocatedThreadBlocks || !this._keys0;

        if (needRealloc) {
            this._destroyBuffers();

            this._allocatedThreadBlocks = allocThreadBlocks;
            this.capacity = effectiveCount;

            const device = this.device;

            this._allocatePingPongElementBuffers(effectiveCount);

            this._globalHist = new StorageBuffer(device, MAX_PASSES * RADIX * 4, BUFFERUSAGE_COPY_DST);
            this._passHist = new StorageBuffer(device, MAX_PASSES * allocThreadBlocks * RADIX * 4, BUFFERUSAGE_COPY_DST);
            this._index = new StorageBuffer(device, MAX_PASSES * 4, BUFFERUSAGE_COPY_DST);
            DebugHelper.setName(this._globalHist, 'ComputeRadixSortOnesweep.globalHist');
            DebugHelper.setName(this._passHist, 'ComputeRadixSortOnesweep.passHist');
            DebugHelper.setName(this._index, 'ComputeRadixSortOnesweep.index');
        }

        // Current sort's working size: the shader computes passHist offsets
        // as `pass * threadBlocks * RADIX + partitionIdx * RADIX`, so using a
        // smaller currentThreadBlocks here compacts the pass rows within the
        // (larger) allocated buffer. That's safe because passes are addressed
        // contiguously and we only write up to currentThreadBlocks slots per
        // pass.
        this._threadBlocks = currentThreadBlocks;

        const maxPerDim = this.device.limits.maxComputeWorkgroupsPerDimension || 65535;
        // Binning requires an EXACT dispatch of `currentThreadBlocks`
        // workgroups. Each block claims a tile via atomic increment of
        // `b_index[pass]` and indexes `b_passHist` by that id; any extra
        // padding workgroups (as produced by calcDispatchSize when count
        // exceeds maxPerDim and it falls back to 2D) would OOB-read
        // b_passHist in the lookback loop and spin on FLAG_NOT_READY.
        // In practice maxPerDim is 65535 and PART_SIZE = 3840, so this
        // only triggers past ~250M elements.
        Debug.assert(
            currentThreadBlocks <= maxPerDim,
            `ComputeRadixSortOneSweep: threadBlocks (${currentThreadBlocks}) exceeds maxComputeWorkgroupsPerDimension (${maxPerDim}). Binning requires an exact 1D dispatch.`
        );
        Compute.calcDispatchSize(currentThreadBlocks, this._binningDispatchSize, maxPerDim);

        const histBlocks = Math.max(1, Math.ceil(elementCount / G_HIST_PART_SIZE));
        Compute.calcDispatchSize(histBlocks, this._globalHistDispatchSize, maxPerDim);
    }

    /**
     * Sorts the keys in `keysBuffer` and returns a storage buffer of sorted
     * values. Matches the {@link ComputeRadixSort#sort} signature for
     * drop-in A/B testing.
     *
     * @param {StorageBuffer} keysBuffer - Input u32 keys buffer (read-only).
     * @param {number} elementCount - Number of elements to sort.
     * @param {number} [numBits] - Number of bits to sort. Must be a multiple
     * of 8 (the OneSweep radix width is fixed at 8). Defaults to 16.
     * @param {StorageBuffer} [initialValues] - Optional caller-supplied
     * initial values for pass 0. When omitted, pass 0 synthesises
     * sequential indices and the sort returns sorted indices.
     * @param {boolean} [skipLastPassKeyWrite] - Skip writing sorted keys on
     * the last pass. Marginal perf win; only use when sorted keys are not
     * needed.
     * @returns {StorageBuffer} Sorted values buffer.
     */
    sort(keysBuffer, elementCount, numBits = 16, initialValues, skipLastPassKeyWrite = false) {
        Debug.assert(numBits <= 32, `ComputeRadixSortOneSweep.sort: numBits must be <= 32, got ${numBits}`);

        const numPasses = numBits / 8;
        const hasInitialValues = !!initialValues;

        this._elementCount = elementCount;
        this._numBits = numBits;
        this._hasInitialValues = hasInitialValues;
        this._skipLastPassKeyWrite = skipLastPassKeyWrite;

        this._allocateBuffers(elementCount);
        this._ensureBinningComputes(numPasses);

        const device = this.device;

        // Clear the chained-scan state. All three buffers must be zeroed BEFORE
        // any dispatch for this sort. `clear()` encodes clearBuffer into the
        // command encoder so it is serialized ahead of the dispatches.
        this._globalHist.clear();
        this._passHist.clear(0, MAX_PASSES * this._threadBlocks * RADIX * 4);
        this._index.clear();

        // ---- Dispatch 1: GlobalHistogram ----
        const histCompute = this._globalHistCompute;
        histCompute.setParameter('b_sort', keysBuffer);
        histCompute.setParameter('b_globalHist', this._globalHist);
        histCompute.setParameter('numKeys', elementCount);
        histCompute.setParameter('threadBlocks', this._threadBlocks);
        histCompute.setParameter('numPasses', numPasses);
        histCompute.setParameter('_pad', 0);
        histCompute.setupDispatch(this._globalHistDispatchSize.x, this._globalHistDispatchSize.y, 1);
        device.computeDispatch([histCompute], 'OneSweep-GlobalHist');

        // ---- Dispatch 2: Scan (one workgroup per pass) ----
        const scanCompute = this._scanCompute;
        scanCompute.setParameter('b_globalHist', this._globalHist);
        scanCompute.setParameter('b_passHist', this._passHist);
        scanCompute.setParameter('threadBlocks', this._threadBlocks);
        scanCompute.setParameter('_pad0', 0);
        scanCompute.setParameter('_pad1', 0);
        scanCompute.setParameter('_pad2', 0);
        scanCompute.setupDispatch(numPasses, 1, 1);
        device.computeDispatch([scanCompute], 'OneSweep-Scan');

        // ---- Dispatch 3..N+2: DigitBinningPass per radix pass ----
        let currentKeys = keysBuffer;
        let currentValues = initialValues ?? this._values0;
        let nextKeys = this._keys0;
        let nextValues = this._values1;

        for (let pass = 0; pass < numPasses; pass++) {
            const isFirstPass = pass === 0 && !hasInitialValues;
            const isLastPass = pass === numPasses - 1;
            const outputValues = isLastPass ? this._sortedIndices : nextValues;
            const flags = (isFirstPass ? 1 : 0) | (isLastPass && skipLastPassKeyWrite ? 2 : 0);

            const binCompute = this._binningComputes[pass];
            binCompute.setParameter('inputKeys', currentKeys);
            binCompute.setParameter('outputKeys', nextKeys);
            binCompute.setParameter('inputValues', currentValues);
            binCompute.setParameter('outputValues', outputValues);
            binCompute.setParameter('b_passHist', this._passHist);
            binCompute.setParameter('b_index', this._index);
            binCompute.setParameter('numKeys', elementCount);
            binCompute.setParameter('threadBlocks', this._threadBlocks);
            binCompute.setParameter('pass_', pass);
            binCompute.setParameter('flags', flags);
            binCompute.setupDispatch(this._binningDispatchSize.x, this._binningDispatchSize.y, 1);
            device.computeDispatch([binCompute], `OneSweep-Binning-${pass}`);

            if (!isLastPass) {
                currentKeys = nextKeys;
                nextKeys = (currentKeys === this._keys0) ? this._keys1 : this._keys0;
                const t = currentValues;
                currentValues = nextValues;
                nextValues = t;
            }
        }

        return this._sortedIndices;
    }

    /**
     * Indirect-dispatch variant of {@link sort}. Workgroup counts for the
     * GlobalHistogram and DigitBinningPass kernels are read from the device's
     * built-in indirect dispatch buffer at consecutive slots starting at
     * `sortSlotBase`, written beforehand by the caller using the
     * `writeSortIndirectArgs` WGSL helper (chunk `sortIndirectArgsCS`) with
     * metadata from {@link prepareIndirect}. `numKeys` and `threadBlocks`
     * inside the shaders are computed from `sortElementCountBuffer[0]`; the
     * uniform values of those fields are ignored in indirect mode.
     *
     * Buffers are sized for `maxElementCount` (the allocation high-water
     * mark); the actual sort size may be any value in `[0, maxElementCount]`.
     *
     * @param {StorageBuffer} keysBuffer - Input u32 keys buffer (read-only).
     * @param {number} maxElementCount - Maximum element count; sizes internal
     * buffers. Must be >= the GPU-written element count.
     * @param {number} numBits - Number of bits to sort. Must be a multiple of 8.
     * @param {number} sortSlotBase - Base indirect dispatch slot index. The
     * backend uses 2 consecutive slots starting here (see {@link prepareIndirect}).
     * @param {StorageBuffer} sortElementCountBuffer - GPU-written storage
     * buffer; element `[0]` holds the actual number of keys to sort.
     * @param {StorageBuffer} [initialValues] - Optional initial values for pass 0.
     * @param {boolean} [skipLastPassKeyWrite] - Skip writing keys on the last pass.
     * @returns {StorageBuffer} Sorted values buffer.
     */
    sortIndirect(keysBuffer, maxElementCount, numBits, sortSlotBase, sortElementCountBuffer, initialValues, skipLastPassKeyWrite = false) {
        Debug.assert(numBits <= 32, `ComputeRadixSortOneSweep.sortIndirect: numBits must be <= 32, got ${numBits}`);

        const numPasses = numBits / 8;
        const hasInitialValues = !!initialValues;

        this._elementCount = maxElementCount;
        this._numBits = numBits;
        this._hasInitialValues = hasInitialValues;
        this._skipLastPassKeyWrite = skipLastPassKeyWrite;

        this._allocateBuffers(maxElementCount);
        this._ensureBinningComputes(numPasses);

        const device = this.device;

        // Clear chained-scan state based on the ALLOCATED thread-block count
        // (runtime threadBlocks derived from the GPU element count is never
        // larger, since maxElementCount is the upper bound).
        this._globalHist.clear();
        this._passHist.clear(0, MAX_PASSES * this._allocatedThreadBlocks * RADIX * 4);
        this._index.clear();

        // ---- Dispatch 1: GlobalHistogram (indirect) ----
        const histCompute = this._globalHistCompute;
        histCompute.setParameter('b_sort', keysBuffer);
        histCompute.setParameter('b_globalHist', this._globalHist);
        histCompute.setParameter('b_sortElementCount', sortElementCountBuffer);
        // Uniform values are ignored in indirect mode but still written so
        // the uniform buffer is populated.
        histCompute.setParameter('numKeys', 0);
        histCompute.setParameter('threadBlocks', 0);
        histCompute.setParameter('numPasses', numPasses);
        histCompute.setParameter('_pad', 0);
        histCompute.setupIndirectDispatch(sortSlotBase + 1);
        device.computeDispatch([histCompute], 'OneSweep-GlobalHistIndirect');

        // ---- Dispatch 2: Scan (direct; numPasses workgroups is always small) ----
        const scanCompute = this._scanCompute;
        scanCompute.setParameter('b_globalHist', this._globalHist);
        scanCompute.setParameter('b_passHist', this._passHist);
        scanCompute.setParameter('b_sortElementCount', sortElementCountBuffer);
        scanCompute.setParameter('threadBlocks', 0);
        scanCompute.setParameter('_pad0', 0);
        scanCompute.setParameter('_pad1', 0);
        scanCompute.setParameter('_pad2', 0);
        scanCompute.setupDispatch(numPasses, 1, 1);
        device.computeDispatch([scanCompute], 'OneSweep-ScanIndirect');

        // ---- Dispatch 3..N+2: DigitBinningPass per radix pass (indirect) ----
        let currentKeys = keysBuffer;
        let currentValues = initialValues ?? this._values0;
        let nextKeys = this._keys0;
        let nextValues = this._values1;

        for (let pass = 0; pass < numPasses; pass++) {
            const isFirstPass = pass === 0 && !hasInitialValues;
            const isLastPass = pass === numPasses - 1;
            const outputValues = isLastPass ? this._sortedIndices : nextValues;
            const flags = (isFirstPass ? 1 : 0) | (isLastPass && skipLastPassKeyWrite ? 2 : 0);

            const binCompute = this._binningComputes[pass];
            binCompute.setParameter('inputKeys', currentKeys);
            binCompute.setParameter('outputKeys', nextKeys);
            binCompute.setParameter('inputValues', currentValues);
            binCompute.setParameter('outputValues', outputValues);
            binCompute.setParameter('b_passHist', this._passHist);
            binCompute.setParameter('b_index', this._index);
            binCompute.setParameter('b_sortElementCount', sortElementCountBuffer);
            binCompute.setParameter('numKeys', 0);
            binCompute.setParameter('threadBlocks', 0);
            binCompute.setParameter('pass_', pass);
            binCompute.setParameter('flags', flags);
            binCompute.setupIndirectDispatch(sortSlotBase);
            device.computeDispatch([binCompute], `OneSweep-BinningIndirect-${pass}`);

            if (!isLastPass) {
                currentKeys = nextKeys;
                nextKeys = (currentKeys === this._keys0) ? this._keys1 : this._keys0;
                const t = currentValues;
                currentValues = nextValues;
                nextValues = t;
            }
        }

        return this._sortedIndices;
    }
}

export { ComputeRadixSortOneSweep };
