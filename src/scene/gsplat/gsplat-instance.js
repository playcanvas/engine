import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { PIXELFORMAT_R32U } from '../../platform/graphics/constants.js';
import { DITHER_NONE } from '../constants.js';
import { MeshInstance } from '../mesh-instance.js';
import { Mesh } from '../mesh.js';
import { GSplatSorter } from './gsplat-sorter.js';

/**
 * @import { Camera } from '../camera.js'
 * @import { GSplatResourceBase } from './gsplat-resource-base.js'
 * @import { GraphNode } from '../graph-node.js'
 * @import { Material } from '../materials/material.js'
 * @import { SplatMaterialOptions } from './gsplat-material.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 */

const mat = new Mat4();
const cameraPosition = new Vec3();
const cameraDirection = new Vec3();
const viewport = [0, 0];

/** @ignore */
class GSplatInstance {
    /** @type {GSplatResourceBase } */
    splatResource;

    /** @type {Mesh} */
    mesh;

    /** @type {MeshInstance} */
    meshInstance;

    /** @type {Material} */
    material;

    /** @type {Texture} */
    orderTexture;

    options = {};

    /** @type {GSplatSorter | null} */
    sorter = null;

    lastCameraPosition = new Vec3();

    lastCameraDirection = new Vec3();

    /**
     * List of cameras this instance is visible for. Updated every frame by the renderer.
     *
     * @type {Camera[]}
     * @ignore
     */
    cameras = [];

    /**
     * @param {GSplatResourceBase} splatResource - The splat instance.
     * @param {SplatMaterialOptions} options - The options.
     */
    constructor(splatResource, options) {
        this.splatResource = splatResource;

        // clone options object
        options = Object.assign(this.options, options);

        // create the order texture
        this.orderTexture = this.splatResource.createTexture(
            'splatOrder',
            PIXELFORMAT_R32U,
            this.splatResource.evalTextureSize(splatResource.numSplats)
        );

        // material
        this.createMaterial(options);

        this.mesh = splatResource.mesh;
        this.mesh.aabb.copy(splatResource.aabb);

        this.meshInstance = new MeshInstance(this.mesh, this.material);
        this.meshInstance.setInstancing(splatResource.instanceIndices, true);
        this.meshInstance.gsplatInstance = this;

        // only start rendering the splat after we've received the splat order data
        this.meshInstance.instancingCount = 0;

        // clone centers to allow multiple instances of sorter
        const centers = splatResource.centers.slice();
        const chunks = splatResource.chunks?.slice();

        // create sorter
        if (!options.dither || options.dither === DITHER_NONE) {
            this.sorter = new GSplatSorter();
            this.sorter.init(this.orderTexture, centers, chunks);
            this.sorter.on('updated', (count) => {
                // limit splat render count to exclude those behind the camera
                this.meshInstance.instancingCount = Math.ceil(count / splatResource.instanceSize);

                // update splat count on the material
                this.material.setParameter('numSplats', count);
            });
        }
    }

    destroy() {
        this.material?.destroy();
        this.meshInstance?.destroy();
        this.sorter?.destroy();
    }

    clone() {
        return new GSplatInstance(this.splatResource, this.options);
    }

    createMaterial(options) {
        this.material = this.splatResource.createMaterial(options);
        this.material.setParameter('splatOrder', this.orderTexture);
        this.material.setParameter('alphaClip', 0.3);
        if (this.meshInstance) {
            this.meshInstance.material = this.material;
        }
    }

    updateViewport(cameraNode) {
        const camera = cameraNode?.camera;
        const renderTarget = camera?.renderTarget;
        const { width, height } = renderTarget ?? this.splatResource.device;

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

            // we get new list of cameras each frame
            this.cameras.length = 0;
        }
    }
}

export { GSplatInstance };
