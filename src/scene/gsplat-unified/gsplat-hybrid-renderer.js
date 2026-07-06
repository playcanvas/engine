import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Debug } from '../../core/debug.js';
import { SEMANTIC_POSITION, CULLFACE_NONE } from '../../platform/graphics/constants.js';
import {
    BLEND_NONE, BLEND_PREMULTIPLIED, BLEND_ADDITIVE, GSPLAT_FORWARD,
    SHADOWCAMERA_NAME
} from '../constants.js';
import { ShaderMaterial } from '../materials/shader-material.js';
import { GSplatResourceBase } from '../gsplat/gsplat-resource-base.js';
import { MeshInstance } from '../mesh-instance.js';
import { GSplatRenderer } from './gsplat-renderer.js';
import { GSplatProjector } from './gsplat-projector.js';
import { GSplatIntervalCompaction } from './gsplat-interval-compaction.js';
import { ComputeRadixSort } from '../graphics/radix-sort/compute-radix-sort.js';
import { CACHE_STRIDE } from './gsplat-projector-constants.js';
import { ALPHA_VISIBILITY_THRESHOLD } from './constants.js';
import { Camera } from '../camera.js';

// Module-scope scratch matrices used only inside `_computeClipToViewZ`. The output
// (`Float32Array`) lives on each renderer instance because it must remain valid
// until the GPU upload happens at draw time, and multiple renderer instances may
// render concurrently with different cameras.
const _invProjMat = new Mat4();
const _shaderProjMat = new Mat4();

// Module-scope scratch used only inside `computeDistanceRange` (camera world position/direction
// and a transformed AABB corner). Reused synchronously within a single call.
const _camPos = new Vec3();
const _camDir = new Vec3();
const _tmpV = new Vec3();

/**
 * @import { StorageBuffer } from '../../platform/graphics/storage-buffer.js'
 * @import { GraphNode } from '../graph-node.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Layer } from '../layer.js'
 * @import { GSplatWorkBuffer } from './gsplat-work-buffer.js'
 * @import { GSplatWorld } from './gsplat-world.js'
 * @import { GSplatWorldState } from './gsplat-world-state.js'
 * @import { GSplatRenderViewParams } from './gsplat-renderer.js'
 */

/**
 * Renders splats from a pre-projected cache built by the projector compute pass
 * (see {@link GSplatProjector}) and a globally radix-sorted index array. The
 * vertex shader is `gsplatHybridVS`; the fragment is the existing `gsplatPS`.
 *
 * Supports forward rendering and explicit pick/prepass paths. Shadow rendering is
 * intentionally not supported because the projection cache is camera-specific.
 *
 * @ignore
 */
class GSplatHybridRenderer extends GSplatRenderer {
    /** @type {ShaderMaterial} */
    _material;

    /** @type {MeshInstance} */
    meshInstance;

    /** @type {ShaderMaterial|null} */
    _pickMaterial = null;

    /** @type {MeshInstance|null} */
    _pickMeshInstance = null;

    /**
     * Per-camera `clipToViewZ` value for the forward material. Persistent: the GPU
     * upload happens at draw time, so the buffer must outlive `setHybridSortedRendering`.
     *
     * @type {Float32Array}
     */
    _clipToViewZ = new Float32Array(4);

    /**
     * Per-camera `clipToViewZ` value for the pick material. Allocated on first
     * `prepareForPicking` call and reused thereafter.
     *
     * @type {Float32Array|null}
     */
    _clipToViewZPick = null;

    /** @type {number} */
    originalBlendType = BLEND_ADDITIVE;

    /** @type {Set<string>} */
    _internalDefines = new Set();

    /** @type {boolean} */
    forceCopyMaterial = true;

    /** @type {string} */
    _lastSourceChunksKey = '';

    /**
     * The projection cache stride in u32 words: the base layout plus user varying stream words.
     *
     * @type {number}
     */
    _cacheStride = CACHE_STRIDE;

    /**
     * GPU radix sorter for the projected cache indices.
     *
     * @type {ComputeRadixSort|null}
     */
    gpuSorter = null;

    /**
     * Compute projector that builds the per-camera projection cache + sort keys.
     *
     * @type {GSplatProjector|null}
     */
    projector = null;

    /**
     * Interval-based GPU culling + compaction (lazily created on first sort).
     *
     * @type {GSplatIntervalCompaction|null}
     */
    intervalCompaction = null;

    /**
     * Manager-owned shared scratch injected at construction; forwarded to the interval compaction so
     * its compacted index list is shared with the directional-shadow cull. Null when not provided.
     *
     * @type {import('./gsplat-hybrid-renderer-scratch.js').GSplatHybridRendererScratch|null}
     * @private
     */
    _scratch = null;

    /**
     * Per-frame indirect draw slot index (-1 when unallocated).
     *
     * @type {number}
     */
    indirectDrawSlot = -1;

    /**
     * Per-frame indirect dispatch slot index (projector + radix sort passes).
     *
     * @type {number}
     */
    indirectDispatchSlot = -1;

    /**
     * Total intervals from the last interval-compaction dispatch (index into the prefix sum
     * for the visible count).
     *
     * @type {number}
     */
    lastCompactedNumIntervals = 0;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GraphNode} node - The graph node.
     * @param {GraphNode} cameraNode - The camera node.
     * @param {Layer} layer - The layer to add mesh instances to.
     * @param {GSplatWorkBuffer} workBuffer - The work buffer (kept for parent compatibility;
     * the hybrid renderer does not bind work-buffer textures itself).
     * @param {import('./gsplat-hybrid-renderer-scratch.js').GSplatHybridRendererScratch|null} [scratch] -
     * Manager-owned shared scratch; forwarded to the interval compaction (shared with the shadow cull).
     */
    constructor(device, node, cameraNode, layer, workBuffer, scratch = null) {
        super(device, node, cameraNode, layer, workBuffer);

        this._scratch = scratch;

        this._material = new ShaderMaterial({
            uniqueName: 'UnifiedSplatHybridMaterial',
            vertexWGSL: '#include "gsplatHybridVS"',
            fragmentWGSL: '#include "gsplatPS"',
            attributes: {
                vertex_position: SEMANTIC_POSITION
            }
        });

        this._material.setDefine('{GSPLAT_INSTANCE_SIZE}', GSplatResourceBase.instanceSize);
        this._material.setDefine('{CACHE_STRIDE}', CACHE_STRIDE);

        this.configureMaterial();

        this._material.defines.forEach((value, key) => {
            this._internalDefines.add(key);
        });

        // Defines that may be added dynamically; preserve them when copying user material.
        this._internalDefines.add('{GSPLAT_INSTANCE_SIZE}');
        this._internalDefines.add('{CACHE_STRIDE}');
        this._internalDefines.add('GSPLAT_UNIFIED_ID');
        this._internalDefines.add('PICK_CUSTOM_ID');
        this._internalDefines.add('GSPLAT_OVERDRAW');
        this._internalDefines.add('GSPLAT_NO_FOG');
        this._internalDefines.add('GSPLAT_XR');

        // GPU sort pipeline resources (gpuSorter, projector, intervalCompaction) are created lazily
        // on the first forward sort (see _ensureGpuPipeline). A hybrid renderer that only exists to
        // satisfy a shadow-casting manager (no forward pass) never allocates them.
        this.meshInstance = this.createMeshInstance();
    }

    /**
     * Sets the render mode. The hybrid path does not add shadow casters; shadow cameras
     * need their own projection cache and remain unsupported here.
     *
     * @param {number} renderMode - Bitmask flags controlling render passes.
     */
    setRenderMode(renderMode) {
        const oldRenderMode = this.renderMode ?? 0;
        const wasForward = (oldRenderMode & GSPLAT_FORWARD) !== 0;
        const isForward = (renderMode & GSPLAT_FORWARD) !== 0;

        if (wasForward && !isForward) {
            this.layer.removeMeshInstances([this.meshInstance], true);
        }
        if (!wasForward && isForward) {
            this.layer.addMeshInstances([this.meshInstance], true);
        }

        super.setRenderMode(renderMode);
    }

    destroy() {
        if (this.renderMode && (this.renderMode & GSPLAT_FORWARD)) {
            this.layer.removeMeshInstances([this.meshInstance], true);
        }
        this.gpuSorter?.destroy();
        this.gpuSorter = null;
        this.projector?.destroy();
        this.projector = null;
        this.intervalCompaction?.destroy();
        this.intervalCompaction = null;
        this._material.destroy();
        this._pickMaterial?.destroy();
        this.meshInstance.destroy();
        this._pickMeshInstance?.destroy();
        super.destroy();
    }

    get material() {
        return this._material;
    }

    get usesGpuSort() {
        return true;
    }

    get requiresBounds() {
        return true;
    }

    onWorkBufferFormatChanged() {
        this.configureMaterial();
    }

    configureMaterial() {
        this._material.setDefine('SH_BANDS', '0');
        this._material.setDefine('GSPLAT_INDIRECT_DRAW', true);
        this._updateIdDefines(this._material);

        const dither = false;
        this._material.setDefine(`DITHER_${dither ? 'BLUENOISE' : 'NONE'}`, '');
        this._material.cull = CULLFACE_NONE;
        this._material.blendType = dither ? BLEND_NONE : BLEND_PREMULTIPLIED;
        this._material.depthWrite = !!dither;
        this._material.update();
    }

    /**
     * Toggles the XR stereo (GSPLAT_XR) variant of the forward material. The vertex shader then
     * reads the per-eye stereo projection-cache layout and selects the eye via `view_index`. Only
     * recompiles when the stereo state changes, so it is cheap to call every frame. Must stay in
     * sync with the projector's stereo variant (both driven by the same isStereo value).
     *
     * @param {boolean} enabled - Whether stereo (2-view) rendering is active.
     */
    setStereo(enabled) {
        // The material is the single source of truth; only recompile when the state actually changes.
        if (this._material.getDefine('GSPLAT_XR') !== enabled) {
            this._material.setDefine('GSPLAT_XR', enabled);
            this._material.update();
        }
    }

    update(count, textureSize) {
        // Indirect-draw path; the GPU-written instance count drives instancing. We just
        // need a non-zero instancingCount so the forward renderer issues the draw call.
        if (this.meshInstance.instancingCount <= 0) {
            this.meshInstance.instancingCount = 1;
        }
        this.meshInstance.visible = count > 0;
    }

    invalidateCullUpload() {
        this.intervalCompaction?.invalidateUpload();
    }

    /**
     * Lazily creates the GPU sort pipeline resources on first forward use. Kept out of the
     * constructor so a hybrid renderer that never renders a forward pass (e.g. one owned by a
     * shadow-only manager) allocates none of them.
     *
     * @private
     */
    _ensureGpuPipeline() {
        if (!this.gpuSorter) this.gpuSorter = new ComputeRadixSort(this.device, { indirect: true });
        if (!this.projector) this.projector = new GSplatProjector(this.device);
        if (!this.intervalCompaction) this.intervalCompaction = new GSplatIntervalCompaction(this.device, this._scratch);
    }

    /**
     * Per-frame forward render preparation: derives the viewport (handling stereo XR), runs the
     * cull + projector + radix sort for the current camera, and binds the result for indirect
     * drawing. Runs every frame — the indirect args are per-frame and the post-projector visible
     * count differs from the interval prefix sum.
     *
     * @param {GSplatWorld} world - The world providing the work buffer, bounds and states.
     * @param {GSplatWorldState} worldState - The render-ready world state to draw.
     * @param {GSplatRenderViewParams} params - Per-call params + camera (see GSplatManager#_fillRenderViewParams).
     * @returns {boolean} True if a GPU dispatch ran (false when there are no active splats).
     */
    prepareRenderView(world, worldState, params) {
        const cameraNode = params.cameraNode;
        const cam = cameraNode.camera;
        const sceneCam = cam.camera;
        const rt = cam.renderTarget;
        const rect = cam.rect;

        // Match Renderer#setCameraUniforms: in stereo XR the XR session reports the per-eye
        // viewport directly, which is correct for both side-by-side single-texture and
        // multi-pass per-eye-view layouts — preferred over inferring from target.width.
        const xrView = sceneCam.xrActive ? (sceneCam.xrViews[0] ?? null) : null;
        const viewportWidth = Math.floor((xrView ? xrView.viewport.z : (rt ? rt.width : this.device.width)) * rect.z);
        const viewportHeight = Math.floor((xrView ? xrView.viewport.w : (rt ? rt.height : this.device.height)) * rect.w);

        // Stereo XR: project both eyes in a single projector pass (GSPLAT_XR variant). Requires
        // exactly 2 parallel-axis views. Keep the VS define in sync with the projector variant.
        const xrViewCount = sceneCam.xrActive ? sceneCam.xrViews.length : 0;
        if (xrViewCount > 2) {
            Debug.errorOnce(`GSplatHybridRenderer: the hybrid GPU-sort renderer supports at most 2 XR views (stereo), but the session has ${xrViewCount}. Additional views will not render correctly.`);
        }
        const isStereo = xrViewCount === 2;
        this.setStereo(isStereo);

        const sortedIndices = this.sortAndProjectForCamera(
            world, worldState, cameraNode, viewportWidth, viewportHeight,
            Math.max(ALPHA_VISIBILITY_THRESHOLD, params.alphaClipForward), false, isStereo, params
        );

        if (!sortedIndices) return false;

        this.setHybridSortedRendering(
            this.indirectDrawSlot,
            sortedIndices,
            /** @type {StorageBuffer} */ (this.projector.projCache),
            /** @type {StorageBuffer} */ (this.intervalCompaction.numSplatsBuffer)
        );
        return true;
    }

    /**
     * Picker render preparation: runs the cull + projector + radix sort for the picker camera
     * (pick mode, mono) and returns the configured pick mesh instance.
     *
     * @param {GSplatWorld} world - The world providing the work buffer, bounds and states.
     * @param {GSplatWorldState} worldState - The render-ready world state.
     * @param {GSplatRenderViewParams} pickParams - Per-call params + picker camera (see GSplatManager#_fillPickParams).
     * @returns {MeshInstance|null} The pick mesh instance, or null if nothing was dispatched.
     */
    preparePickingView(world, worldState, pickParams) {
        // pickMode writes pcId into the cache only when the work buffer actually carries that stream.
        const pickMode = !!world.workBuffer.format.getStream('pcId');
        const sortedIndices = this.sortAndProjectForCamera(
            world, worldState, pickParams.cameraNode, pickParams.width, pickParams.height,
            Math.max(ALPHA_VISIBILITY_THRESHOLD, pickParams.alphaClip), pickMode, false, pickParams
        );
        if (!sortedIndices) return null;

        return this.prepareForPicking(
            this.indirectDrawSlot,
            sortedIndices,
            /** @type {StorageBuffer} */ (this.projector.projCache),
            /** @type {StorageBuffer} */ (this.intervalCompaction.numSplatsBuffer),
            pickParams.alphaClip,
            pickParams.alphaClipForward,
            pickParams.cameraNode
        );
    }

    /**
     * Runs interval cull + compaction, the projector, and the indirect radix sort for a specific
     * camera/view. Shared by the forward render and the picker. Assumes the work buffer is baked and
     * render-ready (the manager's version lifecycle marks it before delegating).
     *
     * @param {GSplatWorld} world - The world providing the work buffer, bounds and states.
     * @param {GSplatWorldState} worldState - The world state to sort.
     * @param {GraphNode} cameraNode - Camera node used for projection and sort keys.
     * @param {number} viewportWidth - Projection viewport width in pixels.
     * @param {number} viewportHeight - Projection viewport height in pixels.
     * @param {number} alphaClip - Projector producer alpha threshold.
     * @param {boolean} pickMode - Whether the projector writes pcId into the cache.
     * @param {boolean} isStereo - Whether to project both XR eyes in one pass (forward only).
     * @param {GSplatRenderViewParams} params - Per-call gsplat params.
     * @returns {StorageBuffer|null} The sorted cache indices, or null if no work was dispatched.
     * @private
     */
    sortAndProjectForCamera(world, worldState, cameraNode, viewportWidth, viewportHeight, alphaClip, pickMode, isStereo, params) {
        const elementCount = worldState.totalActiveSplats;
        if (elementCount === 0) return null;

        this._ensureGpuPipeline();
        const gpuSorter = /** @type {ComputeRadixSort} */ (this.gpuSorter);
        const projector = /** @type {GSplatProjector} */ (this.projector);

        this.intervalCompaction.uploadIntervals(worldState);

        if (world.hasBounds) {
            const state = world.getState(world.currentVersion);
            if (state) {
                this._runFrustumCulling(world, state, cameraNode, params);
            }
        }

        const fisheyeProj = this.fisheyeProj;
        const numIntervals = worldState.totalIntervals;
        const totalActiveSplats = worldState.totalActiveSplats;
        this.intervalCompaction.dispatchCompact(world.workBuffer.frustumCuller, numIntervals, totalActiveSplats, fisheyeProj.enabled);

        this.allocateAndWriteIntervalIndirectArgs(numIntervals);

        const ic = /** @type {GSplatIntervalCompaction} */ (this.intervalCompaction);
        const compactedSplatIds = ic.compactedSplatIds;

        const numBits = Math.max(10, Math.min(20, Math.round(Math.log2(elementCount / 4))));
        const radixBits = gpuSorter.radixBits;
        const roundedNumBits = Math.ceil(numBits / radixBits) * radixBits;

        const { minDist, maxDist } = this.computeDistanceRange(worldState, cameraNode, params.radialSorting);

        const sortIndirectInfo = gpuSorter.prepareIndirect();

        projector.dispatch({
            workBuffer: world.workBuffer,
            cameraNode,
            compactedSplatIds: /** @type {StorageBuffer} */ (compactedSplatIds),
            sortElementCountBuffer: /** @type {StorageBuffer} */ (ic.sortElementCountBuffer),
            totalCapacity: elementCount,
            radialSort: params.radialSorting,
            numBits: roundedNumBits,
            minDist,
            maxDist,
            alphaClip,
            minPixelSize: params.minPixelSize * 0.5,
            minContribution: params.minContribution,
            foveationStrength: params.foveationStrength,
            foveationCenter: params.foveationCenter,
            viewportWidth,
            viewportHeight,
            flipY: !!cameraNode.camera.renderTarget?.flipY,
            pickMode,
            fisheyeProj,
            antiAlias: params.antiAlias,
            isStereo,
            material: params.material,
            userCacheWords: params.varyings.words
        });

        projector.writeIndirectArgs(
            this.indirectDrawSlot,
            this.indirectDispatchSlot + 1,
            /** @type {StorageBuffer} */ (ic.numSplatsBuffer),
            /** @type {StorageBuffer} */ (ic.sortElementCountBuffer),
            sortIndirectInfo
        );

        // Workaround for a device hang on Windows/NVIDIA (Dawn/D3D12): in the picking path, the
        // sort's indirect dispatch args written above (by the interval compaction and projector
        // writeIndirectArgs compute passes) are intermittently not visible to the
        // dispatchWorkgroupsIndirect calls recorded in the same command buffer — the sort then
        // runs with the previous frame's (larger) workgroup counts, and OneSweep's chained
        // lookback spins forever on partitions that never publish, hanging the device
        // (DXGI_ERROR_DEVICE_HUNG). Submitting pending work here places the args writes and the
        // sort dispatches in separate submissions, which reliably avoids the stale read. Scoped
        // to picking: the per-frame forward path has never exhibited the issue, and this keeps
        // its work in a single submission.
        if (pickMode) {
            this.device.submit();
        }

        return gpuSorter.sortIndirect(
            /** @type {StorageBuffer} */ (projector.sortKeys),
            elementCount,
            roundedNumBits,
            this.indirectDispatchSlot + 1,
            /** @type {StorageBuffer} */ (ic.sortElementCountBuffer),
            undefined,
            false,
            true  // destructiveKeys: projector overwrites sortKeys each frame before the sort
        );
    }

    /**
     * Allocates per-frame indirect draw and dispatch slots and writes the interval-compaction
     * indirect args.
     *
     * @param {number} numIntervals - Total interval count (index into prefix sum for visible count).
     * @private
     */
    allocateAndWriteIntervalIndirectArgs(numIntervals) {
        const gpuSorter = /** @type {ComputeRadixSort} */ (this.gpuSorter);
        const sortInfo = gpuSorter.prepareIndirect();
        const sortSlotCount = sortInfo[0];

        this.indirectDrawSlot = this.device.getIndirectDrawSlot(1);
        // Reserve contiguous dispatch slots for the projector + radix sort passes.
        this.indirectDispatchSlot = this.device.getIndirectDispatchSlot(1 + sortSlotCount);
        const ic = /** @type {GSplatIntervalCompaction} */ (this.intervalCompaction);
        ic.writeIndirectArgs(this.indirectDrawSlot, this.indirectDispatchSlot, numIntervals, sortInfo);
        this.lastCompactedNumIntervals = numIntervals;
    }

    /**
     * Prepares frustum culling data: updates the GPU transform buffers and computes frustum planes
     * from the camera. The actual culling test runs inline in the interval compaction compute shader.
     *
     * @param {object} world - The {@link GSplatWorld} owning the frustum culler.
     * @param {object} worldState - The world state whose splats provide transforms.
     * @param {GraphNode} cameraNode - Camera node to cull against.
     * @param {object} params - Per-call gsplat params (for fisheye).
     * @private
     */
    _runFrustumCulling(world, worldState, cameraNode, params) {
        world.workBuffer.frustumCuller.updateTransformsData(worldState.boundsGroups);

        const cam = cameraNode.camera;
        const sceneCamera = cam.camera;
        const xrViews = sceneCamera.xrViews;
        if (xrViews?.length) {
            // XR: cull against the combined frustum of all views, so splats visible only near
            // one eye's edge (e.g. the right edge of the right eye) are not dropped. The per-view
            // "off" matrices are refreshed at render time by setCameraUniforms, which runs AFTER
            // this culling, so refresh them here (mirrors the projector dispatch).
            sceneCamera.updateViewTransforms();
            sceneCamera.updateXrFrustum();
            world.workBuffer.frustumCuller.setFrustumPlanes(sceneCamera.frustum);
        } else {
            world.workBuffer.frustumCuller.computeFrustumPlanes(cam.projectionMatrix, cam.viewMatrix);
        }

        const fp = this.fisheyeProj;
        // XR does not support fisheye in any renderer; resolveFisheye forces it off (and warns once).
        fp.update(this.resolveFisheye(params.fisheye), cam.fov, cam.projectionMatrix);

        if (fp.enabled) {
            world.workBuffer.frustumCuller.setFisheyeData(
                cameraNode.getPosition(),
                cameraNode.forward,
                fp.maxTheta
            );
        }
    }

    /**
     * Computes the min/max effective distances for the current world state (radial or linear).
     *
     * @param {object} worldState - The world state.
     * @param {GraphNode} cameraNode - Camera node to measure distances from.
     * @param {boolean} radialSort - Whether radial sorting is enabled.
     * @returns {{minDist: number, maxDist: number}} The distance range.
     * @private
     */
    computeDistanceRange(worldState, cameraNode, radialSort) {
        const cameraMat = cameraNode.getWorldTransform();
        cameraMat.getTranslation(_camPos);
        cameraMat.getZ(_camDir).normalize();

        // For radial: minDist is always 0, only track maxDist. For linear: track both along the
        // camera direction.
        let minDist = radialSort ? 0 : Infinity;
        let maxDist = radialSort ? 0 : -Infinity;

        for (const splat of worldState.splats) {
            const modelMat = splat.node.getWorldTransform();
            const aabbMin = splat.aabb.getMin();
            const aabbMax = splat.aabb.getMax();

            // Check all 8 corners of the local-space AABB
            for (let i = 0; i < 8; i++) {
                _tmpV.x = (i & 1) ? aabbMax.x : aabbMin.x;
                _tmpV.y = (i & 2) ? aabbMax.y : aabbMin.y;
                _tmpV.z = (i & 4) ? aabbMax.z : aabbMin.z;

                modelMat.transformPoint(_tmpV, _tmpV);

                if (radialSort) {
                    const dist = _tmpV.distance(_camPos);
                    if (dist > maxDist) maxDist = dist;
                } else {
                    const dist = _tmpV.sub(_camPos).dot(_camDir);
                    if (dist < minDist) minDist = dist;
                    if (dist > maxDist) maxDist = dist;
                }
            }
        }

        // Handle empty state
        if (maxDist === 0 || maxDist === -Infinity) {
            return { minDist: 0, maxDist: 1 };
        }

        return { minDist, maxDist };
    }

    /**
     * Configures the renderer to draw from the projector's caches.
     *
     * @param {number} drawSlot - The indirect draw slot index.
     * @param {StorageBuffer} sortedIndices - Globally-sorted indices into projCache.
     * @param {StorageBuffer} projCache - Per-splat projection cache produced by the projector.
     * @param {StorageBuffer} numSplatsBuffer - GPU-written visible-splat count.
     */
    setHybridSortedRendering(drawSlot, sortedIndices, projCache, numSplatsBuffer) {
        this.meshInstance.setIndirect(null, drawSlot, 1);

        this._material.setParameter('sortedIndices', sortedIndices);
        this._material.setParameter('projCache', projCache);
        this._material.setParameter('numSplatsStorage', numSplatsBuffer);
        this._computeClipToViewZ(this.cameraNode, this._clipToViewZ);
        this._material.setParameter('clipToViewZ', this._clipToViewZ);

        this.meshInstance.visible = true;

        if (this.meshInstance.instancingCount <= 0) {
            this.meshInstance.instancingCount = 1;
        }
    }

    /**
     * Configures and returns a transient pick mesh instance for the picker render pass.
     *
     * @param {number} drawSlot - The indirect draw slot index.
     * @param {StorageBuffer} sortedIndices - Globally-sorted indices into projCache.
     * @param {StorageBuffer} projCache - Per-splat projection cache produced by the projector.
     * @param {StorageBuffer} numSplatsBuffer - GPU-written visible-splat count.
     * @param {number} alphaClip - Fragment alpha threshold for picking.
     * @param {number} alphaClipForward - Forward alpha floor (must match {@link GSplatRenderer#frameUpdate}).
     * @param {GraphNode} cameraNode - The picker camera node, used to derive the
     * `clipToViewZ` reconstruction uniform.
     * @returns {MeshInstance} The pick mesh instance.
     */
    prepareForPicking(drawSlot, sortedIndices, projCache, numSplatsBuffer, alphaClip, alphaClipForward, cameraNode) {
        if (!this._pickMaterial) {
            this._pickMaterial = new ShaderMaterial({
                uniqueName: 'UnifiedSplatHybridPickMaterial',
                vertexWGSL: '#include "gsplatHybridVS"',
                fragmentWGSL: '#include "gsplatPS"',
                attributes: {
                    vertex_position: SEMANTIC_POSITION
                }
            });

            this._pickMaterial.setDefine('{GSPLAT_INSTANCE_SIZE}', GSplatResourceBase.instanceSize);
            this._pickMaterial.setDefine('{CACHE_STRIDE}', this._cacheStride);
            this._pickMaterial.setDefine('SH_BANDS', '0');
            this._pickMaterial.setDefine('GSPLAT_INDIRECT_DRAW', true);
            this._pickMaterial.setDefine('DITHER_NONE', '');
            this._updateIdDefines(this._pickMaterial);
            this._pickMaterial.cull = CULLFACE_NONE;
            this._pickMaterial.blendType = BLEND_NONE;
            this._pickMaterial.depthWrite = false;
            this._pickMaterial.update();

            const mesh = GSplatResourceBase.createMesh(this.device);
            this._pickMeshInstance = new MeshInstance(mesh, this._pickMaterial);
            this._pickMeshInstance.node = this.node;
            this._pickMeshInstance.setInstancing(true, true);
            this._pickMeshInstance.instancingCount = 1;
        } else {
            if (this._updateIdDefines(this._pickMaterial)) {
                this._pickMaterial.update();
            }
        }

        const pickMaterial = /** @type {ShaderMaterial} */ (this._pickMaterial);
        const pickMeshInstance = /** @type {MeshInstance} */ (this._pickMeshInstance);

        pickMeshInstance.setIndirect(null, drawSlot, 1);
        pickMaterial.setParameter('sortedIndices', sortedIndices);
        pickMaterial.setParameter('projCache', projCache);
        pickMaterial.setParameter('numSplatsStorage', numSplatsBuffer);
        pickMaterial.setParameter('alphaClip', alphaClip);
        pickMaterial.setParameter('alphaClipForward', alphaClipForward);
        this._clipToViewZPick ??= new Float32Array(4);
        this._computeClipToViewZ(cameraNode, this._clipToViewZPick);
        pickMaterial.setParameter('clipToViewZ', this._clipToViewZPick);

        return pickMeshInstance;
    }

    /**
     * Computes the per-camera `clipToViewZ` value into `dst`. The hybrid VS dot-products
     * this with the cached `clipPos` to recover linear view depth, used by fog / overdraw
     * / prepass.
     *
     * - Perspective + orthographic: `dst = -inverse(matrix_projection)[row 2]`. The
     *   projector stores `clipPos.w` in slot [3] and the dot-product yields `-view.z`.
     * - Fisheye: `dst = (0, 0, far - near, near)`. The projector stores depthNdc in
     *   slot [2] and `1.0` in slot [3], so the dot-product reduces to
     *   `depthNdc * (far - near) + near`, which equals linear `-view.z`.
     *
     * The destination buffer must be retained by the caller (typically a per-material
     * instance field) because the GPU upload happens at draw time.
     *
     * @param {GraphNode} cameraNode - Camera node to derive the uniform from.
     * @param {Float32Array} dst - 4-element destination, written in place.
     * @private
     */
    _computeClipToViewZ(cameraNode, dst) {
        const camComp = cameraNode.camera;
        const cam = camComp.camera;
        if (this.fisheyeProj.enabled) {
            const near = cam.nearClip;
            const far = cam.farClip;
            dst[0] = 0;
            dst[1] = 0;
            dst[2] = far - near;
            dst[3] = near;
            return;
        }
        const flipY = !!camComp.renderTarget?.flipY;
        _invProjMat.copy(Camera.applyShaderProjectionTransform(cam.projectionMatrix, _shaderProjMat, flipY, this.device.isWebGPU)).invert();
        const d = _invProjMat.data;
        dst[0] = -d[2];
        dst[1] = -d[6];
        dst[2] = -d[10];
        dst[3] = -d[14];
    }

    /**
     * The hybrid path is GPU-driven only; CPU-sort is handled by the quad renderer
     * (the manager swaps renderers when the active mode changes).
     */
    setCpuSortedRendering() {
        this.meshInstance.setIndirect(null, -1);
        this.meshInstance.visible = false;
    }

    setOrderData() {
        // No-op: order is consumed via sortedIndices storage buffer set in
        // setHybridSortedRendering; nothing to bind from the work buffer.
    }

    frameUpdate(params) {
        this._material.setParameter('alphaClip', params.alphaClip);
        this._material.setParameter('alphaClipForward', params.alphaClipForward);
        this._pickMaterial?.setParameter('alphaClip', params.alphaClip);
        this._pickMaterial?.setParameter('alphaClipForward', params.alphaClipForward);

        if (params.colorRamp) {
            this._material.setParameter('colorRampIntensity', params.colorRampIntensity);
        }

        const noFog = !params.useFog;
        if (noFog !== this._lastNoFog) {
            this._lastNoFog = noFog;
            this._material.setDefine('GSPLAT_NO_FOG', noFog);
            this._material.update();
        }

        // keep the projection cache stride in sync with the user varying streams
        const cacheStride = CACHE_STRIDE + params.varyings.words;
        if (cacheStride !== this._cacheStride) {
            this._cacheStride = cacheStride;
            this._material.setDefine('{CACHE_STRIDE}', cacheStride);
            this._material.update();
            if (this._pickMaterial) {
                this._pickMaterial.setDefine('{CACHE_STRIDE}', cacheStride);
                this._pickMaterial.update();
            }
        }

        // Copy material settings from params.material if dirty or on first update
        if (this.forceCopyMaterial || params.material.dirty) {
            this.copyMaterialSettings(params.material);
            this.forceCopyMaterial = false;
        }
    }

    /**
     * Copies material settings from a source material to the internal material.
     * Preserves internal defines while copying user defines, parameters, and shader chunks.
     * This delivers user customizations (e.g. the `gsplatModifyPS` fragment chunk and its
     * parameters) set on `app.scene.gsplat.material` to the hybrid render material. Note that
     * the `gsplatModifyVS` chunk is handled by the projector compute instead, and even when
     * copied here it is not referenced by the hybrid vertex shader.
     *
     * @param {ShaderMaterial} sourceMaterial - The source material to copy settings from.
     * @private
     */
    copyMaterialSettings(sourceMaterial) {
        // Sync defines via setDefine so _definesDirty tracks real changes. Only delete keys the
        // source no longer has (and that aren't internal). Deleting all user defines and re-adding
        // them every frame would force _definesDirty true forever and trigger clearVariants on
        // every frame.
        const keysToDelete = [];
        this._material.defines.forEach((value, key) => {
            if (!this._internalDefines.has(key) && !sourceMaterial.defines.has(key)) {
                keysToDelete.push(key);
            }
        });
        keysToDelete.forEach(key => this._material.setDefine(key, undefined));

        // Add/update defines from the source. setDefine is conditional — it only flips
        // _definesDirty when the value actually changed, so unchanged entries stay cheap.
        sourceMaterial.defines.forEach((value, key) => {
            this._material.setDefine(key, value);
        });

        // Copy parameters
        const srcParams = sourceMaterial.parameters;
        for (const paramName in srcParams) {
            if (srcParams.hasOwnProperty(paramName)) {
                this._material.setParameter(paramName, srcParams[paramName].data);
            }
        }

        // Copy shader chunks only when they actually changed on the source (chunks.key is a
        // stable content hash), to avoid marking chunks dirty every frame and forcing a
        // per-frame clearVariants.
        if (sourceMaterial.hasShaderChunks) {
            const sourceChunksKey = sourceMaterial.shaderChunks.key;
            if (sourceChunksKey !== this._lastSourceChunksKey) {
                this._material.shaderChunks.copy(sourceMaterial.shaderChunks);
                this._lastSourceChunksKey = sourceChunksKey;
            }
        }

        this._material.update();
    }

    /**
     * Updates pick ID defines to match the work-buffer format.
     *
     * @param {ShaderMaterial} material - Material to update.
     * @returns {boolean} True if the material defines changed.
     * @private
     */
    _updateIdDefines(material) {
        const hasPcId = !!this.workBuffer.format.getStream('pcId');
        const changed = material.getDefine('GSPLAT_UNIFIED_ID') !== hasPcId ||
            material.getDefine('PICK_CUSTOM_ID') !== hasPcId;
        material.setDefine('GSPLAT_UNIFIED_ID', hasPcId);
        material.setDefine('PICK_CUSTOM_ID', hasPcId);
        return changed;
    }

    updateOverdrawMode(params) {
        const overdrawEnabled = !!params.colorRamp;
        const wasOverdrawEnabled = this._material.getDefine('GSPLAT_OVERDRAW');

        if (overdrawEnabled) {
            this._material.setParameter('colorRamp', params.colorRamp);
            this._material.setParameter('colorRampIntensity', params.colorRampIntensity);
        }

        if (overdrawEnabled !== wasOverdrawEnabled) {
            this._material.setDefine('GSPLAT_OVERDRAW', overdrawEnabled);
            if (overdrawEnabled) {
                this.originalBlendType = this._material.blendType;
                this._material.blendType = BLEND_ADDITIVE;
            } else {
                this._material.blendType = this.originalBlendType;
            }
            this._material.update();
        }
    }

    createMeshInstance() {
        const mesh = GSplatResourceBase.createMesh(this.device);
        const meshInstance = new MeshInstance(mesh, this._material);
        meshInstance.node = this.node;
        meshInstance.setInstancing(true, true);
        meshInstance.instancingCount = 0;
        meshInstance.pick = false;

        const thisCamera = this.cameraNode.camera;
        meshInstance.isVisibleFunc = (camera) => {
            const renderMode = this.renderMode ?? 0;
            if (thisCamera.camera === camera && (renderMode & GSPLAT_FORWARD)) {
                return true;
            }
            // Hybrid renderer never participates in shadow casting.
            if (camera.node?.name === SHADOWCAMERA_NAME) {
                return false;
            }
            return false;
        };

        return meshInstance;
    }
}

export { GSplatHybridRenderer };
