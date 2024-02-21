/**
 * Used in outline and posteffects to make ES5 scripts work in ES6
 * @example
 * // doesn't start with 'class', so not changing any behaviour
 * debugger; // step through with F11 to debug
 * Object.prototype.toString.call(1) === '[object Number]'
 */
function enablePolyfillFunctionCall() {
    const functionCall = Function.prototype.call;
    /**
     * @param {any} thisArg - The context.
     * @param {any[]} args - The arguments.
     * @returns {Function} - The poly function.
     */
    function polyCall(thisArg, ...args) {
        if (this.toString().startsWith('class')) {
            return Object.assign(thisArg, new this(...args));
        }
        return functionCall.bind(this)(thisArg, ...args);
    }
    // eslint-disable-next-line no-extend-native
    Function.prototype.call = polyCall;
}
enablePolyfillFunctionCall();
