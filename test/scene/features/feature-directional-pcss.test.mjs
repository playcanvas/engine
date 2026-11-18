import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { Entity } from '../../../src/framework/entity.js';
import { SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../../src/platform/graphics/constants.js';
import { SHADOW_PCF3_32F, SHADOW_PCSS_32F } from '../../../src/scene/constants.js';
import { FEATURE_DIRECTIONAL_PCSS, FEATURE_SHADOWS } from '../../../src/scene/features/constants.js';
import { featureDirectionalPcssWebgl } from '../../../src/scene/features/feature-directional-pcss.js';
import { installFeatures } from '../../../src/scene/features/install-features.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { Renderer } from '../../../src/scene/renderer/renderer.js';
import { Scene } from '../../../src/scene/scene.js';
import { directionalPcssChunksGLSL } from '../../../src/scene/shader-lib/glsl/collections/directional-pcss-chunks-glsl.js';
import { shadowChunksGLSL } from '../../../src/scene/shader-lib/glsl/collections/shadow-chunks-glsl.js';
import { ShaderChunks } from '../../../src/scene/shader-lib/shader-chunks.js';
import { directionalPcssChunksWGSL } from '../../../src/scene/shader-lib/wgsl/collections/directional-pcss-chunks-wgsl.js';
import { shadowChunksWGSL } from '../../../src/scene/shader-lib/wgsl/collections/shadow-chunks-wgsl.js';
import { createApp } from '../../app.mjs';
import { createGraphicsDevice } from '../../device.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('Directional PCSS feature', function () {

    it('keeps the directional PCSS chunks out of the shadow chunks', function () {
        expect(Object.keys(directionalPcssChunksGLSL.chunks)).to.deep.equal(Object.keys(directionalPcssChunksWGSL.chunks));
        for (const name of Object.keys(directionalPcssChunksGLSL.chunks)) {
            expect(shadowChunksGLSL.chunks).to.not.have.property(name);
            expect(shadowChunksWGSL.chunks).to.not.have.property(name);
        }
    });

    it('registers the chunks of its language and installs shadows', function () {
        const device = createGraphicsDevice({ width: 1, height: 1 });
        const scene = new Scene(device);
        const renderer = new Renderer(device, scene);
        try {
            installFeatures({ graphicsDevice: device, renderer }, [featureDirectionalPcssWebgl]);

            expect(device.features.has(FEATURE_DIRECTIONAL_PCSS)).to.equal(true);
            expect(device.features.has(FEATURE_SHADOWS)).to.equal(true);
            expect(ShaderChunks.get(device, SHADERLANGUAGE_GLSL).get('shadowSoftPS')).to.equal(directionalPcssChunksGLSL.chunks.shadowSoftPS);
            expect(ShaderChunks.get(device, SHADERLANGUAGE_WGSL).get('shadowSoftPS')).to.be.undefined;
        } finally {
            renderer.destroy();
            scene.destroy();
            device.destroy();
        }
    });

    describe('application', function () {
        let app;
        let consoleError;

        beforeEach(function () {
            jsdomSetup();
            app = createApp();

            // PCSS needs filterable float render targets, which the null device does not report
            app.graphicsDevice.textureFloatFilterable = true;
            consoleError = sinon.spy(console, 'error');

            const camera = new Entity('camera');
            camera.addComponent('camera');
            camera.setPosition(0, 0, 8);
            app.root.addChild(camera);
        });

        afterEach(function () {
            sinon.restore();
            app.destroy();
            jsdomTeardown();
        });

        const addLight = (options) => {
            const light = new Entity('light');
            light.addComponent('light', options);
            app.root.addChild(light);
            return light;
        };

        const forwardShader = () => {
            const material = new StandardMaterial();
            material.update();
            const box = new Entity('box');
            box.addComponent('render', { type: 'box', material });
            app.root.addChild(box);
            app.render();

            const meshInstance = box.render.meshInstances[0];
            const shaders = Array.from(meshInstance._shaderCache.values(), entry => entry.shader);
            const shader = shaders.find(s => s.definition.fshader.includes('combineColor'));
            expect(shader).to.exist;
            expect(shader.failed).to.equal(false);
            expect(consoleError.called, consoleError.args.join('\n')).to.equal(false);
            return shader.definition.fshader;
        };

        it('includes only the directional PCSS code for a directional PCSS light', function () {
            addLight({ type: 'directional', castShadows: true, shadowType: SHADOW_PCSS_32F });
            const source = forwardShader();

            expect(source).to.contain('PCSSDirectional');
            expect(source).to.not.contain('getShadowSpotPCSS');
        });

        it('includes no PCSS code for a directional PCF light', function () {
            addLight({ type: 'directional', castShadows: true, shadowType: SHADOW_PCF3_32F });
            const source = forwardShader();

            expect(source).to.not.contain('PCSSDirectional');
        });

        it('includes only the local PCSS code for a non-clustered spot PCSS light', function () {
            // WebGPU supports clustered lighting only, which has no PCSS
            if (app.graphicsDevice.isWebGPU) this.skip();

            app.scene.clusteredLightingEnabled = false;
            addLight({ type: 'spot', castShadows: true, shadowType: SHADOW_PCSS_32F });
            const source = forwardShader();

            expect(source).to.contain('getShadowSpotPCSS');
            expect(source).to.not.contain('PCSSDirectional');
        });

        it('asserts when a directional light uses PCSS without the feature', function () {
            app.graphicsDevice.features.delete(FEATURE_DIRECTIONAL_PCSS);
            const assert = sinon.stub(Debug, 'assert');

            addLight({ type: 'directional', castShadows: true, shadowType: SHADOW_PCSS_32F });

            const failed = assert.getCalls().filter(call => !call.args[0]).map(call => call.args[1]);
            expect(failed).to.include('PCSS shadows of a directional light need the directional PCSS feature to be installed.');
        });
    });
});
