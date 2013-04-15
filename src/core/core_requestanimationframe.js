// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating

// requestAnimationFrame polyfill by Erik Möller
// fixes from Paul Irish and Tino Zijdel
(function(exports) {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !exports.requestAnimationFrame; ++x) {
        exports.requestAnimationFrame = exports[vendors[x]+'RequestAnimationFrame'];
        exports.cancelAnimationFrame = exports[vendors[x]+'CancelAnimationFrame'] || exports[vendors[x]+'CancelRequestAnimationFrame'];
    }
 
    if (!exports.requestAnimationFrame)
        exports.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = exports.setTimeout(function() { callback(currTime + timeToCall); }, 
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };
 
    if (!exports.cancelAnimationFrame)
        exports.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };

    // TEMP: compatibility
    exports.requestAnimFrame = exports.requestAnimationFrame;
}(typeof exports === 'undefined' ? this : exports));