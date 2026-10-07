import { Compute } from '../../platform/graphics/compute.js';
import { Shader } from '../../platform/graphics/shader.js';
import { StorageBuffer } from '../../platform/graphics/storage-buffer.js';
import { DebugHelper } from '../../core/debug.js';
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
     * List of pipeline passes (scan + add_block for each level). Each level holds the compute
     * instances of each dispatch of the kernel in a frame, indexed by the dispatch index, see
     * {@link PrefixSumKernel#dispatch}. Created on first use, sharing the shaders of the kernel.
     *
     * @type {Array<{dataBuffer: StorageBuffer, scanComputes: Compute[], addBlockComputes: Compute[]|null, blockSumBuffer: StorageBuffer, dispatchX: number, dispatchY: number, count: number, allocatedCount: number}>}
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
        this.destroyPasses();

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
        DebugHelper.setName(blockSumBuffer, 'PrefixSumKernel.blockSum');

        const pass = {
            dataBuffer,
            scanComputes: [],
            addBlockComputes: workgroupCount > 1 ? [] : null,
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
        }
    }

    /**
     * Returns the compute instance of a pass for a dispatch index, creating it using the shared
     * shader on first use.
     *
     * @param {Compute[]} computes - The compute instances of the pass, by dispatch index.
     * @param {number} index - The dispatch index.
     * @param {Shader} shader - The shader of the compute instances.
     * @param {string} name - The name of the compute instances.
     * @param {{dataBuffer: StorageBuffer, blockSumBuffer: StorageBuffer}} pass - The pass.
     * @returns {Compute} The compute instance.
     * @private
     */
    _getCompute(computes, index, shader, name, pass) {
        let compute = computes[index];
        if (!compute) {
            compute = new Compute(this.device, shader, name);
            compute.setParameter('items', pass.dataBuffer);
            compute.setParameter('blockSums', pass.blockSumBuffer);
            computes[index] = compute;
        }
        return compute;
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
            this.destroyPasses();
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
     * @ignore
     */
    destroyPasses() {
        for (const pass of this.passes) {
            pass.scanComputes.forEach(compute => compute.destroy());
            pass.addBlockComputes?.forEach(compute => compute.destroy());
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
     * A compute instance is dispatched at most once in a frame, so each dispatch of the kernel in
     * a frame uses its own index, for which the kernel creates its own compute instances. They
     * share the shaders and the block sum buffers, as the dispatches execute in order.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {number} [index] - The index of the dispatch in the frame. Defaults to 0.
     */
    dispatch(device, index = 0) {
        // Process all passes in order
        for (let i = 0; i < this.passes.length; i++) {
            const pass = this.passes[i];
            const scanCompute = this._getCompute(pass.scanComputes, index, this._scanShader, 'PrefixSumScan', pass);

            // Set element count uniform for this pass level
            scanCompute.setParameter('elementCount', pass.count);
            scanCompute.setupDispatch(pass.dispatchX, pass.dispatchY, 1);
            device.computeDispatch([scanCompute], 'PrefixSumScan');
        }

        // Add block sums in reverse order (skip the last level which has no add_block)
        for (let i = this.passes.length - 1; i >= 0; i--) {
            const pass = this.passes[i];

            if (pass.addBlockComputes) {
                const addBlockCompute = this._getCompute(pass.addBlockComputes, index, this._addBlockShader, 'PrefixSumAddBlock', pass);

                // Set element count uniform for this pass level
                addBlockCompute.setParameter('elementCount', pass.count);
                addBlockCompute.setupDispatch(pass.dispatchX, pass.dispatchY, 1);
                device.computeDispatch([addBlockCompute], 'PrefixSumAddBlock');
            }
        }
    }
}

export { PrefixSumKernel };
