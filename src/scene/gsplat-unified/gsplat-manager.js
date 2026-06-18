import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { GraphNode } from '../graph-node.js';
import { GSplatUnifiedSorter } from './gsplat-unified-sorter.js';
import { GSplatWorld } from './gsplat-world.js';
import { GSplatQuadRenderer } from './gsplat-quad-renderer.js';
import { GSplatHybridRenderer } from './gsplat-hybrid-renderer.js';
import { GSplatProjector } from './gsplat-projector.js';
import { GSplatIntervalCompaction } from './gsplat-interval-compaction.js';
import { ComputeRadixSort } from '../graphics/radix-sort/compute-radix-sort.js';
import { Debug } from '../../core/debug.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import {
    GSPLAT_RENDERER_RASTER_GPU_SORT,
    GSPLAT_DEBUG_AABBS
} from '../constants.js';
import { Color } from '../../core/math/color.js';
import { ALPHA_VISIBILITY_THRESHOLD } from './constants.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { StorageBuffer } from '../../platform/graphics/storage-buffer.js'
 * @import { GSplatPlacement } from './gsplat-placement.js'
 * @import { GSplatWorldState } from './gsplat-world-state.js'
 * @import { Scene } from '../scene.js'
 * @import { Layer } from '../layer.js'
 * @import { GSplatDirector } from './gsplat-director.js'
 * @import { GSplatRenderer } from './gsplat-renderer.js'
 */

const cameraPosition = new Vec3();
const cameraDirection = new Vec3();
const translation = new Vec3();
const _tempVec3 = new Vec3();
const invModelMat = new Mat4();

// Color instances used by debug wireframe rendering (GSPLAT_DEBUG_AABBS)
const _lodColors = [
    new Color(1, 0, 0),
    new Color(0, 1, 0),
    new Color(0, 0, 1),
    new Color(1, 1, 0),
    new Color(1, 0, 1),
    new Color(0, 1, 1),
    new Color(1, 0.5, 0),
    new Color(0.5, 0, 1)
];

/**
 * GSplatManager manages the rendering of splats using a work buffer, where all active splats are
 * stored and rendered from.
 *
 * Shared culling + compaction (raster GPU-sort path, WebGPU only):
 *   Interval compaction operates on contiguous intervals of splats (one per octree node).
 *   1. Cull + count (compute): each interval's bounding sphere is tested against frustum
 *      planes (or a fisheye cone). The pass writes the interval's splat count (or 0 if
 *      culled) into a count buffer.
 *   2. Prefix sum: exclusive prefix sum over the count buffer produces output offsets.
 *      The last element gives visibleCount.
 *   3. Scatter (compute): one workgroup per interval expands visible intervals into
 *      compactedSplatIds (flat list of work-buffer pixel indices).
 *
 * Raster renderer — CPU sorting (WebGPU and WebGL, {@link GSplatQuadRenderer}):
 *   1. Sort on worker: camera position and splat centers are sent to a web worker which
 *      performs a counting sort and returns the sorted order as orderBuffer.
 *   2. Render: the vertex shader reads orderBuffer[vertexId] → splatId.
 *      No culling or compaction is used.
 *
 * @ignore
 */
class GSplatManager {
    /** @type {GraphicsDevice} */
    device;

    /** @type {GraphNode} */
    node = new GraphNode('GSplatManager');

    /**
     * Owns the work buffer, versioned world states, allocation, octree/LOD evaluation, streaming,
     * budget, and the work-buffer bake. Created 1:1 per manager (no sharing yet).
     *
     * @type {GSplatWorld}
     */
    world;

    /** @type {GSplatRenderer} */
    renderer;

    /**
     * The currently active renderer mode. Starts as undefined so the first
     * prepareRendererMode() call always creates the appropriate resources.
     *
     * @type {number|undefined}
     */
    activeRenderer;

    /**
     * CPU-based sorter (when not using GPU sorting).
     *
     * @type {GSplatUnifiedSorter|null}
     */
    cpuSorter = null;

    /**
     * GPU-based radix sorter (raster GPU sort path).
     *
     * @type {ComputeRadixSort|null}
     */
    gpuSorter = null;

    /**
     * Interval-based GPU compaction (raster GPU sort / compute paths).
     *
     * @type {GSplatIntervalCompaction|null}
     */
    intervalCompaction = null;

    /**
     * Compute projector + sort keys for {@link GSPLAT_RENDERER_RASTER_GPU_SORT}.
     *
     * @type {GSplatProjector|null}
     */
    projector = null;

    /**
     * Indirect draw slot index for the current frame (-1 when not using indirect draw).
     */
    indirectDrawSlot = -1;

    /**
     * Indirect dispatch slot for raster GPU sort (projector + radix) and compute paths.
     * The compute local renderer builds its own indirect args in private buffers
     * and does not use these slots.
     */
    indirectDispatchSlot = -1;

    /**
     * Total intervals from the last interval compaction dispatch. Needed for
     * writeIndirectArgs to index into the prefix sum buffer for visible count.
     */
    lastCompactedNumIntervals = 0;

    /**
     * Tracks last seen centersVersion per resource ID for detecting centers updates. Used to feed
     * the CPU sorter when the world creates a new world-state version.
     *
     * @type {Map<number, number>}
     * @private
     */
    _centersVersions = new Map();

    /** @type {Vec3} */
    lastSortCameraPos = new Vec3(Infinity, Infinity, Infinity);

    /** @type {Vec3} */
    lastSortCameraFwd = new Vec3(Infinity, Infinity, Infinity);

    /** @type {Vec3} */
    lastCullingCameraFwd = new Vec3(Infinity, Infinity, Infinity);

    /** @type {Mat4} */
    lastCullingProjMat = new Mat4();

    /** @type {boolean} */
    sortNeeded = true;

    /** @type {GraphNode} */
    cameraNode;

    /** @type {Scene} */
    scene;

    /**
     * Bitmask flags controlling which render passes this manager participates in.
     *
     * @type {number|undefined}
     */
    renderMode;

    /**
     * Persistent result objects written (out-param) by the {@link GSplatWorld} APIs to avoid
     * per-frame allocation. Consumed synchronously by the manager after each call.
     *
     * @private
     */
    _updateResult = { newVersion: false, overdrawDirty: false, sortNeeded: false };

    /** @private */
    _bakeResult = { rebuilt: false, count: 0, textureSize: 0, sortNeeded: false };

    /** @private */
    _markResult = { rebuilt: false, count: 0, textureSize: 0 };

    /** @private */
    _formatResult = { bufferRecreated: false, sortNeeded: false };

    /**
     * Frame token of the last {@link updateStreaming} run, for once-per-frame dedup between the
     * component-system streaming tick and the render path.
     *
     * @type {number}
     * @private
     */
    _lastStreamToken = -1;

    /**
     * Whether the most recent streaming pass produced new data a render would show (new world-state
     * version or work-buffer recreation). Used by the director to decide whether to fire frame:request.
     *
     * @type {boolean}
     * @private
     */
    _streamAdvanced = false;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GSplatDirector} director - The director.
     * @param {Layer} layer - The layer.
     * @param {GraphNode} cameraNode - The camera node.
     */
    constructor(device, director, layer, cameraNode) {
        this.device = device;
        this.scene = director.scene;
        this.director = director;
        this.cameraNode = cameraNode;

        // The world owns the work buffer + allocator + streaming + LOD. Create it before the
        // renderer, which reads world.workBuffer in _createRenderer.
        this.world = new GSplatWorld(device, this.scene);

        this.layer = layer;
        this._createRenderer(this.scene.gsplat.currentRenderer);
    }

    destroy() {
        this._destroyed = true;

        // Tear down sorters first — destroyGpuSorting calls renderer.setCpuSortedRendering(), so the
        // renderer must still be alive here.
        this.destroyGpuSorting();
        this.destroyCpuSorting();

        // World frees world states (decRef resources), octree instances, and the work buffer. Must
        // run before renderer.destroy() (the renderer references the work buffer's textures/format).
        this.world.destroy();

        this.renderer.destroy();
    }

    /**
     * Destroys GPU sorting resources (radix sorter, projector, compaction).
     *
     * @private
     */
    destroyGpuSorting() {
        this.gpuSorter?.destroy();
        this.gpuSorter = null;
        this.projector?.destroy();
        this.projector = null;

        // Switch renderer to CPU mode once, before destroying compaction.
        const useCpuSort = false;
        this.renderer.setCpuSortedRendering();
        this.destroyIntervalCompaction(useCpuSort);
    }

    /**
     * Destroys interval compaction resources.
     *
     * @param {boolean} [useCpuSort] - Whether to switch the renderer to CPU-sorted mode.
     * @private
     */
    destroyIntervalCompaction(useCpuSort = true) {
        if (this.intervalCompaction) {
            if (useCpuSort) {
                this.renderer.setCpuSortedRendering();
            }
            this.intervalCompaction.destroy();
            this.intervalCompaction = null;
        }
    }

    /**
     * Destroys CPU sorting resources (worker-based sorter).
     *
     * @private
     */
    destroyCpuSorting() {
        this.cpuSorter?.destroy();
        this.cpuSorter = null;
    }

    /**
     * GPU radix sort + projector for hybrid raster (no separate sort-key compute pass).
     *
     * @private
     */
    initHybridSorting() {
        if (!this.gpuSorter) {
            this.gpuSorter = new ComputeRadixSort(this.device, { indirect: true });
        }
        if (!this.projector) {
            this.projector = new GSplatProjector(this.device);
        }
    }

    /**
     * Creates the CPU sorter and prepares it for the current world state. Disables any
     * GPU-side indirect draw and hides the mesh until the first sort result arrives.
     *
     * @private
     */
    initCpuSorting() {
        if (!this.cpuSorter) {
            this.cpuSorter = this.createSorter();
        }

        // Reset state so the fresh worker gets intervals and a full rebuild on first sort
        const splats = this.world.invalidateSortState();
        if (splats) {
            this.cpuSorter.updateCentersForSplats(splats);
        }

        // Switch renderer to CPU-sorted mode (also hides until update() restores visibility)
        this.renderer.setCpuSortedRendering();
    }

    get material() {
        return this.renderer.material;
    }

    /**
     * Number of work-buffer blocks uploaded this frame (forwarded from the world for stats).
     *
     * @type {number}
     */
    get bufferCopyUploaded() {
        return this.world.bufferCopyUploaded;
    }

    /**
     * Total number of work-buffer blocks this frame (forwarded from the world for stats).
     *
     * @type {number}
     */
    get bufferCopyTotal() {
        return this.world.bufferCopyTotal;
    }

    /**
     * True when the CPU sorter has a completed sort result waiting to be applied by a render. Used
     * by the director to request a render so the pending result is applied.
     *
     * @type {boolean}
     */
    get hasPendingSort() {
        return !!this.cpuSorter?.pendingSorted;
    }

    /**
     * Dispatches a renderer-specific pick pipeline and returns the configured pick mesh instance.
     * The hybrid renderer refreshes its shared projector/sort buffers for the picker camera and
     * returns a transient pick mesh.
     *
     * @param {object} camera - The camera.
     * @param {number} width - Pick target width.
     * @param {number} height - Pick target height.
     * @returns {import('../mesh-instance.js').MeshInstance|null} The pick mesh instance, or null.
     */
    prepareForPicking(camera, width, height) {
        if (this.renderer.usesGpuSort) {
            const sortedState = this.world.getState(this.world.currentVersion);
            if (!sortedState?.sortedBefore || !camera.node) return null;

            const sortedIndices = this.sortGpuHybridForCamera(
                sortedState,
                camera.node,
                width,
                height,
                Math.max(ALPHA_VISIBILITY_THRESHOLD, this.scene.gsplat.alphaClip),
                !!this.world.workBuffer.format.getStream('pcId')
            );
            if (!sortedIndices) return null;

            const proj = /** @type {GSplatProjector} */ (this.projector);
            const ic = /** @type {GSplatIntervalCompaction} */ (this.intervalCompaction);
            return /** @type {GSplatHybridRenderer} */ (/** @type {unknown} */ (this.renderer)).prepareForPicking(
                this.indirectDrawSlot,
                sortedIndices,
                /** @type {StorageBuffer} */ (proj.projCache),
                /** @type {StorageBuffer} */ (ic.numSplatsBuffer),
                this.scene.gsplat.alphaClip,
                this.scene.gsplat.alphaClipForward,
                camera.node
            );
        }

        return null;
    }

    /**
     * Creates the CPU sorter (Web Worker based).
     *
     * @returns {GSplatUnifiedSorter} The created sorter.
     */
    createSorter() {
        // create sorter
        const sorter = new GSplatUnifiedSorter(this.scene);
        sorter.on('sorted', (count, version, orderData) => {
            this.onSorted(count, version, orderData);
        });
        return sorter;
    }

    /**
     * Sets the render mode for this manager and its renderer.
     *
     * @param {number} renderMode - Bitmask flags controlling render passes (GSPLAT_FORWARD, GSPLAT_SHADOW, or both).
     * @ignore
     */
    setRenderMode(renderMode) {
        this.renderMode = renderMode;
        this.renderer.setRenderMode(renderMode);
    }

    /**
     * True when frustum culling can run (bounds data available).
     *
     * @type {boolean}
     * @private
     */
    get canCull() {
        return this.renderer.requiresBounds &&
            this.world.hasBounds;
    }

    /**
     * Creates the renderer and sort resources for the given mode. Used at init time.
     *
     * @param {number} mode - The GSPLAT_RENDERER_* constant.
     * @private
     */
    _createRenderer(mode) {
        const workBuffer = this.world.workBuffer;
        if (mode === GSPLAT_RENDERER_RASTER_GPU_SORT) {
            this.renderer = new GSplatHybridRenderer(this.device, this.node, this.cameraNode, this.layer, workBuffer);
            this.initHybridSorting();
        } else {
            this.renderer = new GSplatQuadRenderer(this.device, this.node, this.cameraNode, this.layer, workBuffer);
            this.initCpuSorting();
        }
        this.activeRenderer = mode;
    }

    /**
     * Checks whether the resolved renderer mode has changed and transitions to the new mode
     * (CPU raster quad <-> hybrid GPU sort).
     *
     * @private
     */
    prepareRendererMode() {
        const requested = this.scene.gsplat.currentRenderer;
        if (requested === this.activeRenderer) return;

        // CPU raster sort vs GPU paths differ on which placements need centers; force a full
        // world-state rebuild so splats[] matches the new sorter (see hasCenters gates).
        this.world.invalidate({ worldState: true });

        this.destroyGpuSorting();
        this.destroyCpuSorting();
        this.renderer.destroy();
        this._createRenderer(requested);
        this.renderer.setRenderMode(this.renderMode);
        this.world.invalidate({ workBuffer: true });
        this.sortNeeded = true;
    }

    /**
     * Supply the manager with the placements to use. This is used to update the manager when the
     * layer's placements have changed, called infrequently.
     *
     * @param {GSplatPlacement[]} placements - The placements to reconcile with.
     */
    reconcile(placements) {
        this.world.reconcile(placements);
    }

    onSorted(count, version, orderData) {
        // World advances the render-ready version (cleanup + first-sort rebuild) and uploads the
        // sorted order texture; the manager applies the renderer-side reactions. Frustum-culling
        // bounds are only uploaded for non-CPU renderers (the CPU path doesn't allocate them).
        const updateBounds = this.renderer.requiresBounds;
        const result = this.world.onSorted(version, count, orderData, this.cameraNode, updateBounds, this._markResult);
        if (result.rebuilt) {
            this.renderer.update(result.count, result.textureSize);
        }

        // update renderer with new order data
        this.renderer.setOrderData();
    }

    /**
     * On the first sort of a world-state version, advances the render-ready version (cleanup +
     * first-sort work-buffer rebuild) and applies the renderer rebuild reaction. The world version
     * lifecycle is owned by the manager; the GPU pipeline (in the renderer) assumes a baked,
     * render-ready work buffer. This is the synchronous GPU-sort counterpart of {@link onSorted}
     * (the async CPU path). No-op once the version has been sorted before.
     *
     * @param {GSplatWorldState} worldState - The world state about to be sorted.
     * @private
     */
    _markSortedIfNeeded(worldState) {
        if (!worldState.sortedBefore) {
            // GPU sort always runs interval culling, so upload bounds (updateBounds = true).
            this.world.markSorted(worldState.version, worldState.totalActiveSplats, this.cameraNode, true, this._markResult);
            if (this._markResult.rebuilt) {
                this.renderer.update(this._markResult.count, this._markResult.textureSize);
            }
        }
    }

    /**
     * Tests if the camera has moved enough to require re-sorting.
     * - For radial sorting: only position matters (rotation doesn't affect sort order)
     * - For directional sorting: only forward direction matters (position doesn't affect sort order)
     *
     * @returns {boolean} True if camera moved enough to require re-sorting, otherwise false.
     */
    testCameraMovedForSort() {
        const epsilon = 0.001;

        if (this.scene.gsplat.radialSorting) {
            // For radial sorting, only position changes matter
            const currentCameraPos = this.cameraNode.getPosition();
            return this.lastSortCameraPos.distance(currentCameraPos) > epsilon;
        }

        // For directional sorting, only forward direction changes matter
        if (Number.isFinite(this.lastSortCameraFwd.x)) {
            const currentCameraFwd = this.cameraNode.forward;
            const dot = Math.min(1, Math.max(-1, this.lastSortCameraFwd.dot(currentCameraFwd)));
            return Math.acos(dot) > epsilon;
        }

        // first run, force update to initialize last orientation
        return true;
    }

    /**
     * Tests if the camera frustum has changed since the last sort or compaction. Checks both
     * projection matrix and camera rotation. Used to trigger re-culling/compaction independently of
     * sort-key changes.
     *
     * @returns {boolean} True if the frustum changed.
     */
    testFrustumChanged() {
        const epsilon = 0.001;

        // Projection changes (window resize, FOV, near/far, custom projection, etc.)
        if (!this.lastCullingProjMat.equals(this.cameraNode.camera.projectionMatrix)) {
            return true;
        }

        // Rotation changes
        const currentCameraFwd = this.cameraNode.forward;
        const dot = Math.min(1, Math.max(-1, this.lastCullingCameraFwd.dot(currentCameraFwd)));
        return Math.acos(dot) > epsilon;
    }

    /**
     * Fires the frame:ready event with current sorting and loading state.
     */
    fireFrameReadyEvent() {
        const ready = this.world.currentVersion === this.world.lastWorldStateVersion && !this.world.awaitingLodUpdate;
        const loadingCount = this.world.pendingLoadCount;
        this.director.eventHandler.fire('frame:ready', this.cameraNode.camera, this.renderer.layer, ready, loadingCount);
    }

    /**
     * CPU streaming pass: work-buffer format sync, renderer-mode transition, and the world's LOD /
     * octree streaming / world-state creation. Runs every frame from the component system's
     * framerender tick (even when rendering is skipped), and once from {@link update} on the render
     * path. Deduped via `token` so it runs at most once per frame. Performs no render-pass / draw
     * work — only CPU/IO and GPU resource creation.
     *
     * @param {number} token - Per-frame token; a repeated token is a no-op (returns the cached result).
     * @returns {boolean} True if new data was produced that a render would show (new world-state
     * version or work-buffer recreation).
     */
    updateStreaming(token) {
        if (token === this._lastStreamToken) return this._streamAdvanced;
        this._lastStreamToken = token;

        // Detect work-buffer format changes (wholesale swap + extra streams) before world.update,
        // which reads the work buffer.
        this.world.syncFormat(this._formatResult);
        if (this._formatResult.bufferRecreated) this.renderer.setDataSource(this.world.workBuffer);
        if (this._formatResult.sortNeeded) this.sortNeeded = true;

        // Check for runtime renderer mode changes and transition if needed.
        this.prepareRendererMode();

        // GPU sorting is always ready, CPU sorting is ready if not too many jobs in flight. This is
        // the back-pressure gate the world uses to throttle LOD/world-state production.
        const allowLodUpdate = !this.renderer.requiresCpuSort || (this.cpuSorter && this.cpuSorter.jobsInFlight < 3);

        // World LOD / streaming / world-state creation.
        this.world.update(this.cameraNode, allowLodUpdate, !!this.cpuSorter, this._updateResult);
        if (this._updateResult.overdrawDirty) this.renderer.updateOverdrawMode(this.scene.gsplat);
        if (this._updateResult.sortNeeded) this.sortNeeded = true;
        if (this._updateResult.newVersion) this._feedCpuSorterCenters();

        // tick cooldowns once per frame per unique octree
        this.world.tickCooldowns();

        this._streamAdvanced = this._updateResult.newVersion || this._formatResult.bufferRecreated;
        return this._streamAdvanced;
    }

    update() {

        // Reset per-frame buffer-copy stats before any bake. Must precede applyPendingSorted (whose
        // async onSorted may rebuild and accumulate stats).
        this.world.resetFrameStats();

        // Run the CPU streaming pass. Normally already done this frame by the component system's
        // framerender tick (deduped via the director's stream token); runs here for the first frame
        // and for managers created during this render (bootstrap).
        this.updateStreaming(this.director._streamToken);

        // apply any pending sorted results (CPU path only)
        if (this.cpuSorter) {
            this.cpuSorter.applyPendingSorted();
        }

        // check if camera has moved enough to require re-sorting
        if (this.testCameraMovedForSort()) {
            this.sortNeeded = true;
        }

        // if culling is active but we do not need to sort, check if the frustum changed requiring re-culling
        if (this.intervalCompaction && !this.sortNeeded && this.testFrustumChanged()) {

            // store the current camera frustum related properties
            this.lastCullingCameraFwd.copy(this.cameraNode.forward);
            this.lastCullingProjMat.copy(this.cameraNode.camera.projectionMatrix);

            this.sortNeeded = true;
        }

        // update sorter with new world state
        const lastState = this.world.getState(this.world.lastWorldStateVersion);
        if (lastState) {

            // debug render world space bounds for all splats
            Debug.call(() => {
                if (this.scene.gsplat.debug === GSPLAT_DEBUG_AABBS) {
                    const tempAabb = new BoundingBox();
                    const scene = this.scene;
                    lastState.splats.forEach((splat) => {
                        tempAabb.setFromTransformedAabb(splat.aabb, splat.node.getWorldTransform());
                        scene.immediate.drawWireAlignedBox(tempAabb.getMin(), tempAabb.getMax(), _lodColors[splat.lodIndex], true, scene.defaultDrawLayer);
                    });
                }
            });

            // CPU path: send sort parameters to worker
            if (this.cpuSorter && !lastState.sortParametersSet) {
                lastState.sortParametersSet = true;

                const payload = this.world.prepareSortParameters(lastState);
                this.cpuSorter.setSortParameters(payload);
            }

        }

        // Materialize the work buffer for the render-ready version (full rebuild or incremental).
        // Skipped internally until the state has been sorted at least once. Frustum-culling bounds
        // are only uploaded for non-CPU renderers (the CPU path doesn't allocate them).
        const updateBounds = this.renderer.requiresBounds;
        this.world.bake(this.world.currentVersion, this.cameraNode, updateBounds, this._bakeResult);
        if (this._bakeResult.rebuilt) {
            this.renderer.update(this._bakeResult.count, this._bakeResult.textureSize);

            // rebuildWorkBuffer may resize, which destroys/recreates orderBuffer — rebind it
            this.renderer.setOrderData();

            // boundsBaseIndex may have changed — force interval metadata re-upload
            this.intervalCompaction?.invalidateUpload();
        }
        // an incremental update may have detected moved splats requiring a re-sort
        if (this._bakeResult.sortNeeded) this.sortNeeded = true;

        // Kick off sorting. The GPU path runs every frame (projector + radix + fresh per-frame
        // indirect args; the post-projector visible count differs from the interval prefix sum).
        // The CPU path posts to the worker only when a re-sort is needed. The version lifecycle
        // (markSorted on the first sort of a version) stays here in the manager.
        if (lastState) {
            if (this.renderer.usesGpuSort) {
                this._markSortedIfNeeded(lastState);
                this.sortGpuHybrid(lastState);
            } else if (this.sortNeeded) {
                this.sortCpu(lastState);
            }

            if (this.sortNeeded) {
                this.sortNeeded = false;

                // Update camera tracking for the next sort/cull check.
                this.lastSortCameraPos.copy(this.cameraNode.getPosition());
                this.lastSortCameraFwd.copy(this.cameraNode.forward);
                this.lastCullingCameraFwd.copy(this.cameraNode.forward);
                this.lastCullingProjMat.copy(this.cameraNode.camera.projectionMatrix);
            }
        }

        // keep the shared mesh-instance's AABB in sync with the actual splat placements
        this.renderer?.meshInstance?.setCustomAabb(this.world.computeAggregateAabb());

        // fire frame:ready event
        this.fireFrameReadyEvent();

        // If event listeners dirtied params (e.g. changed LOD range), ensure LOD is re-evaluated
        if (this.scene.gsplat.dirty) {
            this.world.markInstancesNeedLodUpdate();
        }

        // Renderer per-frame update (material syncing, deferred setup). Must run after
        // fireFrameReadyEvent(): listeners may change material state (e.g. antiAlias), and
        // syncing here applies it this same frame before frameEnd() clears the dirty flag.
        const fogParams = this.scene.gsplat.useFog ? (this.cameraNode.camera.fogParams ?? this.scene.fog) : null;
        this.renderer.frameUpdate(this.scene.gsplat, this.scene.exposure, fogParams);

        // return the number of active splats for stats
        const sortedState = this.world.getState(this.world.currentVersion);
        return sortedState ? sortedState.totalActiveSplats : 0;
    }

    /**
     * Feeds the CPU sorter the centers for the splats in the latest world-state version. Called
     * after the world creates a new version (the version-change detection lives here because the
     * CPU sorter is manager-owned).
     *
     * @private
     */
    _feedCpuSorterCenters() {
        if (!this.cpuSorter) return;
        const state = this.world.getState(this.world.lastWorldStateVersion);
        if (!state) return;
        const splats = state.splats;

        // Check for centers version changes and force-update sorter for changed resources
        for (const splat of splats) {
            const resource = splat.resource;
            const lastVersion = this._centersVersions.get(resource.id);
            if (lastVersion !== resource.centersVersion) {
                this._centersVersions.set(resource.id, resource.centersVersion);
                // Force update by removing and re-adding centers
                this.cpuSorter.setCenters(resource.id, null);
                this.cpuSorter.setCenters(resource.id, resource.centers);
            }
        }

        // update cpu sorter with current splats (adds new centers, removes unused ones)
        this.cpuSorter.updateCentersForSplats(splats);
    }

    /**
     * Hybrid GPU path: interval compaction, projector (keys + proj cache), indirect radix sort
     * over projector keys (indices are dense in projCache), then hybrid raster bindings.
     *
     * @param {GSplatWorldState} worldState - The world state to sort.
     */
    sortGpuHybrid(worldState) {
        const cam = this.cameraNode.camera;
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
            Debug.errorOnce(`GSplatManager: the hybrid GPU-sort renderer supports at most 2 XR views (stereo), but the session has ${xrViewCount}. Additional views will not render correctly.`);
        }
        const isStereo = xrViewCount === 2;
        this.renderer.setStereo?.(isStereo);

        const sortedIndices = this.sortGpuHybridForCamera(
            worldState,
            this.cameraNode,
            viewportWidth,
            viewportHeight,
            Math.max(ALPHA_VISIBILITY_THRESHOLD, this.scene.gsplat.alphaClipForward),
            false,
            isStereo
        );

        if (sortedIndices) {
            this.applyGpuSortResults(sortedIndices);
        }
    }

    /**
     * Runs the shared hybrid projector + indirect radix sort path for a specific camera.
     *
     * @param {GSplatWorldState} worldState - The world state to sort.
     * @param {GraphNode} cameraNode - Camera node used for projection and sort keys.
     * @param {number} viewportWidth - Projection viewport width in pixels.
     * @param {number} viewportHeight - Projection viewport height in pixels.
     * @param {number} alphaClip - Projector producer alpha threshold.
     * @param {boolean} pickMode - Whether projector writes pcId into the cache.
     * @param {boolean} [isStereo] - Whether to project both XR eyes in one pass (forward path only;
     * picking stays mono).
     * @returns {StorageBuffer|null} The sorted cache indices, or null if no work was dispatched.
     * @private
     */
    sortGpuHybridForCamera(worldState, cameraNode, viewportWidth, viewportHeight, alphaClip, pickMode, isStereo = false) {
        const gpuSorter = this.gpuSorter;
        const projector = this.projector;
        Debug.assert(gpuSorter && projector, 'Hybrid GPU sort not initialized');
        if (!gpuSorter || !projector) return null;

        const elementCount = worldState.totalActiveSplats;
        if (elementCount === 0) return null;

        if (!this.intervalCompaction) {
            this.intervalCompaction = new GSplatIntervalCompaction(this.device);
        }

        this.intervalCompaction.uploadIntervals(worldState);

        if (this.canCull) {
            const state = this.world.getState(this.world.currentVersion);
            if (state) {
                this._runFrustumCulling(state, cameraNode);
            }
        }

        const fisheyeProj = this.renderer.fisheyeProj;
        const numIntervals = worldState.totalIntervals;
        const totalActiveSplats = worldState.totalActiveSplats;
        this.intervalCompaction.dispatchCompact(this.world.workBuffer.frustumCuller, numIntervals, totalActiveSplats, fisheyeProj.enabled);

        this.allocateAndWriteIntervalIndirectArgs(numIntervals);

        const ic = /** @type {GSplatIntervalCompaction} */ (this.intervalCompaction);
        const compactedSplatIds = ic.compactedSplatIds;
        const gsplat = this.scene.gsplat;

        const numBits = Math.max(10, Math.min(20, Math.round(Math.log2(elementCount / 4))));
        const radixBits = gpuSorter.radixBits;
        const roundedNumBits = Math.ceil(numBits / radixBits) * radixBits;

        const { minDist, maxDist } = this.computeDistanceRange(worldState, cameraNode);

        const sortIndirectInfo = gpuSorter.prepareIndirect();

        projector.dispatch({
            workBuffer: this.world.workBuffer,
            cameraNode,
            compactedSplatIds: /** @type {StorageBuffer} */ (compactedSplatIds),
            sortElementCountBuffer: /** @type {StorageBuffer} */ (ic.sortElementCountBuffer),
            totalCapacity: elementCount,
            radialSort: gsplat.radialSorting,
            numBits: roundedNumBits,
            minDist,
            maxDist,
            alphaClip,
            minPixelSize: gsplat.minPixelSize * 0.5,
            minContribution: gsplat.minContribution,
            foveationStrength: gsplat.foveationStrength,
            foveationCenter: gsplat.foveationCenter,
            viewportWidth,
            viewportHeight,
            flipY: !!cameraNode.camera.renderTarget?.flipY,
            pickMode,
            fisheyeProj,
            antiAlias: gsplat.antiAlias,
            isStereo,
            material: gsplat.material,
            userCacheWords: gsplat.varyings.words
        });

        projector.writeIndirectArgs(
            this.indirectDrawSlot,
            this.indirectDispatchSlot + 1,
            /** @type {StorageBuffer} */ (ic.numSplatsBuffer),
            /** @type {StorageBuffer} */ (ic.sortElementCountBuffer),
            sortIndirectInfo
        );

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
     * Allocates per-frame indirect draw and dispatch slots and runs writeIndirectArgs
     * for interval compaction.
     *
     * @param {number} numIntervals - Total interval count (index into prefix sum for visible count).
     * @private
     */
    allocateAndWriteIntervalIndirectArgs(numIntervals) {
        const gpuSorter = /** @type {ComputeRadixSort} */ (this.gpuSorter);
        const sortInfo = gpuSorter.prepareIndirect();
        const sortSlotCount = sortInfo[0];

        this.indirectDrawSlot = this.device.getIndirectDrawSlot(1);
        // Reserve contiguous dispatch slots for hybrid / legacy layout (e.g. sort passes).
        this.indirectDispatchSlot = this.device.getIndirectDispatchSlot(1 + sortSlotCount);
        const ic = /** @type {GSplatIntervalCompaction} */ (this.intervalCompaction);
        ic.writeIndirectArgs(this.indirectDrawSlot, this.indirectDispatchSlot, numIntervals, sortInfo);
        this.lastCompactedNumIntervals = numIntervals;
    }

    /**
     * Applies hybrid GPU sort results to the renderer with indirect draw from interval compaction.
     *
     * @param {StorageBuffer} sortedIndices - Buffer containing sorted splat IDs.
     * @private
     */
    applyGpuSortResults(sortedIndices) {
        const proj = /** @type {GSplatProjector} */ (this.projector);
        const ic = /** @type {GSplatIntervalCompaction} */ (this.intervalCompaction);
        /** @type {GSplatHybridRenderer} */ (/** @type {unknown} */ (this.renderer)).setHybridSortedRendering(
            this.indirectDrawSlot,
            sortedIndices,
            /** @type {StorageBuffer} */ (proj.projCache),
            /** @type {StorageBuffer} */ (ic.numSplatsBuffer)
        );
    }

    /**
     * Prepares frustum culling data: updates the GPU transform buffers and computes
     * frustum planes from the camera. The actual culling test runs inline in the
     * interval compaction compute shader.
     *
     * @param {GSplatWorldState} worldState - The world state whose splats provide transforms.
     * @param {GraphNode} [cameraNode] - Camera node to cull against.
     * @private
     */
    _runFrustumCulling(worldState, cameraNode = this.cameraNode) {
        this.world.workBuffer.frustumCuller.updateTransformsData(worldState.boundsGroups);

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
            this.world.workBuffer.frustumCuller.setFrustumPlanes(sceneCamera.frustum);
        } else {
            this.world.workBuffer.frustumCuller.computeFrustumPlanes(cam.projectionMatrix, cam.viewMatrix);
        }

        const gsplat = this.scene.gsplat;
        const fp = this.renderer.fisheyeProj;
        // XR does not support fisheye in any renderer; resolveFisheye forces it off (and warns once).
        fp.update(this.renderer.resolveFisheye(gsplat.fisheye), cam.fov, cam.projectionMatrix);

        if (fp.enabled) {
            this.world.workBuffer.frustumCuller.setFisheyeData(
                cameraNode.getPosition(),
                cameraNode.forward,
                fp.maxTheta
            );
        }
    }

    /**
     * Computes the min/max effective distances for the current world state.
     *
     * @param {GSplatWorldState} worldState - The world state.
     * @param {GraphNode} [cameraNode] - Camera node to measure distances from.
     * @returns {{minDist: number, maxDist: number}} The distance range.
     */
    computeDistanceRange(worldState, cameraNode = this.cameraNode) {
        const cameraMat = cameraNode.getWorldTransform();
        cameraMat.getTranslation(cameraPosition);
        cameraMat.getZ(cameraDirection).normalize();

        const radialSort = this.scene.gsplat.radialSorting;

        // For radial: minDist is always 0, only track maxDist
        // For linear: track both min and max along camera direction
        let minDist = radialSort ? 0 : Infinity;
        let maxDist = radialSort ? 0 : -Infinity;

        for (const splat of worldState.splats) {
            const modelMat = splat.node.getWorldTransform();
            const aabbMin = splat.aabb.getMin();
            const aabbMax = splat.aabb.getMax();

            // Check all 8 corners of local-space AABB
            for (let i = 0; i < 8; i++) {
                _tempVec3.x = (i & 1) ? aabbMax.x : aabbMin.x;
                _tempVec3.y = (i & 2) ? aabbMax.y : aabbMin.y;
                _tempVec3.z = (i & 4) ? aabbMax.z : aabbMin.z;

                // Transform to world space
                modelMat.transformPoint(_tempVec3, _tempVec3);

                if (radialSort) {
                    // Radial: distance from camera
                    const dist = _tempVec3.distance(cameraPosition);
                    if (dist > maxDist) maxDist = dist;
                } else {
                    // Linear: distance along camera direction
                    const dist = _tempVec3.sub(cameraPosition).dot(cameraDirection);
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
     * Sorts the splats using CPU worker (asynchronous).
     *
     * @param {GSplatWorldState} lastState - The last world state.
     */
    sortCpu(lastState) {
        Debug.assert(this.cpuSorter, 'CPU sorter not initialized');
        if (!this.cpuSorter) return;

        // Get camera's world-space properties
        const cameraNode = this.cameraNode;
        const cameraMat = cameraNode.getWorldTransform();
        cameraMat.getTranslation(cameraPosition);
        cameraMat.getZ(cameraDirection).normalize();

        const sorterRequest = [];
        lastState.splats.forEach((splat) => {
            const modelMat = splat.node.getWorldTransform();
            invModelMat.copy(modelMat).invert();

            // uniform scale
            const uniformScale = modelMat.getScale().x;

            // camera direction in splat's rotated space
            // transform by the full inverse matrix and then normalize, which cancels the (1/s) scaling factor
            const transformedDirection = invModelMat.transformVector(cameraDirection).normalize();

            // camera position in splat's local space (for circular sorting)
            const transformedPosition = invModelMat.transformPoint(cameraPosition);

            // world-space offset
            modelMat.getTranslation(translation);
            const offset = translation.sub(cameraPosition).dot(cameraDirection);


            // sorter parameters
            const aabbMin = splat.aabb.getMin();
            const aabbMax = splat.aabb.getMax();

            sorterRequest.push({
                transformedDirection,
                transformedPosition,
                offset,
                scale: uniformScale,
                modelMat: modelMat.data.slice(),
                aabbMin: [aabbMin.x, aabbMin.y, aabbMin.z],
                aabbMax: [aabbMax.x, aabbMax.y, aabbMax.z]
            });
        });

        this.cpuSorter.setSortParams(sorterRequest, this.scene.gsplat.radialSorting);
    }
}

export { GSplatManager };
