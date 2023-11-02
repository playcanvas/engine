import {
    BoundingBox,
    ContainerResource,
    Entity,
    Vec3
} from 'playcanvas';

import { Splat } from './splat.js';
import { SplatInstance } from './splat-instance.js';

const globalDebugRender = false;

class SplatContainerResource extends ContainerResource {
    device;

    splatData;

    splat;

    focalPoint = new Vec3();

    // TODO: this can be set on render component -> mesh instance, remove this one?
    customAabb = new BoundingBox();

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
        // this.instances.forEach((instance) => {
        //     instance.splat.destroy();
        //     instance.sortManager.destroy();
        //     instance.entity.destroy();
        //     instance.callbackHandle.off();
        // });

        this.device = null;
        this.splatData = null;
    }

    // TODO: debug renderer should be set on a splat instance, not on a splat
    createSplat() {
        if (!this.splat) {

            const splatData = this.splatData;
            const splat = new Splat(this.device, splatData.numSplats, globalDebugRender);
            this.splat = splat;

            // texture data
            splat.updateColorData(splatData.getProp('f_dc_0'), splatData.getProp('f_dc_1'), splatData.getProp('f_dc_2'), splatData.getProp('opacity'));
            splat.updateScaleData(splatData.getProp('scale_0'), splatData.getProp('scale_1'), splatData.getProp('scale_2'));
            splat.updateRotationData(splatData.getProp('rot_0'), splatData.getProp('rot_1'), splatData.getProp('rot_2'), splatData.getProp('rot_3'));
            splat.updateCenterData(splatData.getProp('x'), splatData.getProp('y'), splatData.getProp('z'));

            // centers - constant buffer that is sent to the worker
            const x = splatData.getProp('x');
            const y = splatData.getProp('y');
            const z = splatData.getProp('z');

            const centers = new Float32Array(this.splatData.numSplats * 3);
            for (let i = 0; i < this.splatData.numSplats; ++i) {
                centers[i * 3 + 0] = x[i];
                centers[i * 3 + 1] = y[i];
                centers[i * 3 + 2] = z[i];
            }
            splat.centers = centers;
        }

        return this.splat;
    }

    instantiateModelEntity(/* options: any */) {
        return null;
    }

    instantiateRenderEntity(options) {

        const splat = this.createSplat();

        const debugRender = options?.debugRender ?? globalDebugRender;
        const splatInstance = new SplatInstance(splat, debugRender);

        const entity = new Entity('Splat');
        entity.addComponent('render', {
            type: 'asset',
            meshInstances: [splatInstance.meshInstance],

            // shadows not supported
            castShadows: false
        });

        // set custom aabb
        entity.render.customAabb = this.customAabb;





        /////////////
        splatInstance.setupSorter(options.app, options.camera, entity);




        return entity;
    }

    // updateFocalPoint() {
    //     this.splatData.calcFocalPoint(this.focalPoint);
    // }

    // updateAabb() {
    //     this.splatData.calcAabb(this.customAabb);

    //     this.instances.forEach((instance) => {
    //         instance.entity.render.customAabb = this.customAabb;
    //     });
    // }

    // getFocalPoint() {
    //     const instance = this.instances[0];
    //     return instance?.entity.getWorldTransform().transformPoint(this.focalPoint);
    // }
}

export { SplatContainerResource };
