import { expect } from 'chai';

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

});
