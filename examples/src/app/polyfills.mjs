import { enablePolyfillFunctionCall } from "./polyfillFunctionCall.mjs";

enablePolyfillFunctionCall();

// polyfill slice on UInt8Array
if (!Uint8Array.prototype.slice) {
    // eslint-disable-next-line no-extend-native
    Object.defineProperty(Uint8Array.prototype, 'slice', {
        value: function (/** @type {any} */ begin, /** @type {any} */ end) {
            return new Uint8Array(Array.prototype.slice.call(this, begin, end));
        }
    });
}
