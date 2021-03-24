// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isFinite#polyfill
if (Number.isFinite === undefined) Number.isFinite = function(value) {
    return typeof value === 'number' && isFinite(value);
}
