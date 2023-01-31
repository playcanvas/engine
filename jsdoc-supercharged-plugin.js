const catharsis = require("catharsis");
const originalParse = catharsis.parse;
/**
 * @param {string} str - A type like `typeof navigator.getGamepads`
 * @param {object} [options] - The options.
 */
catharsis.parse = function(str, options) {
    if (str.startsWith("typeof")) {
        // Just add quotes around it
       str = JSON.stringify(str);
    }
    // Tuple support
    if (str[0] == '[') {
        str = 'Array<*>';
    }
    return originalParse(str, options);
}
