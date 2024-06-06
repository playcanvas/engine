import fse from 'fs-extra';

// custom plugins
import { watch } from '../rollup-watch.mjs';

const YELLOW_OUT = '\x1b[33m';
const BOLD_OUT = `\x1b[1m`;
const REGULAR_OUT = `\x1b[22m`;

const copied = new Set();

/**
 * This plugin copies static files from source to destination.
 *
 * @param {string} nodeEnv - The node environment.
 * @param {object[]} targets - Array of source and destination objects.
 * @param {string} targets.src - File or entire dir.
 * @param {string} targets.dest - File or entire dir, usually into `dist/`.
 * @param {boolean} [targets.once] - Copy files only once for speed-up (external libs).
 * @param {boolean} log - Log the copy status.
 * @returns {import('rollup').Plugin} The plugin.
 */
export function copyStatic(nodeEnv, targets, log = false) {
    return {
        name: 'copy-static',
        load() {
            return 'console.log(\'UNUSED ROLLUP OUTPUT FILE\');';
        },
        buildStart() {
            if (nodeEnv === 'development') {
                targets.forEach((target) => {
                    watch(this, target.src);
                });
            }
        },
        buildEnd() {
            for (let i = 0; i < targets.length; i++) {
                const target = targets[i];
                if (target.once && copied.has(target.src)) {
                    if (log) {
                        console.log(`${YELLOW_OUT}skipped copying ${BOLD_OUT}${target.src}${REGULAR_OUT}`);
                    }
                    continue;
                }
                fse.copySync(target.src, target.dest, { overwrite: true });
            }
        }
    };
}
