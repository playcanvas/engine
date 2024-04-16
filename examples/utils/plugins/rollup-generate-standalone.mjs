import { execSync } from 'child_process';

// custom plugins
import { watch } from '../rollup-watch.mjs';

/**
 * This plugin builds the standalone html files.
 *
 * @param {string} nodeEnv - The node environment.
 * @param {string} enginePath - The path to the engine.
 * @returns {import('rollup').Plugin} The plugin.
 */
export function generateStandalone(nodeEnv, enginePath) {
    return {
        name: 'generate-standalone',
        buildStart() {
            if (nodeEnv === 'development') {
                watch(this, 'iframe/example.html');
                watch(this, 'scripts/standalone-html.mjs');
                watch(this, 'src/examples');
            }
        },
        generateBundle() {
            const cmd = `cross-env NODE_ENV=${nodeEnv} ENGINE_PATH=${enginePath} npm run build:standalone`;
            console.log("\x1b[32m%s\x1b[0m", cmd);
            execSync(cmd);
        }
    };
}
