/**
 * Internal graphics debug system - gpu markers and similar. Note that the functions only execute in the
 * debug build, and are stripped out in other builds.
 *
 * @ignore
 */
class DebugGraphics {
    /**
     * An array of markers, representing a stack.
     *
     * @type {string[]}
     * @private
     */
    static markers = [];

    /**
     * Clear internal stack of the GPU markers. It should be called at the start of the frame to
     * prevent the array growing if there are exceptions during the rendering.
     */
    static clearGpuMarkers() {
        DebugGraphics.markers.length = 0;
    }

    /**
     * Push GPU marker to the stack on the device.
     *
     * @param {import('./graphics-device.js').GraphicsDevice} device - The graphics device.
     * @param {string} name - The name of the marker.
     */
    static pushGpuMarker(device, name) {
        DebugGraphics.markers.push(name);
        device.pushMarker(name);
    }

    /**
     * Pop GPU marker from the stack on the device.
     *
     * @param {import('./graphics-device.js').GraphicsDevice} device - The graphics device.
     */
    static popGpuMarker(device) {
        if (DebugGraphics.markers.length) {
            DebugGraphics.markers.pop();
        }
        device.popMarker();
    }

    /**
     * Converts current markers into a single string format.
     *
     * @returns {string} String representation of current markers.
     */
    static toString() {
        return DebugGraphics.markers.join(" | ");
    }
}

export { DebugGraphics };
