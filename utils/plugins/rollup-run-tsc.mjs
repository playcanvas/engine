import fs from 'fs';
import path from 'path';
import { execSync } from 'node:child_process';

/** @import { Plugin, PluginContext } from 'rollup' */

const GREEN_OUT = '\x1b[32m';

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
 * Run TypeScript compiler (tsc) with the specified configuration file.
 *
 * @param {string} [config] - The path to the TypeScript configuration file.
 * @returns {Plugin} - The rollup plugin.
 */
export function runTsc(config = 'tsconfig.json') {
    if (!fs.existsSync(config)) {
        throw new Error(`tsconfig file does not exist: ${config}`);
    }
    return {
        name: 'run-tsc',
        buildStart() {
            addWatch(this, 'src');

            const cmd = `tsc --project ${config}`;
            console.log(`${GREEN_OUT}${cmd}`);
            execSync(cmd);
        }
    };
}
