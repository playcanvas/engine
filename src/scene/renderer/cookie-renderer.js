import { Debug } from '../../core/debug.js';

import { ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_RGBA8 } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';

import { LIGHTTYPE_DIRECTIONAL } from '../constants.js';
import { RenderPassCookieRenderer } from './render-pass-cookie-renderer.js';

/**
 * Helper class used by clustered lighting system to render cookies into the texture atlas,
 * similarly to shadow renderer.
 *
 * @ignore
 */
class CookieRenderer {
    constructor(device, lightTextureAtlas) {
        this.device = device;
        this.lightTextureAtlas = lightTextureAtlas;

        this.renderPass = this.createRenderPass(lightTextureAtlas.cookieRenderTarget);
    }

    destroy() {
        this.renderPass.destroy();
    }

    static createTexture(device, resolution) {

        const texture = new Texture(device, {
            name: 'CookieAtlas',
            width: resolution,
            height: resolution,
            format: PIXELFORMAT_RGBA8,
            cubemap: false,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });

        return texture;
    }

    filter(lights, filteredLights) {

        for (let i = 0; i < lights.length; i++) {
            const light = lights[i];

            // skip directional lights
            if (light._type === LIGHTTYPE_DIRECTIONAL)
                continue;

            // skip clustered cookies with no assigned atlas slot
            if (!light.atlasViewportAllocated)
                continue;

            // only render cookie when the slot is reassigned (assuming the cookie texture is static)
            if (!light.atlasSlotUpdated)
                continue;

            if (light.enabled && light.cookie && light.visibleThisFrame) {
                filteredLights.push(light);
            }
        }
    }

    createRenderPass(renderTarget) {

        Debug.assert(renderTarget);

        // prepare a single render pass to render all quads to the render target
        const renderPass = new RenderPassCookieRenderer(this.device, this.lightTextureAtlas.cubeSlotsOffsets);
        renderPass.init(renderTarget);
        renderPass.colorOps.clear = false;
        renderPass.depthStencilOps.clearDepth = false;

        return renderPass;
    }

    render(lights) {

        // pick lights we need to update the cookies for
        const filteredLights = this.renderPass._filteredLights;
        this.filter(lights, filteredLights);
        if (filteredLights.length > 0) {

            // render the pass
            this.renderPass.render();

            filteredLights.length = 0;
        }
    }
}

export { CookieRenderer };
