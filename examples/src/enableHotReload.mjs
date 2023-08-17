/**
 * @example
 * enableHotReload({ loadScript, loadAsset });
 * @param {object} obj - Everything to be accessible for hot reloading the example function.
 */
export function enableHotReload(obj) {
    Object.assign(globalThis, obj);
}
