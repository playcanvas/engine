import { Vec2 } from '../../core/math/vec2.js';
import { Vec4 } from '../../core/math/vec4.js';

import { RenderTarget } from '../../platform/graphics/render-target.js';

import { LIGHTTYPE_OMNI, LIGHTTYPE_SPOT, SHADOW_PCF3 } from '../constants.js';
import { CookieRenderer } from '../renderer/cookie-renderer.js';
import { ShadowMap } from '../renderer/shadow-map.js';

const _tempArray = [];
const _tempArray2 = [];
const _viewport = new Vec4();
const _scissor = new Vec4();

class Slot {
    constructor(rect) {
        this.size = Math.floor(rect.w * 1024);  // size normalized to 1024 atlas
        this.used = false;
        this.lightId = -1;  // id of the light using the slot
        this.rect = rect;
    }
}

// A class handling runtime allocation of slots in a texture. It is used to allocate slots in the shadow and cookie atlas.
class LightTextureAtlas {
    constructor(device) {

        this.device = device;
        this.version = 1;   // incremented each time slot configuration changes

        this.shadowAtlasResolution = 2048;
        this.shadowAtlas = null;

        // number of additional pixels to render past the required shadow camera angle (90deg for omni, outer for spot) of the shadow camera for clustered lights.
        // This needs to be a pixel more than a shadow filter needs to access.
        this.shadowEdgePixels = 3;

        this.cookieAtlasResolution = 2048;
        this.cookieAtlas = null;
        this.cookieRenderTarget = null;

        // available slots (of type Slot)
        this.slots = [];

        // current subdivision strategy - matches format of LightingParams.atlasSplit
        this.atlasSplit = [];

        // offsets to individual faces of a cubemap inside 3x3 grid in an atlas slot
        this.cubeSlotsOffsets = [
            new Vec2(0, 0),
            new Vec2(0, 1),
            new Vec2(1, 0),
            new Vec2(1, 1),
            new Vec2(2, 0),
            new Vec2(2, 1)
        ];

        // handles gap between slots
        this.scissorVec = new Vec4();

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

            // content of atlas is lost, force re-render of static shadows
            this.version++;

            this.destroyShadowAtlas();
            this.shadowAtlas = ShadowMap.createAtlas(this.device, resolution, SHADOW_PCF3);

            // avoid it being destroyed by lights
            this.shadowAtlas.cached = true;

            // leave gap between individual tiles to avoid shadow / cookie sampling other tiles (enough for PCF5)
            // note that this only fades / removes shadows on the edges, which is still not correct - a shader clipping is needed?
            const scissorOffset = 4 / this.shadowAtlasResolution;
            this.scissorVec.set(scissorOffset, scissorOffset, -2 * scissorOffset, -2 * scissorOffset);
        }
    }

    allocateCookieAtlas(resolution) {
        if (!this.cookieAtlas || this.cookieAtlas.width !== resolution) {

            // content of atlas is lost, force re-render of static cookies
            this.version++;

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
        this._shadowAtlasTextureId = this.device.scope.resolve('shadowAtlasTexture');
        this._shadowAtlasParamsId = this.device.scope.resolve('shadowAtlasParams');
        this._shadowAtlasParams = new Float32Array(2);

        this._cookieAtlasTextureId = this.device.scope.resolve('cookieAtlasTexture');
    }

    updateUniforms() {

        // shadow atlas texture
        const isShadowFilterPcf = true;
        const rt = this.shadowAtlas.renderTargets[0];
        const isDepthShadow = (this.device.isWebGPU || this.device.webgl2) && isShadowFilterPcf;
        const shadowBuffer = isDepthShadow ? rt.depthBuffer : rt.colorBuffer;
        this._shadowAtlasTextureId.setValue(shadowBuffer);

        // shadow atlas params
        this._shadowAtlasParams[0] = this.shadowAtlasResolution;
        this._shadowAtlasParams[1] = this.shadowEdgePixels;
        this._shadowAtlasParamsId.setValue(this._shadowAtlasParams);

        // cookie atlas textures
        this._cookieAtlasTextureId.setValue(this.cookieAtlas);
    }

    subdivide(numLights, lightingParams) {

        let atlasSplit = lightingParams.atlasSplit;

        // if no user specified subdivision
        if (!atlasSplit) {

            // split to equal number of squares
            const gridSize = Math.ceil(Math.sqrt(numLights));
            atlasSplit = _tempArray2;
            atlasSplit[0] = gridSize;
            atlasSplit.length = 1;
        }

        // compare two arrays
        const arraysEqual = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

        // if the split has changed, regenerate slots
        if (!arraysEqual(atlasSplit, this.atlasSplit)) {

            this.version++;
            this.slots.length = 0;

            // store current settings
            this.atlasSplit.length = 0;
            this.atlasSplit.push(...atlasSplit);

            // generate top level split
            const splitCount = this.atlasSplit[0];
            if (splitCount > 1) {
                const invSize = 1 / splitCount;
                for (let i = 0; i < splitCount; i++) {
                    for (let j = 0; j < splitCount; j++) {
                        const rect = new Vec4(i * invSize, j * invSize, invSize, invSize);
                        const nextLevelSplit = this.atlasSplit[1 + i * splitCount + j];

                        // if need to split again
                        if (nextLevelSplit > 1) {
                            for (let x = 0; x < nextLevelSplit; x++) {
                                for (let y = 0; y < nextLevelSplit; y++) {
                                    const invSizeNext = invSize / nextLevelSplit;
                                    const rectNext = new Vec4(rect.x + x * invSizeNext, rect.y + y * invSizeNext, invSizeNext, invSizeNext);
                                    this.slots.push(new Slot(rectNext));
                                }
                            }
                        } else {
                            this.slots.push(new Slot(rect));
                        }
                    }
                }
            } else {
                // single slot
                this.slots.push(new Slot(new Vec4(0, 0, 1, 1)));
            }

            // sort slots descending
            this.slots.sort((a, b) => {
                return b.size - a.size;
            });
        }
    }

    collectLights(spotLights, omniLights, lightingParams) {

        const cookiesEnabled = lightingParams.cookiesEnabled;
        const shadowsEnabled = lightingParams.shadowsEnabled;

        // get all lights that need shadows or cookies, if those are enabled
        let needsShadowAtlas = false;
        let needsCookieAtlas = false;
        const lights = _tempArray;
        lights.length = 0;

        const processLights = (list) => {
            for (let i = 0; i < list.length; i++) {
                const light = list[i];
                if (light.visibleThisFrame) {
                    const lightShadow = shadowsEnabled && light.castShadows;
                    const lightCookie = cookiesEnabled && !!light.cookie;

                    needsShadowAtlas ||= lightShadow;
                    needsCookieAtlas ||= lightCookie;

                    if (lightShadow || lightCookie) {
                        lights.push(light);
                    }
                }
            }
        };

        if (cookiesEnabled || shadowsEnabled) {
            processLights(spotLights);
            processLights(omniLights);
        }

        // sort lights by maxScreenSize - to have them ordered by atlas slot size
        lights.sort((a, b) => {
            return b.maxScreenSize - a.maxScreenSize;
        });

        if (needsShadowAtlas) {
            this.allocateShadowAtlas(this.shadowAtlasResolution);
        }

        if (needsCookieAtlas) {
            this.allocateCookieAtlas(this.cookieAtlasResolution);
        }

        if (needsShadowAtlas || needsCookieAtlas) {
            this.subdivide(lights.length, lightingParams);
        }

        return lights;
    }

    // configure light to use assigned slot
    setupSlot(light, rect) {

        light.atlasViewport.copy(rect);

        const faceCount = light.numShadowFaces;
        for (let face = 0; face < faceCount; face++) {

            // setup slot for shadow and cookie
            if (light.castShadows || light._cookie) {

                _viewport.copy(rect);
                _scissor.copy(rect);

                // for spot lights in the atlas, make viewport slightly smaller to avoid sampling past the edges
                if (light._type === LIGHTTYPE_SPOT) {
                    _viewport.add(this.scissorVec);
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

    // assign a slot to the light
    assignSlot(light, slotIndex, slotReassigned) {

        light.atlasViewportAllocated = true;

        const slot = this.slots[slotIndex];
        slot.lightId = light.id;
        slot.used = true;

        // slot is reassigned (content needs to be updated)
        if (slotReassigned) {
            light.atlasSlotUpdated = true;
            light.atlasVersion = this.version;
            light.atlasSlotIndex = slotIndex;
        }
    }

    // update texture atlas for a list of lights
    update(spotLights, omniLights, lightingParams) {

        // update texture resolutions
        this.shadowAtlasResolution = lightingParams.shadowAtlasResolution;
        this.cookieAtlasResolution = lightingParams.cookieAtlasResolution;

        // collect lights requiring atlas
        const lights = this.collectLights(spotLights, omniLights, lightingParams);
        if (lights.length > 0) {

            // mark all slots as unused
            const slots = this.slots;
            for (let i = 0; i < slots.length; i++) {
                slots[i].used = false;
            }

            // assign slots to lights
            // The slot to light assignment logic:
            // - internally the atlas slots are sorted in the descending order (done when atlas split changes)
            // - every frame all visible lights are sorted by their screen space size (this handles all cameras where lights
            //   are visible using max value)
            // - all lights in this order get a slot size from the slot list in the same order. Care is taken to not reassign
            //   slot if the size of it is the same and only index changes - this is done using two pass assignment
            const assignCount = Math.min(lights.length, slots.length);

            // first pass - preserve allocated slots for lights requiring slot of the same size
            for (let i = 0; i < assignCount; i++) {
                const light = lights[i];

                if (light.castShadows)
                    light._shadowMap = this.shadowAtlas;

                // if currently assigned slot is the same size as what is needed, and was last used by this light, reuse it
                const previousSlot = slots[light.atlasSlotIndex];
                if (light.atlasVersion === this.version && light.id === previousSlot?.lightId) {
                    const previousSlot = slots[light.atlasSlotIndex];
                    if (previousSlot.size === slots[i].size && !previousSlot.used) {
                        this.assignSlot(light, light.atlasSlotIndex, false);
                    }
                }
            }

            // second pass - assign slots to unhandled lights
            let usedCount = 0;
            for (let i = 0; i < assignCount; i++) {

                // skip already used slots
                while (usedCount < slots.length && slots[usedCount].used)
                    usedCount++;

                const light = lights[i];
                if (!light.atlasViewportAllocated) {
                    this.assignSlot(light, usedCount, true);
                }

                // set up all slots
                const slot = slots[light.atlasSlotIndex];
                this.setupSlot(light, slot.rect);
            }
        }

        this.updateUniforms();
    }
}

export { LightTextureAtlas };
