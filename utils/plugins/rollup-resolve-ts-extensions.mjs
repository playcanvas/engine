import { existsSync } from 'fs';
import { dirname, resolve } from 'path';

/**
 * Rollup plugin to resolve .js imports to .ts files
 * This allows TypeScript files to be imported with .js extensions
 *
 * @returns {import('rollup').Plugin} - The Rollup plugin.
 */
export function resolveTsExtensions() {
    return {
        name: 'resolve-ts-extensions',
        resolveId(source, importer) {
            // Only handle relative imports that end with .js
            if (!source.startsWith('.') || !source.endsWith('.js')) {
                return null;
            }

            if (!importer) {
                return null;
            }

            // Resolve the full path
            const importerDir = dirname(importer);
            const fullPath = resolve(importerDir, source);

            // Try replacing .js with .ts
            const tsPath = fullPath.replace(/\.js$/, '.ts');

            if (existsSync(tsPath)) {
                return tsPath;
            }

            // Let other plugins handle it
            return null;
        }
    };
}
