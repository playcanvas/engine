import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { Entity } from '../../../src/framework/entity.js';
import { FramePass } from '../../../src/platform/graphics/frame-pass.js';
import { LayerRenderStep } from '../../../src/scene/renderer/layer-render-step.js';
import { RenderPassForward } from '../../../src/scene/renderer/render-pass-forward.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * @import { Application } from '../../../src/framework/application.js'
 * @import { CameraComponent } from '../../../src/framework/components/camera/component.js'
 */

describe('RenderPassForward', function () {
    /** @type {Application} */
    let app;

    /** @type {CameraComponent} */
    let first;

    /** @type {CameraComponent} */
    let second;

    const createCamera = (name) => {
        const entity = new Entity(name);
        entity.addComponent('camera');
        app.root.addChild(entity);
        return entity.camera;
    };

    // a pass rendering the world opaque and the ui transparent sublayers with the camera
    const createPass = (camera) => {
        const pass = new RenderPassForward(app.graphicsDevice, app.scene.layers, app.scene, app.renderer, camera);
        pass.init(null);
        pass.addLayer(app.scene.layers.getLayerByName('World'), false);
        pass.addLayer(app.scene.layers.getLayerByName('UI'), true);
        return pass;
    };

    // schedules the passes in a new frame
    const schedule = (...passes) => {
        app.renderer.frameUpdate();
        passes.forEach(pass => pass.frameUpdate());
    };

    // the passes, flagged as [firstCameraUse, lastCameraUse]
    const flags = (...passes) => passes.map(pass => [pass.firstCameraUse, pass.lastCameraUse]);

    // true if an assertion failed
    const assertFailed = assertion => assertion.getCalls().some(call => !call.args[0]);

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        first = createCamera('First');
        second = createCamera('Second');
    });

    afterEach(function () {
        restore();
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    describe('#addLayer', function () {

        it('renders the layers with the camera of the pass', function () {
            const pass = createPass(first);

            expect(pass.cameraComponent).to.equal(first);
            expect(pass.layerRenderSteps.map(step => step.cameraComponent)).to.deep.equal([first, first]);
        });

        it('asserts a camera component passed in place of the layer', function () {
            const pass = createPass(first);
            const assertion = stub(Debug, 'assert');

            pass.addLayer(first, app.scene.layers.getLayerByName('World'), false);
            expect(assertFailed(assertion)).to.equal(true);
        });
    });

    describe('#constructor', function () {

        it('asserts a missing camera component', function () {
            const assertion = stub(Debug, 'assert');

            new RenderPassForward(app.graphicsDevice, app.scene.layers, app.scene, app.renderer); // eslint-disable-line no-new
            expect(assertFailed(assertion)).to.equal(true);
        });
    });

    describe('#addLayerRenderStep', function () {

        it('asserts a step rendering with another camera', function () {
            const pass = createPass(first);
            const assertion = stub(Debug, 'assert');

            pass.addLayerRenderStep(new LayerRenderStep(first, app.scene.layers.getLayerByName('World'), false, null));
            expect(assertFailed(assertion)).to.equal(false);

            pass.addLayerRenderStep(new LayerRenderStep(second, app.scene.layers.getLayerByName('World'), false, null));
            expect(assertFailed(assertion)).to.equal(true);
        });
    });

    describe('#frameUpdate', function () {

        it('collects the before-passes of the camera again each time, without rendering in between', function () {
            const before = new FramePass(app.graphicsDevice);
            first.beforePasses.push(before);

            const pass = createPass(first);
            pass.frameUpdate();
            pass.frameUpdate();

            expect(pass.internalBeforePasses).to.deep.equal([before]);
        });

        it('keeps the before-passes set up by the user', function () {
            const cameraBefore = new FramePass(app.graphicsDevice);
            first.beforePasses.push(cameraBefore);

            const pass = createPass(first);
            const own = new FramePass(app.graphicsDevice);
            pass.beforePasses.push(own);

            pass.frameUpdate();
            pass.frameUpdate();

            expect(pass.beforePasses).to.deep.equal([own]);
            expect(pass.internalBeforePasses).to.deep.equal([cameraBefore]);
        });

        describe('camera use', function () {

            it('marks the first and the last pass rendering each camera', function () {
                const passA = createPass(first);
                const passB = createPass(second);
                const passC = createPass(first);
                schedule(passA, passB, passC);

                expect(flags(passA, passC)).to.deep.equal([[true, false], [false, true]]);
                expect(flags(passB)).to.deep.equal([[true, true]]);
            });

            it('marks the passes of each frame in the order they are scheduled', function () {
                const passA = createPass(first);
                const passB = createPass(first);
                schedule(passA, passB);
                schedule(passB, passA);

                expect(flags(passB, passA)).to.deep.equal([[true, false], [false, true]]);
            });

            it('marks a pass scheduled on its own as the first and the last use of the camera', function () {
                const passA = createPass(first);
                const passB = createPass(first);
                schedule(passA, passB);
                schedule(passB);

                expect(flags(passB)).to.deep.equal([[true, true]]);
            });

            it('collects the before-passes of the camera only in the pass rendering it first', function () {
                const before = new FramePass(app.graphicsDevice);
                first.beforePasses.push(before);

                const passA = createPass(first);
                const passB = createPass(first);
                schedule(passA, passB);

                expect(passA.internalBeforePasses).to.deep.equal([before]);
                expect(passB.internalBeforePasses).to.deep.equal([]);
            });
        });

        describe('nesting', function () {

            it('asserts a RenderPassForward among its before-passes or after-passes', function () {
                for (const list of ['beforePasses', 'afterPasses']) {
                    const pass = createPass(first);
                    pass[list].push(createPass(second));

                    const assertion = stub(Debug, 'assert');
                    schedule(pass);
                    expect(assertFailed(assertion), list).to.equal(true);
                    restore();
                }
            });

            it('asserts a RenderPassForward among the before-passes of its camera', function () {
                first.beforePasses.push(createPass(first));
                const pass = createPass(first);

                const assertion = stub(Debug, 'assert');
                schedule(pass);
                expect(assertFailed(assertion)).to.equal(true);
            });

            it('asserts a RenderPassForward nested deeper, under another pass', function () {
                const container = new FramePass(app.graphicsDevice);
                container.beforePasses.push(createPass(second));
                const pass = createPass(first);
                pass.beforePasses.push(container);

                const assertion = stub(Debug, 'assert');
                schedule(pass);
                expect(assertFailed(assertion)).to.equal(true);
            });

            it('does not assert its own passes, nor a container of RenderPassForward passes', function () {
                const pass = createPass(first);
                pass.beforePasses.push(new FramePass(app.graphicsDevice));
                first.beforePasses.push(new FramePass(app.graphicsDevice));

                const assertion = stub(Debug, 'assert');
                schedule(pass);
                expect(assertFailed(assertion)).to.equal(false);
            });
        });
    });
});
