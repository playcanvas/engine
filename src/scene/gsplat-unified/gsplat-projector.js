import { Debug } from '../../core/debug.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Compute } from '../../platform/graphics/compute.js';
import { Shader } from '../../platform/graphics/shader.js';
import { StorageBuffer } from '../../platform/graphics/storage-buffer.js';
import {
    BindGroupFormat,
    BindStorageBufferFormat,
    BindUniformBufferFormat
} from '../../platform/graphics/bind-group-format.js';
import {
    UniformBufferFormat,
    UniformFormat
} from '../../platform/graphics/uniform-buffer-format.js';
import {
    BUFFERUSAGE_COPY_DST,
    BUFFERUSAGE_COPY_SRC,
    PIXELFORMAT_RGBA16U,
    SHADERLANGUAGE_WGSL,
    SHADERSTAGE_COMPUTE,
    UNIFORMTYPE_FLOAT,
    UNIFORMTYPE_MAT4,
    UNIFORMTYPE_UINT,
    UNIFORMTYPE_UVEC4,
    UNIFORMTYPE_VEC3
} from '../../platform/graphics/constants.js';
import { PROJECTION_ORTHOGRAPHIC } from '../constants.js';
import { GSplatResourceBase } from '../gsplat/gsplat-resource-base.js';
import { GSplatSortBinWeights } from './gsplat-sort-bin-weights.js';
import { CACHE_STRIDE } from './gsplat-projector-constants.js';
import { computeGsplatProjectorSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-projector.js';
import { computeGsplatProjectorWriteIndirectArgsSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-projector-write-indirect-args.js';
import { computeGsplatProjectCommonSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-project-common.js';
import { computeGsplatCommonSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-common.js';
import { computeGsplatTileIntersectSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-tile-intersect.js';
import computeSplatSource from '../shader-lib/wgsl/chunks/gsplat/vert/gsplatComputeSplat.js';

/**
 * @import { GraphNode } from '../graph-node.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GSplatWorkBuffer } from './gsplat-work-buffer.js'
 */

const INDEX_COUNT = 6 * GSplatResourceBase.instanceSize;
const PROJECTOR_WORKGROUP_SIZE = 256;

const _cameraDir = new Vec3();
const _dispatchSize = new Vec2();
const _viewProjMat = new Mat4();
const _viewProjData = new Float32Array(16);
const _viewData = new Float32Array(16);

/**
 * Owns the per-splat compute pass for the hybrid GSplat renderer (Pass B in the pipeline):
 *
 *   project + screen-space cull + sort key generation + compaction
 *
 * The pass reads the post-frustum-culled `compactedSplatIds` produced by
 * {@link GSplatIntervalCompaction} and writes a pre-projected raster-friendly
 * cache (see {@link CACHE_STRIDE}) plus a parallel array of depth-based sort
 * keys. A workgroup-local atomic compaction pattern (one global atomicAdd per
 * workgroup of 256 threads) keeps post-cull entries dense in the output buffers.
 *
 * Designed to live alongside the existing renderers without affecting them. The
 * cache layout is duplicated in `gsplat-projector-constants.js` (JS) and the
 * projector / hybrid VS WGSL chunks via the `{CACHE_STRIDE}` cdefine.
 *
 * @ignore
 */
class GSplatProjector {
    /** @type {GraphicsDevice} */
    device;

    /**
     * 32 B per splat (8 u32 slots), sized to the work-buffer capacity (not the
     * post-cull count) to avoid undersizing on transient cull-rate drops.
     *
     * @type {StorageBuffer|null}
     */
    projCache = null;

    /** @type {StorageBuffer|null} */
    sortKeys = null;

    /**
     * Single-element atomic counter; reset to 0 every frame and incremented by
     * the projector pass via per-workgroup atomicAdd.
     *
     * @type {StorageBuffer|null}
     */
    renderCounter = null;

    /**
     * Storage buffer holding interleaved bin weights {base, divider} consumed by
     * the projector for camera-relative sort key precision.
     *
     * @type {StorageBuffer|null}
     */
    binWeightsBuffer = null;

    /** @type {GSplatSortBinWeights} */
    binWeightsUtil;

    /** @type {Compute|null} */
    _projectorComputeLinear = null;

    /** @type {Compute|null} */
    _projectorComputeRadial = null;

    /** @type {Compute|null} */
    _projectorComputeLinearPick = null;

    /** @type {Compute|null} */
    _projectorComputeRadialPick = null;

    /** @type {BindGroupFormat|null} */
    _projectorBindGroupFormat = null;

    /** @type {UniformBufferFormat|null} */
    _projectorUniformBufferFormat = null;

    /** @type {Compute|null} */
    _writeIndirectArgsCompute = null;

    /** @type {BindGroupFormat|null} */
    _writeArgsBindGroupFormat = null;

    /** @type {UniformBufferFormat|null} */
    _writeArgsUniformBufferFormat = null;

    /**
     * Cached work-buffer format version; changes invalidate the projector
     * compute (its bind group format is derived from the work-buffer format).
     */
    _formatVersion = -1;

    /** @type {number} */
    _allocatedCacheCount = 0;

    /** @type {Float32Array} */
    cameraPositionData = new Float32Array(3);

    /** @type {Float32Array} */
    cameraDirectionData = new Float32Array(3);

    /**
     * @param {GraphicsDevice} device - The graphics device (must support compute).
     */
    constructor(device) {
        Debug.assert(device.supportsCompute, 'GSplatProjector requires compute shader support (WebGPU)');
        this.device = device;

        this.binWeightsUtil = new GSplatSortBinWeights();
        this.binWeightsBuffer = new StorageBuffer(
            device,
            GSplatSortBinWeights.NUM_BINS * 2 * 4,
            BUFFERUSAGE_COPY_SRC | BUFFERUSAGE_COPY_DST
        );

        // 4 B counter, cleared every frame on the GPU via clear().
        this.renderCounter = new StorageBuffer(device, 4, BUFFERUSAGE_COPY_SRC | BUFFERUSAGE_COPY_DST);

        this._createUniformBufferFormats();
        this._createWriteIndirectArgsCompute();
    }

    destroy() {
        this.projCache?.destroy();
        this.sortKeys?.destroy();
        this.renderCounter?.destroy();
        this.binWeightsBuffer?.destroy();

        this._projectorComputeLinear?.shader?.destroy();
        this._projectorComputeRadial?.shader?.destroy();
        this._projectorComputeLinearPick?.shader?.destroy();
        this._projectorComputeRadialPick?.shader?.destroy();
        this._projectorBindGroupFormat?.destroy();
        this._writeIndirectArgsCompute?.shader?.destroy();
        this._writeArgsBindGroupFormat?.destroy();

        this.projCache = null;
        this.sortKeys = null;
        this.renderCounter = null;
        this.binWeightsBuffer = null;
        this._projectorComputeLinear = null;
        this._projectorComputeRadial = null;
        this._projectorComputeLinearPick = null;
        this._projectorComputeRadialPick = null;
        this._projectorBindGroupFormat = null;
        this._projectorUniformBufferFormat = null;
        this._writeIndirectArgsCompute = null;
        this._writeArgsBindGroupFormat = null;
        this._writeArgsUniformBufferFormat = null;
    }

    /** @private */
    _createUniformBufferFormats() {
        const device = this.device;

        // Projector uniforms — kept in the same packing order the WGSL struct expects.
        this._projectorUniformBufferFormat = new UniformBufferFormat(device, [
            new UniformFormat('splatTextureSize', UNIFORMTYPE_UINT),
            new UniformFormat('numBins', UNIFORMTYPE_UINT),
            new UniformFormat('isOrtho', UNIFORMTYPE_UINT),
            new UniformFormat('pad0', UNIFORMTYPE_UINT),
            new UniformFormat('viewProj', UNIFORMTYPE_MAT4),
            new UniformFormat('viewMatrix', UNIFORMTYPE_MAT4),
            new UniformFormat('cameraPosition', UNIFORMTYPE_VEC3),
            new UniformFormat('minPixelSize', UNIFORMTYPE_FLOAT),
            new UniformFormat('cameraDirection', UNIFORMTYPE_VEC3),
            new UniformFormat('focal', UNIFORMTYPE_FLOAT),
            new UniformFormat('viewportWidth', UNIFORMTYPE_FLOAT),
            new UniformFormat('viewportHeight', UNIFORMTYPE_FLOAT),
            new UniformFormat('nearClip', UNIFORMTYPE_FLOAT),
            new UniformFormat('farClip', UNIFORMTYPE_FLOAT),
            new UniformFormat('alphaClip', UNIFORMTYPE_FLOAT),
            new UniformFormat('minContribution', UNIFORMTYPE_FLOAT),
            new UniformFormat('minDist', UNIFORMTYPE_FLOAT),
            new UniformFormat('invRange', UNIFORMTYPE_FLOAT)
        ]);

        this._writeArgsUniformBufferFormat = new UniformBufferFormat(device, [
            new UniformFormat('drawSlot', UNIFORMTYPE_UINT),
            new UniformFormat('indexCount', UNIFORMTYPE_UINT),
            new UniformFormat('sortSlotBase', UNIFORMTYPE_UINT),
            new UniformFormat('pad0', UNIFORMTYPE_UINT),
            new UniformFormat('sortIndirectInfo', UNIFORMTYPE_UVEC4)
        ]);
    }

    /** @private */
    _createWriteIndirectArgsCompute() {
        const device = this.device;

        this._writeArgsBindGroupFormat = new BindGroupFormat(device, [
            new BindStorageBufferFormat('renderCounter', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('indirectDrawArgs', SHADERSTAGE_COMPUTE, false),
            new BindStorageBufferFormat('numSplatsBuf', SHADERSTAGE_COMPUTE, false),
            new BindStorageBufferFormat('indirectDispatchArgs', SHADERSTAGE_COMPUTE, false),
            new BindStorageBufferFormat('sortElementCountBuf', SHADERSTAGE_COMPUTE, false),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
        ]);

        const cdefines = new Map([
            ['{INSTANCE_SIZE}', GSplatResourceBase.instanceSize.toString()]
        ]);

        const shader = new Shader(device, {
            name: 'GSplatProjectorWriteIndirectArgs',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatProjectorWriteIndirectArgsSource,
            cdefines: cdefines,
            computeBindGroupFormat: this._writeArgsBindGroupFormat,
            computeUniformBufferFormats: { uniforms: this._writeArgsUniformBufferFormat }
        });

        this._writeIndirectArgsCompute = new Compute(device, shader, 'GSplatProjectorWriteIndirectArgs');
    }

    /**
     * Destroys the projector compute pipelines so they are lazily rebuilt against the
     * current work-buffer format.
     *
     * @private
     */
    _destroyProjectorComputes() {
        this._projectorComputeLinear?.shader?.destroy();
        this._projectorComputeRadial?.shader?.destroy();
        this._projectorComputeLinearPick?.shader?.destroy();
        this._projectorComputeRadialPick?.shader?.destroy();
        this._projectorBindGroupFormat?.destroy();
        this._projectorComputeLinear = null;
        this._projectorComputeRadial = null;
        this._projectorComputeLinearPick = null;
        this._projectorComputeRadialPick = null;
        this._projectorBindGroupFormat = null;
    }

    /**
     * Builds the projector Compute (one variant per sort mode).
     *
     * @param {GSplatWorkBuffer} workBuffer - The current work buffer (provides format).
     * @param {boolean} radialSort - Whether to compile the RADIAL_SORT variant.
     * @param {boolean} pickMode - Whether to write pcId into the cache for picking.
     * @returns {Compute} The created compute instance.
     * @private
     */
    _createProjectorCompute(workBuffer, radialSort, pickMode) {
        const device = this.device;
        const wbFormat = workBuffer.format;

        const fixedBindings = [
            new BindStorageBufferFormat('compactedSplatIds', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('sortElementCount', SHADERSTAGE_COMPUTE, true),
            new BindStorageBufferFormat('projCache', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('sortKeys', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('renderCounter', SHADERSTAGE_COMPUTE),
            new BindStorageBufferFormat('binWeights', SHADERSTAGE_COMPUTE, true),
            new BindUniformBufferFormat('uniforms', SHADERSTAGE_COMPUTE)
        ];

        if (!this._projectorBindGroupFormat) {
            this._projectorBindGroupFormat = new BindGroupFormat(device, [
                ...fixedBindings,
                ...wbFormat.getComputeBindFormats()
            ]);
        }

        const cincludes = new Map();
        cincludes.set('gsplatCommonCS', computeGsplatCommonSource);
        cincludes.set('gsplatTileIntersectCS', computeGsplatTileIntersectSource);
        cincludes.set('gsplatComputeSplatCS', computeSplatSource);
        cincludes.set('gsplatFormatDeclCS', wbFormat.getComputeInputDeclarations(fixedBindings.length));
        cincludes.set('gsplatFormatReadCS', wbFormat.getReadCode());
        cincludes.set('gsplatProjectCommonCS', computeGsplatProjectCommonSource);

        const cdefines = new Map();
        cdefines.set('{CACHE_STRIDE}', CACHE_STRIDE.toString());
        if (radialSort) {
            cdefines.set('RADIAL_SORT', '');
        }
        if (pickMode) {
            cdefines.set('PICK_MODE', '');
        }

        // Format-specific defines mirroring the compute renderer (compute-gsplat-local-renderer.js).
        const colorStream = wbFormat.getStream('dataColor');
        if (colorStream && colorStream.format !== PIXELFORMAT_RGBA16U) {
            cdefines.set('GSPLAT_COLOR_FLOAT', '');
        }

        const shader = new Shader(device, {
            name: `${radialSort ? 'GSplatProjectorRadial' : 'GSplatProjectorLinear'}${pickMode ? 'Pick' : ''}`,
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatProjectorSource,
            cincludes: cincludes,
            cdefines: cdefines,
            computeBindGroupFormat: this._projectorBindGroupFormat,
            computeUniformBufferFormats: { uniforms: this._projectorUniformBufferFormat }
        });

        return new Compute(device, shader, `${radialSort ? 'GSplatProjectorRadial' : 'GSplatProjectorLinear'}${pickMode ? 'Pick' : ''}`);
    }

    /**
     * Returns the projector Compute for the requested sort mode, lazily creating it.
     * Recreates all compute instances when the work-buffer format version changes.
     *
     * @param {GSplatWorkBuffer} workBuffer - The current work buffer.
     * @param {boolean} radialSort - Whether to use the radial sort variant.
     * @param {boolean} [pickMode] - Whether to use the pick-output variant.
     * @returns {Compute} The projector compute instance.
     * @private
     */
    _getProjectorCompute(workBuffer, radialSort, pickMode = false) {
        const wbFormat = workBuffer.format;
        if (this._formatVersion !== wbFormat.extraStreamsVersion) {
            this._destroyProjectorComputes();
            this._formatVersion = wbFormat.extraStreamsVersion;
        }

        if (radialSort) {
            if (pickMode) {
                if (!this._projectorComputeRadialPick) {
                    this._projectorComputeRadialPick = this._createProjectorCompute(workBuffer, true, true);
                }
                return this._projectorComputeRadialPick;
            }
            if (!this._projectorComputeRadial) {
                this._projectorComputeRadial = this._createProjectorCompute(workBuffer, true, false);
            }
            return this._projectorComputeRadial;
        }
        if (pickMode) {
            if (!this._projectorComputeLinearPick) {
                this._projectorComputeLinearPick = this._createProjectorCompute(workBuffer, false, true);
            }
            return this._projectorComputeLinearPick;
        }
        if (!this._projectorComputeLinear) {
            this._projectorComputeLinear = this._createProjectorCompute(workBuffer, false, false);
        }
        return this._projectorComputeLinear;
    }

    /**
     * Ensures projCache and sortKeys storage buffers are sized to at least `capacity` splats.
     * Both buffers are sized to the work-buffer capacity (passed in by the caller) rather than
     * post-cull counts, mirroring `compactedSplatIds` allocation in interval compaction.
     *
     * @param {number} capacity - Required splat capacity (work-buffer total active splats).
     * @private
     */
    _ensureCapacity(capacity) {
        if (capacity > this._allocatedCacheCount) {
            this.projCache?.destroy();
            this.sortKeys?.destroy();
            this._allocatedCacheCount = capacity;
            this.projCache = new StorageBuffer(this.device, capacity * CACHE_STRIDE * 4);
            this.sortKeys = new StorageBuffer(this.device, capacity * 4, BUFFERUSAGE_COPY_SRC);
        }
    }

    /**
     * Runs the project + cull + key-gen + compact compute pass.
     *
     * @param {object} params - Dispatch parameters.
     * @param {GSplatWorkBuffer} params.workBuffer - The current work buffer.
     * @param {GraphNode} params.cameraNode - The camera node (with attached CameraComponent).
     * @param {StorageBuffer} params.compactedSplatIds - Output of interval compaction.
     * @param {StorageBuffer} params.sortElementCountBuffer - GPU-written visible count from
     * interval compaction (single u32 element); the projector reads this to early-out
     * threads beyond the post-frustum-cull range.
     * @param {number} params.totalCapacity - Work-buffer capacity used to size projCache /
     * sortKeys (typically `worldState.totalActiveSplats`).
     * @param {boolean} params.radialSort - Whether to use the radial sort key variant.
     * @param {number} params.numBits - Sort key bit count (defines bucket count = 1 << numBits).
     * @param {number} params.minDist - Minimum distance for sort key normalisation.
     * @param {number} params.maxDist - Maximum distance for sort key normalisation.
     * @param {number} params.alphaClip - Alpha cull threshold.
     * @param {number} params.minPixelSize - Minimum on-screen pixel size before culling.
     * @param {number} params.minContribution - Minimum total contribution before culling.
     * @param {number} params.viewportWidth - Render viewport width in pixels.
     * @param {number} params.viewportHeight - Render viewport height in pixels.
     * @param {boolean} [params.pickMode] - Whether to write picking IDs into the cache.
     */
    dispatch(params) {
        const {
            workBuffer, cameraNode, compactedSplatIds, sortElementCountBuffer,
            totalCapacity, radialSort, numBits, minDist, maxDist,
            alphaClip, minPixelSize, minContribution,
            viewportWidth, viewportHeight, pickMode = false
        } = params;

        this._ensureCapacity(totalCapacity);

        // Reset the global render counter on the GPU. This is encoded into the same
        // command buffer as the dispatch, so it is correctly ordered before the projector
        // workgroups run their atomicAdds.
        this.renderCounter.clear();

        const compute = this._getProjectorCompute(workBuffer, radialSort, pickMode);

        // Camera position / forward (camera Z basis, matching cpu-sort and key-compute).
        const cameraPos = cameraNode.getPosition();
        const cameraMat = cameraNode.getWorldTransform();
        const cameraDir = cameraMat.getZ(_cameraDir).normalize();

        const range = maxDist - minDist;
        const invRange = range > 0 ? 1.0 / range : 1.0;

        // Bin weights — same pattern as GSplatSortKeyCompute.
        const bucketCount = (1 << numBits);
        const cameraBin = GSplatSortBinWeights.computeCameraBin(radialSort, minDist, range);
        const binWeights = this.binWeightsUtil.compute(cameraBin, bucketCount);
        this.binWeightsBuffer.write(0, binWeights);

        compute.setParameter('compactedSplatIds', compactedSplatIds);
        compute.setParameter('sortElementCount', sortElementCountBuffer);
        compute.setParameter('projCache', this.projCache);
        compute.setParameter('sortKeys', this.sortKeys);
        compute.setParameter('renderCounter', this.renderCounter);
        compute.setParameter('binWeights', this.binWeightsBuffer);

        // Bind work-buffer textures.
        for (const stream of workBuffer.format.resourceStreams) {
            const texture = workBuffer.getTexture(stream.name);
            if (texture) {
                compute.setParameter(stream.name, texture);
            }
        }

        // Camera + projection uniforms. Mirrors the compute renderer's setup
        // (gsplat-compute-local-renderer.js) for math parity.
        const cameraComponent = cameraNode.camera;
        const cam = cameraComponent.camera;
        const view = cam.viewMatrix;
        const proj = cam.projectionMatrix;
        _viewProjMat.mul2(proj, view);
        _viewProjData.set(_viewProjMat.data);
        _viewData.set(view.data);

        const focal = viewportWidth * proj.data[0];

        this.cameraPositionData[0] = cameraPos.x;
        this.cameraPositionData[1] = cameraPos.y;
        this.cameraPositionData[2] = cameraPos.z;
        compute.setParameter('cameraPosition', this.cameraPositionData);

        this.cameraDirectionData[0] = cameraDir.x;
        this.cameraDirectionData[1] = cameraDir.y;
        this.cameraDirectionData[2] = cameraDir.z;
        compute.setParameter('cameraDirection', this.cameraDirectionData);

        compute.setParameter('viewMatrix', _viewData);
        compute.setParameter('viewProj', _viewProjData);

        compute.setParameter('focal', focal);
        compute.setParameter('viewportWidth', viewportWidth);
        compute.setParameter('viewportHeight', viewportHeight);
        compute.setParameter('nearClip', cam.nearClip);
        compute.setParameter('farClip', cam.farClip);
        compute.setParameter('alphaClip', alphaClip);
        compute.setParameter('minPixelSize', minPixelSize);
        compute.setParameter('minContribution', minContribution);
        compute.setParameter('isOrtho', cam.projection === PROJECTION_ORTHOGRAPHIC ? 1 : 0);
        compute.setParameter('splatTextureSize', workBuffer.textureSize);
        compute.setParameter('numBins', GSplatSortBinWeights.NUM_BINS);
        compute.setParameter('minDist', minDist);
        compute.setParameter('invRange', invRange);
        compute.setParameter('pad0', 0);

        // 2D dispatch over the work-buffer capacity. The shader early-outs threads beyond
        // sortElementCount[0]; sizing the dispatch for the full capacity (a CPU-known
        // upper bound) avoids needing an extra indirect-args dispatch for this pass.
        const workgroupCount = Math.ceil(totalCapacity / PROJECTOR_WORKGROUP_SIZE);
        Compute.calcDispatchSize(
            workgroupCount,
            _dispatchSize,
            this.device.limits.maxComputeWorkgroupsPerDimension || 65535
        );
        compute.setupDispatch(_dispatchSize.x, _dispatchSize.y, 1);
        this.device.computeDispatch([compute], 'GSplatProjector');
    }

    /**
     * Writes per-frame indirect draw / dispatch arguments derived from `renderCounter[0]`.
     *
     * @param {number} drawSlot - Slot index in `device.indirectDrawBuffer`.
     * @param {number} sortSlotBase - Base slot index in `device.indirectDispatchBuffer`. The
     * radix sort backend uses `sortIndirectInfo[0]` consecutive slots starting here.
     * @param {StorageBuffer} numSplatsBuffer - Storage buffer the vertex shader reads for the
     * post-cull splat count (single u32 element).
     * @param {StorageBuffer} sortElementCountBuffer - Storage buffer the radix sort reads for
     * its element count (single u32 element).
     * @param {Uint32Array} sortIndirectInfo - Sorter-owned 4-element Uint32 array returned by
     * `ComputeRadixSort.prepareIndirect()`, used as a `vec4<u32>` uniform by the shader.
     */
    writeIndirectArgs(drawSlot, sortSlotBase, numSplatsBuffer, sortElementCountBuffer, sortIndirectInfo) {
        const compute = this._writeIndirectArgsCompute;

        compute.setParameter('renderCounter', this.renderCounter);
        compute.setParameter('indirectDrawArgs', this.device.indirectDrawBuffer);
        compute.setParameter('numSplatsBuf', numSplatsBuffer);
        compute.setParameter('indirectDispatchArgs', this.device.indirectDispatchBuffer);
        compute.setParameter('sortElementCountBuf', sortElementCountBuffer);

        compute.setParameter('drawSlot', drawSlot);
        compute.setParameter('indexCount', INDEX_COUNT);
        compute.setParameter('sortSlotBase', sortSlotBase);
        compute.setParameter('pad0', 0);
        compute.setParameter('sortIndirectInfo', sortIndirectInfo);

        compute.setupDispatch(1);
        this.device.computeDispatch([compute], 'GSplatProjectorWriteIndirectArgs');
    }
}

export { GSplatProjector };
