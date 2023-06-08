// detect whether passive events are supported by the browser
const detectPassiveEvents = () => {
    let result = false;

    try {
        const opts = Object.defineProperty({}, 'passive', {
            get: function () {
                result = true;
                return false;
            }
        });
        window.addEventListener('testpassive', null, opts);
        window.removeEventListener('testpassive', null, opts);
    } catch (e) {}

    return result;
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
     * @type {'browser' | 'node'}
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
     * True if running on a desktop or laptop device.
     *
     * @type {boolean}
     */
    desktop: desktop,

    /**
     * True if running on a mobile or tablet device.
     *
     * @type {boolean}
     */
    mobile: mobile,

    /**
     * True if running on an iOS device.
     *
     * @type {boolean}
     */
    ios: ios,

    /**
     * True if running on an Android device.
     *
     * @type {boolean}
     */
    android: android,

    /**
     * True if running on a Windows mobile device.
     *
     * @type {boolean}
     */
    windows: windows,

    /**
     * True if running on an Xbox device.
     *
     * @type {boolean}
     */
    xbox: xbox,

    /**
     * True if the platform supports gamepads.
     *
     * @type {boolean}
     */
    gamepads: gamepads,

    /**
     * True if the supports touch input.
     *
     * @type {boolean}
     */
    touch: touch,

    /**
     * True if the platform supports Web Workers.
     *
     * @type {boolean}
     */
    workers: workers,

    /**
     * True if the platform supports an options object as the third parameter to
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
