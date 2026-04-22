import { Debug } from '../../core/debug.js';
import { Compute } from '../../platform/graphics/compute.js';
import { Shader } from '../../platform/graphics/shader.js';
import { StorageBuffer } from '../../platform/graphics/storage-buffer.js';
import { BindGroupFormat, BindStorageBufferFormat, BindUniformBufferFormat } from '../../platform/graphics/bind-group-format.js';
import { UniformBufferFormat, UniformFormat } from '../../platform/graphics/uniform-buffer-format.js';
import {
    BUFFERUSAGE_COPY_DST,
    BUFFERUSAGE_COPY_SRC,
    SHADERLANGUAGE_WGSL,
    SHADERSTAGE_COMPUTE,
    UNIFORMTYPE_FLOAT,
    UNIFORMTYPE_UINT,
    UNIFORMTYPE_VEC3,
    UNIFORMTYPE_VEC4
} from '../../platform/graphics/constants.js';
import { computeGsplatIntervalCullSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-interval-cull.js';
import { computeGsplatIntervalScatterSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-interval-scatter.js';
import { computeGsplatWriteIndirectArgsSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-write-indirect-args.js';
import { PrefixSumKernel } from '../graphics/prefix-sum-kernel.js';
import { RADIX_SORT_ELEMENTS_PER_WORKGROUP } from '../graphics/compute-radix-sort.js';
import { GSplatResourceBase } from '../gsplat/gsplat-resource-base.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GSplatFrustumCuller } from './gsplat-frustum-culler.js'
 * @import { GSplatWorldState } from './gsplat-world-state.js'
 */

const WORKGROUP_SIZE = 256;

const INDEX_COUNT = 6 * GSplatResourceBase.instanceSize;

const SORT_ELEMENTS_PER_WORKGROUP = RADIX_SORT_ELEMENTS_PER_WORKGROUP;

// 16 bytes per interval: { workBufferBase, splatCount, boundsIndex, pad }
const INTERVAL_STRIDE = 4;


/**
 * Interval-based GPU stream compaction for the GSplat GPU sort path. Replaces the
 * per-pixel flag+scatter approach with an O(numIntervals) cull pass and a
 * workgroup-per-interval scatter pass. Always active when GPU sorting is enabled,
 * regardless of the culling toggle.
 *
 * @ignore
 */
class GSplatIntervalCompaction {
    /** @type {GraphicsDevice} */
    device;

    /** @type {StorageBuffer|null} */
    compactedSplatIds = null;

    /** @type {StorageBuffer|null} */
    intervalsBuffer = null;

    /** @type {StorageBuffer|null} */
    countBuffer = null;

    /** @type {PrefixSumKernel|null} */
    prefixSumKernel = null;

    /** @type {StorageBuffer|null} */
    numSplatsBuffer = null;

    /** @type {StorageBuffer|null} */
    sortElementCountBuffer = null;

    /** @type {number} */
    allocatedCompactedCount = 0;

    /** @type {number} */
    allocatedIntervalCount = 0;

    /** @type {number} */
    allocatedCountBufferSize = 0;

    /**
     * World state version for which intervals were last uploaded. Avoids redundant
     * uploads when sortGpu is called repeatedly with the same world state.
     */
    _uploadedVersion = -1;

    /** @type {Compute|null} */
    _cullComputePerspective = null;

    /** @type {Compute|null} */
    _cullComputeFisheye = null;

    /** @type {Compute|null} */
    _scatterCompute = null;

    /** @type {Compute|null} */
    _writeIndirectArgsCompute = null;

    /** @type {BindGroupFormat|null} */
    _cullBindGroupFormatPerspective = null;

    /** @type {BindGroupFormat|null} */
    _cullBindGroupFormatFisheye = null;

    /** @type {BindGroupFormat|null} */
    _scatterBindGroupFormat = null;

    /** @type {BindGroupFormat|null} */
    _writeArgsBindGroupFormat = null;

    /** @type {UniformBufferFormat|null} */
    _scatterUniformBufferFormat = null;

    /** @type {UniformBufferFormat|null} */
    _writeArgsUniformBufferFormat = null;

    /**
     * @param {GraphicsDevice} device - The graphics device (must support compute).
     */
    constructor(device) {
        Debug.assert(device.supportsCompute, 'GSplatIntervalCompaction requires compute shader support (WebGPU)');
        this.device = device;

        this.numSplatsBuffer = new StorageBuffer(device, 4, BUFFERUSAGE_COPY_SRC | BUFFERUSAGE_COPY_DST);
        this.sortElementCountBuffer = new StorageBuffer(device, 4, BUFFERUSAGE_COPY_SRC | BUFFERUSAGE_COPY_DST);
        this.prefixSumKernel = new PrefixSumKernel(device);

        this._createUniformBufferFormats();
        this._createScatterCompute();
        this._createWriteIndirectArgsCompute();
    }

    destroy() {
        this.compactedSplatIds?.destroy();
        this.intervalsBuffer?.destroy();
        this.countBuffer?.destroy();
        this.prefixSumKernel?.destroy();
        this.numSplatsBuffer?.destroy();
        this.sortElementCountBuffer?.destroy();

        this._destroyCullPass();
        this._scatterCompute?.shader?.destroy();
        this._scatterBindGroupFormat?.destroy();
        this._writeIndirectArgsCompute?.shader?.destroy();
        this._writeArgsBindGroupFormat?.destroy();

        this.compactedSplatIds = null;
        this.intervalsBuffer = null;
        this.countBuffer = null;
        this.prefixSumKernel = null;
        this.numSplatsBuffer = null;
        this.sortElementCountBuffer = null;
        this._scatterCompute = null;
        this._scatterBindGroupFormat = null;
        this._writeIndirectArgsCompute = null;
        this._writeArgsBindGroupFormat = null;
        this._scatterUniformBufferFormat = null;
        this._writeArgsUniformBufferFormat = null;
    }

    /** @private */
    _destroyCullPass() {
        this._cullComputePerspective?.shader?.destroy();
        this._cullBindGroupFormatPerspective?.destroy();
        this._cullComputePerspective = null;
        this._cullBindGroupFormatPerspective = null;
        this._cullComputeFisheye?.shader?.destroy();
        this._cullBindGroupFormatFisheye?.destroy();
        this._cullComputeFisheye = null;
        this._cullBindGroupFormatFisheye = null;
    }

    /** @private */
    _createUniformBufferFormats() {
        const device = this.device;

        this._scatterUniformBufferFormat = new UniformBufferFormat(device, [
            new UniformFormat('numIntervals', UNIFORMTYPE_UINT),
            new UniformFormat('pad0', UNIFORMTYPE_UINT),
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
     * Creates a cull compute pass for the given mode.
     *
     * @param {boolean} fisheye - Whether to create the fisheye (cone) variant.
     * @returns {{ compute: Compute, bindGroupFormat: BindGroupFormat }} The created compute and bind group format.
     * @private
     */
    _createCullPass(fisheye) {
        const device = this.device;
        const suffix = fisheye ? 'Fisheye' : '';

        const bindGroupFormat = new BindGroupFormat(device, [
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('intervals', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('countBuffer', SHADERSTAGE_COMPUTE, false),
            new BindStorageBufferFormat('boundsBuffer', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('transformsBuffer', SHADERSTAGE_COMPUTE, true)
        ]);

        const cdefines = new Map([['{WORKGROUP_SIZE}', WORKGROUP_SIZE.toString()]]);
        if (fisheye) {
            cdefines.set('GSPLAT_FISHEYE', '');
        }

        const uniformBufferFormat = fisheye ?
            new UniformBufferFormat(device, [
                new UniformFormat('cameraWorldPos', UNIFORMTYPE_VEC3),
                new UniformFormat('maxTheta', UNIFORMTYPE_FLOAT),
                new UniformFormat('cameraForward', UNIFORMTYPE_VEC3),
                new UniformFormat('numIntervals', UNIFORMTYPE_UINT)
            ]) :
            new UniformBufferFormat(device, [
                new UniformFormat('frustumPlanes', UNIFORMTYPE_VEC4, 6),
                new UniformFormat('numIntervals', UNIFORMTYPE_UINT)
            ]);

        const shader = new Shader(device, {
            name: `GSplatIntervalCull${suffix}`,
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatIntervalCullSource,
            cdefines: cdefines,
            computeBindGroupFormat: bindGroupFormat,
            computeUniformBufferFormats: { uniforms: uniformBufferFormat }
        });

        const compute = new Compute(device, shader, `GSplatIntervalCull${suffix}`);
        return { compute, bindGroupFormat };
    }

    /**
     * Returns the cached cull Compute for the given mode, lazily creating it on first use.
     *
     * @param {boolean} fisheye - Whether fisheye is active.
     * @returns {Compute} The cached Compute instance.
     * @private
     */
    _getCullCompute(fisheye) {
        if (fisheye) {
            if (!this._cullComputeFisheye) {
                const { compute, bindGroupFormat } = this._createCullPass(true);
                this._cullComputeFisheye = compute;
                this._cullBindGroupFormatFisheye = bindGroupFormat;
            }
            return this._cullComputeFisheye;
        }
        if (!this._cullComputePerspective) {
            const { compute, bindGroupFormat } = this._createCullPass(false);
            this._cullComputePerspective = compute;
            this._cullBindGroupFormatPerspective = bindGroupFormat;
        }
        return this._cullComputePerspective;
    }

    /** @private */
    _createScatterCompute() {
        const device = this.device;

        this._scatterBindGroupFormat = new BindGroupFormat(device, [
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('intervals', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('prefixSumBuffer', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('compactedOutput', SHADERSTAGE_COMPUTE, false)
        ]);

        const cdefines = new Map([
            ['{WORKGROUP_SIZE}', WORKGROUP_SIZE.toString()]
        ]);

        const shader = new Shader(device, {
            name: 'GSplatIntervalScatter',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatIntervalScatterSource,
            cdefines: cdefines,
            computeBindGroupFormat: this._scatterBindGroupFormat,
            computeUniformBufferFormats: { uniforms: this._scatterUniformBufferFormat }
        });

        this._scatterCompute = new Compute(device, shader, 'GSplatIntervalScatter');
    }

    /** @private */
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
            ['{KEYGEN_THREADS_PER_WORKGROUP}', 256],
            ['{SORT_ELEMENTS_PER_WORKGROUP}', SORT_ELEMENTS_PER_WORKGROUP],
            ['{MAX_WORKGROUPS_PER_DIM}', device.limits.maxComputeWorkgroupsPerDimension || 65535]
        ]);

        const shader = new Shader(device, {
            name: 'GSplatIntervalWriteIndirectArgs',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatWriteIndirectArgsSource,
            cdefines: cdefines,
            computeBindGroupFormat: this._writeArgsBindGroupFormat,
            computeUniformBufferFormats: { uniforms: this._writeArgsUniformBufferFormat }
        });

        this._writeIndirectArgsCompute = new Compute(device, shader, 'GSplatIntervalWriteIndirectArgs');
    }

    /**
     * Ensures all buffers have sufficient capacity.
     *
     * @param {number} numIntervals - Number of intervals.
     * @param {number} totalActiveSplats - Total active splats (max compacted output size).
     * @private
     */
    _ensureCapacity(numIntervals, totalActiveSplats) {
        if (totalActiveSplats > this.allocatedCompactedCount) {
            this.compactedSplatIds?.destroy();
            this.allocatedCompactedCount = totalActiveSplats;
            this.compactedSplatIds = new StorageBuffer(this.device, totalActiveSplats * 4, BUFFERUSAGE_COPY_SRC);
        }

        const requiredCountSize = numIntervals + 1;
        if (requiredCountSize > this.allocatedCountBufferSize) {
            this.countBuffer?.destroy();
            this.allocatedCountBufferSize = requiredCountSize;
            this.countBuffer = new StorageBuffer(this.device, requiredCountSize * 4);

            if (this.prefixSumKernel) {
                this.prefixSumKernel.destroyPasses();
            }
        }
    }

    /**
     * Builds and uploads interval metadata from the world state. Called once per
     * world state change (not every frame).
     *
     * @param {GSplatWorldState} worldState - The world state to extract intervals from.
     */
    uploadIntervals(worldState) {
        if (worldState.version === this._uploadedVersion) return;
        this._uploadedVersion = worldState.version;

        const splats = worldState.splats;
        const numIntervals = worldState.totalIntervals;

        if (numIntervals === 0) return;

        // Grow intervals buffer if needed
        if (numIntervals > this.allocatedIntervalCount) {
            this.intervalsBuffer?.destroy();
            this.allocatedIntervalCount = numIntervals;
            this.intervalsBuffer = new StorageBuffer(this.device, numIntervals * INTERVAL_STRIDE * 4, BUFFERUSAGE_COPY_DST);
        }

        const data = new Uint32Array(numIntervals * INTERVAL_STRIDE);
        let writeIdx = 0;

        for (let s = 0; s < splats.length; s++) {
            const splat = splats[s];

            if (splat.intervals.length > 0) {
                // Octree: each interval has its own offset from per-node allocation
                const nodeIndices = splat.intervalNodeIndices;
                for (let i = 0; i < splat.intervals.length; i += 2) {
                    const count = splat.intervals[i + 1] - splat.intervals[i];
                    data[writeIdx++] = splat.intervalOffsets[i / 2];
                    data[writeIdx++] = count;
                    data[writeIdx++] = splat.boundsBaseIndex + (nodeIndices.length > 0 ? nodeIndices[i / 2] : 0);
                    data[writeIdx++] = 0;
                }
            } else {
                // Non-octree: single interval covering the entire splat
                data[writeIdx++] = splat.intervalOffsets[0];
                data[writeIdx++] = splat.activeSplats;
                data[writeIdx++] = splat.boundsBaseIndex;
                data[writeIdx++] = 0;
            }
        }

        this.intervalsBuffer.write(0, data, 0, numIntervals * INTERVAL_STRIDE);
    }

    /**
     * Runs the full interval compaction pipeline: cull+count, prefix sum, scatter.
     *
     * @param {GSplatFrustumCuller} frustumCuller - Frustum culler providing bounds/transforms storage buffers and frustum planes.
     * @param {number} numIntervals - Total number of intervals.
     * @param {number} totalActiveSplats - Total active splats across all intervals.
     * @param {boolean} fisheyeEnabled - Whether fisheye cone culling should be used instead of frustum planes.
     */
    dispatchCompact(frustumCuller, numIntervals, totalActiveSplats, fisheyeEnabled) {
        if (numIntervals === 0) return;

        this._ensureCapacity(numIntervals, totalActiveSplats);

        const cullCompute = this._getCullCompute(fisheyeEnabled);

        // --- Pass 1: Interval cull + count ---
        cullCompute.setParameter('intervals', this.intervalsBuffer);
        cullCompute.setParameter('countBuffer', this.countBuffer);
        cullCompute.setParameter('boundsBuffer', frustumCuller.boundsBuffer);
        cullCompute.setParameter('transformsBuffer', frustumCuller.transformsBuffer);

        if (fisheyeEnabled) {
            cullCompute.setParameter('cameraWorldPos', frustumCuller.fisheyeCameraPos);
            cullCompute.setParameter('maxTheta', frustumCuller.fisheyeMaxTheta);
            cullCompute.setParameter('cameraForward', frustumCuller.fisheyeCameraForward);
        } else {
            cullCompute.setParameter('frustumPlanes[0]', frustumCuller.frustumPlanes);
        }

        cullCompute.setParameter('numIntervals', numIntervals);

        const cullWorkgroups = Math.ceil(numIntervals / WORKGROUP_SIZE);
        cullCompute.setupDispatch(cullWorkgroups);
        this.device.computeDispatch([cullCompute], 'GSplatIntervalCull');

        // --- Pass 2: Prefix sum over numIntervals + 1 elements ---
        const prefixCount = numIntervals + 1;
        this.prefixSumKernel.resize(this.countBuffer, prefixCount);
        this.prefixSumKernel.dispatch(this.device);

        // --- Pass 3: Interval scatter ---
        const scatterCompute = this._scatterCompute;

        scatterCompute.setParameter('intervals', this.intervalsBuffer);
        scatterCompute.setParameter('prefixSumBuffer', this.countBuffer);
        scatterCompute.setParameter('compactedOutput', this.compactedSplatIds);
        scatterCompute.setParameter('numIntervals', numIntervals);
        scatterCompute.setParameter('pad0', 0);
        scatterCompute.setParameter('pad1', 0);
        scatterCompute.setParameter('pad2', 0);

        // One workgroup per interval (1D dispatch; numIntervals is always well below 65535)
        scatterCompute.setupDispatch(numIntervals);
        this.device.computeDispatch([scatterCompute], 'GSplatIntervalScatter');
    }

    /**
     * Writes indirect draw and dispatch arguments from the prefix sum visible count.
     *
     * @param {number} drawSlot - Slot index in the device's indirect draw buffer.
     * @param {number} dispatchSlot - Slot index in the device's indirect dispatch buffer.
     * @param {number} numIntervals - Total interval count (index into prefix sum for visible count).
     */
    writeIndirectArgs(drawSlot, dispatchSlot, numIntervals) {
        const compute = this._writeIndirectArgsCompute;

        compute.setParameter('prefixSumBuffer', this.countBuffer);
        compute.setParameter('indirectDrawArgs', this.device.indirectDrawBuffer);
        compute.setParameter('numSplatsBuf', this.numSplatsBuffer);
        compute.setParameter('indirectDispatchArgs', this.device.indirectDispatchBuffer);
        compute.setParameter('sortElementCountBuf', this.sortElementCountBuffer);

        compute.setParameter('drawSlot', drawSlot);
        compute.setParameter('indexCount', INDEX_COUNT);
        compute.setParameter('dispatchSlotOffset', dispatchSlot * 3);
        compute.setParameter('totalSplats', numIntervals);

        compute.setupDispatch(1);
        this.device.computeDispatch([compute], 'GSplatIntervalWriteIndirectArgs');
    }
}

export { GSplatIntervalCompaction };
