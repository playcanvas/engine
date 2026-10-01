import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

// The Ammo.js builds shipped with the examples double as the builds the physics tests run against.
// They live outside the test tree, so suites skip themselves when they are absent. The physics
// suites use the asm.js build; the wasm glue and binary are exercised by the build smoke tests.
const AMMO_PATH = resolve('examples/assets/wasm/ammo/ammo.js');
const AMMO_WASM_PATH = resolve('examples/assets/wasm/ammo/ammo.wasm.js');
const AMMO_WASM_BINARY_PATH = resolve('examples/assets/wasm/ammo/ammo.wasm.wasm');

/**
 * Whether the asm.js Ammo build the physics tests run against is present.
 *
 * @returns {boolean} True when the build exists.
 */
function hasAmmo() {
    return existsSync(AMMO_PATH);
}

/**
 * Whether the wasm Ammo glue and binary are present.
 *
 * @returns {boolean} True when both files exist.
 */
function hasAmmoWasm() {
    return existsSync(AMMO_WASM_PATH) && existsSync(AMMO_WASM_BINARY_PATH);
}

/**
 * Evaluates an Ammo build headlessly and resolves with the initialized module.
 *
 * @param {string} path - The absolute path of the glue script.
 * @returns {Promise<object>} The Ammo module.
 */
function loadBuild(path) {
    // the build is a UMD script that cannot be imported from an ES module package, so it is
    // evaluated as a CommonJS module body with the globals its Node code path expects; the wasm
    // glue locates its binary next to the script through __dirname
    const source = readFileSync(path, 'utf8');
    const module = { exports: {} };
    // eslint-disable-next-line no-new-func
    const evaluate = new Function('module', 'exports', 'require', '__dirname', '__filename', source);
    evaluate(module, module.exports, createRequire(import.meta.url), dirname(path), path);
    return module.exports();
}

/**
 * Loads the asm.js Ammo build headlessly and resolves with the initialized module.
 *
 * @returns {Promise<object>} The Ammo module.
 */
function loadAmmo() {
    return loadBuild(AMMO_PATH);
}

/**
 * Loads the wasm Ammo glue, which instantiates the wasm binary beside it, and resolves with the
 * initialized module.
 *
 * @returns {Promise<object>} The Ammo module.
 */
function loadAmmoWasm() {
    return loadBuild(AMMO_WASM_PATH);
}

export { AMMO_PATH, AMMO_WASM_PATH, AMMO_WASM_BINARY_PATH, hasAmmo, hasAmmoWasm, loadAmmo, loadAmmoWasm };
