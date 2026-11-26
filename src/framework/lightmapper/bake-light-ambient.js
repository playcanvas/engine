import { Vec3 } from '../../core/math/vec3.js';
import { random } from '../../core/math/random.js';
import { Color } from '../../core/math/color.js';
import { Entity } from '../entity.js';
import { SHADOW_PCF3_32F } from '../../scene/constants.js';
import { BakeLight } from './bake-light.js';

const _tempPoint = new Vec3();

// bake light representing an ambient light (cubemap or constant)
class BakeLightAmbient extends BakeLight {
    constructor(lightmapper) {

        const scene = lightmapper.scene;
        const lightEntity = new Entity('AmbientLight');
        lightEntity.addComponent('light', {
            type: 'directional',
            affectDynamic: true,
            affectLightmapped: false,
            bake: true,
            bakeNumSamples: scene.ambientBakeNumSamples,
            castShadows: true,
            normalOffsetBias: 0.05,
            shadowBias: 0.2,
            shadowDistance: 1,  // this is updated during shadow map rendering
            shadowResolution: 2048,
            shadowType: SHADOW_PCF3_32F,
            color: Color.WHITE,
            intensity: 1,
            bakeDir: false
        });

        // the light accumulates ambient occlusion, which the bake shader then multiplies by the ambient
        // light (and its luminance), so it uses its intensity even with physical units
        super(scene, lightEntity.light.light, lightmapper.lightingParams, false);
    }

    get numVirtualLights() {
        return this.light.bakeNumSamples;
    }

    prepareVirtualLight(index, numVirtualLights) {

        // directional points down the negative Y-axis
        random.spherePointDeterministic(_tempPoint, index, numVirtualLights, 0, this.scene.ambientBakeSpherePart);
        this.light._node.lookAt(_tempPoint.mulScalar(-1));
        this.light._node.rotateLocal(90, 0, 0);

        // intensity of the virtual light depends on the sphere part used, and also needs to take into account
        // the fact N dot L used to bake it lowers total intensity
        const fullIntensity = 2 * Math.PI * this.scene.ambientBakeSpherePart;
        this.light.intensity = fullIntensity / numVirtualLights;
    }
}

export { BakeLightAmbient };
