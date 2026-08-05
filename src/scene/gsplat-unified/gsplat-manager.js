import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { GraphNode } from '../graph-node.js';
import { GSplatUnifiedSorter } from './gsplat-unified-sorter.js';
import { GSplatWorld } from './gsplat-world.js';
import { GSplatQuadRenderer } from './gsplat-quad-renderer.js';
import { GSplatHybridRenderer } from './gsplat-hybrid-renderer.js';
import { GSplatHybridRendererScratch } from './gsplat-hybrid-renderer-scratch.js';
import { GSplatShadowRenderer } from './gsplat-shadow-renderer.js';
import { Debug } from '../../core/debug.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import {
    GSPLAT_RENDERER_RASTER_GPU_SORT,
    GSPLAT_FORWARD,
    GSPLAT_SHADOW,
    GSPLAT_DEBUG_AABBS
} from '../constants.js';
import { Color } from '../../core/math/color.js';

/**
 * @import { EventHandle } from '../../core/event-handle.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GSplatPlacement } from './gsplat-placement.js'
 * @import { GSplatWorldState } from './gsplat-world-state.js'
 * @import { Scene } from '../scene.js'
 * @import { Layer } from '../layer.js'
 * @import { GSplatDirector } from './gsplat-director.js'
 * @import { GSplatRenderer } from './gsplat-renderer.js'
 * @import { GSplatRenderViewParams } from './gsplat-renderer.js'
 */

const cameraPosition = new Vec3();
const cameraDirection = new Vec3();
const translation = new Vec3();
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
 * stored and rendered from. It owns the {@link GSplatWorld} (work buffer, world-state versions,
 * streaming, bake), the world version lifecycle ({@link GSplatWorld#markSorted}/`onSorted`), and —
 * for the CPU-sort path ({@link GSplatQuadRenderer}) — a web-worker sorter. Each frame it bakes the
 * render-ready world state and then delegates per-view work to the active renderer:
 *
 * - CPU sort (WebGPU + WebGL): the manager sends camera + centers to the worker, which returns a
 *   sorted order; the quad renderer's vertex shader reads `orderBuffer[vertexId] → splatId`. No
 *   GPU culling.
 * - GPU sort ({@link GSplatHybridRenderer}, WebGPU only): the renderer owns the interval cull +
 *   compaction, projector, and radix sort; the manager just marks the version sorted and calls
 *   {@link GSplatRenderer#prepareRenderView}.
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
     * Casts directional shadows for the GPU-sort (hybrid) forward renderer, which cannot self-cast.
     * Null when the forward renderer is CPU-sort (the quad renderer self-casts) or when this
     * manager has no shadow render mode. Shares this manager's {@link GSplatWorld}.
     *
     * @type {GSplatShadowRenderer|null}
     */
    shadowRenderer = null;

    /**
     * Shared GPU scratch for the GPU-sort (hybrid) path, created while a GPU-sort renderer is in use
     * and injected into both the forward {@link GSplatHybridRenderer} and the
     * {@link GSplatShadowRenderer} so they share the compaction candidate buffer. Null for the
     * CPU-sort (quad) renderer.
     *
     * @type {GSplatHybridRendererScratch|null}
     * @private
     */
    _hybridScratch = null;

    /**
     * The currently active renderer mode. Starts as undefined so the first
     * prepareRendererMode() call always creates the appropriate resources.
     *
     * @type {number|undefined}
     */
    activeRenderer;

    /**
     * CPU-based sorter (used by the quad renderer; the hybrid renderer owns its own GPU sort).
     *
     * @type {GSplatUnifiedSorter|null}
     */
    cpuSorter = null;

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

    /** @type {boolean} */
    sortNeeded = true;

    /**
     * Event handle for the graphics device restored event.
     *
     * @type {EventHandle|null}
     * @private
     */
    _deviceRestoredEvent = null;

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
     * Reused per-call parameter bag passed to the renderer's forward {@link GSplatRenderer#prepareRenderView}.
     * Avoids per-frame allocation and keeps the renderer free of a back-reference to the manager/scene.
     *
     * @type {GSplatRenderViewParams}
     * @private
     */
    _renderViewParams = /** @type {GSplatRenderViewParams} */ ({});

    /**
     * Reused per-call parameter bag passed to the renderer's {@link GSplatRenderer#preparePickingView}.
     * Separate from {@link _renderViewParams} so mid-frame picking can't corrupt the forward params.
     *
     * @type {GSplatRenderViewParams}
     * @private
     */
    _pickParams = /** @type {GSplatRenderViewParams} */ ({});

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

        // On a graphics context restore the work buffer render target comes back blank (its
        // contents are GPU-rendered, not re-uploaded from CPU like source textures), so the splats
        // need re-materializing. See _onDeviceRestored.
        this._deviceRestoredEvent = this.device.on('devicerestored', this._onDeviceRestored, this);
    }

    destroy() {
        this._destroyed = true;

        this._deviceRestoredEvent?.off();
        this._deviceRestoredEvent = null;

        // Tear down the CPU sorter while the renderer and world are still alive.
        this.destroyCpuSorting();

        // World frees world states (decRef resources), octree instances, and the work buffer. Must
        // run before renderer.destroy() (the renderer references the work buffer's textures/format).
        this.world.destroy();

        // The renderer frees its own GPU sort resources (radix sorter, projector, compaction).
        this.renderer.destroy();

        // The shadow renderer frees its per-light pool (buffers, indirect slots) and unregisters
        // its cast mesh instances from the layer.
        this.shadowRenderer?.destroy();
        this.shadowRenderer = null;

        // Free the shared GPU-sort scratch after its borrowers (forward + shadow compactions) are gone.
        this._hybridScratch?.destroy();
        this._hybridScratch = null;
    }

    /**
     * Handles a graphics context restore: the work buffer render target is recreated empty, so
     * force a full rebuild and re-sort to re-materialize the splats from the (auto-restored) source
     * textures.
     *
     * Skipped when the world has streaming octree instances: those destroy and asynchronously
     * reload their source resources from URL via their own device-lost handling, and rebuilding the
     * work buffer here would render from textures that have been destroyed (and not yet reloaded).
     *
     * @private
     */
    _onDeviceRestored() {
        if (this.world.hasOctreeInstances) return;
        this.world.invalidate({ workBuffer: true });
        this.sortNeeded = true;
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
        if (!this.renderer.usesGpuSort || !camera.node) return null;
        const sortedState = this.world.getState(this.world.currentVersion);
        if (!sortedState?.sortedBefore) return null;
        return this.renderer.preparePickingView(this.world, sortedState, this._fillPickParams(camera, width, height));
    }

    /**
     * Writes the current scene gsplat params into a renderer per-view parameter bag. Lets the
     * renderer run its GPU pipeline without a back-reference to the manager or scene.
     *
     * @param {GSplatRenderViewParams} p - The parameter bag to populate.
     * @private
     */
    _writeGsplatParams(p) {
        const gsplat = this.scene.gsplat;
        p.radialSorting = gsplat.radialSorting;
        p.alphaClip = gsplat.alphaClip;
        p.alphaClipForward = gsplat.alphaClipForward;
        p.minPixelSize = gsplat.minPixelSize;
        p.minContribution = gsplat.minContribution;
        p.foveationStrength = gsplat.foveationStrength;
        p.foveationCenter = gsplat.foveationCenter;
        p.antiAlias = gsplat.antiAlias;
        p.fisheye = gsplat.fisheye;
        p.material = gsplat.material;
        p.varyings = gsplat.varyings;
    }

    /**
     * Fills and returns the reused forward-view parameter bag for the manager's camera.
     *
     * @returns {GSplatRenderViewParams} The populated {@link _renderViewParams}.
     * @private
     */
    _fillRenderViewParams() {
        const p = this._renderViewParams;
        this._writeGsplatParams(p);
        p.cameraNode = this.cameraNode;
        return p;
    }

    /**
     * Fills and returns the reused picking parameter bag for the picker camera.
     *
     * @param {object} camera - The picker camera.
     * @param {number} width - Pick target width.
     * @param {number} height - Pick target height.
     * @returns {GSplatRenderViewParams} The populated {@link _pickParams}.
     * @private
     */
    _fillPickParams(camera, width, height) {
        const p = this._pickParams;
        this._writeGsplatParams(p);
        p.cameraNode = camera.node;
        p.width = width;
        p.height = height;
        return p;
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
        this._syncShadowRenderer();
    }

    /**
     * Creates or destroys {@link shadowRenderer} to match the current render mode and forward
     * renderer. The GPU-sort (hybrid) renderer cannot self-cast shadows, so when shadow rendering
     * is requested and the forward renderer uses GPU sort, a dedicated {@link GSplatShadowRenderer}
     * casts on its behalf (sharing this manager's world). The CPU-sort quad renderer self-casts, so
     * no shadow renderer is created for it.
     *
     * @private
     */
    _syncShadowRenderer() {
        const wantShadow = !!(this.renderMode & GSPLAT_SHADOW) && this.renderer.usesGpuSort;
        if (wantShadow && !this.shadowRenderer) {
            this.shadowRenderer = new GSplatShadowRenderer(this.device, this.node, this.cameraNode, this.layer, this.world, this._hybridScratch);
        } else if (!wantShadow && this.shadowRenderer) {
            this.shadowRenderer.destroy();
            this.shadowRenderer = null;
        }

        // Free the shared scratch once no GPU-sort renderer remains (forward switched to CPU-sort).
        // Runs after the forward renderer (_createRenderer) and shadow renderer above are torn down,
        // so neither borrower references it anymore.
        if (!this.renderer.usesGpuSort && this._hybridScratch) {
            this._hybridScratch.destroy();
            this._hybridScratch = null;
        }
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
            // The GPU-sort path shares one scratch (compaction candidate buffer) across the forward
            // renderer and the shadow cull; create it here so it exists for both constructors. Freed
            // in _syncShadowRenderer once no GPU-sort renderer remains (and in destroy()).
            this._hybridScratch ??= new GSplatHybridRendererScratch(this.device);
            // The hybrid renderer creates its own GPU sort resources (radix sorter, projector).
            this.renderer = new GSplatHybridRenderer(this.device, this.node, this.cameraNode, this.layer, workBuffer, this._hybridScratch);
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

        // The renderer owns its GPU sort resources and frees them in destroy(); the manager owns
        // only the CPU sorter.
        this.destroyCpuSorting();
        this.renderer.destroy();
        this._createRenderer(requested);
        this.renderer.setRenderMode(this.renderMode);

        // The forward renderer type changed (CPU quad <-> GPU hybrid), which flips whether a
        // dedicated shadow renderer is needed.
        this._syncShadowRenderer();

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
        if (this._formatResult.bufferRecreated) {
            this.renderer.setDataSource(this.world.workBuffer);
            this.shadowRenderer?.setDataSource(this.world.workBuffer);
        }
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

        // check if camera has moved enough to require re-sorting (CPU path; the GPU path re-sorts
        // every frame regardless)
        if (this.testCameraMovedForSort()) {
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
            this.renderer.invalidateCullUpload();
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

                // Only run the forward GPU pipeline (projector + radix sort) when this manager
                // participates in the forward pass. A shadow-only manager (GPU renderer type, no
                // GSPLAT_FORWARD bit) skips it: its GSplatShadowRenderer culls + draws the shadow
                // independently, so the forward sorter/projector would be pure waste (and are never
                // even allocated — see GSplatHybridRenderer._ensureGpuPipeline).
                if (this.renderMode & GSPLAT_FORWARD) {
                    this.renderer.prepareRenderView(this.world, lastState, this._fillRenderViewParams());
                }
            } else if (this.sortNeeded) {
                this.sortCpu(lastState);
            }

            if (this.sortNeeded) {
                this.sortNeeded = false;

                // Update camera tracking for the next CPU re-sort check.
                this.lastSortCameraPos.copy(this.cameraNode.getPosition());
                this.lastSortCameraFwd.copy(this.cameraNode.forward);
            }
        }

        // Pre-cull: reconcile the shadow-caster pool against the layer's directional lights, so the
        // standard shadow-caster culling in cullComposition (which runs after the director's update)
        // sees the cast mesh instances. The per-light cull dispatch happens later in updateShadows.
        this.shadowRenderer?.syncLights();

        // Keep the mesh-instance AABBs in sync with the actual splat placements. This world-space
        // AABB feeds the directional shadow camera's depth range (and thus world-space PCSS penumbra
        // scaling), so the shadow casters need it too — set it pre-cull, before cullComposition fits
        // the shadow cameras.
        const aggregateAabb = this.world.computeAggregateAabb();
        this.renderer?.meshInstance?.setCustomAabb(aggregateAabb);
        this.shadowRenderer?.setCastersAabb(aggregateAabb);

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
     * Post-cull shadow pass. Called from the director after cullComposition has fitted each
     * directional light's shadow-camera frustum, and before the frame graph renders the shadow
     * maps. Dispatches the per-light gsplat shadow cull and binds the results. No-op unless this
     * manager has a {@link shadowRenderer} (GPU-sort forward path with a shadow render mode).
     */
    updateShadows() {
        this.shadowRenderer?.cull(this.scene.gsplat);
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
