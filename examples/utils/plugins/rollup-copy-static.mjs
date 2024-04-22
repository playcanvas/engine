import fs from 'fs';
import fse from 'fs-extra';

// custom plugins
import { watch } from '../rollup-watch.mjs';

/**
 * This plugin copies static files from source to destination.
 *
 * @param {string} nodeEnv - The node environment.
 * @param {{ src: string, dest: string }[]} targets - Array of source and destination objects.
 * @returns {import('rollup').Plugin} The plugin.
 */
export function copyStatic(nodeEnv, targets) {
    return {
        name: 'copy-static',
        load() {
            return 'console.log("This temp file is created when copying static files, it should be removed during the build process.");';
        },
        buildStart() {
            if (nodeEnv === 'development') {
                targets.forEach((target) => {
                    watch(this, target.src);
                });
            }
        },
        generateBundle() {
            targets.forEach((target) => {
                fse.copySync(target.src, target.dest, { overwrite: true });
            });
        },
        writeBundle() {
            fs.unlinkSync('dist/copy.tmp');
        }
    };
}
