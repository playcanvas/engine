import path from 'node:path';

/** @typedef {import('rollup').Plugin} Plugin */

/**
 * Validate and print warning if an engine module on a lower level imports module on a higher level
 *
 * @param {string} rootFile - The root file, typically `src/index.js`.
 * @param {boolean} enable - Enable or disable the plugin.
 * @returns {Plugin} The plugin.
 */
export function engineLayerImportValidation(rootFile, enable) {

    const folderLevels = {
        'core': 0,
        'platform': 1,
        'scene': 2,
        'framework': 3
    };

    let rootPath;

    return {
        name: 'engineLayerImportValidation',

        buildStart() {
            rootPath = path.parse(path.resolve(rootFile)).dir;
        },

        resolveId(imported, importer) {
            if (enable) {

                // skip non-relative paths, those are not our imports, for example 'rollupPluginBabelHelpers.js'
                if (importer && imported && imported.includes('./')) {

                    // convert importer path
                    const importerDir = path.parse(importer).dir;
                    const relImporter = path.dirname(path.relative(rootPath, importer));
                    const folderImporter = relImporter.split(path.sep)[0];
                    const levelImporter = folderLevels[folderImporter];

                    // convert imported path
                    const absImported = path.resolve(path.join(importerDir, imported));
                    const relImported = path.dirname(path.relative(rootPath, absImported));
                    const folderImported = relImported.split(path.sep)[0];
                    const levelImported = folderLevels[folderImported];

                    if (levelImporter < levelImported) {
                        console.log(`(!) Incorrect import: [${path.relative(rootPath, importer)}] -> [${imported}]`);
                    }
                }
            }

            // we don't process imports, return null to allow chaining
            return null;
        }
    };
}
