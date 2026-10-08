import { expect } from 'chai';
import { restore, spy, stub } from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { CameraFrameEffect } from '../../../src/extras/render-passes/camera-frame-effect.js';
import { CameraFrame } from '../../../src/extras/render-passes/camera-frame.js';
import {
    FRAMERESOURCE_DEPTH, FRAMERESOURCE_PREPASSDEPTH, FRAMERESOURCE_SCENECOLORHALF, SSAOTYPE_COMBINE, SSAOTYPE_LIGHTING,
    SSAOTYPE_NONE
} from '../../../src/extras/render-passes/constants.js';
import { BloomEffect } from '../../../src/extras/render-passes/effects/bloom-effect.js';
import { FramePassBloom } from '../../../src/extras/render-passes/frame-pass-bloom.js';
import { RenderPassSsao } from '../../../src/extras/render-passes/render-pass-ssao.js';
import { Entity } from '../../../src/framework/entity.js';
import { PIXELFORMAT_RGBA8 } from '../../../src/platform/graphics/constants.js';
import { FramePass } from '../../../src/platform/graphics/frame-pass.js';
import { ShaderUtils } from '../../../src/scene/shader-lib/shader-utils.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// an effect owning a pass, as a user would write one
class PassEffect extends CameraFrameEffect {
    /** @type {FramePass|null} */
    pass = null;

    /** @type {FramePass[]} */
    created = [];

    /** @type {object|null} */
    resourcesGiven = null;

    /** @type {object|null} */
    passesGiven = null;

    // the stage the pass is added to
    stage = 'postTemporal';

    constructor(device, id = 'passEffect', requires = [FRAMERESOURCE_SCENECOLORHALF]) {
        super(device, id, { requires });
    }

    createPasses(resources, passes) {
        this.resourcesGiven = resources;
        this.passesGiven = Object.fromEntries(Object.entries(passes).map(([stage, list]) => [stage, list.slice()]));
        this.pass = new FramePass(this.device);
        spy(this.pass, 'destroy');
        this.created.push(this.pass);
        passes[this.stage].push(this.pass);
    }

    destroyPasses() {
        this.pass?.destroy();
        this.pass = null;
    }
}

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
        restore();
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

        it('hands the effects the size of this frame\'s scene texture, before the texture is resized', function () {
            const effect = new CameraFrameEffect(app.graphicsDevice, 'probe');
            const frameUpdate = spy(effect, 'frameUpdate');
            cameraFrame.addEffect(effect);
            cameraFrame.rendering.renderTargetScale = 0.5;
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;

            // the scene pass resizes its render target when it updates, after the effects
            framePass.frameUpdate();
            const [frame] = frameUpdate.lastCall.args;
            const { backBuffer } = app.graphicsDevice;
            expect(frame.sceneWidth).to.equal(Math.floor(backBuffer.width * 0.5));
            expect(frame.sceneHeight).to.equal(Math.floor(backBuffer.height * 0.5));
            expect(frame.sceneWidth).to.not.equal(frame.sceneTexture.width);
            cameraFrame.removeEffect(effect);
        });
    });

    describe('bloom', function () {

        const bloomPasses = framePass => framePass.beforePasses.filter(pass => pass instanceof FramePassBloom);

        it('runs the passes of the bloom effect between the half resolution scene and the depth of field', function () {
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;
            const { bloom } = cameraFrame;

            const passes = framePass.beforePasses;
            const [bloomPass] = bloomPasses(framePass);
            expect(bloomPass).to.equal(bloom._pass);
            expect(bloomPass._sourceTexture).to.equal(framePass.sceneTextureHalf);
            expect(passes.indexOf(framePass.scenePassHalf)).to.be.below(passes.indexOf(bloomPass));
            expect(passes.indexOf(bloomPass)).to.be.below(passes.indexOf(framePass.dofPass));
            expect(cameraFrame._activeEffects).to.include(bloom);
        });

        it('applies its parameters when updated', function () {
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;
            const [bloomPass] = bloomPasses(framePass);
            const { bloom } = cameraFrame;

            bloom.blurLevel = 3;
            bloom.threshold = 1.5;
            framePass.frameUpdate();
            expect(bloomPass.blurLevel).to.not.equal(3);

            cameraFrame.update();
            expect(bloomPasses(cameraFrame.renderPassCamera)).to.deep.equal([bloomPass]);
            expect(bloomPass.blurLevel).to.equal(3);
            expect(bloomPass.threshold).to.equal(1.5);
        });

        it('releases its passes when turned off and updated, and takes part again once turned on and updated', function () {
            cameraFrame.update();
            const { bloom } = cameraFrame;
            const [bloomPass] = bloomPasses(cameraFrame.renderPassCamera);
            const destroy = spy(bloomPass, 'destroy');

            bloom.intensity = 0;
            cameraFrame.update();
            expect(destroy.callCount).to.equal(1);
            expect(bloomPasses(cameraFrame.renderPassCamera)).to.have.lengthOf(0);
            expect(cameraFrame._activeEffects).to.not.include(bloom);

            bloom.intensity = 0.02;
            expect(bloomPasses(cameraFrame.renderPassCamera)).to.have.lengthOf(0);
            cameraFrame.update();
            expect(bloomPasses(cameraFrame.renderPassCamera)).to.have.lengthOf(1);
            expect(cameraFrame._activeEffects).to.include(bloom);
            expect(destroy.callCount).to.equal(1);
        });

        it('generates high quality bloom from the full resolution scene of each frame, without the half resolution scene', function () {
            cameraFrame.dof.enabled = false;
            cameraFrame.bloom.highQuality = true;
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;
            const [bloomPass] = bloomPasses(framePass);
            expect(framePass.scenePassHalf).to.equal(null);
            expect(bloomPass._removeInvalid).to.equal(true);

            // over two frames, as TAA alternates between its two history textures - the bloom
            // pass builds its chain when it first updates, and its first downsample follows
            const sources = [];
            for (let i = 0; i < 2; i++) {
                framePass.frameUpdate();
                expect(bloomPass._sourceTexture).to.equal(framePass.taaPass.historyTexture);
                bloomPass.frameUpdate();
                expect(bloomPass._firstPass.sourceTexture).to.equal(framePass.taaPass.historyTexture);
                sources.push(bloomPass._sourceTexture);
            }
            expect(sources[0]).to.not.equal(sources[1]);
        });

        it('rebuilds its passes when high quality is toggled', function () {
            cameraFrame.update();
            const [lowQuality] = bloomPasses(cameraFrame.renderPassCamera);
            const destroy = spy(lowQuality, 'destroy');

            cameraFrame.bloom.highQuality = true;
            cameraFrame.update();
            const [highQuality] = bloomPasses(cameraFrame.renderPassCamera);
            expect(destroy.callCount).to.equal(1);
            expect(highQuality).to.not.equal(lowQuality);
            expect(highQuality._removeInvalid).to.equal(true);

            // the depth of field still needs the half resolution scene
            expect(cameraFrame.renderPassCamera.scenePassHalf).to.not.equal(null);
        });

        it('has no passes, nor the half resolution scene, without an HDR format', function () {
            cameraFrame.dof.enabled = false;
            cameraFrame.rendering.renderFormats = [PIXELFORMAT_RGBA8];
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;

            expect(cameraFrame.hdrFormat).to.equal(PIXELFORMAT_RGBA8);
            expect(cameraFrame.bloom.active).to.equal(false);
            expect(bloomPasses(framePass)).to.have.lengthOf(0);
            expect(framePass.scenePassHalf).to.equal(null);
        });

        it('destroys its passes once when the camera frame is destroyed', function () {
            cameraFrame.update();
            const [bloomPass] = bloomPasses(cameraFrame.renderPassCamera);
            const destroy = spy(bloomPass, 'destroy');

            cameraFrame.destroy();
            expect(destroy.callCount).to.equal(1);
            cameraFrame = new CameraFrame(app, app.root.findByName('Camera').camera);
        });
    });

    describe('effects owning passes', function () {

        it('creates the passes of an added effect on the next update, and releases them on the update after it is removed', function () {
            cameraFrame.update();
            const effect = new PassEffect(app.graphicsDevice);

            cameraFrame.addEffect(effect);
            expect(effect.created).to.have.lengthOf(0);

            cameraFrame.update();
            const [pass] = effect.created;
            expect(cameraFrame.renderPassCamera.beforePasses).to.include(pass);
            expect(cameraFrame._activeEffects).to.include(effect);

            // still rendering until the update
            cameraFrame.removeEffect(effect);
            expect(cameraFrame.renderPassCamera.beforePasses).to.include(pass);

            // the removed effect is its owner's: its passes are left to it
            cameraFrame.update();
            expect(cameraFrame.renderPassCamera.beforePasses).to.not.include(pass);
            expect(cameraFrame._activeEffects).to.not.include(effect);
            expect(pass.destroy.callCount).to.equal(0);

            effect.destroy();
            expect(pass.destroy.callCount).to.equal(1);
        });

        it('gives an effect an empty array for each stage it runs passes at, and runs them in the order of the effects', function () {
            const first = new PassEffect(app.graphicsDevice, 'first');
            const second = new PassEffect(app.graphicsDevice, 'second');
            cameraFrame.addEffect(first);
            cameraFrame.addEffect(second);
            cameraFrame.update();

            expect(first.passesGiven).to.deep.equal({ preScene: [], postOpaque: [], postScene: [], postTemporal: [] });
            expect(first.resourcesGiven).to.deep.equal({ sceneColorHalf: cameraFrame.renderPassCamera.sceneTextureHalf });

            // after the bloom, which the camera frame registered before them
            const { beforePasses } = cameraFrame.renderPassCamera;
            const [bloomPass] = beforePasses.filter(pass => pass instanceof FramePassBloom);
            expect(beforePasses.indexOf(bloomPass)).to.be.below(beforePasses.indexOf(first.pass));
            expect(beforePasses.indexOf(first.pass)).to.be.below(beforePasses.indexOf(second.pass));
            expect(beforePasses.indexOf(second.pass)).to.be.below(beforePasses.indexOf(cameraFrame.renderPassCamera.dofPass));

            first.destroy();
            second.destroy();
            cameraFrame.update();
        });

        it('rebuilds when the resources an effect requires change, providing what it then requires', function () {
            class HalfEffect extends PassEffect {
                needsHalf = false;

                get requires() {
                    return this.needsHalf ? [FRAMERESOURCE_SCENECOLORHALF] : [];
                }
            }
            cameraFrame.bloom.intensity = 0;
            cameraFrame.dof.enabled = false;
            const effect = new HalfEffect(app.graphicsDevice);
            cameraFrame.addEffect(effect);
            cameraFrame.update();
            expect(cameraFrame.renderPassCamera.scenePassHalf).to.equal(null);
            expect(effect.resourcesGiven).to.deep.equal({});

            effect.needsHalf = true;
            cameraFrame.update();
            expect(effect.created).to.have.lengthOf(2);
            expect(effect.created[0].destroy.callCount).to.equal(1);
            expect(cameraFrame.renderPassCamera.scenePassHalf).to.not.equal(null);
            expect(effect.resourcesGiven.sceneColorHalf).to.equal(cameraFrame.renderPassCamera.sceneTextureHalf);
            effect.destroy();
            cameraFrame.update();
        });

        it('asserts on passes at a stage which is not supported yet', function () {
            const assert = stub(Debug, 'assert');
            const effect = new PassEffect(app.graphicsDevice);
            effect.stage = 'postOpaque';
            cameraFrame.addEffect(effect);
            cameraFrame.update();
            const failed = assert.getCalls().filter(call => !call.args[0]).map(call => call.args[1]);
            expect(failed.some(message => message.includes('postOpaque stage'))).to.equal(true);
            expect(cameraFrame.renderPassCamera.beforePasses).to.not.include(effect.pass);
            assert.restore();
            effect.destroy();
            cameraFrame.update();
        });

        it('builds the passes of a new instance replacing an effect with the same id', function () {
            const old = new PassEffect(app.graphicsDevice);
            cameraFrame.addEffect(old);
            cameraFrame.update();
            const [oldPass] = old.created;

            // replaced without an update in between, the old instance kept by its owner
            const replacement = new PassEffect(app.graphicsDevice);
            cameraFrame.removeEffect(old);
            cameraFrame.addEffect(replacement);
            cameraFrame.update();

            const { beforePasses } = cameraFrame.renderPassCamera;
            expect(replacement.created).to.have.lengthOf(1);
            expect(beforePasses).to.include(replacement.pass);
            expect(beforePasses).to.not.include(oldPass);
            expect(cameraFrame._activeEffects).to.include(replacement);
            expect(cameraFrame._activeEffects).to.not.include(old);
            expect(oldPass.destroy.callCount).to.equal(0);

            old.destroy();
            expect(oldPass.destroy.callCount).to.equal(1);
            replacement.destroy();
            cameraFrame.update();
        });

        it('builds the passes of a new instance replacing a destroyed effect with the same id', function () {
            const old = new PassEffect(app.graphicsDevice);
            cameraFrame.addEffect(old);
            cameraFrame.update();
            const [oldPass] = old.created;

            old.destroy();
            const replacement = new PassEffect(app.graphicsDevice);
            cameraFrame.addEffect(replacement);
            cameraFrame.update();

            expect(oldPass.destroy.callCount).to.equal(1);
            expect(cameraFrame.renderPassCamera.beforePasses).to.not.include(oldPass);
            expect(cameraFrame.renderPassCamera.beforePasses).to.include(replacement.pass);
            replacement.destroy();
            cameraFrame.update();
        });

        it('builds the passes of a new bloom replacing the built-in one', function () {
            cameraFrame.update();
            const builtIn = cameraFrame.bloom;
            const oldPass = builtIn._pass;

            const replacement = new BloomEffect(app.graphicsDevice);
            replacement.intensity = 0.05;
            cameraFrame.removeEffect(builtIn);
            cameraFrame.addEffect(replacement);
            cameraFrame.update();

            const { beforePasses } = cameraFrame.renderPassCamera;
            expect(replacement._pass).to.not.equal(null);
            expect(beforePasses).to.include(replacement._pass);
            expect(beforePasses).to.not.include(oldPass);
            expect(cameraFrame._activeEffects).to.include(replacement);
            replacement.destroy();
            cameraFrame.update();
        });

        it('destroys the passes of an effect removed and destroyed once', function () {
            const effect = new PassEffect(app.graphicsDevice);
            cameraFrame.addEffect(effect);
            cameraFrame.update();
            const [pass] = effect.created;

            effect.destroy();
            cameraFrame.update();
            expect(pass.destroy.callCount).to.equal(1);
            expect(cameraFrame.renderPassCamera.beforePasses).to.not.include(pass);
            expect(effect.created).to.have.lengthOf(1);
        });

        it('releases the passes of an effect removed and added again before creating fresh ones', function () {
            const effect = new PassEffect(app.graphicsDevice);
            cameraFrame.addEffect(effect);
            cameraFrame.update();

            cameraFrame.removeEffect(effect);
            cameraFrame.update();
            cameraFrame.addEffect(effect);
            cameraFrame.update();

            const [first, second] = effect.created;
            expect(effect.created).to.have.lengthOf(2);
            expect(first.destroy.callCount).to.equal(1);
            expect(second.destroy.callCount).to.equal(0);
            expect(cameraFrame.renderPassCamera.beforePasses).to.include(second);
            effect.destroy();
            cameraFrame.update();
        });

        it('rebuilds the passes of the registered effects when the frame passes are rebuilt', function () {
            const effect = new PassEffect(app.graphicsDevice);
            cameraFrame.addEffect(effect);
            cameraFrame.update();

            cameraFrame.taa.enabled = false;
            cameraFrame.update();

            const [first, second] = effect.created;
            expect(first.destroy.callCount).to.equal(1);
            expect(cameraFrame.renderPassCamera.beforePasses).to.include(second);
            effect.destroy();
            cameraFrame.update();
        });

        it('releases the passes of the effects still registered when the camera frame is destroyed', function () {
            const effect = new PassEffect(app.graphicsDevice);
            cameraFrame.addEffect(effect);
            cameraFrame.update();
            const [pass] = effect.created;

            cameraFrame.destroy();
            expect(pass.destroy.callCount).to.equal(1);
            expect(effect.cameraFrame).to.equal(null);

            // and destroying the effect afterwards is a no-op
            effect.destroy();
            expect(pass.destroy.callCount).to.equal(1);
            cameraFrame = new CameraFrame(app, app.root.findByName('Camera').camera);
        });

        it('reports an effect destroyed while the frame still renders its passes', function () {
            const errorOnce = stub(Debug, 'errorOnce');
            const effect = new PassEffect(app.graphicsDevice);
            cameraFrame.addEffect(effect);
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;

            framePass.frameUpdate();
            expect(errorOnce.callCount).to.equal(0);

            effect.destroy();
            framePass.frameUpdate();
            expect(errorOnce.callCount).to.equal(1);
            expect(errorOnce.firstCall.args[0]).to.include('\'passEffect\' was destroyed');

            cameraFrame.update();
            cameraFrame.renderPassCamera.frameUpdate();
            expect(errorOnce.callCount).to.equal(1);
        });
    });

    describe('scene depth', function () {

        // nothing else needing the depth
        beforeEach(function () {
            cameraFrame.taa.enabled = false;
            cameraFrame.bloom.intensity = 0;
            cameraFrame.dof.enabled = false;
        });

        const rendersDepth = () => {
            const { options } = cameraFrame.renderPassCamera;
            return options.prepassEnabled || options.sceneTextureDepth;
        };

        it('renders the depth for an active effect requiring it, one without passes included', function () {
            cameraFrame.update();
            expect(rendersDepth()).to.equal(false);

            const effect = new CameraFrameEffect(app.graphicsDevice, 'depthReader', { requires: [FRAMERESOURCE_DEPTH] });
            cameraFrame.addEffect(effect);
            cameraFrame.update();
            expect(rendersDepth()).to.equal(true);

            effect.enabled = false;
            cameraFrame.update();
            expect(rendersDepth()).to.equal(false);
            cameraFrame.removeEffect(effect);
        });

        it('renders the depth with the prepass for an effect requiring it before the scene', function () {
            const effect = new CameraFrameEffect(app.graphicsDevice, 'early', { requires: [FRAMERESOURCE_PREPASSDEPTH] });
            cameraFrame.addEffect(effect);
            cameraFrame.update();
            const { options } = cameraFrame.renderPassCamera;
            expect(options.prepassEnabled).to.equal(true);
            expect(options.sceneTextureDepth).to.equal(false);
            cameraFrame.removeEffect(effect);
        });

        it('hands the effects the scene depth, with the defines and key of the shaders reading it', function () {
            const first = new PassEffect(app.graphicsDevice, 'first', [FRAMERESOURCE_DEPTH]);
            const second = new PassEffect(app.graphicsDevice, 'second', [FRAMERESOURCE_DEPTH]);
            first.stage = second.stage = 'postScene';
            cameraFrame.addEffect(first);
            cameraFrame.addEffect(second);
            cameraFrame.update();

            const framePass = cameraFrame.renderPassCamera;
            const { depth } = first.resourcesGiven;
            expect(depth.texture).to.equal(framePass.sceneDepthTexture ?? framePass.prePass.linearDepthTexture);

            const defines = new Map();
            const key = ShaderUtils.addScreenDepthChunkDefines(cameraFrame.cameraComponent.shaderParams, defines);
            expect([...depth.defines]).to.deep.equal([...defines]);
            expect(depth.key).to.equal(key);
            expect(second.resourcesGiven.depth).to.equal(depth);

            first.destroy();
            second.destroy();
            cameraFrame.update();
        });
    });

    describe('ssao', function () {

        const ssaoPass = () => cameraFrame.renderPassCamera.beforePasses.find(pass => pass instanceof RenderPassSsao);

        it('generates the occlusion after the scene, from the scene depth, in the combine mode', function () {
            cameraFrame.ssao.type = SSAOTYPE_COMBINE;
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;
            const passes = framePass.beforePasses;
            const pass = ssaoPass();

            expect(passes.indexOf(framePass.scenePass)).to.be.below(passes.indexOf(pass));
            expect(passes.indexOf(pass)).to.be.below(passes.indexOf(framePass.taaPass));
            expect(pass.sourceTexture).to.equal(framePass.sceneDepthTexture ?? framePass.prePass.linearDepthTexture);
            expect(cameraFrame.cameraComponent.shaderParams.ssaoEnabled).to.equal(false);
            expect(cameraFrame._activeEffects).to.include(cameraFrame.ssao);
        });

        it('generates the occlusion before the scene, from the prepass, in the lighting mode', function () {
            cameraFrame.ssao.type = SSAOTYPE_LIGHTING;
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;
            const passes = framePass.beforePasses;
            const pass = ssaoPass();

            expect(passes.indexOf(framePass.prePass)).to.be.below(passes.indexOf(pass));
            expect(passes.indexOf(pass)).to.be.below(passes.indexOf(framePass.scenePass));
            expect(pass.sourceTexture).to.equal(framePass.prePass.linearDepthTexture);
            expect(framePass.options.sceneTextureDepth).to.equal(false);
            expect(cameraFrame.cameraComponent.shaderParams.ssaoEnabled).to.equal(true);
        });

        it('sizes the occlusion on the first frame after the passes are built, in the lighting mode', function () {
            cameraFrame.ssao.type = SSAOTYPE_LIGHTING;
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;

            // one frame of updates in the order the frame graph runs them, up to the scene pass - the
            // occlusion is sized from the prepass depth, which the prepass resizes before it
            framePass.frameUpdate();
            for (const pass of framePass.beforePasses) {
                pass.frameUpdate();
                if (pass === framePass.scenePass) break;
            }

            const { width, height } = framePass.prePass.renderTarget;
            expect(width).to.be.above(4);
            expect(ssaoPass().renderTarget.width).to.equal(width);
            expect(ssaoPass().renderTarget.height).to.equal(height);
        });

        it('switches between the modes on update, the lit shaders applying it in the lighting mode only', function () {
            const { shaderParams } = cameraFrame.cameraComponent;
            cameraFrame.ssao.type = SSAOTYPE_LIGHTING;
            cameraFrame.update();
            const lighting = ssaoPass();
            const destroy = spy(lighting, 'destroy');

            cameraFrame.ssao.type = SSAOTYPE_COMBINE;
            cameraFrame.update();
            expect(destroy.callCount).to.equal(1);
            expect(ssaoPass()).to.not.equal(lighting);
            expect(shaderParams.ssaoEnabled).to.equal(false);

            cameraFrame.ssao.type = SSAOTYPE_LIGHTING;
            cameraFrame.update();
            expect(shaderParams.ssaoEnabled).to.equal(true);

            cameraFrame.ssao.type = SSAOTYPE_NONE;
            cameraFrame.update();
            expect(ssaoPass()).to.equal(undefined);
            expect(shaderParams.ssaoEnabled).to.equal(false);
            expect(cameraFrame._activeEffects).to.not.include(cameraFrame.ssao);
        });

        it('stops the lit shaders applying it once it is removed', function () {
            cameraFrame.ssao.type = SSAOTYPE_LIGHTING;
            cameraFrame.update();

            const { ssao } = cameraFrame;
            cameraFrame.removeEffect(ssao);
            cameraFrame.update();
            expect(ssaoPass()).to.equal(undefined);
            expect(cameraFrame.cameraComponent.shaderParams.ssaoEnabled).to.equal(false);
            ssao.destroyPasses();
        });

        it('keeps its debug view in both modes', function () {
            cameraFrame.debug = 'ssao';
            for (const type of [SSAOTYPE_COMBINE, SSAOTYPE_LIGHTING]) {
                cameraFrame.ssao.type = type;
                cameraFrame.update();
                expect(cameraFrame.renderPassCamera.composePass.debug).to.equal('ssao');
            }

            cameraFrame.ssao.type = SSAOTYPE_NONE;
            cameraFrame.update();
            expect(cameraFrame.renderPassCamera.composePass.debug).to.equal(null);
        });
    });
});
