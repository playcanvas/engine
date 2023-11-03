import {
    MeshInstance,
    Mesh,
    Vec3,
    Mat4,
    createBox,
    BUFFER_DYNAMIC,
    VertexBuffer
} from "playcanvas";

import { SplatSorter } from './splat-sorter.js';

const mat = new Mat4();
const cameraPosition = new Vec3();
const cameraDirection = new Vec3();
const viewport = [0, 0];

class SplatInstance {
    splat;

    mesh;

    meshInstance;

    material;

    vb;

    sorter;

    lastCameraPosition = new Vec3();

    lastCameraDirection = new Vec3();

    constructor(splat, cameraEntity, debugRender = false) {
        this.splat = splat;

        // material
        this.material = splat.createMaterial(debugRender);

        // mesh
        const device = splat.device;
        if (debugRender) {
            this.mesh = createBox(device, {
                halfExtents: new Vec3(1.0, 1.0, 1.0)
            });
        } else {
            this.mesh = new Mesh(device);
            this.mesh.setPositions(new Float32Array([
                -1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1
            ]), 2);
            this.mesh.update();
        }

        // initialize index data
        const numSplats = splat.numSplats;
        let indexData;
        if (device.isWebGPU) {
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
        this.meshInstance.setInstancing(vb);
        this.meshInstance.splatInstance = this;

        this.sorter = new SplatSorter();
        this.sorter.init(this.vb, this.splat.centers, this.splat.device.isWebGPU);

        // if camera entity is provided, automatically use it to sort splats
        if (cameraEntity) {
            this.callbackHandle = cameraEntity._app.on('prerender', () => {
                this.sort(cameraEntity);
            });
        }

        this.updateViewport();
    }

    destroy() {
        this.material.destroy();
        this.vb.destroy();
        this.meshInstance.destroy();
        this.sorter.destroy();
        this.callbackHandle?.off();
    }

    updateViewport() {
        const device = this.splat.device;
        viewport[0] = device.width;
        viewport[1] = device.height;
        this.material.setParameter('viewport', viewport);
    }

    sort(camera) {

        let sorted = false;

        const cameraMat = camera.getWorldTransform();
        cameraMat.getTranslation(cameraPosition);
        cameraMat.getZ(cameraDirection);

        // sort if the camera has changed
        if (!cameraPosition.equalsApprox(this.lastCameraPosition) || !cameraDirection.equalsApprox(this.lastCameraDirection)) {

            this.lastCameraPosition.copy(cameraPosition);
            this.lastCameraDirection.copy(cameraDirection);
            sorted = true;

            const modelMat = this.meshInstance.node.getWorldTransform();
            const invModelMat = mat.invert(modelMat);
            invModelMat.transformPoint(cameraPosition, cameraPosition);
            invModelMat.transformVector(cameraDirection, cameraDirection);

            this.sorter.setCamera(cameraPosition, cameraDirection);
        }

        this.updateViewport();

        return sorted;
    }
}

export { SplatInstance };
