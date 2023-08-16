import { Debug } from '../../core/debug.js';
import { platform } from '../../core/platform.js';

import { DEVICETYPE_WEBGL2, DEVICETYPE_WEBGL1, DEVICETYPE_WEBGPU, DEVICETYPE_NULL } from './constants.js';
import { WebgpuGraphicsDevice } from './webgpu/webgpu-graphics-device.js';
import { WebglGraphicsDevice } from './webgl/webgl-graphics-device.js';
import { NullGraphicsDevice } from './null/null-graphics-device.js';

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
 * @param {boolean} [options.depth] - Boolean that indicates that the drawing buffer is
 * requested to have a depth buffer of at least 16 bits. Defaults to true.
 * @param {boolean} [options.stencil] - Boolean that indicates that the drawing buffer is
 * requested to have a stencil buffer of at least 8 bits. Defaults to true.
 * @param {string} [options.glslangUrl] - The URL to the glslang script. Required if the
 * {@link DEVICETYPE_WEBGPU} type is added to deviceTypes array. Not used for
 * {@link DEVICETYPE_WEBGL1} or {@link DEVICETYPE_WEBGL2} device type creation.
 * @param {string} [options.twgslUrl] - An url to twgsl script, required if glslangUrl was specified.
 * @param {boolean} [options.xrCompatible] - Boolean that hints to the user agent to use a
 * compatible graphics adapter for an immersive XR device.
 * @param {'default'|'high-performance'|'low-power'} [options.powerPreference] - A hint indicating
 * what configuration of GPU would be selected. Possible values are:
 *
 * - 'default': Let the user agent decide which GPU configuration is most suitable. This is the
 * default value.
 * - 'high-performance': Prioritizes rendering performance over power consumption.
 * - 'low-power': Prioritizes power saving over rendering performance.
 *
 * Defaults to 'default'.
 * @returns {Promise} - Promise object representing the created graphics device.
 */
function createGraphicsDevice(canvas, options = {}) {

    const deviceTypes = options.deviceTypes ?? [];

    // automatically added fallbacks
    if (!deviceTypes.includes(DEVICETYPE_WEBGL2)) {
        deviceTypes.push(DEVICETYPE_WEBGL2);
    }
    if (!deviceTypes.includes(DEVICETYPE_WEBGL1)) {
        deviceTypes.push(DEVICETYPE_WEBGL1);
    }
    if (!deviceTypes.includes(DEVICETYPE_NULL)) {
        deviceTypes.push(DEVICETYPE_NULL);
    }

    // XR compatibility if not specified
    if (platform.browser && !!navigator.xr) {
        options.xrCompatible ??= true;
    }

    let device;
    for (let i = 0; i < deviceTypes.length; i++) {
        const deviceType = deviceTypes[i];

        if (deviceType === DEVICETYPE_WEBGPU && window?.navigator?.gpu) {
            device = new WebgpuGraphicsDevice(canvas, options);
            return device.initWebGpu(options.glslangUrl, options.twgslUrl);
        }

        if (deviceType === DEVICETYPE_WEBGL1 || deviceType === DEVICETYPE_WEBGL2) {
            options.preferWebGl2 = deviceType === DEVICETYPE_WEBGL2;
            device = new WebglGraphicsDevice(canvas, options);
            return Promise.resolve(device);
        }

        if (deviceType === DEVICETYPE_NULL) {
            device = new NullGraphicsDevice(canvas, options);
            return Promise.resolve(device);
        }
    }

    Debug.assert(device, 'Failed to allocate graphics device based on requested device types: ', options.deviceTypes);
    return Promise.reject(new Error("Failed to allocate graphics device"));
}

export { createGraphicsDevice };
