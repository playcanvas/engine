/** @typedef {import('../graphics/graphics-device.js').GraphicsDevice} GraphicsDevice */

/**
 * Internal debug system - logs, assets and similar. Note that the functions only execute in the
 * debug build, and are stripped out in other builds.
 *
 * @ignore
 */
class Debug {
    /**
     * Set storing already logged deprecated messages, to only print each unique message one time.
     *
     * @type {Set<string>}
     * @private
     */
    static _deprecatedMessages = new Set();

    /**
     * Deprecated warning message.
     *
     * @param {string} message - The message to log.
     */
    static deprecated(message) {
        if (!Debug._deprecatedMessages.has(message)) {
            Debug._deprecatedMessages.add(message);
            console.warn("DEPRECATED: " + message);
        }
    }

    /**
     * Assertion error message. If the assertion is false, the error message is written to the log.
     *
     * @param {boolean} assertion - The assertion to check.
     * @param {...*} args - The values to be written to the log.
     */
    static assert(assertion, ...args) {
        if (!assertion) {
            console.error("ASSERT FAILED: ", ...args);
        }
    }

    /**
     * Info message.
     *
     * @param {...*} args - The values to be written to the log.
     */
    static log(...args) {
        console.log(...args);
    }

    /**
     * Warning message.
     *
     * @param {...*} args - The values to be written to the log.
     */
    static warn(...args) {
        console.warn(...args);
    }

    /**
     * Error message.
     *
     * @param {...*} args - The values to be written to the log.
     */
    static error(...args) {
        console.error(...args);
    }

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

export { Debug };
