import { expect } from 'chai';
import sinon from 'sinon';

import { Entity } from '../../../src/framework/entity.js';
import { FramePass } from '../../../src/platform/graphics/frame-pass.js';
import { SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME, SHADOWUPDATE_REALTIME } from '../../../src/scene/constants.js';
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
            app.render();
            expect(cull.called).to.equal(false);
            expect(renderFace.called).to.equal(false);
            expect(light.shadowUpdateMode).to.equal(SHADOWUPDATE_THISFRAME);
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
