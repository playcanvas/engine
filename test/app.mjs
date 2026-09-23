import { createGraphicsDevice } from './device.mjs';
import { Application } from '../src/framework/application.js';

/**
 * Create a new application instance on the graphics device the tests run on: the null device, or
 * a WebGPU device under `npm run test:webgpu`.
 * @returns {Application} The new application instance.
 */
function createApp() {
    const canvas = document.createElement('canvas');
    const graphicsDevice = createGraphicsDevice(canvas);
    return new Application(canvas, { graphicsDevice });
}

export { createApp };
