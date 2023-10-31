const href = location.href;

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
    return href.substring(0, i) + "/examples/assets/";
}
var assetPath = getAssetPath();

/**
 * @example
 * http://127.0.0.1/playcanvas-engine/examples/../build/playcanvas.d.ts
 * @returns {string}
 */
function getPlayCanvasTypes() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/playcanvas.d.ts';
    }
    return href.substring(0, i) + "/build/playcanvas.d.ts";
}
var pcTypes = getPlayCanvasTypes();

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
    return href.substring(0, i) + "/scripts/";
}
var scriptsPath = getScriptsPath();

/**
 * @example
 * console.log(getIframePath());
 * // Outputs: http://127.0.0.1/playcanvas-engine/examples/src/iframe/
 * @returns {string}
 */
function getIframePath() {
    const i = href.indexOf("/examples/")
    if (i === -1) { // npm run serve
        return '/iframe/';
    }
    return href.substring(0, i) + "/examples/src/iframe/";
}
var iframePath = getIframePath();

/**
 * @example
 * console.log(getAmmoPath());
 * // Outputs: "http://127.0.0.1/playcanvas-engine/examples/src/lib/ammo/";
 * @returns {string}
 */
function getAmmoPath() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/static/lib/ammo/';
    }
    return href.substring(0, i) + "/examples/src/lib/ammo/";
}
var ammoPath = getAmmoPath();

/**
 * @example
 * console.log(getBasisPath());
 * // Outputs: "http://127.0.0.1/playcanvas-engine/examples/src/lib/basis/";
 * @returns {string}
 */
function getBasisPath() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/static/lib/basis/';
    }
    return href.substring(0, i) + "/examples/src/lib/basis/";
}
var basisPath = getBasisPath();

/**
 * @example
 * console.log(getDracoPath());
 * // Outputs: 'http://127.0.0.1/playcanvas-engine/examples/src/lib/draco/'
 * @returns {string}
 */
function getDracoPath() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/static/lib/draco/';
    }
    return href.substring(0, i) + "/examples/src/lib/draco/";
}
var dracoPath = getDracoPath();

/**
 * @example
 * console.log(getDracoPath());
 * // Outputs: 'http://127.0.0.1/playcanvas-engine/examples/src/lib/glslang/'
 * @returns {string}
 */
function getGlslangPath() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/static/lib/glslang/';
    }
    return href.substring(0, i) + "/examples/src/lib/glslang/";
}
var glslangPath = getGlslangPath();

/**
 * @example
 * console.log(getDracoPath());
 * // Outputs: 'http://127.0.0.1/playcanvas-engine/examples/src/lib/twgsl/'
 * @returns {string}
 */
function getTwgslPath() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/static/lib/twgsl/';
    }
    return href.substring(0, i) + "/examples/src/lib/twgsl/";
}
var twgslPath = getTwgslPath();

/**
 * @example
 * console.log(getIframePath());
 * // Outputs: http://127.0.0.1/playcanvas-engine/examples/src/iframe/
 * @returns {string}
 */
function getThumbnailPath() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/thumbnails/';
    }
    return href.substring(0, i) + "/examples/dist/thumbnails/";
}
var thumbnailPath = getThumbnailPath();
