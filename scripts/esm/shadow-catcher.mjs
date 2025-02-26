import {
    Script,
    Entity,
    StandardMaterial,
    BLEND_NORMAL,
    SHADOW_VSM_16F,
    SHADOWUPDATE_REALTIME,
    CHUNKAPI_1_70,
    Vec2
} from 'playcanvas';

/** @import { AppBase, Entity, Light } from 'playcanvas' */

const endPS = `
    litArgs_opacity = mix(light0_shadowIntensity, 0.0, shadow0);
    gl_FragColor.rgb = vec3(0.0);
  `;

/**
 * This script generates a simple shadow plane for any render-able objects within
 * it's hierarchy. This means you can attach it to a parent entity and quickly get
 * visible ground plane, which helps to stage models.
 */
class ShadowCatcherScript extends Script {
    /**
     * @see {pc.Light#shadowDistance}
     * @type {number}
     * @attribute
     */
    shadowDistance = 16;

    /**
     * @see {pc.Light#vsmBlurSize}
     * @type {number}
     * @attribute
     */
    vsmBlurSize = 32;

    /**
     * @see {pc.Light#normalOffsetBias}
     * @type {number}
     * @attribute
     */
    normalOffsetBias = 0;

    /**
     * @see {pc.Light#shadowBias}
     * @type {number}
     * @attribute
     */
    shadowBias = -0.0005;

    /**
     * @see {pc.Light#shadowResolution}
     * @type {number}
     * @attribute
     */
    shadowResolution = 1024;

    /**
     * @see {pc.Light#shadowType}
     * @type {number}
     * @attribute
     */
    shadowType = SHADOW_VSM_16F;

    /**
     * @see {pc.Light#shadowUpdateMode}
     * @type {number}
     * @attribute
     */
    shadowUpdateMode = SHADOWUPDATE_REALTIME;

    /**
     * @see {pc.Light#shadowIntensity}
     * @type {number}
     * @attribute
     */
    shadowIntensity = 0.98;

    /**
     * The size of the shadow catcher.
     * @type {Vec2}
     * @attribute
     */
    size = new Vec2(1, 1);

    /**
     * @type {pc.Entity}
     */
    _plane;

    /**
     * @type {pc.Entity}
     */
    _light;

    initialize() {
        // create shadow catcher material
        const material = new StandardMaterial();
        material.useSkybox = false;
        material.blendType = BLEND_NORMAL;
        material.chunks = {
            APIVersion: CHUNKAPI_1_70,
            endPS: endPS
        };
        material.update();

        // create shadow catcher geometry
        this._plane = new Entity('ShadowPlane');
        this._plane.addComponent('render', {
            type: 'plane',
            castShadows: false,
            material
        });
        this._plane.setLocalScale(this.size.x, 1, this.size.y);

        // create shadow catcher light
        this._light = new Entity('ShadowLight');
        this._light.addComponent('light', {
            type: 'directional',
            castShadows: true,
            normalOffsetBias: this.normalOffsetBias,
            shadowBias: this.shadowBias,
            shadowDistance: this.shadowDistance,
            shadowResolution: this.shadowResolution,
            shadowType: this.shadowType,
            shadowUpdateMode: this.shadowUpdateMode,
            vsmBlurSize: this.vsmBlurSize,
            shadowIntensity: this.shadowIntensity,
            intensity: 0
        });

        this.app.root.addChild(this._plane);
        this.app.root.addChild(this._light);

        this.on('destroy', () => {
            this._plane.destroy();
            this._light.destroy();
            material.destroy();
        });
    }

    update() {
        this._plane.setLocalScale(this.size.x, 1, this.size.y ?? this.size.x);

        const light = this._light.light;
        light.vsmBlurSize = this.vsmBlurSize;
        light.normalOffsetBias = this.normalOffsetBias;
        light.shadowBias = this.shadowBias;
        light.shadowDistance = this.shadowDistance;
        light.shadowResolution = this.shadowResolution;
        light.shadowType = this.shadowType;
        light.shadowUpdateMode = this.shadowUpdateMode;
        light.vsmBlurSize = this.vsmBlurSize;
        light.shadowIntensity = this.shadowIntensity;
    }
}

export { ShadowCatcherScript };
