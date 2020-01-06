// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/sign#Polyfill
if (!Math.sign) {
    Math.sign = function(x) {
        // If x is NaN, the result is NaN.
        // If x is -0, the result is -0.
        // If x is +0, the result is +0.
        // If x is negative and not -0, the result is -1.
        // If x is positive and not +0, the result is +1.
        return ((x > 0) - (x < 0)) || +x;
        // A more aesthetic pseudo-representation:
        //
        // ( (x > 0) ? 1 : 0 )  // if x is positive, then positive one
        //          +           // else (because you can't be both - and +)
        // ( (x < 0) ? -1 : 0 ) // if x is negative, then negative one
        //         ||           // if x is 0, -0, or NaN, or not a number,
        //         +x           // then the result will be x, (or) if x is
        //                      // not a number, then x converts to number
    };
}
