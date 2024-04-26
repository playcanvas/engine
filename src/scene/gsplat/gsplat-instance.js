import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { PIXELFORMAT_R32U, SEMANTIC_POSITION, TYPE_UINT32 } from '../../platform/graphics/constants.js';
import { DITHER_NONE } from '../constants.js';
import { MeshInstance } from '../mesh-instance.js';
import { Mesh } from '../mesh.js';
import { createGSplatMaterial } from './gsplat-material.js';
import { GSplatSorter } from './gsplat-sorter.js';

const mat = new Mat4();
const cameraPosition = new Vec3();
const cameraDirection = new Vec3();
const viewport = [0, 0];

/** @ignore */
class GSplatInstance {
    /** @type {import('./gsplat.js').GSplat} */
    splat;

    /** @type {Mesh} */
    mesh;

    /** @type {MeshInstance} */
    meshInstance;

    /** @type {import('../materials/material.js').Material} */
    material;

    /** @type {import('../../platform/graphics/vertex-buffer.js').VertexBuffer} */
    vb;

    options = {};

    /** @type {import('../../platform/graphics/texture.js').Texture} */
    orderTexture;

    /** @type {GSplatSorter | null} */
    sorter = null;

    lastCameraPosition = new Vec3();

    lastCameraDirection = new Vec3();

    /**
     * List of cameras this instance is visible for. Updated every frame by the renderer.
     *
     * @type {import('../camera.js').Camera[]}
     * @ignore
     */
    cameras = [];

    /**
     * @param {import('./gsplat.js').GSplat} splat - The splat instance.
     * @param {import('./gsplat-material.js').SplatMaterialOptions} options - The options.
     */
    constructor(splat, options) {
        this.splat = splat;

        // clone options object
        options = Object.assign(this.options, options);

        // not supported on WebGL1
        const device = splat.device;
        if (device.isWebGL1)
            return;

        // create the order texture
        this.orderTexture = this.splat.createTexture('splatOrder', PIXELFORMAT_R32U, this.splat.evalTextureSize(this.splat.numSplats));

        // material
        this.createMaterial(options);

        const numSplats = splat.numSplats;
        const indices = new Uint32Array(numSplats * 6);
        const ids = new Uint32Array(numSplats * 4);

        for (let i = 0; i < numSplats; ++i) {
            const base = i * 4;

            // 4 vertices	
            ids[base + 0] = i;	
            ids[base + 1] = i;	
            ids[base + 2] = i;	
            ids[base + 3] = i;

            // 2 triangles
            const triBase = i * 6;
            indices[triBase + 0] = base;
            indices[triBase + 1] = base + 1;
            indices[triBase + 2] = base + 2;
            indices[triBase + 3] = base;
            indices[triBase + 4] = base + 2;
            indices[triBase + 5] = base + 3;
        }

        // mesh
        const mesh = new Mesh(device);
        mesh.setVertexStream(SEMANTIC_POSITION, ids, 1, numSplats * 4, TYPE_UINT32, false, true);
        mesh.setIndices(indices);
        mesh.update();
        this.mesh = mesh;
        this.mesh.aabb.copy(splat.aabb);

        this.meshInstance = new MeshInstance(this.mesh, this.material);
        this.meshInstance.gsplatInstance = this;

        // clone centers to allow multiple instances of sorter
        this.centers = new Float32Array(splat.centers);

        // create sorter
        if (!options.dither || options.dither === DITHER_NONE) {
            this.sorter = new GSplatSorter();
            this.sorter.init(this.orderTexture, this.centers);
            this.sorter.on('updated', (count) => {
                // ideally we would update the number of splats rendered here in order to skip
                // the ones behind the camera. unfortunately changing this value dynamically
                // results in performance lockups. (the browser is likely re-validating the index
                // buffer when this value changes and/or re-uploading the index buffer to gpu memory).
                // this.mesh.primitive[0].count = count * 6;
            });
        }
    }

    destroy() {
        this.material?.destroy();
        this.meshInstance?.destroy();
        this.orderTexture?.destroy();
        this.sorter?.destroy();
    }

    clone() {
        return new GSplatInstance(this.splat, this.options);
    }

    createMaterial(options) {
        this.material = createGSplatMaterial(options);
        this.material.setParameter('splatOrder', this.orderTexture);
        this.splat.setupMaterial(this.material);
        if (this.meshInstance) {
            this.meshInstance.material = this.material;
        }
    }

    updateViewport() {
        // TODO: improve, needs to handle render targets of different sizes
        const device = this.splat.device;
        viewport[0] = device.width;
        viewport[1] = device.height;
        this.material.setParameter('viewport', viewport);
    }

    /**
     * Sorts the GS vertices based on the given camera.
     * @param {import('../graph-node.js').GraphNode} cameraNode - The camera node used for sorting.
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

        this.updateViewport();
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
