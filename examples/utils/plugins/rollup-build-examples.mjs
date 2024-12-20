// custom plugins
import { build } from '../../scripts/build-examples.mjs';
import { watch } from '../rollup-watch.mjs';

const GREEN_OUT = '\x1b[32m';
const BOLD_OUT = '\x1b[1m';
const REGULAR_OUT = '\x1b[22m';

/**
 * This plugin builds the standalone html files.
 *
 * @param {string} nodeEnv - The node environment.
 * @param {string} enginePath - The path to the engine.
 * @param {string} rti - Whether to activate RuntimeTypeInspector.
 * @returns {import('rollup').Plugin} The plugin.
 */
export function buildExamples(nodeEnv, enginePath, rti) {
    return {
        name: 'build-examples',
        buildStart() {
            if (nodeEnv === 'development') {
                watch(this, 'iframe/example.html');
                watch(this, 'scripts/build-examples.mjs');
                watch(this, 'src/examples');
            }
        },
        buildEnd() {
            build({ NODE_ENV: nodeEnv, ENGINE_PATH: enginePath, RTI: rti });
            console.log(`${GREEN_OUT}built examples using NODE_ENV=${BOLD_OUT}${nodeEnv}${REGULAR_OUT} ENGINE_PATH=${BOLD_OUT}${enginePath}${REGULAR_OUT} RTI=${BOLD_OUT}${rti}${REGULAR_OUT}`);
        }
    };
}
