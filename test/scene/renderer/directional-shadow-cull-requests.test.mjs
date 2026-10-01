import { expect } from 'chai';
import sinon from 'sinon';

import { Entity } from '../../../src/framework/entity.js';
import { FramePass } from '../../../src/platform/graphics/frame-pass.js';
import { SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME, SHADOWUPDATE_REALTIME, SHADOW_PCF3_32F, SHADOW_PCSS_32F, SHADOW_PCF5_32F } from '../../../src/scene/constants.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('Directional shadow cull requests', function () {
    let app;
    let camera;
    let light;
    let caster;
    let cull;
    let renderFace;

    const createCamera = () => {
        const entity = new Entity('Camera');
        entity.addComponent('camera');
        entity.setPosition(0, 2, 5);
        entity.lookAt(0, 0, 0);
        app.root.addChild(entity);
        return entity.camera;
    };

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        camera = createCamera();

        const entity = new Entity('Light');
        entity.addComponent('light', { type: 'directional', castShadows: true, numCascades: 2 });
        app.root.addChild(entity);
        light = entity.light.light;

        caster = new Entity('Caster');
        caster.addComponent('render', { type: 'box' });
        app.root.addChild(caster);

        cull = sinon.spy(app.renderer._shadowRendererDirectional, 'cull');
        renderFace = sinon.spy(app.renderer.shadowRenderer, 'renderFace');
    });

    afterEach(function () {
        sinon.restore();
        app.destroy();
        jsdomTeardown();
    });

    it('culls realtime shadows once per light and camera each frame', function () {
        app.render();
        app.render();
        expect(cull.callCount).to.equal(2);
        expect(renderFace.callCount).to.equal(4);
    });

    it('initializes a shadow buffer without culling or consuming initial NONE', function () {
        light.shadowUpdateMode = SHADOWUPDATE_NONE;
        app.render();
        app.render();
        expect(cull.called).to.equal(false);
        expect(renderFace.called).to.equal(false);
        expect(light.shadowUpdateMode).to.equal(SHADOWUPDATE_NONE);
        for (let cascade = 0; cascade < light.numCascades; cascade++) {
            expect(light.getRenderData(camera.camera, cascade).shadowBuffer !== null).to.equal(true);
        }
    });

    it('preserves cached camera fitting and refreshes only on request', function () {
        light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
        app.render();
        const data = light.getRenderData(camera.camera, 0);
        const fitted = () => ({
            near: data.shadowCamera.nearClip,
            far: data.shadowCamera.farClip,
            radius: data.projectionCompensation,
            position: data.shadowCamera.node.getPosition().toString(),
            splits: Array.from(light._shadowCascadeDistances),
            matrix: Array.from(data.shadowMatrix.data)
        });
        const original = fitted();
        caster.setLocalScale(1, 4, 1);
        camera.nearClip = 1;
        app.render();
        expect(cull.callCount).to.equal(1);
        expect(renderFace.callCount).to.equal(2);
        expect(fitted()).to.eql(original);
        expect(data.shadowCullRequested).to.equal(false);

        light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
        app.render();
        expect(cull.callCount).to.equal(2);
        expect(renderFace.callCount).to.equal(4);
        expect(fitted().far).not.to.equal(original.far);
        expect(light.shadowUpdateMode).to.equal(SHADOWUPDATE_NONE);
    });

    it('keeps THISFRAME pending when a custom camera schedules no shadow pass', function () {
        camera.framePasses = [new FramePass(app.graphicsDevice)];
        light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
        app.render();
        expect(cull.called).to.equal(false);
        expect(renderFace.called).to.equal(false);
        expect(light.shadowUpdateMode).to.equal(SHADOWUPDATE_THISFRAME);
        expect(app.renderer._shadowMapUpdates).to.equal(0);

        camera.framePasses = null;
        app.render();
        expect(cull.calledOnce).to.equal(true);
        expect(renderFace.callCount).to.equal(2);
        expect(light.shadowUpdateMode).to.equal(SHADOWUPDATE_NONE);
    });

    ['enabled', 'executeEnabled'].forEach((property) => {
        it(`does not request culling for a shadow pass with ${property} disabled`, function () {
            const renderer = app.renderer._shadowRendererDirectional;
            const getPass = renderer.getLightRenderPass;
            sinon.stub(renderer, 'getLightRenderPass').callsFake(function (...args) {
                const pass = getPass.apply(this, args);
                pass[property] = false;
                return pass;
            });
            light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
            light.shadowUpdateOverrides = [SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME];
            app.render();
            expect(cull.called).to.equal(false);
            expect(renderFace.called).to.equal(false);
            expect(light.shadowUpdateMode).to.equal(SHADOWUPDATE_THISFRAME);
            expect(light.shadowUpdateOverrides).to.eql([SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME]);
        });
    });

    it('deduplicates repeated requests for the same light and camera', function () {
        const culler = app.renderer.culler;
        const request = culler.requestDirectionalShadowCull;
        sinon.stub(culler, 'requestDirectionalShadowCull').callsFake(function (...args) {
            request.apply(this, args);
            request.apply(this, args);
        });
        app.render();
        expect(cull.calledOnce).to.equal(true);
        expect(renderFace.callCount).to.equal(2);
    });

    it('culls each requested camera and accounts for both one-shot updates', function () {
        const second = createCamera();
        second.entity.setPosition(3, 2, 5);
        light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
        app.render();
        expect(cull.callCount).to.equal(2);
        expect(renderFace.callCount).to.equal(4);
        expect(app.renderer._shadowMapUpdates).to.equal(4);
        expect(light.shadowUpdateMode).to.equal(SHADOWUPDATE_NONE);
        app.render();
        expect(cull.callCount).to.equal(2);
        expect(renderFace.callCount).to.equal(4);
    });

    it('binds cached shadows for a newly added camera without requesting a cull', function () {
        light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
        app.render();
        const second = createCamera();
        app.render();
        expect(cull.callCount).to.equal(1);
        expect(light.getRenderData(second.camera, 0).shadowBuffer !== null).to.equal(true);
    });

    it('requests a new one-shot cull after shadow-map recreation', function () {
        light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
        app.render();
        light.shadowResolution = 512;
        app.render();
        expect(cull.callCount).to.equal(2);
        expect(renderFace.callCount).to.equal(4);
        expect(light.shadowUpdateMode).to.equal(SHADOWUPDATE_NONE);
        app.render();
        expect(cull.callCount).to.equal(2);
    });

    it('discards stale requests when the following frame has no shadow passes', function () {
        app.render();
        camera.framePasses = [new FramePass(app.graphicsDevice)];
        light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
        app.render();
        expect(cull.callCount).to.equal(1);
        expect(renderFace.callCount).to.equal(2);
        expect(light.getRenderData(camera.camera, 0).shadowCullRequested).to.equal(false);
        expect(light.shadowUpdateMode).to.equal(SHADOWUPDATE_THISFRAME);
    });

    [SHADOWUPDATE_REALTIME, SHADOWUPDATE_THISFRAME].forEach((mode) => {
        it(`schedules no pass and preserves mode ${mode} when all cascades are cached`, function () {
            app.render();
            light.shadowUpdateMode = mode;
            light.shadowUpdateOverrides = [SHADOWUPDATE_NONE, SHADOWUPDATE_NONE];
            cull.resetHistory();
            renderFace.resetHistory();
            const updates = app.renderer._shadowMapUpdates;
            const getPass = sinon.spy(app.renderer._shadowRendererDirectional, 'getLightRenderPass');
            app.render();
            expect(getPass.calledOnce).to.equal(true);
            expect(getPass.firstCall.returnValue).to.equal(null);
            expect(cull.called).to.equal(false);
            expect(renderFace.called).to.equal(false);
            expect(app.renderer._shadowMapUpdates).to.equal(updates);
            expect(light.shadowUpdateMode).to.equal(mode);
            const data = light.getRenderData(camera.camera, 0);
            expect(data.shadowCullRequested).to.equal(false);
            expect(data.shadowCascadeMask).to.equal(0);

            light.shadowUpdateOverrides[1] = SHADOWUPDATE_THISFRAME;
            app.render();
            expect(cull.calledOnce).to.equal(true);
            expect(renderFace.getCalls().map(call => call.args[2])).to.eql([1]);
            expect(app.renderer._shadowMapUpdates - updates).to.equal(1);
            expect(light.shadowUpdateOverrides).to.eql([SHADOWUPDATE_NONE, SHADOWUPDATE_NONE]);
            expect(light.shadowUpdateMode).to.equal(mode === SHADOWUPDATE_THISFRAME ? SHADOWUPDATE_NONE : mode);
        });
    });

    [SHADOW_PCF3_32F, SHADOW_PCSS_32F, SHADOW_PCF5_32F].forEach((shadowType) => {
        [[1], [0, 3], [1, 3]].forEach((activeCascades) => {
            it(`culls and fits only cascades ${activeCascades} with shadow type ${shadowType}`, function () {
                light.numCascades = 4;
                app.graphicsDevice.textureFloatFilterable = true;
                light.shadowType = shadowType;
                expect(light.shadowType).to.equal(shadowType);
                light.shadowDistance = 40;
                camera.farClip = 40;
                caster.setLocalScale(100, 2, 100);
                app.render();

                const snapshot = (cascade) => {
                    const data = light.getRenderData(camera.camera, cascade);
                    return {
                        position: data.shadowCamera.node.getPosition().clone(),
                        near: data.shadowCamera.nearClip,
                        far: data.shadowCamera.farClip,
                        radius: data.projectionCompensation,
                        matrix: Array.from(data.shadowMatrix.data),
                        casters: data.visibleCasters.slice()
                    };
                };
                const before = Array.from({ length: 4 }, (_, cascade) => snapshot(cascade));
                camera.entity.setPosition(4, 2, 5);
                light.shadowUpdateOverrides = Array.from({ length: 4 }, (_, cascade) => (
                    activeCascades.includes(cascade) ? SHADOWUPDATE_THISFRAME : SHADOWUPDATE_NONE
                ));
                const casterCull = sinon.spy(app.renderer.shadowRenderer, 'cullShadowCasters');
                renderFace.resetHistory();
                const updates = app.renderer._shadowMapUpdates;
                app.render();
                expect(casterCull.callCount).to.equal(activeCascades.length);
                expect(renderFace.getCalls().map(call => call.args[2])).to.eql(activeCascades);
                expect(app.renderer._shadowMapUpdates - updates).to.equal(activeCascades.length);
                const culledCameras = casterCull.getCalls().map(call => call.args[3]);
                for (let cascade = 0; cascade < 4; cascade++) {
                    const after = snapshot(cascade);
                    if (activeCascades.includes(cascade)) {
                        expect(after.position.equals(before[cascade].position)).to.equal(false);
                        expect(after.casters.length).to.be.greaterThan(0);
                        expect(after.far).to.be.lessThan(2000000);
                        expect(after.radius).to.be.greaterThan(0);
                        expect(culledCameras).to.include(light.getRenderData(camera.camera, cascade).shadowCamera);
                    } else {
                        expect(after).to.eql(before[cascade]);
                    }
                }
                expect(light.shadowUpdateOverrides).to.eql(Array(4).fill(SHADOWUPDATE_NONE));
            });
        });
    });

    it('renders one-shot cascade overrides for every scheduled camera', function () {
        const second = createCamera();
        second.entity.setPosition(3, 2, 5);
        app.render();
        light.shadowUpdateOverrides = [SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME];
        light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
        cull.resetHistory();
        renderFace.resetHistory();
        const updates = app.renderer._shadowMapUpdates;
        app.render();
        expect(cull.callCount).to.equal(2);
        expect(renderFace.getCalls().map(call => [call.args[1], call.args[2]])).to.eql([
            [camera.camera, 1], [second.camera, 1]
        ]);
        expect(app.renderer._shadowMapUpdates - updates).to.equal(2);
        expect(light.shadowUpdateOverrides).to.eql([SHADOWUPDATE_NONE, SHADOWUPDATE_NONE]);
        expect(light.shadowUpdateMode).to.equal(SHADOWUPDATE_NONE);
        app.render();
        expect(cull.callCount).to.equal(2);
        expect(renderFace.callCount).to.equal(2);
    });

    it('treats unspecified cascade overrides as enabled', function () {
        light.shadowUpdateOverrides = [SHADOWUPDATE_NONE];
        app.render();
        expect(renderFace.getCalls().map(call => call.args[2])).to.eql([1]);
        expect(app.renderer._shadowMapUpdates).to.equal(1);
    });

    it('supports direct directional culling and rendering used by the lightmapper', function () {
        app.render();
        light.shadowUpdateOverrides = [SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME];
        const renderer = app.renderer._shadowRendererDirectional;
        const casterCull = sinon.spy(app.renderer.shadowRenderer, 'cullShadowCasters');
        renderFace.resetHistory();
        renderer.prepareShadowMap(light, camera.camera);
        renderer.cull(light, app.scene.layers, camera.camera, caster.render.meshInstances);
        renderer.getLightRenderPass(light, camera.camera).render();
        expect(casterCull.calledOnce).to.equal(true);
        expect(casterCull.firstCall.args[3]).to.equal(light.getRenderData(camera.camera, 1).shadowCamera);
        expect(renderFace.getCalls().map(call => call.args[2])).to.eql([1]);
        expect(light.shadowUpdateOverrides).to.eql([SHADOWUPDATE_NONE, SHADOWUPDATE_NONE]);
    });

    [
        ['shadowType', SHADOW_PCF5_32F],
        ['shadowResolution', 512],
        ['numCascades', 4]
    ].forEach(([property, value]) => {
        it(`refreshes every cascade after ${property} changes despite a replaced schedule`, function () {
            app.render();
            light.shadowUpdateOverrides = Array(light.numCascades).fill(SHADOWUPDATE_NONE);
            light[property] = value;
            // Applications can rewrite their staggered schedule every frame, after invalidation.
            light.shadowUpdateOverrides = Array(light.numCascades).fill(SHADOWUPDATE_NONE);
            cull.resetHistory();
            renderFace.resetHistory();
            const updates = app.renderer._shadowMapUpdates;
            app.render();
            expect(cull.calledOnce).to.equal(true);
            expect(renderFace.getCalls().map(call => call.args[2])).to.eql(
                Array.from({ length: light.numCascades }, (_, cascade) => cascade)
            );
            expect(app.renderer._shadowMapUpdates - updates).to.equal(light.numCascades);
            expect(light.shadowUpdateOverrides).to.eql(Array(light.numCascades).fill(SHADOWUPDATE_NONE));

            app.render();
            expect(cull.callCount).to.equal(1);
            expect(renderFace.callCount).to.equal(light.numCascades);
            light.shadowUpdateOverrides[1] = SHADOWUPDATE_THISFRAME;
            app.render();
            expect(cull.callCount).to.equal(2);
            expect(renderFace.callCount).to.equal(light.numCascades + 1);
            expect(renderFace.lastCall.args[2]).to.equal(1);
        });
    });

    it('keeps a recreated map invalidated until a shadow pass is scheduled', function () {
        app.render();
        light.shadowResolution = 512;
        light.shadowUpdateOverrides = [SHADOWUPDATE_NONE, SHADOWUPDATE_NONE];
        camera.framePasses = [new FramePass(app.graphicsDevice)];
        cull.resetHistory();
        renderFace.resetHistory();
        app.render();
        expect(cull.called).to.equal(false);
        expect(renderFace.called).to.equal(false);

        camera.framePasses = null;
        app.render();
        expect(cull.calledOnce).to.equal(true);
        expect(renderFace.getCalls().map(call => call.args[2])).to.eql([0, 1]);
        app.render();
        expect(cull.callCount).to.equal(1);
        expect(renderFace.callCount).to.equal(2);
    });

    it('does not let map invalidation bypass the light-wide NONE mode', function () {
        app.render();
        light.shadowType = SHADOW_PCF5_32F;
        light.shadowUpdateOverrides = [SHADOWUPDATE_NONE, SHADOWUPDATE_NONE];
        light.shadowUpdateMode = SHADOWUPDATE_NONE;
        cull.resetHistory();
        renderFace.resetHistory();
        app.render();
        expect(cull.called).to.equal(false);
        expect(renderFace.called).to.equal(false);
        expect(light.shadowUpdateMode).to.equal(SHADOWUPDATE_NONE);

        light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
        app.render();
        expect(cull.calledOnce).to.equal(true);
        expect(renderFace.getCalls().map(call => call.args[2])).to.eql([0, 1]);
        expect(light.shadowUpdateMode).to.equal(SHADOWUPDATE_NONE);
    });

    it('initializes a recreated map for every scheduled camera', function () {
        const second = createCamera();
        app.render();
        light.shadowResolution = 512;
        light.shadowUpdateOverrides = [SHADOWUPDATE_NONE, SHADOWUPDATE_NONE];
        renderFace.resetHistory();
        app.render();
        expect(renderFace.getCalls().map(call => [call.args[1], call.args[2]])).to.eql([
            [camera.camera, 0], [camera.camera, 1], [second.camera, 0], [second.camera, 1]
        ]);
    });

    it('keeps local shadow culling independent of directional requests', function () {
        camera.framePasses = [new FramePass(app.graphicsDevice)];
        const entity = new Entity('Spot');
        entity.addComponent('light', { type: 'spot', castShadows: true, shadowUpdateMode: SHADOWUPDATE_REALTIME });
        app.root.addChild(entity);
        const localCull = sinon.spy(app.renderer._shadowRendererLocal, 'cull');
        app.render();
        expect(cull.called).to.equal(false);
        expect(localCull.calledOnce).to.equal(true);
    });
});
