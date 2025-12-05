import { math } from '../../core/math/math.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { GraphNode } from '../graph-node.js';
import { GSplatInfo } from './gsplat-info.js';
import { GSplatUnifiedSorter } from './gsplat-unified-sorter.js';
import { GSplatWorkBuffer } from './gsplat-work-buffer.js';
import { GSplatRenderer } from './gsplat-renderer.js';
import { GSplatOctreeInstance } from './gsplat-octree-instance.js';
import { GSplatOctreeResource } from './gsplat-octree.resource.js';
import { GSplatWorldState } from './gsplat-world-state.js';
import { Debug } from '../../core/debug.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { Color } from '../../core/math/color.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GSplatPlacement } from './gsplat-placement.js'
 * @import { Scene } from '../scene.js'
 * @import { Layer } from '../layer.js'
 * @import { GSplatDirector } from './gsplat-director.js'
 */

const cameraPosition = new Vec3();
const cameraDirection = new Vec3();
const translation = new Vec3();
const invModelMat = new Mat4();
const tempNonOctreePlacements = new Set();
const tempOctreePlacements = new Set();
const _updatedSplats = [];
const _splatsNeedingColorUpdate = [];
const _cameraDeltas = { rotationDelta: 0, translationDelta: 0 };
const tempOctreesTicked = new Set();

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
     *
     * @type {number}
     */
    lastWorldStateVersion = 0;

    /** @type {GSplatUnifiedSorter} */
    sorter;

    /** @type {number} */
    sortedVersion = 0;

    /** @type {number} */
    framesTillFullUpdate = 0;

    /** @type {Vec3} */
    lastLodCameraPos = new Vec3(Infinity, Infinity, Infinity);

    /** @type {Vec3} */
    lastLodCameraFwd = new Vec3(Infinity, Infinity, Infinity);

    /** @type {Vec3} */
    lastSortCameraPos = new Vec3(Infinity, Infinity, Infinity);

    /** @type {Vec3} */
    lastSortCameraFwd = new Vec3(Infinity, Infinity, Infinity);

    /** @type {boolean} */
    sortNeeded = true;

    /** @type {Vec3} */
    lastColorUpdateCameraPos = new Vec3(Infinity, Infinity, Infinity);

    /** @type {Vec3} */
    lastColorUpdateCameraFwd = new Vec3(Infinity, Infinity, Infinity);

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
     *
     * @type {boolean}
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
        this.workBuffer = new GSplatWorkBuffer(device);
        this.renderer = new GSplatRenderer(device, this.node, this.cameraNode, layer, this.workBuffer);
        this.sorter = this.createSorter();
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

        this.workBuffer.destroy();
        this.renderer.destroy();
        this.sorter.destroy();
    }

    get material() {
        return this.renderer.material;
    }

    createSorter() {
        // create sorter
        const sorter = new GSplatUnifiedSorter();
        sorter.on('sorted', (count, version, orderData) => {
            this.onSorted(count, version, orderData);
        });
        return sorter;
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

                // queue the instance to be processed during next world state creation
                this.octreeInstancesToDestroy.push(inst);
            }
        }

        // compute dirtiness of non-octree placements compared to existing layerPlacements
        this.layerPlacementsDirty = this.layerPlacements.length !== tempNonOctreePlacements.size;
        if (!this.layerPlacementsDirty) {
            for (let i = 0; i < this.layerPlacements.length; i++) {
                const existing = this.layerPlacements[i];
                if (!tempNonOctreePlacements.has(existing)) {
                    this.layerPlacementsDirty = true;
                    break;
                }
            }
        }

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

        // Recreate world state if there are changes
        const worldChanged = this.layerPlacementsDirty || this.worldStates.size === 0;
        if (worldChanged) {
            this.lastWorldStateVersion++;
            const splats = [];

            // color update thresholds
            const { colorUpdateAngle, colorUpdateDistance } = this.scene.gsplat;

            // add standalone splats
            for (const p of this.layerPlacements) {
                const splatInfo = new GSplatInfo(this.device, p.resource, p);
                splatInfo.resetColorAccumulators(colorUpdateAngle, colorUpdateDistance);
                splats.push(splatInfo);
            }

            // add octree splats
            for (const [, inst] of this.octreeInstances) {
                inst.activePlacements.forEach((p) => {
                    if (p.resource) {
                        const splatInfo = new GSplatInfo(this.device, p.resource, p);
                        splatInfo.resetColorAccumulators(colorUpdateAngle, colorUpdateDistance);
                        splats.push(splatInfo);
                    }
                });
            }

            // update sorter with current splats (adds new centers, removes unused ones)
            this.sorter.updateCentersForSplats(splats);

            const newState = new GSplatWorldState(this.device, this.lastWorldStateVersion, splats);

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

                    // collect file-release requests from octree instances
                    const toRelease = inst.getFileDecrements();
                    for (const fileIndex of toRelease) {
                        newState.pendingReleases.push([inst.octree, fileIndex]);
                    }
                    inst.destroy();
                }
                this.octreeInstancesToDestroy.length = 0;
            }

            this.worldStates.set(this.lastWorldStateVersion, newState);

            this.layerPlacementsDirty = false;

            // New world state requires sorting
            this.sortNeeded = true;
        }
    }

    onSorted(count, version, orderData) {

        // remove all old states between last sorted version and current version
        for (let v = this.sortedVersion; v < version; v++) {
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

        this.sortedVersion = version;

        // find the world state that has been sorted
        const worldState = this.worldStates.get(version);
        Debug.assert(worldState, `World state with version ${version} not found`);

        if (worldState) {

            // when a new version was sorted for the first time, we need to fully update work buffer
            // to match centers buffer / sorted data
            if (!worldState.sortedBefore) {
                worldState.sortedBefore = true;

                // resize work buffer if needed
                const textureSize = worldState.textureSize;
                if (textureSize !== this.workBuffer.textureSize) {
                    this.workBuffer.resize(textureSize);
                    this.renderer.setMaxNumSplats(textureSize * textureSize);
                }

                // render all splats to work buffer
                this.workBuffer.render(worldState.splats, this.cameraNode, this.getDebugColors());

                // update all splats to sync their transforms and reset color accumulators
                // (prevents redundant re-render later)
                const { colorUpdateAngle, colorUpdateDistance } = this.scene.gsplat;
                worldState.splats.forEach((splat) => {
                    splat.update();
                    splat.resetColorAccumulators(colorUpdateAngle, colorUpdateDistance);
                });

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

            // update order texture
            this.workBuffer.setOrderData(orderData);

            // update renderer with new order data
            this.renderer.setOrderData();
        }
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

        return cameraMoved || cameraRotated;
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
            const distance = this.lastSortCameraPos.distance(currentCameraPos);
            return distance > epsilon;
        }

        // For directional sorting, only forward direction changes matter
        if (Number.isFinite(this.lastSortCameraFwd.x)) {
            const currentCameraFwd = this.cameraNode.forward;
            const dot = Math.min(1, Math.max(-1, this.lastSortCameraFwd.dot(currentCameraFwd)));
            const angle = Math.acos(dot);
            return angle > epsilon;
        }

        // first run, force update to initialize last orientation
        return true;
    }

    /**
     * Updates the camera tracking state for color accumulation calculations.
     * Called after any render that updates colors (full or color-only).
     */
    updateColorCameraTracking() {
        this.lastColorUpdateCameraPos.copy(this.cameraNode.getPosition());
        this.lastColorUpdateCameraFwd.copy(this.cameraNode.forward);
    }

    /**
     * Determines the colorization mode for rendering based on debug flags.
     *
     * @returns {Array<number[]>|undefined} Color array for debug visualization, or undefined for normal rendering
     */
    getDebugColors() {
        if (this.scene.gsplat.colorizeColorUpdate) {
            _randomColorRaw ??= [];
            // Random color for this update pass - use same color for all LOD levels
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
        } else if (this.scene.gsplat.colorizeLod) {
            // LOD colors
            return _lodColorsRaw;
        }
        return undefined;
    }

    /**
     * Calculates camera movement deltas since last color update.
     * Updates and returns the shared _cameraDeltas object.
     *
     * @returns {{ rotationDelta: number, translationDelta: number }} Shared camera movement deltas object
     */
    calculateColorCameraDeltas() {
        _cameraDeltas.rotationDelta = 0;
        _cameraDeltas.translationDelta = 0;

        // Skip delta calculation on first frame (camera position not yet initialized)
        if (isFinite(this.lastColorUpdateCameraPos.x)) {
            // Calculate rotation delta in degrees using dot product
            const currentCameraFwd = this.cameraNode.forward;
            const dot = Math.min(1, Math.max(-1,
                this.lastColorUpdateCameraFwd.dot(currentCameraFwd)));
            _cameraDeltas.rotationDelta = Math.acos(dot) * math.RAD_TO_DEG;

            // Calculate translation delta in world units
            const currentCameraPos = this.cameraNode.getPosition();
            _cameraDeltas.translationDelta = this.lastColorUpdateCameraPos.distance(currentCameraPos);
        }

        return _cameraDeltas;
    }

    /**
     * Fires the frame:ready event with current sorting and loading state.
     */
    fireFrameReadyEvent() {
        const ready = this.sortedVersion === this.lastWorldStateVersion;

        // Count total pending loads from octree instances (including environment)
        let loadingCount = 0;
        for (const [, inst] of this.octreeInstances) {
            loadingCount += inst.pendingLoadCount;
        }

        this.director.eventHandler.fire('frame:ready', this.cameraNode.camera, this.renderer.layer, ready, loadingCount);
    }

    update() {

        // apply any pending sorted results
        this.sorter.applyPendingSorted();

        let fullUpdate = false;
        this.framesTillFullUpdate--;
        if (this.framesTillFullUpdate <= 0) {
            this.framesTillFullUpdate = 10;

            // if sorter can keep up
            if (this.sorter.jobsInFlight < 3) {
                fullUpdate = true;
            }
        }

        // when new octree instances are added, we need to evaluate their LOD immediately
        const hasNewInstances = this.hasNewOctreeInstances && this.sorter.jobsInFlight < 3;
        if (hasNewInstances) this.hasNewOctreeInstances = false;

        let anyInstanceNeedsLodUpdate = false;
        let anyOctreeMoved = false;
        let cameraMovedOrRotatedForLod = false;
        if (fullUpdate) {

            // process any pending / prefetch resource completions and collect LOD updates
            for (const [, inst] of this.octreeInstances) {

                const isDirty = inst.update(this.scene);
                this.layerPlacementsDirty ||= isDirty;

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
        }

        // check if camera has moved enough to require re-sorting
        if (this.testCameraMovedForSort()) {
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
        }

        // when camera or octree need LOD evaluated, or params are dirty, or resources completed, or new instances added
        if (cameraMovedOrRotatedForLod || anyOctreeMoved || this.scene.gsplat.dirty || anyInstanceNeedsLodUpdate || hasNewInstances) {

            // update the previous position where LOD was evaluated for octree instances
            for (const [, inst] of this.octreeInstances) {
                inst.updateMoved();
            }

            // update last camera data when LOD was evaluated
            this.lastLodCameraPos.copy(this.cameraNode.getPosition());
            this.lastLodCameraFwd.copy(this.cameraNode.forward);

            // update LOD for all octree instances
            for (const [, inst] of this.octreeInstances) {
                inst.updateLod(this.cameraNode, this.scene.gsplat);
            }
        }

        // create new world state if needed
        this.updateWorldState();

        // update sorter with new world state
        const lastState = this.worldStates.get(this.lastWorldStateVersion);
        if (lastState) {

            if (!lastState.sortParametersSet) {
                lastState.sortParametersSet = true;

                const payload = this.prepareSortParameters(lastState);
                this.sorter.setSortParameters(payload);
            }

            // debug render world space bounds for all splats
            Debug.call(() => {
                if (this.scene.gsplat.debugAabbs) {
                    const tempAabb = new BoundingBox();
                    const scene = this.scene;
                    lastState.splats.forEach((splat) => {
                        tempAabb.setFromTransformedAabb(splat.aabb, splat.node.getWorldTransform());
                        scene.immediate.drawWireAlignedBox(tempAabb.getMin(), tempAabb.getMax(), _lodColors[splat.lodIndex], true, scene.defaultDrawLayer);
                    });
                }
            });

            // kick off sorting only if needed
            if (this.sortNeeded) {
                this.sort(lastState);
                this.sortNeeded = false;

                // Update camera tracking for next sort check
                this.lastSortCameraPos.copy(this.cameraNode.getPosition());
                this.lastSortCameraFwd.copy(this.cameraNode.forward);
            }
        }

        // re-render splats that have changed their transform this frame, using last sorted state
        const sortedState = this.worldStates.get(this.sortedVersion);
        if (sortedState) {

            // color update thresholds
            const { colorUpdateAngle, colorUpdateDistance, colorUpdateDistanceLodScale, colorUpdateAngleLodScale } = this.scene.gsplat;

            // Calculate camera movement deltas for color updates
            const { rotationDelta, translationDelta } = this.calculateColorCameraDeltas();

            // check each splat for full or color update
            sortedState.splats.forEach((splat) => {
                // Check if splat's transform changed (needs full update)
                if (splat.update()) {

                    _updatedSplats.push(splat);
                    // Reset accumulators for fully updated splats
                    splat.resetColorAccumulators(colorUpdateAngle, colorUpdateDistance);

                    // Splat moved, need to re-sort
                    this.sortNeeded = true;

                } else if (splat.hasSphericalHarmonics) {

                    // Otherwise, check if color needs updating (accumulator-based)
                    // Add this frame's camera movement to accumulators
                    splat.colorAccumulatedRotation += rotationDelta;
                    splat.colorAccumulatedTranslation += translationDelta;

                    // Apply LOD-based scaling to thresholds
                    const lodIndex = splat.lodIndex ?? 0;
                    const distThreshold = colorUpdateDistance * Math.pow(colorUpdateDistanceLodScale, lodIndex);
                    const angleThreshold = colorUpdateAngle * Math.pow(colorUpdateAngleLodScale, lodIndex);

                    // Trigger update if either threshold exceeded
                    if (splat.colorAccumulatedRotation >= angleThreshold ||
                        splat.colorAccumulatedTranslation >= distThreshold) {
                        _splatsNeedingColorUpdate.push(splat);
                        splat.resetColorAccumulators(angleThreshold, distThreshold);
                    }
                }
            });

            // Batch render all updated splats in a single render pass
            if (_updatedSplats.length > 0) {
                this.workBuffer.render(_updatedSplats, this.cameraNode, this.getDebugColors());
                _updatedSplats.length = 0;
            }

            // Batch render color updates for all splats that exceeded thresholds
            if (_splatsNeedingColorUpdate.length > 0) {
                this.workBuffer.renderColor(_splatsNeedingColorUpdate, this.cameraNode, this.getDebugColors());
                _splatsNeedingColorUpdate.length = 0;
            }

            // update renderer with new order data
            this.renderer.frameUpdate(this.scene.gsplat);

            // Update camera tracking once at the end of the frame
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

        // return the number of visible splats for stats
        const { textureSize } = this.workBuffer;
        return textureSize * textureSize;
    }

    /**
     * Sorts the splats of the given world state.
     *
     * @param {GSplatWorldState} lastState - The last world state.
     */
    sort(lastState) {

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

        this.sorter.setSortParams(sorterRequest, this.scene.gsplat.radialSorting);
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
            totalUsedPixels: worldState.totalUsedPixels,
            version: worldState.version,
            ids: worldState.splats.map(splat => splat.resource.id),
            lineStarts: worldState.splats.map(splat => splat.lineStart),
            padding: worldState.splats.map(splat => splat.padding),

            // TODO: consider storing this in typed array and transfer it to sorter worker
            intervals: worldState.splats.map(splat => splat.intervals)
        };
    }
}

export { GSplatManager };
