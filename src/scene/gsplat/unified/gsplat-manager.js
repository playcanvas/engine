import { Debug } from '../../../core/debug.js';
import { Mat4 } from '../../../core/math/mat4.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { SEMANTIC_POSITION, SEMANTIC_ATTR13, CULLFACE_NONE } from '../../../platform/graphics/constants.js';
import { BLEND_NONE, BLEND_PREMULTIPLIED } from '../../constants.js';
import { GraphNode } from '../../graph-node.js';
import { ShaderMaterial } from '../../materials/shader-material.js';
import { MeshInstance } from '../../mesh-instance.js';
import { GSplatResourceBase } from '../gsplat-resource-base.js';
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

    /** @type {Vec3} */
    lastCameraPos = new Vec3(Infinity, Infinity, Infinity);

    constructor(device, resources, nodes) {
        this.device = device;
        this.workBuffer = new GSplatWorkBuffer(device);

        resources.forEach((resource, i) => {
            resource.generateLods();
            const splatInfo = new GSplatInfo(device, resource);
            splatInfo.node = nodes[i];

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

        const centers = workBuffer.centers;
        const chunks = null;

        // create sorter
        this.sorter = new GSplatUnifiedSorter();
        this.sorter.init(workBuffer.orderTexture, centers, chunks);
        this.sorter.on('updated', (count, version) => {

            // limit splat render count to exclude those behind the camera
            this.meshInstance.instancingCount = Math.ceil(count / GSplatResourceBase.instanceSize);

            // update splat count on the material
            this._material.setParameter('numSplats', count);

            if (this.sortedVersion !== version) {
                this.sortedVersion = version;
                workBuffer.render(this.splats);
                // console.log('splat count:', this.workBuffer.centers.length / 3);
            }
        });
    }

    update(cameraNode) {

        // Get current camera position in world space
        const currentCameraPos = cameraNode.getWorldTransform().getTranslation();

        if (this.sortedVersion === this.workBuffer.centersVersion) {

            // Check if camera has moved more than 1 unit since last LOD update
            const distance = this.lastCameraPos.distance(currentCameraPos);
            if (distance > 1.0) {
                this.lastCameraPos.copy(currentCameraPos);

                // Update LOD for each splat individually
                this.splats.forEach((splat) => {
                    // this updates LOD intervals and interval texture
                    splat.lod.update(cameraNode);
                });

                // generate centers for evaluated lods
                // note that the work buffer is not updated yet, and only when we get sorted centers
                this.workBuffer.updateCenters(this.splats);

                let activeCount = 0;
                this.splats.forEach((splat) => {
                    activeCount += splat.lineCount * splat.viewport.z;
                });

                this.sorter.setCenters(this.workBuffer.centers, this.workBuffer.centersVersion, activeCount);
            }

            this.sort(cameraNode);
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

                // range of splats for this node
                const textureSize = this.workBuffer.orderTexture.width;
                const startIndex = splat.lineStart * textureSize;
                const endIndex = startIndex + splat.lineCount * textureSize;

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
