const href = typeof location !== 'undefined' ? location.href : '';

/**
 * Motivation is to not hardcode asset paths and change it quickly all at once.
 * @example
 * const assetPath = getAssetPath(); // 'http://127.0.0.1/playcanvas-engine/examples/assets/'
 * // Test output for href:
 * // http://127.0.0.1/playcanvas-engine/examples/src/examples/animation/test-examples.html
 * @returns {string}
 */
function getAssetPath() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/static/assets/';
    }
    const assetPath = href.substring(0, i) + "/examples/assets/";
    return assetPath;
}
export const assetPath = getAssetPath();

/**
 * @example
 * http://127.0.0.1/playcanvas-engine/examples/../build/playcanvas.d.ts
 * @returns {string}
 */
function getPlayCanvasTypes() {
    const i = href.lastIndexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/playcanvas.d.ts';
    }
    const assetPath = href.substring(0, i) + "/build/playcanvas.d.ts";
    return assetPath;
}
export const pcTypes = getPlayCanvasTypes();

/**
 * @example
 * console.log(getScriptsPath());
 * // Outputs: 'http://127.0.0.1/playcanvas-engine/scripts/'
 * @returns {string}
 */
function getScriptsPath() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/static/scripts/';
    }
    const assetPath = href.substring(0, i) + "/scripts/";
    return assetPath;
}
export const scriptsPath = getScriptsPath();

/**
 * @example
 * console.log(getIframePath());
 * // Outputs: http://127.0.0.1/playcanvas-engine/examples/src/iframe/
 * @returns {string}
 */
function getIframePath() {
    //const i = href.lastIndexOf("/src/");
    //const assetPath = href.substring(0, i) + "/src/iframe/";
    const i = href.indexOf("/examples/")
    if (i === -1) { // npm run serve
        return '/iframe/';
    }
    return href.substring(0, i) + "/examples/src/iframe/";
}
export const iframePath = getIframePath();

/**
 * @example
 * console.log(getAmmoPath());
 * // Outputs: "http://127.0.0.1/playcanvas-engine/examples/src/lib/ammo/";
 * @returns {string}
 */
function getAmmoPath() {
    const i = href.lastIndexOf("/src/");
    const assetPath = href.substring(0, i) + "/src/lib/ammo/";
    return assetPath;
}
export const ammoPath = getAmmoPath();

/**
 * @example
 * console.log(getBasisPath());
 * // Outputs: "http://127.0.0.1/playcanvas-engine/examples/src/lib/basis/";
 * @returns {string}
 */
function getBasisPath() {
    const i = href.lastIndexOf("/src/");
    return href.substring(0, i) + "/src/lib/basis/";
}
export const basisPath = getBasisPath();

/**
 * @example
 * console.log(getDracoPath());
 * // Outputs: 'http://127.0.0.1/playcanvas-engine/examples/src/lib/draco/'
 * @returns {string}
 */
function getDracoPath() {
    const i = href.indexOf("/examples/");
    const assetPath = href.substring(0, i) + "/examples/src/lib/draco/";
    return assetPath;
}
export const dracoPath = getDracoPath();

/**
 * @example
 * console.log(getDracoPath());
 * // Outputs: 'http://127.0.0.1/playcanvas-engine/examples/src/lib/glslang/'
 * @returns {string}
 */
function getGlslangPath() {
    const i = href.indexOf("/examples/");
    return href.substring(0, i) + "/examples/src/lib/glslang/";
}
export const glslangPath = getGlslangPath();

/**
 * @example
 * console.log(getDracoPath());
 * // Outputs: 'http://127.0.0.1/playcanvas-engine/examples/src/lib/twgsl/'
 * @returns {string}
 */
function getTwgslPath() {
    const i = href.indexOf("/examples/");
    return href.substring(0, i) + "/examples/src/lib/twgsl/";
}
export const twgslPath = getTwgslPath();

/**
 * @example
 * console.log(getIframePath());
 * // Outputs: http://127.0.0.1/playcanvas-engine/examples/src/iframe/
 * @returns {string}
 */
function getThumbnailPath() {
    //const i = href.lastIndexOf("/src/");
    //const assetPath = href.substring(0, i) + "/src/iframe/";
    const i = href.lastIndexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/thumbnails/';
    }
    return href.substring(0, i) + "/examples/dist/thumbnails/";
}
export const thumbnailPath = getThumbnailPath();
