import { Debug } from '../../core/debug.js';
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
import { computeGsplatIntervalCullSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-interval-cull.js';
import { computeGsplatIntervalScatterSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-interval-scatter.js';
import { computeGsplatWriteIndirectArgsSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-write-indirect-args.js';
import { PrefixSumKernel } from '../graphics/prefix-sum-kernel.js';
import { GSplatResourceBase } from '../gsplat/gsplat-resource-base.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GSplatWorldState } from './gsplat-world-state.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 */

const WORKGROUP_SIZE = 256;

const INDEX_COUNT = 6 * GSplatResourceBase.instanceSize;

const SORT_THREADS_PER_WORKGROUP = 256;

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
     *
     * @type {number}
     */
    _uploadedVersion = -1;

    /**
     * Whether the current cull pass uses culling. Lazily created and recreated when
     * switching between culling-enabled and culling-disabled modes.
     *
     * @type {boolean}
     */
    _cullingEnabled = false;

    /** @type {Compute|null} */
    _cullCompute = null;

    /** @type {Compute|null} */
    _scatterCompute = null;

    /** @type {Compute|null} */
    _writeIndirectArgsCompute = null;

    /** @type {BindGroupFormat|null} */
    _cullBindGroupFormat = null;

    /** @type {BindGroupFormat|null} */
    _scatterBindGroupFormat = null;

    /** @type {BindGroupFormat|null} */
    _writeArgsBindGroupFormat = null;

    /** @type {UniformBufferFormat|null} */
    _cullUniformBufferFormat = null;

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
        this._cullUniformBufferFormat = null;
        this._scatterUniformBufferFormat = null;
        this._writeArgsUniformBufferFormat = null;
    }

    /**
     * @private
     */
    _destroyCullPass() {
        this._cullCompute?.shader?.destroy();
        this._cullBindGroupFormat?.destroy();
        this._cullCompute = null;
        this._cullBindGroupFormat = null;
    }

    /**
     * @private
     */
    _createUniformBufferFormats() {
        const device = this.device;

        this._cullUniformBufferFormat = new UniformBufferFormat(device, [
            new UniformFormat('numIntervals', UNIFORMTYPE_UINT),
            new UniformFormat('visWidth', UNIFORMTYPE_UINT)
        ]);

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
     * Ensures the cull compute pass exists for the requested culling mode.
     *
     * @param {boolean} cullingEnabled - Whether frustum culling is active.
     * @private
     */
    _ensureCullPass(cullingEnabled) {
        if (this._cullCompute && cullingEnabled === this._cullingEnabled) {
            return;
        }

        this._destroyCullPass();
        this._cullingEnabled = cullingEnabled;

        const device = this.device;
        const suffix = cullingEnabled ? 'Culled' : '';

        const entries = [
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('intervals', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('countBuffer', SHADERSTAGE_COMPUTE, false)
        ];
        if (cullingEnabled) {
            entries.push(new BindTextureFormat('nodeVisibilityTexture', SHADERSTAGE_COMPUTE, undefined, SAMPLETYPE_UINT, false));
        }
        this._cullBindGroupFormat = new BindGroupFormat(device, entries);

        /** @type {Map<string, string>} */
        const cdefines = new Map([
            ['{WORKGROUP_SIZE}', WORKGROUP_SIZE.toString()]
        ]);
        if (cullingEnabled) {
            cdefines.set('CULLING_ENABLED', '');
        }

        const shader = new Shader(device, {
            name: `GSplatIntervalCull${suffix}`,
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatIntervalCullSource,
            cdefines: cdefines,
            computeBindGroupFormat: this._cullBindGroupFormat,
            computeUniformBufferFormats: { uniforms: this._cullUniformBufferFormat }
        });

        this._cullCompute = new Compute(device, shader, `GSplatIntervalCull${suffix}`);
    }

    /**
     * @private
     */
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

    /**
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
            let workBufferBase = splat.pixelOffset;

            if (splat.intervals.length > 0) {
                // Partial octree load: sub-draws pack intervals sequentially in Map
                // iteration order, so workBufferBase increments by each interval's count.
                let localBoundsIdx = 0;
                for (let i = 0; i < splat.intervals.length; i += 2) {
                    const count = splat.intervals[i + 1] - splat.intervals[i];
                    data[writeIdx++] = workBufferBase;
                    data[writeIdx++] = count;
                    data[writeIdx++] = splat.boundsBaseIndex + localBoundsIdx;
                    data[writeIdx++] = 0;
                    workBufferBase += count;
                    localBoundsIdx++;
                }
            } else if (splat.placementIntervals && splat.placementIntervals.size > 0) {
                // Fully-loaded octree: intervals were cleared (all nodes active) but
                // per-node bounding spheres still exist. Without sub-draws the work buffer
                // stores splats in source order, so each node's data starts at
                // basePixel + sourceStart rather than sequential packing.
                const basePixel = splat.pixelOffset;
                let localBoundsIdx = 0;
                for (const interval of splat.placementIntervals.values()) {
                    const start = interval.x;
                    const count = interval.y - start + 1;
                    data[writeIdx++] = basePixel + start;
                    data[writeIdx++] = count;
                    data[writeIdx++] = splat.boundsBaseIndex + localBoundsIdx;
                    data[writeIdx++] = 0;
                    localBoundsIdx++;
                }
            } else {
                // Non-octree: single interval covering the entire splat.
                data[writeIdx++] = workBufferBase;
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
     * @param {Texture|null} nodeVisibilityTexture - Bit-packed visibility texture (when culling).
     * @param {number} numIntervals - Total number of intervals.
     * @param {number} totalActiveSplats - Total active splats across all intervals.
     * @param {boolean} cullingEnabled - Whether frustum culling is active.
     */
    dispatchCompact(nodeVisibilityTexture, numIntervals, totalActiveSplats, cullingEnabled) {
        if (numIntervals === 0) return;

        this._ensureCapacity(numIntervals, totalActiveSplats);
        this._ensureCullPass(cullingEnabled);

        // --- Pass 1: Interval cull + count ---
        const cullCompute = this._cullCompute;

        cullCompute.setParameter('intervals', this.intervalsBuffer);
        cullCompute.setParameter('countBuffer', this.countBuffer);
        if (cullingEnabled) {
            cullCompute.setParameter('nodeVisibilityTexture', nodeVisibilityTexture);
        }

        cullCompute.setParameter('numIntervals', numIntervals);
        cullCompute.setParameter('visWidth', cullingEnabled ? nodeVisibilityTexture.width : 0);

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
