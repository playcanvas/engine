/**
 * Motivation is to not hardcode asset paths and change it quickly all at once.
 * @example
 * const assetPath = getAssetPath(); // 'http://127.0.0.1/playcanvas-engine/examples/assets/'
 * // Test output for href:
 * // http://127.0.0.1/playcanvas-engine/examples/src/examples/animation/test-examples.html
 * @returns {string}
 */
export function getAssetPath() {
    const { href } = location;
    const i = href.lastIndexOf("/src/");
    const assetPath = href.substring(0, i) + "/assets/";
    return assetPath;
}
export const assetPath = getAssetPath();
/**
 * @example
 * http://127.0.0.1/playcanvas-engine/examples/../build/playcanvas.d.ts
 * @returns {string}
 */
export function getPlayCanvasTypes() {
    const { href } = location;
    const i = href.lastIndexOf("/src/");
    const assetPath = href.substring(0, i) + "/../build/playcanvas.d.ts";
    return assetPath;
}
export const pcTypes = getPlayCanvasTypes();
/**
 * @example
 * console.log(getScriptsPath());
 * // Outputs: 'http://127.0.0.1/playcanvas-engine/examples/../scripts/'
 * @returns {string}
 */
export function getScriptsPath() {
    const { href } = location;
    const i = href.lastIndexOf("/src/");
    const assetPath = href.substring(0, i) + "/../scripts/";
    return assetPath;
}
export const scriptsPath = getScriptsPath();
// todo
export const ammoPath = "http://127.0.0.1/playcanvas-engine/examples/src/lib/ammo/";
