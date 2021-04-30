import { Color } from '../../math/color.js';

import {
    ADDRESS_CLAMP_TO_EDGE,
    FILTER_LINEAR, FILTER_NEAREST,
    FUNC_LESS,
    PIXELFORMAT_DEPTH, PIXELFORMAT_R8_G8_B8_A8, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F,
    TEXHINT_SHADOWMAP
} from '../../graphics/constants.js';
import { RenderTarget } from '../../graphics/render-target.js';
import { Texture } from '../../graphics/texture.js';

import {
    LIGHTTYPE_OMNI,
    SHADOW_PCF3, SHADOW_PCF5, SHADOW_VSM8, SHADOW_VSM16, SHADOW_VSM32
} from '../constants.js';

import { Camera } from '../camera.js';
import { GraphNode } from '../graph-node.js';

// pure static class wrapping up functionality of creating and caching of shadow maps
class ShadowMapManager {
    // number of supported shadow modes
    static numShadowModes = 5;

    // cache for 2d shadow maps - must be of size numShadowModes
    static shadowMapCache = [{}, {}, {}, {}, {}];

    // cache for cube shadow maps
    static shadowMapCubeCache = {};

    static getShadowFormat(device, shadowType) {
        if (shadowType === SHADOW_VSM32) {
            return PIXELFORMAT_RGBA32F;
        } else if (shadowType === SHADOW_VSM16) {
            return PIXELFORMAT_RGBA16F;
        } else if (shadowType === SHADOW_PCF5) {
            return PIXELFORMAT_DEPTH;
        } else if (shadowType === SHADOW_PCF3 && device.webgl2) {
            return PIXELFORMAT_DEPTH;
        }
        return PIXELFORMAT_R8_G8_B8_A8;
    }

    static getShadowFiltering(device, shadowType) {
        if (shadowType === SHADOW_PCF3 && !device.webgl2) {
            return FILTER_NEAREST;
        } else if (shadowType === SHADOW_VSM32) {
            return device.extTextureFloatLinear ? FILTER_LINEAR : FILTER_NEAREST;
        } else if (shadowType === SHADOW_VSM16) {
            return device.extTextureHalfFloatLinear ? FILTER_LINEAR : FILTER_NEAREST;
        }
        return FILTER_LINEAR;
    }

    static getShadowMapFromCache(device, res, mode, layer = 0) {
        var id = layer * 10000 + res;
        var shadowBuffer = ShadowMapManager.shadowMapCache[mode][id];
        if (!shadowBuffer) {
            shadowBuffer = ShadowMapManager.createShadowMap(device, res, res, mode ? mode : SHADOW_PCF3);
            ShadowMapManager.shadowMapCache[mode][id] = shadowBuffer;
        }
        return shadowBuffer;
    }

    static createShadowCamera(device, shadowType, type) {
        // We don't need to clear the color buffer if we're rendering a depth map
        var hwPcf = shadowType === SHADOW_PCF5 || (shadowType === SHADOW_PCF3 && device.webgl2);
        if (type === LIGHTTYPE_OMNI) {
            hwPcf = false;
        }

        var shadowCam = new Camera();

        if (shadowType >= SHADOW_VSM8 && shadowType <= SHADOW_VSM32) {
            shadowCam.clearColor = new Color(0, 0, 0, 0);
        } else {
            shadowCam.clearColor = new Color(1, 1, 1, 1);
        }

        shadowCam.clearColorBuffer = !hwPcf;
        shadowCam.clearDepthBuffer = true;
        shadowCam.clearStencilBuffer = false;

        shadowCam.node = new GraphNode();

        return shadowCam;
    }

    static createShadowBuffer(device, light) {
        var shadowBuffer;
        if (light._type === LIGHTTYPE_OMNI) {
            if (light._shadowType > SHADOW_PCF3) light._shadowType = SHADOW_PCF3; // no VSM or HW PCF omni lights yet
            if (light._cacheShadowMap) {
                shadowBuffer = ShadowMapManager.shadowMapCubeCache[light._shadowResolution];
                if (!shadowBuffer) {
                    shadowBuffer = ShadowMapManager.createShadowCubeMap(device, light._shadowResolution);
                    ShadowMapManager.shadowMapCubeCache[light._shadowResolution] = shadowBuffer;
                }
            } else {
                shadowBuffer = ShadowMapManager.createShadowCubeMap(device, light._shadowResolution);
            }
            light._shadowCamera.renderTarget = shadowBuffer[0];
            light._shadowCubeMap = shadowBuffer;

        } else {

            if (light._cacheShadowMap) {
                shadowBuffer = ShadowMapManager.getShadowMapFromCache(device, light._shadowResolution, light._shadowType);
            } else {
                shadowBuffer = ShadowMapManager.createShadowMap(device, light._shadowResolution, light._shadowResolution, light._shadowType);
            }

            light._shadowCamera.renderTarget = shadowBuffer;
        }
        light._isCachedShadowMap = light._cacheShadowMap;
    }

    static createShadowMap(device, width, height, shadowType) {

        var format = ShadowMapManager.getShadowFormat(device, shadowType);
        var filter = ShadowMapManager.getShadowFiltering(device, shadowType);

        var shadowMap = new Texture(device, {
            // #if _PROFILER
            profilerHint: TEXHINT_SHADOWMAP,
            // #endif
            format: format,
            width: width,
            height: height,
            mipmaps: false,
            minFilter: filter,
            magFilter: filter,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
        shadowMap.name = 'shadowmap';

        if (shadowType === SHADOW_PCF5 || (shadowType === SHADOW_PCF3 && device.webgl2)) {
            shadowMap.compareOnRead = true;
            shadowMap.compareFunc = FUNC_LESS;

            // depthbuffer only
            return new RenderTarget({
                depthBuffer: shadowMap
            });
        }

        // encoded rgba depth
        return new RenderTarget({
            colorBuffer: shadowMap,
            depth: true
        });
    }

    static createShadowCubeMap(device, size) {
        var cubemap = new Texture(device, {
            // #if _PROFILER
            profilerHint: TEXHINT_SHADOWMAP,
            // #endif
            format: PIXELFORMAT_R8_G8_B8_A8,
            width: size,
            height: size,
            cubemap: true,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
        cubemap.name = 'shadowcube';

        var targets = [];
        var target;
        for (var i = 0; i < 6; i++) {
            target = new RenderTarget({
                colorBuffer: cubemap,
                face: i,
                depth: true
            });
            targets.push(target);
        }
        return targets;
    }
}

export { ShadowMapManager };
