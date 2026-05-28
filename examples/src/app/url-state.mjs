import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';

const STATE_PARAM = 's';
const DEVICE_TYPES = new Set(['webgpu', 'webgpu:bare', 'webgl2', 'null']);
const STATE_KEY_SHORT = /** @type {const} */ ({ device: 'd', ui: 'u', controls: 'c' });
const STATE_KEY_LONG = /** @type {Record<string, string>} */ ({ d: 'device', u: 'ui', c: 'controls' });

/** @typedef {Record<string, any>} StateRecord */
/** @typedef {string | number | boolean | null | any[] | { [key: string]: any }} JsonValue */
/**
 * @typedef {object} AppState
 * @property {string} [device] - Selected device type.
 * @property {StateRecord} [ui] - UI state slice.
 * @property {StateRecord} [controls] - Example control overrides.
 */

/**
 * @param {() => any} task - Task to execute.
 * @returns {[any, any]} Error and result tuple.
 */
const tryCatch = (task) => {
    try {
        return [null, task()];
    } catch (err) {
        return [err, null];
    }
};

/**
 * @param {any} value - Value to check.
 * @returns {boolean} True if the value is a plain record.
 */
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * @param {string | null | undefined} value - Value to normalize.
 * @returns {string | undefined} Valid device type.
 */
const validDeviceType = value => (value && DEVICE_TYPES.has(value) ? value : undefined);

const hashParts = () => {
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
    const index = hash.indexOf('?');
    const query = index === -1 ? '' : hash.slice(index + 1);
    return {
        path: (index === -1 ? hash : hash.slice(0, index)) || '/',
        query,
        params: new URLSearchParams(query)
    };
};

/**
 * @param {string} path - Observer path.
 * @returns {boolean} True if the path should not be saved.
 */
const isVolatileControlPath = path => path === 'data.stats' || path.startsWith('data.stats.');

/**
 * @param {string} path - Observer path.
 * @returns {boolean} True if the path can be saved.
 */
const isPersistedControlPath = path => Boolean(path) && !path.startsWith('_') && !isVolatileControlPath(path);

/**
 * @param {any} a - First value.
 * @param {any} b - Second value.
 * @returns {boolean} True if the values match.
 */
const valuesEqual = (a, b) => {
    if (Object.is(a, b)) {
        return true;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            return false;
        }
        for (let i = 0; i < a.length; i++) {
            if (!valuesEqual(a[i], b[i])) {
                return false;
            }
        }
        return true;
    }
    if (isRecord(a) && isRecord(b)) {
        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);
        if (aKeys.length !== bKeys.length) {
            return false;
        }
        for (const key of aKeys) {
            if (!valuesEqual(a[key], b[key])) {
                return false;
            }
        }
        return true;
    }
    return false;
};

/**
 * @param {any} value - Value to sanitize.
 * @param {string} [path] - Observer path.
 * @returns {JsonValue | undefined} JSON-safe value, or undefined if not persistable.
 */
const sanitizeControlValue = (value, path = '') => {
    if (path && !isPersistedControlPath(path)) {
        return undefined;
    }
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : undefined;
    }
    if (Array.isArray(value)) {
        return value.map((item, i) => {
            const result = sanitizeControlValue(item, path ? `${path}.${i}` : `${i}`);
            return result === undefined ? null : result;
        });
    }
    if (isRecord(value)) {
        /** @type {{ [key: string]: JsonValue }} */
        const result = {};
        for (const key of Object.keys(value)) {
            const next = path ? `${path}.${key}` : key;
            const item = sanitizeControlValue(value[key], next);
            if (item !== undefined) {
                result[key] = item;
            }
        }
        return result;
    }
    return undefined;
};

/**
 * @param {Uint8Array} bytes - Bytes to encode.
 * @returns {string} URL-safe base64 (no padding).
 */
const bytesToB64Url = (bytes) => {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/[=]+$/, '');
};

/**
 * @param {string} s - URL-safe base64 string.
 * @returns {Uint8Array} Decoded bytes.
 */
const b64UrlToBytes = (s) => {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
};

const initial = hashParts();
const initialRaw = initial.params.get(STATE_PARAM);

/**
 * Payload: deflate(JSON), base64url. Top-level keys are shortened to single
 * letters (device→d, ui→u, controls→c) to shave a few bytes before deflate.
 *
 * @param {string | null} raw - Encoded state from URL.
 * @returns {AppState} Decoded app state (empty if missing or malformed).
 */
const decodeState = (raw) => {
    if (!raw) return {};
    const [err, value] = tryCatch(() => {
        const json = strFromU8(inflateSync(b64UrlToBytes(raw)));
        const parsed = JSON.parse(json);
        if (!isRecord(parsed)) return null;
        /** @type {AppState} */
        const out = {};
        for (const key of Object.keys(parsed)) {
            const long = STATE_KEY_LONG[key] ?? key;
            out[/** @type {keyof AppState} */ (long)] = parsed[key];
        }
        return out;
    });
    return err || !value ? {} : value;
};

/** @type {AppState} */
const pendingState = decodeState(initialRaw);
let currentPath = initial.path;

const encodeState = () => {
    /** @type {Record<string, any>} */
    const trimmed = {};
    if (pendingState.device) trimmed[STATE_KEY_SHORT.device] = pendingState.device;
    if (pendingState.ui && Object.keys(pendingState.ui).length) trimmed[STATE_KEY_SHORT.ui] = pendingState.ui;
    if (pendingState.controls && Object.keys(pendingState.controls).length) trimmed[STATE_KEY_SHORT.controls] = pendingState.controls;
    if (!Object.keys(trimmed).length) return '';
    const [err, encoded] = tryCatch(() => bytesToB64Url(deflateSync(strToU8(JSON.stringify(trimmed)))));
    return err ? '' : encoded;
};

/**
 * On example change (react-router pushState), drop the controls slice — it was
 * scoped to the previous example. Keep ui + device because those are global.
 */
const syncPath = () => {
    const { path } = hashParts();
    if (path !== currentPath) {
        currentPath = path;
        pendingState.controls = {};
    }
};

export const getHashPath = () => hashParts().path;

/**
 * @returns {AppState} Current in-memory app state.
 */
export const readState = () => {
    syncPath();
    return pendingState;
};

/**
 * Shallow-merge a state slice into the in-memory state. Does NOT write the URL —
 * the URL only gets built on demand by `buildShareUrl()`. Components call this
 * as they always have so the share button has fresh data when clicked.
 *
 * @param {AppState} patch - State patch.
 */
export const patchState = (patch) => {
    syncPath();
    if (patch.device !== undefined) {
        pendingState.device = patch.device;
    }
    if (patch.ui) {
        pendingState.ui = { ...(pendingState.ui ?? {}), ...patch.ui };
    }
    if (patch.controls !== undefined) {
        pendingState.controls = patch.controls;
    }
};

/**
 * Build a full shareable URL for the current example reflecting the current
 * in-memory state. Targets `/share/<category>_<example>/?s=...` so the
 * crawler-friendly share page provides social-unfurl meta tags; that page
 * uses history.replaceState to swap to the canonical `#/<path>?s=...` URL
 * before the SPA boots, so the recipient lands on the normal examples
 * browser. Falls back to the canonical hash URL on the index route.
 *
 * @returns {string} Shareable URL.
 */
export const buildShareUrl = () => {
    const { path } = hashParts();
    const encoded = encodeState();
    const origin = window.location.origin;
    const trimmed = path.replace(/^\//, '');
    if (!trimmed) {
        return encoded ? `${origin}/#/?${STATE_PARAM}=${encoded}` : `${origin}/`;
    }
    const slug = trimmed.replace(/\//g, '_');
    const base = `${origin}/share/${slug}/`;
    return encoded ? `${base}?${STATE_PARAM}=${encoded}` : base;
};

/**
 * @param {string} key - UI key.
 * @returns {any} UI value or undefined.
 */
export const readUi = key => readState().ui?.[key];

/**
 * Seeds `window.preferredGraphicsDevice` from the URL on first paint so the
 * iframe boots with the right device without an extra reload.
 */
export const applyInitialDeviceType = () => {
    const device = validDeviceType(pendingState.device);
    if (!device) return;
    window.preferredGraphicsDevice = device;
    localStorage.setItem('preferredGraphicsDevice', device);
};

/**
 * @param {Record<string, string>} files - Example files.
 * @param {string} [fallback] - Fallback selected file.
 * @returns {string} Selected file.
 */
export const getSelectedFile = (files, fallback = 'example.mjs') => {
    const defaultFile = files[fallback] ? fallback : Object.keys(files)[0] ?? fallback;
    const selected = readUi('selectedFile');
    if (typeof selected === 'string' && files[selected]) {
        return selected;
    }
    return defaultFile;
};

export { isVolatileControlPath, isRecord, valuesEqual, sanitizeControlValue };
