import { Entity } from '../entity.js';
import { GSplatInstance } from '../../scene/gsplat/gsplat-instance.js';
import { GSplat } from '../../scene/gsplat/gsplat.js';
import { GSplatCompressed } from '../../scene/gsplat/gsplat-compressed.js';

/**
 * @import { GSplatData } from '../../scene/gsplat/gsplat-data.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { SplatMaterialOptions } from '../../scene/gsplat/gsplat-material.js'
 */

/**
 * The resource for the gsplat asset type.
 *
 * @category Graphics
 */
class GSplatResource {
    /**
     * @type {GraphicsDevice}
     * @ignore
     */
    device;

    /**
     * @type {GSplatData}
     * @ignore
     */
    splatData;

    /**
     * @type {GSplat | GSplatCompressed | null}
     * @ignore
     */
    splat = null;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GSplatData} splatData - The splat data.
     * @ignore
     */
    constructor(device, splatData) {
        this.device = device;
        this.splatData = splatData;
    }

    destroy() {
        this.device = null;
        this.splatData = null;
        this.splat?.destroy();
        this.splat = null;
    }

    createSplat() {
        if (!this.splat) {
            this.splat = this.splatData.isCompressed ? new GSplatCompressed(this.device, this.splatData) : new GSplat(this.device, this.splatData);
        }
        return this.splat;
    }

    /**
     * Instantiates an entity with a {@link GSplatComponent}.
     *
     * @param {SplatMaterialOptions} [options] - The options.
     * @returns {Entity} The entity with {@link GSplatComponent}.
     */
    instantiate(options = {}) {

        const splatInstance = this.createInstance(options);

        const entity = new Entity();
        const component = entity.addComponent('gsplat', {
            instance: splatInstance
        });

        // set custom aabb
        component.customAabb = splatInstance.splat.aabb.clone();

        return entity;
    }

    createInstance(options = {}) {

        // shared splat between instances
        const splat = this.createSplat();
        return new GSplatInstance(splat, options);
    }
}

export { GSplatResource };
