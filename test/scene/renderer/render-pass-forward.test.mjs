import { expect } from 'chai';

import { Entity } from '../../../src/framework/entity.js';
import { FramePass } from '../../../src/platform/graphics/frame-pass.js';
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

            pass.frameUpdate();
            pass.frameUpdate();

            expect(pass.beforePasses).to.deep.equal([before]);
        });

        describe('camera use', function () {
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

            // a pass rendering the world opaque and the ui transparent sublayers with each camera
            const createPass = (...cameras) => {
                const pass = new RenderPassForward(app.graphicsDevice, app.scene.layers, app.scene, app.renderer);
                pass.init(null);
                const world = app.scene.layers.getLayerByName('World');
                const ui = app.scene.layers.getLayerByName('UI');
                cameras.forEach((camera) => {
                    pass.addLayer(camera, world, false);
                    pass.addLayer(camera, ui, true);
                });
                return pass;
            };

            // schedules the passes in a new frame, which execute in the given order
            const schedule = (...passes) => {
                app.renderer.frameUpdate();
                passes.forEach(pass => pass.frameUpdate());
                app.renderer.updateCameraUse(passes);
            };

            // the steps of the passes using the camera, flagged as [firstCameraUse, lastCameraUse]
            const flags = (camera, ...passes) => {
                return passes.flatMap(pass => pass.layerRenderSteps)
                .filter(step => step.cameraComponent === camera)
                .map(step => [step.firstCameraUse, step.lastCameraUse]);
            };

            beforeEach(function () {
                first = createCamera('First');
                second = createCamera('Second');
            });

            it('marks the first and the last render step of each camera, across the passes', function () {
                const passA = createPass(first);
                const passB = createPass(first, second);
                schedule(passA, passB);

                expect(flags(first, passA, passB)).to.deep.equal([[true, false], [false, false], [false, false], [false, true]]);
                expect(flags(second, passA, passB)).to.deep.equal([[true, false], [false, true]]);
            });

            it('marks the render steps of each frame in the order the passes execute', function () {
                const passA = createPass(first);
                const passB = createPass(first);
                schedule(passA, passB);
                schedule(passB, passA);

                expect(flags(first, passB, passA)).to.deep.equal([[true, false], [false, false], [false, false], [false, true]]);
            });

            it('marks a pass scheduled on its own as the first and the last use of the camera', function () {
                const passA = createPass(first);
                const passB = createPass(first);
                schedule(passA, passB);
                schedule(passB);

                expect(flags(first, passB)).to.deep.equal([[true, false], [false, true]]);
            });

            it('collects the before-passes of the camera only in the pass using it first', function () {
                const before = new FramePass(app.graphicsDevice);
                first.beforePasses.push(before);

                const passA = createPass(first);
                const passB = createPass(first);
                schedule(passA, passB);

                expect(passA.beforePasses).to.deep.equal([before]);
                expect(passB.beforePasses).to.deep.equal([]);
            });

            it('marks a pass among the before-passes of the camera as its first use, and does not collect them in it', function () {
                const passA = createPass(first);
                const passB = createPass(first);
                first.beforePasses.push(passB);

                // passA collects passB as its before-pass, and so is scheduled first, while passB executes first
                app.renderer.frameUpdate();
                passA.frameUpdate();
                passB.frameUpdate();
                app.renderer.updateCameraUse([passB, passA]);

                expect(passA.beforePasses).to.deep.equal([passB]);
                expect(passB.beforePasses).to.deep.equal([]);
                expect(flags(first, passB, passA)).to.deep.equal([[true, false], [false, false], [false, false], [false, true]]);
            });
        });
    });
});
