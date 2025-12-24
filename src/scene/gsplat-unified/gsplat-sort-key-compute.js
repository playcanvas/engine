import { Debug } from '../../core/debug.js';
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
     * Bind group format for the compute shader.
     *
     * @type {BindGroupFormat|null}
     */
    bindGroupFormat = null;

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

        this.keysBuffer = null;
        this.binWeightsBuffer = null;
        this.compute = null;
        this.bindGroupFormat = null;
        this.uniformBufferFormat = null;
    }

    /**
     * Gets or creates the compute instance for the specified sort mode.
     * Destroys and recreates the compute instance if the mode changes.
     *
     * @param {boolean} radialSort - Whether to get the radial sort variant.
     * @returns {Compute} The compute instance.
     * @private
     */
    _getCompute(radialSort) {
        if (!this.compute || this.computeRadialSort !== radialSort) {
            // Destroy old compute instance if mode changed
            this.compute?.shader?.destroy();

            // compute shader
            const name = radialSort ? 'GSplatSortKeyCompute-Radial' : 'GSplatSortKeyCompute-Linear';
            const cdefines = new Map([
                ['{WORKGROUP_SIZE_X}', `${WORKGROUP_SIZE_X}`],
                ['{WORKGROUP_SIZE_Y}', `${WORKGROUP_SIZE_Y}`]
            ]);
            if (radialSort) {
                cdefines.set('RADIAL_SORT', '');
            }
            const shader = new Shader(this.device, {
                name: name,
                shaderLanguage: SHADERLANGUAGE_WGSL,
                cshader: computeGsplatSortKeySource,
                cdefines: cdefines,
                computeEntryPoint: 'computeSortKey',
                computeBindGroupFormat: this.bindGroupFormat,
                computeUniformBufferFormats: { uniforms: this.uniformBufferFormat }
            });

            // Create new compute instance for the requested mode
            this.compute = new Compute(this.device, shader, name);
            this.computeRadialSort = radialSort;
        }
        return this.compute;
    }

    /**
     * Creates the bind group format for the compute shaders.
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

        // Bind group format:
        // 0: splatTexture0 (texture_2d<u32>) - input world positions
        // 1: sortKeys (storage, read_write) - output sort keys
        // 2: uniforms (uniform buffer)
        // 3: binWeights (storage, read) - combined bin base and divider values
        this.bindGroupFormat = new BindGroupFormat(device, [
            new BindTextureFormat('splatTexture0', SHADERSTAGE_COMPUTE, undefined, SAMPLETYPE_UINT, false),
            new BindStorageBufferFormat('sortKeys', SHADERSTAGE_COMPUTE, false),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('binWeights', SHADERSTAGE_COMPUTE, true)
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
     * Generates sort keys from the work buffer.
     *
     * @param {GSplatWorkBuffer} workBuffer - The work buffer containing world-space splat data.
     * @param {GraphNode} cameraNode - The camera node for position and direction.
     * @param {boolean} radialSort - Whether to use radial sorting mode.
     * @param {number} elementCount - Number of splats to process.
     * @param {number} numBits - Number of bits for sort keys (determines bucket count).
     * @param {number} minDist - Minimum distance value for normalization.
     * @param {number} maxDist - Maximum distance value for normalization.
     * @returns {StorageBuffer} The storage buffer containing generated sort keys.
     */
    generate(workBuffer, cameraNode, radialSort, elementCount, numBits, minDist, maxDist) {
        Debug.assert(elementCount > 0, 'GSplatSortKeyCompute.generate: elementCount must be > 0');

        // Ensure capacity
        this._ensureCapacity(elementCount);

        // Calculate workgroup dimensions
        const workgroupCount = Math.ceil(elementCount / THREADS_PER_WORKGROUP);
        const numWorkgroupsX = Math.min(workgroupCount, this.device.limits.maxComputeWorkgroupsPerDimension || 65535);
        const numWorkgroupsY = Math.ceil(workgroupCount / numWorkgroupsX);

        // Get or create compute instance based on sort mode (lazy creation)
        const compute = this._getCompute(radialSort);

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
        const cameraBin = GSplatSortBinWeights.computeCameraBin(radialSort, minDist, range);

        // Compute bin weights using shared utility
        const binWeights = this.binWeightsUtil.compute(cameraBin, bucketCount);

        // Upload to GPU
        this.binWeightsBuffer.write(0, binWeights);

        // Set parameters
        compute.setParameter('splatTexture0', workBuffer.splatTexture0);
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
        compute.setParameter('numWorkgroupsX', numWorkgroupsX);
        compute.setParameter('numBins', GSplatSortBinWeights.NUM_BINS);

        // Dispatch
        compute.setupDispatch(numWorkgroupsX, numWorkgroupsY, 1);
        this.device.computeDispatch([compute], 'GSplatSortKeyCompute');

        return this.keysBuffer;
    }
}

export { GSplatSortKeyCompute };
