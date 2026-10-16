import { expect } from 'chai';
import { restore, spy } from 'sinon';

import { Color } from '../../../src/core/math/color.js';
import { FramePassSmaa } from '../../../src/extras/effects/smaa/passes/frame-pass-smaa.js';
import { SmaaEffect } from '../../../src/extras/effects/smaa/smaa-effect.js';
import { getSmaaLookupData } from '../../../src/extras/effects/smaa/smaa-lookup.js';
import { CameraFrame } from '../../../src/extras/render-passes/camera-frame.js';
import { Entity } from '../../../src/framework/entity.js';
import { PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA8 } from '../../../src/platform/graphics/constants.js';
import { RenderTarget } from '../../../src/platform/graphics/render-target.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { TONEMAP_ACES, TONEMAP_NONE } from '../../../src/scene/constants.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// Dawn's null backend validates the API and compiles the shaders, but executes no GPU work, so the
// pixels the shaders render are only checked on a backend which runs them
const executesGpuWork = !!process.env.PC_WEBGPU_BACKEND && process.env.PC_WEBGPU_BACKEND !== 'null';

// FNV-1a hash of the bytes of the data
const hashData = (data) => {
    let hash = 2166136261;
    for (let i = 0; i < data.length; i++) {
        hash = Math.imul(hash ^ data[i], 16777619);
    }
    return hash >>> 0;
};

describe('SmaaEffect', function () {

    /** @type {import('../../../src/framework/application.js').Application} */
    let app;

    /** @type {CameraFrame} */
    let cameraFrame;

    /** @type {SmaaEffect} */
    let smaa;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        const entity = new Entity('Camera');
        entity.addComponent('camera');
        app.root.addChild(entity);

        cameraFrame = new CameraFrame(app, entity.camera);
        smaa = new SmaaEffect(app.graphicsDevice);
    });

    afterEach(function () {
        smaa.destroy();
        cameraFrame.destroy();
        app.destroy();
        jsdomTeardown();
        restore();
    });

    describe('lookup data', function () {

        it('decodes the area subtexture SMAA 1x reads, and the search texture', async function () {
            const { area, search } = await getSmaaLookupData();

            // the first of the seven 160 x 80 RG8 subtextures of the reference area texture
            expect(area).to.have.lengthOf(160 * 80 * 2);
            expect(hashData(area)).to.equal(1122511144);

            // the 64 x 16 R8 reference search texture
            expect(search).to.have.lengthOf(64 * 16);
            expect(hashData(search)).to.equal(16827397);
        });

        it('fills the lookup textures of the effect once decoded', async function () {
            await smaa._lookupReady;
            const { area, search } = await getSmaaLookupData();
            expect(Array.from(smaa._areaTexture._levels[0])).to.deep.equal(Array.from(area));
            expect(Array.from(smaa._searchTexture._levels[0])).to.deep.equal(Array.from(search));
        });

        it('leaves the lookup textures of an effect destroyed before they are decoded alone', async function () {
            const other = new SmaaEffect(app.graphicsDevice);
            const lock = spy(other._areaTexture, 'lock');
            other.destroy();

            // filling a destroyed texture would throw, rejecting the promise
            await other._lookupReady;
            expect(lock.callCount).to.equal(0);
        });
    });

    describe('passes', function () {

        it('has no passes until it is added to a camera frame', function () {
            cameraFrame.update();
            expect(smaa._pass).to.equal(null);
            expect(cameraFrame.renderPassCamera.beforePasses.some(pass => pass instanceof FramePassSmaa)).to.equal(false);
        });

        it('resolves the scene after the scene, before its half resolution copy, and the composition reads it', function () {
            cameraFrame.bloom.intensity = 0.01;
            cameraFrame.addEffect(smaa);
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;
            const passes = framePass.beforePasses;
            const pass = smaa._pass;

            expect(pass).to.be.an.instanceOf(FramePassSmaa);
            expect(passes.indexOf(framePass.scenePass)).to.be.below(passes.indexOf(pass));
            expect(passes.indexOf(pass)).to.be.below(passes.indexOf(framePass.scenePassHalf));

            framePass.frameUpdate();
            expect(pass.sourceTexture).to.equal(framePass.sceneTexture);
            expect(framePass.composePass.sceneTexture).to.equal(pass.outputTexture);
            expect(framePass.scenePassHalf.sourceTexture).to.equal(pass.outputTexture);

            // the passes render at the size of the scene, in its format
            for (const child of pass.beforePasses) {
                expect(child.options.resizeSource).to.equal(framePass.sceneTexture);
            }
            expect(pass.outputTexture.format).to.equal(cameraFrame.hdrFormat);

            // no camera jitter, unlike TAA
            expect(cameraFrame.cameraComponent.jitter).to.equal(0);
        });

        it('resolves the TAA output when added after the built-in TAA, and the other way round when inserted before it', function () {
            cameraFrame.taa.enabled = true;
            cameraFrame.addEffect(smaa);
            cameraFrame.update();
            let framePass = cameraFrame.renderPassCamera;
            framePass.frameUpdate();
            expect(smaa._pass.sourceTexture).to.equal(cameraFrame.taa._pass.historyTexture);
            expect(framePass.composePass.sceneTexture).to.equal(smaa._pass.outputTexture);

            cameraFrame.removeEffect(smaa);
            cameraFrame.insertEffectBefore(smaa, cameraFrame.taa);
            cameraFrame.update();
            framePass = cameraFrame.renderPassCamera;
            framePass.frameUpdate();
            expect(smaa._pass.sourceTexture).to.equal(framePass.sceneTexture);
            expect(cameraFrame.taa._pass.sourceTexture).to.equal(smaa._pass.outputTexture);
            expect(framePass.composePass.sceneTexture).to.equal(cameraFrame.taa._pass.historyTexture);
        });

        it('releases its passes when disabled, and keeps resolving the scene after it is removed until the next update', function () {
            cameraFrame.addEffect(smaa);
            cameraFrame.update();
            const pass = smaa._pass;
            const destroy = spy(pass, 'destroy');

            smaa.enabled = false;
            cameraFrame.update();
            expect(destroy.callCount).to.equal(1);
            expect(smaa._pass).to.equal(null);

            smaa.enabled = true;
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;
            cameraFrame.removeEffect(smaa);
            expect(() => framePass.frameUpdate()).to.not.throw();
            expect(framePass.composePass.sceneTexture).to.equal(smaa._pass.outputTexture);
        });

        it('binds its parameters, clamped, when the passes render', function () {
            cameraFrame.addEffect(smaa);
            smaa.threshold = 0.05;
            smaa.maxSearchSteps = 32.4;
            smaa.maxSearchStepsDiag = 40;
            smaa.cornerRounding = 100;
            cameraFrame.update();
            const pass = smaa._pass;
            cameraFrame.renderPassCamera.frameUpdate();

            pass.bindParameters();
            const params = app.graphicsDevice.scope.resolve('smaaParams').value;
            expect(params[0]).to.be.closeTo(0.05, 1e-6);
            expect(params[1]).to.equal(32);
            expect(params[2]).to.equal(20);
            expect(params[3]).to.equal(1);

            const metrics = app.graphicsDevice.scope.resolve('smaaMetrics').value;
            const { width, height } = pass.sourceTexture;
            expect(Array.from(metrics)).to.deep.equal([Math.fround(1 / width), Math.fround(1 / height), width, height]);
        });

        it('detects the edges and blends at the exposure the scene is displayed with, which is none without tone mapping', function () {
            cameraFrame.addEffect(smaa);
            const smaaExposure = app.graphicsDevice.scope.resolve('smaaExposure');
            app.scene.exposure = 4;

            cameraFrame.rendering.toneMapping = TONEMAP_ACES;
            cameraFrame.update();
            app.render();
            expect(smaaExposure.value).to.equal(4);

            cameraFrame.rendering.toneMapping = TONEMAP_NONE;
            cameraFrame.update();
            app.render();
            expect(smaaExposure.value).to.equal(1);
        });

        it('provides its debug views while it takes part', function () {
            cameraFrame.addEffect(smaa);
            for (const view of ['smaaedges', 'smaaweights']) {
                cameraFrame.debug = view;
                cameraFrame.update();
                expect(cameraFrame.renderPassCamera.composePass.debug).to.equal(view);
            }

            smaa.enabled = false;
            cameraFrame.update();
            expect(cameraFrame.renderPassCamera.composePass.debug).to.equal(null);
        });

        it('renders, alone and with TAA and multisampling', async function () {
            await smaa._lookupReady;
            cameraFrame.addEffect(smaa);
            for (const config of [{}, { taa: true }, { samples: 4 }, { debug: 'smaaedges' }, { debug: 'smaaweights' }]) {
                cameraFrame.taa.enabled = !!config.taa;
                cameraFrame.rendering.samples = config.samples ?? 1;
                cameraFrame.debug = config.debug ?? null;
                cameraFrame.update();
                for (let i = 0; i < 2; i++) {
                    app.render();
                }
            }
        });

        it('keeps the color of the geometry on the edges it partially covers, whatever the color of the transparent pixels', async function () {
            await smaa._lookupReady;

            // a white slanted box over a transparent blue background, whose color is not displayed
            const material = new StandardMaterial();
            material.useLighting = false;
            material.diffuse = Color.BLACK;
            material.emissive = Color.WHITE;
            material.update();
            const box = new Entity('Box');
            box.addComponent('render', { type: 'box', material });
            box.setLocalPosition(0, 0, -3);
            box.setLocalEulerAngles(0, 0, 30);
            app.root.addChild(box);

            // a camera rendering to a texture, in place of the one rendering to the back buffer
            const width = 96;
            const height = 80;
            const output = new Texture(app.graphicsDevice, { name: 'Output', width, height, format: PIXELFORMAT_RGBA8, mipmaps: false });
            const renderTarget = new RenderTarget({ colorBuffer: output, depth: true });
            cameraFrame.cameraComponent.entity.enabled = false;
            const camera = new Entity('TextureCamera');
            camera.addComponent('camera', { clearColor: new Color(0, 0, 1, 0), renderTarget });
            app.root.addChild(camera);

            const frame = new CameraFrame(app, camera.camera);
            frame.rendering.renderFormats = [PIXELFORMAT_RGBA16F];
            frame.rendering.toneMapping = TONEMAP_NONE;
            frame.addEffect(smaa);
            frame.update();
            app.render();

            if (executesGpuWork) {
                // the pixels the edge partially covers keep the white of the box, neither tinted by
                // the transparent background nor darkened by the coverage
                const pixels = await output.read(0, 0, width, height, { renderTarget, immediate: true });
                let covered = 0;
                let darkest = 255;
                for (let i = 0; i < pixels.length; i += 4) {
                    const alpha = pixels[i + 3];
                    if (alpha > 8 && alpha < 247) {
                        covered++;
                        darkest = Math.min(darkest, pixels[i], pixels[i + 1], pixels[i + 2]);
                    }
                }
                expect(covered).to.be.above(20);
                expect(darkest).to.be.at.least(250);
            }

            frame.destroy();
            camera.destroy();
            renderTarget.destroy();
            output.destroy();
        });

        it('destroys its passes and its lookup textures once destroyed', function () {
            cameraFrame.addEffect(smaa);
            cameraFrame.update();
            const destroyPass = spy(smaa._pass, 'destroy');
            const destroyArea = spy(smaa._areaTexture, 'destroy');
            const destroySearch = spy(smaa._searchTexture, 'destroy');

            smaa.destroy();
            expect(destroyPass.callCount).to.equal(1);
            expect(destroyArea.callCount).to.equal(1);
            expect(destroySearch.callCount).to.equal(1);
            expect(cameraFrame.effects).to.not.include(smaa);
        });
    });
});
