// class responsible for logging each unique deprecated message one time
class DeprecatedLog {
    static _loggedMessages = new Set();

    static log(message) {
        if (!DeprecatedLog._loggedMessages.has(message)) {
            DeprecatedLog._loggedMessages.add(message);
            console.warn(message);
        }
    }
}

export { DeprecatedLog };
