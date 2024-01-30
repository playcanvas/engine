const href = typeof location !== 'undefined' ? location.href : '';

/**
 * Motivation is to not hardcode asset paths and change it quickly all at once.
 * @example
 * const assetPath = getAssetPath(); // 'http://127.0.0.1/playcanvas-engine/examples/assets/'
 * // Test output for href:
 * // http://127.0.0.1/playcanvas-engine/examples/src/examples/animation/test-examples.html
 * @returns {string} - The path.
 */
function getAssetPath() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/static/assets/';
    }
    return href.substring(0, i) + "/examples/assets/";
}
export const assetPath = getAssetPath();

/**
 * @example
 * http://127.0.0.1/playcanvas-engine/examples/../build/playcanvas.d.ts
 * @returns {string} - The path.
 */
function getPlayCanvasTypes() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/playcanvas.d.ts';
    }
    return href.substring(0, i) + "/build/playcanvas.d.ts";
}
export const pcTypes = getPlayCanvasTypes();

/**
 * @example
 * console.log(getScriptsPath());
 * // Outputs: 'http://127.0.0.1/playcanvas-engine/scripts/'
 * @returns {string} - The path.
 */
function getScriptsPath() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/static/scripts/';
    }
    return href.substring(0, i) + "/scripts/";
}
export const scriptsPath = getScriptsPath();

/**
 * @example
 * console.log(getIframePath());
 * // Outputs: http://127.0.0.1/playcanvas-engine/examples/src/iframe/
 * @returns {string} - The path.
 */
function getIframePath() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/iframe/';
    }
    return href.substring(0, i) + "/examples/dist/iframe/";
}
export const iframePath = getIframePath();

/**
 * @example
 * console.log(getAmmoPath());
 * // Outputs: "http://127.0.0.1/playcanvas-engine/examples/src/lib/ammo/";
 * @returns {string} - The path.
 */
function getAmmoPath() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/static/lib/ammo/';
    }
    return href.substring(0, i) + "/examples/src/lib/ammo/";
}
export const ammoPath = getAmmoPath();

/**
 * @example
 * console.log(getBasisPath());
 * // Outputs: "http://127.0.0.1/playcanvas-engine/examples/src/lib/basis/";
 * @returns {string} - The path.
 */
function getBasisPath() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/static/lib/basis/';
    }
    return href.substring(0, i) + "/examples/src/lib/basis/";
}
export const basisPath = getBasisPath();

/**
 * @example
 * console.log(getDracoPath());
 * // Outputs: 'http://127.0.0.1/playcanvas-engine/examples/src/lib/draco/'
 * @returns {string} - The path.
 */
function getDracoPath() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/static/lib/draco/';
    }
    return href.substring(0, i) + "/examples/src/lib/draco/";
}
export const dracoPath = getDracoPath();

/**
 * @example
 * console.log(getDracoPath());
 * // Outputs: 'http://127.0.0.1/playcanvas-engine/examples/src/lib/glslang/'
 * @returns {string} - The path.
 */
function getGlslangPath() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/static/lib/glslang/';
    }
    return href.substring(0, i) + "/examples/src/lib/glslang/";
}
export const glslangPath = getGlslangPath();

/**
 * @example
 * console.log(getDracoPath());
 * // Outputs: 'http://127.0.0.1/playcanvas-engine/examples/src/lib/twgsl/'
 * @returns {string} - The path.
 */
function getTwgslPath() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/static/lib/twgsl/';
    }
    return href.substring(0, i) + "/examples/src/lib/twgsl/";
}
export const twgslPath = getTwgslPath();

/**
 * @example
 * console.log(getIframePath());
 * // Outputs: http://127.0.0.1/playcanvas-engine/examples/src/iframe/
 * @returns {string} - The path.
 */
function getThumbnailPath() {
    const i = href.lastIndexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/thumbnails/';
    }
    return href.substring(0, i) + "/examples/dist/thumbnails/";
}
export const thumbnailPath = getThumbnailPath();

/**
 * @example
 * console.log(getLogo());
 * // Via app.html, outputs:
 * // 'http://127.0.0.1/playcanvas-engine/examples/src/static/playcanvas-logo.png'
 * // Via `npm run serve`, outputs: './playcanvas-logo.png'
 * @returns {string} URL of logo.
 */
function getLogo() {
    const i = href.lastIndexOf("/examples/");
    if (i === -1) { // npm run serve
        return './playcanvas-logo.png';
    }
    return href.substring(0, i) + "/examples/src/static/playcanvas-logo.png";
}
export const logo = getLogo();
