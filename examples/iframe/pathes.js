const href = location.href;

/**
 * Motivation is to not hardcode asset paths and change it quickly all at once.
 * @example
 * const assetPath = getAssetPath(); // 'http://127.0.0.1/playcanvas-engine/examples/assets/'
 * // Test output for href:
 * // http://127.0.0.1/playcanvas-engine/examples/src/examples/animation/test-examples.html
 * @returns {string} The path to assets.
 */
function getAssetPath() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/static/assets/';
    }
    return href.substring(0, i) + "/examples/assets/";
}
const assetPath = getAssetPath(); // eslint-disable-line @typescript-eslint/no-unused-vars

/**
 * @example
 * http://127.0.0.1/playcanvas-engine/examples/../build/playcanvas.d.ts
 * @returns {string} The path to playcanvas.d.ts.
 */
function getPlayCanvasTypes() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/playcanvas.d.ts';
    }
    return href.substring(0, i) + "/build/playcanvas.d.ts";
}
const pcTypes = getPlayCanvasTypes(); // eslint-disable-line @typescript-eslint/no-unused-vars

/**
 * @example
 * console.log(getScriptsPath());
 * // Outputs: 'http://127.0.0.1/playcanvas-engine/scripts/'
 * @returns {string} The path to scripts.
 */
function getScriptsPath() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/static/scripts/';
    }
    return href.substring(0, i) + "/scripts/";
}
const scriptsPath = getScriptsPath(); // eslint-disable-line @typescript-eslint/no-unused-vars

/**
 * @example
 * console.log(getIframePath());
 * // Outputs: http://127.0.0.1/playcanvas-engine/examples/src/iframe/
 * @returns {string} The path to iframe.
 */
function getIframePath() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/iframe/';
    }
    return href.substring(0, i) + "/examples/src/iframe/";
}
const iframePath = getIframePath(); // eslint-disable-line @typescript-eslint/no-unused-vars

/**
 * @example
 * console.log(getAmmoPath());
 * // Outputs: "http://127.0.0.1/playcanvas-engine/examples/src/lib/ammo/";
 * @returns {string} The path to ammo.
 */
function getAmmoPath() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/static/lib/ammo/';
    }
    return href.substring(0, i) + "/examples/src/lib/ammo/";
}
const ammoPath = getAmmoPath(); // eslint-disable-line @typescript-eslint/no-unused-vars

/**
 * @example
 * console.log(getBasisPath());
 * // Outputs: "http://127.0.0.1/playcanvas-engine/examples/src/lib/basis/";
 * @returns {string} The path to basis.
 */
function getBasisPath() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/static/lib/basis/';
    }
    return href.substring(0, i) + "/examples/src/lib/basis/";
}
const basisPath = getBasisPath(); // eslint-disable-line @typescript-eslint/no-unused-vars

/**
 * @example
 * console.log(getDracoPath());
 * // Outputs: 'http://127.0.0.1/playcanvas-engine/examples/src/lib/draco/'
 * @returns {string} The path to draco.
 */
function getDracoPath() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/static/lib/draco/';
    }
    return href.substring(0, i) + "/examples/src/lib/draco/";
}
const dracoPath = getDracoPath(); // eslint-disable-line @typescript-eslint/no-unused-vars

/**
 * @example
 * console.log(getDracoPath());
 * // Outputs: 'http://127.0.0.1/playcanvas-engine/examples/src/lib/glslang/'
 * @returns {string} The path to glslang.
 */
function getGlslangPath() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/static/lib/glslang/';
    }
    return href.substring(0, i) + "/examples/src/lib/glslang/";
}
const glslangPath = getGlslangPath(); // eslint-disable-line @typescript-eslint/no-unused-vars

/**
 * @example
 * console.log(getDracoPath());
 * // Outputs: 'http://127.0.0.1/playcanvas-engine/examples/src/lib/twgsl/'
 * @returns {string} The path to twgsl.
 */
function getTwgslPath() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/static/lib/twgsl/';
    }
    return href.substring(0, i) + "/examples/src/lib/twgsl/";
}
const twgslPath = getTwgslPath(); // eslint-disable-line @typescript-eslint/no-unused-vars

/**
 * @example
 * console.log(getIframePath());
 * // Outputs: http://127.0.0.1/playcanvas-engine/examples/src/iframe/
 * @returns {string} The path to iframe.
 */
function getThumbnailPath() {
    const i = href.indexOf("/examples/");
    if (i === -1) { // npm run serve
        return '/thumbnails/';
    }
    return href.substring(0, i) + "/examples/dist/thumbnails/";
}
const thumbnailPath = getThumbnailPath(); // eslint-disable-line @typescript-eslint/no-unused-vars
