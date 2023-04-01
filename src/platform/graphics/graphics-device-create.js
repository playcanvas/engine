import { Debug } from '../../core/debug.js';

import { WebgpuGraphicsDevice } from './webgpu/webgpu-graphics-device.js';
import { DEVICETYPE_WEBGL2, DEVICETYPE_WEBGL1, DEVICETYPE_WEBGPU } from './constants.js';
import { WebglGraphicsDevice } from './webgl/webgl-graphics-device.js';

/**
 * Creates a graphics device.
 *
 * @param {HTMLCanvasElement} canvas - The canvas element.
 * @param {object} options - Graphics device options.
 * @param {string[]} [options.deviceTypes] - An array of DEVICETYPE_*** constants, defining the
 * order in which the devices are attempted to get created. Defaults to an empty array. If the
 * specified array does not contain [{@link DEVICETYPE_WEBGL2} or {@link DEVICETYPE_WEBGL1}], those
 * are internally added to its end in this order. Typically, you'd only specify
 * {@link DEVICETYPE_WEBGPU}, or leave it empty.
 * @param {boolean} [options.antialias] - Boolean that indicates whether or not to perform
 * anti-aliasing if possible. Defaults to true.
 * @param {string} [options.glslangUrl] - An url to glslang script, required if
 * {@link DEVICETYPE_WEBGPU} type is added to deviceTypes array. Not used for
 * {@link DEVICETYPE_WEBGL} device type creation.
 * @param {string} [options.twgslUrl] - An url to twgsl script, required if glslangUrl was specified.
 * @returns {Promise} - Promise object representing the created graphics device.
 */
function createGraphicsDevice(canvas, options = {}) {

    // defaults
    options.antialias ??= true;

    const deviceTypes = options.deviceTypes ?? [];

    // automatically added fallbacks
    if (!deviceTypes.includes(DEVICETYPE_WEBGL2)) {
        deviceTypes.push(DEVICETYPE_WEBGL2);
    }
    if (!deviceTypes.includes(DEVICETYPE_WEBGL1)) {
        deviceTypes.push(DEVICETYPE_WEBGL1);
    }

    let device;
    for (let i = 0; i < deviceTypes.length; i++) {
        const deviceType = deviceTypes[i];

        if (deviceType === DEVICETYPE_WEBGPU && window?.navigator?.gpu) {
            device = new WebgpuGraphicsDevice(canvas, options);
            return device.initWebGpu(options.glslangUrl, options.twgslUrl);
        }

        if (deviceType !== DEVICETYPE_WEBGPU) {
            options.preferWebGl2 = deviceType === DEVICETYPE_WEBGL2;
            device = new WebglGraphicsDevice(canvas, options);
            return Promise.resolve(device);
        }
    }

    Debug.assert(device, 'Failed to allocate graphics device based on requested device types: ', options.deviceTypes);
    return Promise.reject(new Error("Failed to allocate graphics device"));
}

export { createGraphicsDevice };
