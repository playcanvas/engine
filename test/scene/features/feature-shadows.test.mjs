import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { Entity } from '../../../src/framework/entity.js';
import { SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../../src/platform/graphics/constants.js';
import { FEATURE_DIRECTIONAL_SHADOWS, FEATURE_LOCAL_SHADOWS, hasFeature } from '../../../src/scene/features/constants.js';
import { featureDirectionalShadowsWebgl } from '../../../src/scene/features/feature-directional-shadows.js';
import { featureLocalShadowsWebgl } from '../../../src/scene/features/feature-local-shadows.js';
import { featureShadowsWebgl } from '../../../src/scene/features/feature-shadows.js';
import { installFeatures } from '../../../src/scene/features/install-features.js';
import { Renderer } from '../../../src/scene/renderer/renderer.js';
import { ShadowMapCache } from '../../../src/scene/renderer/shadow-map-cache.js';
import { ShadowRendererDirectional } from '../../../src/scene/renderer/shadow-renderer-directional.js';
import { ShadowRendererLocal } from '../../../src/scene/renderer/shadow-renderer-local.js';
import { ShadowRenderer } from '../../../src/scene/renderer/shadow-renderer.js';
import { Scene } from '../../../src/scene/scene.js';
import { directionalShadowChunksGLSL } from '../../../src/scene/shader-lib/glsl/collections/directional-shadow-chunks-glsl.js';
import { localShadowChunksGLSL } from '../../../src/scene/shader-lib/glsl/collections/local-shadow-chunks-glsl.js';
import { shaderChunksGLSL } from '../../../src/scene/shader-lib/glsl/collections/shader-chunks-glsl.js';
import { shadowChunksGLSL } from '../../../src/scene/shader-lib/glsl/collections/shadow-chunks-glsl.js';
import { ShaderChunks } from '../../../src/scene/shader-lib/shader-chunks.js';
import { directionalShadowChunksWGSL } from '../../../src/scene/shader-lib/wgsl/collections/directional-shadow-chunks-wgsl.js';
import { localShadowChunksWGSL } from '../../../src/scene/shader-lib/wgsl/collections/local-shadow-chunks-wgsl.js';
import { shaderChunksWGSL } from '../../../src/scene/shader-lib/wgsl/collections/shader-chunks-wgsl.js';
import { shadowChunksWGSL } from '../../../src/scene/shader-lib/wgsl/collections/shadow-chunks-wgsl.js';
import { createApp } from '../../app.mjs';
import { createGraphicsDevice } from '../../device.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('Shadows feature', function () {

    it('keeps the directional and local shadow chunks out of the core and shared shadow chunks', function () {
        for (const collection of [directionalShadowChunksGLSL, localShadowChunksGLSL]) {
            for (const name of Object.keys(collection.chunks)) {
                expect(shaderChunksGLSL, name).to.not.have.property(name);
                expect(shadowChunksGLSL.chunks, name).to.not.have.property(name);
            }
        }
        for (const collection of [directionalShadowChunksWGSL, localShadowChunksWGSL]) {
            for (const name of Object.keys(collection.chunks)) {
                expect(shaderChunksWGSL, name).to.not.have.property(name);
                expect(shadowChunksWGSL.chunks, name).to.not.have.property(name);
            }
        }
    });

    describe('installation', function () {
        let device;
        let scene;
        let renderer;

        beforeEach(function () {
            device = createGraphicsDevice({ width: 1, height: 1 });
            scene = new Scene(device);
            renderer = new Renderer(device, scene);
        });

        afterEach(function () {
            renderer.destroy();
            scene.destroy();
            device.destroy();
        });

        it('creates no shadow renderers without the feature', function () {
            expect(renderer.shadowMapCache).to.be.null;
            expect(renderer.shadowRenderer).to.be.null;
            expect(renderer._shadowRendererLocal).to.be.null;
            expect(renderer._shadowRendererDirectional).to.be.null;
        });

        it('creates the shadow renderers on the renderer when installed', function () {
            installFeatures({ graphicsDevice: device, renderer }, [featureShadowsWebgl]);

            expect(renderer.shadowMapCache).to.be.an.instanceof(ShadowMapCache);
            expect(renderer.shadowRenderer).to.be.an.instanceof(ShadowRenderer);
            expect(renderer.shadowRenderer.shadowMapCache).to.equal(renderer.shadowMapCache);
            expect(renderer._shadowRendererLocal).to.be.an.instanceof(ShadowRendererLocal);
            expect(renderer._shadowRendererDirectional).to.be.an.instanceof(ShadowRendererDirectional);
        });

        it('creates only the directional shadow renderer with the directional shadows feature', function () {
            installFeatures({ graphicsDevice: device, renderer }, [featureDirectionalShadowsWebgl]);

            expect(renderer.shadowRenderer).to.be.an.instanceof(ShadowRenderer);
            expect(renderer._shadowRendererDirectional).to.be.an.instanceof(ShadowRendererDirectional);
            expect(renderer._shadowRendererLocal).to.be.null;
            expect(hasFeature(device, FEATURE_LOCAL_SHADOWS)).to.equal(false);

            // the shared shadow chunks and the directional ones, of the device's language only
            const glsl = ShaderChunks.get(device, SHADERLANGUAGE_GLSL);
            for (const name of [...Object.keys(shadowChunksGLSL.chunks), ...Object.keys(directionalShadowChunksGLSL.chunks)]) {
                expect(glsl.get(name), name).to.exist;
            }
            for (const name of Object.keys(localShadowChunksGLSL.chunks)) {
                expect(glsl.get(name), name).to.be.undefined;
            }
            expect(ShaderChunks.get(device, SHADERLANGUAGE_WGSL).get('shadowCascadesPS')).to.be.undefined;
        });

        it('creates only the local shadow renderer with the local shadows feature', function () {
            installFeatures({ graphicsDevice: device, renderer }, [featureLocalShadowsWebgl]);

            expect(renderer.shadowRenderer).to.be.an.instanceof(ShadowRenderer);
            expect(renderer._shadowRendererLocal).to.be.an.instanceof(ShadowRendererLocal);
            expect(renderer._shadowRendererDirectional).to.be.null;
            expect(hasFeature(device, FEATURE_DIRECTIONAL_SHADOWS)).to.equal(false);

            const glsl = ShaderChunks.get(device, SHADERLANGUAGE_GLSL);
            for (const name of [...Object.keys(shadowChunksGLSL.chunks), ...Object.keys(localShadowChunksGLSL.chunks)]) {
                expect(glsl.get(name), name).to.exist;
            }
            expect(glsl.get('shadowCascadesPS')).to.be.undefined;
        });
    });

    // a missing feature is reported by asserts in debug builds, rather than handled
    describe('without the feature', function () {
        let app;
        let assert;

        const failedAsserts = () => assert.getCalls().filter(call => !call.args[0]).map(call => call.args[1]);

        beforeEach(function () {
            jsdomSetup();
            app = createApp();

            // as if the application did not install the shadows features
            app.graphicsDevice.featureNames.delete(FEATURE_DIRECTIONAL_SHADOWS);
            app.graphicsDevice.featureNames.delete(FEATURE_LOCAL_SHADOWS);
            assert = sinon.stub(Debug, 'assert');

            const camera = new Entity('Camera');
            camera.addComponent('camera');
            app.root.addChild(camera);
        });

        afterEach(function () {
            sinon.restore();
            app.destroy();
            jsdomTeardown();
        });

        it('asserts when a directional light is set to cast shadows', function () {
            const light = new Entity('Light');
            light.addComponent('light', { type: 'directional' });
            light.light.castShadows = true;

            expect(failedAsserts()).to.include('A directional light casting shadows needs the directional shadows feature to be installed.');
        });

        it('asserts when an omni light is set to cast shadows', function () {
            const light = new Entity('Light');
            light.addComponent('light', { type: 'omni' });
            light.light.castShadows = true;

            expect(failedAsserts()).to.include('An omni or spot light casting shadows needs the local shadows feature to be installed.');
        });

        it('asserts when a shadow casting light changes to a type whose shadows are not installed', function () {
            // only directional shadows installed
            app.graphicsDevice.featureNames.add(FEATURE_DIRECTIONAL_SHADOWS);
            const light = new Entity('Light');
            light.addComponent('light', { type: 'directional', castShadows: true });
            expect(failedAsserts()).to.deep.equal([]);

            light.light.type = 'spot';

            expect(failedAsserts()).to.include('An omni or spot light casting shadows needs the local shadows feature to be installed.');
        });

        it('asserts when clustered lighting with shadows generates a lit shader', function () {
            app.scene.clusteredLightingEnabled = true;
            const box = new Entity('Box');
            box.addComponent('render', { type: 'box' });
            app.root.addChild(box);

            app.render();

            expect(failedAsserts().some(message => message.startsWith('Clustered lighting with shadows needs the local shadows feature'))).to.equal(true);
        });

        it('compiles lit shaders for lights without shadows, with no shadow chunks registered', function () {
            // WebGPU keeps clustered lighting on, so its shadows are disabled too
            app.scene.clusteredLightingEnabled = false;
            app.scene.lighting.shadowsEnabled = false;

            // remove the shadow chunks, as if the feature had not registered them
            const device = app.graphicsDevice;
            for (const collection of [shadowChunksGLSL, directionalShadowChunksGLSL, localShadowChunksGLSL]) {
                for (const name of Object.keys(collection.chunks)) {
                    ShaderChunks.get(device, SHADERLANGUAGE_GLSL).delete(name);
                }
            }
            for (const collection of [shadowChunksWGSL, directionalShadowChunksWGSL, localShadowChunksWGSL]) {
                for (const name of Object.keys(collection.chunks)) {
                    ShaderChunks.get(device, SHADERLANGUAGE_WGSL).delete(name);
                }
            }
            const error = sinon.spy(console, 'error');

            const light = new Entity('Light');
            light.addComponent('light', { type: 'directional' });
            app.root.addChild(light);
            const box = new Entity('Box');
            box.addComponent('render', { type: 'box' });
            app.root.addChild(box);

            app.render();

            const unresolved = error.getCalls().map(call => String(call.args[0])).filter(message => message.includes('not resolved'));
            expect(unresolved).to.deep.equal([]);
        });

        it('does not assert for clustered lighting with shadows disabled', function () {
            app.scene.clusteredLightingEnabled = true;
            app.scene.lighting.shadowsEnabled = false;
            const box = new Entity('Box');
            box.addComponent('render', { type: 'box' });
            app.root.addChild(box);

            app.render();

            expect(failedAsserts().some(message => message.includes('shadows feature'))).to.equal(false);
        });
    });
});
