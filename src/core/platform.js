let desktop = false;
let mobile = false;
let windows = false;
let xbox = false;
let android = false;
let ios = false;
let touch = false;
let gamepads = false;
let workers = false;
let passiveEvents = false;

if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent;

    if (/(windows|mac os|linux|cros)/i.test(ua))
        desktop = true;

    if (/xbox/i.test(ua))
        xbox = true;

    if (/(windows phone|iemobile|wpdesktop)/i.test(ua)) {
        desktop = false;
        mobile = true;
        windows = true;
    } else if (/android/i.test(ua)) {
        desktop = false;
        mobile = true;
        android = true;
    } else if (/ip([ao]d|hone)/i.test(ua)) {
        desktop = false;
        mobile = true;
        ios = true;
    }

    if (typeof window !== 'undefined') {
        touch = 'ontouchstart' in window || ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 0);
    }

    gamepads = !!navigator.getGamepads || !!navigator.webkitGetGamepads;

    workers = (typeof Worker !== 'undefined');

    try {
        const opts = Object.defineProperty({}, 'passive', {
            get: function () {
                passiveEvents = true;
                return false;
            }
        });
        window.addEventListener('testpassive', null, opts);
        window.removeEventListener('testpassive', null, opts);
    } catch (e) {}
}

// detect browser/node environment
const environment = (typeof window !== 'undefined') ? 'browser' : 'node';

/**
 * Global namespace that stores flags regarding platform environment and features support.
 *
 * @namespace
 * @example
 * if (pc.platform.touch) {
 *     // touch is supported
 * }
 */
const platform = {
    /**
     * String identifying the current runtime environment. Either 'browser' or 'node'.
     *
     * @type {string}
     */
    environment: environment,

    /**
     * The global object. This will be the window object when running in a browser and the global
     * object when running in nodejs.
     *
     * @type {object}
     */
    global: (environment === 'browser') ? window : global,

    /**
     * Convenience boolean indicating whether we're running in the browser.
     *
     * @type {boolean}
     */
    browser: environment === 'browser',

    /**
     * Is it a desktop or laptop device.
     *
     * @type {boolean}
     */
    desktop: desktop,

    /**
     * Is it a mobile or tablet device.
     *
     * @type {boolean}
     */
    mobile: mobile,

    /**
     * If it is iOS.
     *
     * @type {boolean}
     */
    ios: ios,

    /**
     * If it is Android.
     *
     * @type {boolean}
     */
    android: android,

    /**
     * If it is Windows.
     *
     * @type {boolean}
     */
    windows: windows,

    /**
     * If it is Xbox.
     *
     * @type {boolean}
     */
    xbox: xbox,

    /**
     * If platform supports gamepads.
     *
     * @type {boolean}
     */
    gamepads: gamepads,

    /**
     * If platform supports touch input.
     *
     * @type {boolean}
     */
    touch: touch,

    /**
     * If the platform supports Web Workers.
     *
     * @type {boolean}
     */
    workers: workers,

    /**
     * If the platform supports an options object as the third parameter to
     * `EventTarget.addEventListener()` and the passive property is supported.
     *
     * @type {boolean}
     * @ignore
     */
    passiveEvents: passiveEvents
};

export { platform };
