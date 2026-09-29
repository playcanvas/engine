import { expect } from 'chai';

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
});
