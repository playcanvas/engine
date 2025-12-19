import { Compute } from '../../platform/graphics/compute.js';
import { Shader } from '../../platform/graphics/shader.js';
import { StorageBuffer } from '../../platform/graphics/storage-buffer.js';
import { BindGroupFormat, BindStorageBufferFormat, BindUniformBufferFormat } from '../../platform/graphics/bind-group-format.js';
import { UniformBufferFormat, UniformFormat } from '../../platform/graphics/uniform-buffer-format.js';
import { SHADERLANGUAGE_WGSL, SHADERSTAGE_COMPUTE, UNIFORMTYPE_UINT } from '../../platform/graphics/constants.js';
import { prefixSumSource } from '../shader-lib/wgsl/chunks/radix-sort/compute-prefix-sum.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 */

// Workgroup configuration
const WORKGROUP_SIZE_X = 16;
const WORKGROUP_SIZE_Y = 16;
const THREADS_PER_WORKGROUP = WORKGROUP_SIZE_X * WORKGROUP_SIZE_Y; // 256
const ITEMS_PER_WORKGROUP = 2 * THREADS_PER_WORKGROUP; // 512 (2 items per thread)

/**
 * Helper class for recursive parallel prefix sum (scan) operations.
 * Uses Blelloch algorithm with up-sweep and down-sweep phases.
 *
 * @ignore
 */
class PrefixSumKernel {
    /**
     * The graphics device.
     *
     * @type {GraphicsDevice}
     */
    device;

    /**
     * List of pipeline passes (scan + add_block for each level).
     *
     * @type {Array<{scanCompute: Compute, addBlockCompute: Compute|null, blockSumBuffer: StorageBuffer, dispatchX: number, dispatchY: number, count: number, allocatedCount: number}>}
     */
    passes = [];

    /**
     * Uniform buffer format (shared across all passes).
     *
     * @type {UniformBufferFormat|null}
     */
    _uniformBufferFormat = null;

    /**
     * Bind group format (shared across all passes).
     *
     * @type {BindGroupFormat|null}
     */
    _bindGroupFormat = null;

    /**
     * Scan shader (shared, element count is a uniform).
     *
     * @type {Shader|null}
     */
    _scanShader = null;

    /**
     * Add block shader (shared, element count is a uniform).
     *
     * @type {Shader|null}
     */
    _addBlockShader = null;

    /**
     * Creates a new PrefixSumKernel instance.
     * Call resize() to initialize passes with the desired count.
     *
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        this.device = device;
        this._createFormatsAndShaders();
    }

    /**
     * Destroys the kernel and releases resources.
     */
    destroy() {
        this._destroyPasses();

        this._scanShader?.destroy();
        this._addBlockShader?.destroy();
        this._bindGroupFormat?.destroy();

        this._scanShader = null;
        this._addBlockShader = null;
        this._bindGroupFormat = null;
        this._uniformBufferFormat = null;
    }

    /**
     * Creates bind group format and shaders (called once in constructor).
     *
     * @private
     */
    _createFormatsAndShaders() {
        // Create uniform buffer format
        this._uniformBufferFormat = new UniformBufferFormat(this.device, [
            new UniformFormat('elementCount', UNIFORMTYPE_UINT)
        ]);

        // Create bind group format with uniform buffer
        this._bindGroupFormat = new BindGroupFormat(this.device, [
            new BindStorageBufferFormat('items', SHADERSTAGE_COMPUTE, false),
            new BindStorageBufferFormat('blockSums', SHADERSTAGE_COMPUTE, false),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
        ]);

        // Create shaders
        this._scanShader = this._createShader('PrefixSumScan', 'reduce_downsweep');
        this._addBlockShader = this._createShader('PrefixSumAddBlock', 'add_block_sums');
    }

    /**
     * Recursively creates passes for the prefix sum.
     *
     * @param {StorageBuffer} dataBuffer - Buffer containing data to scan.
     * @param {number} count - Number of elements.
     * @private
     */
    createPassesRecursive(dataBuffer, count) {
        const workgroupCount = Math.ceil(count / ITEMS_PER_WORKGROUP);
        const { x: dispatchX, y: dispatchY } = this.findOptimalDispatchSize(workgroupCount);

        // Create buffer for block sums
        const blockSumBuffer = new StorageBuffer(this.device, workgroupCount * 4);

        // Create scan compute instance using shared shader
        const scanCompute = new Compute(this.device, this._scanShader, 'PrefixSumScan');
        scanCompute.setParameter('items', dataBuffer);
        scanCompute.setParameter('blockSums', blockSumBuffer);

        const pass = {
            scanCompute,
            addBlockCompute: null,
            blockSumBuffer,
            dispatchX,
            dispatchY,
            count,
            allocatedCount: count
        };

        this.passes.push(pass);

        if (workgroupCount > 1) {
            // Recursively create prefix sum on block sums
            this.createPassesRecursive(blockSumBuffer, workgroupCount);

            // Create add_block compute instance using shared shader
            const addBlockCompute = new Compute(this.device, this._addBlockShader, 'PrefixSumAddBlock');
            addBlockCompute.setParameter('items', dataBuffer);
            addBlockCompute.setParameter('blockSums', blockSumBuffer);

            pass.addBlockCompute = addBlockCompute;
        }
    }

    /**
     * Creates a shader for prefix sum operations.
     *
     * @param {string} name - Shader name.
     * @param {string} entryPoint - Entry point function name.
     * @returns {Shader} The created shader.
     * @private
     */
    _createShader(name, entryPoint) {
        // Build defines map with {VARIABLE} keys for preprocessor injection
        const cdefines = new Map();
        cdefines.set('{WORKGROUP_SIZE_X}', WORKGROUP_SIZE_X);
        cdefines.set('{WORKGROUP_SIZE_Y}', WORKGROUP_SIZE_Y);
        cdefines.set('{THREADS_PER_WORKGROUP}', THREADS_PER_WORKGROUP);
        cdefines.set('{ITEMS_PER_WORKGROUP}', ITEMS_PER_WORKGROUP);

        return new Shader(this.device, {
            name: name,
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: prefixSumSource,
            cdefines: cdefines,
            computeEntryPoint: entryPoint,
            computeBindGroupFormat: this._bindGroupFormat,
            computeUniformBufferFormats: { uniforms: this._uniformBufferFormat }
        });
    }

    /**
     * Find optimal dispatch dimensions to minimize unused workgroups.
     *
     * @param {number} workgroupCount - Total workgroups needed.
     * @returns {{x: number, y: number}} Dispatch dimensions.
     * @private
     */
    findOptimalDispatchSize(workgroupCount) {
        const maxDimension = this.device.limits.maxComputeWorkgroupsPerDimension || 65535;

        if (workgroupCount <= maxDimension) {
            return { x: workgroupCount, y: 1 };
        }

        const x = Math.floor(Math.sqrt(workgroupCount));
        const y = Math.ceil(workgroupCount / x);
        return { x, y };
    }

    /**
     * Resizes the kernel for a new element count. Grows capacity internally if needed.
     *
     * @param {StorageBuffer} dataBuffer - The buffer to perform prefix sum on.
     * @param {number} count - New element count.
     */
    resize(dataBuffer, count) {
        // Check if we need more passes (count grew beyond current capacity)
        const requiredPasses = this._countPassesNeeded(count);
        const currentPasses = this.passes.length;

        if (requiredPasses > currentPasses) {
            // Need more passes - destroy old and recreate with new capacity
            this._destroyPasses();
            this.createPassesRecursive(dataBuffer, count);
            return;
        }

        // Update counts for each pass level (shrinking or same size)
        let levelCount = count;
        for (let i = 0; i < this.passes.length; i++) {
            const workgroupCount = Math.ceil(levelCount / ITEMS_PER_WORKGROUP);
            const { x: dispatchX, y: dispatchY } = this.findOptimalDispatchSize(workgroupCount);

            this.passes[i].count = levelCount;
            this.passes[i].dispatchX = dispatchX;
            this.passes[i].dispatchY = dispatchY;

            levelCount = workgroupCount;

            // If this level doesn't need block sums anymore, stop
            if (workgroupCount <= 1) {
                break;
            }
        }
    }

    /**
     * Destroys passes but keeps shaders and formats.
     *
     * @private
     */
    _destroyPasses() {
        for (const pass of this.passes) {
            pass.blockSumBuffer?.destroy();
        }
        this.passes.length = 0;
    }

    /**
     * Counts how many recursive passes are needed for a given element count.
     *
     * @param {number} count - Element count.
     * @returns {number} Number of passes needed.
     * @private
     */
    _countPassesNeeded(count) {
        let passes = 0;
        let levelCount = count;
        while (levelCount > 0) {
            passes++;
            const workgroupCount = Math.ceil(levelCount / ITEMS_PER_WORKGROUP);
            if (workgroupCount <= 1) break;
            levelCount = workgroupCount;
        }
        return passes;
    }

    /**
     * Dispatches all prefix sum passes.
     *
     * @param {GraphicsDevice} device - The graphics device.
     */
    dispatch(device) {
        // Process all passes in order
        for (let i = 0; i < this.passes.length; i++) {
            const pass = this.passes[i];

            // Set element count uniform for this pass level
            pass.scanCompute.setParameter('elementCount', pass.count);
            pass.scanCompute.setupDispatch(pass.dispatchX, pass.dispatchY, 1);
            device.computeDispatch([pass.scanCompute], 'PrefixSumScan');
        }

        // Add block sums in reverse order (skip the last level which has no add_block)
        for (let i = this.passes.length - 1; i >= 0; i--) {
            const pass = this.passes[i];

            if (pass.addBlockCompute) {
                // Set element count uniform for this pass level
                pass.addBlockCompute.setParameter('elementCount', pass.count);
                pass.addBlockCompute.setupDispatch(pass.dispatchX, pass.dispatchY, 1);
                device.computeDispatch([pass.addBlockCompute], 'PrefixSumAddBlock');
            }
        }
    }
}

export { PrefixSumKernel };
