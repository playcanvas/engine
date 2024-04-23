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
 * @param {{ src: string, dest: string, once: boolean }[]} targets - Array of source and destination objects.
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
        async buildEnd() {
            await Promise.all(targets.map((target) => {
                if (target.once && copied.has(target.src)) {
                    if (log) {
                        console.log(`${YELLOW_OUT}skipped copying ${BOLD_OUT}${target.src}${REGULAR_OUT}`);
                    }
                    return null;
                }
                copied.add(target.src);
                return fse.copy(target.src, target.dest, { overwrite: true });
            }));
        }
    };
}
