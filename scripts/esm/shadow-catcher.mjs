import {
    Script,
    Entity,
    StandardMaterial,
    BLEND_NORMAL,
    SHADOW_VSM16,
    SHADOWUPDATE_REALTIME,
    CHUNKAPI_1_70,
    Vec2
} from 'playcanvas';

/** @import { AppBase, Entity, Light } from 'playcanvas' */

const endPS = `
    litArgs_opacity = mix(light0_shadowIntensity, 0.0, shadow0);
    gl_FragColor.rgb = vec3(0.0);
  `;

export class ShadowCatcherScript extends Script {
    /**
     * The shadow distance of the shadow catcher light.
     * @type {number}
     * @attribute
     */
    shadowDistance = 16;

    /**
     * The VSM blur size of the shadow catcher light.
     * @type {number}
     * @attribute
     */
    blurSize = 32;

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
            normalOffsetBias: 0,
            shadowBias: 0,
            shadowDistance: this.shadowDistance,
            shadowResolution: 1024,
            shadowType: SHADOW_VSM16,
            shadowUpdateMode: SHADOWUPDATE_REALTIME,
            vsmBlurSize: this.blurSize,
            shadowIntensity: 1,
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
        this._light.light.vsmBlurSize = this.blurSize;
    }
}
