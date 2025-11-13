import path from 'path';
import { copyFile, mkdir } from 'fs/promises';

const copy = (options) => {
    const {
        // an array of files to copy
        files = [],
        // a directory to copy to
        dest = '',
        // whether to log the copied files
        verbose = false
    } = options;

    return {
        name: 'copy',
        async generateBundle(outputOptions, bundle) {
            const projectRoot = process.cwd();
            const destDir = path.resolve(projectRoot, dest);

            // security: ensure the destination directory is within the project root
            if (path.relative(projectRoot, destDir).startsWith('..')) {
                this.error(`rollup-copy: Destination directory ${destDir} is outside of the project root ${projectRoot}.`);
                return;
            }

            for (const file of files) {
                const fileName = path.basename(file);
                const destFile = path.join(destDir, fileName);

                // security: ensure the final file path is within the destination directory
                if (path.relative(destDir, destFile).startsWith('..')) {
                    this.error(`rollup-copy: Invalid file name, results in path traversal: ${fileName}`);
                    continue;
                }

                if (verbose) {
                    // log the relative path for cleaner output
                    console.log(`copy: ${file} -> ${path.relative(projectRoot, destFile)}`);
                }
                try {
                    await mkdir(path.dirname(destFile), { recursive: true });
                    await copyFile(file, destFile);
                } catch (e) {
                    console.error(`copy: failed to copy ${file}: ${e}`);
                }
            }
        }
    };
};

export {
    copy
};
