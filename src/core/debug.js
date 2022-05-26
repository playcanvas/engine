/**
 * Logs a frame number.
 *
 * @type {string}
 */
export const TRACEID_RENDER_FRAME = 'RenderFrame';

/**
 * Logs a render target resolve operations.
 *
 * @type {string}
 */
export const TRACEID_RT_RESOLVE = 'RT-Resolve';

/**
 * Logs a render passes.
 *
 * @type {string}
 */
export const TRACEID_RENDER_PASS = 'RenderPass';

/**
 * Engine debug log system. Note that the logging only executes in the
 * debug build of the engine, and is stripped out in other builds. It allows
 * you to monitor logs from various engine systems.
 */
class Debug {
    /**
     * Set storing already logged messages, to only print each unique message one time.
     *
     * @type {Set<string>}
     * @private
     */
    static _loggedMessages = new Set();

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
     * @param {string} channel - Name of the trace channel. Can be:
     *
     * - {@link TRACEID_RENDER_FRAME}
     * - {@link TRACEID_RENDER_PASS}
     *
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
     * @ignore
     */
    static deprecated(message) {
        if (!Debug._loggedMessages.has(message)) {
            Debug._loggedMessages.add(message);
            console.warn('DEPRECATED: ' + message);
        }
    }

    /**
     * Assertion error message. If the assertion is false, the error message is written to the log.
     *
     * @param {boolean|object} assertion - The assertion to check.
     * @param {...*} args - The values to be written to the log.
     * @ignore
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
     * @ignore
     */
    static log(...args) {
        console.log(...args);
    }

    /**
     * Info message logged no more than once.
     *
     * @param {string} message - The message to log.
     */
    static logOnce(message) {
        if (!Debug._loggedMessages.has(message)) {
            Debug._loggedMessages.add(message);
            console.log(message);
        }
    }

    /**
     * Warning message.
     *
     * @param {...*} args - The values to be written to the log.
     * @ignore
     */
    static warn(...args) {
        console.warn(...args);
    }

    /**
     * Warning message logged no more than once.
     *
     * @param {string} message - The message to log.
     */
    static warnOnce(message) {
        if (!Debug._loggedMessages.has(message)) {
            Debug._loggedMessages.add(message);
            console.warn(message);
        }
    }

    /**
     * Error message.
     *
     * @param {...*} args - The values to be written to the log.
     * @ignore
     */
    static error(...args) {
        console.error(...args);
    }

    /**
     * Error message logged no more than once.
     *
     * @param {string} message - The message to log.
     */
    static errorOnce(message) {
        if (!Debug._loggedMessages.has(message)) {
            Debug._loggedMessages.add(message);
            console.error(message);
        }
    }

    /**
     * Trace message, which is logged to the console if the tracing for the channel is enabled
     *
     * @param {string} channel - The trace channel
     * @param {...*} args - The values to be written to the log.
     * @ignore
     */
    static trace(channel, ...args) {
        if (Debug._traceChannels.has(channel)) {
            console.log(`[${channel}] `, ...args);
        }
    }
}

/**
 * A helper debug functionality.
 *
 * @ignore
 */
class DebugHelper {
    /**
     * Set a name to the name property of the object. Executes only in the debug build.
     *
     * @param {Object} object - The object to assign the name to.
     * @param {string} name - The name to assign.
     */
    static setName(object, name) {
        if (object) {
            object.name = name;
        }
    }
}

export { Debug, DebugHelper };
