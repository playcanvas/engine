import path from 'node:path';

const LEVELS = {
    core: 0,
    platform: 1,
    scene: 2,
    framework: 3,
    extras: 4
};

/**
 * @param {string} rootFile - The root file.
 * @returns {import('esbuild').Plugin} The esbuild plugin.
 */
const importValidationPlugin = (rootFile) => {
    const root = path.parse(path.resolve(rootFile)).dir;

    return {
        name: 'import-validation',
        setup(build) {
            build.onResolve({ filter: /^\./ }, (args) => {
                if (!args.importer) {
                    return undefined;
                }

                const importerDir = path.parse(args.importer).dir;
                const relImporter = path.dirname(path.relative(root, args.importer));
                const levelImporter = LEVELS[relImporter.split(path.sep)[0]];

                const imported = path.resolve(path.join(importerDir, args.path));
                const relImported = path.dirname(path.relative(root, imported));
                const levelImported = LEVELS[relImported.split(path.sep)[0]];

                if (levelImporter !== undefined && levelImported !== undefined && levelImporter < levelImported) {
                    console.log(`(!) Incorrect import: [${path.relative(root, args.importer)}] -> [${args.path}]`);
                }

                return undefined;
            });
        }
    };
};

export { importValidationPlugin };
