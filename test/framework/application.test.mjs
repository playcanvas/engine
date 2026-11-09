import { expect } from 'chai';
import { restore, spy, stub } from 'sinon';

import { Debug } from '../../src/core/debug.js';
import { app as currentApp } from '../../src/framework/app-base.js';
import { AssetRegistry } from '../../src/framework/asset/asset-registry.js';
import { Asset } from '../../src/framework/asset/asset.js';
import { ComponentSystemRegistry } from '../../src/framework/components/registry.js';
import { FILLMODE_KEEP_ASPECT, RESOLUTION_FIXED } from '../../src/framework/constants.js';
import { Entity } from '../../src/framework/entity.js';
import { getApplication } from '../../src/framework/globals.js';
import { ResourceLoader } from '../../src/framework/handlers/loader.js';
import { I18n } from '../../src/framework/i18n/i18n.js';
import { Lightmapper } from '../../src/framework/lightmapper/lightmapper.js';
import { SceneRegistry } from '../../src/framework/scene-registry.js';
import { ScriptRegistry } from '../../src/framework/script/script-registry.js';
import { XrManager } from '../../src/framework/xr/xr-manager.js';
import { GraphicsDevice } from '../../src/platform/graphics/graphics-device.js';
import { BatchManager } from '../../src/scene/batching/batch-manager.js';
import { Mesh } from '../../src/scene/mesh.js';
import { Render } from '../../src/scene/render.js';
import { Scene } from '../../src/scene/scene.js';
import { createApp } from '../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../jsdom.mjs';

describe('Application', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        restore();
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    describe('#constructor', function () {

        it('support no options', function () {
            expect(app.assets).to.be.instanceOf(AssetRegistry);
            expect(app.autoRender).to.be.true;
            expect(app.batcher).to.be.instanceOf(BatchManager);
            expect(app.elementInput).to.be.null;
            expect(app.fillMode).to.equal(FILLMODE_KEEP_ASPECT);
            expect(app.gamepads).to.be.null;
            expect(app.graphicsDevice).to.be.instanceOf(GraphicsDevice);
            expect(app.i18n).to.be.instanceOf(I18n);
            expect(app.keyboard).to.be.null;
            expect(app.lightmapper).to.be.instanceOf(Lightmapper);
            expect(app.loader).to.be.instanceof(ResourceLoader);
            expect(app.maxDeltaTime).to.equal(0.1);
            expect(app.mouse).to.be.null;
            expect(app.renderNextFrame).to.be.false;
            expect(app.resolutionMode).to.equal(RESOLUTION_FIXED);
            expect(app.root).to.be.instanceOf(Entity);
            expect(app.scene).to.be.instanceof(Scene);
            expect(app.scenes).to.be.instanceof(SceneRegistry);
            expect(app.scripts).to.be.instanceof(ScriptRegistry);
            expect(app.systems).to.be.instanceof(ComponentSystemRegistry);
            expect(app.timeScale).to.equal(1);
            expect(app.touch).to.be.null;
            expect(app.xr).to.be.instanceof(XrManager);
        });

    });

    describe('#stats', function () {

        it('returns stats for the owning application when multiple applications exist', function () {
            const app2 = createApp();

            try {
                expect(app.stats.scene).to.equal(app.scene._stats);
                expect(app.stats.lightmapper).to.equal(app.lightmapper.stats);
                expect(app.stats.batcher).to.equal(app.batcher._stats);
            } finally {
                app2.destroy();
            }
        });

    });

    describe('#destroy', function () {

        it('destroys the application', function () {
            app.destroy();

            expect(app.assets).to.be.null;
            expect(app.batcher).to.be.null;
            expect(app.elementInput).to.be.null;
            expect(app.gamepads).to.be.null;
            expect(app.graphicsDevice).to.be.null;
            expect(app.i18n).to.be.null;
            expect(app.keyboard).to.be.null;
            expect(app.lightmapper).to.be.null;
            expect(app.loader).to.be.null;
            expect(app.mouse).to.be.null;
            expect(app.root).to.be.null;
            expect(app.scene).to.be.null;
            expect(app.scenes).to.be.null;
            expect(app.scripts).to.be.null;
            expect(app.systems).to.be.null;
            expect(app.touch).to.be.null;
            // expect(app.xr).to.be.null;

            app = null;
        });

        it('clears the references to the application', function () {
            const loader = app.loader;

            expect(currentApp).to.equal(app);
            expect(getApplication()).to.equal(app);

            app.destroy();

            // the destroyed application must not be reachable from module scope or from objects
            // which may outlive it
            expect(currentApp).to.be.null;
            expect(getApplication()).to.be.null;
            expect(loader._app).to.be.null;

            app = null;
        });

        it('clears the registry reference of assets that outlive the application', function () {
            const asset = new Asset('Asset', 'text', {
                url: 'fake/one/file.txt'
            });
            app.assets.add(asset);

            app.destroy();

            // an asset held on to by user code must not keep the registry, and through it the
            // application, alive
            expect(asset.registry).to.be.null;

            app = null;
        });

    });

    describe('#preload', function () {

        function createContainer() {
            const render = new Render();
            render.meshes = [new Mesh(app.graphicsDevice)];
            const asset = new Asset('container', 'container', { url: 'fake/container.glb' });
            asset.resource = { renders: [{ resource: render }] };
            asset.loaded = true;
            return asset;
        }

        function createRender(container) {
            const asset = new Asset('render', 'render', null, {
                containerAsset: container.id,
                renderIndex: 0
            });
            asset.preload = true;
            return asset;
        }

        it('completes without warning when a render asset is registered before its container', function () {
            const warn = stub(Debug, 'warnOnce');
            const container = createContainer();
            const render = createRender(container);
            const done = spy();

            // the Editor launch page registers assets in an arbitrary order before preloading
            app.assets.add(render);
            app.assets.add(container);
            app.preload(done);

            expect(done.calledOnce).to.equal(true);
            expect(render.resource.meshes).to.equal(container.resource.renders[0].resource.meshes);
            expect(warn.called).to.equal(false);
        });

        it('warns about a preloaded render asset whose container is not registered', function () {
            const warn = stub(Debug, 'warnOnce');
            const container = createContainer();
            const render = createRender(container);
            const done = spy();

            app.assets.add(render);
            app.preload(done);

            expect(done.called).to.equal(false);
            expect(warn.calledOnce).to.equal(true);
            expect(warn.firstCall.args[0]).to.include(`'${render.name}' (${render.id})`);
            expect(warn.firstCall.args[0]).to.include(`container asset ${container.id}, which is not registered`);

            app.assets.add(container);
            expect(done.calledOnce).to.equal(true);
        });

    });

});
