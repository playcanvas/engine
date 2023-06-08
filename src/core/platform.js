const detectPassiveEvents = () => {
    let passiveEvents = false;

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

    return passiveEvents;
};

const ua = (typeof navigator !== 'undefined') ? navigator.userAgent : '';
const environment = (typeof window !== 'undefined') ? 'browser' : 'node';
const xbox = /xbox/i.test(ua);
const windows = /(windows phone|iemobile|wpdesktop)/i.test(ua);
const android = /android/i.test(ua);
const ios = /ip([ao]d|hone)/i.test(ua);
const desktop = /(windows|mac os|linux|cros)/i.test(ua) && !windows && !android && !ios;
const mobile = windows || android || ios;
const touch = environment === 'browser' && ('ontouchstart' in window || ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 0));
const gamepads = !!navigator.getGamepads || !!navigator.webkitGetGamepads;
const workers = (typeof Worker !== 'undefined');
const passiveEvents = detectPassiveEvents();

// browser detection
const chrome = /(Chrome\/|Chromium\/|Edg.*\/)/.test(ua);        // chrome, chromium, edge
const safari = !chrome && /Safari\//.test(ua);                  // safari, chrome on ios
const firefox = !chrome && !safari && /Firefox\//.test(ua);
const browserName = (environment === 'browser') ? ((chrome && 'chrome') || (safari && 'safari') || (firefox && 'firefox') || 'other') : null;

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
     * If it is Windows mobile.
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
    passiveEvents: passiveEvents,

    /**
     * Get the browser name.
     * @type {'chrome' | 'safari' | 'firefox' | 'other' | null}
     * @ignore
     */
    browserName: browserName
};

export { platform };
