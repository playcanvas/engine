import { expect } from 'chai';
import sinon from 'sinon';

import { Entity } from '../../../src/framework/entity.js';
import { FramePass } from '../../../src/platform/graphics/frame-pass.js';
import { RenderTarget } from '../../../src/platform/graphics/render-target.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
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

            const scenePass = new RenderPassForward(app.graphicsDevice, app.scene.layers, app.scene, app.renderer, first);
            scenePass.init(null);
            scenePass.addLayer(app.scene.layers.getLayerByName('World'), false);
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

        it('render the before-passes of a hand-built scene pass every frame, after its shadow and camera passes', function () {
            second.enabled = false;

            const light = new Entity('Light');
            light.addComponent('light', { type: 'directional', castShadows: true });
            app.root.addChild(light);

            const caster = new Entity('Caster');
            caster.addComponent('render', { type: 'box' });
            app.root.addChild(caster);

            const cameraBefore = createPass('CameraBefore');
            first.beforePasses.push(cameraBefore);

            const scenePass = new RenderPassForward(app.graphicsDevice, app.scene.layers, app.scene, app.renderer, first);
            scenePass.init(null);
            scenePass.addLayer(app.scene.layers.getLayerByName('World'), false);
            const own = createPass('Own');
            scenePass.beforePasses.push(own);
            first.framePasses = [scenePass];

            for (let i = 0; i < 3; i++) {
                const passes = renderFrame();
                expect(passes.filter(pass => pass === own)).to.have.lengthOf(1);
                expect(passes.filter(pass => pass === cameraBefore)).to.have.lengthOf(1);

                const shadow = passes.findIndex(pass => pass instanceof RenderPassShadowDirectional);
                expect(shadow).to.be.at.least(0);
                expect(shadow).to.be.below(passes.indexOf(cameraBefore));
                expect(passes.indexOf(cameraBefore)).to.be.below(passes.indexOf(own));
                expect(passes.indexOf(own)).to.be.below(passes.indexOf(scenePass));
                expect(scenePass.beforePasses).to.deep.equal([own]);
            }
        });

        it('render the before-passes of the camera and fire its render events once, with the scene split between hand-built passes', function () {
            const before = createPass('Before');
            first.beforePasses.push(before);

            const world = app.scene.layers.getLayerByName('World');
            const opaquePass = new RenderPassForward(app.graphicsDevice, app.scene.layers, app.scene, app.renderer, first);
            opaquePass.init(null);
            opaquePass.addLayer(world, false);
            const transparentPass = new RenderPassForward(app.graphicsDevice, app.scene.layers, app.scene, app.renderer, first);
            transparentPass.init(null);
            transparentPass.addLayer(world, true, false);
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
                expect([opaquePass.firstCameraUse, opaquePass.lastCameraUse]).to.deep.equal([true, false]);
                expect([transparentPass.firstCameraUse, transparentPass.lastCameraUse]).to.deep.equal([false, true]);
            }
        });

        it('render the shadows of each camera before its own pass, with the passes of two cameras one after the other', function () {
            const light = new Entity('Light');
            light.addComponent('light', { type: 'directional', castShadows: true });
            app.root.addChild(light);

            const caster = new Entity('Caster');
            caster.addComponent('render', { type: 'box' });
            app.root.addChild(caster);

            // the second camera renders into a texture the first one could use, before it, sharing
            // the shadow map of the light
            const createScenePass = (camera, renderTarget) => {
                const pass = new RenderPassForward(app.graphicsDevice, app.scene.layers, app.scene, app.renderer, camera);
                pass.init(renderTarget);
                pass.addLayer(app.scene.layers.getLayerByName('World'), false);
                return pass;
            };
            const texture = new Texture(app.graphicsDevice, { width: 4, height: 4 });
            const secondPass = createScenePass(second, new RenderTarget({ colorBuffer: texture, depth: true }));
            const firstPass = createScenePass(first, null);
            const container = createPass('Container');
            container.beforePasses.push(secondPass, firstPass);
            first.framePasses = [container];

            const passes = renderFrame();
            const shadowOf = camera => passes.findIndex(pass => pass instanceof RenderPassShadowDirectional && pass.camera === camera.camera);
            expect(shadowOf(second)).to.be.below(passes.indexOf(secondPass));
            expect(passes.indexOf(secondPass)).to.be.below(shadowOf(first));
            expect(shadowOf(first)).to.be.below(passes.indexOf(firstPass));
            texture.destroy();
        });
    });
});
