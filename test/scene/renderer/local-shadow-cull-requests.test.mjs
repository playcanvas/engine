import { expect } from 'chai';
import sinon from 'sinon';

import { Entity } from '../../../src/framework/entity.js';
import { Lightmapper } from '../../../src/framework/lightmapper/lightmapper.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME } from '../../../src/scene/constants.js';
import { RenderPassShadowLocalClustered } from '../../../src/scene/renderer/render-pass-shadow-local-clustered.js';
import { RenderPassShadowLocalNonClustered } from '../../../src/scene/renderer/render-pass-shadow-local-non-clustered.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('Local shadow cull requests', function () {
    let app;
    let caster;
    let cull;
    let renderFace;
    let cookie;

    const createLight = (type = 'spot') => {
        const entity = new Entity('Light');
        entity.addComponent('light', { type, castShadows: true, shadowResolution: 256 });
        entity.setPosition(0, 2, 0);
        app.root.addChild(entity);
        return entity.light.light;
    };

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        app.scene.lighting.shadowAtlasResolution = 256;
        app.scene.lighting.cookieAtlasResolution = 256;
        const camera = new Entity('Camera');
        camera.addComponent('camera');
        camera.setPosition(0, 2, 5);
        camera.lookAt(0, 0, 0);
        app.root.addChild(camera);
        caster = new Entity('Caster');
        caster.addComponent('render', { type: 'box' });
        app.root.addChild(caster);
        cull = sinon.spy(app.renderer._shadowRendererLocal, 'cull');
        renderFace = sinon.spy(app.renderer.shadowRenderer, 'renderFace');
    });

    afterEach(function () {
        sinon.restore();
        cookie?.destroy();
        cookie = null;
        app.destroy();
        jsdomTeardown();
    });

    [true, false].forEach((clustered) => {
        ['spot', 'omni'].forEach((type) => {
            describe(`${clustered ? 'clustered' : 'non-clustered'} ${type}`, function () {
                let light;
                const faces = type === 'omni' ? 6 : 1;

                beforeEach(function () {
                    // WebGPU only supports clustered lighting
                    if (!clustered && app.graphicsDevice.isWebGPU) {
                        this.skip();
                    }
                    app.scene.clusteredLightingEnabled = clustered;
                    light = createLight(type);
                });

                it('culls once per light each frame and accounts for every rendered face', function () {
                    const omniCull = sinon.spy(app.renderer.shadowRenderer, 'cullShadowCastersOmni');
                    app.render();
                    app.render();
                    expect(cull.callCount).to.equal(2);
                    expect(renderFace.callCount).to.equal(faces * 2);
                    expect(app.renderer._shadowMapUpdates).to.equal(faces * 2);
                    expect(omniCull.callCount).to.equal(type === 'omni' ? 2 : 0);
                });

                it('caches a one-shot shadow and resumes only for a requested refresh', function () {
                    light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
                    app.render();
                    expect(light.shadowUpdateMode).to.equal(SHADOWUPDATE_NONE);
                    app.render();
                    expect(cull.callCount).to.equal(1);
                    expect(renderFace.callCount).to.equal(faces);
                    expect(app.renderer._shadowMapUpdates).to.equal(faces);
                    expect(light.getRenderData(null, 0).shadowCullRequested).to.equal(false);

                    light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
                    app.render();
                    expect(cull.callCount).to.equal(2);
                    expect(renderFace.callCount).to.equal(faces * 2);
                    expect(light.shadowUpdateMode).to.equal(SHADOWUPDATE_NONE);
                });

                it('preserves the forced initial update when starting in NONE', function () {
                    light.shadowUpdateMode = SHADOWUPDATE_NONE;
                    app.render();
                    expect(cull.calledOnce).to.equal(true);
                    expect(renderFace.callCount).to.equal(faces);
                    expect(light.shadowUpdateMode).to.equal(SHADOWUPDATE_NONE);
                });

                ['enabled', 'executeEnabled'].forEach((property) => {
                    it(`keeps THISFRAME pending when the shadow pass has ${property} disabled`, function () {
                        const prototype = clustered ? RenderPassShadowLocalClustered.prototype : RenderPassShadowLocalNonClustered.prototype;
                        const frameUpdate = prototype.frameUpdate;
                        sinon.stub(prototype, 'frameUpdate').callsFake(function () {
                            this[property] = false;
                            frameUpdate.call(this);
                        });
                        light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
                        app.render();
                        expect(cull.called).to.equal(false);
                        expect(renderFace.called).to.equal(false);
                        expect(app.renderer._shadowMapUpdates).to.equal(0);
                        expect(light.shadowUpdateMode).to.equal(SHADOWUPDATE_THISFRAME);
                    });
                });

                it('supports direct lightmapper rendering without registering a cull request', function () {
                    // Initialize the renderer, then exercise the lightmapper's explicit cull/render
                    // path using fresh render data, without adding its passes to a frame graph.
                    app.render();
                    light.releaseRenderData();
                    cull.resetHistory();
                    renderFace.resetHistory();
                    const request = sinon.spy(app.renderer.culler, 'requestLocalShadowCull');
                    const pass = new RenderPassShadowLocalClustered(app.graphicsDevice, app.renderer.shadowRenderer, app.renderer._shadowRendererLocal);
                    Lightmapper.prototype.renderShadowMap.call({
                        scene: app.scene,
                        renderer: app.renderer,
                        device: app.graphicsDevice,
                        shadowLocalClusteredPass: pass
                    }, app.scene.layers, false, caster.render.meshInstances, { light });
                    expect(cull.calledOnce).to.equal(true);
                    expect(renderFace.callCount).to.equal(faces);
                    expect(request.called).to.equal(false);
                    pass.destroy();
                });
            });
        });
    });

    ['spot', 'omni'].forEach((type) => {
        it(`skips ${type} culling when clustered shadows are disabled`, function () {
            const light = createLight(type);
            light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
            app.scene.lighting.shadowsEnabled = false;
            app.render();
            expect(cull.called).to.equal(false);
            expect(renderFace.called).to.equal(false);
            expect(light.shadowUpdateMode).to.equal(SHADOWUPDATE_THISFRAME);
            expect(app.renderer._shadowMapUpdates).to.equal(0);
        });
    });

    it('does not consume a one-shot shadow just because a cookie has an atlas slot', function () {
        const light = createLight();
        cookie = new Texture(app.graphicsDevice, { width: 4, height: 4 });
        light.cookie = cookie;
        light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
        app.scene.lighting.cookiesEnabled = true;
        app.scene.lighting.shadowsEnabled = false;
        app.render();
        expect(light.atlasViewportAllocated).to.equal(true);
        expect(cull.called).to.equal(false);
        expect(renderFace.called).to.equal(false);
        expect(light.shadowUpdateMode).to.equal(SHADOWUPDATE_THISFRAME);
        expect(app.renderer._shadowMapUpdates).to.equal(0);

        app.scene.lighting.shadowsEnabled = true;
        app.render();
        expect(cull.calledOnce).to.equal(true);
        expect(renderFace.calledOnce).to.equal(true);
        expect(light.shadowUpdateMode).to.equal(SHADOWUPDATE_NONE);
    });

    it('culls only lights admitted to a full atlas and preserves waiting requests', function () {
        app.scene.lighting.atlasSplit = [1];
        const lights = [createLight(), createLight()];
        lights.forEach((light) => {
            light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
        });
        app.render();
        expect(cull.calledOnce).to.equal(true);
        expect(renderFace.calledOnce).to.equal(true);
        const allocated = lights.find(light => light.atlasViewportAllocated);
        const waiting = lights.find(light => !light.atlasViewportAllocated);
        expect(allocated.shadowUpdateMode).to.equal(SHADOWUPDATE_NONE);
        expect(waiting.shadowUpdateMode).to.equal(SHADOWUPDATE_THISFRAME);
    });

    it('refreshes cached shadows when atlas subdivision changes', function () {
        const light = createLight();
        light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
        app.render();
        app.scene.lighting.atlasSplit = [2];
        app.render();
        expect(light.atlasSlotUpdated).to.equal(true);
        expect(cull.callCount).to.equal(2);
        expect(renderFace.callCount).to.equal(2);
        expect(light.shadowUpdateMode).to.equal(SHADOWUPDATE_NONE);
    });

    it('discards previous requests while clustered shadows are disabled', function () {
        const light = createLight();
        app.render();
        app.scene.lighting.shadowsEnabled = false;
        light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
        app.render();
        expect(cull.callCount).to.equal(1);
        expect(renderFace.callCount).to.equal(1);
        expect(light.getRenderData(null, 0).shadowCullRequested).to.equal(false);
        expect(light.shadowUpdateMode).to.equal(SHADOWUPDATE_THISFRAME);
    });
});
