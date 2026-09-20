import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

// The Ammo.js build shipped with the examples doubles as the build the physics tests run against.
// It lives outside the test tree, so suites skip themselves when it is absent.
const AMMO_PATH = resolve('examples/assets/wasm/ammo/ammo.js');

/**
 * Whether the Ammo.js build the physics tests run against is present.
 *
 * @returns {boolean} True when the build exists.
 */
function hasAmmo() {
    return existsSync(AMMO_PATH);
}

/**
 * Loads the asm.js Ammo build headlessly and resolves with the initialized module.
 *
 * @returns {Promise<object>} The Ammo module.
 */
function loadAmmo() {
    // the build is a UMD script that cannot be imported from an ES module package, so it is
    // evaluated as a CommonJS module body with the globals its Node code path expects
    const source = readFileSync(AMMO_PATH, 'utf8');
    const module = { exports: {} };
    // eslint-disable-next-line no-new-func
    const evaluate = new Function('module', 'exports', 'require', '__dirname', '__filename', source);
    evaluate(module, module.exports, createRequire(import.meta.url), dirname(AMMO_PATH), AMMO_PATH);
    return module.exports();
}

export { AMMO_PATH, hasAmmo, loadAmmo };
