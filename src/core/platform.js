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
const environment = typeof window !== 'undefined' ? 'browser' :
    typeof global !== 'undefined' ? 'node' : 'worker';

// detect platform
const platformName =
    (/android/i.test(ua) ? 'android' :
        (/ip([ao]d|hone)/i.test(ua) ? 'ios' :
            (/windows/i.test(ua) ? 'windows' :
                (/mac os/i.test(ua) ? 'osx' :
                    (/linux/i.test(ua) ? 'linux' :
                        (/cros/i.test(ua) ? 'cros' : null))))));

// detect browser
const browserName =
    (environment !== 'browser') ? null :
        (/(Chrome\/|Chromium\/|Edg.*\/)/.test(ua) ? 'chrome' :  // chrome, chromium, edge
            (/Safari\//.test(ua) ? 'safari' :                   // safari, ios chrome/firefox
                (/Firefox\//.test(ua) ? 'firefox' :
                    'other')));

const xbox = /xbox/i.test(ua);
const touch = (environment === 'browser') && ('ontouchstart' in window || ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 0));
const gamepads = (environment === 'browser') && (!!navigator.getGamepads || !!navigator.webkitGetGamepads);
const workers = (typeof Worker !== 'undefined');
const passiveEvents = detectPassiveEvents();

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
     * String identifying the current platform. Can be one of: android, ios, windows, osx, linux,
     * cros or null.
     *
     * @type {'android' | 'ios' | 'windows' | 'osx' | 'linux' | 'cros' | null}
     * @ignore
     */
    name: platformName,

    /**
     * String identifying the current runtime environment. Either 'browser', 'node' or 'worker'.
     *
     * @type {'browser' | 'node' | 'worker'}
     */
    environment: environment,

    /**
     * The global object. This will be the window object when running in a browser and the global
     * object when running in nodejs and self when running in a worker.
     *
     * @type {object}
     */
    global: (typeof globalThis !== 'undefined' && globalThis) ??
        (environment === 'browser' && window) ??
        (environment === 'node' && global) ??
        (environment === 'worker' && self),

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
    desktop: ['windows', 'osx', 'linux', 'cros'].includes(platformName),

    /**
     * True if running on a mobile or tablet device.
     *
     * @type {boolean}
     */
    mobile: ['android', 'ios'].includes(platformName),

    /**
     * True if running on an iOS device.
     *
     * @type {boolean}
     */
    ios: platformName === 'ios',

    /**
     * True if running on an Android device.
     *
     * @type {boolean}
     */
    android: platformName === 'android',

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
     *
     * @type {'chrome' | 'safari' | 'firefox' | 'other' | null}
     * @ignore
     */
    browserName: browserName
};

export { platform };
