import { Application } from '../src/framework/application.js';
import { NullGraphicsDevice } from '../src/platform/graphics/null/null-graphics-device.js';

/**
 * Create a new application instance that uses the null graphics device.
 * @returns {Application} The new application instance.
 */
function createApp() {
    const canvas = document.createElement('canvas');
    const graphicsDevice = new NullGraphicsDevice(canvas);
    return new Application(canvas, { graphicsDevice });
}

export { createApp };
