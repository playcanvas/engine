import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BUFFER_STATIC, PIXELFORMAT_R32U, SEMANTIC_ATTR13, TYPE_UINT32 } from '../../platform/graphics/constants.js';
import { DITHER_NONE } from '../constants.js';
import { MeshInstance } from '../mesh-instance.js';
import { Mesh } from '../mesh.js';
import { GSplatSorter } from './gsplat-sorter.js';
import { VertexFormat } from '../../platform/graphics/vertex-format.js';
import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';

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

    /** @type {import('../../platform/graphics/texture.js').Texture} */
    orderTexture;

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

        const device = splat.device;

        // create the order texture
        this.orderTexture = this.splat.createTexture(
            'splatOrder',
            PIXELFORMAT_R32U,
            this.splat.evalTextureSize(this.splat.numSplats)
        );

        // material
        this.createMaterial(options);

        // number of quads to combine into a single instance. this is to increase occupancy
        // in the vertex shader.
        const splatInstanceSize = 128;
        const numSplats = Math.ceil(splat.numSplats / splatInstanceSize) * splatInstanceSize;
        const numSplatInstances = numSplats / splatInstanceSize;

        // specify the base splat index per instance
        const indexData = new Uint32Array(numSplatInstances);
        for (let i = 0; i < numSplatInstances; ++i) {
            indexData[i] = i * splatInstanceSize;
        }

        const vertexFormat = new VertexFormat(device, [
            { semantic: SEMANTIC_ATTR13, components: 1, type: TYPE_UINT32, asInt: true }
        ]);

        const indicesVB = new VertexBuffer(device, vertexFormat, numSplatInstances, {
            usage: BUFFER_STATIC,
            data: indexData.buffer
        });

        // build the instance mesh
        const meshPositions = new Float32Array(12 * splatInstanceSize);
        const meshIndices = new Uint32Array(6 * splatInstanceSize);
        for (let i = 0; i < splatInstanceSize; ++i) {
            meshPositions.set([
                -2, -2, i,
                2, -2, i,
                2, 2, i,
                -2, 2, i
            ], i * 12);

            const b = i * 4;
            meshIndices.set([
                0 + b, 1 + b, 2 + b, 0 + b, 2 + b, 3 + b
            ], i * 6);
        }

        const mesh = new Mesh(device);
        mesh.setPositions(meshPositions, 3);
        mesh.setIndices(meshIndices);
        mesh.update();

        this.mesh = mesh;
        this.mesh.aabb.copy(splat.aabb);

        this.meshInstance = new MeshInstance(this.mesh, this.material);
        this.meshInstance.setInstancing(indicesVB, true);
        this.meshInstance.gsplatInstance = this;

        // only start rendering the splat after we've received the splat order data
        this.meshInstance.instancingCount = 0;

        // clone centers to allow multiple instances of sorter
        this.centers = new Float32Array(splat.centers);

        // create sorter
        if (!options.dither || options.dither === DITHER_NONE) {
            this.sorter = new GSplatSorter();
            this.sorter.init(this.orderTexture, this.centers);
            this.sorter.on('updated', (count) => {
                // limit splat render count to exclude those behind the camera.
                // NOTE: the last instance rendered may include non-existant splat
                // data. this should be ok though as the data is filled with 0's.
                this.meshInstance.instancingCount = Math.ceil(count / splatInstanceSize);
            });
        }
    }

    destroy() {
        this.material?.destroy();
        this.meshInstance?.destroy();
        this.sorter?.destroy();
    }

    clone() {
        return new GSplatInstance(this.splat, this.options);
    }

    createMaterial(options) {
        this.material = this.splat.createMaterial(options);
        this.material.setParameter('splatOrder', this.orderTexture);
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
