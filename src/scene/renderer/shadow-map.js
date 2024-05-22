import {
    ADDRESS_CLAMP_TO_EDGE,
    FILTER_LINEAR, FILTER_NEAREST,
    FUNC_LESS,
    PIXELFORMAT_DEPTH, PIXELFORMAT_RGBA8, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F,
    TEXHINT_SHADOWMAP,
    PIXELFORMAT_R32F
} from '../../platform/graphics/constants.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';

import {
    LIGHTTYPE_OMNI,
    SHADOW_PCF1, SHADOW_PCF3, SHADOW_PCF5, SHADOW_VSM16, SHADOW_VSM32, SHADOW_PCSS
} from '../constants.js';


class ShadowMap {
    constructor(texture, targets) {

        // the actual texture buffer that is shared by shadow map render targets
        this.texture = texture;

        // set to true if the shadow map is owned by the shadow map cache
        this.cached = false;

        // an array of render targets:
        // 1 for directional and spot light
        // 6 for omni light
        this.renderTargets = targets;
    }

    destroy() {

        // single texture is shared by all render targets, destroy it once
        if (this.texture) {
            this.texture.destroy();
            this.texture = null;
        }

        const targets = this.renderTargets;
        for (let i = 0; i < targets.length; i++) {
            targets[i].destroy();
        }
        this.renderTargets.length = 0;
    }

    static getShadowFormat(device, shadowType) {
        if (shadowType === SHADOW_VSM32) {
            return PIXELFORMAT_RGBA32F;
        } else if (shadowType === SHADOW_VSM16) {
            return PIXELFORMAT_RGBA16F;
        } else if (shadowType === SHADOW_PCF5) {
            return PIXELFORMAT_DEPTH;
        } else if (shadowType === SHADOW_PCF1 || shadowType === SHADOW_PCF3) {
            return PIXELFORMAT_DEPTH;
        } else if (shadowType === SHADOW_PCSS) {
            return PIXELFORMAT_R32F;
        }

        return PIXELFORMAT_RGBA8;
    }

    static getShadowFiltering(device, shadowType) {
        if (shadowType === SHADOW_VSM32) {
            return device.extTextureFloatLinear ? FILTER_LINEAR : FILTER_NEAREST;
        }
        return FILTER_LINEAR;
    }

    static create(device, light) {

        let shadowMap = null;
        if (light._type === LIGHTTYPE_OMNI) {
            shadowMap = this.createCubemap(device, light._shadowResolution, light._shadowType);
        } else {
            shadowMap = this.create2dMap(device, light._shadowResolution, light._shadowType);
        }

        return shadowMap;
    }

    // creates a shadow map which is used by the light texture atlas for clustered lighting
    static createAtlas(device, resolution, shadowType) {
        const shadowMap = this.create2dMap(device, resolution, shadowType);

        // copy the target 5 more times to allow unified access for point light faces
        const targets = shadowMap.renderTargets;
        const rt = targets[0];
        for (let i = 0; i < 5; i++) {
            targets.push(rt);
        }

        return shadowMap;
    }

    static create2dMap(device, size, shadowType) {

        const format = this.getShadowFormat(device, shadowType);
        const filter = this.getShadowFiltering(device, shadowType);

        const texture = new Texture(device, {
            // #if _PROFILER
            profilerHint: TEXHINT_SHADOWMAP,
            // #endif
            format: format,
            width: size,
            height: size,
            mipmaps: false,
            minFilter: filter,
            magFilter: filter,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            name: 'ShadowMap2D'
        });

        let target = null;
        if (shadowType === SHADOW_PCF5 || shadowType === SHADOW_PCF1 || shadowType === SHADOW_PCF3) {

            // enable hardware PCF when sampling the depth texture
            texture.compareOnRead = true;
            texture.compareFunc = FUNC_LESS;

            // depthbuffer only
            target = new RenderTarget({
                depthBuffer: texture
            });
        } else {
            // encoded rgba depth
            target = new RenderTarget({
                colorBuffer: texture,
                depth: true
            });
        }

        // TODO: this is temporary, and will be handle on generic level for all render targets for WebGPU
        if (device.isWebGPU) {
            target.flipY = true;
        }

        return new ShadowMap(texture, [target]);
    }

    static createCubemap(device, size, shadowType) {

        const format = shadowType === SHADOW_PCSS ? PIXELFORMAT_R32F : PIXELFORMAT_RGBA8;
        const cubemap = new Texture(device, {
            // #if _PROFILER
            profilerHint: TEXHINT_SHADOWMAP,
            // #endif
            format: format,
            width: size,
            height: size,
            cubemap: true,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            name: 'ShadowMapCube'
        });

        const targets = [];
        for (let i = 0; i < 6; i++) {
            const target = new RenderTarget({
                colorBuffer: cubemap,
                face: i,
                depth: true
            });
            targets.push(target);
        }
        return new ShadowMap(cubemap, targets);
    }
}

export { ShadowMap };
