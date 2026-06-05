import { Observer } from './playcanvas-observer.mjs';
import { getQueryParams } from './runtime.mjs';

const DEVICE_TYPES = ['webgpu', 'webgpu:bare', 'webgl2', 'null'];
const params = getQueryParams(window.location.href);
const isWebGPU = dt => dt === 'webgpu' || dt.startsWith('webgpu:');

/**
 * @type {Observer}
 */
let data;
let deviceType = 'webgl2';

function refreshContext() {
    data = new Observer({});
}

/**
 * @param {{ WEBGPU_DISABLED: boolean; WEBGL_DISABLED: boolean; WEBGPU_BARE_DISABLED: boolean; PREFERRED_DEVICE?: string }} config - The configuration object.
 */
function updateDeviceType(config) {
    // Resolution order: stored user preference > example PREFERRED_DEVICE > 'webgl2'. We have
    // to distinguish "no stored preference" from "user picked webgl2", which `?? 'webgl2'`
    // collapses — so we check the raw localStorage value for null instead.
    const savedDevice = localStorage.getItem('preferredGraphicsDevice');
    if (savedDevice && DEVICE_TYPES.includes(savedDevice)) {
        deviceType = savedDevice;
    } else if (config.PREFERRED_DEVICE && DEVICE_TYPES.includes(config.PREFERRED_DEVICE)) {
        deviceType = config.PREFERRED_DEVICE;
    } else {
        deviceType = 'webgl2';
    }

    if (params.deviceType && DEVICE_TYPES.includes(params.deviceType)) {
        console.warn('Overriding default device: ', params.deviceType);
        deviceType = params.deviceType;
        return;
    }

    if (config.WEBGL_DISABLED && config.WEBGPU_DISABLED) {
        console.warn('Both WebGL 2.0 and WebGPU are disabled. Using Null device instead.');
        deviceType = 'null';
        return;
    }
    if (config.WEBGPU_DISABLED && isWebGPU(deviceType)) {
        console.warn('WebGPU is disabled. Using WebGL 2.0 device instead.');
        deviceType = 'webgl2';
        return;
    }
    if (config.WEBGL_DISABLED && !isWebGPU(deviceType)) {
        console.warn('WebGL 2.0 is disabled. Using WebGPU device instead.');
        deviceType = 'webgpu';
    }
    if (config.WEBGPU_BARE_DISABLED && deviceType === 'webgpu:bare') {
        console.warn('WebGPU Bare is disabled for this example. Using WebGPU instead.');
        deviceType = 'webgpu';
    }
}

export { data, deviceType, refreshContext, updateDeviceType };
