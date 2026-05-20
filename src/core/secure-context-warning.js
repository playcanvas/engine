import { Debug } from './debug.js';

/**
 * Warn once if the current page is not a secure context. Browsers treat
 * localhost / 127.0.0.1 / ::1 as secure even over http, so this only fires
 * on LAN/IP origins served over plain http.
 *
 * @param {string} feature - Feature name (e.g. 'WebGPU', 'WebXR').
 * @ignore
 */
const warnInsecureContext = (feature) => {
    if (typeof window === 'undefined') return;
    if (window.isSecureContext) return;
    Debug.warnOnce(
        `${feature} requires a secure context (HTTPS or localhost). ` +
        `The page is served over an insecure origin; ${feature} will be unavailable.`
    );
};

export { warnInsecureContext };
