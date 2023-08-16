const functionCall = Function.prototype.call;

function polyCall(thisArg, ...args) {
    // console.log("polyfill Function .call", this, thisArg, ...args);
    if (this.toString().startsWith('class')) {
        console.warn("ES6 classes are not the same as functions, but we make it work anyway... be careful.");
        return Object.assign(thisArg, new this(...args));
    }
    return functionCall.bind(this)(thisArg, ...args);
}

/**
 * Object.prototype.toString.call(1) === '[object Number]'
 * Used in outline and posteffects to make ES5 scripts work in ES6
 * waiting for decision in https://github.com/playcanvas/engine/pull/5561
 */
function enablePolyfillFunctionCall() {
    if (Function.prototype.call === polyCall) {
        console.warn("already enabled ES6 Function.prototype.call polyfill.");
        return;
    }
    Function.prototype.call = polyCall;
}
export { enablePolyfillFunctionCall };
