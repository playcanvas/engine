import { FILLMODE_KEEP_ASPECT, RESOLUTION_FIXED } from '../../src/framework/constants.mjs';
import { Application } from '../../src/framework/application.mjs';
import { AssetRegistry } from '../../src/framework/asset/asset-registry.mjs';
import { BatchManager } from '../../src/scene/batching/batch-manager.mjs';
import { ComponentSystemRegistry } from '../../src/framework/components/registry.mjs';
import { Entity } from '../../src/framework/entity.mjs';
import { GraphicsDevice } from '../../src/platform/graphics/graphics-device.mjs';
import { I18n } from '../../src/framework/i18n/i18n.mjs';
import { Lightmapper } from '../../src/framework/lightmapper/lightmapper.mjs';
import { ResourceLoader } from '../../src/framework/handlers/loader.mjs';
import { Scene } from '../../src/scene/scene.mjs';
import { SceneRegistry } from '../../src/framework/scene-registry.mjs';
import { ScriptRegistry } from '../../src/framework/script/script-registry.mjs';
import { XrManager } from '../../src/framework/xr/xr-manager.mjs';

import { HTMLCanvasElement } from '@playcanvas/canvas-mock';

import { expect } from 'chai';

describe('Application', function () {

    describe('#constructor', function () {

        it('support no options', function () {
            const canvas = new HTMLCanvasElement(500, 500);
            const app = new Application(canvas);

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

    describe('#destroy', function () {

        it('destroys the application', function () {
            const canvas = new HTMLCanvasElement(500, 500);
            const app = new Application(canvas);

            app.destroy();
//            expect(app.assets).to.be.null;
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
//            expect(app.xr).to.be.null;
        });

    });

});
