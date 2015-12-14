pc.extend(pc, function () {
    var log = {
        /**
         * @private
         * @function
         * @name pc.log.write
         * @descripttion Write text to the console
         * @param {String} text
         */
        write: function (text) {
            console.log(text);
        },

        /**
         * @private
         * @function
         * @name pc.log.open
         * @descripttion Starting logging to the console
         * @param {String} text
         */
        open: function (text) {
            pc.log.write("Powered by PlayCanvas " + pc.version + " " + pc.revision);
        },

        /**
         * @private
         * @function
         * @name pc.log.info
         * @descripttion Write text to the log preceded by 'INFO:'
         * @param {String} text
         */
        info: function (text) {
            console.info("INFO:    " + text);
        },

        /**
         * @private
         * @function
         * @name pc.log.debug
         * @descripttion Write text to the log preceded by 'DEBUG:'
         * @param {String} text
         */
        debug: function (text) {
            console.debug("DEBUG:   " + text);
        },

        /**
         * @private
         * @function
         * @name pc.log.error
         * @descripttion Write text to the log preceded by 'ERROR:'
         * @param {String} text
         */
        error: function (text) {
            console.error("ERROR:   " + text);
        },

        /**
         * @private
         * @function
         * @name pc.log.warning
         * @descripttion Write text to the log preceded by 'WARNING:'
         * @param {String} text
         */
        warning: function (text) {
            console.warn("WARNING: " + text);
        },

        /**
         * @private
         * @function
         * @name pc.log.alert
         * @descripttion Write text to the log preceded by 'ALERT:' and pop up an alert dialog box with the text
         * @param {String} text
         */
        alert: function (text) {
            pc.log.write("ALERT:   " + text);
            alert(text);
        },

        /**
         * @private
         * @function
         * @name pc.log.assert
         * @descripttion If condition is false, then write text to the log preceded by 'ASSERT:' and pop up a dialog box.
         * @param {Boolean} condition
         * @param {String} text
         */
        assert: function (condition, text) {
            if (condition === false) {
                pc.log.write("ASSERT:  " + text);
                alert("ASSERT failed: " + text);
            }
        }
    };

    return {
        log: log
    };
}());

// Shortcuts to logging functions
var logINFO = pc.log.info;
var logDEBUG = pc.log.debug;
var logWARNING = pc.log.warning;
var logERROR = pc.log.error;

var logALERT = pc.log.alert;
var logASSERT = pc.log.assert;
