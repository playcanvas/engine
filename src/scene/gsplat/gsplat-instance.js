import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BUFFER_STATIC, PIXELFORMAT_R32U, SEMANTIC_ATTR13, TYPE_UINT32 } from '../../platform/graphics/constants.js';
import { DITHER_NONE } from '../constants.js';
import { MeshInstance } from '../mesh-instance.js';
import { Mesh } from '../mesh.js';
import { GSplatSorter } from './gsplat-sorter.js';
import { VertexFormat } from '../../platform/graphics/vertex-format.js';
import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';

/**
 * @import { Camera } from '../camera.js'
 * @import { GSplat } from './gsplat.js'
 * @import { GSplatCompressed } from './gsplat-compressed.js'
 * @import { GSplatSogs } from './gsplat-sogs.js'
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
    /** @type {GSplat | GSplatCompressed | GSplatSogs } */
    splat;

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
     * @param {GSplat} splat - The splat instance.
     * @param {SplatMaterialOptions} options - The options.
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
                -1, -1, i,
                1, -1, i,
                1, 1, i,
                -1, 1, i
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
        const centers = splat.centers.slice();
        const chunks = splat.chunks?.slice();

        // create sorter
        if (!options.dither || options.dither === DITHER_NONE) {
            this.sorter = new GSplatSorter();
            this.sorter.init(this.orderTexture, centers, chunks);
            this.sorter.on('updated', (count) => {
                // limit splat render count to exclude those behind the camera
                this.meshInstance.instancingCount = Math.ceil(count / splatInstanceSize);

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
        return new GSplatInstance(this.splat, this.options);
    }

    createMaterial(options) {
        this.material = this.splat.createMaterial(options);
        this.material.setParameter('splatOrder', this.orderTexture);
        this.material.setParameter('alphaClip', 0.3);
        if (this.meshInstance) {
            this.meshInstance.material = this.material;
        }
    }

    updateViewport(cameraNode) {
        const camera = cameraNode?.camera;
        const renderTarget = camera?.renderTarget;
        const { width, height } = renderTarget ?? this.splat.device;

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
