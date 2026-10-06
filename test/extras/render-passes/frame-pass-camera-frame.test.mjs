import { expect } from 'chai';
import { spy } from 'sinon';

import { CameraFrameEffect } from '../../../src/extras/render-passes/camera-frame-effect.js';
import { CameraFrame } from '../../../src/extras/render-passes/camera-frame.js';
import { Entity } from '../../../src/framework/entity.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('FramePassCameraFrame', function () {

    /** @type {import('../../../src/framework/application.js').Application} */
    let app;

    /** @type {CameraFrame} */
    let cameraFrame;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        const entity = new Entity('Camera');
        entity.addComponent('camera');
        app.root.addChild(entity);

        cameraFrame = new CameraFrame(app, entity.camera);
        cameraFrame.taa.enabled = true;
        cameraFrame.bloom.intensity = 0.01;
        cameraFrame.dof.enabled = true;
    });

    afterEach(function () {
        cameraFrame.destroy();
        app.destroy();
        jsdomTeardown();
    });

    it('blurs the TAA output for the bloom and the high quality depth of field', function () {
        cameraFrame.dof.highQuality = true;
        cameraFrame.update();
        const framePass = cameraFrame.renderPassCamera;
        const { taaPass, scenePassHalf, dofPass, composePass } = framePass;

        // over two frames, as TAA alternates between its two history textures
        const outputs = [];
        for (let i = 0; i < 2; i++) {
            framePass.frameUpdate();
            outputs.push(taaPass.historyTexture);

            expect(composePass.sceneTexture).to.equal(taaPass.historyTexture);
            expect(scenePassHalf.sourceTexture).to.equal(taaPass.historyTexture);
            expect(dofPass.farPass.sourceTexture).to.equal(taaPass.historyTexture);
        }
        expect(outputs[0]).to.not.equal(outputs[1]);
    });

    it('blurs the half resolution TAA output for the low quality depth of field', function () {
        cameraFrame.dof.highQuality = false;
        cameraFrame.update();
        const framePass = cameraFrame.renderPassCamera;
        const { taaPass, scenePassHalf, dofPass } = framePass;

        for (let i = 0; i < 2; i++) {
            framePass.frameUpdate();

            expect(scenePassHalf.sourceTexture).to.equal(taaPass.historyTexture);
            expect(dofPass.farPass.sourceTexture).to.equal(framePass.sceneTextureHalf);
        }
    });

    describe('effects', function () {

        it('applies a change to an effect when updated, rendering until then what the last update applied', function () {
            cameraFrame.update();
            const { vignette } = cameraFrame;
            const composePass = () => cameraFrame.renderPassCamera.composePass;

            vignette.intensity = 0.5;
            cameraFrame.renderPassCamera.frameUpdate();
            expect(cameraFrame._activeEffects).to.not.include(vignette);
            expect(composePass()._effects).to.not.include(vignette);

            cameraFrame.update();
            expect(cameraFrame._activeEffects).to.include(vignette);
            expect(composePass()._effects).to.include(vignette);
        });

        it('has the effects apply their parameters on an update, not every frame', function () {
            cameraFrame.vignette.intensity = 0.5;
            cameraFrame.update();
            const update = spy(cameraFrame.vignette, 'update');
            const framePass = cameraFrame.renderPassCamera;

            framePass.frameUpdate();
            framePass.frameUpdate();
            expect(update.callCount).to.equal(0);

            cameraFrame.update();
            expect(update.callCount).to.equal(1);
        });

        it('hands the effects the scene texture of each frame, the TAA output alternating between frames', function () {
            const effect = new CameraFrameEffect(app.graphicsDevice, 'probe');
            const frameUpdate = spy(effect, 'frameUpdate');
            cameraFrame.addEffect(effect);
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;

            const seen = [];
            for (let i = 0; i < 2; i++) {
                framePass.frameUpdate();
                const [frame] = frameUpdate.lastCall.args;
                expect(frame.sceneTexture).to.equal(framePass.taaPass.historyTexture);
                seen.push(frame.sceneTexture);
            }
            expect(seen[0]).to.not.equal(seen[1]);

            // one object, refilled every frame
            expect(frameUpdate.firstCall.args[0]).to.equal(frameUpdate.lastCall.args[0]);
            cameraFrame.removeEffect(effect);
        });
    });
});
