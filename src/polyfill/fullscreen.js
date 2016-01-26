// Shim the Fullscreen API
(function () {
    if (typeof document === 'undefined') {
        // Not running in a browser
        return;
    }

    // Events
    var fullscreenchange = function () {
        var e = document.createEvent('CustomEvent');
        e.initCustomEvent('fullscreenchange', true, false, null);
        document.dispatchEvent(e);
    };

    var fullscreenerror = function () {
        var e = document.createEvent('CustomEvent');
        e.initCustomEvent('fullscreenerror', true, false, null);
        document.dispatchEvent(e);
    };

    document.addEventListener('webkitfullscreenchange', fullscreenchange, false);
    document.addEventListener('mozfullscreenchange', fullscreenchange, false);
    document.addEventListener('MSFullscreenChange', fullscreenchange, false);
    document.addEventListener('webkitfullscreenerror', fullscreenerror, false);
    document.addEventListener('mozfullscreenerror', fullscreenerror, false);
    document.addEventListener('MSFullscreenError', fullscreenerror, false);

    if (Element.prototype.mozRequestFullScreen) {
        // FF requires a new function for some reason
        Element.prototype.requestFullscreen = function () {
            this.mozRequestFullScreen();
        };
    } else {
        Element.prototype.requestFullscreen = Element.prototype.requestFullscreen ||
                                              Element.prototype.webkitRequestFullscreen ||
                                              Element.prototype.msRequestFullscreen ||
                                              function () {};
    }
    document.exitFullscreen = document.exitFullscreen ||
                              document.webkitExitFullscreen ||
                              document.mozCancelFullScreen ||
                              document.msExitFullscreen;
    if (!document.hasOwnProperty('fullscreenElement')) {
        Object.defineProperty(document, 'fullscreenElement', {
            enumerable: true,
            configurable: false,
            get: function () {
                return document.webkitCurrentFullScreenElement ||
                       document.webkitFullscreenElement ||
                       document.mozFullScreenElement ||
                       document.msFullscreenElement;
            }
        });
    }

    if (!document.hasOwnProperty('fullscreenEnabled')) {
        Object.defineProperty(document, 'fullscreenEnabled', {
            enumerable: true,
            configurable: false,
            get: function () {
                return document.webkitFullscreenEnabled ||
                       document.mozFullScreenEnabled ||
                       document.msFullscreenEnabled;
            }
        });
    }
}());