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

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GSplatPlacement } from './gsplat-placement.js'
 *
 */

const cameraPosition = new Vec3();
const cameraDirection = new Vec3();
const translation = new Vec3();
const invModelMat = new Mat4();
const tempNonOctreePlacements = new Set();
const tempOctreePlacements = new Set();
const _updatedSplats = [];

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
    updateVersion = 0;

    /** @type {number} */
    sortedVersion = 0;

    /** @type {Vec3} */
    lastCameraPos = new Vec3(Infinity, Infinity, Infinity);

    /** @type {GraphNode} */
    cameraNode;

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

    constructor(device, director, layer, cameraNode) {
        this.device = device;
        this.director = director;
        this.cameraNode = cameraNode;
        this.workBuffer = new GSplatWorkBuffer(device);
        this.renderer = new GSplatRenderer(device, this.node, this.cameraNode, layer, this.workBuffer);
        this.sorter = this.createSorter();
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

        // destroy and remove octree instances that are no longer present
        for (const [placement, inst] of this.octreeInstances) {
            if (!tempOctreePlacements.has(placement)) {
                this.octreeInstances.delete(placement);
                inst.destroy();
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

        // update octree instances - this handles loaded pended resources
        for (const [, inst] of this.octreeInstances) {
            this.layerPlacementsDirty ||= inst.update();
        }

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
                    splats.push(new GSplatInfo(this.device, p.resource, p));
                });
            }

            // add resource centers to sorter
            splats.forEach((splat) => {
                this.sorter.setCenters(splat.resource.id, splat.resource.centers);
            });

            const newState = new GSplatWorldState(this.device, this.lastWorldStateVersion, splats);
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

                // render all splats to work buffer
                this.workBuffer.render(worldState.splats, this.cameraNode);
            }

            // update order texture
            this.workBuffer.setOrderData(orderData);

            // number of splats to render
            this.renderer.setNumSplats(count);
        }
    }

    // TODO: leaving this commented out for now, it will be refactor and parts of it used
    // in the following PRs.

    /**
     * Updates the order of splats based on their world matrix being updated, with splats that have
     * changed within a time window going to the end.
     *
     */
    // updateSplatOrder() {

    //     // detect which splats have changed
    //     this.updateVersion++;
    //     const updateVersion = this.updateVersion;
    //     const splats = this.splats;
    //     let lodDirty = false;
    //     splats.forEach((splat) => {
    //         lodDirty = lodDirty || splat.update(updateVersion);
    //     });

    //     // Copy splat references before sorting, to detect changes later
    //     tempSplats.length = splats.length;
    //     for (let i = 0; i < splats.length; i++) {
    //         tempSplats[i] = splats[i];
    //     }


    // ///////// can I add order sorting to when the world state is created ???
    // or maybe trigger new world state for it


    //     // Sort: splats changed within a window go to the end
    //     const activityWindow = 100;
    //     splats.sort((a, b) => {
    //         const aActive = updateVersion - a.updateVersion <= activityWindow;
    //         const bActive = updateVersion - b.updateVersion <= activityWindow;

    //         if (aActive && !bActive) return 1;
    //         if (!aActive && bActive) return -1;

    //         // if both changed, most recently changed splat goes last
    //         return a.updateVersion - b.updateVersion;
    //     });

    //     // Find the first index that changed
    //     const firstChangedIndex = splats.findIndex((splat, i) => splat !== tempSplats[i]);

    //     tempSplats.length = 0;

    //     return lodDirty || firstChangedIndex !== -1;
    // }

    update() {

        // check if any octree instances have moved enough to require LOD update
        let anyOctreeMoved = false;
        for (const [, inst] of this.octreeInstances) {
            anyOctreeMoved ||= inst.testMoved();
        }

        // check if camera has moved enough to require LOD update
        const currentCameraPos = this.cameraNode.getPosition();
        const distance = this.lastCameraPos.distance(currentCameraPos);
        const cameraMoved = distance > 1.0;

        // when camera of octree need LOD evaluated
        if (cameraMoved || anyOctreeMoved) {

            this.lastCameraPos.copy(currentCameraPos);

            // update LOD for all octree instances
            for (const [, inst] of this.octreeInstances) {
                inst.updateLod(this.cameraNode);
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

            // kick off sorting
            this.sort(lastState);
        }

        // re-render splats that have changed their transform this frame, using last sorted state
        const sortedState = this.worldStates.get(this.sortedVersion);
        if (sortedState) {
            const updateVersion = ++this.updateVersion;

            // Collect splats that have been updated
            sortedState.splats.forEach((splat) => {
                if (splat.update(updateVersion)) {
                    _updatedSplats.push(splat);
                }
            });

            // Batch render all updated splats in a single render pass
            if (_updatedSplats.length > 0) {
                this.workBuffer.render(_updatedSplats, this.cameraNode);
                _updatedSplats.length = 0;
            }
        }
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

            // world-space offset
            modelMat.getTranslation(translation);
            const offset = translation.sub(cameraPosition).dot(cameraDirection);

            // sorter parameters
            sorterRequest.push({
                transformedDirection,
                offset,
                scale: uniformScale
            });
        });

        this.sorter.setSortParams(sorterRequest);
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
