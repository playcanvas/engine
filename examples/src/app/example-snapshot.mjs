/**
 * Pull-accessor bridge so the share dialog can read the current example's source
 * and route at click time without lifting the hot `files` state into a shared store.
 *
 * @typedef {object} ExampleSnapshot
 * @property {Record<string, string>} files - Current (possibly edited) source buffers.
 * @property {string} category - Kebab category.
 * @property {string} example - Kebab example name.
 * @property {object} data - The example's current control state (flattened dot-path values).
 * @property {{ title: string, author: string, source?: string, license?: string }[]} credits - Parsed @credit attribution.
 */

/** @type {(() => ExampleSnapshot) | null} */
let provider = null;

/**
 * @param {(() => ExampleSnapshot) | null} fn - Snapshot accessor, or null to clear.
 */
export const setExampleSnapshotProvider = (fn) => {
    provider = fn;
};

/**
 * @returns {ExampleSnapshot | null} Current example snapshot, or null if none mounted.
 */
export const getExampleSnapshot = () => (provider ? provider() : null);
