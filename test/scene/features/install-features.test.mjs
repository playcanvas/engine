import { expect } from 'chai';
import sinon from 'sinon';

import { Debug, DebugHelper } from '../../../src/core/debug.js';
import { featureParticlesWebgl, featureParticlesWebgpu } from '../../../src/framework/features/feature-particles.js';
import { SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../../src/platform/graphics/constants.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { featureAreaLightsWebgl, featureAreaLightsWebgpu } from '../../../src/scene/features/feature-area-lights.js';
import { featureCoreChunksWebgl, featureCoreChunksWebgpu } from '../../../src/scene/features/feature-core-chunks.js';
import { featureDirectionalPcssWebgl, featureDirectionalPcssWebgpu } from '../../../src/scene/features/feature-directional-pcss.js';
import { featureGsplatWebgl, featureGsplatWebgpu } from '../../../src/scene/features/feature-gsplat.js';
import { featureShadowsWebgl, featureShadowsWebgpu } from '../../../src/scene/features/feature-shadows.js';
import { Feature } from '../../../src/scene/features/feature.js';
import { installFeatures } from '../../../src/scene/features/install-features.js';
import { Renderer } from '../../../src/scene/renderer/renderer.js';
import { Scene } from '../../../src/scene/scene.js';
import { shaderChunksGLSL } from '../../../src/scene/shader-lib/glsl/collections/shader-chunks-glsl.js';
import { shadowChunksGLSL } from '../../../src/scene/shader-lib/glsl/collections/shadow-chunks-glsl.js';
import { ShaderChunks } from '../../../src/scene/shader-lib/shader-chunks.js';
import { shaderChunksWGSL } from '../../../src/scene/shader-lib/wgsl/collections/shader-chunks-wgsl.js';
import { shadowChunksWGSL } from '../../../src/scene/shader-lib/wgsl/collections/shadow-chunks-wgsl.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// creates a feature named for the debug checks, as the engine's features are
const named = (name, definition = {}) => {
    const feature = new Feature(definition);
    DebugHelper.setName(feature, name);
    return feature;
};

describe('installFeatures', function () {

    let device;
    let host;

    beforeEach(function () {
        device = new NullGraphicsDevice();
        host = { graphicsDevice: device };
    });

    afterEach(function () {
        device.destroy();
    });

    it('installs the features a feature requires before it', function () {
        const order = [];
        const base = named('base', { install: () => order.push('base') });
        const top = named('top', { requires: [base], install: () => order.push('top') });

        installFeatures(host, [top]);

        expect(order).to.deep.equal(['base', 'top']);
    });

    it('installs a feature once, however many times it is listed or required', function () {
        let count = 0;
        const shared = named('shared', { install: () => count++ });
        const a = named('a', { requires: [shared] });
        const b = named('b', { requires: [shared] });
        installFeatures(host, [a, b, shared]);
        installFeatures(host, [a]);

        expect(count).to.equal(1);
        expect([...device.features]).to.have.members([a, b, shared]);
        expect([...device.featureNames]).to.have.members(['a', 'b', 'shared']);
    });

    it('asserts in debug builds when two different features share a name', function () {
        const assert = sinon.stub(Debug, 'assert');

        installFeatures(host, [named('same'), named('same')]);

        expect(assert.calledWithMatch(false, 'Two different features are named same')).to.equal(true);
        assert.restore();
    });

    it('identifies features by object, so that unnamed features install as in release builds', function () {
        const assert = sinon.stub(Debug, 'assert');
        let count = 0;
        const first = new Feature({ install: () => count++ });
        const second = new Feature({ install: () => count++ });

        installFeatures(host, [first, second, first]);
        assert.restore();

        expect(count).to.equal(2);
        expect([...device.features]).to.have.members([first, second]);
        expect(device.featureNames.size).to.equal(0);
    });

    it('registers the chunks of a feature in the language of its collection', function () {
        const feature = named('test', {
            chunks: { language: SHADERLANGUAGE_WGSL, chunks: { testChunkPS: 'fn test() {}' } }
        });

        installFeatures(host, [feature]);

        expect(ShaderChunks.get(device, SHADERLANGUAGE_WGSL).get('testChunkPS')).to.equal('fn test() {}');
        expect(ShaderChunks.get(device, SHADERLANGUAGE_GLSL).has('testChunkPS')).to.equal(false);
    });

    // two engine features registering a chunk of the same name would replace each other's chunk,
    // depending on the order they are installed in
    it('the engine features do not share chunk names', function () {
        const features = [
            featureCoreChunksWebgl, featureCoreChunksWebgpu,
            featureShadowsWebgl, featureShadowsWebgpu,
            featureDirectionalPcssWebgl, featureDirectionalPcssWebgpu,
            featureAreaLightsWebgl, featureAreaLightsWebgpu,
            featureParticlesWebgl, featureParticlesWebgpu,
            featureGsplatWebgl, featureGsplatWebgpu
        ];

        // every feature with chunks, including the features they require, each once
        const withChunks = new Set();
        const collect = (feature) => {
            if (feature.chunks) withChunks.add(feature);
            feature.requires.forEach(collect);
        };
        features.forEach(collect);

        const owners = { [SHADERLANGUAGE_GLSL]: new Map(), [SHADERLANGUAGE_WGSL]: new Map() };
        for (const feature of withChunks) {
            const byName = owners[feature.chunks.language];
            for (const name of Object.keys(feature.chunks.chunks)) {
                expect(byName.get(name), `${name} in ${feature.name}`).to.equal(undefined);
                byName.set(name, feature.name);
            }
        }
    });

    it('installs the shadow code once for both devices', function () {
        const scene = new Scene(device);
        const renderer = new Renderer(device, scene);

        installFeatures({ graphicsDevice: device, renderer }, [featureShadowsWebgl, featureShadowsWebgpu]);
        renderer.destroy();
        scene.destroy();

        // the features of each device, and the code of each light type they share, recorded once
        expect([...device.featureNames]).to.have.members([
            'shadows', 'shadowsCore-webgl', 'shadowsCore-webgpu',
            'directionalShadows', 'directionalShadows-webgl', 'directionalShadows-webgpu',
            'localShadows', 'localShadows-webgl', 'localShadows-webgpu',
            'shadows-webgl', 'shadows-webgpu'
        ]);
    });
});

describe('AppBase features', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app.destroy();
        jsdomTeardown();
    });

    it('registers the shadow chunks of both languages', function () {
        const glsl = ShaderChunks.get(app.graphicsDevice, SHADERLANGUAGE_GLSL);
        const wgsl = ShaderChunks.get(app.graphicsDevice, SHADERLANGUAGE_WGSL);

        for (const [name, code] of Object.entries(shadowChunksGLSL.chunks)) {
            expect(glsl.get(name), name).to.equal(code);
        }
        for (const [name, code] of Object.entries(shadowChunksWGSL.chunks)) {
            expect(wgsl.get(name), name).to.equal(code);
        }
    });

    it('registers the core chunks of both languages', function () {
        const glsl = ShaderChunks.get(app.graphicsDevice, SHADERLANGUAGE_GLSL);
        const wgsl = ShaderChunks.get(app.graphicsDevice, SHADERLANGUAGE_WGSL);

        for (const [name, code] of Object.entries(shaderChunksGLSL)) {
            expect(glsl.get(name), name).to.equal(code);
        }
        for (const [name, code] of Object.entries(shaderChunksWGSL)) {
            expect(wgsl.get(name), name).to.equal(code);
        }
        expect(app.graphicsDevice.features.has(featureCoreChunksWebgl)).to.equal(true);
        expect(app.graphicsDevice.features.has(featureCoreChunksWebgpu)).to.equal(true);
    });

    it('keeps the shadow chunks out of the core collections', function () {
        for (const name of Object.keys(shadowChunksGLSL.chunks)) {
            expect(shaderChunksGLSL, name).to.not.have.property(name);
        }
        for (const name of Object.keys(shadowChunksWGSL.chunks)) {
            expect(shaderChunksWGSL, name).to.not.have.property(name);
        }
    });
});
