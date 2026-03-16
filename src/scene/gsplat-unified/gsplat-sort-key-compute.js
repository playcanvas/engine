import { Debug } from '../../core/debug.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
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
    UNIFORMTYPE_FLOAT,
    UNIFORMTYPE_UINT,
    UNIFORMTYPE_VEC3
} from '../../platform/graphics/constants.js';
import { computeGsplatSortKeySource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-sort-key.js';
import { GSplatSortBinWeights } from './gsplat-sort-bin-weights.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GSplatWorkBuffer } from './gsplat-work-buffer.js'
 * @import { GraphNode } from '../graph-node.js'
 */

// Constants
const WORKGROUP_SIZE_X = 16;
const WORKGROUP_SIZE_Y = 16;
const THREADS_PER_WORKGROUP = WORKGROUP_SIZE_X * WORKGROUP_SIZE_Y; // 256

// Temporary Vec3 for camera direction (avoids allocation in hot path)
const _cameraDir = new Vec3();

// Reusable Vec2 for dispatch size calculations (avoids per-frame allocations)
const _dispatchSize = new Vec2();

/**
 * A class for generating GPU sort keys from GSplat world-space positions using compute shaders.
 * Supports both linear (forward vector) and radial (distance) sorting modes with camera-relative
 * bin weighting for precision optimization near the camera.
 *
 * @ignore
 */
class GSplatSortKeyCompute {
    /**
     * The graphics device.
     *
     * @type {GraphicsDevice}
     */
    device;

    /**
     * Allocated capacity for sort keys (grow-only).
     *
     * @type {number}
     */
    allocatedCount = 0;

    /**
     * Output sort keys storage buffer.
     *
     * @type {StorageBuffer|null}
     */
    keysBuffer = null;

    /**
     * Storage buffer for combined bin weights (binBase + binDivider).
     *
     * @type {StorageBuffer|null}
     */
    binWeightsBuffer = null;

    /**
     * Current compute instance.
     *
     * @type {Compute|null}
     */
    compute = null;

    /**
     * Whether the current compute instance is for radial sorting.
     *
     * @type {boolean}
     */
    computeRadialSort = false;

    /**
     * Whether the current compute instance uses indirect sort (with compaction).
     *
     * @type {boolean}
     */
    computeUseIndirectSort = false;

    /**
     * Bind group format for the compute shader (without compaction).
     *
     * @type {BindGroupFormat|null}
     */
    bindGroupFormat = null;

    /**
     * Bind group format for the compute shader (with indirect sort + compaction).
     *
     * @type {BindGroupFormat|null}
     */
    bindGroupFormatIndirect = null;

    /**
     * Uniform buffer format.
     *
     * @type {UniformBufferFormat|null}
     */
    uniformBufferFormat = null;

    /**
     * Shared bin weights utility for computing camera-relative precision weighting.
     *
     * @type {GSplatSortBinWeights}
     */
    binWeightsUtil;

    /**
     * Reusable array for camera position uniform.
     *
     * @type {Float32Array}
     */
    cameraPositionData = new Float32Array(3);

    /**
     * Reusable array for camera direction uniform.
     *
     * @type {Float32Array}
     */
    cameraDirectionData = new Float32Array(3);

    /**
     * Creates a new GSplatSortKeyCompute instance.
     *
     * @param {GraphicsDevice} device - The graphics device (must support compute).
     */
    constructor(device) {
        Debug.assert(device.supportsCompute, 'GSplatSortKeyCompute requires compute shader support (WebGPU)');
        this.device = device;

        // Create shared bin weights utility
        this.binWeightsUtil = new GSplatSortBinWeights();

        // Create bin storage buffer (64 floats = 256 bytes)
        this.binWeightsBuffer = new StorageBuffer(device, GSplatSortBinWeights.NUM_BINS * 2 * 4, BUFFERUSAGE_COPY_SRC | BUFFERUSAGE_COPY_DST);

        this._createBindGroupFormat();
    }

    /**
     * Destroys all resources.
     */
    destroy() {
        this.keysBuffer?.destroy();
        this.binWeightsBuffer?.destroy();
        this.compute?.shader?.destroy();
        this.bindGroupFormat?.destroy();
        this.bindGroupFormatIndirect?.destroy();

        this.keysBuffer = null;
        this.binWeightsBuffer = null;
        this.compute = null;
        this.bindGroupFormat = null;
        this.bindGroupFormatIndirect = null;
        this.uniformBufferFormat = null;
    }

    /**
     * Gets or creates the compute instance for the specified sort mode.
     * Destroys and recreates the compute instance if the mode changes.
     *
     * @param {boolean} computeRadialSort - Whether to get the radial sort variant.
     * @param {boolean} computeUseIndirectSort - Whether indirect dispatch with compaction is used.
     * @returns {Compute} The compute instance.
     * @private
     */
    _getCompute(computeRadialSort, computeUseIndirectSort = false) {
        if (!this.compute || this.computeRadialSort !== computeRadialSort ||
            this.computeUseIndirectSort !== computeUseIndirectSort) {
            // Destroy old compute instance if mode changed
            this.compute?.shader?.destroy();

            // compute shader
            const modeName = computeRadialSort ? 'Radial' : 'Linear';
            const name = `GSplatSortKeyCompute-${modeName}${computeUseIndirectSort ? '-Indirect' : ''}`;
            const cdefines = new Map([
                ['{WORKGROUP_SIZE_X}', `${WORKGROUP_SIZE_X}`],
                ['{WORKGROUP_SIZE_Y}', `${WORKGROUP_SIZE_Y}`]
            ]);
            if (computeRadialSort) {
                cdefines.set('RADIAL_SORT', '');
            }
            if (computeUseIndirectSort) {
                cdefines.set('USE_INDIRECT_SORT', '');
            }

            const bgFormat = computeUseIndirectSort ? this.bindGroupFormatIndirect : this.bindGroupFormat;

            const shader = new Shader(this.device, {
                name: name,
                shaderLanguage: SHADERLANGUAGE_WGSL,
                cshader: computeGsplatSortKeySource,
                cdefines: cdefines,
                computeBindGroupFormat: bgFormat,
                computeUniformBufferFormats: { uniforms: this.uniformBufferFormat }
            });

            // Create new compute instance for the requested mode
            this.compute = new Compute(this.device, shader, name);
            this.computeRadialSort = computeRadialSort;
            this.computeUseIndirectSort = computeUseIndirectSort;
        }
        return this.compute;
    }

    /**
     * Creates the bind group formats for the compute shaders.
     *
     * @private
     */
    _createBindGroupFormat() {
        const device = this.device;

        // Create uniform buffer format
        this.uniformBufferFormat = new UniformBufferFormat(device, [
            new UniformFormat('cameraPosition', UNIFORMTYPE_VEC3),
            new UniformFormat('elementCount', UNIFORMTYPE_UINT),
            new UniformFormat('cameraDirection', UNIFORMTYPE_VEC3),
            new UniformFormat('numBits', UNIFORMTYPE_UINT),
            new UniformFormat('textureSize', UNIFORMTYPE_UINT),
            new UniformFormat('minDist', UNIFORMTYPE_FLOAT),
            new UniformFormat('invRange', UNIFORMTYPE_FLOAT),
            new UniformFormat('numWorkgroupsX', UNIFORMTYPE_UINT),
            new UniformFormat('numBins', UNIFORMTYPE_UINT)
        ]);

        // Base bind group format (without compaction):
        // 0: dataTransformA (texture_2d<u32>) - input world positions
        // 1: sortKeys (storage, read_write) - output sort keys
        // 2: uniforms (uniform buffer)
        // 3: binWeights (storage, read) - combined bin base and divider values
        this.bindGroupFormat = new BindGroupFormat(device, [
            new BindTextureFormat('dataTransformA', SHADERSTAGE_COMPUTE, undefined, SAMPLETYPE_UINT, false),
            new BindStorageBufferFormat('sortKeys', SHADERSTAGE_COMPUTE, false),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('binWeights', SHADERSTAGE_COMPUTE, true)
        ]);

        // Indirect sort bind group format (compaction + indirect dispatch):
        // 0-3: same as above
        // 4: compactedSplatIds (storage, read)
        // 5: sortElementCountBuf (storage, read) — same buffer the radix sort reads
        this.bindGroupFormatIndirect = new BindGroupFormat(device, [
            new BindTextureFormat('dataTransformA', SHADERSTAGE_COMPUTE, undefined, SAMPLETYPE_UINT, false),
            new BindStorageBufferFormat('sortKeys', SHADERSTAGE_COMPUTE, false),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('binWeights', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('compactedSplatIds', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('sortElementCountBuf', SHADERSTAGE_COMPUTE, true)
        ]);
    }

    /**
     * Ensures the keys buffer has at least the required capacity.
     *
     * @param {number} elementCount - Required number of elements.
     * @private
     */
    _ensureCapacity(elementCount) {
        if (elementCount > this.allocatedCount) {
            // Destroy old buffer if exists
            this.keysBuffer?.destroy();

            // Allocate new buffer
            this.allocatedCount = elementCount;
            this.keysBuffer = new StorageBuffer(this.device, elementCount * 4, BUFFERUSAGE_COPY_SRC);
        }
    }

    /**
     * Generates sort keys from the work buffer using direct dispatch (no culling/compaction).
     *
     * @param {GSplatWorkBuffer} workBuffer - The work buffer containing world-space splat data.
     * @param {GraphNode} cameraNode - The camera node for position and direction.
     * @param {boolean} computeRadialSort - Whether to use radial sorting mode.
     * @param {number} elementCount - Number of splats to process.
     * @param {number} numBits - Number of bits for sort keys (determines bucket count).
     * @param {number} minDist - Minimum distance value for normalization.
     * @param {number} maxDist - Maximum distance value for normalization.
     * @returns {StorageBuffer} The storage buffer containing generated sort keys.
     */
    generate(workBuffer, cameraNode, computeRadialSort, elementCount, numBits, minDist, maxDist) {
        Debug.assert(elementCount > 0, 'GSplatSortKeyCompute.generate: elementCount must be > 0');

        // Ensure capacity
        this._ensureCapacity(elementCount);

        // Calculate workgroup dimensions
        const workgroupCount = Math.ceil(elementCount / THREADS_PER_WORKGROUP);
        Compute.calcDispatchSize(workgroupCount, _dispatchSize, this.device.limits.maxComputeWorkgroupsPerDimension || 65535);

        // Get or create compute instance for direct dispatch (no compaction)
        const compute = this._getCompute(computeRadialSort);

        // Get camera world position and direction
        // Use Z-axis (not forward) to match CPU sorter
        const cameraPos = cameraNode.getPosition();
        const cameraMat = cameraNode.getWorldTransform();
        const cameraDir = cameraMat.getZ(_cameraDir).normalize();

        // Calculate normalization parameters
        const range = maxDist - minDist;
        const invRange = range > 0 ? 1.0 / range : 1.0;

        // Calculate bucket count from numBits
        const bucketCount = (1 << numBits);

        // Determine camera bin for weighting (using shared utility)
        const cameraBin = GSplatSortBinWeights.computeCameraBin(computeRadialSort, minDist, range);

        // Compute bin weights using shared utility
        const binWeights = this.binWeightsUtil.compute(cameraBin, bucketCount);

        // Upload to GPU
        this.binWeightsBuffer.write(0, binWeights);

        // Set parameters
        compute.setParameter('dataTransformA', workBuffer.getTexture('dataTransformA'));
        compute.setParameter('sortKeys', this.keysBuffer);
        compute.setParameter('binWeights', this.binWeightsBuffer);

        // Set uniforms
        this.cameraPositionData[0] = cameraPos.x;
        this.cameraPositionData[1] = cameraPos.y;
        this.cameraPositionData[2] = cameraPos.z;
        compute.setParameter('cameraPosition', this.cameraPositionData);

        this.cameraDirectionData[0] = cameraDir.x;
        this.cameraDirectionData[1] = cameraDir.y;
        this.cameraDirectionData[2] = cameraDir.z;
        compute.setParameter('cameraDirection', this.cameraDirectionData);

        compute.setParameter('elementCount', elementCount);
        compute.setParameter('numBits', numBits);
        compute.setParameter('textureSize', workBuffer.textureSize);
        compute.setParameter('minDist', minDist);
        compute.setParameter('invRange', invRange);
        compute.setParameter('numWorkgroupsX', _dispatchSize.x);
        compute.setParameter('numBins', GSplatSortBinWeights.NUM_BINS);

        // Dispatch
        compute.setupDispatch(_dispatchSize.x, _dispatchSize.y, 1);
        this.device.computeDispatch([compute], 'GSplatSortKeyCompute');

        return this.keysBuffer;
    }

    /**
     * Generates sort keys using indirect dispatch. Only `visibleCount` threads are launched
     * (GPU-determined), reducing key generation work proportionally to the culled fraction.
     *
     * @param {GSplatWorkBuffer} workBuffer - The work buffer containing world-space splat data.
     * @param {GraphNode} cameraNode - The camera node for position and direction.
     * @param {boolean} computeRadialSort - Whether to use radial sorting mode.
     * @param {number} maxElementCount - Maximum number of splats (buffer allocation size).
     * @param {number} numBits - Number of bits for sort keys.
     * @param {number} minDist - Minimum distance value for normalization.
     * @param {number} maxDist - Maximum distance value for normalization.
     * @param {StorageBuffer} compactedSplatIds - Compacted visible splat IDs.
     * @param {StorageBuffer} sortElementCountBuffer - GPU-written buffer containing visible count.
     * @param {number} dispatchSlot - Slot index in the device's indirect dispatch buffer.
     * @returns {StorageBuffer} The storage buffer containing generated sort keys.
     */
    generateIndirect(workBuffer, cameraNode, computeRadialSort, maxElementCount, numBits, minDist, maxDist, compactedSplatIds, sortElementCountBuffer, dispatchSlot) {
        Debug.assert(maxElementCount > 0, 'GSplatSortKeyCompute.generateIndirect: maxElementCount must be > 0');

        // Ensure capacity for max element count
        this._ensureCapacity(maxElementCount);

        // Get or create compute instance for indirect sort (implies compaction)
        const compute = this._getCompute(computeRadialSort, true);

        // Get camera world position and direction
        const cameraPos = cameraNode.getPosition();
        const cameraMat = cameraNode.getWorldTransform();
        const cameraDir = cameraMat.getZ(_cameraDir).normalize();

        // Calculate normalization parameters
        const range = maxDist - minDist;
        const invRange = range > 0 ? 1.0 / range : 1.0;

        // Calculate bucket count from numBits
        const bucketCount = (1 << numBits);

        // Determine camera bin for weighting
        const cameraBin = GSplatSortBinWeights.computeCameraBin(computeRadialSort, minDist, range);

        // Compute and upload bin weights
        const binWeights = this.binWeightsUtil.compute(cameraBin, bucketCount);
        this.binWeightsBuffer.write(0, binWeights);

        // Set parameters
        compute.setParameter('dataTransformA', workBuffer.getTexture('dataTransformA'));
        compute.setParameter('sortKeys', this.keysBuffer);
        compute.setParameter('binWeights', this.binWeightsBuffer);
        compute.setParameter('compactedSplatIds', compactedSplatIds);
        compute.setParameter('sortElementCountBuf', sortElementCountBuffer);

        // Set uniforms - elementCount is maxElementCount for the numWorkgroupsX-based GID calculation
        this.cameraPositionData[0] = cameraPos.x;
        this.cameraPositionData[1] = cameraPos.y;
        this.cameraPositionData[2] = cameraPos.z;
        compute.setParameter('cameraPosition', this.cameraPositionData);

        this.cameraDirectionData[0] = cameraDir.x;
        this.cameraDirectionData[1] = cameraDir.y;
        this.cameraDirectionData[2] = cameraDir.z;
        compute.setParameter('cameraDirection', this.cameraDirectionData);

        compute.setParameter('elementCount', maxElementCount);
        compute.setParameter('numBits', numBits);
        compute.setParameter('textureSize', workBuffer.textureSize);
        compute.setParameter('minDist', minDist);
        compute.setParameter('invRange', invRange);

        // For indirect dispatch, use the same workgroup layout as direct path
        const workgroupCount = Math.ceil(maxElementCount / THREADS_PER_WORKGROUP);
        Compute.calcDispatchSize(workgroupCount, _dispatchSize, this.device.limits.maxComputeWorkgroupsPerDimension || 65535);
        compute.setParameter('numWorkgroupsX', _dispatchSize.x);
        compute.setParameter('numBins', GSplatSortBinWeights.NUM_BINS);

        // Use indirect dispatch
        compute.setupIndirectDispatch(dispatchSlot);
        this.device.computeDispatch([compute], 'GSplatSortKeyCompute-Indirect');

        return this.keysBuffer;
    }
}

export { GSplatSortKeyCompute };
