import fs from 'fs';
import path from 'path';

/**
 * @param {import('rollup').PluginContext} context - The Rollup plugin context.
 * @param {string} src - File or path to watch.
 */
export function watch(context, src) {
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
            watch(context, fullPath);
        }
    }
}
