import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// The JoltPhysics.js build shipped with the examples doubles as the build the physics tests run
// against. It lives outside the test tree, so suites skip themselves when it is absent.
const JOLT_PATH = resolve('examples/assets/wasm/jolt/jolt-physics.wasm.js');

/**
 * Whether the Jolt build the physics tests run against is present.
 *
 * @returns {boolean} True when the build exists.
 */
function hasJolt() {
    return existsSync(JOLT_PATH);
}

/**
 * Loads the Jolt build headlessly and resolves with the initialized module. The build is an ES
 * module that reads its wasm binary from beside it.
 *
 * @returns {Promise<object>} The Jolt module.
 */
async function loadJolt() {
    const { default: initJolt } = await import(pathToFileURL(JOLT_PATH).href);
    return initJolt();
}

export { JOLT_PATH, hasJolt, loadJolt };
