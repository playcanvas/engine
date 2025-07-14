import { Debug } from '../../../core/debug.js';
import { Mat4 } from '../../../core/math/mat4.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { SEMANTIC_POSITION, SEMANTIC_ATTR13, CULLFACE_NONE } from '../../../platform/graphics/constants.js';
import { BLEND_NONE, BLEND_PREMULTIPLIED } from '../../constants.js';
import { GraphNode } from '../../graph-node.js';
import { ShaderMaterial } from '../../materials/shader-material.js';
import { MeshInstance } from '../../mesh-instance.js';
import { GSplatResourceBase } from '../gsplat-resource-base.js';
import { GSplatCentersBuffers } from './gsplat-centers-buffer.js';
import { GSplatInfo } from './gsplat-info.js';
import { GSplatUnifiedSorter } from './gsplat-unified-sorter.js';
import { GSplatWorkBuffer } from './gsplat-work-buffer.js';

/**
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js';
 */

const mat = new Mat4();
const cameraPosition = new Vec3();
const cameraDirection = new Vec3();
const viewport = [0, 0];
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
    node = new GraphNode();

    /** @type {GSplatWorkBuffer} */
    workBuffer;

    /** @type {GSplatCentersBuffers} */
    centerBuffer;

    /**
     * An array of all splats managed by this manager.
     *
     * @type {GSplatInfo[]}
     */
    splats = [];

    /** @type {MeshInstance} */
    meshInstance;

    /** @type {GSplatUnifiedSorter | null} */
    sorter = null;

    /** @type {number} */
    sortedVersion = 0;

    /** @type {number} */
    updateVersion = 0;

    /** @type {Vec3} */
    lastCameraPos = new Vec3(Infinity, Infinity, Infinity);

    constructor(device, resources, nodes) {
        this.device = device;
        this.workBuffer = new GSplatWorkBuffer(device);
        this.centerBuffer = new GSplatCentersBuffers();

        resources.forEach((resource, i) => {
            resource.generateLods();
            const splatInfo = new GSplatInfo(device, resource, nodes[i]);
            this.splats.push(splatInfo);
        });

        this.workBuffer.allocate(this.splats);

        // construct the material which renders the splats from the work buffer
        this._material = new ShaderMaterial({
            uniqueName: 'SplatMaterial',
            vertexGLSL: '#include "gsplatVS"',
            fragmentGLSL: '#include "gsplatPS"',
            vertexWGSL: '#include "gsplatVS"',
            fragmentWGSL: '#include "gsplatPS"',
            attributes: {
                vertex_position: SEMANTIC_POSITION,
                vertex_id_attrib: SEMANTIC_ATTR13
            }
        });

        // input format
        this._material.setDefine('GSPLAT_WORKBUFFER_DATA', true);

        // input textures (work buffer textures)
        const { workBuffer } = this;
        this._material.setParameter('splatColor', workBuffer.colorTexture);
        this._material.setParameter('covA', workBuffer.covATexture);
        this._material.setParameter('covB', workBuffer.covBTexture);
        this._material.setParameter('center', workBuffer.centerTexture);
        this._material.setDefine('SH_BANDS', '0');

        // set instance properties
        const dither = false;
        this._material.setParameter('numSplats', 0);
        this._material.setParameter('splatOrder', workBuffer.orderTexture);
        this._material.setParameter('alphaClip', 0.3);
        this._material.setDefine(`DITHER_${dither ? 'BLUENOISE' : 'NONE'}`, '');
        this._material.cull = CULLFACE_NONE;
        this._material.blendType = dither ? BLEND_NONE : BLEND_PREMULTIPLIED;
        this._material.depthWrite = !!dither;
        this._material.update();

        const { mesh, instanceIndices } = GSplatResourceBase.createMesh(device, workBuffer.width * workBuffer.height);
        this.meshInstance = new MeshInstance(mesh, this._material);
        this.meshInstance.node = this.node;
        this.meshInstance.setInstancing(instanceIndices, true);

        // TODO: is this the best option, or do we want to generate AABB
        this.meshInstance.cull = false;

        // only start rendering the splat after we've received the splat order data
        this.meshInstance.instancingCount = 0;

        // create sorter
        this.sorter = new GSplatUnifiedSorter();
        this.sorter.init(workBuffer.orderTexture);
        this.sorter.on('updated', (count, version, returnCenters) => {
            this.onSorted(count, version, returnCenters);
        });
    }

    onSorted(count, version, returnCenters) {

        // reclaim returned centers buffer if available
        if (returnCenters) {
            this.centerBuffer.put(returnCenters);
        }

        // limit splat render count to exclude those behind the camera
        this.meshInstance.instancingCount = Math.ceil(count / GSplatResourceBase.instanceSize);

        // update splat count on the material
        this._material.setParameter('numSplats', count);

        if (this.sortedVersion !== version) {
            this.sortedVersion = version;

            this.splats.forEach((splat) => {
                splat.activatePrepareState();
            });

            this.workBuffer.render(this.splats);
            // console.log('splat count:', this.workBuffer.centers.length / 3);
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

    update(cameraNode) {

        // do not allow any workbuffer modifications till we get sorted centers back
        if (this.sortedVersion === this.centerBuffer.version) {

            // how far has the camera moved
            const currentCameraPos = cameraNode.getWorldTransform().getTranslation();
            const distance = this.lastCameraPos.distance(currentCameraPos);

            // reorder splats based on update version - active splats at the end
            const lodDirty = this.updateSplatOrder();

            // if camera moved or splats have been reordered, give updated centers to sorter
            if (distance > 1.0 || lodDirty) {
                this.lastCameraPos.copy(currentCameraPos);

                // Update LOD for each splat individually
                this.splats.forEach((splat) => {

                    // start preparing a state
                    Debug.assert(splat.prepareState === null);
                    splat.prepareState = splat.unusedState;
                    splat.unusedState = null;

                    // this updates LOD intervals and interval texture
                    splat.prepareState.update(cameraNode);
                });

                // Reassign lines based on current LOD active splats
                this.assignLines(this.splats, this.workBuffer.width);

                // generate centers for evaluated lods
                // note that the work buffer is not updated yet, and only when we get sorted centers
                const textureSize = this.workBuffer.width;
                const centers = this.centerBuffer.update(this.splats, textureSize);

                let activeCount = 0;
                this.splats.forEach((splat) => {
                    const prepareState = splat.prepareState;
                    activeCount += prepareState.lineCount * prepareState.viewport.z;
                });

                this.sorter.setCenters(centers, this.centerBuffer.version, activeCount);
            }

            // update data for the sorter
            this.sort(cameraNode);
        }

        // if we got sorted centers at least one time, which makes the renderState valid
        if (this.sortedVersion > 0) {

            // any splats that have changed this frame need to be re-rendered to work buffer
            const updateVersion = this.updateVersion;
            const rt = this.workBuffer.renderTarget;
            this.splats.forEach((splat) => {
                if (splat.updateVersion === updateVersion) {
                    splat.render(rt);
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

    updateViewport(cameraNode) {
        const camera = cameraNode?.camera;
        const renderTarget = camera?.renderTarget;
        const { width, height } = renderTarget ?? this.device;

        viewport[0] = width;
        viewport[1] = height;

        // adjust viewport for stereoscopic VR sessions
        const xr = camera?.camera?.xr;
        if (xr?.active && xr.views.list.length === 2) {
            viewport[0] *= 0.5;
        }

        this._material.setParameter('viewport', viewport);
    }

    sort(cameraNode) {
        if (this.sorter) {

            // camera transform
            const cameraMat = cameraNode.getWorldTransform();
            cameraMat.getTranslation(cameraPosition);
            cameraMat.getZ(cameraDirection);

            // TODO: handle a case the camera has not changed
            // TODO: handle a case the splats have moved

            // sorter request per splat
            const sorterRequest = [];
            this.splats.forEach((splat) => {

                // splat transform
                const modelMat = splat.node.getWorldTransform();
                const invModelMat = mat.invert(modelMat);

                const scale = modelMat.getScale();
                Debug.call(() => {
                    const isUniform = Math.abs(scale.x - scale.y) < 1e-6 && Math.abs(scale.y - scale.z) < 1e-6;
                    if (!isUniform) {
                        Debug.warnOnce(`Scale of a GSplat ${splat.node.name} is not uniform, which causes problems with their global sorting.`, scale);
                    }
                });

                // transform camera position and direction to model space of the splat, to avoid trannsforming centers to world space
                // also pre-scale those, to make the sorter generate distances from camera uneffected by the scale
                const cameraPositionTransformed = invModelMat.transformPoint(cameraPosition).mulScalar(scale.x);
                const cameraDirectionTransformed = invModelMat.transformVector(cameraDirection).mulScalar(scale.x);

                const state = splat.prepareState ?? splat.renderState;

                // range of splats for this node
                const textureSize = this.workBuffer.orderTexture.width;
                const startIndex = state.lineStart * textureSize;
                const endIndex = startIndex + state.lineCount * textureSize;

                sorterRequest.push({
                    cameraPosition: cameraPositionTransformed,
                    cameraDirection: cameraDirectionTransformed,
                    startIndex,
                    endIndex
                });
            });

            this.sorter.setSortParams(sorterRequest);
        }

        this.updateViewport(cameraNode);
    }
}

export { GSplatManager };
