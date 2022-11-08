import { Debug } from '../../core/debug.js';

// #if _DEBUG
import { WebgpuGraphicsDevice } from './webgpu/webgpu-graphics-device.js';
// #endif

import { DEVICETYPE_WEBGL, DEVICETYPE_WEBGPU } from './constants.js';
import { WebglGraphicsDevice } from './webgl/webgl-graphics-device.js';

/**
 * Creates a graphics device.
 *
 * @param {Element} canvas - The canvas element.
 * @param {*} options - Options.
 * @returns 
 */
function createGraphicsDevice(canvas, options = {}) {
    options.deviceTypes = options.deviceTypes ?? [DEVICETYPE_WEBGL, DEVICETYPE_WEBGPU];

    let device;
    for (let i = 0; i < options.deviceTypes.length; i++) {
        const deviceType = options.deviceTypes[i];

        // #if _DEBUG
        if (deviceType === DEVICETYPE_WEBGPU && window?.navigator?.gpu) {
            device = new WebgpuGraphicsDevice(canvas, options);
            return device.initWebGpu(options.glslangUrl);
        }
        // #endif

        if (deviceType === DEVICETYPE_WEBGL) {
            device = new WebglGraphicsDevice(canvas, options);
            return Promise.resolve(device);
        }
    }

    Debug.assert(device, 'Failed to allocate graphics device based on requested device types: ', options.deviceTypes);
    return Promise.reject(new Error("Failed to allocated graphics device"));
}

export { createGraphicsDevice };
