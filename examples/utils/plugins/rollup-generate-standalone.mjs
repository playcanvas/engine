import { execSync } from 'child_process';

// custom plugins
import { watch } from '../rollup-watch.mjs';

const GREEN_OUT = '\x1b[32m';

/**
 * This plugin builds the standalone html files.
 *
 * @param {string} nodeEnv - The node environment.
 * @param {string} enginePath - The path to the engine.
 * @param {string} rti - Whether to activate RuntimeTypeInspector.
 * @returns {import('rollup').Plugin} The plugin.
 */
export function generateStandalone(nodeEnv, enginePath, rti) {
    return {
        name: 'generate-standalone',
        buildStart() {
            if (nodeEnv === 'development') {
                watch(this, 'iframe/example.html');
                watch(this, 'scripts/standalone-html.mjs');
                watch(this, 'src/examples');
            }
        },
        buildEnd() {
            const cmd = `cross-env NODE_ENV=${nodeEnv} ENGINE_PATH=${enginePath} RTI=${rti} node ./scripts/standalone-html.mjs`;
            console.log(`${GREEN_OUT}${cmd}`);
            execSync(cmd);
        }
    };
}
