import { Debug } from './debug.js';

/**
 * Warn once if the current page is not a secure context. Fires on any
 * insecure origin; browsers treat localhost / 127.0.0.1 / ::1 as secure
 * even over http, so those won't trigger it. No-ops outside the browser
 * and when `window.isSecureContext` is not explicitly `false` (older or
 * embedded runtimes may leave it undefined).
 *
 * @param {string} feature - Feature name (e.g. 'WebGPU', 'WebXR').
 * @ignore
 */
const warnInsecureContext = (feature) => {
    if (typeof window === 'undefined') return;
    if (window.isSecureContext !== false) return;
    Debug.warnOnce(
        `${feature} requires a secure context (HTTPS or localhost). ` +
        `The page is served over an insecure origin; ${feature} will be unavailable.`
    );
};

export { warnInsecureContext };
