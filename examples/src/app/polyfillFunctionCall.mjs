const functionCall = Function.prototype.call;

/**
 * @param {any} thisArg - This context.
 * @param {any[]} args - Arguments
 * @returns {Function} - The bound function
 */
function polyCall(thisArg, ...args) {
    if (this.toString().startsWith('class')) {
        return Object.assign(thisArg, new this(...args));
    }
    return functionCall.bind(this)(thisArg, ...args);
}

/**
 * Used in outline and posteffects to make ES5 scripts work in ES6
 * @example
 * // doesn't start with 'class', so not changing any behaviour
 * debugger; // step through with F11 to debug
 * Object.prototype.toString.call(1) === '[object Number]'
 */
function enablePolyfillFunctionCall() {
    // eslint-disable-next-line no-extend-native
    Function.prototype.call = polyCall;
}
export { enablePolyfillFunctionCall };
