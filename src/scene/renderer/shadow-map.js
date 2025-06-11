import { Debug } from '../../core/debug.js';
import {
    ADDRESS_CLAMP_TO_EDGE,
    FILTER_LINEAR, FILTER_NEAREST,
    FUNC_LESS,
    PIXELFORMAT_R32F, PIXELFORMAT_R16F,
    pixelFormatInfo,
    TEXHINT_SHADOWMAP
} from '../../platform/graphics/constants.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';

import {
    LIGHTTYPE_OMNI,
    SHADOW_VSM_32F, SHADOW_PCSS_32F,
    shadowTypeInfo
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

        const shadowInfo = shadowTypeInfo.get(shadowType);
        Debug.assert(shadowInfo);
        let format = shadowInfo.format;

        // when F32 is needed but not supported, fallback to F16 (PCSS)
        if (format === PIXELFORMAT_R32F && !device.textureFloatRenderable && device.textureHalfFloatRenderable) {
            format = PIXELFORMAT_R16F;
        }
        const formatName = pixelFormatInfo.get(format)?.name;

        let filter = FILTER_LINEAR;
        if (shadowType === SHADOW_VSM_32F) {
            filter = device.extTextureFloatLinear ? FILTER_LINEAR : FILTER_NEAREST;
        }
        if (shadowType === SHADOW_PCSS_32F) {
            // we're sampling and comparing depth, so need nearest filtering
            // also note that linear is failing on iOS devices
            filter = FILTER_NEAREST;
        }

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
            name: `ShadowMap2D_${formatName}`
        });

        let target = null;
        if (shadowInfo?.pcf) {

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

        // TODO: this is temporary, and will be handled on generic level for all render targets for WebGPU
        if (device.isWebGPU) {
            target.flipY = true;
        }

        return new ShadowMap(texture, [target]);
    }

    static createCubemap(device, size, shadowType) {

        const shadowInfo = shadowTypeInfo.get(shadowType);
        Debug.assert(shadowInfo);
        const formatName = pixelFormatInfo.get(shadowInfo.format)?.name;
        const isPcss = shadowType === SHADOW_PCSS_32F;
        const filter = isPcss ? FILTER_NEAREST : FILTER_LINEAR;

        const cubemap = new Texture(device, {
            // #if _PROFILER
            profilerHint: TEXHINT_SHADOWMAP,
            // #endif
            format: shadowInfo?.format,
            width: size,
            height: size,
            cubemap: true,
            mipmaps: false,
            minFilter: filter,
            magFilter: filter,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            name: `ShadowMapCube_${formatName}`
        });

        // enable hardware PCF when sampling the depth texture
        if (!isPcss) {
            cubemap.compareOnRead = true;
            cubemap.compareFunc = FUNC_LESS;
        }

        const targets = [];
        for (let i = 0; i < 6; i++) {

            if (isPcss) {

                // color and depth buffer
                targets.push(new RenderTarget({
                    colorBuffer: cubemap,
                    face: i,
                    depth: true
                }));

            } else {

                // depth buffer only
                targets.push(new RenderTarget({
                    depthBuffer: cubemap,
                    face: i
                }));
            }
        }
        return new ShadowMap(cubemap, targets);
    }
}

export { ShadowMap };
