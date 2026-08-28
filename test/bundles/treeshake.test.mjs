import { fileURLToPath } from 'node:url';

import { expect } from 'chai';
import esbuild from 'esbuild';

// bundle a one-import app against the esm tree the way a consumer's bundler would. every module
// in the package is declared side-effect-free ("sideEffects": false in package.json), so pulling
// in a single class must not retain the wider engine. a module-scope side effect anywhere
// reachable from src/index.js (as the deprecated.js prototype patches once were) drags hundreds
// of KB into every consumer bundle and fails this canary.
describe('build / treeshake', function () {
    this.timeout(30000);

    // resolves to the same file as `import 'playcanvas'` under the production condition
    const ESM_TREE_INDEX = fileURLToPath(new URL('../../build/playcanvas/src/index.js', import.meta.url));
    const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

    const bundle = contents => esbuild.build({
        stdin: { contents, resolveDir: REPO_ROOT, loader: 'js' },
        alias: { playcanvas: ESM_TREE_INDEX },
        bundle: true,
        minify: true,
        write: false,
        format: 'esm',
        target: 'es2020',
        // the engine's worker sources import these for node support; real app bundlers must
        // externalize them the same way
        external: ['node:worker_threads', 'url'],
        logLevel: 'silent'
    });

    it('a single small import stays small', async function () {
        const result = await bundle('import { Vec3 } from "playcanvas"; console.log(new Vec3(1, 2, 3).length());');
        const bytes = result.outputFiles[0].contents.length;
        expect(bytes, 'bundle size').to.be.greaterThan(500);
        expect(bytes, 'bundle size').to.be.lessThan(10240);
    });
});
