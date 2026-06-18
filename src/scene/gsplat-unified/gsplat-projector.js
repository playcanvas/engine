import { Debug, DebugHelper } from '../../core/debug.js';
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
import { Camera } from '../camera.js';
import { GSplatResourceBase } from '../gsplat/gsplat-resource-base.js';
import { GSplatSortBinWeights } from './gsplat-sort-bin-weights.js';
import { CACHE_STRIDE } from './gsplat-projector-constants.js';
import { computeGsplatProjectorSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-projector.js';
import { computeGsplatProjectorWriteIndirectArgsSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-projector-write-indirect-args.js';
import { computeGsplatProjectCommonSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-project-common.js';
import { computeGsplatCommonSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-common.js';
import { computeGsplatTileIntersectSource } from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-tile-intersect.js';
import computeSplatSource from '../shader-lib/wgsl/chunks/gsplat/vert/gsplatComputeSplat.js';
import gsplatModifyDefaultSource from '../shader-lib/wgsl/chunks/gsplat/vert/gsplatModify.js';
import gsplatHelpersSource from '../shader-lib/wgsl/chunks/gsplat/vert/gsplatHelpers.js';

/**
 * @import { GraphNode } from '../graph-node.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GSplatWorkBuffer } from './gsplat-work-buffer.js'
 */

const INDEX_COUNT = 6 * GSplatResourceBase.instanceSize;
const PROJECTOR_WORKGROUP_SIZE = 256;

// Defines owned by the projector itself - user render-stage material defines that collide with
// these are ignored when merged into the projector compute, so user customization can't clobber
// the projector's own variant/format configuration.
const PROJECTOR_INTERNAL_DEFINES = new Set([
    '{CACHE_STRIDE}', 'RADIAL_SORT', 'PICK_MODE', 'GSPLAT_FISHEYE', 'GSPLAT_AA', 'GSPLAT_COLOR_FLOAT', 'GSPLAT_XR'
]);

const _cameraDir = new Vec3();
const _dispatchSize = new Vec2();
const _viewProjMat = new Mat4();
const _viewProjData = new Float32Array(16);
const _viewProj1Data = new Float32Array(16);
const _viewData = new Float32Array(16);
const _shaderProjMat = new Mat4();

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

    /**
     * Lazily-created projector compute variants keyed by `radial|pick|fisheye|aa`
     * combination (see `_projectorKey`). AA is mutually exclusive with pick, so up to
     * 12 variants exist; only the combinations actually needed by the running app are
     * compiled.
     *
     * @type {Map<string, Compute>}
     */
    _projectorComputes = new Map();

    /** @type {BindGroupFormat|null} */
    _projectorBindGroupFormat = null;

    /**
     * Uniform buffer format for the non-fisheye projector variant.
     *
     * @type {UniformBufferFormat|null}
     */
    _projectorUniformBufferFormat = null;

    /**
     * Uniform buffer format for the fisheye projector variant. Adds 4 fisheye
     * scalar uniforms after the shared fields.
     *
     * @type {UniformBufferFormat|null}
     */
    _projectorUniformBufferFormatFisheye = null;

    /**
     * Uniform buffer format for the XR stereo projector variant. Adds the eye-1
     * view-projection matrix after the shared fields.
     *
     * @type {UniformBufferFormat|null}
     */
    _projectorUniformBufferFormatStereo = null;

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

    /**
     * Change-detection key for the render-stage customization (user `gsplatModifyVS` chunk +
     * material defines). When it changes, the compiled projector variants are rebuilt.
     *
     * @type {string}
     */
    _materialKey = '';

    /**
     * The user's WGSL `gsplatModifyVS` chunk source, or null to use the default no-op chunk.
     *
     * @type {string|null}
     */
    _userModifySource = null;

    /**
     * Generated user varying streams chunks (declarations / set functions and projection cache
     * writes), or null when no varying streams are defined.
     *
     * @type {string|null}
     */
    _userVaryingsSource = null;

    /** @type {string|null} */
    _userCacheWriteSource = null;

    /**
     * Reference to the user material's defines map (read at compute-build time), or null.
     *
     * @type {Map<string, string>|null}
     */
    _userDefines = null;

    /**
     * Number of u32 words user varying streams add to the per-splat projection cache.
     *
     * @type {number}
     */
    _userCacheWords = 0;

    /** @type {number} */
    _allocatedCacheCount = 0;

    /** @type {number} */
    _allocatedCacheStride = 0;

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
        DebugHelper.setName(this.binWeightsBuffer, 'GsplatProjector.binWeights');

        // 4 B counter, cleared every frame on the GPU via clear().
        this.renderCounter = new StorageBuffer(device, 4, BUFFERUSAGE_COPY_SRC | BUFFERUSAGE_COPY_DST);
        DebugHelper.setName(this.renderCounter, 'GsplatProjector.renderCounter');

        this._createUniformBufferFormats();
        this._createWriteIndirectArgsCompute();
    }

    destroy() {
        this.projCache?.destroy();
        this.sortKeys?.destroy();
        this.renderCounter?.destroy();
        this.binWeightsBuffer?.destroy();

        for (const compute of this._projectorComputes.values()) {
            compute.shader?.destroy();
        }
        this._projectorComputes.clear();

        this._projectorBindGroupFormat?.destroy();
        this._writeIndirectArgsCompute?.shader?.destroy();
        this._writeArgsBindGroupFormat?.destroy();

        this.projCache = null;
        this.sortKeys = null;
        this.renderCounter = null;
        this.binWeightsBuffer = null;
        this._projectorBindGroupFormat = null;
        this._projectorUniformBufferFormat = null;
        this._projectorUniformBufferFormatFisheye = null;
        this._projectorUniformBufferFormatStereo = null;
        this._writeIndirectArgsCompute = null;
        this._writeArgsBindGroupFormat = null;
        this._writeArgsUniformBufferFormat = null;
    }

    /** @private */
    _createUniformBufferFormats() {
        const device = this.device;

        // Shared base fields — order matches the WGSL ProjectorUniforms struct.
        const baseFields = [
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
            new UniformFormat('invRange', UNIFORMTYPE_FLOAT),
            new UniformFormat('foveationStrength', UNIFORMTYPE_FLOAT),
            new UniformFormat('foveationCenter', UNIFORMTYPE_FLOAT)
        ];

        this._projectorUniformBufferFormat = new UniformBufferFormat(device, baseFields);

        // Fisheye variant appends 4 fisheye scalars (matches the GSPLAT_FISHEYE
        // ifdef'd block in compute-gsplat-projector.js).
        this._projectorUniformBufferFormatFisheye = new UniformBufferFormat(device, [
            ...baseFields.map(f => new UniformFormat(f.name, f.type)),
            new UniformFormat('fisheye_k', UNIFORMTYPE_FLOAT),
            new UniformFormat('fisheye_inv_k', UNIFORMTYPE_FLOAT),
            new UniformFormat('fisheye_projMat00', UNIFORMTYPE_FLOAT),
            new UniformFormat('fisheye_projMat11', UNIFORMTYPE_FLOAT)
        ]);

        // Stereo variant appends the eye-1 view-projection matrix (matches the GSPLAT_XR
        // ifdef'd field in compute-gsplat-projector.js). Mutually exclusive with fisheye.
        this._projectorUniformBufferFormatStereo = new UniformBufferFormat(device, [
            ...baseFields.map(f => new UniformFormat(f.name, f.type)),
            new UniformFormat('viewProj1', UNIFORMTYPE_MAT4)
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
        for (const compute of this._projectorComputes.values()) {
            compute.shader?.destroy();
        }
        this._projectorComputes.clear();
        this._projectorBindGroupFormat?.destroy();
        this._projectorBindGroupFormat = null;
    }

    /**
     * Builds the cache key for a projector variant combination.
     *
     * @param {boolean} radialSort - Radial vs linear sort.
     * @param {boolean} pickMode - Pick output mode.
     * @param {boolean} fisheyeMode - Fisheye projection mode.
     * @param {boolean} antiAlias - Anti-aliasing opacity compensation mode.
     * @param {boolean} stereo - XR stereo (2-view) projection mode.
     * @returns {string} The cache key.
     * @private
     */
    _projectorKey(radialSort, pickMode, fisheyeMode, antiAlias, stereo) {
        return `${radialSort ? 'r' : 'l'}${pickMode ? 'p' : ''}${fisheyeMode ? 'f' : ''}${antiAlias ? 'a' : ''}${stereo ? 's' : ''}`;
    }

    /**
     * Builds the projector Compute (one variant per sort/pick/fisheye combination).
     *
     * @param {GSplatWorkBuffer} workBuffer - The current work buffer (provides format).
     * @param {boolean} radialSort - Whether to compile the RADIAL_SORT variant.
     * @param {boolean} pickMode - Whether to write pcId into the cache for picking.
     * @param {boolean} fisheyeMode - Whether to compile the GSPLAT_FISHEYE variant.
     * @param {boolean} antiAlias - Whether to compile the GSPLAT_AA variant (bakes the
     * anti-aliasing opacity compensation into the cached alpha).
     * @param {boolean} stereo - Whether to compile the GSPLAT_XR (2-view stereo) variant.
     * @returns {Compute} The created compute instance.
     * @private
     */
    _createProjectorCompute(workBuffer, radialSort, pickMode, fisheyeMode, antiAlias, stereo) {
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
        // splat helper functions (gsplatGetSizeFromScale / gsplatMakeSpherical) that user modify
        // chunks may call - matches the helpers available in the quad renderer's vertex path.
        cincludes.set('gsplatHelpersVS', gsplatHelpersSource);
        // render-stage modify hooks: the user's override (from app.scene.gsplat.material) or the
        // default no-op chunk. Any uniforms/textures it declares are reflected into a separate
        // bind group automatically (see compute WGSL reflection).
        cincludes.set('gsplatModifyVS', this._userModifySource ?? gsplatModifyDefaultSource);
        // user varying streams: declarations / set functions and projection cache writes
        cincludes.set('gsplatUserVaryingsCS', this._userVaryingsSource ?? '');
        cincludes.set('gsplatUserCacheWriteCS', this._userCacheWriteSource ?? '');
        cincludes.set('gsplatProjectCommonCS', computeGsplatProjectCommonSource);

        const cdefines = new Map();
        cdefines.set('{CACHE_STRIDE}', (CACHE_STRIDE + this._userCacheWords).toString());
        if (radialSort) {
            cdefines.set('RADIAL_SORT', '');
        }
        if (pickMode) {
            cdefines.set('PICK_MODE', '');
        }
        if (fisheyeMode) {
            cdefines.set('GSPLAT_FISHEYE', '');
        }
        if (antiAlias) {
            cdefines.set('GSPLAT_AA', '');
        }
        if (stereo) {
            cdefines.set('GSPLAT_XR', '');
        }

        // Format-specific defines.
        const colorStream = wbFormat.getStream('dataColor');
        if (colorStream && colorStream.format !== PIXELFORMAT_RGBA16U) {
            cdefines.set('GSPLAT_COLOR_FLOAT', '');
        }

        // merge user render-stage material defines (skipping the projector's own), so the modify
        // chunk can branch on them - mirrors GSplatQuadRenderer.copyMaterialSettings.
        if (this._userDefines) {
            this._userDefines.forEach((value, key) => {
                if (!PROJECTOR_INTERNAL_DEFINES.has(key)) {
                    cdefines.set(key, value);
                }
            });
        }

        const name = `GSplatProjector${radialSort ? 'Radial' : 'Linear'}${pickMode ? 'Pick' : ''}${fisheyeMode ? 'Fisheye' : ''}${antiAlias ? 'Aa' : ''}${stereo ? 'Stereo' : ''}`;

        const ubFormat = stereo ?
            this._projectorUniformBufferFormatStereo :
            fisheyeMode ?
                this._projectorUniformBufferFormatFisheye :
                this._projectorUniformBufferFormat;

        const shader = new Shader(device, {
            name: name,
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: computeGsplatProjectorSource,
            cincludes: cincludes,
            cdefines: cdefines,
            computeBindGroupFormat: this._projectorBindGroupFormat,
            computeUniformBufferFormats: { uniforms: ubFormat }
        });

        // Debug-only: warn if a user modify-chunk resource/uniform (reflected into the projector's
        // auto-generated bind group) collides with a projector-internal binding name - its value is
        // shadowed by the projector and won't reach the shader, so the author should rename it.
        // Engine render parameters (alphaClip etc.) are not reflected, so they don't trigger this.
        Debug.call(() => {
            const reserved = new Set();
            const bgf = this._projectorBindGroupFormat;
            bgf?.textureFormats.forEach(f => reserved.add(f.name));
            bgf?.storageBufferFormats.forEach(f => reserved.add(f.name));
            bgf?.storageTextureFormats.forEach(f => reserved.add(f.name));
            bgf?.uniformBufferFormats.forEach(f => reserved.add(f.name));
            this._projectorUniformBufferFormatFisheye?.uniforms.forEach(u => reserved.add(u.name));

            const impl = shader.impl;
            const checkName = (n) => {
                if (reserved.has(n)) {
                    Debug.errorOnce(`GSplatProjector: render-stage modify resource '${n}' collides with a projector-internal binding and is overridden by the projector. Rename it in your gsplatModifyVS chunk.`);
                }
            };
            impl.computeReflectedBindGroupFormat?.textureFormats.forEach(f => checkName(f.name));
            impl.computeReflectedBindGroupFormat?.storageBufferFormats.forEach(f => checkName(f.name));
            impl.computeReflectedBindGroupFormat?.storageTextureFormats.forEach(f => checkName(f.name));
            impl.computeReflectedUniformBufferFormat?.uniforms.forEach(u => checkName(u.name));
        });

        return new Compute(device, shader, name);
    }

    /**
     * Returns the projector Compute for the requested sort/pick/fisheye combination,
     * lazily creating it. Recreates all compute instances when the work-buffer format
     * version changes.
     *
     * @param {GSplatWorkBuffer} workBuffer - The current work buffer.
     * @param {boolean} radialSort - Whether to use the radial sort variant.
     * @param {boolean} [pickMode] - Whether to use the pick-output variant.
     * @param {boolean} [fisheyeMode] - Whether to use the fisheye projection variant.
     * @param {boolean} [antiAlias] - Whether to use the anti-aliasing variant.
     * @param {boolean} [stereo] - Whether to use the XR stereo (2-view) variant.
     * @returns {Compute} The projector compute instance.
     * @private
     */
    _getProjectorCompute(workBuffer, radialSort, pickMode = false, fisheyeMode = false, antiAlias = false, stereo = false) {
        const wbFormat = workBuffer.format;
        if (this._formatVersion !== wbFormat.extraStreamsVersion) {
            this._destroyProjectorComputes();
            this._formatVersion = wbFormat.extraStreamsVersion;
        }

        const key = this._projectorKey(radialSort, pickMode, fisheyeMode, antiAlias, stereo);
        let compute = this._projectorComputes.get(key);
        if (!compute) {
            compute = this._createProjectorCompute(workBuffer, radialSort, pickMode, fisheyeMode, antiAlias, stereo);
            this._projectorComputes.set(key, compute);
        }
        return compute;
    }

    /**
     * Syncs the render-stage customization from `app.scene.gsplat.material`: the user-overridable
     * `gsplatModifyVS` chunk and the material defines are injected into the projector compute. A
     * change is detected via the material's shader-chunks key plus its defines, and rebuilds the
     * compiled variants. Call before {@link GSplatProjector#_getProjectorCompute}.
     *
     * @param {import('../materials/shader-material.js').ShaderMaterial|undefined} material - The
     * gsplat render material (carries the user modify chunk, defines and parameters).
     * @private
     */
    _updateMaterial(material, userCacheWords = 0) {

        // Both keys are cached on the material and only recompute when its chunks / defines actually
        // change, so this stays cheap to call every frame. (definesKey covers all defines; the
        // projector's own defines are still filtered out when merged in _createProjectorCompute.)
        const chunksKey = material?.shaderChunks?.key ?? '';
        const definesKey = material?.definesKey ?? '';
        const materialKey = `${chunksKey}|${definesKey}|${userCacheWords}`;

        if (materialKey !== this._materialKey) {
            this._materialKey = materialKey;
            this._userDefines = material?.defines ?? null;
            this._userCacheWords = userCacheWords;
            const wgslChunks = material?.getShaderChunks?.(SHADERLANGUAGE_WGSL);
            this._userModifySource = wgslChunks?.get('gsplatModifyVS') ?? null;
            this._userVaryingsSource = wgslChunks?.get('gsplatUserVaryingsCS') ?? null;
            this._userCacheWriteSource = wgslChunks?.get('gsplatUserCacheWriteCS') ?? null;

            // customization changed - drop compiled variants so they rebuild with the new
            // chunk source and defines on the next _getProjectorCompute call
            this._destroyProjectorComputes();
        }
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
        const cacheStride = CACHE_STRIDE + this._userCacheWords;
        if (capacity > this._allocatedCacheCount || cacheStride !== this._allocatedCacheStride) {
            this.projCache?.destroy();
            this.sortKeys?.destroy();
            this._allocatedCacheCount = capacity;
            this._allocatedCacheStride = cacheStride;
            this.projCache = new StorageBuffer(this.device, capacity * cacheStride * 4);
            this.sortKeys = new StorageBuffer(this.device, capacity * 4, BUFFERUSAGE_COPY_SRC);
            DebugHelper.setName(this.projCache, 'GsplatProjector.projCache');
            DebugHelper.setName(this.sortKeys, 'GsplatProjector.sortKeys');
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
     * @param {number} params.foveationStrength - Foveated culling strength added to
     * `minContribution` toward the screen edges (0 disables).
     * @param {number} params.foveationCenter - Protected centre radius (NDC units) within which
     * foveated culling has no effect.
     * @param {number} params.viewportWidth - Render viewport width in pixels.
     * @param {number} params.viewportHeight - Render viewport height in pixels.
     * @param {boolean} params.flipY - Whether the active render target uses `flipY` (must match
     * {@link Renderer#setCameraUniforms}).
     * @param {boolean} [params.pickMode] - Whether to write picking IDs into the cache.
     * @param {import('../graphics/fisheye-projection.js').FisheyeProjection} [params.fisheyeProj] -
     * Fisheye projection state. When `fisheyeProj.enabled` is true the projector picks the
     * GSPLAT_FISHEYE variant and writes NDC-style clip data; otherwise the linear path runs.
     * @param {boolean} [params.antiAlias] - Whether to bake anti-aliasing opacity
     * compensation into the cached alpha. Ignored in pick mode (picking only gates on a
     * binary opacity threshold), which keeps the projector variant count down.
     * @param {boolean} [params.isStereo] - Whether to project both XR eyes in a single pass
     * (GSPLAT_XR variant). Requires `cameraNode.camera.camera.xrViews` to have 2 views.
     * Mutually exclusive with pick and fisheye.
     */
    dispatch(params) {
        const {
            workBuffer, cameraNode, compactedSplatIds, sortElementCountBuffer,
            totalCapacity, radialSort, numBits, minDist, maxDist,
            alphaClip, minPixelSize, minContribution,
            foveationStrength = 0, foveationCenter = 0.3,
            viewportWidth, viewportHeight, flipY,
            pickMode = false,
            fisheyeProj,
            antiAlias = false,
            isStereo = false,
            material,
            userCacheWords = 0
        } = params;

        const fisheyeMode = !!fisheyeProj?.enabled;

        // Stereo is XR perspective-only; never combined with pick (mono) or fisheye.
        const stereoMode = !!isStereo && !pickMode && !fisheyeMode;

        // AA only matters for the forward color path; skip it for picking to avoid
        // doubling the projector variant count.
        const aaMode = antiAlias && !pickMode;

        // sync render-stage customization (modify chunk + defines) before fetching the compute,
        // so a change rebuilds the variant with the new source/defines
        this._updateMaterial(material, userCacheWords);

        this._ensureCapacity(totalCapacity);

        // Reset the global render counter on the GPU. This is encoded into the same
        // command buffer as the dispatch, so it is correctly ordered before the projector
        // workgroups run their atomicAdds.
        this.renderCounter.clear();

        const compute = this._getProjectorCompute(workBuffer, radialSort, pickMode, fisheyeMode, aaMode, stereoMode);

        // Forward the user render-stage material parameters (uniforms/textures referenced by the
        // modify chunk, reflected into the projector's auto-generated bind group, matched by name).
        // Done BEFORE the projector sets its own parameters below, so the projector's bindings
        // always win on a name collision and can never be clobbered by a user parameter.
        if (material) {
            const srcParams = material.parameters;
            for (const name in srcParams) {
                if (srcParams.hasOwnProperty(name)) {
                    compute.setParameter(name, srcParams[name].data);
                }
            }
        }

        // Camera position / forward (camera Z basis, matching cpu-sort path).
        const cameraPos = cameraNode.getPosition();
        const cameraMat = cameraNode.getWorldTransform();
        const cameraDir = cameraMat.getZ(_cameraDir).normalize();

        const range = maxDist - minDist;
        const invRange = range > 0 ? 1.0 / range : 1.0;

        // Bin weights — same pattern as CPU-side sort key preparation.
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

        // Camera + projection uniforms.
        const cameraComponent = cameraNode.camera;
        const cam = cameraComponent.camera;
        const webgpu = this.device.isWebGPU;
        let focal;
        if (stereoMode) {
            // XR stereo: use the per-eye matrices the forward path uses (raw projViewOffMat — NO
            // applyShaderProjectionTransform). Eye 0 drives the shared covariance/depth/sort; eye 1
            // contributes only its screen position. The per-eye "off" matrices are refreshed at
            // render time by setCameraUniforms, which runs AFTER this dispatch, so refresh them here.
            const views = cam.xrViews;
            cam.updateViewTransforms();
            _viewProjData.set(views[0].projViewOffMat.data);
            _viewProj1Data.set(views[1].projViewOffMat.data);
            _viewData.set(views[0].viewOffMat.data);
            // raw eye-0 projection x-scale; both eyes share it in standard stereo.
            focal = viewportWidth * views[0].projMat.data[0];
        } else {
            const view = cam.viewMatrix;
            _viewProjMat.mul2(Camera.applyShaderProjectionTransform(cam.projectionMatrix, _shaderProjMat, flipY, webgpu), view);
            _viewProjData.set(_viewProjMat.data);
            _viewData.set(view.data);
            focal = viewportWidth * _shaderProjMat.data[0];
        }

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
        if (stereoMode) {
            compute.setParameter('viewProj1', _viewProj1Data);
        }

        compute.setParameter('focal', focal);
        compute.setParameter('viewportWidth', viewportWidth);
        compute.setParameter('viewportHeight', viewportHeight);
        compute.setParameter('nearClip', cam.nearClip);
        compute.setParameter('farClip', cam.farClip);
        compute.setParameter('alphaClip', alphaClip);
        compute.setParameter('minPixelSize', minPixelSize);
        compute.setParameter('minContribution', minContribution);
        compute.setParameter('foveationStrength', foveationStrength);
        compute.setParameter('foveationCenter', foveationCenter);
        compute.setParameter('isOrtho', cam.projection === PROJECTION_ORTHOGRAPHIC ? 1 : 0);
        compute.setParameter('splatTextureSize', workBuffer.textureSize);
        compute.setParameter('numBins', GSplatSortBinWeights.NUM_BINS);
        compute.setParameter('minDist', minDist);
        compute.setParameter('invRange', invRange);
        compute.setParameter('pad0', 0);

        if (fisheyeMode) {
            compute.setParameter('fisheye_k', fisheyeProj.k);
            compute.setParameter('fisheye_inv_k', fisheyeProj.invK);
            compute.setParameter('fisheye_projMat00', fisheyeProj.projMat00);
            compute.setParameter('fisheye_projMat11', fisheyeProj.projMat11);
        }

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
