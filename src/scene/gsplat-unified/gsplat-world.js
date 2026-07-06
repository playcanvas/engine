import { math } from '../../core/math/math.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Debug } from '../../core/debug.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { BlockAllocator } from '../../core/block-allocator.js';
import { GSplatInfo } from './gsplat-info.js';
import { GSplatWorkBuffer } from './gsplat-work-buffer.js';
import { GSplatOctreeInstance } from './gsplat-octree-instance.js';
import { GSplatOctreeResource } from './gsplat-octree.resource.js';
import { GSplatWorldState } from './gsplat-world-state.js';
import { GSplatPlacementStateTracker } from './gsplat-placement-state-tracker.js';
import { GSplatBudgetBalancer } from './gsplat-budget-balancer.js';
import { GSPLAT_DEBUG_LOD, GSPLAT_DEBUG_SH_UPDATE } from '../constants.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GraphNode } from '../graph-node.js'
 * @import { GSplatPlacement } from './gsplat-placement.js'
 * @import { GSplatResourceBase } from '../gsplat/gsplat-resource-base.js'
 * @import { Scene } from '../scene.js'
 * @import { MemBlock } from '../../core/block-allocator.js'
 */

// Module-scope scratch (stateless)
const cameraPosition = new Vec3();
const _tempVec3 = new Vec3();
const invModelMat = new Mat4();
const _localCamPos = new Vec3();
const _closestPt = new Vec3();
const _meshInstanceAabb = new BoundingBox();
const _tempPlacementAabb = new BoundingBox();
const _cameraDeltas = { translationDelta: 0 };
const tempOctreesTicked = new Set();
const _queuedSplats = new Set();
const _updatedSplats = [];
const _splatsWithSH = [];
const _changedColorAllocIds = new Set();
const tempNonOctreePlacements = new Set();
const tempOctreePlacements = new Set();

const _lodColorsRaw = [
    [1, 0, 0],  // red
    [0, 1, 0],  // green
    [0, 0, 1],  // blue
    [1, 1, 0],  // yellow
    [1, 0, 1],  // magenta
    [0, 1, 1],  // cyan
    [1, 0.5, 0],  // orange
    [0.5, 0, 1]   // purple
];

let _randomColorRaw = null;

// Headroom above the splat budget for the block allocator, to reduce early grows and
// fragmentation during initial scene loading.
const ALLOCATOR_GROW_MULTIPLIER = 1.15;

/**
 * Owns the gsplat "world": the work buffer, versioned world states, allocation, octree/LOD
 * evaluation, streaming, budget enforcement, and the work-buffer bake. A single primary camera
 * (passed in to {@link GSplatWorld#update} / {@link GSplatWorld#bake}) drives LOD and color.
 *
 * The dependency is one-way: {@link GSplatManager} reads world data through getters and drives
 * mutation through explicit methods. The world never calls into the renderer, sorters, interval
 * compaction, or projector — instead it writes results into caller-owned result objects, and the
 * manager reacts (e.g. rebinding the renderer's data source on a work-buffer recreation).
 *
 * @ignore
 */
class GSplatWorld {
    /** @type {GraphicsDevice} */
    _device;

    /** @type {Scene} */
    _scene;

    /** @type {GSplatWorkBuffer} */
    _workBuffer;

    /** @type {Map<number, GSplatWorldState>} */
    _worldStates = new Map();

    /** @type {number} */
    _lastWorldStateVersion = 0;

    /**
     * The render-ready version: the version the work buffer is baked to and rendered from. Advanced
     * exclusively via {@link GSplatWorld#markSorted}. (Formerly `GSplatManager.sortedVersion`.)
     *
     * @type {number}
     */
    _currentVersion = 0;

    /** @type {boolean} */
    _worldStateDirty = false;

    /** @type {number} */
    _workBufferFormatVersion = -1;

    /** @type {boolean} */
    _workBufferRebuildRequired = false;

    /** @type {number} */
    _bufferCopyUploaded = 0;

    /** @type {number} */
    _bufferCopyTotal = 0;

    /** @type {GSplatPlacementStateTracker} */
    _stateTracker = new GSplatPlacementStateTracker();

    /** @type {number} */
    _framesTillFullUpdate = 0;

    /**
     * Latched request for a full LOD update, raised by the 10-frame cadence metronome and cleared
     * when fulfilled (when the back-pressure gate allows). Decouples "a full update is due" from
     * "we may run it this frame", so a tick deferred by back-pressure fires on the next available
     * frame rather than being lost until the next 10-frame mark.
     *
     * @type {boolean}
     */
    _lodUpdateRequested = false;

    /** @type {Vec3} */
    _lastLodCameraPos = new Vec3(Infinity, Infinity, Infinity);

    /** @type {Vec3} */
    _lastLodCameraFwd = new Vec3(Infinity, Infinity, Infinity);

    /** @type {number} */
    _lastLodCameraFov = -1;

    /** @type {GSplatBudgetBalancer} */
    _budgetBalancer = new GSplatBudgetBalancer();

    /** @type {number} */
    _budgetScale = 1.0;

    /** @type {BlockAllocator} */
    _allocator;

    /** @type {Map<number, MemBlock>} */
    _allocationMap = new Map();

    /** @type {Vec3} */
    _lastColorUpdateCameraPos = new Vec3(Infinity, Infinity, Infinity);

    /** @type {GSplatPlacement[]} */
    _layerPlacements = [];

    /** @type {boolean} */
    _layerPlacementsDirty = false;

    /** @type {boolean} */
    _placementSetChanged = false;

    /** @type {Map<GSplatPlacement, GSplatOctreeInstance>} */
    _octreeInstances = new Map();

    /** @type {GSplatOctreeInstance[]} */
    _octreeInstancesToDestroy = [];

    /** @type {boolean} */
    _hasNewOctreeInstances = false;

    /**
     * Suppresses ready=true in frame:ready until a fullUpdate cycle runs. Only set when octree
     * instances exist and params change (dirty).
     *
     * @type {boolean}
     */
    _awaitingLodUpdate = false;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {Scene} scene - The scene.
     */
    constructor(device, scene) {
        this._device = device;
        this._scene = scene;

        const budget = scene.gsplat.splatBudget;
        this._allocator = new BlockAllocator(budget > 0 ? Math.ceil(budget * ALLOCATOR_GROW_MULTIPLIER) : 0, ALLOCATOR_GROW_MULTIPLIER);

        this._workBuffer = new GSplatWorkBuffer(device, scene.gsplat.format);
        this._workBufferFormatVersion = this._workBuffer.format.extraStreamsVersion;
    }

    destroy() {
        // Clean up all world states and decrement refs
        for (const [, worldState] of this._worldStates) {
            for (const splat of worldState.splats) {
                splat.resource.decRefCount();
            }
            worldState.destroy();
        }
        this._worldStates.clear();

        // Destroy all octree instances (they handle their own ref count cleanup)
        for (const [, instance] of this._octreeInstances) {
            instance.destroy();
        }
        this._octreeInstances.clear();

        // Also destroy any queued instances
        for (const instance of this._octreeInstancesToDestroy) {
            instance.destroy();
        }
        this._octreeInstancesToDestroy.length = 0;

        this._workBuffer.destroy();
    }

    // --- read-only accessors (the one-way contract: manager reads, never reassigns) ---

    /** @type {GSplatWorkBuffer} */
    get workBuffer() {
        return this._workBuffer;
    }

    /** @type {number} */
    get currentVersion() {
        return this._currentVersion;
    }

    /** @type {number} */
    get lastWorldStateVersion() {
        return this._lastWorldStateVersion;
    }

    /** @type {number} */
    get bufferCopyUploaded() {
        return this._bufferCopyUploaded;
    }

    /** @type {number} */
    get bufferCopyTotal() {
        return this._bufferCopyTotal;
    }

    /** @type {boolean} */
    get awaitingLodUpdate() {
        return this._awaitingLodUpdate;
    }

    /** @type {boolean} */
    get hasOctreeInstances() {
        return this._octreeInstances.size > 0;
    }

    /**
     * Total pending loads across all octree instances (including environment).
     *
     * @type {number}
     */
    get pendingLoadCount() {
        let loadingCount = 0;
        for (const [, inst] of this._octreeInstances) {
            loadingCount += inst.pendingLoadCount;
        }
        return loadingCount;
    }

    /**
     * The render-ready world state, or undefined if not yet created.
     *
     * @type {GSplatWorldState|undefined}
     */
    get currentState() {
        return this._worldStates.get(this._currentVersion);
    }

    /**
     * Looks up a world state by version.
     *
     * @param {number} version - The world state version.
     * @returns {GSplatWorldState|undefined} The world state, or undefined.
     */
    getState(version) {
        return this._worldStates.get(version);
    }

    /**
     * True when frustum culling can run for the given renderer (bounds data available). The renderer
     * type gate stays on the manager; this only reports bounds availability.
     *
     * @type {boolean}
     */
    get hasBounds() {
        return this._workBuffer.frustumCuller.totalBoundsEntries > 0;
    }

    // --- mutation entry points (manager-driven) ---

    /**
     * Resets per-frame buffer-copy stats. Must run before any bake/rebuild of the frame (including
     * the CPU sorter's async onSorted path, which the manager applies before {@link GSplatWorld#update}).
     */
    resetFrameStats() {
        this._bufferCopyUploaded = 0;
        this._bufferCopyTotal = 0;
    }

    /**
     * Marks the world state and/or work buffer as needing a rebuild. Called by the manager on
     * renderer-mode transitions (the manager must not poke the private flags directly).
     *
     * @param {object} [opts] - Options.
     * @param {boolean} [opts.worldState] - Force a world-state rebuild.
     * @param {boolean} [opts.workBuffer] - Force a full work-buffer rebuild.
     */
    invalidate({ worldState = false, workBuffer = false } = {}) {
        if (worldState) this._worldStateDirty = true;
        if (workBuffer) this._workBufferRebuildRequired = true;
    }

    /**
     * Resets the render-ready state's sort bookkeeping so the next sort triggers a full rebuild
     * (used when switching to the CPU-sort renderer). Returns the state's splats for the manager to
     * feed its CPU sorter, or null if no state exists.
     *
     * @returns {GSplatInfo[]|null} The current state's splats, or null.
     */
    invalidateSortState() {
        const currentState = this._worldStates.get(this._currentVersion);
        if (!currentState) return null;
        currentState.sortParametersSet = false;
        currentState.sortedBefore = false;
        return currentState.splats;
    }

    /**
     * Detects work-buffer format changes and recreates / syncs the work buffer. Must run before the
     * CPU sorter's pending results are applied (so onSorted rebuilds into the current buffer).
     *
     * @param {{ bufferRecreated: boolean, sortNeeded: boolean }} result - Caller-owned result object.
     * @returns {{ bufferRecreated: boolean, sortNeeded: boolean }} The populated result.
     */
    syncFormat(result) {
        result.bufferRecreated = false;
        result.sortNeeded = false;

        // wholesale format-object swap (e.g. dataFormat changed): recreate the work buffer
        const currentFormat = this._scene.gsplat.format;
        if (this._workBuffer.format !== currentFormat) {
            this._workBuffer.destroy();
            this._workBuffer = new GSplatWorkBuffer(this._device, currentFormat);
            this._workBufferFormatVersion = this._workBuffer.format.extraStreamsVersion;
            this._workBufferRebuildRequired = true;
            result.bufferRecreated = true;
            result.sortNeeded = true;
        }

        // extra streams added to the same format object: sync in place (no buffer recreation)
        const wbFormatVersion = this._workBuffer.format.extraStreamsVersion;
        if (this._workBufferFormatVersion !== wbFormatVersion) {
            this._workBufferFormatVersion = wbFormatVersion;
            this._workBuffer.syncWithFormat();
            this._workBufferRebuildRequired = true;
            result.sortNeeded = true;
        }

        return result;
    }

    /**
     * Supply the placements to use. Updates octree instances and the non-octree placement list,
     * flagging dirtiness. Called infrequently (when the layer's placements change).
     *
     * @param {GSplatPlacement[]} placements - The placements to reconcile with.
     */
    reconcile(placements) {

        tempNonOctreePlacements.clear();
        for (const p of placements) {
            if (p.resource instanceof GSplatOctreeResource) {

                // make sure octree instance exists for placement
                if (!this._octreeInstances.has(p)) {
                    // @ts-ignore - p.resource is GSplatOctreeResource so octree cannot be null
                    this._octreeInstances.set(p, new GSplatOctreeInstance(this._device, p.resource.octree, p));

                    // mark that we have new instances that need initial LOD evaluation
                    this._hasNewOctreeInstances = true;
                }
                tempOctreePlacements.add(p);
            } else {
                // collect non-octree placement
                tempNonOctreePlacements.add(p);
            }
        }

        // remove octree instances that are no longer present and schedule them for destruction
        for (const [placement, inst] of this._octreeInstances) {
            if (!tempOctreePlacements.has(placement)) {
                this._octreeInstances.delete(placement);

                // mark world as dirty since octree set changed
                this._layerPlacementsDirty = true;
                this._placementSetChanged = true;

                // queue the instance to be processed during next world state creation
                this._octreeInstancesToDestroy.push(inst);
            }
        }

        // compute dirtiness of non-octree placements compared to existing layerPlacements
        this._layerPlacementsDirty ||= this._layerPlacements.length !== tempNonOctreePlacements.size;
        if (!this._layerPlacementsDirty) {
            for (let i = 0; i < this._layerPlacements.length; i++) {
                const existing = this._layerPlacements[i];
                if (!tempNonOctreePlacements.has(existing)) {
                    this._layerPlacementsDirty = true;
                    break;
                }
            }
        }
        this._placementSetChanged ||= this._layerPlacementsDirty;

        // update layerPlacements to new non-octree list
        this._layerPlacements.length = 0;
        for (const p of tempNonOctreePlacements) {
            this._layerPlacements.push(p);
        }

        // clear temporaries
        tempNonOctreePlacements.clear();
        tempOctreePlacements.clear();
    }

    /**
     * Per-frame LOD/streaming pass: evaluates LOD against the primary camera (subject to the
     * back-pressure gate), enforces budget, and creates a new world-state version when needed.
     *
     * @param {GraphNode} camera - The primary camera driving LOD/streaming.
     * @param {boolean} allowLodUpdate - Back-pressure gate (false when the CPU sorter is busy).
     * @param {boolean} requireCenters - Whether resources without a centers buffer must be skipped
     * (CPU sort path).
     * @param {{ newVersion: boolean, overdrawDirty: boolean, sortNeeded: boolean }} result -
     * Caller-owned result object the manager reacts to.
     * @returns {{ newVersion: boolean, overdrawDirty: boolean, sortNeeded: boolean }} The populated result.
     */
    update(camera, allowLodUpdate, requireCenters, result) {
        result.newVersion = false;
        result.overdrawDirty = false;
        result.sortNeeded = false;

        // Drop instances whose octree was destroyed (the asset was unloaded) or whose placement
        // was destroyed (the component detached the asset, which nulls placement.resource)
        // before the layer placement change reaches reconcile - they can no longer stream and
        // their resources are gone, so letting them run this update would assert and crash the
        // budget pass. Mirrors the removal branch in reconcile.
        for (const [placement, inst] of this._octreeInstances) {
            if (inst.octree.destroyed || !placement.resource) {
                this._octreeInstances.delete(placement);
                this._layerPlacementsDirty = true;
                this._placementSetChanged = true;
                this._octreeInstancesToDestroy.push(inst);
            }
        }

        // Cadence: a free-running metronome raises a latched request every 10 frames.
        if (--this._framesTillFullUpdate <= 0) {
            this._framesTillFullUpdate = 10;
            this._lodUpdateRequested = true;
        }

        // Fulfillment: run the full update when one is requested AND the back-pressure gate allows,
        // then clear the latch. A tick deferred by back-pressure thus fires on the next available
        // frame, instead of being lost until the next 10-frame mark.
        let fullUpdate = false;
        if (this._lodUpdateRequested && allowLodUpdate) {
            fullUpdate = true;
            this._lodUpdateRequested = false;
        }

        // when new octree instances are added, we need to evaluate their LOD immediately
        const hasNewInstances = this._hasNewOctreeInstances && allowLodUpdate;
        if (hasNewInstances) this._hasNewOctreeInstances = false;

        let anyInstanceNeedsLodUpdate = false;
        let anyOctreeMoved = false;
        let cameraMovedOrRotatedForLod = false;
        if (fullUpdate) {

            // process any pending / prefetch resource completions and collect LOD updates
            for (const [, inst] of this._octreeInstances) {
                const isDirty = inst.update();
                this._layerPlacementsDirty ||= isDirty;
                this._placementSetChanged ||= inst.consumePlacementSetChanged();

                const instNeeds = inst.consumeNeedsLodUpdate();
                anyInstanceNeedsLodUpdate ||= instNeeds;
            }

            // Validate that resources in use haven't been unexpectedly destroyed
            Debug.call(() => {
                const sortedState = this._worldStates.get(this._currentVersion);
                if (sortedState) {
                    for (const splat of sortedState.splats) {
                        if (!splat.resource) {
                            Debug.warn(`GSplatWorld: Resource reference is null but still referenced in world state ${sortedState.version}`);
                        }
                    }
                }
            });

            // check if any octree instances have moved enough to require LOD update
            const threshold = this._scene.gsplat.lodUpdateDistance;
            for (const [, inst] of this._octreeInstances) {
                const moved = inst.testMoved(threshold);
                anyOctreeMoved ||= moved;
            }

            // check if camera has moved/rotated enough to require LOD update
            cameraMovedOrRotatedForLod = this.testCameraMovedForLod(camera);

            this._awaitingLodUpdate = false;
        }

        Debug.call(() => {
            for (const [, inst] of this._octreeInstances) {
                inst.debugRender(this._scene);
            }
        });

        // if parameters are dirty, rebuild world state
        if (this._scene.gsplat.dirty) {
            this._layerPlacementsDirty = true;
            result.overdrawDirty = true;

            // Re-render all splats into the work buffer so persistent data (e.g. debug
            // colorization) is refreshed immediately instead of trickling in over time.
            this._workBufferRebuildRequired = true;
            result.sortNeeded = true;

            // Suppress ready=true in frame:ready until a fullUpdate cycle runs, so
            // consumers can reliably detect the not-ready→ready transition after param changes.
            if (this._octreeInstances.size > 0) {
                this._awaitingLodUpdate = true;
            }
        }

        // when camera or octree need LOD evaluated, or params are dirty, or resources completed, or new instances added
        if (cameraMovedOrRotatedForLod || anyOctreeMoved || this._scene.gsplat.dirty || anyInstanceNeedsLodUpdate || hasNewInstances) {

            // update the previous position where LOD was evaluated for octree instances
            for (const [, inst] of this._octreeInstances) {
                inst.updateMoved();
            }

            // update last camera data when LOD was evaluated
            this._lastLodCameraPos.copy(camera.getPosition());
            this._lastLodCameraFwd.copy(camera.forward);
            this._lastLodCameraFov = camera.camera.fov;

            const budget = this._scene.gsplat.splatBudget;

            if (budget > 0) {
                // Global budget enforcement
                this._enforceBudget(budget, camera);
            } else {
                // Budget disabled - use LOD distances only, no budget adjustments
                this._budgetScale = 1.0;
                for (const [, inst] of this._octreeInstances) {
                    inst.updateLod(camera, this._scene.gsplat);
                }
            }
        }

        // create new world state if needed
        if (this._updateWorldState(requireCenters)) {
            result.newVersion = true;
            result.sortNeeded = true;
        }

        return result;
    }

    /**
     * Creates a new world state version when placements/resources changed. Returns whether a new
     * version was created. Does NOT feed the CPU sorter (the manager does that on a new version).
     *
     * @param {boolean} requireCenters - Whether resources without centers must be skipped.
     * @returns {boolean} True if a new world-state version was created.
     * @private
     */
    _updateWorldState(requireCenters) {

        // Check for state changes (format version, modifier hash, numSplats)
        let stateChanged = this._stateTracker.hasChanges(this._layerPlacements);
        for (const [, inst] of this._octreeInstances) {
            if (this._stateTracker.hasChanges(inst.activePlacements)) {
                stateChanged = true;
            }
        }

        // Recreate world state if there are changes
        const placementsChanged = this._layerPlacementsDirty;
        const worldChanged = placementsChanged || stateChanged || this._worldStates.size === 0 || this._worldStateDirty;
        if (!worldChanged) {
            return false;
        }

        this._lastWorldStateVersion++;
        const splats = [];

        // add standalone splats
        for (const p of this._layerPlacements) {
            if (requireCenters && !p.resource.hasCenters) {
                Debug.warnOnce(`Skipping gsplat resource id ${p.resource.id} on the CPU sorting path — no centers buffer. See Scene#gsplatCentersEnabled.`);
                continue;
            }
            p.ensureInstanceStreams(this._device);
            const splatInfo = new GSplatInfo(this._device, p.resource, p, p.consumeRenderDirty.bind(p));
            splats.push(splatInfo);
        }

        // add octree splats
        for (const [, inst] of this._octreeInstances) {
            inst.activePlacements.forEach((p) => {
                if (p.resource) {
                    const leafResource = /** @type {GSplatResourceBase} */ (p.resource);
                    if (requireCenters && !leafResource.hasCenters) {
                        Debug.warnOnce(`Skipping gsplat resource id ${leafResource.id} on the CPU sorting path — no centers buffer. See Scene#gsplatCentersEnabled.`);
                        return;
                    }
                    p.ensureInstanceStreams(this._device);
                    const octreeNodes = p.intervals.size > 0 ? inst.octree.nodes : null;
                    const nodeInfos = octreeNodes ? inst.nodeInfos : null;
                    const splatInfo = new GSplatInfo(this._device, p.resource, p, p.consumeRenderDirty.bind(p), octreeNodes, nodeInfos);
                    splats.push(splatInfo);
                }
            });
        }

        const newState = new GSplatWorldState(
            this._device, this._lastWorldStateVersion, splats,
            this._allocator, this._allocationMap
        );

        // increment ref count for all resources in new state
        for (const splat of newState.splats) {
            splat.resource.incRefCount();
        }

        // collect file-release requests from octree instances.
        for (const [, inst] of this._octreeInstances) {
            if (inst.removedCandidates && inst.removedCandidates.size) {
                for (const fileIndex of inst.removedCandidates) {
                    // each entry represents a single decRef
                    // pending releases will be applied on first bake/sort for this state
                    newState.pendingReleases.push([inst.octree, fileIndex]);
                }
                inst.removedCandidates.clear();
            }
        }

        // handle destruction of octree instances
        if (this._octreeInstancesToDestroy.length) {
            for (const inst of this._octreeInstancesToDestroy) {

                // collect pending removedCandidates (files removed by LOD changes
                // but whose octree decRef hasn't been applied yet)
                if (inst.removedCandidates && inst.removedCandidates.size) {
                    for (const fileIndex of inst.removedCandidates) {
                        newState.pendingReleases.push([inst.octree, fileIndex]);
                    }
                    inst.removedCandidates.clear();
                }

                // collect file-release requests for files still in use
                const toRelease = inst.getFileDecrements();
                for (const fileIndex of toRelease) {
                    newState.pendingReleases.push([inst.octree, fileIndex]);
                }

                // skip ref counting in destroy — handled via pendingReleases above
                inst.destroy(true);
            }
            this._octreeInstancesToDestroy.length = 0;
        }

        // When placements are added/removed, boundsBaseIndex values shift.
        // Force a full rebuild so no stale indices remain.
        if (this._placementSetChanged) {
            newState.fullRebuild = true;
        }

        this._worldStates.set(this._lastWorldStateVersion, newState);

        this._layerPlacementsDirty = false;
        this._placementSetChanged = false;
        this._worldStateDirty = false;

        return true;
    }

    /**
     * Advances the render-ready version to `version` (cleaning up older states) and, on the first
     * sort of that version, rebuilds the work buffer. The manager calls this from the GPU sort
     * paths and the CPU onSorted callback. Atomic: cleanup + version-advance happen together.
     *
     * @param {number} version - The version that has been sorted.
     * @param {number} count - The splat count for the work-buffer rebuild / renderer update.
     * @param {GraphNode} camera - The primary camera (for color bake).
     * @param {boolean} updateBounds - Whether to upload frustum-culling bounds (false for CPU sort).
     * @param {{ rebuilt: boolean, count: number, textureSize: number }} result - Caller-owned result.
     * @returns {{ rebuilt: boolean, count: number, textureSize: number }} The populated result. When
     * `rebuilt` is true the manager must call `renderer.update(count, textureSize)`.
     */
    markSorted(version, count, camera, updateBounds, result) {
        result.rebuilt = false;
        result.count = 0;
        result.textureSize = 0;

        // clean up old world states (no-op when version === currentVersion)
        this.cleanupOldWorldStates(version);
        this._currentVersion = version;

        const worldState = this._worldStates.get(version);
        Debug.assert(worldState, `World state with version ${version} not found`);

        if (worldState && !worldState.sortedBefore) {
            // when a new version was sorted for the first time, fully update the work buffer to
            // match the centers buffer / sorted data
            worldState.sortedBefore = true;
            this.rebuildWorkBuffer(worldState, count, false, camera, updateBounds);
            result.rebuilt = true;
            result.count = count;
            result.textureSize = worldState.textureSize;
        }

        return result;
    }

    /**
     * Applies a completed CPU sort: advances the render-ready version (via markSorted) and uploads
     * the sorted order texture. The manager rebinds the renderer afterwards.
     *
     * @param {number} version - The sorted version.
     * @param {number} count - The sorted splat count.
     * @param {Uint32Array} orderData - The sorted order data.
     * @param {GraphNode} camera - The primary camera (for color bake on first sort).
     * @param {boolean} updateBounds - Whether to upload frustum-culling bounds (false for CPU sort).
     * @param {{ rebuilt: boolean, count: number, textureSize: number }} result - Caller-owned result.
     * @returns {{ rebuilt: boolean, count: number, textureSize: number }} The populated result.
     */
    onSorted(version, count, orderData, camera, updateBounds, result) {
        this.markSorted(version, count, camera, updateBounds, result);
        if (this._worldStates.get(version)) {
            // update order texture
            this._workBuffer.setOrderData(orderData);
        }
        return result;
    }

    /**
     * Materializes the work buffer for the given (render-ready) version: a full rebuild when one is
     * pending, otherwise an incremental update. Refreshes color tracking. Camera drives the SH color
     * bake.
     *
     * @param {number} version - The render-ready version to bake.
     * @param {GraphNode} camera - The primary camera (for color bake).
     * @param {boolean} updateBounds - Whether to upload frustum-culling bounds (false for CPU sort).
     * @param {{ rebuilt: boolean, count: number, textureSize: number, sortNeeded: boolean }} result -
     * Caller-owned result. When `rebuilt` is true the manager must call `renderer.update(count,
     * textureSize)`, `renderer.setOrderData()` and `intervalCompaction.invalidateUpload()`. When
     * `sortNeeded` is true (a splat moved during the incremental update) the manager must re-sort.
     * @returns {{ rebuilt: boolean, count: number, textureSize: number, sortNeeded: boolean }} The populated result.
     */
    bake(version, camera, updateBounds, result) {
        result.rebuilt = false;
        result.count = 0;
        result.textureSize = 0;
        result.sortNeeded = false;

        // Apply work buffer updates only when the state has been sorted at least once. Skipping when
        // sortedBefore is false avoids rendering with stale order data (e.g. just after switching to
        // CPU sorting, while waiting for the first sort result).
        const sortedState = this._worldStates.get(version);
        if (sortedState?.sortedBefore) {
            if (this._workBufferRebuildRequired) {
                const count = sortedState.totalActiveSplats;
                this.rebuildWorkBuffer(sortedState, count, true, camera, updateBounds);
                this._workBufferRebuildRequired = false;
                result.rebuilt = true;
                result.count = count;
                result.textureSize = sortedState.textureSize;
            } else {
                result.sortNeeded = this.applyWorkBufferUpdates(sortedState, camera);
            }

            // camera tracking only after first sort (matches the prior update() tail)
            this.updateColorCameraTracking(camera);
        }

        return result;
    }

    /**
     * Rebuilds the work buffer for a world state: resizes if needed, renders changed (or all) splats,
     * syncs transforms, and applies pending file-release requests. Does NOT touch the renderer — the
     * caller updates the renderer's count/textureSize from {@link GSplatWorld#bake} /
     * {@link GSplatWorld#markSorted} results.
     *
     * @param {GSplatWorldState} worldState - The world state to rebuild for.
     * @param {number} count - The number of splats (unused here; surfaced via the result for the renderer).
     * @param {boolean} forceFullRebuild - Force rendering all splats (e.g. format change).
     * @param {GraphNode} camera - The primary camera (for color bake).
     * @param {boolean} updateBounds - Whether to upload bounds/transforms for frustum culling. False
     * for the CPU-sort renderer, whose frustum-culler storage buffers are not allocated.
     * @private
     */
    rebuildWorkBuffer(worldState, count, forceFullRebuild, camera, updateBounds) {
        // resize work buffer if needed
        const textureSize = worldState.textureSize;
        if (textureSize !== this._workBuffer.textureSize) {
            this._workBuffer.resize(textureSize);
        }

        // Bounds and transforms storage buffers are needed for frustum culling, which only runs with
        // interval compaction (GPU sort / compute renderers). The CPU-sort path does not allocate
        // them, so the upload is gated by the renderer-derived flag from the manager.
        if (updateBounds) {
            this._workBuffer.frustumCuller.updateBoundsData(worldState.boundsGroups);
            this._workBuffer.frustumCuller.updateTransformsData(worldState.boundsGroups);
        }

        // Render splats to work buffer: full rebuild renders all, partial renders only changed
        const renderAll = forceFullRebuild || worldState.fullRebuild;
        const splatsToRender = renderAll ? worldState.splats : worldState.needsUpload;
        const changedAllocIds = renderAll ? null : worldState.needsUploadIds;

        if (splatsToRender.length > 0) {
            const totalBlocks = this._allocationMap.size;
            const uploadBlocks = renderAll ? totalBlocks : worldState.needsUploadIds.size;

            // accumulate buffer copy stats for this frame
            this._bufferCopyUploaded += uploadBlocks;
            this._bufferCopyTotal = totalBlocks;

            this._workBuffer.render(splatsToRender, camera, this.getDebugColors(), changedAllocIds);
        }

        // update all splats to sync their transforms (prevents redundant re-render later)
        for (let i = 0; i < worldState.splats.length; i++) {
            worldState.splats[i].update();
        }

        // update camera tracking for color updates
        this.updateColorCameraTracking(camera);

        // apply pending file-release requests
        if (worldState.pendingReleases && worldState.pendingReleases.length) {
            const cooldownTicks = this._scene.gsplat.cooldownTicks;
            for (const [octree, fileIndex] of worldState.pendingReleases) {
                // decrement once for each staged release; refcount system guards against premature unload
                octree.decRefCount(fileIndex, cooldownTicks);
            }
            worldState.pendingReleases.length = 0;
        }
    }

    /**
     * Cleans up old world states between the last render-ready version and the new version. Merges
     * upload requirements from skipped states into the active state, then decrements ref counts and
     * destroys old states. Note: reads the current `_currentVersion` (not yet advanced to newVersion).
     *
     * @param {number} newVersion - The new version to clean up to.
     */
    cleanupOldWorldStates(newVersion) {
        const activeState = /** @type {GSplatWorldState} */ (/** @type {unknown} */ (this._worldStates.get(newVersion)));

        // Pass 1: propagate fullRebuild from skipped states
        if (!activeState.fullRebuild) {
            for (let v = this._currentVersion + 1; v < newVersion; v++) {
                if (this._worldStates.get(v)?.fullRebuild) {
                    activeState.fullRebuild = true;
                    break;
                }
            }
        }

        // Pass 2: merge needsUpload from skipped states (skip if full rebuild).
        if (!activeState.fullRebuild) {
            const activeIds = activeState.needsUploadIds;
            const lookup = activeState.allocIdToSplat;
            for (let v = this._currentVersion + 1; v < newVersion; v++) {
                const oldState = this._worldStates.get(v);
                if (oldState) {
                    for (const allocId of oldState.needsUploadIds) {
                        if (!activeIds.has(allocId)) {
                            activeIds.add(allocId);
                            const splat = lookup.get(allocId);
                            if (splat && !_queuedSplats.has(splat)) {
                                activeState.needsUpload.push(splat);
                                _queuedSplats.add(splat);
                            }
                        }
                    }
                }
            }
            _queuedSplats.clear();
        }

        // Pass 3: cleanup all old states (including the previously sorted one)
        for (let v = this._currentVersion; v < newVersion; v++) {
            const oldState = this._worldStates.get(v);
            if (oldState) {
                // decrement ref count for all resources in old state
                for (const splat of oldState.splats) {
                    splat.resource.decRefCount();
                }
                this._worldStates.delete(v);
                oldState.destroy();
            }
        }
    }

    /**
     * Applies incremental work buffer updates for splats that have changed. Detects transform changes
     * and color update thresholds, then batch renders updates. Reports whether any splat moved (the
     * manager uses this to set sortNeeded).
     *
     * @param {GSplatWorldState} state - The world state to update.
     * @param {GraphNode} camera - The primary camera (for color delta + bake).
     * @returns {boolean} True if any splat moved (requires re-sort).
     */
    applyWorkBufferUpdates(state, camera) {
        // color update thresholds
        const { colorUpdateAngle } = this._scene.gsplat;
        const ratio = Math.tan(colorUpdateAngle * math.DEG_TO_RAD);
        const cameraPos = camera.getPosition();

        // Calculate camera movement deltas for color updates
        const { translationDelta } = this.calculateColorCameraDeltas(camera);
        const hasCameraMovement = translationDelta > 0;

        // check each splat for full or color update
        let movedAny = false;
        let uploadedBlocks = 0;
        state.splats.forEach((splat) => {
            // Check if splat's transform changed (needs full update)
            if (splat.update()) {

                _updatedSplats.push(splat);
                uploadedBlocks += splat.intervalAllocIds.length;

                // Reset all node accumulators for this splat
                if (splat.nodeInfos) {
                    for (const ni of splat.intervalNodeIndices) {
                        splat.nodeInfos[ni].colorAccumulatedTranslation = 0;
                    }
                } else {
                    splat.colorAccumulatedTranslation = 0;
                }

                // Splat moved, need to re-sort
                movedAny = true;

            } else if (hasCameraMovement && splat.hasSphericalHarmonics) {

                _splatsWithSH.push(splat);

                if (splat.nodeInfos) {
                    // Per-node accumulation for octree splats
                    const nodeIndices = splat.intervalNodeIndices;
                    for (let j = 0; j < nodeIndices.length; j++) {
                        const nodeInfo = splat.nodeInfos[nodeIndices[j]];
                        nodeInfo.colorAccumulatedTranslation += translationDelta;
                        const threshold = ratio * Math.max(1, nodeInfo.worldDistance);
                        if (nodeInfo.colorAccumulatedTranslation >= threshold) {
                            _changedColorAllocIds.add(splat.intervalAllocIds[j]);
                            nodeInfo.colorAccumulatedTranslation = 0;
                            uploadedBlocks++;
                        }
                    }
                } else {
                    // Non-octree: per-splat accumulation with AABB distance scaling
                    splat.colorAccumulatedTranslation += translationDelta;
                    invModelMat.copy(splat.node.getWorldTransform()).invert();
                    invModelMat.transformPoint(cameraPos, _localCamPos);
                    splat.aabb.closestPoint(_localCamPos, _closestPt);
                    const dist = _localCamPos.distance(_closestPt) *
                        splat.node.getWorldTransform().getScale().x;
                    const threshold = ratio * Math.max(1, dist);
                    if (splat.colorAccumulatedTranslation >= threshold) {
                        _changedColorAllocIds.add(splat.allocId);
                        uploadedBlocks += splat.intervalAllocIds.length;
                        splat.colorAccumulatedTranslation = 0;
                    }
                }
            }
        });

        // accumulate buffer copy stats for this frame (counted in alloc blocks, not splats)
        this._bufferCopyUploaded += uploadedBlocks;
        this._bufferCopyTotal = this._allocationMap.size;

        // Batch render all updated splats in a single render pass
        if (_updatedSplats.length > 0) {
            this._workBuffer.render(_updatedSplats, camera, this.getDebugColors());
            _updatedSplats.length = 0;
        }

        // Batch render color updates for nodes that exceeded angle thresholds
        if (_changedColorAllocIds.size > 0) {
            this._workBuffer.renderColor(
                _splatsWithSH, camera, this.getDebugColors(),
                _changedColorAllocIds
            );
            _changedColorAllocIds.clear();
        }
        _splatsWithSH.length = 0;

        return movedAny;
    }

    /**
     * Tests if the camera has moved or rotated enough to require LOD update.
     *
     * @param {GraphNode} camera - The primary camera.
     * @returns {boolean} True if camera moved/rotated over thresholds, otherwise false.
     */
    testCameraMovedForLod(camera) {

        // distance-based movement check
        const distanceThreshold = this._scene.gsplat.lodUpdateDistance;
        const currentCameraPos = camera.getPosition();
        const cameraMoved = this._lastLodCameraPos.distance(currentCameraPos) > distanceThreshold;
        if (cameraMoved) {
            return true;
        }

        // rotation-based movement check (optional)
        let cameraRotated = false;
        const lodUpdateAngleDeg = this._scene.gsplat.lodUpdateAngle;
        if (lodUpdateAngleDeg > 0) {
            if (Number.isFinite(this._lastLodCameraFwd.x)) {
                const currentCameraFwd = camera.forward;
                const dot = Math.min(1, Math.max(-1, this._lastLodCameraFwd.dot(currentCameraFwd)));
                const angle = Math.acos(dot);
                const rotThreshold = lodUpdateAngleDeg * math.DEG_TO_RAD;
                cameraRotated = angle > rotThreshold;
            } else {
                // first run, force update to initialize last orientation
                cameraRotated = true;
            }
        }

        // FOV change check (trigger when FOV differs by more than ~2%)
        const currentFov = camera.camera.fov;
        const fovChanged = this._lastLodCameraFov < 0 ||
            Math.abs(currentFov - this._lastLodCameraFov) > this._lastLodCameraFov * 0.02;

        return cameraMoved || cameraRotated || fovChanged;
    }

    /**
     * Updates the camera tracking state for color accumulation calculations.
     *
     * @param {GraphNode} camera - The primary camera.
     */
    updateColorCameraTracking(camera) {
        this._lastColorUpdateCameraPos.copy(camera.getPosition());
    }

    /**
     * Determines the colorization mode for rendering based on debug flags.
     *
     * @returns {Array<number[]>|undefined} Color array for debug visualization, or undefined for normal rendering.
     */
    getDebugColors() {
        const debug = this._scene.gsplat.debug;
        if (debug === GSPLAT_DEBUG_SH_UPDATE) {
            _randomColorRaw ??= [];
            const r = Math.random();
            const g = Math.random();
            const b = Math.random();
            for (let i = 0; i < _lodColorsRaw.length; i++) {
                _randomColorRaw[i] ??= [0, 0, 0];
                _randomColorRaw[i][0] = r;
                _randomColorRaw[i][1] = g;
                _randomColorRaw[i][2] = b;
            }
            return _randomColorRaw;
        } else if (debug === GSPLAT_DEBUG_LOD) {
            return _lodColorsRaw;
        }
        return undefined;
    }

    /**
     * Calculates camera translation delta since last color update. Updates and returns the shared
     * _cameraDeltas object.
     *
     * @param {GraphNode} camera - The primary camera.
     * @returns {{ translationDelta: number }} Shared camera movement deltas object.
     */
    calculateColorCameraDeltas(camera) {
        _cameraDeltas.translationDelta = 0;

        // Skip delta calculation on first frame (camera position not yet initialized)
        if (isFinite(this._lastColorUpdateCameraPos.x)) {
            const currentCameraPos = camera.getPosition();
            _cameraDeltas.translationDelta = this._lastColorUpdateCameraPos.distance(currentCameraPos);
        }

        return _cameraDeltas;
    }

    /**
     * Computes max world-space distance across all octree instances. Used for sqrt-based bucket
     * distribution in budget balancing.
     *
     * @param {GraphNode} camera - The primary camera.
     * @returns {number} Maximum world-space distance, minimum 1 to avoid division by zero.
     * @private
     */
    computeGlobalMaxDistance(camera) {
        let maxDist = 0;
        cameraPosition.copy(camera.getPosition());

        for (const [, inst] of this._octreeInstances) {
            const worldTransform = inst.placement.node.getWorldTransform();
            const aabb = inst.placement.aabb;

            // Transform center to world space and add bounding sphere radius
            worldTransform.transformPoint(aabb.center, _tempVec3);
            const scale = worldTransform.getScale().x;
            const dist = _tempVec3.distance(cameraPosition) + aabb.halfExtents.length() * scale;
            if (dist > maxDist) maxDist = dist;
        }

        return Math.max(maxDist, 1);
    }

    /**
     * Enforces global splat budget across all octree instances using a phased approach.
     *
     * @param {number} budget - Target splat budget from GSplatParams.splatBudget.
     * @param {GraphNode} camera - The primary camera.
     * @private
     */
    _enforceBudget(budget, camera) {
        // Work buffer texture dimensions for row-alignment padding calculation
        const textureWidth = this._workBuffer.textureSize;

        // Phase 0: Calculate fixed splats and padding from non-octree components
        let fixedSplats = 0;
        let paddingEstimate = 0;
        for (const p of this._layerPlacements) {
            const resource = /** @type {GSplatResourceBase} */ (p.resource);
            if (resource) {
                const numSplats = resource.numSplats ?? 0;
                fixedSplats += numSplats;
                paddingEstimate += (textureWidth - (numSplats % textureWidth)) % textureWidth;
            }
        }

        // Remaining budget for octrees after accounting for fixed splats.
        const octreeBudget = Math.max(1, budget - fixedSplats);

        // Compute global max distance for distance bucket calculation
        const globalMaxDistance = this.computeGlobalMaxDistance(camera);

        // Phase 2: Evaluate optimal LODs for all octrees and calculate padding for active placements
        let totalOptimalSplats = 0;
        for (const [, inst] of this._octreeInstances) {
            totalOptimalSplats += inst.evaluateOptimalLods(camera, this._scene.gsplat, this._budgetScale, globalMaxDistance);
            for (const placement of inst.activePlacements) {
                const resource = /** @type {GSplatResourceBase} */ (placement.resource);
                const numSplats = resource?.numSplats ?? 0;
                paddingEstimate += (textureWidth - (numSplats % textureWidth)) % textureWidth;
            }
        }

        // Adjust budget for estimated padding overhead
        const adjustedBudget = Math.max(1, octreeBudget - paddingEstimate);

        // Adapt _budgetScale to bring LOD estimates closer to budget by uniformly shifting LOD
        // boundaries.
        if (totalOptimalSplats > 0) {
            const ratio = totalOptimalSplats / adjustedBudget;
            const budgetScaleDeadZone = 0.4;
            const budgetScaleBlendRate = 0.3;
            if (ratio > 1 + budgetScaleDeadZone || ratio < 1 - budgetScaleDeadZone) {
                const invCorrection = 1 / Math.sqrt(ratio);
                this._budgetScale *= 1 + (invCorrection - 1) * budgetScaleBlendRate;
                this._budgetScale = Math.max(0.01, Math.min(this._budgetScale, 100.0));
            }
        }

        // Budget balancing across all octrees
        this._budgetBalancer.balance(this._octreeInstances, adjustedBudget);

        // Apply LOD changes
        for (const [, inst] of this._octreeInstances) {
            const maxLod = inst.octree.lodLevels - 1;
            inst.applyLodChanges(maxLod, this._scene.gsplat);
        }
    }

    /**
     * Computes the world-space union of all placement AABBs. Returns the shared bounding box, or
     * null if there are no placements. The manager applies it to the renderer's mesh instance.
     *
     * @returns {BoundingBox|null} The aggregate AABB, or null.
     */
    computeAggregateAabb() {
        let initialized = false;
        const layerPlacements = this._layerPlacements;
        for (let i = 0; i < layerPlacements.length; i++) {
            initialized = this._accumulatePlacementAabb(layerPlacements[i], initialized);
        }
        for (const [, inst] of this._octreeInstances) {
            initialized = this._accumulatePlacementAabb(inst.placement, initialized);
        }
        return initialized ? _meshInstanceAabb : null;
    }

    /**
     * Accumulates a placement's transformed AABB into the running mesh-instance AABB.
     *
     * @param {GSplatPlacement} placement - The placement.
     * @param {boolean} initialized - Whether the running AABB has been initialized.
     * @returns {boolean} The updated initialized flag.
     * @private
     */
    _accumulatePlacementAabb(placement, initialized) {
        const a = placement.aabb;
        if (!a) return initialized;
        _tempPlacementAabb.setFromTransformedAabb(a, placement.node.getWorldTransform());
        if (initialized) {
            _meshInstanceAabb.add(_tempPlacementAabb);
        } else {
            _meshInstanceAabb.copy(_tempPlacementAabb);
        }
        return true;
    }

    /**
     * Ticks octree cooldown timers once per frame per unique octree.
     */
    tickCooldowns() {
        if (this._octreeInstances.size) {
            const cooldownTicks = this._scene.gsplat.cooldownTicks;
            for (const [, inst] of this._octreeInstances) {
                const octree = inst.octree;
                if (!tempOctreesTicked.has(octree)) {
                    tempOctreesTicked.add(octree);
                    octree.updateCooldownTick(cooldownTicks);
                }
            }
            tempOctreesTicked.clear();
        }
    }

    /**
     * Forces LOD re-evaluation on all octree instances (e.g. after frame:ready listeners changed
     * params).
     */
    markInstancesNeedLodUpdate() {
        for (const [, inst] of this._octreeInstances) {
            inst.needsLodUpdate = true;
        }
    }

    /**
     * Prepares sort parameters data for the sorter worker. Reads world-state data; the manager owns
     * the sorter and posts the result.
     *
     * @param {GSplatWorldState} worldState - The world state containing all needed data.
     * @returns {object} Data for the sorter worker.
     */
    prepareSortParameters(worldState) {
        return {
            command: 'intervals',
            textureSize: worldState.textureSize,
            totalActiveSplats: worldState.totalActiveSplats,
            version: worldState.version,
            ids: worldState.splats.map(splat => splat.resource.id),
            pixelOffsets: worldState.splats.map(splat => splat.intervalOffsets),

            // TODO: consider storing this in typed array and transfer it to sorter worker
            intervals: worldState.splats.map(splat => splat.intervals)
        };
    }
}

export { GSplatWorld };
