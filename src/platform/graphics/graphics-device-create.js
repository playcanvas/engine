import { Debug } from '../../core/debug.js';

import { WebgpuGraphicsDevice } from './webgpu/webgpu-graphics-device.js';
import { DEVICETYPE_WEBGL, DEVICETYPE_WEBGPU } from './constants.js';
import { WebglGraphicsDevice } from './webgl/webgl-graphics-device.js';

/**
 * Creates a graphics device.
 *
 * @param {HTMLCanvasElement} canvas - The canvas element.
 * @param {object} options - Graphics device options.
 * @param {string[]} [options.deviceTypes] - An array of DEVICETYPE_*** constants, defining the
 * order in which the device are attempted to get created. Defaults to [{@link DEVICETYPE_WEBGL}].
 * @param {string} [options.glslangUrl] - An url to glslang script, required if
 * {@link DEVICETYPE_WEBGPU} type is added to deviceTypes array. Not used for
 * {@link DEVICETYPE_WEBGL} device type creation.
 * @param {string} [options.twgslUrl] - An url to twgsl script, required glslangUrl was specified.
 * @returns {Promise} - Promise object representing the created graphics device.
 */
function createGraphicsDevice(canvas, options = {}) {
    options.deviceTypes = options.deviceTypes ?? [DEVICETYPE_WEBGL];

    let device;
    for (let i = 0; i < options.deviceTypes.length; i++) {
        const deviceType = options.deviceTypes[i];

        if (deviceType === DEVICETYPE_WEBGPU && window?.navigator?.gpu) {
            device = new WebgpuGraphicsDevice(canvas, options);
            return device.initWebGpu(options.glslangUrl, options.twgslUrl);
        }

        if (deviceType === DEVICETYPE_WEBGL) {
            device = new WebglGraphicsDevice(canvas, options);
            return Promise.resolve(device);
        }
    }

    Debug.assert(device, 'Failed to allocate graphics device based on requested device types: ', options.deviceTypes);
    return Promise.reject(new Error("Failed to allocated graphics device"));
}

export { createGraphicsDevice };
