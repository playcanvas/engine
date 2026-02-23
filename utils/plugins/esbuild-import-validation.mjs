import path from 'node:path';

/**
 * esbuild plugin that validates engine layer imports.
 * Warns when a lower-level module imports from a higher-level module.
 *
 * Hierarchy: core (0) → platform (1) → scene (2) → framework (3) → extras (4)
 *
 * Port of engineLayerImportValidation from rollup-import-validation.mjs.
 *
 * @param {string} rootFile - The root file, typically `src/index.js`.
 * @returns {import('esbuild').Plugin} The esbuild plugin.
 */
export function importValidationPlugin(rootFile) {
    const folderLevels = {
        'core': 0,
        'platform': 1,
        'scene': 2,
        'framework': 3,
        'extras': 4
    };

    const rootPath = path.parse(path.resolve(rootFile)).dir;

    return {
        name: 'import-validation',
        setup(build) {
            build.onResolve({ filter: /^\./ }, (args) => {
                if (!args.importer) return undefined;

                const importerDir = path.parse(args.importer).dir;
                const relImporter = path.dirname(path.relative(rootPath, args.importer));
                const folderImporter = relImporter.split(path.sep)[0];
                const levelImporter = folderLevels[folderImporter];

                const absImported = path.resolve(path.join(importerDir, args.path));
                const relImported = path.dirname(path.relative(rootPath, absImported));
                const folderImported = relImported.split(path.sep)[0];
                const levelImported = folderLevels[folderImported];

                if (levelImporter !== undefined && levelImported !== undefined && levelImporter < levelImported) {
                    console.log(`(!) Incorrect import: [${path.relative(rootPath, args.importer)}] -> [${args.path}]`);
                }

                return undefined;
            });
        }
    };
}
