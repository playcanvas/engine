import { Debug } from '../../core/debug.js';
import { Compute } from '../../platform/graphics/compute.js';
import { Shader } from '../../platform/graphics/shader.js';
import { StorageBuffer } from '../../platform/graphics/storage-buffer.js';
import { BindGroupFormat, BindStorageBufferFormat, BindUniformBufferFormat } from '../../platform/graphics/bind-group-format.js';
import { UniformBufferFormat, UniformFormat } from '../../platform/graphics/uniform-buffer-format.js';
import { BUFFERUSAGE_COPY_DST, SHADERLANGUAGE_WGSL, SHADERSTAGE_COMPUTE, UNIFORMTYPE_UINT } from '../../platform/graphics/constants.js';
import { csdldfScanSource } from '../shader-lib/wgsl/chunks/radix-sort/compute-csdldf-scan.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 */

// Must match the shader constants in compute-csdldf-scan.js.
const BLOCK_DIM = 256;
const VEC4_SPT = 4;
// Number of u32 elements covered by a single partition (workgroup).
const ELEMENTS_PER_PARTITION = BLOCK_DIM * VEC4_SPT * 4; // 4096

/**
 * Single-pass GPU prefix scan using Chained Scan with Decoupled Lookback and
 * Decoupled Fallback (CSDLDF). Designed as a drop-in replacement for
 * {@link PrefixSumKernel} when the device supports subgroups.
 *
 * CSDLDF performs an N-element scan in a single compute dispatch regardless of
 * N, by having workgroups chain their partial sums through an atomic
 * `reduction[]` table; the "decoupled fallback" ensures correctness even on
 * hardware without forward-thread-progress guarantees (e.g. Apple Silicon).
 *
 * Based on the paper "Decoupled Fallback: A Portable Single-Pass GPU Scan" by
 * Levien, Owens and Smith. WGSL adapted from
 * [b0nes164/GPUPrefixSums](https://github.com/b0nes164/GPUPrefixSums)
 * (Thomas Smith, MIT License).
 *
 * Requires `device.supportsSubgroups`. The kernel scans an `array<vec4<u32>>`
 * in place; buffers are interpreted as vec4 lanes, so the element count `N` is
 * rounded up to a multiple of 4 internally (out-of-bounds lanes contribute 0).
 *
 * @ignore
 */
class CsdldfScanKernel {
    /**
     * The graphics device.
     *
     * @type {GraphicsDevice}
     */
    device;

    /**
     * Produces an exclusive scan when true, inclusive when false.
     *
     * @type {boolean}
     */
    exclusive;

    /**
     * The buffer currently bound for scanning.
     *
     * @type {StorageBuffer|null}
     */
    _dataBuffer = null;

    /**
     * Current element count (u32s).
     *
     * @type {number}
     */
    _count = 0;

    /**
     * Current number of scan partitions (workgroups).
     *
     * @type {number}
     */
    _numPartitions = 0;

    /**
     * Allocated capacity (number of partitions the current scratch buffers
     * can accommodate). Reallocation is only required when the required
     * partition count exceeds this value.
     *
     * @type {number}
     */
    _allocatedPartitions = 0;

    /**
     * Single atomic u32 used to hand out partition ids to workgroups.
     *
     * @type {StorageBuffer|null}
     */
    _scanBump = null;

    /**
     * Per-partition `atomic<u32>` reduction / flag array used for chained
     * lookback and fallback.
     *
     * @type {StorageBuffer|null}
     */
    _reduction = null;

    /**
     * @type {UniformBufferFormat|null}
     */
    _uniformBufferFormat = null;

    /**
     * @type {BindGroupFormat|null}
     */
    _bindGroupFormat = null;

    /**
     * @type {Shader|null}
     */
    _shader = null;

    /**
     * @type {Compute|null}
     */
    _compute = null;

    /**
     * Creates a new CsdldfScanKernel instance. Call `resize()` to bind the
     * target buffer and size the internal scratch buffers.
     *
     * @param {GraphicsDevice} device - The graphics device (must support
     * compute and subgroups).
     * @param {object} [options] - Options.
     * @param {boolean} [options.exclusive] - When true (default), emit an
     * exclusive scan; when false, emit an inclusive scan.
     */
    constructor(device, { exclusive = true } = {}) {
        Debug.assert(device.supportsCompute, 'CsdldfScanKernel requires compute shader support (WebGPU)');
        Debug.assert(device.supportsSubgroups, 'CsdldfScanKernel requires subgroup support');

        this.device = device;
        this.exclusive = exclusive;

        this._createFormatsAndShader();
    }

    /**
     * Destroys the kernel and releases all resources.
     */
    destroy() {
        this._destroyScratch();

        this._shader?.destroy();
        this._bindGroupFormat?.destroy();

        this._shader = null;
        this._compute = null;
        this._bindGroupFormat = null;
        this._uniformBufferFormat = null;
    }

    /**
     * Creates bind group / uniform formats and the compiled shader.
     *
     * @private
     */
    _createFormatsAndShader() {
        const device = this.device;

        this._uniformBufferFormat = new UniformBufferFormat(device, [
            new UniformFormat('size', UNIFORMTYPE_UINT),
            new UniformFormat('vecSize', UNIFORMTYPE_UINT),
            new UniformFormat('threadBlocks', UNIFORMTYPE_UINT)
        ]);

        this._bindGroupFormat = new BindGroupFormat(device, [
            new BindStorageBufferFormat('items', SHADERSTAGE_COMPUTE, false),
            new BindStorageBufferFormat('scan_bump', SHADERSTAGE_COMPUTE, false),
            new BindStorageBufferFormat('reduction', SHADERSTAGE_COMPUTE, false),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
        ]);

        const cdefines = new Map();
        if (this.exclusive) {
            cdefines.set('EXCLUSIVE_SCAN', '');
        }

        this._shader = new Shader(device, {
            name: this.exclusive ? 'CsdldfScanExclusive' : 'CsdldfScanInclusive',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: csdldfScanSource,
            cdefines: cdefines,
            computeBindGroupFormat: this._bindGroupFormat,
            computeUniformBufferFormats: { uniforms: this._uniformBufferFormat }
        });

        this._compute = new Compute(device, this._shader, 'CsdldfScan');
    }

    /**
     * Destroys the scratch buffers (scan_bump and reduction).
     *
     * @private
     */
    _destroyScratch() {
        this._scanBump?.destroy();
        this._reduction?.destroy();
        this._scanBump = null;
        this._reduction = null;
        this._allocatedPartitions = 0;
    }

    /**
     * Ensures scratch buffers can accommodate the given number of partitions.
     * Grows capacity when needed; never shrinks.
     *
     * @param {number} numPartitions - Partition count.
     * @private
     */
    _ensureScratch(numPartitions) {
        if (numPartitions <= this._allocatedPartitions && this._scanBump) {
            return;
        }

        this._destroyScratch();

        // BUFFERUSAGE_COPY_DST is required because `dispatch()` zeroes these
        // buffers each call via StorageBuffer.clear(), which issues a
        // CommandEncoder.clearBuffer that needs the COPY_DST usage flag.
        const device = this.device;
        this._scanBump = new StorageBuffer(device, 4, BUFFERUSAGE_COPY_DST);
        this._reduction = new StorageBuffer(device, numPartitions * 4, BUFFERUSAGE_COPY_DST);
        this._allocatedPartitions = numPartitions;
    }

    /**
     * Binds the target buffer and sizes internal scratch for the given count.
     * Matches {@link PrefixSumKernel#resize} for interchangeability.
     *
     * @param {StorageBuffer} dataBuffer - The buffer to perform the scan on
     * in place. Must be large enough to hold `ceil(count / 4) * 16` bytes,
     * i.e. rounded up to a multiple of 4 u32 (one vec4).
     * @param {number} count - Number of u32 elements to scan.
     */
    resize(dataBuffer, count) {
        const vecSize = Math.ceil(count / 4);
        const numPartitions = Math.max(1, Math.ceil((vecSize * 4) / ELEMENTS_PER_PARTITION));

        this._dataBuffer = dataBuffer;
        this._count = count;
        this._numPartitions = numPartitions;

        this._ensureScratch(numPartitions);
    }

    /**
     * Encodes the scan into the active command buffer. Clears the scratch
     * buffers first via `.clear()` (which records a clearBuffer command into
     * the command encoder, so the clear is ordered before the dispatch).
     * Using `queue.writeBuffer` instead would execute before any dispatch and
     * could race with a prior frame's scan.
     *
     * @param {GraphicsDevice} device - The graphics device.
     */
    dispatch(device) {
        Debug.assert(this._dataBuffer, 'CsdldfScanKernel.dispatch: call resize() first');

        this._scanBump.clear();
        this._reduction.clear(0, this._numPartitions * 4);

        const compute = this._compute;
        compute.setParameter('items', this._dataBuffer);
        compute.setParameter('scan_bump', this._scanBump);
        compute.setParameter('reduction', this._reduction);

        compute.setParameter('size', this._count);
        compute.setParameter('vecSize', Math.ceil(this._count / 4));
        compute.setParameter('threadBlocks', this._numPartitions);

        compute.setupDispatch(this._numPartitions, 1, 1);
        device.computeDispatch([compute], 'CsdldfScan');
    }
}

export { CsdldfScanKernel };
