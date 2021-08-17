// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/fill#polyfill
if (!Int8Array.prototype.fill) {
    Int8Array.prototype.fill = Array.prototype.fill;
}

if (!Uint8Array.prototype.fill) {
    Uint8Array.prototype.fill = Array.prototype.fill;
}

if (!Uint8ClampedArray.prototype.fill) {
    Uint8ClampedArray.prototype.fill = Array.prototype.fill;
}

if (!Int16Array.prototype.fill) {
    Int16Array.prototype.fill = Array.prototype.fill;
}

if (!Uint16Array.prototype.fill) {
    Uint16Array.prototype.fill = Array.prototype.fill;
}

if (!Int32Array.prototype.fill) {
    Int32Array.prototype.fill = Array.prototype.fill;
}

if (!Uint32Array.prototype.fill) {
    Uint32Array.prototype.fill = Array.prototype.fill;
}

if (!Float32Array.prototype.fill) {
    Float32Array.prototype.fill = Array.prototype.fill;
}
