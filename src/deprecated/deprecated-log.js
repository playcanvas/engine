// class responsible for logging each unique deprecated message one time
class DeprecatedLog {
    // #if _DEBUG
    static _loggedMessages = new Set();
    // #endif

    static log(message) {
        // #if _DEBUG
        if (!DeprecatedLog._loggedMessages.has(message)) {
            DeprecatedLog._loggedMessages.add(message);
            console.warn(message);
        }
        // #endif
    }
}

export { DeprecatedLog };
