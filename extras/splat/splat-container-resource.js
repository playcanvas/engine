import {
    BoundingBox,
    ContainerResource,
    Entity,
    Mat4,
    Vec3
} from 'playcanvas';

import { Splat } from './splat';
import { SortManager } from './sort-manager.js';

const mat = new Mat4();
const pos = new Vec3();
const dir = new Vec3();

const debugRender = false;
const debugRenderBounds = false;

class SplatContainerResource extends ContainerResource {
    device;

    splatData;

    focalPoint = new Vec3();

    customAabb = new BoundingBox();

    renders;

    meshes = [];

    materials = [];

    textures = [];

    // per-instance data (currently only a single instance is supported)
    instances = [];

    constructor(device, splatData) {
        super();

        this.device = device;
        this.splatData = splatData;

        // calculate splat focal point
        this.splatData.calcFocalPoint(this.focalPoint);

        // calculate custom aabb
        this.splatData.calcAabb(this.customAabb);
    }

    destroy() {
        this.instances.forEach((instance) => {
            instance.splat.destroy();
            instance.sortManager.destroy();
            instance.entity.destroy();
            instance.callbackHandle.off();
        });

        this.splatData = null;
    }

    instantiateModelEntity(/* options: any */) {
        return null;
    }

    instantiateRenderEntity(options) {
        const splatData = this.splatData;
        const splat = new Splat(this.device, splatData.numSplats, options?.debugRender ?? debugRender);

        splat.updateColorData(splatData.getProp('f_dc_0'), splatData.getProp('f_dc_1'), splatData.getProp('f_dc_2'), splatData.getProp('opacity'));
        splat.updateScaleData(splatData.getProp('scale_0'), splatData.getProp('scale_1'), splatData.getProp('scale_2'));
        splat.updateRotationData(splatData.getProp('rot_0'), splatData.getProp('rot_1'), splatData.getProp('rot_2'), splatData.getProp('rot_3'));
        splat.updateCenterData(splatData.getProp('x'), splatData.getProp('y'), splatData.getProp('z'));

        const result = new Entity('ply');
        result.addComponent('render', {
            type: 'asset',
            meshInstances: [splat.meshInstance],
            castShadows: false                  // shadows not supported
        });

        // set custom aabb
        result.render.customAabb = this.customAabb;

        // centers - constant buffer that is sent to the worker
        const x = this.splatData.getProp('x');
        const y = this.splatData.getProp('y');
        const z = this.splatData.getProp('z');

        const centers = new Float32Array(this.splatData.numSplats * 3);
        for (let i = 0; i < this.splatData.numSplats; ++i) {
            centers[i * 3 + 0] = x[i];
            centers[i * 3 + 1] = y[i];
            centers[i * 3 + 2] = z[i];
        }

        // initialize sort
        const sortManager = new SortManager();
        sortManager.sort(
            splat.meshInstance.instancingData.vertexBuffer,
            centers,
            this.device.isWebGPU,
            options?.onChanged
        );

        const viewport = [0, 0];

        const callbackHandle = options.app.on('prerender', () => {
            const cameraMat = options.camera.getWorldTransform();
            cameraMat.getTranslation(pos);
            cameraMat.getZ(dir);

            const modelMat = result.getWorldTransform();
            const invModelMat = mat.invert(modelMat);
            invModelMat.transformPoint(pos, pos);
            invModelMat.transformVector(dir, dir);

            sortManager.setCamera(pos, dir);

            viewport[0] = this.device.width;
            viewport[1] = this.device.height;
            splat.meshInstance.material.setParameter('viewport', viewport);

            // debug render splat bounds
            if (debugRenderBounds) {
                this.splatData.renderWireframeBounds(options.app, modelMat);
            }
        });

        // store instance
        this.instances.push({
            splat,
            sortManager,
            entity: result,
            callbackHandle
        });

        return result;
    }

    updateFocalPoint() {
        this.splatData.calcFocalPoint(this.focalPoint);
    }

    updateAabb() {
        this.splatData.calcAabb(this.customAabb);

        this.instances.forEach((instance) => {
            instance.entity.render.customAabb = this.customAabb;
        });
    }

    getFocalPoint() {
        const instance = this.instances[0];
        return instance?.entity.getWorldTransform().transformPoint(this.focalPoint);
    }
}

export { SplatContainerResource };
