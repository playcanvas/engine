import { math } from '../../core/math/math.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { GraphNode } from '../graph-node.js';
import { GSplatInfo } from './gsplat-info.js';
import { GSplatUnifiedSorter } from './gsplat-unified-sorter.js';
import { GSplatWorkBuffer } from './gsplat-work-buffer.js';
import { GSplatQuadRenderer } from './gsplat-quad-renderer.js';
import { GSplatComputeLocalRenderer } from './gsplat-compute-local-renderer.js';
import { GSplatOctreeInstance } from './gsplat-octree-instance.js';
import { GSplatOctreeResource } from './gsplat-octree.resource.js';
import { GSplatWorldState } from './gsplat-world-state.js';
import { GSplatPlacementStateTracker } from './gsplat-placement-state-tracker.js';
import { GSplatSortKeyCompute } from './gsplat-sort-key-compute.js';
import { GSplatIntervalCompaction } from './gsplat-interval-compaction.js';
import { ComputeRadixSort } from '../graphics/compute-radix-sort.js';
import { Debug } from '../../core/debug.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import {
    GSPLAT_RENDERER_RASTER_CPU_SORT, GSPLAT_RENDERER_RASTER_GPU_SORT, GSPLAT_RENDERER_COMPUTE,
    GSPLAT_DEBUG_LOD, GSPLAT_DEBUG_SH_UPDATE, GSPLAT_DEBUG_AABBS
} from '../constants.js';
import { Color } from '../../core/math/color.js';
import { GSplatBudgetBalancer } from './gsplat-budget-balancer.js';
import { BlockAllocator } from '../../core/block-allocator.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { StorageBuffer } from '../../platform/graphics/storage-buffer.js'
 * @import { GSplatPlacement } from './gsplat-placement.js'
 * @import { GSplatResourceBase } from '../gsplat/gsplat-resource-base.js'
 * @import { Scene } from '../scene.js'
 * @import { Layer } from '../layer.js'
 * @import { GSplatDirector } from './gsplat-director.js'
 * @import { MemBlock } from '../../core/block-allocator.js'
 * @import { GSplatRenderer } from './gsplat-renderer.js'
 */

const cameraPosition = new Vec3();
const cameraDirection = new Vec3();
const translation = new Vec3();
const _tempVec3 = new Vec3();
const invModelMat = new Mat4();
const tempNonOctreePlacements = new Set();
const tempOctreePlacements = new Set();
const _updatedSplats = [];
const _splatsWithSH = [];
const _changedColorAllocIds = new Set();
const _cameraDeltas = { translationDelta: 0 };
const _localCamPos = new Vec3();
const _closestPt = new Vec3();
const tempOctreesTicked = new Set();
const _queuedSplats = new Set();

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

// Color instances used by debug wireframe rendering
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

let _randomColorRaw = null;

/**
 * GSplatManager manages the rendering of splats using a work buffer, where all active splats are
 * stored and rendered from.
 *
 * Shared culling + compaction (GPU sorting and compute renderer, WebGPU only):
 *   Interval compaction operates on contiguous intervals of splats (one per octree node).
 *   1. Cull + count (compute): each interval's bounding sphere is tested against frustum
 *      planes (or a fisheye cone). The pass writes the interval's splat count (or 0 if
 *      culled) into a count buffer.
 *   2. Prefix sum: exclusive prefix sum over the count buffer produces output offsets.
 *      The last element gives visibleCount.
 *   3. Scatter (compute): one workgroup per interval expands visible intervals into
 *      compactedSplatIds (flat list of work-buffer pixel indices).
 *
 * Raster renderer — GPU sorting (WebGPU, {@link GSplatQuadRenderer}):
 *   Uses shared steps 1-3 above, then:
 *   4. Generate sort keys: an indirect compute dispatch (visibleCount threads) reads each
 *      compactedSplatIds[i] to look up the splat's depth and writes a sort key to keysBuffer.
 *   5. Radix sort: an indirect GPU radix sort over keysBuffer, with compactedSplatIds supplied
 *      as initial values, produces a buffer of sorted splat IDs directly.
 *   6. Render: the vertex shader reads sortedSplatIds[vertexId] → splatId.
 *
 * Raster renderer — CPU sorting (WebGPU and WebGL, {@link GSplatQuadRenderer}):
 *   1. Sort on worker: camera position and splat centers are sent to a web worker which
 *      performs a counting sort and returns the sorted order as orderBuffer.
 *   2. Render: the vertex shader reads orderBuffer[vertexId] → splatId.
 *      No culling or compaction is used.
 *
 * Compute tiled renderer (WebGPU only, {@link GSplatComputeLocalRenderer}):
 *   Uses shared steps 1-3 above, then runs a fully compute-based tiled pipeline:
 *   project splats into a cache, bin into screen tiles, sort per-tile by depth, and rasterize
 *   front-to-back. See {@link GSplatComputeLocalRenderer} for the full pass breakdown.
 *
 * @ignore
 */
class GSplatManager {
    /** @type {GraphicsDevice} */
    device;

    /** @type {GraphNode} */
    node = new GraphNode('GSplatManager');

    /** @type {GSplatWorkBuffer} */
    workBuffer;

    /** @type {GSplatRenderer} */
    renderer;

    /**
     * A map of versioned world states, keyed by version.
     *
     * @type {Map<number, GSplatWorldState>}
     */
    worldStates = new Map();

    /**
     * The version of the last world state.
     */
    lastWorldStateVersion = 0;

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
     * GPU-based key generator (when using GPU sorting).
     *
     * @type {GSplatSortKeyCompute|null}
     */
    keyGenerator = null;

    /**
     * GPU-based radix sorter (when using GPU sorting).
     *
     * @type {ComputeRadixSort|null}
     */
    gpuSorter = null;

    /**
     * Interval-based GPU compaction (always-on for GPU sort path).
     *
     * @type {GSplatIntervalCompaction|null}
     */
    intervalCompaction = null;

    /**
     * Indirect draw slot index for the current frame (-1 when not using indirect draw).
     */
    indirectDrawSlot = -1;

    /**
     * Indirect dispatch slot index for GPU-sort indirect dispatch args.
     * Slot +0 = key gen, slot +1 = sort. The compute local renderer builds
     * its own indirect args in private buffers and does not use these slots.
     */
    indirectDispatchSlot = -1;

    /**
     * Total intervals from the last interval compaction dispatch. Needed for
     * writeIndirectArgs to index into the prefix sum buffer for visible count.
     */
    lastCompactedNumIntervals = 0;

    /** @type {number} */
    sortedVersion = 0;

    /**
     * When true, suppresses ready=true in frame:ready until a fullUpdate cycle runs.
     * Only set when octreeInstances exist and params change (dirty).
     *
     * @private
     */
    _awaitingLodUpdate = false;

    /**
     * Cached work buffer format version for detecting extra stream changes.
     *
     * @private
     */
    _workBufferFormatVersion = -1;

    /**
     * Flag set when the work buffer needs a full rebuild due to format changes.
     *
     * @private
     */
    _workBufferRebuildRequired = false;

    /**
     * Number of blocks uploaded to the work buffer this frame.
     */
    bufferCopyUploaded = 0;

    /**
     * Total number of blocks in the work buffer this frame.
     */
    bufferCopyTotal = 0;

    /**
     * Tracks placement state changes (format version, modifier hash, numSplats, centersVersion).
     *
     * @type {GSplatPlacementStateTracker}
     * @private
     */
    _stateTracker = new GSplatPlacementStateTracker();

    /**
     * Tracks last seen centersVersion per resource ID for detecting centers updates.
     *
     * @type {Map<number, number>}
     * @private
     */
    _centersVersions = new Map();

    /** @type {number} */
    framesTillFullUpdate = 0;

    /** @type {Vec3} */
    lastLodCameraPos = new Vec3(Infinity, Infinity, Infinity);

    /** @type {Vec3} */
    lastLodCameraFwd = new Vec3(Infinity, Infinity, Infinity);

    /** @type {number} */
    lastLodCameraFov = -1;

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

    /**
     * Budget balancer for global splat budget enforcement.
     *
     * @type {GSplatBudgetBalancer}
     * @private
     */
    _budgetBalancer = new GSplatBudgetBalancer();

    /**
     * Dynamic scale factor applied to LOD parameters during budget enforcement. Shifts all
     * LOD boundaries uniformly to bring the initial estimate closer to the budget target,
     * reducing balancer work. Applied directly to lodBaseDistance and gently to lodMultiplier.
     * Values > 1 push boundaries outward (more splats), values < 1 pull them inward
     * (fewer splats).
     *
     * @private
     */
    _budgetScale = 1.0;

    /**
     * Persistent block allocator for work buffer pixel allocations. Grows on demand.
     *
     * @type {BlockAllocator}
     * @private
     */
    _allocator;

    /**
     * Maps allocId (from GSplatPlacement) to the corresponding MemBlock in the allocator.
     * Shared with GSplatWorldState constructors which mutate it during diff.
     *
     * @type {Map<number, MemBlock>}
     * @private
     */
    _allocationMap = new Map();

    /** @type {Vec3} */
    lastColorUpdateCameraPos = new Vec3(Infinity, Infinity, Infinity);

    /** @type {GraphNode} */
    cameraNode;

    /** @type {Scene} */
    scene;

    /**
     * Layer placements, only non-octree placements are included.
     *
     * @type {GSplatPlacement[]}
     */
    layerPlacements = [];

    /** @type {boolean} */
    layerPlacementsDirty = false;

    /**
     * True when placements have been added or removed since the last world state was created.
     * Triggers a full work buffer rebuild so boundsBaseIndex stays consistent.
     *
     * @private
     */
    _placementSetChanged = false;

    /** @type {Map<GSplatPlacement, GSplatOctreeInstance>} */
    octreeInstances = new Map();

    /**
     * Octree instances scheduled for destruction. We collect their releases and destroy them
     * when creating the next world state
     *
     * @type {GSplatOctreeInstance[]}
     */
    octreeInstancesToDestroy = [];

    /**
     * Flag set when new octree instances are added, to trigger immediate LOD evaluation.
     */
    hasNewOctreeInstances = false;

    /**
     * Bitmask flags controlling which render passes this manager participates in.
     *
     * @type {number|undefined}
     */
    renderMode;

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

        // Pre-allocate the block allocator with headroom above the splat budget to reduce
        // early grows and fragmentation during initial scene loading.
        const allocatorGrowMultiplier = 1.15;
        const budget = this.scene.gsplat.splatBudget;
        this._allocator = new BlockAllocator(budget > 0 ? Math.ceil(budget * allocatorGrowMultiplier) : 0, allocatorGrowMultiplier);

        this.workBuffer = new GSplatWorkBuffer(device, this.scene.gsplat.format);

        this.layer = layer;
        this._createRenderer(this.scene.gsplat.currentRenderer);
        this._workBufferFormatVersion = this.workBuffer.format.extraStreamsVersion;
    }

    destroy() {
        this._destroyed = true;

        // Clean up all world states and decrement refs
        for (const [, worldState] of this.worldStates) {
            for (const splat of worldState.splats) {
                splat.resource.decRefCount();
            }
            worldState.destroy();
        }
        this.worldStates.clear();

        // Destroy all octree instances (they handle their own ref count cleanup)
        for (const [, instance] of this.octreeInstances) {
            instance.destroy();
        }
        this.octreeInstances.clear();

        // Also destroy any queued instances
        for (const instance of this.octreeInstancesToDestroy) {
            instance.destroy();
        }
        this.octreeInstancesToDestroy.length = 0;

        this.destroyGpuSorting();
        this.destroyCpuSorting();

        this.workBuffer.destroy();
        this.renderer.destroy();
    }

    /**
     * Destroys GPU sorting resources (key generator, radix sorter, compaction).
     *
     * @private
     */
    destroyGpuSorting() {
        this.keyGenerator?.destroy();
        this.keyGenerator = null;
        this.gpuSorter?.destroy();
        this.gpuSorter = null;

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
     * Creates GPU sorting resources (key generator, radix sorter) if not already present.
     *
     * @private
     */
    initGpuSorting() {
        if (!this.keyGenerator) {
            this.keyGenerator = new GSplatSortKeyCompute(this.device);
        }
        if (!this.gpuSorter) {
            this.gpuSorter = new ComputeRadixSort(this.device);
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
        const currentState = this.worldStates.get(this.sortedVersion);
        if (currentState) {
            currentState.sortParametersSet = false;
            currentState.sortedBefore = false;
            this.cpuSorter.updateCentersForSplats(currentState.splats);
        }

        // Switch renderer to CPU-sorted mode (also hides until update() restores visibility)
        this.renderer.setCpuSortedRendering();
    }

    get material() {
        return this.renderer.material;
    }

    /**
     * Dispatches compute pick pipeline and returns the configured pick mesh instance.
     * Only works when the local compute renderer is active.
     *
     * @param {object} camera - The camera.
     * @param {number} width - Pick target width.
     * @param {number} height - Pick target height.
     * @returns {import('../mesh-instance.js').MeshInstance|null} The pick mesh instance, or null.
     */
    prepareForPicking(camera, width, height) {
        if (this.activeRenderer !== GSPLAT_RENDERER_COMPUTE) return null;

        /** @type {GSplatComputeLocalRenderer} */
        const localRenderer = /** @type {any} */ (this.renderer);
        return localRenderer.dispatchPick(camera, width, height);
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
        return this.activeRenderer !== GSPLAT_RENDERER_RASTER_CPU_SORT &&
            this.workBuffer.frustumCuller.totalBoundsEntries > 0;
    }

    /**
     * Creates the renderer and sort resources for the given mode. Used at init time.
     *
     * @param {number} mode - The GSPLAT_RENDERER_* constant.
     * @private
     */
    _createRenderer(mode) {
        if (mode === GSPLAT_RENDERER_COMPUTE) {
            this.renderer = new GSplatComputeLocalRenderer(this.device, this.node, this.cameraNode, this.layer, this.workBuffer);
        } else {
            this.renderer = new GSplatQuadRenderer(this.device, this.node, this.cameraNode, this.layer, this.workBuffer);
            if (mode === GSPLAT_RENDERER_RASTER_GPU_SORT) {
                this.initGpuSorting();
            } else {
                this.initCpuSorting();
            }
        }
        this.activeRenderer = mode;
    }

    /**
     * Checks whether the resolved renderer mode has changed and transitions to the new mode.
     * Handles both sort-mode transitions (CPU <-> GPU sort) and full renderer swaps
     * (quad <-> compute).
     *
     * @private
     */
    prepareRendererMode() {
        const requested = this.scene.gsplat.currentRenderer;
        if (requested === this.activeRenderer) return;

        this.destroyGpuSorting();
        this.destroyCpuSorting();
        this.renderer.destroy();
        this._createRenderer(requested);
        this.renderer.setRenderMode(this.renderMode);
        this._workBufferRebuildRequired = true;
        this.sortNeeded = true;
    }

    /**
     * Supply the manager with the placements to use. This is used to update the manager when the
     * layer's placements have changed, called infrequently.
     *
     * @param {GSplatPlacement[]} placements - The placements to reconcile with.
     */
    reconcile(placements) {

        tempNonOctreePlacements.clear();
        for (const p of placements) {
            if (p.resource instanceof GSplatOctreeResource) {

                // make sure octree instance exists for placement
                if (!this.octreeInstances.has(p)) {
                    // @ts-ignore - p.resource is GSplatOctreeResource so octree cannot be null
                    this.octreeInstances.set(p, new GSplatOctreeInstance(this.device, p.resource.octree, p));

                    // mark that we have new instances that need initial LOD evaluation
                    this.hasNewOctreeInstances = true;
                }
                tempOctreePlacements.add(p);
            } else {
                // collect non-octree placement
                tempNonOctreePlacements.add(p);
            }
        }

        // remove octree instances that are no longer present and schedule them for destruction
        for (const [placement, inst] of this.octreeInstances) {
            if (!tempOctreePlacements.has(placement)) {
                this.octreeInstances.delete(placement);

                // mark world as dirty since octree set changed
                this.layerPlacementsDirty = true;
                this._placementSetChanged = true;

                // queue the instance to be processed during next world state creation
                this.octreeInstancesToDestroy.push(inst);
            }
        }

        // compute dirtiness of non-octree placements compared to existing layerPlacements
        this.layerPlacementsDirty ||= this.layerPlacements.length !== tempNonOctreePlacements.size;
        if (!this.layerPlacementsDirty) {
            for (let i = 0; i < this.layerPlacements.length; i++) {
                const existing = this.layerPlacements[i];
                if (!tempNonOctreePlacements.has(existing)) {
                    this.layerPlacementsDirty = true;
                    break;
                }
            }
        }
        this._placementSetChanged ||= this.layerPlacementsDirty;

        // update layerPlacements to new non-octree list
        this.layerPlacements.length = 0;
        for (const p of tempNonOctreePlacements) {
            this.layerPlacements.push(p);
        }

        // clear temporaries
        tempNonOctreePlacements.clear();
        tempOctreePlacements.clear();
    }

    updateWorldState() {

        // Check for state changes (format version, modifier hash, numSplats)
        let stateChanged = this._stateTracker.hasChanges(this.layerPlacements);
        for (const [, inst] of this.octreeInstances) {
            if (this._stateTracker.hasChanges(inst.activePlacements)) {
                stateChanged = true;
            }
        }

        // Recreate world state if there are changes
        const placementsChanged = this.layerPlacementsDirty;
        const worldChanged = placementsChanged || stateChanged || this.worldStates.size === 0;
        if (worldChanged) {
            this.lastWorldStateVersion++;
            const splats = [];

            // add standalone splats
            for (const p of this.layerPlacements) {
                p.ensureInstanceStreams(this.device);
                const splatInfo = new GSplatInfo(this.device, p.resource, p, p.consumeRenderDirty.bind(p));
                splats.push(splatInfo);
            }

            // add octree splats
            for (const [, inst] of this.octreeInstances) {
                inst.activePlacements.forEach((p) => {
                    if (p.resource) {
                        p.ensureInstanceStreams(this.device);
                        const octreeNodes = p.intervals.size > 0 ? inst.octree.nodes : null;
                        const nodeInfos = octreeNodes ? inst.nodeInfos : null;
                        const splatInfo = new GSplatInfo(this.device, p.resource, p, p.consumeRenderDirty.bind(p), octreeNodes, nodeInfos);
                        splats.push(splatInfo);
                    }
                });
            }

            // Check for centers version changes and force-update sorter for changed resources
            if (this.cpuSorter) {
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
            }

            // update cpu sorter with current splats (adds new centers, removes unused ones)
            this.cpuSorter?.updateCentersForSplats(splats);

            const newState = new GSplatWorldState(
                this.device, this.lastWorldStateVersion, splats,
                this._allocator, this._allocationMap
            );

            // increment ref count for all resources in new state
            for (const splat of newState.splats) {
                splat.resource.incRefCount();
            }

            // collect file-release requests from octree instances.
            for (const [, inst] of this.octreeInstances) {
                if (inst.removedCandidates && inst.removedCandidates.size) {
                    for (const fileIndex of inst.removedCandidates) {
                        // each entry represents a single decRef
                        // pending releases will be applied on onSorted for this state
                        newState.pendingReleases.push([inst.octree, fileIndex]);
                    }
                    inst.removedCandidates.clear();
                }
            }

            // handle destruction of octree instances
            if (this.octreeInstancesToDestroy.length) {
                for (const inst of this.octreeInstancesToDestroy) {

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
                this.octreeInstancesToDestroy.length = 0;
            }

            // When placements are added/removed, boundsBaseIndex values shift.
            // Force a full rebuild so no stale indices remain.
            if (this._placementSetChanged) {
                newState.fullRebuild = true;
            }

            this.worldStates.set(this.lastWorldStateVersion, newState);

            this.layerPlacementsDirty = false;
            this._placementSetChanged = false;

            // New world state requires sorting
            this.sortNeeded = true;
        }
    }

    onSorted(count, version, orderData) {

        // clean up old world states
        this.cleanupOldWorldStates(version);
        this.sortedVersion = version;

        // find the world state that has been sorted
        const worldState = this.worldStates.get(version);
        Debug.assert(worldState, `World state with version ${version} not found`);

        if (worldState) {

            // when a new version was sorted for the first time, we need to fully update work buffer
            // to match centers buffer / sorted data
            if (!worldState.sortedBefore) {
                worldState.sortedBefore = true;
                this.rebuildWorkBuffer(worldState, count);
            }

            // update order texture
            this.workBuffer.setOrderData(orderData);

            // update renderer with new order data
            this.renderer.setOrderData();
        }
    }

    /**
     * Rebuilds the work buffer for a world state on its first sort.
     * Resizes buffer, renders changed splats, syncs transforms, and handles pending releases.
     *
     * @param {GSplatWorldState} worldState - The world state to rebuild for.
     * @param {number} count - The number of splats.
     * @param {boolean} [forceFullRebuild] - Force rendering all splats (e.g. format change).
     */
    rebuildWorkBuffer(worldState, count, forceFullRebuild = false) {
        // resize work buffer if needed
        const textureSize = worldState.textureSize;
        if (textureSize !== this.workBuffer.textureSize) {
            this.workBuffer.resize(textureSize);
        }

        // Bounds and transforms storage buffers are needed for frustum culling,
        // which only runs with interval compaction (local renderer or GPU sorting).
        if (this.activeRenderer !== GSPLAT_RENDERER_RASTER_CPU_SORT) {
            this.workBuffer.frustumCuller.updateBoundsData(worldState.boundsGroups);
            this.workBuffer.frustumCuller.updateTransformsData(worldState.boundsGroups);
        }

        // Render splats to work buffer: full rebuild renders all, partial renders only changed
        const renderAll = forceFullRebuild || worldState.fullRebuild;
        const splatsToRender = renderAll ? worldState.splats : worldState.needsUpload;
        const changedAllocIds = renderAll ? null : worldState.needsUploadIds;

        if (splatsToRender.length > 0) {
            const totalBlocks = this._allocationMap.size;
            const uploadBlocks = renderAll ? totalBlocks : worldState.needsUploadIds.size;

            // accumulate buffer copy stats for this frame
            this.bufferCopyUploaded += uploadBlocks;
            this.bufferCopyTotal = totalBlocks;

            this.workBuffer.render(splatsToRender, this.cameraNode, this.getDebugColors(), changedAllocIds);
        }

        // update all splats to sync their transforms (prevents redundant re-render later)
        for (let i = 0; i < worldState.splats.length; i++) {
            worldState.splats[i].update();
        }

        // update camera tracking for color updates
        this.updateColorCameraTracking();

        // apply pending file-release requests
        if (worldState.pendingReleases && worldState.pendingReleases.length) {
            const cooldownTicks = this.scene.gsplat.cooldownTicks;
            for (const [octree, fileIndex] of worldState.pendingReleases) {
                // decrement once for each staged release; refcount system guards against premature unload
                octree.decRefCount(fileIndex, cooldownTicks);
            }
            worldState.pendingReleases.length = 0;
        }

        // number of splats to render
        this.renderer.update(count, textureSize);
    }

    /**
     * Cleans up old world states between the last sorted version and the new version.
     * Merges upload requirements from skipped states into the active state, then
     * decrements ref counts and destroys old states.
     *
     * @param {number} newVersion - The new version to clean up to.
     */
    cleanupOldWorldStates(newVersion) {
        const activeState = /** @type {GSplatWorldState} */ (/** @type {unknown} */ (this.worldStates.get(newVersion)));

        // Pass 1: propagate fullRebuild from skipped states
        if (!activeState.fullRebuild) {
            for (let v = this.sortedVersion + 1; v < newVersion; v++) {
                if (this.worldStates.get(v)?.fullRebuild) {
                    activeState.fullRebuild = true;
                    break;
                }
            }
        }

        // Pass 2: merge needsUpload from skipped states (skip if full rebuild).
        // Uses the active state's allocIdToSplat reverse map for O(changedIds) lookups
        // instead of scanning all splats.
        if (!activeState.fullRebuild) {
            const activeIds = activeState.needsUploadIds;
            const lookup = activeState.allocIdToSplat;
            for (let v = this.sortedVersion + 1; v < newVersion; v++) {
                const oldState = this.worldStates.get(v);
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
        for (let v = this.sortedVersion; v < newVersion; v++) {
            const oldState = this.worldStates.get(v);
            if (oldState) {
                // decrement ref count for all resources in old state
                for (const splat of oldState.splats) {
                    splat.resource.decRefCount();
                }
                this.worldStates.delete(v);
                oldState.destroy();
            }
        }
    }

    /**
     * Applies incremental work buffer updates for splats that have changed.
     * Detects transform changes and color update thresholds, then batch renders updates.
     * Sets sortNeeded = true when splats move.
     *
     * @param {GSplatWorldState} state - The world state to update.
     */
    applyWorkBufferUpdates(state) {
        // color update thresholds
        const { colorUpdateAngle } = this.scene.gsplat;
        const ratio = Math.tan(colorUpdateAngle * math.DEG_TO_RAD);
        const cameraPos = this.cameraNode.getPosition();

        // Calculate camera movement deltas for color updates
        const { translationDelta } = this.calculateColorCameraDeltas();
        const hasCameraMovement = translationDelta > 0;

        // check each splat for full or color update
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
                this.sortNeeded = true;

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
        this.bufferCopyUploaded += uploadedBlocks;
        this.bufferCopyTotal = this._allocationMap.size;

        // Batch render all updated splats in a single render pass
        if (_updatedSplats.length > 0) {
            this.workBuffer.render(_updatedSplats, this.cameraNode, this.getDebugColors());
            _updatedSplats.length = 0;
        }

        // Batch render color updates for nodes that exceeded angle thresholds
        if (_changedColorAllocIds.size > 0) {
            this.workBuffer.renderColor(
                _splatsWithSH, this.cameraNode, this.getDebugColors(),
                _changedColorAllocIds
            );
            _changedColorAllocIds.clear();
        }
        _splatsWithSH.length = 0;
    }

    /**
     * Tests if the camera has moved or rotated enough to require LOD update.
     *
     * @returns {boolean} True if camera moved/rotated over thresholds, otherwise false.
     */
    testCameraMovedForLod() {

        // distance-based movement check
        const distanceThreshold = this.scene.gsplat.lodUpdateDistance;
        const currentCameraPos = this.cameraNode.getPosition();
        const cameraMoved = this.lastLodCameraPos.distance(currentCameraPos) > distanceThreshold;
        if (cameraMoved) {
            return true;
        }

        // rotation-based movement check (optional)
        let cameraRotated = false;
        const lodUpdateAngleDeg = this.scene.gsplat.lodUpdateAngle;
        if (lodUpdateAngleDeg > 0) {
            if (Number.isFinite(this.lastLodCameraFwd.x)) {
                const currentCameraFwd = this.cameraNode.forward;
                const dot = Math.min(1, Math.max(-1, this.lastLodCameraFwd.dot(currentCameraFwd)));
                const angle = Math.acos(dot);
                const rotThreshold = lodUpdateAngleDeg * math.DEG_TO_RAD;
                cameraRotated = angle > rotThreshold;
            } else {
                // first run, force update to initialize last orientation
                cameraRotated = true;
            }
        }

        // FOV change check (trigger when FOV differs by more than ~2%)
        const currentFov = this.cameraNode.camera.fov;
        const fovChanged = this.lastLodCameraFov < 0 ||
            Math.abs(currentFov - this.lastLodCameraFov) > this.lastLodCameraFov * 0.02;

        return cameraMoved || cameraRotated || fovChanged;
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
     * Updates the camera tracking state for color accumulation calculations.
     * Called after any render that updates colors (full or color-only).
     */
    updateColorCameraTracking() {
        this.lastColorUpdateCameraPos.copy(this.cameraNode.getPosition());
    }

    /**
     * Determines the colorization mode for rendering based on debug flags.
     *
     * @returns {Array<number[]>|undefined} Color array for debug visualization, or undefined for normal rendering
     */
    getDebugColors() {
        const debug = this.scene.gsplat.debug;
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
     * Calculates camera translation delta since last color update.
     * Updates and returns the shared _cameraDeltas object.
     *
     * @returns {{ translationDelta: number }} Shared camera movement deltas object
     */
    calculateColorCameraDeltas() {
        _cameraDeltas.translationDelta = 0;

        // Skip delta calculation on first frame (camera position not yet initialized)
        if (isFinite(this.lastColorUpdateCameraPos.x)) {
            const currentCameraPos = this.cameraNode.getPosition();
            _cameraDeltas.translationDelta = this.lastColorUpdateCameraPos.distance(currentCameraPos);
        }

        return _cameraDeltas;
    }

    /**
     * Fires the frame:ready event with current sorting and loading state.
     */
    fireFrameReadyEvent() {
        const ready = this.sortedVersion === this.lastWorldStateVersion && !this._awaitingLodUpdate;

        // Count total pending loads from octree instances (including environment)
        let loadingCount = 0;
        for (const [, inst] of this.octreeInstances) {
            loadingCount += inst.pendingLoadCount;
        }

        this.director.eventHandler.fire('frame:ready', this.cameraNode.camera, this.renderer.layer, ready, loadingCount);
    }

    /**
     * Computes max world-space distance across all octree instances. Used for sqrt-based bucket
     * distribution in budget balancing. Non-octree placements are excluded since they have fixed
     * splat counts and don't participate in LOD-based budget balancing.
     *
     * @returns {number} Maximum world-space distance, minimum 1 to avoid division by zero.
     * @private
     */
    computeGlobalMaxDistance() {
        let maxDist = 0;
        cameraPosition.copy(this.cameraNode.getPosition());

        for (const [, inst] of this.octreeInstances) {
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
     * Enforces global splat budget across all octree instances using phased approach.
     *
     * @param {number} budget - Target splat budget from GSplatParams.splatBudget.
     * @private
     */
    _enforceBudget(budget) {
        // Work buffer texture dimensions for row-alignment padding calculation
        const textureWidth = this.workBuffer.textureSize;

        // Phase 0: Calculate fixed splats and padding from non-octree components
        // These have no LOD system, so their splat count is fixed
        let fixedSplats = 0;
        let paddingEstimate = 0;
        for (const p of this.layerPlacements) {
            const resource = /** @type {GSplatResourceBase} */ (p.resource);
            if (resource) {
                const numSplats = resource.numSplats ?? 0;
                fixedSplats += numSplats;
                // Each placement's data starts at a new row, padding = unused pixels in last row
                paddingEstimate += (textureWidth - (numSplats % textureWidth)) % textureWidth;
            }
        }

        // Remaining budget for octrees after accounting for fixed splats. Use Math.max(1, ...) to
        // ensure budget enforcement stays active even when fixed splats consume all budget - 0 would
        // disable enforcement, but 1 forces octrees to use minimum LOD (coarsest quality)
        const octreeBudget = Math.max(1, budget - fixedSplats);

        // Compute global max distance for distance bucket calculation
        const globalMaxDistance = this.computeGlobalMaxDistance();

        // Phase 2: Evaluate optimal LODs for all octrees and calculate padding for active placements
        let totalOptimalSplats = 0;
        for (const [, inst] of this.octreeInstances) {
            totalOptimalSplats += inst.evaluateOptimalLods(this.cameraNode, this.scene.gsplat, this._budgetScale);
            for (const placement of inst.activePlacements) {
                const resource = /** @type {GSplatResourceBase} */ (placement.resource);
                const numSplats = resource?.numSplats ?? 0;
                paddingEstimate += (textureWidth - (numSplats % textureWidth)) % textureWidth;
            }
        }

        // Adjust budget for estimated padding overhead
        // Note: This is an estimate based on current active placements; actual work buffer
        // content may change after LOD evaluation applies changes
        const adjustedBudget = Math.max(1, octreeBudget - paddingEstimate);

        // Adapt _budgetScale to bring LOD estimates closer to budget by uniformly shifting
        // all LOD boundaries. Larger base distance → more nodes at LOD 0 → more splats, so:
        // under budget (ratio < 1) → increase scale, over budget (ratio > 1) → decrease scale.
        // The scale intentionally targets ~60-140% of budget (wide dead zone), leaving the
        // balancer to handle the remaining gap with per-node adjustments.
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
        this._budgetBalancer.balance(this.octreeInstances, adjustedBudget, globalMaxDistance);

        // Apply LOD changes
        for (const [, inst] of this.octreeInstances) {
            const maxLod = inst.octree.lodLevels - 1;
            inst.applyLodChanges(maxLod, this.scene.gsplat);
        }
    }

    /**
     * Detects if the work buffer format has been replaced (e.g. dataFormat changed) and
     * recreates the work buffer if needed.
     *
     * @private
     */
    handleFormatChange() {
        const currentFormat = this.scene.gsplat.format;
        if (this.workBuffer.format !== currentFormat) {
            this.workBuffer.destroy();
            this.workBuffer = new GSplatWorkBuffer(this.device, currentFormat);
            this.renderer.setDataSource(this.workBuffer);
            this._workBufferFormatVersion = this.workBuffer.format.extraStreamsVersion;
            this._workBufferRebuildRequired = true;
            this.sortNeeded = true;
        }
    }

    update() {

        // reset per-frame buffer copy stats
        this.bufferCopyUploaded = 0;
        this.bufferCopyTotal = 0;

        this.handleFormatChange();

        // detect work buffer format changes (extra streams added) and schedule a full rebuild
        const wbFormatVersion = this.workBuffer.format.extraStreamsVersion;
        if (this._workBufferFormatVersion !== wbFormatVersion) {
            this._workBufferFormatVersion = wbFormatVersion;
            this.workBuffer.syncWithFormat();
            this._workBufferRebuildRequired = true;
            this.sortNeeded = true;
        }

        // Check for runtime renderer mode changes and transition if needed.
        this.prepareRendererMode();

        // apply any pending sorted results (CPU path only)
        if (this.cpuSorter) {
            this.cpuSorter.applyPendingSorted();
        }

        // GPU sorting is always ready, CPU sorting is ready if not too many jobs in flight
        const sorterAvailable = this.activeRenderer !== GSPLAT_RENDERER_RASTER_CPU_SORT || (this.cpuSorter && this.cpuSorter.jobsInFlight < 3);

        // full update every 10 frames
        let fullUpdate = false;
        this.framesTillFullUpdate--;
        if (this.framesTillFullUpdate <= 0) {
            this.framesTillFullUpdate = 10;

            if (sorterAvailable) {
                fullUpdate = true;
            }
        }

        // when new octree instances are added, we need to evaluate their LOD immediately
        const hasNewInstances = this.hasNewOctreeInstances && sorterAvailable;
        if (hasNewInstances) this.hasNewOctreeInstances = false;

        let anyInstanceNeedsLodUpdate = false;
        let anyOctreeMoved = false;
        let cameraMovedOrRotatedForLod = false;
        if (fullUpdate) {

            // process any pending / prefetch resource completions and collect LOD updates
            for (const [, inst] of this.octreeInstances) {

                const isDirty = inst.update();
                this.layerPlacementsDirty ||= isDirty;
                this._placementSetChanged ||= inst.consumePlacementSetChanged();

                const instNeeds = inst.consumeNeedsLodUpdate();
                anyInstanceNeedsLodUpdate ||= instNeeds;
            }

            // Validate that resources in use haven't been unexpectedly destroyed
            Debug.call(() => {
                const sortedState = this.worldStates.get(this.sortedVersion);
                if (sortedState) {
                    for (const splat of sortedState.splats) {
                        // Check if resource reference is null or undefined
                        if (!splat.resource) {
                            Debug.warn(`GSplatManager: Resource reference is null but still referenced in world state ${sortedState.version}`);
                        }
                    }
                }
            });

            // check if any octree instances have moved enough to require LOD update
            const threshold = this.scene.gsplat.lodUpdateDistance;
            for (const [, inst] of this.octreeInstances) {
                const moved = inst.testMoved(threshold);
                anyOctreeMoved ||= moved;
            }

            // check if camera has moved/rotated enough to require LOD update
            cameraMovedOrRotatedForLod = this.testCameraMovedForLod();

            this._awaitingLodUpdate = false;
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

        Debug.call(() => {
            for (const [, inst] of this.octreeInstances) {
                inst.debugRender(this.scene);
            }
        });

        // if parameters are dirty, rebuild world state
        if (this.scene.gsplat.dirty) {
            this.layerPlacementsDirty = true;
            this.renderer.updateOverdrawMode(this.scene.gsplat);

            // Re-render all splats into the work buffer so persistent data (e.g. debug
            // colorization) is refreshed immediately instead of trickling in over time.
            this._workBufferRebuildRequired = true;
            this.sortNeeded = true;

            // Suppress ready=true in frame:ready until a fullUpdate cycle runs, so
            // consumers can reliably detect the not-ready→ready transition after param changes.
            if (this.octreeInstances.size > 0) {
                this._awaitingLodUpdate = true;
            }
        }

        // when camera or octree need LOD evaluated, or params are dirty, or resources completed, or new instances added
        if (cameraMovedOrRotatedForLod || anyOctreeMoved || this.scene.gsplat.dirty || anyInstanceNeedsLodUpdate || hasNewInstances) {

            // update the previous position where LOD was evaluated for octree instances
            for (const [, inst] of this.octreeInstances) {
                inst.updateMoved();
            }

            // update last camera data when LOD was evaluated
            const cameraNode = this.cameraNode;
            this.lastLodCameraPos.copy(cameraNode.getPosition());
            this.lastLodCameraFwd.copy(cameraNode.forward);
            this.lastLodCameraFov = cameraNode.camera.fov;

            const budget = this.scene.gsplat.splatBudget;

            if (budget > 0) {
                // Global budget enforcement
                this._enforceBudget(budget);
            } else {
                // Budget disabled - use LOD distances only, no budget adjustments
                this._budgetScale = 1.0;
                for (const [, inst] of this.octreeInstances) {
                    inst.updateLod(this.cameraNode, this.scene.gsplat);
                }
            }
        }

        // create new world state if needed
        this.updateWorldState();

        // update sorter with new world state
        const lastState = this.worldStates.get(this.lastWorldStateVersion);
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

                const payload = this.prepareSortParameters(lastState);
                this.cpuSorter.setSortParameters(payload);
            }

        }

        // Apply work buffer updates first (both GPU and CPU)
        // For GPU: ensures sort uses current data
        // Skip when sortedBefore is false — the state is waiting for fresh sort data
        // (e.g. after switching from GPU to CPU sorting) and rendering with stale
        // order data would produce incorrect frames.
        const sortedState = this.worldStates.get(this.sortedVersion);
        if (sortedState?.sortedBefore) {
            if (this._workBufferRebuildRequired) {
                const count = sortedState.totalActiveSplats;
                this.rebuildWorkBuffer(sortedState, count, true);
                this._workBufferRebuildRequired = false;

                // rebuildWorkBuffer may resize, which destroys/recreates orderBuffer — rebind it
                this.renderer.setOrderData();

                // boundsBaseIndex may have changed — force interval metadata re-upload
                if (this.intervalCompaction) {
                    this.intervalCompaction._uploadedVersion = -1;
                }
            } else {
                this.applyWorkBufferUpdates(sortedState);
            }
        }

        // kick off sorting / compaction only if needed
        let gpuSortedThisFrame = false;
        if (this.sortNeeded && lastState) {
            if (this.activeRenderer === GSPLAT_RENDERER_COMPUTE) {
                // Compute renderer: run compaction only (no key generation or radix sort)
                this.compactGpu(lastState);
                gpuSortedThisFrame = true;
            } else if (this.activeRenderer === GSPLAT_RENDERER_RASTER_GPU_SORT) {
                // GPU sort runs compaction internally, so indirect draw is always valid
                this.sortGpu(lastState);
                gpuSortedThisFrame = true;
            } else {
                // CPU sort just posts to the worker — indirect draw still needs updating below
                this.sortCpu(lastState);
            }
            this.sortNeeded = false;

            // Update camera tracking for next sort check
            this.lastSortCameraPos.copy(this.cameraNode.getPosition());
            this.lastSortCameraFwd.copy(this.cameraNode.forward);

            // Sort implies culling was also processed, so update culling trackers too
            this.lastCullingCameraFwd.copy(this.cameraNode.forward);
            this.lastCullingProjMat.copy(this.cameraNode.camera.projectionMatrix);
        }

        // Refresh the per-frame indirect draw slot on non-sort frames
        // (sortGpu already handled GPU-sort frames).
        if (this.activeRenderer !== GSPLAT_RENDERER_COMPUTE && this.intervalCompaction && !gpuSortedThisFrame) {
            this.refreshIndirectDraw();
        }

        // renderer per-frame update (material syncing, deferred setup)
        const fogParams = this.scene.gsplat.useFog ? (this.cameraNode.camera.fogParams ?? this.scene.fog) : null;
        this.renderer.frameUpdate(this.scene.gsplat, this.scene.exposure, fogParams);

        // camera tracking only after first sort
        if (sortedState?.sortedBefore) {
            this.updateColorCameraTracking();
        }

        // tick cooldowns once per frame per unique octree
        if (this.octreeInstances.size) {
            const cooldownTicks = this.scene.gsplat.cooldownTicks;
            for (const [, inst] of this.octreeInstances) {
                const octree = inst.octree;
                if (!tempOctreesTicked.has(octree)) {
                    tempOctreesTicked.add(octree);
                    octree.updateCooldownTick(cooldownTicks);
                }
            }
            tempOctreesTicked.clear();
        }

        // fire frame:ready event
        this.fireFrameReadyEvent();

        // If event listeners dirtied params (e.g. changed LOD range), ensure LOD is re-evaluated
        if (this.scene.gsplat.dirty) {
            for (const [, inst] of this.octreeInstances) {
                inst.needsLodUpdate = true;
            }
        }

        // return the number of active splats for stats
        return sortedState ? sortedState.totalActiveSplats : 0;
    }

    /**
     * Sorts the splats using GPU compute shaders
     *
     * @param {GSplatWorldState} worldState - The world state to sort.
     */
    sortGpu(worldState) {
        const keyGenerator = this.keyGenerator;
        const gpuSorter = this.gpuSorter;
        Debug.assert(keyGenerator && gpuSorter, 'GPU sorter not initialized');
        if (!keyGenerator || !gpuSorter) return;

        const elementCount = worldState.totalActiveSplats;
        if (elementCount === 0) return;

        // Lazily create interval compaction
        if (!this.intervalCompaction) {
            this.intervalCompaction = new GSplatIntervalCompaction(this.device);
        }

        // Handle first-time setup for GPU path
        if (!worldState.sortedBefore) {
            worldState.sortedBefore = true;

            // Clean up old states first so skipped upload requirements are merged
            // into this world state before rebuildWorkBuffer renders them
            this.cleanupOldWorldStates(worldState.version);
            this.sortedVersion = worldState.version;

            this.rebuildWorkBuffer(worldState, elementCount);
        }

        // Upload interval metadata after rebuild so boundsBaseIndex is assigned
        this.intervalCompaction.uploadIntervals(worldState);

        // Run frustum culling when bounds data is available
        if (this.canCull) {
            const state = this.worldStates.get(this.sortedVersion);
            if (state) {
                this._runFrustumCulling(state);
            }
        }

        const numIntervals = worldState.totalIntervals;
        const totalActiveSplats = worldState.totalActiveSplats;
        this.intervalCompaction.dispatchCompact(this.workBuffer.frustumCuller, numIntervals, totalActiveSplats, this.renderer.fisheyeProj.enabled);

        // Allocate indirect draw/dispatch slots and write args from visible count
        this.allocateAndWriteIntervalIndirectArgs(numIntervals);

        const compactedSplatIds = this.intervalCompaction.compactedSplatIds;

        // number of bits used for sorting to match CPU sorter
        const numBits = Math.max(10, Math.min(20, Math.round(Math.log2(elementCount / 4))));
        // Round up to multiple of 4 for radix sort
        const roundedNumBits = Math.ceil(numBits / 4) * 4;

        // Compute min/max distances for key normalization
        const { minDist, maxDist } = this.computeDistanceRange(worldState);

        // Generate sort keys and run GPU radix sort (always indirect, compaction is always on)
        const sortedIndices = this.dispatchGpuSort(
            elementCount, roundedNumBits, minDist, maxDist, compactedSplatIds
        );

        // Apply sorted results to the renderer
        this.applyGpuSortResults(worldState, sortedIndices);
    }

    /**
     * Runs frustum culling and interval compaction on the GPU, then passes the compacted
     * splat ID buffer directly to the local compute renderer (no key generation or radix sort).
     *
     * @param {GSplatWorldState} worldState - The world state to compact.
     * @private
     */
    compactGpu(worldState) {
        if (!this.intervalCompaction) {
            this.intervalCompaction = new GSplatIntervalCompaction(this.device);
        }

        const elementCount = worldState.totalActiveSplats;
        if (elementCount === 0) return;

        if (!worldState.sortedBefore) {
            worldState.sortedBefore = true;

            this.cleanupOldWorldStates(worldState.version);
            this.sortedVersion = worldState.version;
            this.rebuildWorkBuffer(worldState, elementCount);
        }

        this.intervalCompaction.uploadIntervals(worldState);

        if (this.canCull) {
            const state = this.worldStates.get(this.sortedVersion);
            if (state) {
                this._runFrustumCulling(state);
            }
        }

        const numIntervals = worldState.totalIntervals;
        const totalActiveSplats = worldState.totalActiveSplats;
        this.intervalCompaction.dispatchCompact(this.workBuffer.frustumCuller, numIntervals, totalActiveSplats, this.renderer.fisheyeProj.enabled);

        // Extract the visible count from the prefix sum into sortElementCountBuffer.
        // writeIndirectArgs is the only path that does this. The local compute renderer
        // prepares its own indirect dispatch args in private buffers.
        this.allocateAndWriteIntervalIndirectArgs(numIntervals);

        const ic = /** @type {GSplatIntervalCompaction} */ (this.intervalCompaction);
        /** @type {GSplatComputeLocalRenderer} */
        const localRenderer = /** @type {any} */ (this.renderer);
        localRenderer.setCompactedData(
            /** @type {StorageBuffer} */ (ic.compactedSplatIds),
            /** @type {StorageBuffer} */ (ic.sortElementCountBuffer),
            worldState.textureSize,
            totalActiveSplats
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
        this.indirectDrawSlot = this.device.getIndirectDrawSlot(1);
        this.indirectDispatchSlot = this.device.getIndirectDispatchSlot(2);
        const ic = /** @type {GSplatIntervalCompaction} */ (this.intervalCompaction);
        ic.writeIndirectArgs(this.indirectDrawSlot, this.indirectDispatchSlot, numIntervals);
        this.lastCompactedNumIntervals = numIntervals;
    }

    /**
     * Generates sort keys and runs GPU radix sort using indirect dispatch
     * (sorting only the visible splat count determined by interval compaction).
     *
     * @param {number} elementCount - Total number of splats.
     * @param {number} roundedNumBits - Number of sort bits (rounded to multiple of 4).
     * @param {number} minDist - Minimum distance for key normalization.
     * @param {number} maxDist - Maximum distance for key normalization.
     * @param {StorageBuffer|null} compactedSplatIds - Compacted splat IDs from interval compaction.
     * @returns {StorageBuffer} The sorted indices buffer.
     * @private
     */
    dispatchGpuSort(elementCount, roundedNumBits, minDist, maxDist, compactedSplatIds) {
        const keyGenerator = /** @type {GSplatSortKeyCompute} */ (this.keyGenerator);
        const gpuSorter = /** @type {ComputeRadixSort} */ (this.gpuSorter);
        const ic = /** @type {GSplatIntervalCompaction} */ (this.intervalCompaction);

        // Generate sort keys using indirect dispatch (slot 0: key gen workgroups)
        const keysBuffer = keyGenerator.generateIndirect(
            this.workBuffer,
            this.cameraNode,
            this.scene.gsplat.radialSorting,
            elementCount,
            roundedNumBits,
            minDist,
            maxDist,
            /** @type {StorageBuffer} */ (compactedSplatIds),
            /** @type {StorageBuffer} */ (ic.sortElementCountBuffer),
            this.indirectDispatchSlot
        );

        // Run GPU radix sort with indirect dispatch (slot 1: sort workgroups).
        // Pass compactedSplatIds as initial values so the sort output contains actual
        // splat IDs rather than indices into the compacted buffer (single indirection).
        return gpuSorter.sortIndirect(
            keysBuffer,
            elementCount,
            roundedNumBits,
            this.indirectDispatchSlot + 1,
            /** @type {StorageBuffer} */ (ic.sortElementCountBuffer),
            /** @type {StorageBuffer} */ (compactedSplatIds),
            true
        );
    }

    /**
     * Applies GPU sort results to the renderer with indirect draw from interval compaction.
     * The sortedIndices buffer already contains actual splat IDs (single indirection) because
     * compactedSplatIds were fed as initial values to the radix sort.
     *
     * @param {GSplatWorldState} worldState - The world state being sorted.
     * @param {StorageBuffer} sortedIndices - Buffer containing sorted splat IDs.
     * @private
     */
    applyGpuSortResults(worldState, sortedIndices) {
        const ic = /** @type {GSplatIntervalCompaction} */ (this.intervalCompaction);
        this.renderer.setGpuSortedRendering(this.indirectDrawSlot, sortedIndices, /** @type {StorageBuffer} */ (ic.numSplatsBuffer), worldState.textureSize);
    }

    /**
     * Prepares frustum culling data: updates the GPU transform buffers and computes
     * frustum planes from the camera. The actual culling test runs inline in the
     * interval compaction compute shader.
     *
     * @param {GSplatWorldState} worldState - The world state whose splats provide transforms.
     * @private
     */
    _runFrustumCulling(worldState) {
        this.workBuffer.frustumCuller.updateTransformsData(worldState.boundsGroups);

        const cam = this.cameraNode.camera;
        this.workBuffer.frustumCuller.computeFrustumPlanes(cam.projectionMatrix, cam.viewMatrix);

        const gsplat = this.scene.gsplat;
        const fp = this.renderer.fisheyeProj;
        fp.update(gsplat.fisheye, cam.fov, cam.projectionMatrix);

        if (fp.enabled) {
            this.workBuffer.frustumCuller.setFisheyeData(
                this.cameraNode.getPosition(),
                this.cameraNode.forward,
                fp.maxTheta
            );
        }
    }

    /**
     * Refreshes indirect draw parameters on non-sort frames.
     * Allocates a new per-frame draw slot and re-runs writeIndirectArgs to write
     * draw args from the visibleCount that was established during the last sort.
     * Does NOT re-run compaction (the compacted buffer must stay stable).
     *
     * @private
     */
    refreshIndirectDraw() {
        const sortedState = this.worldStates.get(this.sortedVersion);
        if (!sortedState || !this.intervalCompaction) return;

        this.allocateAndWriteIntervalIndirectArgs(this.lastCompactedNumIntervals);
        const gpuSorter = /** @type {ComputeRadixSort} */ (this.gpuSorter);
        const ic = /** @type {GSplatIntervalCompaction} */ (this.intervalCompaction);
        this.renderer.setGpuSortedRendering(this.indirectDrawSlot, /** @type {StorageBuffer} */ (gpuSorter.sortedIndices), /** @type {StorageBuffer} */ (ic.numSplatsBuffer), sortedState.textureSize);
    }

    /**
     * Computes the min/max effective distances for the current world state.
     *
     * @param {GSplatWorldState} worldState - The world state.
     * @returns {{minDist: number, maxDist: number}} The distance range.
     */
    computeDistanceRange(worldState) {
        const cameraNode = this.cameraNode;
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

    /**
     * Prepares sort parameters data for the sorter worker.
     *
     * @param {GSplatWorldState} worldState - The world state containing all needed data.
     * @returns {object} - Data for sorter worker.
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

export { GSplatManager };
