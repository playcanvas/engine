import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { CULLFACE_NONE, SEMANTIC_ATTR13, SEMANTIC_POSITION, PIXELFORMAT_R32U } from '../../platform/graphics/constants.js';
import { MeshInstance } from '../mesh-instance.js';
import { GSplatResolveSH } from './gsplat-resolve-sh.js';
import { GSplatSorter } from './gsplat-sorter.js';
import { GSplatSogsData } from './gsplat-sogs-data.js';
import { ShaderMaterial } from '../materials/shader-material.js';
import { BLEND_NONE, BLEND_PREMULTIPLIED } from '../constants.js';

/**
 * @import { Camera } from '../camera.js'
 * @import { GSplatResourceBase } from './gsplat-resource-base.js'
 * @import { GraphNode } from '../graph-node.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 */

const mat = new Mat4();
const cameraPosition = new Vec3();
const cameraDirection = new Vec3();
const viewport = [0, 0];

/** @ignore */
class GSplatInstance {
    /** @type {GSplatResourceBase} */
    resource;

    /** @type {Texture} */
    orderTexture;

    /** @type {ShaderMaterial} */
    _material;

    /** @type {MeshInstance} */
    meshInstance;

    options = {};

    /** @type {GSplatSorter|null} */
    sorter = null;

    lastCameraPosition = new Vec3();

    lastCameraDirection = new Vec3();

    /** @type {GSplatResolveSH|null} */
    resolveSH = null;

    /**
     * List of cameras this instance is visible for. Updated every frame by the renderer.
     *
     * @type {Camera[]}
     * @ignore
     */
    cameras = [];

    /**
     * @param {GSplatResourceBase} resource - The splat instance.
     * @param {ShaderMaterial|null} material - The material instance.
     */
    constructor(resource, material) {
        this.resource = resource;

        // create the order texture
        this.orderTexture = resource.createTexture(
            'splatOrder',
            PIXELFORMAT_R32U,
            resource.evalTextureSize(resource.numSplats)
        );

        if (material) {
            // material is provided
            this._material = material;

            // patch splat order
            this._material.setParameter('splatOrder', this.orderTexture);
        } else {
            // construct the material
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

            // default configure
            this.configureMaterial(this._material);

            // update
            this._material.update();
        }

        this.meshInstance = new MeshInstance(resource.mesh, this._material);
        this.meshInstance.setInstancing(resource.instanceIndices, true);
        this.meshInstance.gsplatInstance = this;

        // only start rendering the splat after we've received the splat order data
        this.meshInstance.instancingCount = 0;

        // clone centers to allow multiple instances of sorter
        const centers = resource.centers.slice();
        const chunks = resource.chunks?.slice();

        // create sorter
        this.sorter = new GSplatSorter();
        this.sorter.init(this.orderTexture, centers, chunks);
        this.sorter.on('updated', (count) => {
            // limit splat render count to exclude those behind the camera
            this.meshInstance.instancingCount = Math.ceil(count / resource.instanceSize);

            // update splat count on the material
            this.material.setParameter('numSplats', count);
        });

        // configure sogs sh resolve
        const { gsplatData } = resource;
        if (gsplatData instanceof GSplatSogsData && gsplatData.shBands > 0 && !gsplatData.fullSH) {
            this.resolveSH = new GSplatResolveSH(resource.device, this);
            this.material.setDefine('SH_BANDS', '0');
        }
    }

    destroy() {
        this.resolveSH?.destroy();
        this.material?.destroy();
        this.meshInstance?.destroy();
        this.sorter?.destroy();
    }

    /**
     * @param {ShaderMaterial} value - The material instance.
     */
    set material(value) {
        if (this._material !== value) {
            // set the new material
            this._material = value;

            // patch order texture
            this._material.setParameter('splatOrder', this.orderTexture);

            if (this.meshInstance) {
                this.meshInstance.material = value;
            }
        }
    }

    get material() {
        return this._material;
    }

    /**
     * Configure the material with gsplat instance and resource properties.
     *
     * @param {ShaderMaterial} material - The material to configure.
     * @param {object} [options] - Object for passing optional arguments.
     * @param {boolean} [options.dither] - Specify true to configure the material for dithered rendering (stochastic alpha).
     */
    configureMaterial(material, options = {}) {
        // allow resource to configure the material
        this.resource.configureMaterial(material);

        // set instance properties
        material.setParameter('numSplats', 0);
        material.setParameter('splatOrder', this.orderTexture);
        material.setParameter('alphaClip', 0.3);
        material.setDefine(`DITHER_${options.dither ? 'BLUENOISE' : 'NONE'}`, '');
        material.cull = CULLFACE_NONE;
        material.blendType = options.dither ? BLEND_NONE : BLEND_PREMULTIPLIED;
        material.depthWrite = !!options.dither;
    }

    updateViewport(cameraNode) {
        const camera = cameraNode?.camera;
        const renderTarget = camera?.renderTarget;
        const { width, height } = renderTarget ?? this.resource.device;

        viewport[0] = width;
        viewport[1] = height;

        // adjust viewport for stereoscopic VR sessions
        const xr = camera?.camera?.xr;
        if (xr?.active && xr.views.list.length === 2) {
            viewport[0] *= 0.5;
        }

        this.material.setParameter('viewport', viewport);
    }

    /**
     * Sorts the GS vertices based on the given camera.
     * @param {GraphNode} cameraNode - The camera node used for sorting.
     */
    sort(cameraNode) {
        if (this.sorter) {
            const cameraMat = cameraNode.getWorldTransform();
            cameraMat.getTranslation(cameraPosition);
            cameraMat.getZ(cameraDirection);

            const modelMat = this.meshInstance.node.getWorldTransform();
            const invModelMat = mat.invert(modelMat);
            invModelMat.transformPoint(cameraPosition, cameraPosition);
            invModelMat.transformVector(cameraDirection, cameraDirection);

            // sort if the camera has changed
            if (!cameraPosition.equalsApprox(this.lastCameraPosition) || !cameraDirection.equalsApprox(this.lastCameraDirection)) {
                this.lastCameraPosition.copy(cameraPosition);
                this.lastCameraDirection.copy(cameraDirection);
                this.sorter.setCamera(cameraPosition, cameraDirection);
            }
        }

        this.updateViewport(cameraNode);
    }

    update() {
        if (this.cameras.length > 0) {

            // sort by the first camera it's visible for
            // TODO: extend to support multiple cameras
            const camera = this.cameras[0];
            this.sort(camera._node);

            // for debuggging - disable sh resolve on a global
            this.resolveSH?.render(camera._node, this.meshInstance.node.getWorldTransform());

            // we get new list of cameras each frame
            this.cameras.length = 0;
        }
    }
}

export { GSplatInstance };
