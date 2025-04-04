import { Entity } from '../entity.js';
import { GSplatInstance } from '../../scene/gsplat/gsplat-instance.js';
import { GSplat } from '../../scene/gsplat/gsplat.js';
import { GSplatCompressed } from '../../scene/gsplat/gsplat-compressed.js';
import { GSplatSogs } from '../../scene/gsplat/gsplat-sogs.js';

/**
 * @import { AppBase } from '../app-base.js'
 * @import { GSplatData } from '../../scene/gsplat/gsplat-data.js'
 * @import { GSplatCompressedData } from '../../scene/gsplat/gsplat-compressed-data.js'
 * @import { GSplatSogsData } from '../../scene/gsplat/gsplat-sogs-data.js'
 * @import { SplatMaterialOptions } from '../../scene/gsplat/gsplat-material.js'
 */

/**
 * The resource for the gsplat asset type.
 *
 * @category Graphics
 */
class GSplatResource {
    /**
     * @type {AppBase | null}
     * @ignore
     */
    app;

    /**
     * @type {GSplatData | GSplatCompressedData | GSplatSogsData }
     * @ignore
     */
    splatData;

    /**
     * @type {GSplat | GSplatCompressed | GSplatSogs | null}
     * @ignore
     */
    splat = null;

    /**
     * @type {string[] | null}
     * @ignore
     */
    comments = null;

    /**
     * @param {AppBase} app - The app.
     * @param {GSplatData | GSplatCompressedData | GSplatSogsData} splatData - The splat data.
     * @param {string[]} comments - The PLY file header comments
     * @ignore
     */
    constructor(app, splatData, comments) {
        this.app = app;
        this.splatData = splatData;
        this.comments = comments;
    }

    destroy() {
        this.app = null;
        this.splatData = null;
        this.splat?.destroy();
        this.splat = null;
    }

    createSplat() {
        if (!this.splat) {
            const { app, splatData } = this;
            const gsplatClass = splatData.isCompressed ? GSplatCompressed :
                splatData.isSogs ? GSplatSogs : GSplat;
            this.splat = new gsplatClass(app.graphicsDevice, splatData);
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

        const entity = new Entity(undefined, this.app);
        const component = entity.addComponent('gsplat', {
            instance: splatInstance
        });

        // the ply scene data no longer gets automatically rotated on load, so do
        // it here instead.
        entity.setLocalEulerAngles(0, 0, 180);

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
