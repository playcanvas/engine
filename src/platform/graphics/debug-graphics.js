/** @typedef {import('./graphics-device.js').GraphicsDevice} GraphicsDevice */

/**
 * Internal graphics debug system - gpu markers and similar. Note that the functions only execute in the
 * debug build, and are stripped out in other builds.
 *
 * @ignore
 */
class DebugGraphics {
    /**
     * Push GPU marker to the stack on the device.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {string} name - The name of the marker.
     */
    static pushGpuMarker(device, name) {
        device.pushMarker(name);
    }

    /**
     * Pop GPU marker from the stack on the device.
     *
     * @param {GraphicsDevice} device - The graphics device.
     */
    static popGpuMarker(device) {
        device.popMarker();
    }
}

export { DebugGraphics };
