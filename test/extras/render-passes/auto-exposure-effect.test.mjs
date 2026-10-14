import { expect } from 'chai';
import { restore, spy } from 'sinon';

import { Color } from '../../../src/core/math/color.js';
import { AutoExposureEffect } from '../../../src/extras/effects/auto-exposure/auto-exposure-effect.js';
import { meterHistogram } from '../../../src/extras/effects/auto-exposure/auto-exposure-metering.js';
import { FramePassLuminanceHistogram } from '../../../src/extras/effects/auto-exposure/passes/frame-pass-luminance-histogram.js';
import { CameraFrame } from '../../../src/extras/render-passes/camera-frame.js';
import { Entity } from '../../../src/framework/entity.js';
import { TONEMAP_ACES, TONEMAP_NONE } from '../../../src/scene/constants.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// Dawn's null backend validates the API and compiles the shaders, but executes no GPU work, so what
// the shaders measure is only checked on a backend which runs them
const executesGpuWork = !!process.env.PC_WEBGPU_BACKEND && process.env.PC_WEBGPU_BACKEND !== 'null';

// a histogram of 64 bins, with the given weights at the given bins
const histogramOf = (weights) => {
    const histogram = new Uint32Array(64);
    for (const [bin, weight] of Object.entries(weights)) {
        histogram[bin] = weight;
    }
    return histogram;
};

describe('AutoExposureEffect', function () {

    /** @type {import('../../../src/framework/application.js').Application} */
    let app;

    /** @type {CameraFrame} */
    let cameraFrame;

    /** @type {AutoExposureEffect} */
    let autoExposure;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        const entity = new Entity('Camera');
        entity.addComponent('camera');
        app.root.addChild(entity);

        cameraFrame = new CameraFrame(app, entity.camera);
        cameraFrame.rendering.toneMapping = TONEMAP_ACES;
        autoExposure = new AutoExposureEffect(app.graphicsDevice);
    });

    afterEach(function () {
        autoExposure.destroy();
        cameraFrame.destroy();
        app.destroy();
        jsdomTeardown();
        restore();
    });

    // measures a histogram as if read back, of the frame last prepared, which the effect adapts to on
    // the next frame
    const measure = (weights, tag = autoExposure._pass.tag) => {
        const pass = autoExposure._pass;
        pass.onHistogram(histogramOf(weights), pass.rangeMin, pass.rangeMax, tag);
    };

    // the log2 luminance the bin of the latest measured range counts
    const binLog2 = (bin) => {
        const { rangeMin, rangeMax } = autoExposure._pass;
        return rangeMin + bin / 63 * (rangeMax - rangeMin);
    };

    describe('metering', function () {

        it('averages the bins between the two fractions of the total', function () {
            expect(meterHistogram(histogramOf({ 20: 100 }), 0.5, 0.95)).to.equal(20);

            // the darkest and the brightest halves
            expect(meterHistogram(histogramOf({ 10: 100, 30: 100 }), 0.5, 1)).to.equal(30);
            expect(meterHistogram(histogramOf({ 10: 100, 30: 100 }), 0, 0.5)).to.equal(10);
        });

        it('counts the bins at the two fractions with the part of them which lies between', function () {
            // a quarter of the total in each of the four bins, the middle half taken
            expect(meterHistogram(histogramOf({ 2: 50, 4: 50, 6: 50, 8: 50 }), 0.25, 0.75)).to.equal(5);

            // half of bin 4 and all of bin 6, the brightest bin left out
            expect(meterHistogram(histogramOf({ 2: 50, 4: 50, 6: 50, 8: 50 }), 0.375, 0.75)).to.be.closeTo((4 * 25 + 6 * 50) / 75, 1e-9);
        });

        it('reports an empty histogram', function () {
            expect(meterHistogram(histogramOf({}), 0.5, 0.95)).to.equal(-1);
        });
    });

    describe('passes', function () {

        it('measures the half resolution scene after it is resolved, before the composition', function () {
            cameraFrame.addEffect(autoExposure);
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;
            const passes = framePass.beforePasses;
            const pass = autoExposure._pass;

            expect(pass).to.be.an.instanceOf(FramePassLuminanceHistogram);
            expect(pass.sourceTexture).to.equal(framePass.sceneTextureHalf);
            expect(passes.indexOf(framePass.scenePassHalf)).to.be.below(passes.indexOf(pass));
            expect(passes.indexOf(pass)).to.be.below(passes.indexOf(framePass.composePass));
        });

        it('takes no part without tone mapping, as no exposure is applied', function () {
            cameraFrame.rendering.toneMapping = TONEMAP_NONE;
            cameraFrame.addEffect(autoExposure);
            cameraFrame.update();
            expect(autoExposure.active).to.equal(false);
            expect(autoExposure._pass).to.equal(null);
        });

        it('renders, alone, with TAA, with multisampling and with its debug view', function () {
            cameraFrame.addEffect(autoExposure);
            for (const config of [{}, { taa: true }, { samples: 4 }, { debug: 'autoexposure' }]) {
                cameraFrame.taa.enabled = !!config.taa;
                cameraFrame.rendering.samples = config.samples ?? 1;
                cameraFrame.debug = config.debug ?? null;
                cameraFrame.update();
                for (let i = 0; i < 2; i++) {
                    app.render();
                }
            }
        });

        it('provides its debug view while it takes part', function () {
            cameraFrame.addEffect(autoExposure);
            cameraFrame.debug = 'autoexposure';
            cameraFrame.update();
            expect(cameraFrame.renderPassCamera.composePass.debug).to.equal('autoexposure');

            autoExposure.enabled = false;
            cameraFrame.update();
            expect(cameraFrame.renderPassCamera.composePass.debug).to.equal(null);
        });

        it('measures the brightness of the screen, counting every texel once', async function () {
            // a white screen, of linear luminance 1, metered equally everywhere, all of it averaged -
            // a part of it would be biased by up to half a bin, as each texel is shared between the
            // two bins around it
            cameraFrame.cameraComponent.clearColor = new Color(1, 1, 1, 1);
            autoExposure.centerWeight = 0;
            autoExposure.lowPercent = 0;
            autoExposure.highPercent = 1;
            cameraFrame.addEffect(autoExposure);
            cameraFrame.update();

            // frames render until the histogram is read back, which a device without readback never does
            await new Promise((resolve) => {
                const render = (frames) => {
                    app.render();
                    if (autoExposure._averageLog2 !== null || frames <= 1) {
                        resolve();
                    } else {
                        setTimeout(() => render(frames - 1), 10);
                    }
                };
                render(30);
            });

            if (executesGpuWork) {
                // the log2 luminance of 0, within the 16 bits the meter stores the brightness in
                expect(autoExposure._averageLog2).to.be.closeTo(0, 0.001);

                // each of the 128 x 64 texels of the meter shared between the two bins around it, in
                // 16.16 fixed point
                const histogram = autoExposure.histogram;
                const total = histogram.reduce((sum, weight) => sum + weight, 0);
                expect(total / 65536).to.be.closeTo(128 * 64, 2);
                const bins = Array.from(histogram.keys()).filter(bin => histogram[bin] > 0);
                expect(bins.length).to.be.at.most(2);
            }
        });

        it('destroys its passes once destroyed', function () {
            cameraFrame.addEffect(autoExposure);
            cameraFrame.update();
            const destroy = spy(autoExposure._pass, 'destroy');

            autoExposure.destroy();
            expect(destroy.callCount).to.equal(1);
            expect(cameraFrame.effects).to.not.include(autoExposure);
        });
    });

    describe('exposure', function () {

        it('adapts at once to the first measurement, displaying the average as middle grey', function () {
            app.scene.exposure = 2;
            cameraFrame.addEffect(autoExposure);
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;
            framePass.frameUpdate();

            measure({ 30: 1000 });
            framePass.frameUpdate();
            const expected = 0.18 / 2 ** binLog2(30);
            expect(autoExposure.exposure).to.be.closeTo(expected, expected * 1e-6);
            expect(cameraFrame.cameraComponent.camera.exposureScale).to.be.closeTo(expected / 2, expected * 1e-6);
        });

        it('renders with the exposure of the scene scaled by the adaptation', function () {
            app.scene.exposure = 2;
            cameraFrame.addEffect(autoExposure);
            cameraFrame.update();
            cameraFrame.renderPassCamera.frameUpdate();
            measure({ 30: 1000 });

            app.render();
            const exposure = app.graphicsDevice.scope.resolve('exposure').value;
            expect(exposure).to.be.closeTo(autoExposure.exposure, 1e-6);
            expect(exposure).to.not.be.closeTo(2, 1e-3);
        });

        it('displays the average brighter with a compensation, within the limits', function () {
            cameraFrame.addEffect(autoExposure);
            autoExposure.compensation = 1;
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;
            framePass.frameUpdate();

            measure({ 31: 1000 });
            framePass.frameUpdate();
            const expected = 0.36 / 2 ** binLog2(31);
            expect(autoExposure.exposure).to.be.closeTo(expected, expected * 1e-6);

            // a dark screen brightens the image by the highest exposure at most, a bright one darkens
            // it by the lowest
            autoExposure.reset();
            framePass.frameUpdate();
            measure({ 0: 1000 });
            framePass.frameUpdate();
            expect(Math.log2(cameraFrame.cameraComponent.camera.exposureScale)).to.be.closeTo(6, 1e-9);

            autoExposure.reset();
            framePass.frameUpdate();
            measure({ 63: 1000 });
            framePass.frameUpdate();
            expect(Math.log2(cameraFrame.cameraComponent.camera.exposureScale)).to.be.closeTo(-6, 1e-9);
        });

        it('adapts gradually after the first measurement, faster to the light than to the dark', function () {
            cameraFrame.addEffect(autoExposure);
            autoExposure.speedDarkToLight = 4;
            autoExposure.speedLightToDark = 1;
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;
            framePass.frameUpdate();
            const ev = () => Math.log2(cameraFrame.cameraComponent.camera.exposureScale);

            measure({ 32: 1000 });
            framePass.frameUpdate();
            const start = ev();

            // a scene six bins brighter, then the same six bins darker, each after the application
            // advanced by a tenth of a second
            const step = (bin) => {
                const from = ev();
                measure({ [bin]: 1000 });
                app.update(0.1);
                framePass.frameUpdate();
                return Math.abs(ev() - from);
            };
            const change = binLog2(38) - binLog2(32);
            const toLight = step(38);
            expect(ev()).to.be.below(start);
            autoExposure.reset();
            framePass.frameUpdate();
            measure({ 32: 1000 });
            framePass.frameUpdate();
            const toDark = step(26);
            expect(ev()).to.be.above(start);

            // 1 - exp(-0.4) and 1 - exp(-0.1) of the change
            expect(toLight).to.be.closeTo(change * (1 - Math.exp(-0.4)), change * 1e-6);
            expect(toDark).to.be.closeTo(change * (1 - Math.exp(-0.1)), change * 1e-6);
        });

        it('holds the exposure while the application does not advance, as when it is paused', function () {
            cameraFrame.addEffect(autoExposure);
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;
            const ev = () => Math.log2(cameraFrame.cameraComponent.camera.exposureScale);
            framePass.frameUpdate();
            measure({ 32: 1000 });
            framePass.frameUpdate();
            const start = ev();

            // a brighter scene, rendered without the application updating, and then while it is
            // paused, updating by no time
            measure({ 38: 1000 });
            framePass.frameUpdate();
            expect(ev()).to.equal(start);
            app.update(0);
            framePass.frameUpdate();
            expect(ev()).to.equal(start);

            // adapted to once the application advances
            app.update(0.1);
            framePass.frameUpdate();
            expect(ev()).to.be.below(start);
        });

        it('adapts at once to the view after a reset, once it is measured, ignoring the histograms of the view before', function () {
            cameraFrame.addEffect(autoExposure);
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;
            const ev = () => Math.log2(cameraFrame.cameraComponent.camera.exposureScale);
            framePass.frameUpdate();
            measure({ 40: 1000 });
            framePass.frameUpdate();
            const before = ev();
            const tagBefore = autoExposure._pass.tag;

            // the cut: the frames rendered until the histogram of the new view arrives keep the
            // exposure, and so does a histogram of the old view still in flight
            autoExposure.reset();
            framePass.frameUpdate();
            framePass.frameUpdate();
            expect(ev()).to.equal(before);
            measure({ 40: 1000 }, tagBefore);
            framePass.frameUpdate();
            expect(ev()).to.equal(before);

            // the new view, a darker one, adapted to at once
            measure({ 20: 1000 });
            framePass.frameUpdate();
            const expected = Math.log2(0.18) - binLog2(20);
            expect(ev()).to.be.closeTo(expected, 1e-9);
            expect(ev()).to.be.above(before + 1);
        });

        it('keeps rendering once removed, until the camera frame next updates', function () {
            cameraFrame.addEffect(autoExposure);
            cameraFrame.update();
            app.render();

            cameraFrame.removeEffect(autoExposure);
            expect(() => app.render()).to.not.throw();

            cameraFrame.update();
            app.render();
            expect(cameraFrame.cameraComponent.camera.exposureScale).to.equal(1);
        });

        it('stops scaling the exposure once it takes no part', function () {
            cameraFrame.addEffect(autoExposure);
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;
            framePass.frameUpdate();
            measure({ 10: 1000 });
            framePass.frameUpdate();
            expect(cameraFrame.cameraComponent.camera.exposureScale).to.not.equal(1);

            autoExposure.enabled = false;
            cameraFrame.update();
            cameraFrame.renderPassCamera.frameUpdate();
            expect(cameraFrame.cameraComponent.camera.exposureScale).to.equal(1);

            // and once the camera frame is disabled
            autoExposure.enabled = true;
            cameraFrame.update();
            cameraFrame.renderPassCamera.frameUpdate();
            expect(cameraFrame.cameraComponent.camera.exposureScale).to.not.equal(1);
            cameraFrame.enabled = false;
            expect(cameraFrame.cameraComponent.camera.exposureScale).to.equal(1);
        });
    });
});
