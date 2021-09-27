import { Vec4 } from '../../math/vec4.js';

import { RenderTarget } from '../../graphics/render-target.js';

import { LIGHTTYPE_SPOT, SHADOW_PCF3 } from '../constants.js';
import { CookieRenderer } from '../renderer/cookie-renderer.js';
import { ShadowMap } from '../renderer/shadow-map.js';

const _tempArray = [];
const _viewport = new Vec4();

// A class handling runtime allocation of slots in a texture. Used to allocate slots in the shadow map,
// and will be used to allocate slots in the cookie texture atlas as well.
// Note: this will be improved in the future to allocate different size for lights of different priority and screen size,
// and also handle persistent slots for shadows that do not need to render each frame. Also some properties will be
// exposed in some form to the user.
class LightTextureAtlas {
    constructor(device) {

        this.device = device;
        this.subdivision = 0;

        this.shadowMapResolution = 2048;
        this.shadowMap = null;

        this.cookieMapResolution = 2048;
        this.cookieMap = null;
        this.cookieRenderTarget = null;

        // available slots
        this.slots = [];

        this.allocateShadowMap(1);  // placeholder as shader requires it
        this.allocateCookieMap(1);  // placeholder as shader requires it
        this.allocateUniforms();
    }

    destroy() {
        this.destroyShadowMap();
        this.destroyCookieMap();
    }

    destroyShadowMap() {
        if (this.shadowMap) {
            this.shadowMap.destroy();
            this.shadowMap = null;
        }
    }

    destroyCookieMap() {
        if (this.cookieMap) {
            this.cookieMap.destroy();
            this.cookieMap = null;
        }
        if (this.cookieRenderTarget) {
            this.cookieRenderTarget.destroy();
            this.cookieRenderTarget = null;
        }
    }

    allocateShadowMap(resolution) {
        if (!this.shadowMap || this.shadowMap.texture.width !== resolution) {
            this.destroyShadowMap();
            this.shadowMap = ShadowMap.createAtlas(this.device, resolution, SHADOW_PCF3);

            // avoid it being destroyed by lights
            this.shadowMap.cached = false;
        }
    }

    allocateCookieMap(resolution) {
        if (!this.cookieMap || this.cookieMap.width !== resolution) {
            this.destroyCookieMap();
            this.cookieMap = CookieRenderer.createTexture(this.device, resolution);

            this.cookieRenderTarget = new RenderTarget({
                colorBuffer: this.cookieMap,
                depth: false,
                flipY: true // ///// ????
            });
        }
    }

    allocateUniforms() {
        this._shadowAtlasTextureId = this.device.scope.resolve("shadowAtlasTexture");
        this._shadowAtlasParamsId = this.device.scope.resolve("shadowAtlasParams");

        this._cookieAtlasTextureId = this.device.scope.resolve("cookieAtlasTexture");
    }

    updateUniforms() {

        // shadow atlas texture
        const isShadowFilterPcf = true;
        const shadowMap = this.shadowMap;
        const rt = shadowMap.renderTargets[0];
        const shadowBuffer = (this.device.webgl2 && isShadowFilterPcf) ? rt.depthBuffer : rt.colorBuffer;
        this._shadowAtlasTextureId.setValue(shadowBuffer);

        // shadow atlas params
        this._shadowAtlasParamsId.setValue(this.shadowMapResolution);

        // cookie atlas textures
        this._cookieAtlasTextureId.setValue(this.cookieMap);
    }

    subdivide(numLights) {

        // required grid size
        const gridSize = Math.ceil(Math.sqrt(numLights));

        // subdivide the texture to required grid size
        if (this.subdivision !== gridSize) {
            this.subdivision = gridSize;

            this.slots.length = 0;
            const invSize = 1 / gridSize;
            for (let i = 0; i < gridSize; i++) {
                for (let j = 0; j < gridSize; j++) {
                    this.slots.push(new Vec4(i * invSize, j * invSize, invSize, invSize));
                }
            }
        }
    }

    collectLights(spotLights, omniLights) {

        // get all lights that need shadows or cookies
        let needsShadow = false;
        let needsCookie = false;
        const lights = _tempArray;
        lights.length = 0;
        for (let i = 0; i < spotLights.length; i++) {
            const light = spotLights[i];
            if (light.visibleThisFrame) {
                needsShadow ||= light.castShadows;
                needsCookie ||= light.cookie;

                if (needsShadow || needsCookie) {
                    lights.push(light);
                }
            }
        }

        if (needsShadow) {
            this.allocateShadowMap(this.shadowMapResolution);
        }

        if (needsCookie) {
            this.allocateCookieMap(this.cookieMapResolution);
        }

        if (needsShadow || needsCookie) {
            this.subdivide(lights.length);
        }

        return lights;
    }

    // update texture atlas for a list of lights
    update(spotLights, omniLights) {

        const lights = this.collectLights(spotLights, omniLights);
        if (lights.length > 0) {

            // leave gap between individual tiles to avoid shadow / cookie sampling other tiles (4 pixels - should be enough for PCF5)
            // note that this only fades / removes shadows on the edges, which is still not correct - a shader clipping is needed?
            const scissorOffset = 4 / this.shadowMapResolution;
            const scissorVec = new Vec4(scissorOffset, scissorOffset, -2 * scissorOffset, -2 * scissorOffset);

            // assign atlas slots to lights
            let usedCount = 0;
            for (let i = 0; i < lights.length; i++) {

                const light = lights[i];

                if (light.castShadows)
                    light._shadowMap = this.shadowMap;

                const faceCount = light.numShadowFaces;
                for (let face = 0; face < faceCount; face++) {

                    const slot = this.slots[usedCount];
                    usedCount++;

                    // setup slot for shadow and cookie
                    if (light.castShadows || light._cookie) {

                        // for spot lights in the atlas, make viewport slightly smaller to avoid sampling past the edges
                        _viewport.copy(slot);
                        if (light._type === LIGHTTYPE_SPOT) {
                            _viewport.add(scissorVec);
                        }

                        if (light.castShadows) {
                            const lightRenderData = light.getRenderData(null, face);
                            lightRenderData.shadowViewport.copy(_viewport);
                            lightRenderData.shadowScissor.copy(slot);
                        }

                        if (light._cookie) {
                            light.cookieViewport.copy(_viewport);
                        }
                    }
                }
            }
        }

        this.updateUniforms();
    }
}

export { LightTextureAtlas };
