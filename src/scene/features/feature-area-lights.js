import { DebugHelper } from '../../core/debug.js';
import { AreaLightLuts } from '../area-light-luts.js';
import { areaLightChunksGLSL } from '../shader-lib/glsl/collections/area-light-chunks-glsl.js';
import { areaLightChunksWGSL } from '../shader-lib/wgsl/collections/area-light-chunks-wgsl.js';
import { FEATURE_AREA_LIGHTS } from './constants.js';
import { Feature } from './feature.js';

// The engine code of area lights, shared by the feature for each device, so that it is installed
// once when a host installs both.
const areaLightsCode = /* #__PURE__ */ new Feature({
    // creates the LUT textures of area lights from the LUT data the feature brings
    install: (host) => {
        AreaLightLuts.create(host.graphicsDevice);
    }
});
DebugHelper.setName(areaLightsCode, FEATURE_AREA_LIGHTS);

/**
 * Area lights on a WebGL device.
 *
 * @type {Feature}
 * @ignore
 */
export const featureAreaLightsWebgl = /* #__PURE__ */ new Feature({
    chunks: areaLightChunksGLSL,
    requires: [areaLightsCode]
});
DebugHelper.setName(featureAreaLightsWebgl, 'areaLights-webgl');

/**
 * Area lights on a WebGPU device.
 *
 * @type {Feature}
 * @ignore
 */
export const featureAreaLightsWebgpu = /* #__PURE__ */ new Feature({
    chunks: areaLightChunksWGSL,
    requires: [areaLightsCode]
});
DebugHelper.setName(featureAreaLightsWebgpu, 'areaLights-webgpu');
