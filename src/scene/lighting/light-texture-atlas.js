import { Vec4 } from '../../math/vec4.js';

import { SHADOW_PCF3 } from '../constants.js';
import { ShadowMap } from '../renderer/shadow-map.js';

class LightTextureAtlas {
    constructor(device) {
        this.device = device;

        // shadow map
        this.resolution = 2048; // !!!!!!!!!!!!!!!
        this.shadowMap = ShadowMap.createAtlas(device, this.resolution, SHADOW_PCF3);

        // avoid it being destroyed by lights
        this.shadowMap.cached = false;

        // available slots
        this.slots = [];
        //const slotGridSize = 4;
        const slotGridSize = 8;
//        const slotGridSize = 1;
        const invSize = 1 / slotGridSize;
        for (let i = 0; i < slotGridSize; i++) {
            for (let j = 0; j < slotGridSize; j++) {
                this.slots.push(new Vec4(i * invSize, j * invSize, invSize, invSize));
            }
        }



        this.allocateUniforms();
    }

    allocateUniforms() {
        this._shadowAtlasTextureId = this.device.scope.resolve("shadowAtlasTexture");
        this._shadowAtlasParamsId = this.device.scope.resolve("shadowAtlasParams");
    }

    updateUniforms() {

        // shadow atlas texture
        const isShadowFilterPcf = true;
        const shadowMap = this.shadowMap;
        const rt = shadowMap.renderTargets[0];
        const shadowBuffer = (this.device.webgl2 && isShadowFilterPcf) ? rt.depthBuffer : rt.colorBuffer;
        this._shadowAtlasTextureId.setValue(shadowBuffer);

        // shadow atlas params
        this._shadowAtlasParamsId.setValue(this.resolution);
    }

    // update texture atlas for a list of lights (of type ClusterLight)
    update(spotLights, omniLights) {



        const lights = spotLights.concat(omniLights);  ///!!!!!!!!!!!!!!!!!!! dont allocate new array



        let usedCount = 0;
        for (let i = 0; i < lights.length; i++) {
            const light = lights[i];
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

        this.updateUniforms();
    }
}

export { LightTextureAtlas };
