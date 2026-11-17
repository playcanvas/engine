import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { Entity } from '../../../src/framework/entity.js';
import { FEATURE_SHADOWS } from '../../../src/scene/features/constants.js';
import { featureShadowsWebgl } from '../../../src/scene/features/feature-shadows.js';
import { installFeatures } from '../../../src/scene/features/install-features.js';
import { Renderer } from '../../../src/scene/renderer/renderer.js';
import { ShadowMapCache } from '../../../src/scene/renderer/shadow-map-cache.js';
import { ShadowRendererDirectional } from '../../../src/scene/renderer/shadow-renderer-directional.js';
import { ShadowRendererLocal } from '../../../src/scene/renderer/shadow-renderer-local.js';
import { ShadowRenderer } from '../../../src/scene/renderer/shadow-renderer.js';
import { Scene } from '../../../src/scene/scene.js';
import { createApp } from '../../app.mjs';
import { createGraphicsDevice } from '../../device.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('Shadows feature', function () {

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
    });

    describe('rendering without the feature', function () {
        let app;

        beforeEach(function () {
            jsdomSetup();
            app = createApp();

            // as if the application did not install the shadows feature
            const renderer = app.renderer;
            renderer.shadowRenderer.destroy();
            renderer.shadowMapCache.destroy();
            renderer.shadowMapCache = null;
            renderer.shadowRenderer = null;
            renderer._shadowRendererLocal = null;
            renderer._shadowRendererDirectional = null;
            app.graphicsDevice.features.delete(FEATURE_SHADOWS);

            const camera = new Entity('Camera');
            camera.addComponent('camera');
            camera.setPosition(0, 2, 5);
            camera.lookAt(0, 0, 0);
            app.root.addChild(camera);

            const caster = new Entity('Caster');
            caster.addComponent('render', { type: 'box' });
            app.root.addChild(caster);
        });

        afterEach(function () {
            sinon.restore();
            app.destroy();
            jsdomTeardown();
        });

        [true, false].forEach((clustered) => {
            ['directional', 'spot', 'omni'].forEach((type) => {
                it(`renders a ${type} light set to cast shadows without them${clustered ? ', with clustered lighting' : ''}`, function () {
                    app.scene.clusteredLightingEnabled = clustered;
                    const errorOnce = sinon.stub(Debug, 'errorOnce');

                    const entity = new Entity('Light');
                    entity.addComponent('light', { type, castShadows: true, shadowResolution: 256 });
                    entity.setPosition(0, 2, 0);
                    app.root.addChild(entity);
                    const light = entity.light.light;

                    expect(errorOnce.calledWithMatch(sinon.match('the shadows feature is not installed'))).to.equal(true);
                    expect(light.castShadows).to.equal(false);

                    expect(() => app.render()).to.not.throw();
                    expect(light.shadowMap).to.not.exist;
                });
            });
        });
    });
});
