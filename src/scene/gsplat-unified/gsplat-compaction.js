import { Debug } from '../../core/debug.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Compute } from '../../platform/graphics/compute.js';
import { Shader } from '../../platform/graphics/shader.js';
import { StorageBuffer } from '../../platform/graphics/storage-buffer.js';
import { BindGroupFormat, BindStorageBufferFormat, BindTextureFormat, BindUniformBufferFormat } from '../../platform/graphics/bind-group-format.js';
import { UniformBufferFormat, UniformFormat } from '../../platform/graphics/uniform-buffer-format.js';
import {
    BUFFERUSAGE_COPY_DST,
    BUFFERUSAGE_COPY_SRC,
    SAMPLETYPE_UINT,
    SHADERLANGUAGE_WGSL,
    SHADERSTAGE_COMPUTE,
    UNIFORMTYPE_UINT
} from '../../platform/graphics/constants.js';
import { computeGsplatCompactFlagSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-compact-flag.js';
import { computeGsplatCompactScatterSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-compact-scatter.js';
import { computeGsplatWriteIndirectArgsSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-write-indirect-args.js';
import { PrefixSumKernel } from '../graphics/prefix-sum-kernel.js';
import { GSplatResourceBase } from '../gsplat/gsplat-resource-base.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 */

// Workgroup size for flag and scatter passes
const WORKGROUP_SIZE = 256;

// Number of splats each thread processes in the flag pass
const SPLATS_PER_THREAD = 4;

// Instance size must match GSplatResourceBase.instanceSize
const INDEX_COUNT = 6 * GSplatResourceBase.instanceSize;

// Sort threads per workgroup must match ComputeRadixSort (16x16 = 256)
const SORT_THREADS_PER_WORKGROUP = 256;

// Reusable Vec2 for dispatch size calculations (avoids per-frame allocations)
const _dispatchSize = new Vec2();

/**
 * Manages GPU stream compaction for the GSplat pipeline using a 3-pass prefix-sum
 * approach: flag, prefix sum, scatter. This preserves sorted order, and supports both pre-sort
 * (GPU) and post-sort (CPU) compaction.
 *
 * @ignore
 */
class GSplatCompaction {
    /**
     * The graphics device.
     *
     * @type {GraphicsDevice}
     */
    device;

    /**
     * Output buffer: compacted visible splat IDs.
     *
     * @type {StorageBuffer|null}
     */
    compactedSplatIds = null;

    /**
     * Flag buffer: 0/1 visibility flags per splat + sentinel. After prefix sum,
     * contains the exclusive scan result. Size: (allocatedFlagCount) * 4 bytes.
     *
     * @type {StorageBuffer|null}
     */
    flagBuffer = null;

    /**
     * Prefix sum kernel instance for in-place exclusive scan of the flag buffer.
     *
     * @type {PrefixSumKernel|null}
     */
    prefixSumKernel = null;

    /**
     * Storage buffer for numSplats (vertex shader reads this).
     *
     * @type {StorageBuffer|null}
     */
    numSplatsBuffer = null;

    /**
     * Storage buffer for sortElementCount (sort shaders read visibleCount from this).
     *
     * @type {StorageBuffer|null}
     */
    sortElementCountBuffer = null;

    /**
     * Allocated capacity (in splats) for the compacted output buffer.
     *
     * @type {number}
     */
    allocatedCount = 0;

    /**
     * Allocated capacity (in elements) for the flag buffer. This is always
     * totalSplats + 1 (N flags + 1 sentinel). Uses grow-only strategy.
     *
     * @type {number}
     */
    allocatedFlagCount = 0;

    /**
     * Whether the current compact passes use sorted order (CPU sorting post-sort path).
     * When false, uses unsorted order (GPU sorting pre-sort path). Lazily created on
     * first dispatch and recreated when the mode changes.
     *
     * @type {boolean}
     */
    _useSortedOrder = false;

    /**
     * Compute instance for the flag pass (current variant).
     *
     * @type {Compute|null}
     */
    _flagCompute = null;

    /**
     * Compute instance for the scatter pass (current variant).
     *
     * @type {Compute|null}
     */
    _scatterCompute = null;

    /**
     * Compute instance for the write-indirect-args pass.
     *
     * @type {Compute|null}
     */
    _writeIndirectArgsCompute = null;

    /**
     * Bind group format for the flag compute shader (current variant).
     *
     * @type {BindGroupFormat|null}
     */
    _flagBindGroupFormat = null;

    /**
     * Bind group format for the scatter compute shader (current variant).
     *
     * @type {BindGroupFormat|null}
     */
    _scatterBindGroupFormat = null;

    /**
     * Bind group format for the write-indirect-args compute shader.
     *
     * @type {BindGroupFormat|null}
     */
    _writeArgsBindGroupFormat = null;

    /**
     * Uniform buffer format for the flag compute shader.
     *
     * @type {UniformBufferFormat|null}
     */
    _flagUniformBufferFormat = null;

    /**
     * Uniform buffer format for the scatter compute shader.
     *
     * @type {UniformBufferFormat|null}
     */
    _scatterUniformBufferFormat = null;

    /**
     * Uniform buffer format for the write-indirect-args compute shader.
     *
     * @type {UniformBufferFormat|null}
     */
    _writeArgsUniformBufferFormat = null;

    /**
     * Creates a new GSplatCompaction instance.
     *
     * @param {GraphicsDevice} device - The graphics device (must support compute).
     */
    constructor(device) {
        Debug.assert(device.supportsCompute, 'GSplatCompaction requires compute shader support (WebGPU)');
        this.device = device;

        // Create the numSplats buffer (4 bytes, vertex shader reads this)
        this.numSplatsBuffer = new StorageBuffer(device, 4, BUFFERUSAGE_COPY_SRC | BUFFERUSAGE_COPY_DST);

        // Create the sortElementCount buffer (4 bytes, sort shaders read visibleCount from this)
        this.sortElementCountBuffer = new StorageBuffer(device, 4, BUFFERUSAGE_COPY_SRC | BUFFERUSAGE_COPY_DST);

        // Create prefix sum kernel
        this.prefixSumKernel = new PrefixSumKernel(device);

        // Create shared uniform buffer formats (mode-independent)
        this._createUniformBufferFormats();

        // Create write-indirect-args pass (mode-independent)
        this._createWriteIndirectArgsCompute();
    }

    /**
     * Destroys all resources.
     */
    destroy() {
        this.compactedSplatIds?.destroy();
        this.flagBuffer?.destroy();
        this.prefixSumKernel?.destroy();
        this.numSplatsBuffer?.destroy();
        this.sortElementCountBuffer?.destroy();

        this._destroyCompactPasses();
        this._writeIndirectArgsCompute?.shader?.destroy();
        this._writeArgsBindGroupFormat?.destroy();

        this.compactedSplatIds = null;
        this.flagBuffer = null;
        this.prefixSumKernel = null;
        this.numSplatsBuffer = null;
        this.sortElementCountBuffer = null;
        this._writeIndirectArgsCompute = null;
        this._writeArgsBindGroupFormat = null;
        this._flagUniformBufferFormat = null;
        this._scatterUniformBufferFormat = null;
        this._writeArgsUniformBufferFormat = null;
    }

    /**
     * Destroys the current flag and scatter compact passes and their bind group formats.
     *
     * @private
     */
    _destroyCompactPasses() {
        this._flagCompute?.shader?.destroy();
        this._scatterCompute?.shader?.destroy();
        this._flagBindGroupFormat?.destroy();
        this._scatterBindGroupFormat?.destroy();

        this._flagCompute = null;
        this._scatterCompute = null;
        this._flagBindGroupFormat = null;
        this._scatterBindGroupFormat = null;
    }

    /**
     * Creates shared uniform buffer formats used by both sorted and unsorted variants.
     *
     * @private
     */
    _createUniformBufferFormats() {
        const device = this.device;

        this._flagUniformBufferFormat = new UniformBufferFormat(device, [
            new UniformFormat('totalSplats', UNIFORMTYPE_UINT),
            new UniformFormat('textureWidth', UNIFORMTYPE_UINT),
            new UniformFormat('visWidth', UNIFORMTYPE_UINT),
            new UniformFormat('totalThreads', UNIFORMTYPE_UINT),
            new UniformFormat('numWorkgroupsX', UNIFORMTYPE_UINT)
        ]);

        this._scatterUniformBufferFormat = new UniformBufferFormat(device, [
            new UniformFormat('totalSplats', UNIFORMTYPE_UINT),
            new UniformFormat('numWorkgroupsX', UNIFORMTYPE_UINT),
            new UniformFormat('pad1', UNIFORMTYPE_UINT),
            new UniformFormat('pad2', UNIFORMTYPE_UINT)
        ]);

        this._writeArgsUniformBufferFormat = new UniformBufferFormat(device, [
            new UniformFormat('drawSlot', UNIFORMTYPE_UINT),
            new UniformFormat('indexCount', UNIFORMTYPE_UINT),
            new UniformFormat('dispatchSlotOffset', UNIFORMTYPE_UINT),
            new UniformFormat('totalSplats', UNIFORMTYPE_UINT)
        ]);
    }

    /**
     * Ensures the flag and scatter compact passes exist for the requested mode.
     * Lazily creates them on first call and recreates when switching between
     * sorted and unsorted modes.
     *
     * @param {boolean} useSortedOrder - Whether to create sorted order passes.
     * @private
     */
    _ensureCompactPasses(useSortedOrder) {
        if (this._flagCompute && useSortedOrder === this._useSortedOrder) {
            return;
        }

        // Destroy existing passes if switching mode
        this._destroyCompactPasses();
        this._useSortedOrder = useSortedOrder;

        const device = this.device;
        const suffix = useSortedOrder ? 'Sorted' : '';

        // Create flag bind group format
        const flagEntries = [
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE),
            new BindTextureFormat('pcNodeIndex', SHADERSTAGE_COMPUTE, undefined, SAMPLETYPE_UINT, false),
            new BindTextureFormat('nodeVisibilityTexture', SHADERSTAGE_COMPUTE, undefined, SAMPLETYPE_UINT, false),
            new BindStorageBufferFormat('flagBuffer', SHADERSTAGE_COMPUTE, false)
        ];
        if (useSortedOrder) {
            flagEntries.push(new BindStorageBufferFormat('sortedOrder', SHADERSTAGE_COMPUTE, true));
        }
        this._flagBindGroupFormat = new BindGroupFormat(device, flagEntries);

        // Create scatter bind group format
        const scatterEntries = [
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('prefixSumBuffer', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('compactedOutput', SHADERSTAGE_COMPUTE, false)
        ];
        if (useSortedOrder) {
            scatterEntries.push(new BindStorageBufferFormat('sortedOrder', SHADERSTAGE_COMPUTE, true));
        }
        this._scatterBindGroupFormat = new BindGroupFormat(device, scatterEntries);

        // Create flag and scatter compute instances
        this._flagCompute = this._createCompactShader(
            `GSplatCompactFlag${suffix}`, computeGsplatCompactFlagSource,
            this._flagBindGroupFormat, this._flagUniformBufferFormat, useSortedOrder
        );
        this._scatterCompute = this._createCompactShader(
            `GSplatCompactScatter${suffix}`, computeGsplatCompactScatterSource,
            this._scatterBindGroupFormat, this._scatterUniformBufferFormat, useSortedOrder
        );
    }

    /**
     * Creates a compute instance for a compaction shader with the given parameters.
     *
     * @param {string} name - Shader and compute name.
     * @param {string} source - WGSL shader source.
     * @param {BindGroupFormat} bindGroupFormat - Bind group format.
     * @param {UniformBufferFormat} uniformBufferFormat - Uniform buffer format.
     * @param {boolean} useSortedOrder - Whether to add the USE_SORTED_ORDER define.
     * @returns {Compute} The created compute instance.
     * @private
     */
    _createCompactShader(name, source, bindGroupFormat, uniformBufferFormat, useSortedOrder) {
        const cdefines = new Map([
            ['{WORKGROUP_SIZE}', WORKGROUP_SIZE]
        ]);
        if (useSortedOrder) {
            cdefines.set('USE_SORTED_ORDER', '');
        }

        const shader = new Shader(this.device, {
            name: name,
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: source,
            cdefines: cdefines,
            computeBindGroupFormat: bindGroupFormat,
            computeUniformBufferFormats: { uniforms: uniformBufferFormat }
        });

        return new Compute(this.device, shader, name);
    }

    /**
     * Creates the write-indirect-args compute instance.
     *
     * @private
     */
    _createWriteIndirectArgsCompute() {
        const device = this.device;

        this._writeArgsBindGroupFormat = new BindGroupFormat(device, [
            new BindStorageBufferFormat('prefixSumBuffer', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('indirectDrawArgs', SHADERSTAGE_COMPUTE, false),
            new BindStorageBufferFormat('numSplatsBuf', SHADERSTAGE_COMPUTE, false),
            new BindStorageBufferFormat('indirectDispatchArgs', SHADERSTAGE_COMPUTE, false),
            new BindStorageBufferFormat('sortElementCountBuf', SHADERSTAGE_COMPUTE, false),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
        ]);

        const cdefines = new Map([
            ['{INSTANCE_SIZE}', GSplatResourceBase.instanceSize],
            ['{SORT_THREADS_PER_WORKGROUP}', SORT_THREADS_PER_WORKGROUP]
        ]);

        const shader = new Shader(device, {
            name: 'GSplatWriteIndirectArgs',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatWriteIndirectArgsSource,
            cdefines: cdefines,
            computeBindGroupFormat: this._writeArgsBindGroupFormat,
            computeUniformBufferFormats: { uniforms: this._writeArgsUniformBufferFormat }
        });

        this._writeIndirectArgsCompute = new Compute(device, shader, 'GSplatWriteIndirectArgs');
    }

    /**
     * Ensures the compacted output buffer and flag buffer have at least the required
     * capacity. Uses a grow-only strategy to avoid frequent reallocation.
     *
     * @param {number} totalSplats - Required capacity in splats.
     * @private
     */
    _ensureCapacity(totalSplats) {
        // Grow compactedSplatIds if needed
        if (totalSplats > this.allocatedCount) {
            this.compactedSplatIds?.destroy();
            this.allocatedCount = totalSplats;
            this.compactedSplatIds = new StorageBuffer(this.device, totalSplats * 4, BUFFERUSAGE_COPY_SRC);
        }

        // Grow flagBuffer if needed (N + 1 elements for the sentinel)
        const requiredFlagCount = totalSplats + 1;
        if (requiredFlagCount > this.allocatedFlagCount) {
            this.flagBuffer?.destroy();
            this.allocatedFlagCount = requiredFlagCount;
            this.flagBuffer = new StorageBuffer(this.device, requiredFlagCount * 4);

            // Flag buffer changed, force prefix sum kernel to rebind by destroying its passes.
            // The next resize() call will recreate them with the new buffer.
            if (this.prefixSumKernel) {
                this.prefixSumKernel.destroyPasses();
            }
        }
    }

    /**
     * Runs the full compaction pipeline: flag pass, prefix sum, scatter pass.
     *
     * For GPU sorting (pre-sort): call without sortedOrderBuffer, splatId = i.
     * For CPU sorting (post-sort): pass the sortedOrder buffer, splatId = sortedOrder[i].
     *
     * @param {Texture} pcNodeIndexTexture - The pcNodeIndex work buffer texture (R32U).
     * @param {Texture} nodeVisibilityTexture - The bit-packed visibility texture (R32U).
     * @param {number} totalSplats - Total number of splats.
     * @param {number} textureWidth - Width of the work buffer textures.
     * @param {StorageBuffer} [sortedOrderBuffer] - Optional sorted order buffer (CPU path).
     */
    dispatchCompact(pcNodeIndexTexture, nodeVisibilityTexture, totalSplats, textureWidth, sortedOrderBuffer) {
        this._ensureCapacity(totalSplats);

        const useSortedOrder = !!sortedOrderBuffer;
        this._ensureCompactPasses(useSortedOrder);

        // --- Pass 1: Flag ---
        // Write 0/1 visibility flags + sentinel into flagBuffer
        const flagCompute = this._flagCompute;

        flagCompute.setParameter('pcNodeIndex', pcNodeIndexTexture);
        flagCompute.setParameter('nodeVisibilityTexture', nodeVisibilityTexture);
        flagCompute.setParameter('flagBuffer', this.flagBuffer);
        if (useSortedOrder) {
            flagCompute.setParameter('sortedOrder', sortedOrderBuffer);
        }

        // Dispatch fewer workgroups — each thread handles SPLATS_PER_THREAD splats via strided loop
        const flagWorkgroups = Math.ceil(totalSplats / (WORKGROUP_SIZE * SPLATS_PER_THREAD));
        Compute.calcDispatchSize(flagWorkgroups, _dispatchSize);
        const totalThreads = _dispatchSize.x * _dispatchSize.y * WORKGROUP_SIZE;

        flagCompute.setParameter('totalSplats', totalSplats);
        flagCompute.setParameter('textureWidth', textureWidth);
        flagCompute.setParameter('visWidth', nodeVisibilityTexture.width);
        flagCompute.setParameter('totalThreads', totalThreads);
        flagCompute.setParameter('numWorkgroupsX', _dispatchSize.x);
        flagCompute.setupDispatch(_dispatchSize.x, _dispatchSize.y, 1);
        this.device.computeDispatch([flagCompute], 'GSplatCompactFlag');

        // --- Pass 2: Prefix Sum ---
        // In-place exclusive scan over N+1 elements of flagBuffer
        const prefixCount = totalSplats + 1;
        this.prefixSumKernel.resize(this.flagBuffer, prefixCount);
        this.prefixSumKernel.dispatch(this.device);

        // --- Pass 3: Scatter ---
        // Write visible splatIds to compactedOutput at their prefix-sum positions
        const scatterCompute = this._scatterCompute;

        scatterCompute.setParameter('prefixSumBuffer', this.flagBuffer);
        scatterCompute.setParameter('compactedOutput', this.compactedSplatIds);
        if (useSortedOrder) {
            scatterCompute.setParameter('sortedOrder', sortedOrderBuffer);
        }

        const scatterWorkgroups = Math.ceil(totalSplats / WORKGROUP_SIZE);
        Compute.calcDispatchSize(scatterWorkgroups, _dispatchSize);

        scatterCompute.setParameter('totalSplats', totalSplats);
        scatterCompute.setParameter('numWorkgroupsX', _dispatchSize.x);
        scatterCompute.setParameter('pad1', 0);
        scatterCompute.setParameter('pad2', 0);

        scatterCompute.setupDispatch(_dispatchSize.x, _dispatchSize.y, 1);
        this.device.computeDispatch([scatterCompute], 'GSplatCompactScatter');
    }

    /**
     * Runs the write-indirect-args pass: reads the visible count from
     * prefixSumBuffer[totalSplats] and writes indirect draw/dispatch arguments.
     *
     * @param {number} drawSlot - The slot index in the device's indirect draw buffer.
     * @param {number} dispatchSlot - The slot index in the device's indirect dispatch buffer.
     * @param {number} totalSplats - Total number of splats (used to index into prefix sum
     * buffer to read the visible count).
     */
    writeIndirectArgs(drawSlot, dispatchSlot, totalSplats) {
        const compute = this._writeIndirectArgsCompute;

        // Set bindings
        compute.setParameter('prefixSumBuffer', this.flagBuffer);
        compute.setParameter('indirectDrawArgs', this.device.indirectDrawBuffer);
        compute.setParameter('numSplatsBuf', this.numSplatsBuffer);
        compute.setParameter('indirectDispatchArgs', this.device.indirectDispatchBuffer);
        compute.setParameter('sortElementCountBuf', this.sortElementCountBuffer);

        // Set uniforms
        compute.setParameter('drawSlot', drawSlot);
        compute.setParameter('indexCount', INDEX_COUNT);
        compute.setParameter('dispatchSlotOffset', dispatchSlot * 3); // each dispatch slot is 3 u32s
        compute.setParameter('totalSplats', totalSplats);

        // Single-thread dispatch
        compute.setupDispatch(1);
        this.device.computeDispatch([compute], 'GSplatWriteIndirectArgs');
    }
}

export { GSplatCompaction };
