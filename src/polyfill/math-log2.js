// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/log2#Polyfill
Math.log2 = Math.log2 || function(x) {
    return Math.log(x) * Math.LOG2E;
};
