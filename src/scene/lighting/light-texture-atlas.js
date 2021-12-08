import { Vec2 } from '../../math/vec2.js';
import { Vec4 } from '../../math/vec4.js';

import { RenderTarget } from '../../graphics/render-target.js';

import { LIGHTTYPE_OMNI, LIGHTTYPE_SPOT, SHADOW_PCF3 } from '../constants.js';
import { CookieRenderer } from '../renderer/cookie-renderer.js';
import { ShadowMap } from '../renderer/shadow-map.js';

const _tempArray = [];
const _viewport = new Vec4();
const _scissor = new Vec4();

// A class handling runtime allocation of slots in a texture. Used to allocate slots in the shadow map,
// and will be used to allocate slots in the cookie texture atlas as well.
// Note: this will be improved in the future to allocate different size for lights of different priority and screen size,
// and also handle persistent slots for shadows that do not need to render each frame. Also some properties will be
// exposed in some form to the user.
class LightTextureAtlas {
    constructor(device) {

        this.device = device;
        this.subdivision = 0;

        this.shadowAtlasResolution = 2048;
        this.shadowAtlas = null;

        // number of additional pixels to render past the required shadow camera angle (90deg for omni, outer for spot) of the shadow camera for clustered lights.
        // This needs to be a pixel more than a shadow filter needs to access.
        this.shadowEdgePixels = 3;

        this.cookieAtlasResolution = 2048;
        this.cookieAtlas = null;
        this.cookieRenderTarget = null;

        // available slots
        this.slots = [];

        // offsets to individual faces of a cubemap inside 3x3 grid in an atlas slot
        this.cubeSlotsOffsets = [
            new Vec2(0, 0),
            new Vec2(0, 1),
            new Vec2(1, 0),
            new Vec2(1, 1),
            new Vec2(2, 0),
            new Vec2(2, 1)
        ];

        this.allocateShadowAtlas(1);  // placeholder as shader requires it
        this.allocateCookieAtlas(1);  // placeholder as shader requires it
        this.allocateUniforms();
    }

    destroy() {
        this.destroyShadowAtlas();
        this.destroyCookieAtlas();
    }

    destroyShadowAtlas() {
        if (this.shadowAtlas) {
            this.shadowAtlas.destroy();
            this.shadowAtlas = null;
        }
    }

    destroyCookieAtlas() {
        if (this.cookieAtlas) {
            this.cookieAtlas.destroy();
            this.cookieAtlas = null;
        }
        if (this.cookieRenderTarget) {
            this.cookieRenderTarget.destroy();
            this.cookieRenderTarget = null;
        }
    }

    allocateShadowAtlas(resolution) {
        if (!this.shadowAtlas || this.shadowAtlas.texture.width !== resolution) {
            this.destroyShadowAtlas();
            this.shadowAtlas = ShadowMap.createAtlas(this.device, resolution, SHADOW_PCF3);

            // avoid it being destroyed by lights
            this.shadowAtlas.cached = true;
        }
    }

    allocateCookieAtlas(resolution) {
        if (!this.cookieAtlas || this.cookieAtlas.width !== resolution) {
            this.destroyCookieAtlas();
            this.cookieAtlas = CookieRenderer.createTexture(this.device, resolution);

            this.cookieRenderTarget = new RenderTarget({
                colorBuffer: this.cookieAtlas,
                depth: false,
                flipY: true
            });
        }
    }

    allocateUniforms() {
        this._shadowAtlasTextureId = this.device.scope.resolve("shadowAtlasTexture");
        this._shadowAtlasParamsId = this.device.scope.resolve("shadowAtlasParams");
        this._shadowAtlasParams = new Float32Array(2);

        this._cookieAtlasTextureId = this.device.scope.resolve("cookieAtlasTexture");
    }

    updateUniforms() {

        // shadow atlas texture
        const isShadowFilterPcf = true;
        const rt = this.shadowAtlas.renderTargets[0];
        const shadowBuffer = (this.device.webgl2 && isShadowFilterPcf) ? rt.depthBuffer : rt.colorBuffer;
        this._shadowAtlasTextureId.setValue(shadowBuffer);

        // shadow atlas params
        this._shadowAtlasParams[0] = this.shadowAtlasResolution;
        this._shadowAtlasParams[1] = this.shadowEdgePixels;
        this._shadowAtlasParamsId.setValue(this._shadowAtlasParams);

        // cookie atlas textures
        this._cookieAtlasTextureId.setValue(this.cookieAtlas);
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

    collectLights(spotLights, omniLights, lightingParams) {

        const cookiesEnabled = lightingParams.cookiesEnabled;
        const shadowsEnabled = lightingParams.shadowsEnabled;

        // get all lights that need shadows or cookies, if those are enabled
        let needsShadow = false;
        let needsCookie = false;
        const lights = _tempArray;
        lights.length = 0;

        const processLights = (list) => {
            for (let i = 0; i < list.length; i++) {
                const light = list[i];
                if (light.visibleThisFrame) {
                    needsShadow ||= shadowsEnabled && light.castShadows;
                    needsCookie ||= cookiesEnabled && !!light.cookie;

                    if (needsShadow || needsCookie) {
                        lights.push(light);
                    }
                }
            }
        };

        if (cookiesEnabled || shadowsEnabled) {
            processLights(spotLights);
            processLights(omniLights);
        }

        if (needsShadow) {
            this.allocateShadowAtlas(this.shadowAtlasResolution);
        }

        if (needsCookie) {
            this.allocateCookieAtlas(this.cookieAtlasResolution);
        }

        if (needsShadow || needsCookie) {
            this.subdivide(lights.length);
        }

        return lights;
    }

    // update texture atlas for a list of lights
    update(spotLights, omniLights, lightingParams) {

        // update texture resolutions
        this.shadowAtlasResolution = lightingParams.shadowAtlasResolution;
        this.cookieAtlasResolution = lightingParams.cookieAtlasResolution;

        // process lights
        const lights = this.collectLights(spotLights, omniLights, lightingParams);
        if (lights.length > 0) {

            // leave gap between individual tiles to avoid shadow / cookie sampling other tiles (5 pixels is enough for PCF5)
            // note that this only fades / removes shadows on the edges, which is still not correct - a shader clipping is needed?
            const scissorOffset = 4 / this.shadowAtlasResolution;
            const scissorVec = new Vec4(scissorOffset, scissorOffset, -2 * scissorOffset, -2 * scissorOffset);

            // assign atlas slots to lights
            let usedCount = 0;
            for (let i = 0; i < lights.length; i++) {

                const light = lights[i];

                if (light.castShadows)
                    light._shadowMap = this.shadowAtlas;

                // use a single slot for spot, and single slot for all 6 faces of cubemap as well
                const slot = this.slots[usedCount];
                usedCount++;

                light.atlasViewport.copy(slot);

                const faceCount = light.numShadowFaces;
                for (let face = 0; face < faceCount; face++) {

                    // setup slot for shadow and cookie
                    if (light.castShadows || light._cookie) {

                        _viewport.copy(slot);
                        _scissor.copy(slot);

                        // for spot lights in the atlas, make viewport slightly smaller to avoid sampling past the edges
                        if (light._type === LIGHTTYPE_SPOT) {
                            _viewport.add(scissorVec);
                        }

                        // for cube map, allocate part of the slot
                        if (light._type === LIGHTTYPE_OMNI) {

                            const smallSize = _viewport.z / 3;
                            const offset = this.cubeSlotsOffsets[face];
                            _viewport.x += smallSize * offset.x;
                            _viewport.y += smallSize * offset.y;
                            _viewport.z = smallSize;
                            _viewport.w = smallSize;

                            _scissor.copy(_viewport);
                        }

                        if (light.castShadows) {
                            const lightRenderData = light.getRenderData(null, face);
                            lightRenderData.shadowViewport.copy(_viewport);
                            lightRenderData.shadowScissor.copy(_scissor);
                        }
                    }
                }
            }
        }

        this.updateUniforms();
    }
}

export { LightTextureAtlas };
