import { enablePolyfillFunctionCall } from "./polyfillFunctionCall.mjs";

enablePolyfillFunctionCall();

// polyfill slice on UInt8Array
if (!Uint8Array.prototype.slice) {
    Object.defineProperty(Uint8Array.prototype, 'slice', {
        value: function (begin, end) {
            return new Uint8Array(Array.prototype.slice.call(this, begin, end));
        }
    });
}
