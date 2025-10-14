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
 */

const cameraPosition = new Vec3();
const cameraDirection = new Vec3();
const translation = new Vec3();
const invModelMat = new Mat4();
const tempNonOctreePlacements = new Set();
const tempOctreePlacements = new Set();
const _updatedSplats = [];
const tempOctreesTicked = new Set();

const _lodColorsRaw = [
    [1, 0, 0],  // red
    [0, 1, 0],  // green
    [0, 0, 1],  // blue
    [1, 1, 0],  // yellow
    [1, 0, 1]   // magenta
];

// Color instances used by debug wireframe rendering
const _lodColors = [
    new Color(1, 0, 0),
    new Color(0, 1, 0),
    new Color(0, 0, 1),
    new Color(1, 1, 0),
    new Color(1, 0, 1)
];

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

    /** @type {number} */
    cooldownTicks;

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
    lastCameraPos = new Vec3(Infinity, Infinity, Infinity);

    /** @type {Vec3} */
    lastCameraFwd = new Vec3(Infinity, Infinity, Infinity);

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

    constructor(device, director, layer, cameraNode) {
        this.device = device;
        this.scene = director.scene;
        this.director = director;
        this.cameraNode = cameraNode;
        this.workBuffer = new GSplatWorkBuffer(device);
        this.renderer = new GSplatRenderer(device, this.node, this.cameraNode, layer, this.workBuffer);
        this.sorter = this.createSorter();
        this.cooldownTicks = this.director.assetLoader.cooldownTicks;
    }

    destroy() {
        this.workBuffer.destroy();
        this.renderer.destroy();
        this.sorter.destroy();
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
                    this.octreeInstances.set(p, new GSplatOctreeInstance(p.resource.octree, p, this.director.assetLoader));
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

            // add standalone splats
            for (const p of this.layerPlacements) {
                const splatInfo = new GSplatInfo(this.device, p.resource, p);
                splats.push(splatInfo);
            }

            // add octree splats
            for (const [, inst] of this.octreeInstances) {
                inst.activePlacements.forEach((p) => {
                    if (p.resource) {
                        splats.push(new GSplatInfo(this.device, p.resource, p));
                    }
                });
            }

            // add resource centers to sorter
            splats.forEach((splat) => {
                this.sorter.setCenters(splat.resource.id, splat.resource.centers);
            });

            const newState = new GSplatWorldState(this.device, this.lastWorldStateVersion, splats);

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
        }
    }

    onSorted(count, version, orderData) {

        this.sortedVersion = version;

        // remove old state
        const oldState = this.worldStates.get(version - 1);
        if (oldState) {
            this.worldStates.delete(version - 1);
            oldState.destroy();
        }

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

                // render all splats to work buffer with LOD color palette
                const colorize = this.scene.gsplat.colorizeLod;
                this.workBuffer.render(worldState.splats, this.cameraNode, colorize ? _lodColorsRaw : undefined);

                // apply pending file-release requests
                if (worldState.pendingReleases && worldState.pendingReleases.length) {
                    for (const [octree, fileIndex] of worldState.pendingReleases) {
                        // decrement once for each staged release; refcount system guards against premature unload
                        octree.decRefCount(fileIndex, this.cooldownTicks);
                    }
                    worldState.pendingReleases.length = 0;
                }

                // number of splats to render
                this.renderer.update(count, textureSize);
            }

            // update order texture
            this.workBuffer.setOrderData(orderData);

            // update renderer with new order data
            this.renderer.frameUpdate();
        }
    }

    /**
     * Tests if the camera has moved or rotated enough to require LOD update.
     *
     * @returns {boolean} True if camera moved/rotated over thresholds, otherwise false.
     */
    testCameraMoved() {

        // distance-based movement check
        const distanceThreshold = this.scene.gsplat.lodUpdateDistance;
        const currentCameraPos = this.cameraNode.getPosition();
        const cameraMoved = this.lastCameraPos.distance(currentCameraPos) > distanceThreshold;
        if (cameraMoved) {
            return true;
        }

        // rotation-based movement check (optional)
        let cameraRotated = false;
        const lodUpdateAngleDeg = this.scene.gsplat.lodUpdateAngle;
        if (lodUpdateAngleDeg > 0) {
            if (Number.isFinite(this.lastCameraFwd.x)) {
                const currentCameraFwd = this.cameraNode.forward;
                const dot = Math.min(1, Math.max(-1, this.lastCameraFwd.dot(currentCameraFwd)));
                const angle = Math.acos(dot);
                const rotThreshold = lodUpdateAngleDeg * Math.PI / 180;
                cameraRotated = angle > rotThreshold;
            } else {
                // first run, force update to initialize last orientation
                cameraRotated = true;
            }
        }

        return cameraMoved || cameraRotated;
    }

    update() {

        let fullUpdate = false;
        this.framesTillFullUpdate--;
        if (this.framesTillFullUpdate <= 0) {
            this.framesTillFullUpdate = 10;

            // if sorter can keep up
            if (this.sorter.jobsInFlight < 3) {
                fullUpdate = true;
            }
        }

        let anyInstanceNeedsLodUpdate = false;
        let anyOctreeMoved = false;
        let cameraMovedOrRotated = false;
        if (fullUpdate) {

            // process any pending / prefetch resource completions and collect LOD updates
            for (const [, inst] of this.octreeInstances) {

                const isDirty = inst.update(this.scene);
                this.layerPlacementsDirty ||= isDirty;

                const instNeeds = inst.consumeNeedsLodUpdate();
                anyInstanceNeedsLodUpdate ||= instNeeds;
            }

            // check if any octree instances have moved enough to require LOD update
            const threshold = this.scene.gsplat.lodUpdateDistance;
            for (const [, inst] of this.octreeInstances) {
                const moved = inst.testMoved(threshold);
                anyOctreeMoved ||= moved;
            }

            // check if camera has moved/rotated enough to require LOD update
            cameraMovedOrRotated = this.testCameraMoved();
        }

        Debug.call(() => {
            for (const [, inst] of this.octreeInstances) {
                inst.debugRender(this.scene);
            }
        });

        // if parameters are dirty, rebuild world state
        if (this.scene.gsplat.dirty) {
            this.layerPlacementsDirty = true;
        }

        // when camera or octree need LOD evaluated, or params are dirty, or resources completed
        if (cameraMovedOrRotated || anyOctreeMoved || this.scene.gsplat.dirty || anyInstanceNeedsLodUpdate) {

            // update the previous position where LOD was evaluated for octree instances
            for (const [, inst] of this.octreeInstances) {
                inst.updateMoved();
            }

            // update last camera data when LOD was evaluated
            this.lastCameraPos.copy(this.cameraNode.getPosition());
            this.lastCameraFwd.copy(this.cameraNode.forward);

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

            // kick off sorting
            this.sort(lastState);
        }

        // re-render splats that have changed their transform this frame, using last sorted state
        const sortedState = this.worldStates.get(this.sortedVersion);
        if (sortedState) {

            // Collect splats that have been updated
            sortedState.splats.forEach((splat) => {
                if (splat.update()) {
                    _updatedSplats.push(splat);
                }
            });

            // Batch render all updated splats in a single render pass
            if (_updatedSplats.length > 0) {
                const colorize = this.scene.gsplat.colorizeLod;
                this.workBuffer.render(_updatedSplats, this.cameraNode, colorize ? _lodColorsRaw : undefined);
                _updatedSplats.length = 0;
            }
        }

        // tick cooldowns once per frame per unique octree
        if (this.octreeInstances.size) {
            for (const [, inst] of this.octreeInstances) {
                const octree = inst.octree;
                if (!tempOctreesTicked.has(octree)) {
                    tempOctreesTicked.add(octree);
                    octree.updateCooldownTick(this.director.assetLoader);
                }
            }
            tempOctreesTicked.clear();
        }

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
        this.renderer.updateViewport(cameraNode);
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
