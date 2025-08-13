import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { GraphNode } from '../graph-node.js';
import { GSplatCentersBuffers } from './gsplat-centers-buffer.js';
import { GSplatInfo } from './gsplat-info.js';
import { GSplatUnifiedSorter } from './gsplat-unified-sorter.js';
import { GSplatWorkBuffer } from './gsplat-work-buffer.js';
import { GSplatRenderer } from './gsplat-renderer.js';
import { GSplatOctreeInstance } from './gsplat-octree-instance.js';
import { GSplatOctreeResource } from './gsplat-octree.resource.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js';
 * @import { GSplatPlacement } from './gsplat-placement.js';
 */

const cameraPosition = new Vec3();
const cameraDirection = new Vec3();
const translation = new Vec3();
const invModelMat = new Mat4();
const tempSplats = [];

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

    /** @type {GSplatCentersBuffers} */
    centerBuffer;

    /** @type {GSplatRenderer} */
    renderer;

    /**
     * An array of all splats managed by this manager.
     *
     * @type {GSplatInfo[]}
     */
    splats = [];

    /** @type {GSplatUnifiedSorter} */
    sorter;

    /**
     * The version of the splats that were returned sorted by the worker.
     *
     * @type {number}
     */
    sortedVersion = 0;

    /**
     * The minimum version of the splats that is required for rendering. Initialize to 1 to ensure
     * first work buffer update is done after first sorting.
     *
     * @type {number}
     */
    sortedVersionMin = 1;

    /** @type {number} */
    updateVersion = 0;

    /** @type {boolean} */
    forceCentersUpdate = false;

    /** @type {Vec3} */
    lastCameraPos = new Vec3(Infinity, Infinity, Infinity);

    /** @type {GraphNode} */
    cameraNode;

    /** @type {Set<GSplatPlacement>} */
    placements = new Set();

    /** @type {GSplatOctreeInstance[]} */
    octreeInstances = [];

    /** @type {Map<number, number>} */
    pendingRemovals = new Map(); // resourceId -> version when it was removed

    constructor(device, director, layer, cameraNode) {
        this.device = device;
        this.director = director;
        this.cameraNode = cameraNode;
        this.workBuffer = new GSplatWorkBuffer(device);
        this.centerBuffer = new GSplatCentersBuffers();
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
     * Adds a new splat to the manager.
     *
     * @param {GSplatPlacement} placement - The placement of the splat.
     */
    add(placement) {
        const resource = placement.resource;
        if (resource instanceof GSplatOctreeResource) { // octree resource

            this.octreeInstances.push(new GSplatOctreeInstance(resource.octree, placement, this.director.assetLoader));

        } else { // gsplat resource

            // If this resource was pending removal, cancel it since we're adding it back
            if (this.pendingRemovals.has(resource.id)) {
                this.pendingRemovals.delete(resource.id);
            }

            const splatInfo = new GSplatInfo(this.device, resource, placement);
            this.splats.push(splatInfo);

            // add centers to sorter
            this.sorter.setCenters(resource.id, resource.centers);

            this.onChange();

        }

        this.placements.add(placement);
    }

    /**
     * Removes a splat from the manager.
     *
     * @param {GSplatPlacement} placement - The placement of the splat.
     */
    remove(placement) {
        const resource = placement.resource;

        if (resource instanceof GSplatOctreeResource) {

            this.placements.delete(placement);

        } else {

            // Handle regular gsplat placement removal
            const splatInfo = this.splats.find(s => s.resource.id === resource.id);
            if (splatInfo) {
                this.splats.splice(this.splats.indexOf(splatInfo), 1);
                splatInfo.destroy();
                this.placements.delete(placement);

                // Don't remove centers from worker immediately - defer until safe
                this.pendingRemovals.set(resource.id, this.centerBuffer.version + 1);

                this.onChange();
            }
        }
    }

    /**
     * Reconciles the manager with the given placements. This is used to update the manager when
     * the layer's placements have changed.
     *
     * @param {GSplatPlacement[]} placements - The placements to reconcile with.
     */
    reconcile(placements) {

        let anyChanges = false;

        // remove all placements that are not in the new list
        this.placements.forEach((p) => {

            // ignore secondary placements, those are managed by the octree instances
            if (!p.secondary) {
                if (!placements.includes(p)) {
                    this.remove(p);
                    anyChanges = true;
                }
            }
        });

        // add all placements that are in the new list
        placements.forEach((p) => {
            if (!this.placements.has(p)) {
                this.add(p);
                anyChanges = true;
            }
        });

        if (anyChanges) {
            this.onChange();
        }
    }

    onChange() {

        // user might have unloaded splat asset, and so we can no longer use it to render to workbuffer,
        // so no rendering to workbuffer till sorter has delivered the next version of centers
        this.sortedVersionMin = this.centerBuffer.version + 1;

        if (!this.forceCentersUpdate) {

            // force centers update
            this.forceCentersUpdate = true;

            // cancel any pending prepare states - as those are prepared for previous version
            this.splats.forEach(s => s.cancelPrepareState());
        }
    }

    onSorted(count, version, orderData) {

        // skip older version that got sorted, this can no longer be used for rendering
        if (version < this.sortedVersionMin) {
            return;
        }

        // when a new version was sorted for the first time, we need to fully update work buffer to match
        // centers buffer / sorted data
        if (this.sortedVersion !== version && version === this.centerBuffer.version) {
            this.sortedVersion = version;
            // resize work buffer if needed
            const textureSize = this.centerBuffer.textureSize;
            const workBufferResizeRequest = textureSize !== this.workBuffer.textureSize;
            if (workBufferResizeRequest) {
                this.workBuffer.resize(textureSize);
                this.renderer.setMaxNumSplats(textureSize * textureSize);
            }

            this.splats.forEach((splat) => {
                splat.activatePrepareState();
            });

            // render all splats to work buffer
            this.workBuffer.render(this.splats, this.cameraNode);
        }

        // update order texture
        this.workBuffer.setOrderData(orderData);

        // number of splats to render
        this.renderer.setNumSplats(count);

        // Process any pending removals that are now safe
        for (const [resourceId, removalVersion] of this.pendingRemovals) {
            if (version >= removalVersion) {
                this.sorter.setCenters(resourceId, null);
                this.pendingRemovals.delete(resourceId);
            }
        }
    }

    /**
     * Updates the order of splats based on their world matrix being updated, with splats that have
     * changed within a time window going to the end.
     *
     * @returns {boolean} True if any splat has changed and LOD needs to be re-calculated.
     */
    updateSplatOrder() {

        // detect which splats have changed
        this.updateVersion++;
        const updateVersion = this.updateVersion;
        const splats = this.splats;
        let lodDirty = false;
        splats.forEach((splat) => {
            lodDirty = lodDirty || splat.update(updateVersion);
        });

        // Copy splat references before sorting, to detect changes later
        tempSplats.length = splats.length;
        for (let i = 0; i < splats.length; i++) {
            tempSplats[i] = splats[i];
        }

        // Sort: splats changed within a window go to the end
        const activityWindow = 100;
        splats.sort((a, b) => {
            const aActive = updateVersion - a.updateVersion <= activityWindow;
            const bActive = updateVersion - b.updateVersion <= activityWindow;

            if (aActive && !bActive) return 1;
            if (!aActive && bActive) return -1;

            // if both changed, most recently changed splat goes last
            return a.updateVersion - b.updateVersion;
        });

        // Find the first index that changed
        const firstChangedIndex = splats.findIndex((splat, i) => splat !== tempSplats[i]);

        tempSplats.length = 0;

        return lodDirty || firstChangedIndex !== -1;
    }

    update() {

        // do not allow any center buffer modifications till we get sorted centers back
        if (this.sortedVersion === this.centerBuffer.version || this.forceCentersUpdate) {

            // update all octree instances
            this.octreeInstances.forEach((octreeInstance) => {
                octreeInstance.update(this);
            });

            // how far has the camera moved
            const currentCameraPos = this.cameraNode.getWorldTransform().getTranslation();
            const distance = this.lastCameraPos.distance(currentCameraPos);

            // reorder splats based on update version - active splats at the end
            const lodDirty = this.updateSplatOrder();

            // if camera moved or splats have been reordered, give updated centers to sorter
            if (distance > 1.0 || lodDirty || this.forceCentersUpdate) {
                this.forceCentersUpdate = false;

                this.lastCameraPos.copy(currentCameraPos);
                // update LOD for all octree instances
                this.octreeInstances.forEach((octreeInstance) => {
                    octreeInstance.updateLod(this.cameraNode, this);
                });

                // Update LOD for each splat individually
                this.splats.forEach((splat) => {

                    // start preparing a state - updates LOD intervals and interval texture
                    splat.startPrepareState();
                });

                this.centerBuffer.estimateTextureSize(this.splats, this.device.maxTextureSize);
                const textureSize = this.centerBuffer.textureSize;

                // Reassign lines based on current LOD active splats
                this.assignLines(this.splats, textureSize);

                // give sorter info it needs to generate global centers array for sorting
                const payload = this.centerBuffer.update(this.splats);
                this.sorter.setIntervals(payload);
            }

            // update data for the sorter
            this.sort();
        }

        // if we got valid sorted centers, which makes the renderState valid
        if (this.sortedVersion >= this.sortedVersionMin) {

            // any splats that have changed this frame need to be re-rendered to work buffer
            const updateVersion = this.updateVersion;
            const rt = this.workBuffer.renderTarget;
            this.splats.forEach((splat) => {
                if (splat.updateVersion === updateVersion) {
                    splat.render(rt, this.cameraNode);
                }
            });
        }
    }

    /**
     * Assigns lines to each splat based on the texture size.
     *
     * @param {GSplatInfo[]} splats - The splats to assign lines to.
     * @param {number} size - The texture size.
     */
    assignLines(splats, size) {
        let start = 0;
        for (const splat of splats) {
            const prepareState = splat.prepareState;
            const activeSplats = prepareState.activeSplats;
            const numLines = Math.ceil(activeSplats / size);
            prepareState.setLines(start, numLines, size, activeSplats);
            start += numLines;
        }
    }

    sort() {

        // Get camera's world-space properties
        const cameraNode = this.cameraNode;
        const cameraMat = cameraNode.getWorldTransform();
        cameraMat.getTranslation(cameraPosition);
        cameraMat.getZ(cameraDirection).normalize();

        const sorterRequest = [];
        this.splats.forEach((splat) => {
            const modelMat = splat.placement.node.getWorldTransform();
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
}

export { GSplatManager };
