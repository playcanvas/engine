// Internal debug system - logs, assets and similar
// Note that the functions only execute in the debug build, and are stripped out in other builds.
class Debug {
    // set storing already logged deprecated messages, to only print each unique message one time
    static _deprecatedMessages = new Set();

    // deprecated warning message
    static deprecated(message) {
        if (!Debug._deprecatedMessages.has(message)) {
            Debug._deprecatedMessages.add(message);
            console.warn("DEPRECATED: " + message);
        }
    }

    // assertion error message. If the assertion is false, the error message is written to the log
    static assert(assertion, ...args) {
        if (!assertion) {
            console.error("ASSERT FAILED: ", ...args);
        }
    }

    // warning message
    static warn(...args) {
        console.warn(...args);
    }

    // error message
    static error(...args) {
        console.error(...args);
    }
}

export { Debug };
