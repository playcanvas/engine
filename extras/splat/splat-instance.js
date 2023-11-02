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
const pos = new Vec3();
const dir = new Vec3();

class SplatInstance {
    splat;

    mesh;

    material;

    vb;

    constructor(splat, debugRender = false) {
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

        //this.setupSorter();





        /////////////////////////////
        // this.update();
    }

    destroy() {
        // this.colorTexture.destroy();
        // this.scaleTexture.destroy();
        // this.rotationTexture.destroy();
        // this.centerTexture.destroy();
        // this.material.destroy();
        // this.mesh.destroy();

        this.sortCallbackHandle.off();
    }

    setupSorter(app, camera, entity) {

        const sorter = new SplatSorter();
        sorter.init(
            this.vb,
            this.splat.centers,
            this.splat.device.isWebGPU,




            //options?.onChanged
        );

        const viewport = [0, 0];

        this.sortCallbackHandle = app.on('prerender', () => {

            const device = this.splat.device;
            const cameraMat = camera.getWorldTransform();
            cameraMat.getTranslation(pos);
            cameraMat.getZ(dir);

            const modelMat = entity.getWorldTransform();
            const invModelMat = mat.invert(modelMat);
            invModelMat.transformPoint(pos, pos);
            invModelMat.transformVector(dir, dir);

            sorter.setCamera(pos, dir);

            viewport[0] = device.width;
            viewport[1] = device.height;
            this.meshInstance.material.setParameter('viewport', viewport);

            // // debug render splat bounds
            // if (debugRenderBounds) {
            //     this.splatData.renderWireframeBounds(options.app, modelMat);
            // }
        });

    }
}

export { SplatInstance };
