import { expect } from 'chai';

import { Entity } from '../../../src/framework/entity.js';
import { FramePass } from '../../../src/platform/graphics/frame-pass.js';
import { RenderPassForward } from '../../../src/scene/renderer/render-pass-forward.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * @import { Application } from '../../../src/framework/application.js'
 */

describe('RenderPassForward', function () {
    /** @type {Application} */
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

    describe('#frameUpdate', function () {

        it('collects the before-passes of the camera again each time, without rendering in between', function () {
            const entity = new Entity('Camera');
            entity.addComponent('camera');
            app.root.addChild(entity);

            const before = new FramePass(app.graphicsDevice);
            entity.camera.beforePasses.push(before);

            const pass = new RenderPassForward(app.graphicsDevice, app.scene.layers, app.scene, app.renderer);
            pass.init(null);
            pass.addLayer(entity.camera, app.scene.layers.getLayerByName('World'), false);
            pass.layerRenderSteps[0].firstCameraUse = true;

            pass.frameUpdate();
            pass.frameUpdate();

            expect(pass.beforePasses).to.deep.equal([before]);
        });
    });
});
