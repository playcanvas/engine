import {
    Script,
    Entity,
    StandardMaterial,
    BLEND_MULTIPLICATIVE,
    Vec3
} from 'playcanvas';

/**
 * Implementations of shadow catcher functionality, which allows a shadow from directional lights to
 * be rendered using a transparent material. This is a common way to add a shadow to the scene where
 * the background is just a skydome.
 *
 * This implementation uses all directional lights in the scene to cast shadows onto the shadow.
 * Other light types are not supported.
 * If you want the light to not affect your scene, you can set the intensity of the light to 0 - this
 * way it will be only used to cast shadows.
 *
 * Additionally, at creation time, you can provide a geometry entity that will be used as the shadow
 * catcher. If you don't provide one, the script will create a plane geometry.
 *
 * @example
 * const shadowCatcher = new pc.Entity('ShadowCatcher');
 * shadowCatcher.addComponent('script').create(ShadowCatcher, {
 *     properties: {
 *         scale: new pc.Vec3(50, 50, 50)
 *         // geometry: geometryEntity // optionally provide a geometry entity
 *     }
 * });
 * app.root.addChild(shadowCatcher);
 */
class ShadowCatcher extends Script {
    static scriptName = 'shadowCatcher';

    /**
     * The scale of the shadow catcher.
     * @type {Vec3}
     * @attribute
     */
    scale = new Vec3(1, 1, 1);

    /**
     * The geometry the shadow catcher uses. Can only be provided when the script is created. If not
     * provided, the script will create a plane geometry.
     *
     * @type {Entity|undefined}
     */
    geometry;

    /**
     * Draw bucket applied to the shadow catcher's mesh instances. Used to
     * coarsely control where the catcher sits in the transparent render order
     * relative to other transparent objects (in `SORTMODE_BACK2FRONT` mode,
     * higher buckets render first). The default `250` puts the catcher very
     * early in the transparent pass so its shadow can darken the skybox /
     * background. Lower it (e.g. to `0`) when the catcher needs to render
     * AFTER a transparent object that would otherwise overwrite it - for
     * example a Gaussian Splat ground.
     *
     * @attribute
     * @title Draw Bucket
     * @type {number}
     */
    drawBucket = 250;

    /**
     * @type {boolean}
     * @private
     */
    _geometryCreated = false;

    initialize() {

        // create shadow catcher material
        const shadowCatcherMaterial = new StandardMaterial();

        // set up shadow catcher material to multiply the color with the shadow color
        shadowCatcherMaterial.blendType = BLEND_MULTIPLICATIVE;
        shadowCatcherMaterial.shadowCatcher = true;

        // make the shader as cheap as possible
        shadowCatcherMaterial.useSkybox = false;
        shadowCatcherMaterial.depthWrite = false;
        shadowCatcherMaterial.diffuse.set(0, 0, 0);
        shadowCatcherMaterial.specular.set(0, 0, 0);

        shadowCatcherMaterial.update();

        // if the entity already has render, use it directly
        if (!this.geometry && this.entity.render) {
            this.geometry = this.entity;
        }

        // create shadow catcher geometry if none was provided
        if (!this.geometry) {
            this._geometryCreated = true;
            this.geometry = new Entity('ShadowCatcherGeometry');
            this.geometry.addComponent('render', {
                type: 'plane',
                castShadows: false,
                material: shadowCatcherMaterial
            });
        }

        if (this.geometry !== this.entity) {
            this.entity.addChild(this.geometry);
        }

        this.geometry?.render?.meshInstances.forEach((mi) => {

            // if geometry was provided, set the material
            if (!this._geometryCreated) {
                mi.material = shadowCatcherMaterial;
            }
        });

        this.on('destroy', () => {
            if (this._geometryCreated) {
                this.geometry?.destroy();
            }
            shadowCatcherMaterial.destroy();
        });
    }

    update() {
        this.geometry?.setLocalScale(this.scale);

        // apply drawBucket every frame so runtime changes take effect
        this.geometry?.render?.meshInstances.forEach((mi) => {
            mi.drawBucket = this.drawBucket;
        });
    }
}

export { ShadowCatcher };
