import { expect } from 'chai';

import { Entity } from '../../../src/framework/entity.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { Camera } from '../../../src/scene/camera.js';
import { GAMMA_NONE, GAMMA_SRGB } from '../../../src/scene/constants.js';
import { FramePassColorGrab } from '../../../src/scene/graphics/frame-pass-color-grab.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * @import { Application } from '../../../src/framework/application.js'
 */

describe('FramePassColorGrab', function () {
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

    const colorMapValue = () => app.graphicsDevice.scope.resolve('uSceneColorMap').value;

    it('does not publish the color while the frame graph is built', function () {
        const device = app.graphicsDevice;
        const camera = new Camera(device);
        const grab = new FramePassColorGrab(device, camera);

        const previous = new Texture(device, { width: 4, height: 4 });
        device.scope.resolve('uSceneColorMap').setValue(previous);

        grab.frameUpdate();
        expect(colorMapValue()).to.equal(previous);
        expect(camera.sceneColorMapHandle.texture).to.equal(null);

        grab.destroy();
        camera.destroy();
        previous.destroy();
    });

    it('publishes the grabbed color for its camera when it executes', function () {
        const device = app.graphicsDevice;
        const camera = new Camera(device);
        const grab = new FramePassColorGrab(device, camera);

        grab.frameUpdate();
        grab.before();

        const colorBuffer = grab.colorRenderTarget.colorBuffer;
        expect(colorMapValue()).to.equal(colorBuffer);
        expect(camera.sceneColorMapHandle.texture).to.equal(colorBuffer);

        grab.destroy();
        camera.destroy();
    });

    it('publishes the grab of each camera while that camera renders', function () {
        const device = app.graphicsDevice;
        const cameraA = new Camera(device);
        const cameraB = new Camera(device);
        const grabA = new FramePassColorGrab(device, cameraA);
        const grabB = new FramePassColorGrab(device, cameraB);

        // the frame graph is built for all cameras before any of them renders
        grabA.frameUpdate();
        grabB.frameUpdate();

        grabA.before();
        expect(colorMapValue()).to.equal(grabA.colorRenderTarget.colorBuffer);

        grabB.before();
        expect(colorMapValue()).to.equal(grabB.colorRenderTarget.colorBuffer);

        expect(cameraA.sceneColorMapHandle.texture).to.equal(grabA.colorRenderTarget.colorBuffer);
        expect(cameraB.sceneColorMapHandle.texture).to.equal(grabB.colorRenderTarget.colorBuffer);

        grabA.destroy();
        grabB.destroy();
        cameraA.destroy();
        cameraB.destroy();
    });

    it('records the gamma the grabbed color was rendered with', function () {
        const device = app.graphicsDevice;
        const camera = new Camera(device);
        const grab = new FramePassColorGrab(device, camera);
        grab.frameUpdate();

        camera.shaderParams.gammaCorrection = GAMMA_SRGB;
        camera.shaderParams.srgbRenderTarget = false;
        grab.before();
        expect(camera.sceneColorMapHandle.gamma).to.equal(true);

        // an sRGB render target stores the color linear, converting it as it is written
        camera.shaderParams.srgbRenderTarget = true;
        grab.before();
        expect(camera.sceneColorMapHandle.gamma).to.equal(false);

        camera.shaderParams.gammaCorrection = GAMMA_NONE;
        camera.shaderParams.srgbRenderTarget = false;
        grab.before();
        expect(camera.sceneColorMapHandle.gamma).to.equal(false);

        // the passes rendering the grabbed color override the gamma correction of the camera
        camera.shaderParams.gammaCorrection = GAMMA_SRGB;
        grab.gammaCorrection = GAMMA_NONE;
        grab.before();
        expect(camera.sceneColorMapHandle.gamma).to.equal(false);

        grab.destroy();
        camera.destroy();
    });

    it('grabs the color of a camera which requests the scene color map', function () {
        const camera = new Entity('camera');
        camera.addComponent('camera');
        camera.camera.requestSceneColorMap(true);
        app.root.addChild(camera);

        expect(() => app.render()).to.not.throw();
        expect(camera.camera.camera.sceneColorMapHandle.texture).to.not.equal(null);
    });
});
