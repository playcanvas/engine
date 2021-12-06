// internal debug system - logs, assets and similar
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
}

export { Debug };
