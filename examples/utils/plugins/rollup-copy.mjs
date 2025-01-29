import fs from 'fs';
import path from 'path';

import fse from 'fs-extra';

/** @import { Plugin, PluginContext } from 'rollup' */

const copied = new Set();


/**
 * @param {PluginContext} context - The Rollup plugin context.
 * @param {string} src - File or path to watch.
 */
const addWatch = (context, src) => {
    const srcStats = fs.statSync(src);
    if (srcStats.isFile()) {
        context.addWatchFile(path.resolve('.', src));
        return;
    }
    const filesToWatch = fs.readdirSync(src);
    for (const file of filesToWatch) {
        const fullPath = path.join(src, file);
        const stats = fs.statSync(fullPath);
        if (stats.isFile()) {
            context.addWatchFile(path.resolve('.', fullPath));
        } else if (stats.isDirectory()) {
            addWatch(context, fullPath);
        }
    }
};

/**
 * This plugin copies static files from source to destination.
 *
 * @param {object[]} targets - Array of source and destination objects.
 * @param {string} targets.src - File or entire dir.
 * @param {string} targets.dest - File or entire dir, usually into `dist/`.
 * @param {boolean} [targets.once] - Copy files only once for speed-up (external libs).
 * @param {boolean} watch - Watch the files.
 * @returns {Plugin} The plugin.
 */
export function copy(targets, watch = false) {
    return {
        name: 'copy',
        load() {
            return '';
        },
        buildStart() {
            if (watch) {
                for (let i = 0; i < targets.length; i++) {
                    const target = targets[i];
                    addWatch(this, target.src);
                }
            }
        },
        buildEnd() {
            for (let i = 0; i < targets.length; i++) {
                const target = targets[i];
                if (target.once && copied.has(target.src)) {
                    continue;
                }
                fse.copySync(target.src, target.dest, { overwrite: true });
            }
        }
    };
}
