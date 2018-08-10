Object.assign(pc, function () {
    var log = {
        /**
         * @private
         * @function
         * @name pc.log.write
         * @description Write text to the console
         * @param {String} text The text to log.
         */
        write: function (text) {
            console.log(text);
        },

        /**
         * @private
         * @function
         * @name pc.log.open
         * @description Starting logging to the console
         */
        open: function () {
            pc.log.write("Powered by PlayCanvas " + pc.version + " " + pc.revision);
        },

        /**
         * @private
         * @function
         * @name pc.log.info
         * @description Write text to the log preceded by 'INFO:'
         * @param {String} text The text to log.
         */
        info: function (text) {
            console.info("INFO:    " + text);
        },

        /**
         * @private
         * @function
         * @name pc.log.debug
         * @description Write text to the log preceded by 'DEBUG:'
         * @param {String} text The text to log.
         */
        debug: function (text) {
            console.debug("DEBUG:   " + text);
        },

        /**
         * @private
         * @function
         * @name pc.log.error
         * @description Write text to the log preceded by 'ERROR:'
         * @param {String} text The text to log.
         */
        error: function (text) {
            console.error("ERROR:   " + text);
        },

        /**
         * @private
         * @function
         * @name pc.log.warning
         * @description Write text to the log preceded by 'WARNING:'
         * @param {String} text The text to log.
         */
        warning: function (text) {
            console.warn("WARNING: " + text);
        },

        /**
         * @private
         * @function
         * @name pc.log.alert
         * @description Write text to the log preceded by 'ALERT:' and pop up an alert dialog box with the text
         * @param {String} text The text to show in the alert.
         */
        alert: function (text) {
            pc.log.write("ALERT:   " + text);
            alert(text); // eslint-disable-line no-alert
        },

        /**
         * @private
         * @function
         * @name pc.log.assert
         * @description If condition is false, then write text to the log preceded by 'ASSERT:'.
         * @param {Boolean} condition The condition to test.
         * @param {String} text The text to show if the condition is false.
         */
        assert: function (condition, text) {
            if (condition === false) {
                pc.log.write("ASSERT:  " + text);
            }
        }
    };

    return {
        log: log
    };
}());

// Shortcuts to logging functions
// ESLint disabled here because these vars may be accessed from other files
// once all sources have been concatenated together and wrapped by the closure.
/* eslint-disable no-unused-vars */
var logINFO = pc.log.info;
var logDEBUG = pc.log.debug;
var logWARNING = pc.log.warning;
var logERROR = pc.log.error;

var logALERT = pc.log.alert;
var logASSERT = pc.log.assert;
/* eslint-enable no-unused-vars */
