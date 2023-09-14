// Apply PointerLock shims
(function () {
    // Old API
    if (typeof navigator === 'undefined' || typeof document === 'undefined') {
        // Not running in a browser
        return;
    }

    navigator.pointer = navigator.pointer || navigator.webkitPointer || navigator.mozPointer;

    // Events
    var pointerlockchange = function () {
        var e = document.createEvent('CustomEvent');
        e.initCustomEvent('pointerlockchange', true, false, null);
        document.dispatchEvent(e);
    };

    var pointerlockerror = function () {
        var e = document.createEvent('CustomEvent');
        e.initCustomEvent('pointerlockerror', true, false, null);
        document.dispatchEvent(e);
    };

    document.addEventListener('webkitpointerlockchange', pointerlockchange, false);
    document.addEventListener('webkitpointerlocklost', pointerlockchange, false);
    document.addEventListener('mozpointerlockchange', pointerlockchange, false);
    document.addEventListener('mozpointerlocklost', pointerlockchange, false);

    document.addEventListener('webkitpointerlockerror', pointerlockerror, false);
    document.addEventListener('mozpointerlockerror', pointerlockerror, false);

    // requestPointerLock
    if (Element.prototype.mozRequestPointerLock) {
        // FF requires a new function for some reason
        Element.prototype.requestPointerLock = function () {
            this.mozRequestPointerLock();
        };
    } else {
        Element.prototype.requestPointerLock = Element.prototype.requestPointerLock || Element.prototype.webkitRequestPointerLock || Element.prototype.mozRequestPointerLock;
    }

    if (!Element.prototype.requestPointerLock && navigator.pointer) {
        Element.prototype.requestPointerLock = function () {
            var el = this;
            document.pointerLockElement = el;
            navigator.pointer.lock(el, pointerlockchange, pointerlockerror);
        };
    }

    // exitPointerLock
    document.exitPointerLock = document.exitPointerLock || document.webkitExitPointerLock || document.mozExitPointerLock;
    if (!document.exitPointerLock) {
        document.exitPointerLock = function () {
            if (navigator.pointer) {
                document.pointerLockElement = null;
                navigator.pointer.unlock();
            }
        };
    }
})();
