import { Vec4 } from '../../math/vec4.js';

import {
//    LIGHTTYPE_OMNI,
    SHADOW_PCF3// , SHADOW_PCF5, SHADOW_VSM16, SHADOW_VSM32
} from '../constants.js';
import { ShadowMap } from '../renderer/shadow-map.js';

class LightTextureAtlas {
    constructor(device) {

        // shadow map
        this.shadowMap = ShadowMap.createAtlas(device, 1024, SHADOW_PCF3);

        // avoid it being destroyed by lights
        this.shadowMap.cached = false;

        // available slots
        this.slots = [];
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                this.slots.push(new Vec4(i * 0.25, j * 0.25, 0.25, 0.25));
            }
        }
    }

    // update texture atlas for a list of lights (of type ClusterLight)
    update(clusterLights) {
        let usedCount = 0;
        for (let i = 0; i < clusterLights.length; i++) {
            const light = clusterLights[i].light;
            if (light && light.castShadows) {

                const faceCount = light.numShadowFaces;
                for (let face = 0; face < faceCount; face++) {

                    const slot = this.slots[usedCount];
                    usedCount++;

                    const lightRenderData = light.getRenderData(null, face);
                    lightRenderData.shadowViewport.copy(slot);
                }

                light._shadowMap = this.shadowMap;

            }
        }
    }
}

export { LightTextureAtlas };
