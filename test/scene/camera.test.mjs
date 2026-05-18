import { expect } from 'chai';

import { Vec4 } from '../../src/core/math/vec4.js';
import { Entity } from '../../src/framework/entity.js';
import { Camera } from '../../src/scene/camera.js';
import { ASPECT_AUTO, ASPECT_MANUAL } from '../../src/scene/constants.js';
import { createApp } from '../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../jsdom.mjs';

/**
 * @import { Application } from '../../src/framework/application.js'
 */

describe('Camera', function () {
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

    describe('#constructor', function () {

        it('requires a graphics device', function () {
            // Debug.assert is stripped in production, so this throws in dev builds only via
            // the assertion; we simply verify that passing the device works.
            const camera = new Camera(app.graphicsDevice);
            expect(camera.device).to.equal(app.graphicsDevice);
        });

        it('defaults to ASPECT_AUTO', function () {
            const camera = new Camera(app.graphicsDevice);
            expect(camera.aspectRatioMode).to.equal(ASPECT_AUTO);
        });
    });

    describe('#aspectRatio (ASPECT_AUTO)', function () {

        it('reflects the backbuffer size synchronously', function () {
            app.graphicsDevice.setResolution(800, 400);

            const camera = new Camera(app.graphicsDevice);
            expect(camera.aspectRatio).to.equal(2);
        });

        it('updates when renderTarget is assigned', function () {
            app.graphicsDevice.setResolution(800, 400);

            const camera = new Camera(app.graphicsDevice);
            expect(camera.aspectRatio).to.equal(2);

            // attach a mock render target with different dimensions
            camera.renderTarget = { width: 1024, height: 512 };
            expect(camera.aspectRatio).to.equal(2);

            camera.renderTarget = { width: 300, height: 100 };
            expect(camera.aspectRatio).to.equal(3);
        });

        it('updates when rect changes (viewport aspect ratio)', function () {
            app.graphicsDevice.setResolution(1000, 1000);

            const camera = new Camera(app.graphicsDevice);
            expect(camera.aspectRatio).to.equal(1);

            // half-width viewport on a square render target -> 1:2 viewport aspect
            camera.rect = new Vec4(0, 0, 0.5, 1);
            expect(camera.aspectRatio).to.equal(0.5);
        });

        it('updates when the backbuffer is resized', function () {
            app.graphicsDevice.setResolution(800, 400);

            const camera = new Camera(app.graphicsDevice);
            expect(camera.aspectRatio).to.equal(2);

            app.graphicsDevice.setResolution(1600, 400);
            expect(camera.aspectRatio).to.equal(4);
        });

        it('recomputes when switching from MANUAL to AUTO', function () {
            app.graphicsDevice.setResolution(800, 400);

            const camera = new Camera(app.graphicsDevice);
            camera.aspectRatioMode = ASPECT_MANUAL;
            camera.aspectRatio = 3.14;
            expect(camera.aspectRatio).to.equal(3.14);

            camera.aspectRatioMode = ASPECT_AUTO;
            expect(camera.aspectRatio).to.equal(2);
        });
    });

    describe('#aspectRatio (ASPECT_MANUAL)', function () {

        it('preserves the manually assigned value', function () {
            app.graphicsDevice.setResolution(800, 400);

            const camera = new Camera(app.graphicsDevice);
            camera.aspectRatioMode = ASPECT_MANUAL;
            camera.aspectRatio = 2.5;
            expect(camera.aspectRatio).to.equal(2.5);

            // changes to inputs that would affect AUTO must not affect MANUAL
            camera.renderTarget = { width: 1000, height: 1000 };
            app.graphicsDevice.setResolution(1920, 1080);
            camera.rect = new Vec4(0, 0, 0.5, 1);

            expect(camera.aspectRatio).to.equal(2.5);
        });
    });

    describe('#projectionMatrix', function () {

        it('refreshes after a backbuffer resize (no setter touched)', function () {
            app.graphicsDevice.setResolution(800, 400);

            const camera = new Camera(app.graphicsDevice);

            // prime the projection matrix cache
            const before = camera.projectionMatrix.clone();

            // resize the backbuffer without touching any camera setter
            app.graphicsDevice.setResolution(1600, 400);

            // reading projectionMatrix should detect the aspect change via the getter and
            // rebuild the matrix
            const after = camera.projectionMatrix;
            expect(after.equals(before)).to.equal(false);
        });
    });

    describe('#clone', function () {

        it('preserves aspect ratio state', function () {
            app.graphicsDevice.setResolution(800, 400);

            const camera = new Camera(app.graphicsDevice);
            expect(camera.aspectRatio).to.equal(2);

            const clone = camera.clone();
            expect(clone.device).to.equal(camera.device);
            expect(clone.aspectRatio).to.equal(2);
        });
    });
});

describe('CameraComponent', function () {
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

    describe('#aspectRatio', function () {

        it('reflects the backbuffer size before the first frame', function () {
            app.graphicsDevice.setResolution(1600, 400);

            const entity = new Entity();
            entity.addComponent('camera');
            app.root.addChild(entity);

            expect(entity.camera.aspectRatio).to.equal(4);
        });

        it('calculateAspectRatio forwards to the underlying Camera', function () {
            app.graphicsDevice.setResolution(800, 400);

            const entity = new Entity();
            entity.addComponent('camera');
            app.root.addChild(entity);

            expect(entity.camera.calculateAspectRatio()).to.equal(2);
            expect(entity.camera.calculateAspectRatio({ width: 300, height: 100 })).to.equal(3);
        });
    });
});
