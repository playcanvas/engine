import { Debug } from '../../../core/debug.js';
import { Mat4 } from '../../../core/math/mat4.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { GraphNode } from '../../graph-node.js';
import { GSplatResourceBase } from '../gsplat-resource-base.js';
import { GSplatCentersBuffers } from './gsplat-centers-buffer.js';
import { GSplatInfo } from './gsplat-info.js';
import { GSplatUnifiedSorter } from './gsplat-unified-sorter.js';
import { GSplatWorkBuffer } from './gsplat-work-buffer.js';
import { GSplatRenderer } from './gsplat-renderer.js';

/**
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js';
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

    /** @type {GSplatUnifiedSorter | null} */
    sorter = null;

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

    /** @type {boolean} */
    workBufferResizeRequest = false;

    /** @type {Vec3} */
    lastCameraPos = new Vec3(Infinity, Infinity, Infinity);

    /** @type {GraphNode} */
    cameraNode;

    constructor(device, cameraNode) {
        this.device = device;
        this.cameraNode = cameraNode;
        this.workBuffer = new GSplatWorkBuffer(device);
        this.centerBuffer = new GSplatCentersBuffers();
        this.renderer = new GSplatRenderer(device, this.node, this.workBuffer);
        this.createSorter();
    }

    destroy() {
        this.workBuffer.destroy();
        this.centerBuffer.destroy();
        this.renderer.destroy();
        this.sorter.destroy();
    }

    createSorter() {
        // create sorter
        this.sorter = new GSplatUnifiedSorter();
        this.sorter.on('sorted', (count, version, returnCenters, orderData) => {
            this.onSorted(count, version, returnCenters, orderData);
        });
    }

    add(resource, node) {

        resource.generateLods();
        const splatInfo = new GSplatInfo(this.device, resource, node);
        this.splats.push(splatInfo);

        this.onChange();
    }

    remove(node) {
        const splatInfo = this.splats.find(s => s.node === node);
        if (splatInfo) {
            this.splats.splice(this.splats.indexOf(splatInfo), 1);
            splatInfo.destroy();

            this.onChange();
        }
    }

    onChange() {

        // user might have unloaded splat asset, and so we can no longer use it to render to workbuffer,
        // so no rendering to workbuffer till sorter has delivered the next version of centers
        this.sortedVersionMin = this.centerBuffer.version + 1;

        // force centers update
        this.forceCentersUpdate = true;

        // request work buffer resize
        this.workBufferResizeRequest = true;

        // cancel any pending prepare states - as those are prepared for previous version
        this.splats.forEach(s => s.cancelPrepareState());
    }

    onSorted(count, version, returnCenters, orderData) {

        // reclaim returned centers buffer if available
        if (returnCenters) {
            this.centerBuffer.put(returnCenters);
        }

        // skip older version that got sorted, this can no longer be used for rendering
        if (version < this.sortedVersionMin) {
            return;
        }

        // when a new version was sorted for the first time, we need to fully update work buffer to match
        // centers buffer / sorted data
        if (this.sortedVersion !== version && version === this.centerBuffer.version) {
            this.sortedVersion = version;

            if (this.workBufferResizeRequest) {
                this.workBufferResizeRequest = false;

                const textureSize = this.centerBuffer.textureSize;

                this.workBuffer.resize(textureSize);
                this.workBuffer.setOrderData(orderData);

                this.renderer.setMaxNumSplats(textureSize * textureSize);
            }

            this.splats.forEach((splat) => {
                splat.activatePrepareState();
            });

            this.workBuffer.render(this.splats, this.cameraNode);
        }

        // update order texture
        this.workBuffer.setOrderData(orderData);

        // number of splats to render
        this.renderer.setNumSplats(count);
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

            // how far has the camera moved
            const currentCameraPos = this.cameraNode.getWorldTransform().getTranslation();
            const distance = this.lastCameraPos.distance(currentCameraPos);

            // reorder splats based on update version - active splats at the end
            const lodDirty = this.updateSplatOrder();

            // if camera moved or splats have been reordered, give updated centers to sorter
            if (distance > 1.0 || lodDirty || this.forceCentersUpdate) {
                this.forceCentersUpdate = false;

                this.lastCameraPos.copy(currentCameraPos);

                // Update LOD for each splat individually
                this.splats.forEach((splat) => {

                    // start preparing a state
                    Debug.assert(splat.prepareState === null);
                    splat.prepareState = splat.unusedState;
                    Debug.assert(splat.prepareState);
                    splat.unusedState = null;

                    // this updates LOD intervals and interval texture
                    splat.prepareState.update(this.cameraNode);
                });

                this.centerBuffer.estimateTextureWidth(this.splats, this.device.maxTextureSize);
                const textureSize = this.centerBuffer.textureSize;

                // Reassign lines based on current LOD active splats
                this.assignLines(this.splats, textureSize);

                // generate centers for evaluated lods - this increaments centers version
                // note that the work buffer is not updated yet, and only when we get sorted centers
                const centers = this.centerBuffer.update(this.splats, textureSize);

                let activeCount = 0;
                this.splats.forEach((splat) => {
                    const prepareState = splat.prepareState;
                    activeCount += prepareState.lineCount * prepareState.viewport.z;
                });

                this.sorter.setData(centers, this.centerBuffer.version, activeCount);
            }

            // update data for the sorter - use the same textureSize
            this.sort(this.cameraNode, this.centerBuffer.textureSize);
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
            prepareState.setLines(start, numLines, size);
            start += numLines;
        }
    }

    sort(cameraNode, textureSize) {
        // Get camera's world-space properties
        const cameraMat = cameraNode.getWorldTransform();
        cameraMat.getTranslation(cameraPosition);
        cameraMat.getZ(cameraDirection).normalize();

        const sorterRequest = [];
        this.splats.forEach((splat) => {
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

            // Get sorting range
            const state = splat.prepareState ?? splat.renderState;
            const startIndex = state.lineStart * textureSize;
            const endIndex = startIndex + state.lineCount * textureSize;

            // sorter parameters
            sorterRequest.push({
                transformedDirection,
                offset,
                scale: uniformScale,
                startIndex,
                endIndex
            });
        });

        this.sorter.setSortParams(sorterRequest);
        this.renderer.updateViewport(cameraNode);
    }
}

export { GSplatManager };
