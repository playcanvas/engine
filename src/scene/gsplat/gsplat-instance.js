import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BUFFER_DYNAMIC } from '../../platform/graphics/constants.js';
import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';
import { DITHER_NONE } from '../constants.js';
import { MeshInstance } from '../mesh-instance.js';
import { Mesh } from '../mesh.js';
import { createBox } from '../procedural.js';
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

    /** @type {VertexBuffer} */
    vb;

    options = {};

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

        // material
        const debugRender = options.debugRender;
        this.createMaterial(options);

        // mesh
        const device = splat.device;
        if (debugRender) {
            this.mesh = createBox(device, {
                halfExtents: new Vec3(1.0, 1.0, 1.0)
            });
        } else {
            this.mesh = new Mesh(device);
            this.mesh.setPositions(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2);
            this.mesh.setIndices([0, 1, 2, 0, 2, 3]);
            this.mesh.update();
        }

        this.mesh.aabb.copy(splat.aabb);

        // initialize index data
        const numSplats = splat.numSplats;
        let indexData;
        if (!device.isWebGL1) {
            indexData = new Uint32Array(numSplats);
            for (let i = 0; i < numSplats; ++i) {
                indexData[i] = i;
            }
        } else {
            indexData = new Float32Array(numSplats);
            for (let i = 0; i < numSplats; ++i) {
                indexData[i] = i + 0.2;
            }
        }

        const vb = new VertexBuffer(
            device,
            splat.vertexFormat,
            numSplats,
            BUFFER_DYNAMIC,
            indexData.buffer
        );
        this.vb = vb;

        this.meshInstance = new MeshInstance(this.mesh, this.material);
        this.meshInstance.setInstancing(vb, true);
        this.meshInstance.gsplatInstance = this;

        // clone centers to allow multiple instances of sorter
        this.centers = new Float32Array(splat.centers);

        // create sorter
        if (!options.dither || options.dither === DITHER_NONE) {
            this.sorter = new GSplatSorter();
            this.sorter.init(this.vb, this.centers, !this.splat.device.isWebGL1);
        }
    }

    destroy() {
        this.material.destroy();
        this.vb.destroy();
        this.meshInstance.destroy();
        this.sorter?.destroy();
    }

    clone() {
        return new GSplatInstance(this.splat, this.options);
    }

    createMaterial(options) {
        this.material = createGSplatMaterial(options);
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
