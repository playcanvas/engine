/**
 * @namespace
 * @name platform
 * @description Global namespace that stores flags regarding platform environment and features support.
 * @example
 * if (pc.platform.touch) {
 *     // touch is supported
 * }
 */
var platform = {
    /**
     * @static
     * @readonly
     * @type {boolean}
     * @name platform.desktop
     * @description Is it a desktop or laptop device.
     */
    desktop: false,

    /**
     * @static
     * @readonly
     * @type {boolean}
     * @name platform.mobile
     * @description Is it a mobile or tablet device.
     */
    mobile: false,

    /**
     * @static
     * @readonly
     * @type {boolean}
     * @name platform.ios
     * @description If it is iOS.
     */
    ios: false,

    /**
     * @static
     * @readonly
     * @type {boolean}
     * @name platform.android
     * @description If it is Android.
     */
    android: false,

    /**
     * @static
     * @readonly
     * @type {boolean}
     * @name platform.windows
     * @description If it is Windows.
     */
    windows: false,

    /**
     * @static
     * @readonly
     * @type {boolean}
     * @name platform.xbox
     * @description If it is Xbox.
     */
    xbox: false,

    /**
     * @static
     * @readonly
     * @type {boolean}
     * @name platform.gamepads
     * @description If platform supports gamepads.
     */
    gamepads: false,

    /**
     * @static
     * @readonly
     * @type {boolean}
     * @name platform.touch
     * @description If platform supports touch input.
     */
    touch: false,

    /**
     * @static
     * @readonly
     * @type {boolean}
     * @name platform.workers
     * @description If the platform supports Web Workers.
     */
    workers: false,

    /**
     * @private
     * @static
     * @readonly
     * @type {boolean}
     * @name platform.passiveEvents
     * @description If the platform supports an options object as the third parameter
     * to `EventTarget.addEventListener()` and the passive property is supported.
     */
    passiveEvents: false
};

if (typeof navigator !== 'undefined') {
    var ua = navigator.userAgent;

    if (/(windows|mac os|linux|cros)/i.test(ua))
        platform.desktop = true;

    if (/xbox/i.test(ua))
        platform.xbox = true;

    if (/(windows phone|iemobile|wpdesktop)/i.test(ua)) {
        platform.desktop = false;
        platform.mobile = true;
        platform.windows = true;
    } else if (/android/i.test(ua)) {
        platform.desktop = false;
        platform.mobile = true;
        platform.android = true;
    } else if (/ip([ao]d|hone)/i.test(ua)) {
        platform.desktop = false;
        platform.mobile = true;
        platform.ios = true;
    }

    if (typeof window !== 'undefined') {
        platform.touch = 'ontouchstart' in window || ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 0);
    }

    platform.gamepads = 'getGamepads' in navigator;

    platform.workers = (typeof(Worker) !== 'undefined');

    try {
        var opts = Object.defineProperty({}, 'passive', {
            get: function () {
                platform.passiveEvents = true;
                return false;
            }
        });
        window.addEventListener("testpassive", null, opts);
        window.removeEventListener("testpassive", null, opts);
    } catch (e) {}
}

export { platform };
