import { expect } from 'chai';
import sinon from 'sinon';

import { Entity } from '../../../src/framework/entity.js';
import { FramePass } from '../../../src/platform/graphics/frame-pass.js';
import { Camera } from '../../../src/scene/camera.js';
import { FramePassMultiView } from '../../../src/scene/renderer/frame-pass-multi-view.js';
import { RenderPassForward } from '../../../src/scene/renderer/render-pass-forward.js';
import { RenderPassShadowDirectional } from '../../../src/scene/renderer/render-pass-shadow-directional.js';
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

        describe('with a pass rendering the camera', function () {

            // the passes rendering the first camera and its render events, in the order they run in
            // a frame, naming the given pass 'before' and the others 'scene'
            const renderOrder = (before) => {
                const order = [];
                const onPrerender = (camera) => {
                    if (camera === first) order.push('prerender');
                };
                const onPostrender = (camera) => {
                    if (camera === first) order.push('postrender');
                };
                app.scene.on('prerender', onPrerender);
                app.scene.on('postrender', onPostrender);
                const execute = sinon.stub(RenderPassForward.prototype, 'execute').callsFake(function () {
                    if (rendersCamera(this, first)) order.push(this === before ? 'before' : 'scene');
                });

                renderFrame();

                execute.restore();
                app.scene.off('prerender', onPrerender);
                app.scene.off('postrender', onPostrender);
                return order;
            };

            const createScenePass = (transparent) => {
                const pass = new RenderPassForward(app.graphicsDevice, app.scene.layers, app.scene, app.renderer);
                pass.init(null);
                pass.addLayer(first, app.scene.layers.getLayerByName('World'), false);
                if (transparent) {
                    pass.addLayer(first, app.scene.layers.getLayerByName('World'), true);
                }
                return pass;
            };

            it('fire the render events of the camera around it, when the camera renders the layers', function () {
                const before = createScenePass(false);
                first.beforePasses.push(before);

                for (let i = 0; i < 2; i++) {
                    expect(renderOrder(before)).to.deep.equal(['prerender', 'before', 'scene', 'postrender']);
                }
            });

            it('fire the render events of the camera around it, when the camera renders its frame passes', function () {
                const before = createScenePass(false);
                first.beforePasses.push(before);
                first.framePasses = [createScenePass(true)];

                for (let i = 0; i < 2; i++) {
                    expect(renderOrder(before)).to.deep.equal(['prerender', 'before', 'scene', 'postrender']);
                }
            });
        });
    });

    describe('#framePasses', function () {

        it('skip a disabled scene pass, with the shadow and camera passes it renders before', function () {
            second.enabled = false;

            const light = new Entity('Light');
            light.addComponent('light', { type: 'directional', castShadows: true });
            app.root.addChild(light);

            const caster = new Entity('Caster');
            caster.addComponent('render', { type: 'box' });
            app.root.addChild(caster);

            const before = createPass('Before');
            first.beforePasses.push(before);

            const scenePass = new RenderPassForward(app.graphicsDevice, app.scene.layers, app.scene, app.renderer);
            scenePass.init(null);
            scenePass.addLayer(first, app.scene.layers.getLayerByName('World'), false);
            scenePass.enabled = false;
            first.framePasses = [scenePass];

            // frames rendered while the pass is disabled schedule none of them
            for (let i = 0; i < 3; i++) {
                const passes = renderFrame();
                expect(passes).to.not.include(scenePass);
                expect(passes).to.not.include(before);
                expect(passes.some(pass => pass instanceof RenderPassShadowDirectional)).to.equal(false);
            }

            // once enabled, each of them renders once in the frame
            scenePass.enabled = true;
            const passes = renderFrame();
            expect(passes.filter(pass => pass === scenePass)).to.have.lengthOf(1);
            expect(passes.filter(pass => pass === before)).to.have.lengthOf(1);
            expect(passes.filter(pass => pass instanceof RenderPassShadowDirectional)).to.have.lengthOf(1);
        });

        it('render the before-passes of the camera and fire its render events once, with the scene split between hand-built passes', function () {
            const before = createPass('Before');
            first.beforePasses.push(before);

            const world = app.scene.layers.getLayerByName('World');
            const opaquePass = new RenderPassForward(app.graphicsDevice, app.scene.layers, app.scene, app.renderer);
            opaquePass.init(null);
            opaquePass.addLayer(first, world, false);
            const transparentPass = new RenderPassForward(app.graphicsDevice, app.scene.layers, app.scene, app.renderer);
            transparentPass.init(null);
            transparentPass.addLayer(first, world, true, false);
            first.framePasses = [opaquePass, transparentPass];

            const prerender = sinon.spy();
            const postrender = sinon.spy();
            app.scene.on('prerender', prerender);
            app.scene.on('postrender', postrender);

            // the number of times the event fired for the camera
            const callCount = spy => spy.getCalls().filter(call => call.args[0] === first).length;

            for (let i = 0; i < 2; i++) {
                prerender.resetHistory();
                postrender.resetHistory();

                const passes = renderFrame();
                expect(passes.filter(pass => pass === before)).to.have.lengthOf(1);
                expect(passes.indexOf(before)).to.be.below(passes.indexOf(opaquePass));
                expect(callCount(prerender)).to.equal(1);
                expect(callCount(postrender)).to.equal(1);

                // the camera starts rendering in the first pass, and finishes in the second one
                expect(opaquePass.layerRenderSteps[0].firstCameraUse).to.equal(true);
                expect(transparentPass.layerRenderSteps[0].lastCameraUse).to.equal(true);
            }
        });
    });
});
