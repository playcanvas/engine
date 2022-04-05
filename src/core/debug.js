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
     * Set storing names of enabled trace channels
     *
     * @type {Set<string>}
     * @private
     */
    static _traceChannels = new Set();

    /**
     * Enable or disable trace channel
     *
     * @param {string} channel - Name of the trace channel
     * @param {boolean} enabled - new enabled state for it
     */
    static setTrace(channel, enabled = true) {

        // #if _DEBUG
        if (enabled) {
            Debug._traceChannels.add(channel);
        } else {
            Debug._traceChannels.delete(channel);
        }
        // #endif
    }

    /**
     * Deprecated warning message.
     *
     * @param {string} message - The message to log.
     */
    static deprecated(message) {
        if (!Debug._deprecatedMessages.has(message)) {
            Debug._deprecatedMessages.add(message);
            console.warn('DEPRECATED: ' + message);
        }
    }

    /**
     * Assertion error message. If the assertion is false, the error message is written to the log.
     *
     * @param {boolean|object} assertion - The assertion to check.
     * @param {...*} args - The values to be written to the log.
     */
    static assert(assertion, ...args) {
        if (!assertion) {
            console.error('ASSERT FAILED: ', ...args);
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
     * Trace message, which is logged to the console if the tracing for the channel is enabled
     *
     * @param {string} channel - The trace channel
     * @param {...*} args - The values to be written to the log.
     */
    static trace(channel, ...args) {
        if (Debug._traceChannels.has(channel)) {
            console.log(`[${channel}] `, ...args);
        }
    }
}

export { Debug };
