import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { expect } from 'chai';
import esbuild from 'esbuild';

import { setupDom, teardownDom } from './helpers.mjs';

// bundle small apps against the esm tree the way a consumer's bundler would. every module in the
// package is declared side-effect-free ("sideEffects": false in package.json), which cuts both
// ways: a module-scope side effect anywhere reachable from src/index.js (as the deprecated.js
// prototype patches once were) drags hundreds of KB into every consumer bundle, while a deprecated
// shim that is not attached to the class that owns it gets dropped from consumer bundles entirely.
// The first test guards the former, the second the latter.
describe('build / treeshake', function () {
    this.timeout(30000);

    // resolves to the same file as `import 'playcanvas'` under the production condition
    const ESM_TREE_INDEX = fileURLToPath(new URL('../../build/playcanvas/src/index.js', import.meta.url));
    const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

    const bundle = (contents, format = 'esm') => esbuild.build({
        stdin: { contents, resolveDir: REPO_ROOT, loader: 'js' },
        alias: { playcanvas: ESM_TREE_INDEX },
        bundle: true,
        minify: true,
        write: false,
        format,
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

    it('deprecated shims survive tree-shaking and still apply', async function () {
        // representative shims of each kind: class members (shininess), the computed-name alias
        // and tint loops (sheenGlossiness, diffuseTint), the options forwarding loop (refraction)
        // and the cross-module ForwardRenderer patch, which ships with AppBase.
        const result = await bundle(`
            import { AppBase, AssetRegistry, ForwardRenderer, StandardMaterial, StandardMaterialOptions } from "playcanvas";
            const m = new StandardMaterial();
            m.shininess = 50;
            m.sheenGlossiness = 0.25;
            const o = new StandardMaterialOptions();
            o.refraction = true;
            globalThis.__shims = {
                gloss: m.gloss,
                sheenGloss: m.sheenGloss,
                diffuseTint: m.diffuseTint,
                refraction: o.litOptions.useRefraction,
                renderComposition: typeof ForwardRenderer.prototype.renderComposition,
                getAssetById: typeof AssetRegistry.prototype.getAssetById,
                loadScene: typeof AppBase.prototype.loadScene
            };
        `, 'cjs');

        setupDom();
        try {
            vm.runInThisContext(result.outputFiles[0].text, { filename: 'treeshake-shims.js' });
        } finally {
            teardownDom();
        }

        const shims = globalThis.__shims;
        delete globalThis.__shims;
        expect(shims.gloss, 'StandardMaterial#shininess').to.equal(0.5);
        expect(shims.sheenGloss, 'StandardMaterial#sheenGlossiness').to.equal(0.25);
        expect(shims.diffuseTint, 'StandardMaterial#diffuseTint').to.equal(true);
        expect(shims.refraction, 'StandardMaterialOptions#refraction').to.equal(true);
        expect(shims.renderComposition, 'ForwardRenderer#renderComposition').to.equal('function');
        expect(shims.getAssetById, 'AssetRegistry#getAssetById').to.equal('function');
        expect(shims.loadScene, 'AppBase#loadScene').to.equal('function');
    });
});
