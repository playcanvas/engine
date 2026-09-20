import { expect } from 'chai';
import sinon from 'sinon';

import { Entity } from '../../../src/framework/entity.js';
import { SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME, SHADOW_VSM_16F, SHADOW_VSM_32F } from '../../../src/scene/constants.js';
import { QuadRender } from '../../../src/scene/graphics/quad-render.js';
import { RenderPassShadowLocalNonClustered } from '../../../src/scene/renderer/render-pass-shadow-local-non-clustered.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('VSM cascade blur', function () {
    let app;
    let light;
    let blurWrites;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        app.graphicsDevice.textureFloatFilterable = true;
        const camera = new Entity('Camera');
        camera.addComponent('camera');
        app.root.addChild(camera);
        const entity = new Entity('Light');
        entity.addComponent('light', { type: 'directional', castShadows: true, numCascades: 4, shadowResolution: 128 });
        app.root.addChild(entity);
        light = entity.light.light;
        blurWrites = [];
        sinon.stub(QuadRender.prototype, 'render').callsFake((rect, scissor) => {
            blurWrites.push([scissor.x, scissor.y, scissor.z, scissor.w]);
        });
    });

    afterEach(function () {
        sinon.restore();
        app.destroy();
        jsdomTeardown();
    });

    [SHADOW_VSM_16F, SHADOW_VSM_32F].forEach((type) => {
        it(`skips non-clustered spot blur when execution is disabled for VSM type ${type}`, function () {
            app.scene.clusteredLightingEnabled = false;
            app.root.findByName('Light').light.type = 'spot';
            light.shadowType = type;
            expect(light.shadowType).to.equal(type);
            app.render();
            blurWrites.length = 0;

            const renderer = app.renderer.shadowRenderer;
            const renderFace = sinon.spy(renderer, 'renderFace');
            const pass = new RenderPassShadowLocalNonClustered(app.graphicsDevice, renderer, light, 0, true);
            pass.executeEnabled = false;
            pass.render();
            expect(renderFace.called).to.equal(false);
            expect(blurWrites).to.eql([]);

            pass.executeEnabled = true;
            pass.render();
            expect(renderFace.calledOnce).to.equal(true);
            expect(blurWrites).to.eql([[1, 1, 126, 126], [1, 1, 126, 126]]);
        });

        [
            { cascades: 2, active: [1], writes: [[1, 64, 63, 63]] },
            { cascades: 3, active: [2], writes: [[64, 1, 63, 63]] },
            { cascades: 4, active: [1, 3], writes: [[1, 64, 63, 63], [64, 64, 63, 63]] }
        ].forEach(({ cascades, active, writes }) => {
            it(`writes only updated atlas regions for ${cascades} cascades and VSM type ${type}`, function () {
                light.numCascades = cascades;
                light.shadowType = type;
                expect(light.shadowType).to.equal(type);
                app.render();
                expect(blurWrites).to.eql([[1, 1, 126, 126], [1, 1, 126, 126]]);

                blurWrites.length = 0;
                light.shadowUpdateOverrides = Array.from({ length: cascades }, (_, cascade) => (
                    active.includes(cascade) ? SHADOWUPDATE_THISFRAME : SHADOWUPDATE_NONE
                ));
                app.render();
                // The horizontal pass fills scratch storage; only the vertical passes write back.
                expect(blurWrites).to.eql([[1, 1, 126, 126], ...writes]);

                blurWrites.length = 0;
                app.render();
                expect(blurWrites).to.eql([]);

                // A later full refresh must not inherit the last partial update's scissor.
                light.shadowUpdateOverrides = null;
                app.render();
                expect(blurWrites).to.eql([[1, 1, 126, 126], [1, 1, 126, 126]]);
            });
        });
    });

    it('does not blur when the shadow pass does not execute', function () {
        light.shadowType = SHADOW_VSM_16F;
        app.render();
        blurWrites.length = 0;
        const renderer = app.renderer._shadowRendererDirectional;
        const getPass = renderer.getLightRenderPass;
        sinon.stub(renderer, 'getLightRenderPass').callsFake(function (...args) {
            const pass = getPass.apply(this, args);
            pass.executeEnabled = false;
            return pass;
        });
        app.render();
        expect(blurWrites).to.eql([]);
    });

    it('keeps the full-map blur for non-clustered spot shadows', function () {
        app.scene.clusteredLightingEnabled = false;
        app.root.findByName('Light').light.type = 'spot';
        light.shadowType = SHADOW_VSM_16F;
        app.render();
        expect(blurWrites).to.eql([[1, 1, 126, 126], [1, 1, 126, 126]]);
    });
});
