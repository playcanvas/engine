import { NullGraphicsDevice } from '../src/platform/graphics/null/null-graphics-device.js';
import { WebgpuGraphicsDevice } from '../src/platform/graphics/webgpu/webgpu-graphics-device.js';

/**
 * @typedef {object} WebgpuTestDevice
 * @property {GPU} gpu - The WebGPU entry point.
 * @property {GPUAdapter} adapter - The adapter the shared device was created from.
 * @property {GPUDevice} device - The device shared by every graphics device the tests create.
 * @property {(canvas: object) => GPUCanvasContext} createCanvasContext - Creates a swap chain
 * stand-in for a canvas, as neither jsdom nor mock canvases can provide one.
 */

/**
 * The shared WebGPU objects installed by test/webgpu-device.mjs, or null when the tests run on the
 * null device.
 *
 * @type {WebgpuTestDevice|null}
 */
let webgpu = null;

/**
 * Selects the WebGPU device the tests run on. Called by test/webgpu-device.mjs.
 *
 * @param {WebgpuTestDevice|null} shared - The shared WebGPU objects.
 */
export const setWebgpuTestDevice = (shared) => {
    webgpu = shared;
};

/**
 * The type of graphics device the tests run on: 'null' under `npm test`, 'webgpu' under
 * `npm run test:webgpu`.
 *
 * @returns {'null'|'webgpu'} The device type.
 */
export const getTestDeviceType = () => (webgpu ? 'webgpu' : 'null');

/**
 * Creates the graphics device the unit tests run on: the null device by default, or an engine
 * WebGPU device on the shared Dawn device under `npm run test:webgpu`. Tests that check the
 * behavior of a specific device construct that device directly instead.
 *
 * @param {object} canvas - The canvas, a jsdom canvas or a mock object.
 * @param {object} [options] - The graphics device options.
 * @returns {NullGraphicsDevice|WebgpuGraphicsDevice} The graphics device.
 */
export const createGraphicsDevice = (canvas, options = {}) => {
    if (!webgpu) {
        return new NullGraphicsDevice(canvas, options);
    }

    // jsdom canvases return null from getContext('webgpu') and mock canvases have no getContext at
    // all, so give every canvas a texture-backed swap chain
    const context = webgpu.createCanvasContext(canvas);
    const getContext = typeof canvas.getContext === 'function' ? canvas.getContext.bind(canvas) : () => null;
    canvas.getContext = (type, ...args) => (type === 'webgpu' ? context : getContext(type, ...args));

    // the device reads window.navigator.gpu while initializing, and a test may or may not have a
    // jsdom window at that point
    const hadWindow = typeof globalThis.window !== 'undefined';
    if (!hadWindow) {
        globalThis.window = { navigator: { gpu: webgpu.gpu } };
    } else if (!globalThis.window.navigator.gpu) {
        Object.defineProperty(globalThis.window.navigator, 'gpu', { value: webgpu.gpu, configurable: true });
    }

    // the device logs its features on every initialization, which is noise across thousands of tests
    const log = console.log;
    console.log = (...args) => {
        if (typeof args[0] !== 'string' || !args[0].startsWith('WEBGPU')) {
            log(...args);
        }
    };

    try {
        const device = new WebgpuGraphicsDevice(canvas, options);
        return device.initFromGpuDevice(webgpu.adapter, webgpu.device);
    } finally {
        console.log = log;
        if (!hadWindow) {
            delete globalThis.window;
        }
    }
};
