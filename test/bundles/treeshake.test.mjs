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
        metafile: true,
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

    // features are created at module scope, and a feature module holds the feature of each device.
    // Without its pure annotation, a feature an application does not import would be kept, and with
    // it the shader chunks of the language the application does not use.
    const features = [
        { module: 'feature-shadows.js', webgl: 'featureShadowsWebgl', webgpu: 'featureShadowsWebgpu' },
        { module: 'feature-area-lights.js', webgl: 'featureAreaLightsWebgl', webgpu: 'featureAreaLightsWebgpu' },
        { module: 'feature-particles.js', webgl: 'featureParticlesWebgl', webgpu: 'featureParticlesWebgpu' }
    ];

    for (const feature of features) {
        it(`${feature.module}: a feature for one device does not retain the shader chunks of the other device`, async function () {
            const featureModule = fileURLToPath(new URL(`../../build/playcanvas/src/scene/features/${feature.module}`, import.meta.url));
            const retainedChunks = async (name) => {
                const result = await bundle(`
                    import { ${name} } from ${JSON.stringify(featureModule)};
                    globalThis.__feature = ${name};
                `);
                const output = Object.values(result.metafile.outputs)[0];
                const inputs = Object.keys(output.inputs);
                return {
                    glsl: inputs.filter(path => path.includes('/shader-lib/glsl/')),
                    wgsl: inputs.filter(path => path.includes('/shader-lib/wgsl/'))
                };
            };

            const webgl = await retainedChunks(feature.webgl);
            expect(webgl.glsl, 'GLSL chunks of the WebGL feature').to.not.be.empty;
            expect(webgl.wgsl, 'retained WGSL chunks').to.deep.equal([]);

            const webgpu = await retainedChunks(feature.webgpu);
            expect(webgpu.wgsl, 'WGSL chunks of the WebGPU feature').to.not.be.empty;
            expect(webgpu.glsl, 'retained GLSL chunks').to.deep.equal([]);
        });
    }

    // shadow rendering is created by the shadows feature, so the renderer alone does not bring it
    it('the renderer does not retain shadow rendering, which the shadows feature brings', async function () {
        const result = await bundle(`
            import { ForwardRenderer } from "playcanvas";
            globalThis.__renderer = ForwardRenderer;
        `);
        const output = Object.values(result.metafile.outputs)[0];
        const inputs = Object.keys(output.inputs);
        const retained = inputs.filter(path => /\/renderer\/shadow-renderer[^/]*\.js$/.test(path) ||
            path.endsWith('/renderer/shadow-map-cache.js') ||
            path.endsWith('/renderer/render-pass-shadow-directional.js') ||
            path.endsWith('/renderer/render-pass-shadow-local-non-clustered.js') ||
            path.includes('/shadow-chunks-') ||
            path.endsWith('/features/feature-shadows.js'));
        expect(retained, 'retained shadow rendering modules').to.deep.equal([]);
    });

    // area lights are brought by the area lights feature, so the core shader chunks and the
    // renderer do not retain their shader chunks or LUT code
    it('the core shader chunks and the renderer do not retain area lights', async function () {
        const collection = language => fileURLToPath(new URL(`../../build/playcanvas/src/scene/shader-lib/${language}/collections/shader-chunks-${language}.js`, import.meta.url));
        const result = await bundle(`
            import { ForwardRenderer } from "playcanvas";
            import { shaderChunksGLSL } from ${JSON.stringify(collection('glsl'))};
            import { shaderChunksWGSL } from ${JSON.stringify(collection('wgsl'))};
            globalThis.__imports = { ForwardRenderer, shaderChunksGLSL, shaderChunksWGSL };
        `);
        const output = Object.values(result.metafile.outputs)[0];
        const inputs = Object.keys(output.inputs);
        const retained = inputs.filter(path => path.endsWith('/area-light-luts.js') ||
            path.endsWith('/lit/frag/ltc.js') ||
            path.endsWith('/lit/frag/clusteredLightArea.js') ||
            path.includes('/area-light-chunks-') ||
            path.endsWith('/features/feature-area-lights.js'));
        expect(retained, 'retained area light modules').to.deep.equal([]);
    });

    // asset bundles are brought by the bundles feature, so the asset code that loads from bundles
    // when the feature is installed does not retain them
    it('asset loading does not retain asset bundles, which the bundles feature brings', async function () {
        const result = await bundle(`
            import { Asset, AssetRegistry, ResourceLoader, TextureAtlasHandler } from "playcanvas";
            globalThis.__imports = { Asset, AssetRegistry, ResourceLoader, TextureAtlasHandler };
        `);
        const output = Object.values(result.metafile.outputs)[0];
        const inputs = Object.keys(output.inputs);
        const retained = inputs.filter(path => path.includes('/framework/bundle/') ||
            path.endsWith('/handlers/bundle.js') ||
            path.endsWith('/handlers/untar.js') ||
            path.endsWith('/features/feature-bundles.js'));
        expect(retained, 'retained asset bundle modules').to.deep.equal([]);
    });

    // localization is brought by the i18n feature, so text elements and localized assets alone do
    // not retain it
    it('text elements do not retain localization, which the i18n feature brings', async function () {
        const result = await bundle(`
            import { ElementComponentSystem, LocalizedAsset } from "playcanvas";
            globalThis.__imports = { ElementComponentSystem, LocalizedAsset };
        `);
        const output = Object.values(result.metafile.outputs)[0];
        const inputs = Object.keys(output.inputs);
        const retained = inputs.filter(path => path.endsWith('/i18n/i18n.js') ||
            path.endsWith('/i18n/i18n-parser.js') ||
            path.endsWith('/features/feature-i18n.js'));
        expect(retained, 'retained localization modules').to.deep.equal([]);
    });

    it('AppBase with container loading does not retain the gsplat implementation', async function () {
        const result = await bundle(`
            import { AppBase, ContainerHandler } from "playcanvas";
            globalThis.__appBaseImports = { AppBase, ContainerHandler };
        `);

        const output = Object.values(result.metafile.outputs)[0];
        const inputs = Object.keys(output.inputs);
        const retained = inputs.filter(path => path.includes('/scene/gsplat/') ||
            path.includes('/scene/gsplat-unified/') ||
            path.includes('/chunks/gsplat/') ||
            path.includes('/gsplat-chunks-') ||
            path.endsWith('/khr-gaussian-splatting.js'));

        expect(retained, 'retained gsplat implementation modules').to.deep.equal([]);
    });

    it('ContainerHandler does not retain the gsplat resource implementation', async function () {
        const result = await bundle(`
            import { ContainerHandler } from "playcanvas";
            globalThis.__containerHandler = ContainerHandler;
        `);

        const output = Object.values(result.metafile.outputs)[0];
        const inputs = Object.keys(output.inputs);
        const retained = inputs.filter((path) => {
            return path.includes('/scene/gsplat/') ||
                path.includes('/scene/gsplat-unified/') ||
                path.includes('/chunks/gsplat/') ||
                path.endsWith('/khr-gaussian-splatting.js');
        });

        expect(retained, 'retained gsplat resource modules').to.deep.equal([]);
    });

    it('CameraFrame does not retain the SMAA effect, which is only bundled when imported', async function () {
        const smaaModules = async (contents) => {
            const result = await bundle(contents);
            const output = Object.values(result.metafile.outputs)[0];
            return Object.keys(output.inputs).filter(path => path.includes('/effects/smaa/'));
        };

        const withoutSmaa = await smaaModules(`
            import { CameraFrame } from "playcanvas";
            globalThis.__cameraFrame = CameraFrame;
        `);
        expect(withoutSmaa, 'retained SMAA modules').to.deep.equal([]);

        const withSmaa = await smaaModules(`
            import { CameraFrame, SmaaEffect } from "playcanvas";
            globalThis.__cameraFrame = [CameraFrame, SmaaEffect];
        `);
        expect(withSmaa.some(path => path.endsWith('/effects/smaa/smaa-effect.js')), 'bundled SMAA effect').to.equal(true);
    });

    it('CameraFrame does not retain the auto exposure effect, which is only bundled when imported', async function () {
        const autoExposureModules = async (contents) => {
            const result = await bundle(contents);
            const output = Object.values(result.metafile.outputs)[0];
            return Object.keys(output.inputs).filter(path => path.includes('/effects/auto-exposure/'));
        };

        const withoutAutoExposure = await autoExposureModules(`
            import { CameraFrame } from "playcanvas";
            globalThis.__cameraFrame = CameraFrame;
        `);
        expect(withoutAutoExposure, 'retained auto exposure modules').to.deep.equal([]);

        const withAutoExposure = await autoExposureModules(`
            import { CameraFrame, AutoExposureEffect } from "playcanvas";
            globalThis.__cameraFrame = [CameraFrame, AutoExposureEffect];
        `);
        expect(withAutoExposure.some(path => path.endsWith('/effects/auto-exposure/auto-exposure-effect.js')), 'bundled auto exposure effect').to.equal(true);
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
