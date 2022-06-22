import { defineProtoFunc } from "./defineProtoFunc.js";

const typedArrays = [
    Int8Array,
    Uint8Array,
    Uint8ClampedArray,
    Int16Array,
    Uint16Array,
    Int32Array,
    Uint32Array,
    Float32Array
];
for (const typedArray of typedArrays) {
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/fill#polyfill
    defineProtoFunc(typedArray, "fill", Array.prototype.fill);
    defineProtoFunc(typedArray, "join", Array.prototype.join);
}
