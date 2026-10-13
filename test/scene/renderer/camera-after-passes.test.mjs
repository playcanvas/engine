import { expect } from 'chai';
import sinon from 'sinon';

import { Entity } from '../../../src/framework/entity.js';
import { FramePass } from '../../../src/platform/graphics/frame-pass.js';
import { Camera } from '../../../src/scene/camera.js';
import { FramePassMultiView } from '../../../src/scene/renderer/frame-pass-multi-view.js';
import { RenderPassForward } from '../../../src/scene/renderer/render-pass-forward.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * @import { Application } from '../../../src/framework/application.js'
 * @import { CameraComponent } from '../../../src/framework/components/camera/component.js'
 */

describe('Camera passes', function () {
    /** @type {Application} */
    let app;

    /** @type {CameraComponent} */
    let first;

    /** @type {CameraComponent} */
    let second;

    const createCamera = (name, priority) => {
        const entity = new Entity(name);
        entity.addComponent('camera', { priority });
        app.root.addChild(entity);
        return entity.camera;
    };

    const createPass = (name) => {
        const pass = new FramePass(app.graphicsDevice);
        pass.name = name;
        return pass;
    };

    // the passes the frame rendered
    const renderFrame = () => {
        app.render();
        return app.frameGraph.renderPasses;
    };

    // whether the pass renders the camera
    const rendersCamera = (pass, camera) => {
        return pass instanceof RenderPassForward && pass.layerRenderSteps.some(step => step.cameraComponent === camera);
    };

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        first = createCamera('First', 0);
        second = createCamera('Second', 1);
    });

    afterEach(function () {
        sinon.restore();
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    describe('#afterPasses', function () {

        it('are the passes of the camera', function () {
            expect(first.afterPasses).to.equal(first.camera.afterPasses);
            expect(first.beforePasses).to.equal(first.camera.beforePasses);
        });

        it('execute after the camera renders, and before the next camera', function () {
            const after = createPass('After');
            first.afterPasses.push(after);

            const passes = renderFrame();
            const index = passes.indexOf(after);
            expect(index).to.be.greaterThan(passes.findLastIndex(pass => rendersCamera(pass, first)));
            expect(index).to.be.lessThan(passes.findIndex(pass => rendersCamera(pass, second)));
        });

        it('execute after the scene maps of the camera are grabbed', function () {
            first.requestSceneColorMap(true);
            first.requestSceneDepthMap(true);
            const after = createPass('After');
            first.afterPasses.push(after);

            const passes = renderFrame();
            const index = passes.indexOf(after);
            const colorGrab = passes.indexOf(first.camera.renderPassColorGrab);
            const depthGrab = passes.indexOf(first.camera.renderPassDepthGrab);
            expect(colorGrab).to.be.at.least(0);
            expect(depthGrab).to.be.at.least(0);
            expect(index).to.be.greaterThan(colorGrab);
            expect(index).to.be.greaterThan(depthGrab);
            expect(index).to.be.greaterThan(passes.findLastIndex(pass => rendersCamera(pass, first)));
        });

        it('execute after the frame passes of a camera using those', function () {
            const framePasses = [createPass('Frame0'), createPass('Frame1')];
            first.framePasses = framePasses;
            const after = createPass('After');
            first.afterPasses.push(after);

            const passes = renderFrame();
            const index = passes.indexOf(after);
            expect(index).to.equal(passes.indexOf(framePasses[1]) + 1);
            expect(index).to.be.lessThan(passes.findIndex(pass => rendersCamera(pass, second)));
        });

        it('execute once, after the passes of all the XR views', function () {
            second.enabled = false;
            sinon.stub(app.renderer, '_isMultiview').returns(true);
            const after = createPass('After');
            first.afterPasses.push(after);

            const passes = renderFrame();
            const index = passes.indexOf(after);
            const wrappers = passes.filter(pass => pass instanceof FramePassMultiView);
            expect(wrappers).to.not.be.empty;
            wrappers.forEach((wrapper) => {
                expect(wrapper.children).to.not.include(after);
                expect(passes.indexOf(wrapper)).to.be.lessThan(index);
            });
        });

        it('skip a disabled pass', function () {
            const after = createPass('After');
            after.enabled = false;
            first.afterPasses.push(after);

            expect(renderFrame()).to.not.include(after);
        });

        it('are released when the camera is destroyed', function () {
            const camera = new Camera(app.graphicsDevice);
            camera.afterPasses.push(createPass('After'));
            camera.destroy();
            expect(camera.afterPasses).to.have.lengthOf(0);
        });
    });

    describe('#beforePasses', function () {

        it('execute before the camera renders', function () {
            const before = createPass('Before');
            second.beforePasses.push(before);

            const passes = renderFrame();
            const index = passes.indexOf(before);
            expect(index).to.be.greaterThan(passes.findLastIndex(pass => rendersCamera(pass, first)));
            expect(index).to.be.lessThan(passes.findIndex(pass => rendersCamera(pass, second)));
        });
    });
});
