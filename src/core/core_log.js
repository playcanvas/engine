/**
 * @namespace Contains logging methods.
 */
var Log = {};

/**
 * Write text to the console
 * @param {String} text
 */
Log.write = function (text) {

    console.log(text);
};

/**
 * Starting logging to the console
 * @param {String} text
 */
Log.open = function (text) {

    Log.write(Date());
    Log.info("Log opened");
};

/**
 * Write text to the log preceded by 'INFO:'
 * @param {String} text
 */
Log.info = function (text) {

    Log.write("INFO:    " + text);
};

/**
 * Write text to the log preceded by 'ERROR:'
 * @param {String} text
 */
Log.error = function (text) {

    Log.write("ERROR:   " + text);
};

/**
 * Write text to the log preceded by 'WARNING:'
 * @param {String} text
 */
Log.warning = function (text) {

    Log.write("WARNING: " + text);
};

/**
 * Write text to the log preceded by 'DEBUG:'
 * @param {String} text
 */
Log.debug = function (text) {

    Log.write("DEBUG:   " + text);
};

/**
 * Write text to the log preceded by 'ALERT:' and pop up an alert dialog box with the text
 * @param {String} text
 */
Log.alert = function (text) {

    Log.write("ALERT:   " + text);
    alert(text);
};

/**
 * If condition is false, then write text to the log preceded by 'ASSERT:' and pop up a dialog box.
 * @param {Boolean} condition
 * @param {String} text
 */
Log.assert = function (condition, text) {

    if (condition === false) {

        Log.write("ASSERT:  " + text);
        alert("ASSERT failed: " + text);
    }
};

// These function are designed so they can be optionally
// 'compiled out' in release builds, like a CPP macro
/**
 * @see Log.info
 */
function logINFO(text) { 
    Log.info(text); 
}
/**
 * @see Log.info
 */
function logERROR(text) { 
    Log.error(text); 
}
/**
 * @see Log.error
 */
function logWARNING(text) { 
    Log.warning(text); 
}
/**
 * @see Log.warning
 */
function logDEBUG(text) { 
    //Log.debug(text); 
}
/**
 * @see Log.debug
 */
function logALERT(text) { 
    Log.alert(text); 
}
/**
 * @see Log.alert
 */
function logASSERT(condition, text) { 
    Log.assert(condition, text); 
}
