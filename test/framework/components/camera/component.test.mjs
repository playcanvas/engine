import { expect } from 'chai';

import { Color } from '../../../../src/core/math/color.js';
import { Vec4 } from '../../../../src/core/math/vec4.js';
import { Entity } from '../../../../src/framework/entity.js';
import {
    ASPECT_MANUAL,
    FOG_LINEAR,
    GAMMA_NONE,
    LAYERID_UI,
    PROJECTION_ORTHOGRAPHIC,
    PROJECTION_PERSPECTIVE,
    TONEMAP_ACES
} from '../../../../src/scene/constants.js';
import { FogParams } from '../../../../src/scene/fog-params.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

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

    describe('#addComponent', function () {

        it('creates a component with sensible defaults', function () {
            const e = new Entity();
            e.addComponent('camera');

            expect(e.camera).to.exist;
            expect(e.camera.enabled).to.equal(true);
            expect(e.camera.fov).to.equal(45);
            expect(e.camera.nearClip).to.equal(0.1);
            expect(e.camera.farClip).to.equal(1000);
            expect(e.camera.clearColor.equals(new Color(0.75, 0.75, 0.75, 1))).to.equal(true);
            expect(e.camera.clearDepth).to.equal(1);
            expect(e.camera.fog).to.equal(null);
            expect(e.camera.orthoHeight).to.equal(10);
            expect(e.camera.priority).to.equal(0);
            expect(e.camera.projection).to.equal(PROJECTION_PERSPECTIVE);
        });

    });

    describe('#cloneComponent', function () {

        it('copies every property to the clone', function () {
            const fog = new FogParams();
            fog.type = FOG_LINEAR;
            fog.start = 10;
            fog.end = 100;

            const calculateProjection = () => {};
            const calculateTransform = () => {};

            const e = new Entity();
            e.addComponent('camera', {
                aspectRatioMode: ASPECT_MANUAL,
                aspectRatio: 2,
                calculateProjection: calculateProjection,
                calculateTransform: calculateTransform,
                clearColor: new Color(0.1, 0.2, 0.3, 0.4),
                clearColorBuffer: false,
                clearDepth: 0.5,
                clearDepthBuffer: false,
                clearStencilBuffer: false,
                cullFaces: false,
                farClip: 500,
                flipFaces: true,
                fog: fog,
                fov: 60,
                frustumCulling: false,
                horizontalFov: true,
                layers: [LAYERID_UI],
                nearClip: 2,
                orthoHeight: 7,
                priority: 3,
                projection: PROJECTION_ORTHOGRAPHIC,
                rect: new Vec4(0.1, 0.1, 0.5, 0.5),
                scissorRect: new Vec4(0.2, 0.2, 0.6, 0.6),
                aperture: 8,
                shutter: 1 / 500,
                sensitivity: 400,
                gammaCorrection: GAMMA_NONE,
                toneMapping: TONEMAP_ACES
            });

            const clone = e.clone();
            const c = clone.camera;

            expect(c).to.exist;
            expect(c.enabled).to.equal(true);
            expect(c.aspectRatioMode).to.equal(ASPECT_MANUAL);
            expect(c.aspectRatio).to.equal(2);
            expect(c.calculateProjection).to.equal(calculateProjection);
            expect(c.calculateTransform).to.equal(calculateTransform);
            expect(c.clearColor.equals(new Color(0.1, 0.2, 0.3, 0.4))).to.equal(true);
            expect(c.clearColorBuffer).to.equal(false);
            expect(c.clearDepth).to.equal(0.5);
            expect(c.clearDepthBuffer).to.equal(false);
            expect(c.clearStencilBuffer).to.equal(false);
            expect(c.cullFaces).to.equal(false);
            expect(c.farClip).to.equal(500);
            expect(c.flipFaces).to.equal(true);
            expect(c.fog).to.equal(fog);
            expect(c.fov).to.equal(60);
            expect(c.frustumCulling).to.equal(false);
            expect(c.horizontalFov).to.equal(true);
            expect(c.layers).to.deep.equal([LAYERID_UI]);
            expect(c.nearClip).to.equal(2);
            expect(c.orthoHeight).to.equal(7);
            expect(c.priority).to.equal(3);
            expect(c.projection).to.equal(PROJECTION_ORTHOGRAPHIC);
            expect(c.rect.equals(new Vec4(0.1, 0.1, 0.5, 0.5))).to.equal(true);
            expect(c.scissorRect.equals(new Vec4(0.2, 0.2, 0.6, 0.6))).to.equal(true);
            expect(c.aperture).to.equal(8);
            expect(c.shutter).to.equal(1 / 500);
            expect(c.sensitivity).to.equal(400);
            expect(c.gammaCorrection).to.equal(GAMMA_NONE);
            expect(c.toneMapping).to.equal(TONEMAP_ACES);
        });

        it('copies the enabled state to the clone', function () {
            const e = new Entity();
            e.addComponent('camera', { enabled: false });

            const clone = e.clone();

            expect(clone.camera.enabled).to.equal(false);
        });

    });
});
