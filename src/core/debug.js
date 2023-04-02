import { Tracing } from "./tracing.js";

/**
 * Engine debug log system. Note that the logging only executes in the
 * debug build of the engine, and is stripped out in other builds.
 *
 * @ignore
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
     * Deprecated warning message.
     *
     * @param {string} message - The message to log.
     */
    static deprecated(message) {
        if (!Debug._loggedMessages.has(message)) {
            Debug._loggedMessages.add(message);
            console.warn('DEPRECATED: ' + message);
        }
    }

    /**
     * Assertion deprecated message. If the assertion is false, the deprecated message is written to the log.
     *
     * @param {boolean|object} assertion - The assertion to check.
     * @param {string} message - The message to log.
     */
    static assertDeprecated(assertion, message) {
        if (!assertion) {
            Debug.deprecated(message);
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
     * Assertion error message that writes an error message to the log if the object has already
     * been destroyed. To be used along setDestroyed.
     *
     * @param {object} object - The object to check.
     */
    static assertDestroyed(object) {
        if (object?.__alreadyDestroyed) {
            const message = `[${object.constructor?.name}] with name [${object.name}] has already been destroyed, and cannot be used.`;
            if (!Debug._loggedMessages.has(message)) {
                Debug._loggedMessages.add(message);
                console.error('ASSERT FAILED: ', message, object);
            }
        }
    }

    /**
     * Executes a function in debug mode only.
     *
     * @param {Function} func - Function to call.
     */
    static call(func) {
        func();
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
     */
    static trace(channel, ...args) {
        if (Tracing.get(channel)) {
            console.groupCollapsed(`${channel.padEnd(20, ' ')}|`, ...args);
            if (Tracing.stack) {
                console.trace();
            }
            console.groupEnd();
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
     * @param {object} object - The object to assign the name to.
     * @param {string} name - The name to assign.
     */
    static setName(object, name) {
        if (object) {
            object.name = name;
        }
    }

    /**
     * Set a label to the label property of the object. Executes only in the debug build.
     *
     * @param {object} object - The object to assign the name to.
     * @param {string} label - The label to assign.
     */
    static setLabel(object, label) {
        if (object) {
            object.label = label;
        }
    }

    /**
     * Marks object as destroyed. Executes only in the debug build. To be used along assertDestroyed.
     *
     * @param {object} object - The object to mark as destroyed.
     */
    static setDestroyed(object) {
        if (object) {
            object.__alreadyDestroyed = true;
        }
    }
}

export { Debug, DebugHelper };
