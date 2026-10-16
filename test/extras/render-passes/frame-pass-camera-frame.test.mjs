import { expect } from 'chai';
import { restore, spy, stub } from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { Vec3 } from '../../../src/core/math/vec3.js';
import { BloomEffect } from '../../../src/extras/effects/bloom/bloom-effect.js';
import { FramePassBloom } from '../../../src/extras/effects/bloom/passes/frame-pass-bloom.js';
import { FramePassDof } from '../../../src/extras/effects/dof/passes/frame-pass-dof.js';
import { LensFlareEffect } from '../../../src/extras/effects/lens-flare/lens-flare-effect.js';
import { LensFlare } from '../../../src/extras/effects/lens-flare/lens-flare.js';
import { RenderPassSsao } from '../../../src/extras/effects/ssao/passes/render-pass-ssao.js';
import { FramePassVolumetricFog } from '../../../src/extras/effects/volumetric-fog/passes/frame-pass-volumetric-fog.js';
import { CameraFrameEffect } from '../../../src/extras/render-passes/camera-frame-effect.js';
import { CameraFrame } from '../../../src/extras/render-passes/camera-frame.js';
import {
    FRAMERESOURCE_DEPTH, FRAMERESOURCE_PREPASSDEPTH, FRAMERESOURCE_SCENECOLORGRAB, FRAMERESOURCE_SCENECOLORHALF,
    FRAMERESOURCE_SCENETARGET, SSAOTYPE_COMBINE, SSAOTYPE_LIGHTING, SSAOTYPE_NONE
} from '../../../src/extras/render-passes/constants.js';
import { Entity } from '../../../src/framework/entity.js';
import { PIXELFORMAT_RGBA8 } from '../../../src/platform/graphics/constants.js';
import { FramePass } from '../../../src/platform/graphics/frame-pass.js';
import { SceneDepthMapHandle } from '../../../src/platform/graphics/scene-depth-map-handle.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { LAYERID_IMMEDIATE, LAYERID_WORLD, PROJECTION_ORTHOGRAPHIC, TONEMAP_ACES, TONEMAP_NONE } from '../../../src/scene/constants.js';
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
    stage = 'postResolve';

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

// an effect resolving the scene, as a user would write one: a pass rendering a new scene color,
// which the rest of the frame reads in place of the one it was given
class ResolveEffect extends CameraFrameEffect {
    /** @type {FramePass|null} */
    pass = null;

    /** @type {Texture|null} */
    output = null;

    /** @type {Texture[]} */
    inputs = [];

    // the camera jitter the effect needs
    jitterNeeded = 0;

    constructor(device, id = 'resolveEffect') {
        super(device, id);
    }

    get cameraJitter() {
        return this.jitterNeeded;
    }

    createPasses(resources, passes) {
        this.pass = new FramePass(this.device);
        this.output = new Texture(this.device, { name: 'Resolved', width: 4, height: 4 });
        passes.resolve.push(this.pass);
    }

    destroyPasses() {
        this.pass?.destroy();
        this.pass = null;
        this.output?.destroy();
        this.output = null;
    }

    resolveScene(scene) {
        this.inputs.push(scene.texture);
        scene.texture = this.output;
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
        const { scenePassHalf, composePass } = framePass;
        const taaPass = cameraFrame.taa._pass;
        const dofPass = cameraFrame.dof._pass;

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
        const { scenePassHalf } = framePass;
        const taaPass = cameraFrame.taa._pass;
        const dofPass = cameraFrame.dof._pass;

        for (let i = 0; i < 2; i++) {
            framePass.frameUpdate();

            expect(scenePassHalf.sourceTexture).to.equal(taaPass.historyTexture);
            expect(dofPass.farPass.sourceTexture).to.equal(framePass.sceneTextureHalf);
        }
    });

    it('upscales with TAA while both are enabled, rebuilding when that changes', function () {
        cameraFrame.rendering.renderTargetScale = 0.5;
        cameraFrame.update();
        const { taa } = cameraFrame;
        const firstPass = taa._pass;
        expect(firstPass.upscale).to.equal(false);

        taa.upscale = true;
        cameraFrame.update();
        expect(taa._pass).to.not.equal(firstPass);
        expect(taa._pass.upscale).to.equal(true);

        // the composition reads the upscaled history, which has the resolution of the back buffer
        const framePass = cameraFrame.renderPassCamera;
        const probe = new CameraFrameEffect(app.graphicsDevice, 'probe');
        const frameUpdate = spy(probe, 'frameUpdate');
        cameraFrame.addEffect(probe);
        cameraFrame.update();
        framePass.frameUpdate();
        expect(framePass.composePass.sceneTexture).to.equal(taa._pass.historyTexture);
        const [frame] = frameUpdate.lastCall.args;
        const { backBuffer } = app.graphicsDevice;
        expect([frame.sceneWidth, frame.sceneHeight]).to.deep.equal([backBuffer.width, backBuffer.height]);
        expect([frame.renderWidth, frame.renderHeight]).to.deep.equal([Math.floor(backBuffer.width * 0.5), Math.floor(backBuffer.height * 0.5)]);
        cameraFrame.removeEffect(probe);

        // without TAA there is nothing to upscale with
        taa.enabled = false;
        cameraFrame.update();
        expect(taa._pass).to.equal(null);
        expect(cameraFrame.renderPassCamera.beforePasses.some(pass => pass.constructor.name === 'RenderPassTAA')).to.equal(false);
    });

    it('renders with TAA, alone and upscaling, and with the sharpening of the HDR scene', function () {
        for (const config of [{}, { upscale: true }, { sharpness: 0.5 }]) {
            cameraFrame.taa.upscale = !!config.upscale;
            cameraFrame.rendering.renderTargetScale = config.upscale ? 0.5 : 1;
            cameraFrame.rendering.sharpness = config.sharpness ?? 0;
            cameraFrame.update();
            for (let i = 0; i < 2; i++) {
                app.render();
            }
        }
    });

    it('blends the TAA history at the exposure the scene is displayed with, which is none without tone mapping', function () {
        const taaExposure = app.graphicsDevice.scope.resolve('taaExposure');
        app.scene.exposure = 4;

        cameraFrame.rendering.toneMapping = TONEMAP_ACES;
        cameraFrame.update();
        app.render();
        expect(taaExposure.value).to.equal(4);

        cameraFrame.rendering.toneMapping = TONEMAP_NONE;
        cameraFrame.update();
        app.render();
        expect(taaExposure.value).to.equal(1);
    });

    it('removes and destroys its own pass when disabled, returning the camera to its own rendering', function () {
        cameraFrame.update();
        const ownDestroy = spy(cameraFrame.renderPassCamera, 'destroy');

        cameraFrame.enabled = false;

        expect(ownDestroy.calledOnce).to.equal(true);
        expect(cameraFrame.renderPassCamera).to.equal(null);
        expect(cameraFrame.cameraComponent.framePasses).to.have.length(0);
    });

    it('removes and destroys only its own pass when disabled, leaving other frame passes of the camera', function () {
        cameraFrame.update();
        const ownDestroy = spy(cameraFrame.renderPassCamera, 'destroy');

        // a pass added to the frame passes of the camera, which the camera frame does not own
        const otherPass = new FramePass(app.graphicsDevice);
        const otherDestroy = spy(otherPass, 'destroy');
        cameraFrame.cameraComponent.framePasses.push(otherPass);

        cameraFrame.enabled = false;

        expect(ownDestroy.calledOnce).to.equal(true);
        expect(otherDestroy.called).to.equal(false);
        expect(cameraFrame.cameraComponent.framePasses).to.have.length(1);
        expect(cameraFrame.cameraComponent.framePasses[0]).to.equal(otherPass);
    });

    it('adds its pass to the frame passes of the camera when enabled, keeping the others', function () {
        cameraFrame.enabled = false;

        // a pass in the frame passes of the camera before the camera frame is enabled
        const otherPass = new FramePass(app.graphicsDevice);
        cameraFrame.cameraComponent.framePasses = [otherPass];

        cameraFrame.enabled = true;

        const { framePasses } = cameraFrame.cameraComponent;
        expect(framePasses).to.have.length(2);
        expect(framePasses[0]).to.equal(otherPass);
        expect(framePasses[1]).to.equal(cameraFrame.renderPassCamera);
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
                expect(frame.sceneTexture).to.equal(cameraFrame.taa._pass.historyTexture);
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

            // the scene renders at the resolution of the scene texture, as TAA is not upscaling
            expect([frame.renderWidth, frame.renderHeight]).to.deep.equal([frame.sceneWidth, frame.sceneHeight]);
            cameraFrame.removeEffect(effect);
        });
    });

    describe('bloom', function () {

        const bloomPasses = framePass => framePass.beforePasses.filter(pass => pass instanceof FramePassBloom);

        it('runs the passes of the bloom effect after the half resolution scene and those of the depth of field', function () {
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;
            const { bloom } = cameraFrame;

            const passes = framePass.beforePasses;
            const [bloomPass] = bloomPasses(framePass);
            expect(bloomPass).to.equal(bloom._pass);
            expect(bloomPass._sourceTexture).to.equal(framePass.sceneTextureHalf);
            expect(passes.indexOf(framePass.scenePassHalf)).to.be.below(passes.indexOf(bloomPass));

            // the depth of field registers before the bloom, as it composites before it
            expect(passes.indexOf(cameraFrame.dof._pass)).to.be.below(passes.indexOf(bloomPass));
            expect(passes.indexOf(bloomPass)).to.be.below(passes.indexOf(framePass.composePass));
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
                expect(bloomPass._sourceTexture).to.equal(cameraFrame.taa._pass.historyTexture);
                bloomPass.frameUpdate();
                expect(bloomPass._firstPass.sourceTexture).to.equal(cameraFrame.taa._pass.historyTexture);
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

            expect(first.passesGiven).to.deep.equal({ preScene: [], postOpaque: [], postScene: [], resolve: [], postResolve: [] });
            expect(first.resourcesGiven).to.deep.equal({ sceneColorHalf: cameraFrame.renderPassCamera.sceneTextureHalf });

            // after the bloom, which the camera frame registered before them
            const { beforePasses } = cameraFrame.renderPassCamera;
            const [bloomPass] = beforePasses.filter(pass => pass instanceof FramePassBloom);
            expect(beforePasses.indexOf(bloomPass)).to.be.below(beforePasses.indexOf(first.pass));
            expect(beforePasses.indexOf(first.pass)).to.be.below(beforePasses.indexOf(second.pass));
            expect(beforePasses.indexOf(second.pass)).to.be.below(beforePasses.indexOf(cameraFrame.renderPassCamera.composePass));

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

    describe('time', function () {

        // an effect recording the time of each frame it is handed
        class TimeEffect extends CameraFrameEffect {
            /** @type {number[]} */
            times = [];

            constructor(device) {
                super(device, 'time');
            }

            frameUpdate(frame) {
                this.times.push(frame.dt);
            }
        }

        it('hands the effects the time the application advanced by since the camera frame last rendered', function () {
            const effect = new TimeEffect(app.graphicsDevice);
            cameraFrame.addEffect(effect);
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;

            // two updates before the frame, a frame rendered again without an update, a paused
            // application updating by no time, and an update after it
            app.update(0.1);
            app.update(0.05);
            framePass.frameUpdate();
            framePass.frameUpdate();
            app.update(0);
            framePass.frameUpdate();
            app.update(0.02);
            framePass.frameUpdate();

            expect(effect.times).to.have.lengthOf(4);
            expect(effect.times[0]).to.be.closeTo(0.15, 1e-12);
            expect(effect.times[1]).to.equal(0);
            expect(effect.times[2]).to.equal(0);
            expect(effect.times[3]).to.be.closeTo(0.02, 1e-12);
            effect.destroy();
        });

        it('stops following the time of the application once destroyed', function () {
            const entity = new Entity('Camera2');
            entity.addComponent('camera');
            app.root.addChild(entity);
            const other = new CameraFrame(app, entity.camera);
            app.update(0.1);
            expect(other._frameTime).to.be.closeTo(0.1, 1e-12);

            other.destroy();
            other._frameTime = 0;
            app.update(0.1);
            expect(other._frameTime).to.equal(0);
        });
    });

    describe('sky', function () {

        // an effect rendering the sky for its camera, as a sky effect owning passes would
        class SkyEffect extends PassEffect {
            constructor(device) {
                super(device, 'sky', []);
                this.stage = 'preScene';
            }

            get rendersSky() {
                return true;
            }
        }

        it('hides the sky of the scene from the camera while an effect taking part renders its own', function () {
            const { camera } = cameraFrame.cameraComponent;
            cameraFrame.update();
            expect(camera.skyVisible).to.equal(true);

            // applied with the effects, on the next update
            const effect = new SkyEffect(app.graphicsDevice);
            cameraFrame.addEffect(effect);
            expect(camera.skyVisible).to.equal(true);
            cameraFrame.update();
            expect(camera.skyVisible).to.equal(false);

            // an effect not taking part does not hide it
            effect.enabled = false;
            cameraFrame.update();
            expect(camera.skyVisible).to.equal(true);
            effect.enabled = true;
            cameraFrame.update();
            expect(camera.skyVisible).to.equal(false);

            // disabling the camera frame renders the sky again, and enabling it hides it again
            cameraFrame.enabled = false;
            expect(camera.skyVisible).to.equal(true);
            cameraFrame.enabled = true;
            expect(camera.skyVisible).to.equal(false);

            cameraFrame.removeEffect(effect);
            expect(camera.skyVisible).to.equal(false);
            cameraFrame.update();
            expect(camera.skyVisible).to.equal(true);
            effect.destroy();
        });
    });

    describe('after the opaque geometry', function () {

        // nothing else running between the opaque and the transparent geometry
        beforeEach(function () {
            cameraFrame.taa.enabled = false;
            cameraFrame.bloom.intensity = 0;
            cameraFrame.dof.enabled = false;
        });

        const createEffect = (id, requires = []) => {
            const effect = new PassEffect(app.graphicsDevice, id, requires);
            effect.stage = 'postOpaque';
            return effect;
        };

        it('renders the scene in one pass while nothing runs between its opaque and transparent geometry', function () {
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;
            expect(framePass.scenePassTransparent).to.not.exist;
            expect(framePass.colorGrabPass).to.not.exist;
        });

        it('runs the passes at the postOpaque stage between the opaque and the transparent geometry', function () {
            const first = createEffect('first');
            const second = createEffect('second');
            cameraFrame.addEffect(first);
            cameraFrame.addEffect(second);
            cameraFrame.update();

            const framePass = cameraFrame.renderPassCamera;
            const passes = framePass.beforePasses;
            expect(framePass.scenePassTransparent).to.exist;
            expect(framePass.colorGrabPass).to.not.exist;
            expect(passes.indexOf(framePass.scenePass)).to.be.below(passes.indexOf(first.pass));
            expect(passes.indexOf(first.pass)).to.be.below(passes.indexOf(second.pass));
            expect(passes.indexOf(second.pass)).to.be.below(passes.indexOf(framePass.scenePassTransparent));

            // the scene renders in one pass again once they are gone
            first.destroy();
            second.destroy();
            cameraFrame.update();
            expect(cameraFrame.renderPassCamera.scenePassTransparent).to.not.exist;
        });

        it('renders the before-passes of the camera and fires its render events once, with the scene split between passes', function () {
            cameraFrame.addEffect(createEffect('first'));
            cameraFrame.update();

            const camera = app.root.findByName('Camera').camera;
            const before = new FramePass(app.graphicsDevice);
            camera.beforePasses.push(before);

            const prerender = spy();
            const postrender = spy();
            app.scene.on('prerender', prerender);
            app.scene.on('postrender', postrender);

            for (let i = 0; i < 2; i++) {
                prerender.resetHistory();
                postrender.resetHistory();
                app.render();

                const passes = app.frameGraph.renderPasses;
                const { scenePass, scenePassTransparent } = cameraFrame.renderPassCamera;
                expect(scenePassTransparent).to.exist;
                expect(passes.filter(pass => pass === before)).to.have.lengthOf(1);
                expect(passes.indexOf(before)).to.be.below(passes.indexOf(scenePass));
                expect(prerender.getCalls().map(call => call.args[0])).to.deep.equal([camera]);
                expect(postrender.getCalls().map(call => call.args[0])).to.deep.equal([camera]);
            }
        });

        it('copies the opaque scene color for an effect requiring it, and hands it the handle of the copy', function () {
            const effect = createEffect('grabber', [FRAMERESOURCE_SCENECOLORGRAB, FRAMERESOURCE_SCENETARGET]);
            cameraFrame.addEffect(effect);
            cameraFrame.update();

            let framePass = cameraFrame.renderPassCamera;
            const passes = framePass.beforePasses;
            expect(framePass.options.sceneColorMap).to.equal(true);
            expect(passes.indexOf(framePass.scenePass)).to.be.below(passes.indexOf(framePass.colorGrabPass));
            expect(passes.indexOf(framePass.colorGrabPass)).to.be.below(passes.indexOf(effect.pass));
            expect(passes.indexOf(effect.pass)).to.be.below(passes.indexOf(framePass.scenePassTransparent));
            expect(effect.resourcesGiven.sceneColorGrab).to.equal(cameraFrame.cameraComponent.sceneColorMapHandle);
            expect(effect.resourcesGiven.sceneTarget).to.equal(framePass.rt);

            // the copy is only taken while an effect requires it
            effect.enabled = false;
            cameraFrame.update();
            framePass = cameraFrame.renderPassCamera;
            expect(framePass.options.sceneColorMap).to.equal(false);
            expect(framePass.colorGrabPass).to.not.exist;
            effect.destroy();
            cameraFrame.update();
        });

        it('copies the scene color for an active effect requiring it, one without passes included', function () {
            const effect = new CameraFrameEffect(app.graphicsDevice, 'grabReader', { requires: [FRAMERESOURCE_SCENECOLORGRAB] });
            cameraFrame.addEffect(effect);
            cameraFrame.update();
            expect(cameraFrame.renderPassCamera.colorGrabPass).to.exist;

            effect.enabled = false;
            cameraFrame.update();
            expect(cameraFrame.renderPassCamera.colorGrabPass).to.not.exist;
            cameraFrame.removeEffect(effect);
        });

        it('keeps the copy of the scene color the rendering options request', function () {
            cameraFrame.rendering.sceneColorMap = true;
            const effect = createEffect('grabber', [FRAMERESOURCE_SCENECOLORGRAB]);
            cameraFrame.addEffect(effect);
            cameraFrame.update();
            const { colorGrabPass } = cameraFrame.renderPassCamera;
            expect(colorGrabPass).to.exist;

            // one copy, shared with the materials
            expect(cameraFrame.renderPassCamera.beforePasses.filter(pass => pass === colorGrabPass)).to.have.lengthOf(1);

            effect.destroy();
            cameraFrame.update();
            expect(cameraFrame.renderPassCamera.colorGrabPass).to.exist;
        });

        it('runs passes after the opaque geometry when nothing transparent renders after them', function () {
            const effect = createEffect('last');
            cameraFrame.cameraComponent.layers = cameraFrame.cameraComponent.layers.filter(id => id !== LAYERID_WORLD && id !== LAYERID_IMMEDIATE);
            cameraFrame.addEffect(effect);
            cameraFrame.update();

            const framePass = cameraFrame.renderPassCamera;
            const passes = framePass.beforePasses;
            expect(framePass.scenePassTransparent).to.not.exist;
            expect(passes.indexOf(framePass.scenePass)).to.be.below(passes.indexOf(effect.pass));
            expect(passes.indexOf(effect.pass)).to.be.below(passes.indexOf(framePass.composePass));
            effect.destroy();
            cameraFrame.update();
        });

        describe('with the depth rendered by the scene', function () {

            // the scene renders the depth on a device capable of it, which the null device is made
            beforeEach(function () {
                const device = app.graphicsDevice;
                if (device.isNull) {
                    device.supportsIndependentBlending = true;
                    device.textureFloatBlendable = true;
                }
            });

            const depthMap = () => app.graphicsDevice.scope.resolve(SceneDepthMapHandle.uniformName).value;

            it('hands the passes after the opaque geometry the depth the scene renders, without a prepass', function () {
                const effect = createEffect('depthReader', [FRAMERESOURCE_DEPTH]);
                cameraFrame.addEffect(effect);
                cameraFrame.update();

                const framePass = cameraFrame.renderPassCamera;
                if (app.graphicsDevice.isNull) {
                    expect(framePass.options.sceneTextureDepth).to.equal(true);
                }
                if (framePass.options.sceneTextureDepth) {
                    expect(framePass.prePass).to.not.exist;
                    expect(effect.resourcesGiven.depth.texture).to.equal(framePass.sceneDepthTexture);
                }
                effect.destroy();
                cameraFrame.update();
            });

            it('publishes the depth of the opaque geometry after it, and withdraws it before the transparent geometry renders', function () {
                const effect = createEffect('depthReader', [FRAMERESOURCE_DEPTH]);
                cameraFrame.addEffect(effect);
                cameraFrame.update();

                const framePass = cameraFrame.renderPassCamera;
                const { scenePass, scenePassTransparent, sceneDepthTexture } = framePass;
                const { camera } = cameraFrame.cameraComponent;
                expect(scenePass.sceneTexturesCamera).to.equal(camera);
                expect(scenePassTransparent.clearSceneTextures).to.equal(true);
                expect(scenePassTransparent.sceneTexturesCamera).to.equal(camera);

                // the uniform the depth is published to, as the scene passes render
                if (sceneDepthTexture) {
                    scenePass.before();
                    expect(depthMap()).to.equal(null);
                    scenePass.after();
                    expect(depthMap()).to.equal(sceneDepthTexture);
                    scenePassTransparent.before();
                    expect(depthMap()).to.equal(null);
                    scenePassTransparent.after();
                    expect(depthMap()).to.equal(sceneDepthTexture);
                }
                effect.destroy();
                cameraFrame.update();
            });

            it('publishes the depth once the scene has rendered while nothing runs after the opaque geometry', function () {
                cameraFrame.rendering.sceneColorMap = true;
                cameraFrame.taa.enabled = true;
                cameraFrame.update();

                const { scenePass, scenePassTransparent } = cameraFrame.renderPassCamera;
                expect(scenePass.sceneTexturesCamera).to.equal(null);
                expect(scenePassTransparent.clearSceneTextures).to.equal(false);
                expect(scenePassTransparent.sceneTexturesCamera).to.equal(cameraFrame.cameraComponent.camera);
            });
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

    describe('depth of field', function () {

        const dofPasses = () => cameraFrame.renderPassCamera.beforePasses.filter(pass => pass instanceof FramePassDof);

        it('renders the depth and the half resolution scene while it is enabled, and rebuilds on a quality change', function () {
            cameraFrame.taa.enabled = false;
            cameraFrame.bloom.intensity = 0;
            cameraFrame.update();
            let framePass = cameraFrame.renderPassCamera;
            const [pass] = dofPasses();
            expect(pass).to.equal(cameraFrame.dof._pass);
            expect(framePass.scenePassHalf).to.not.equal(null);
            expect(framePass.options.prepassEnabled || framePass.options.sceneTextureDepth).to.equal(true);
            expect(framePass.beforePasses.indexOf(pass)).to.be.below(framePass.beforePasses.indexOf(framePass.composePass));

            const destroy = spy(pass, 'destroy');
            cameraFrame.dof.highQuality = false;
            cameraFrame.update();
            expect(destroy.callCount).to.equal(1);
            expect(dofPasses()[0]).to.not.equal(pass);

            cameraFrame.dof.enabled = false;
            cameraFrame.update();
            framePass = cameraFrame.renderPassCamera;
            expect(dofPasses()).to.have.lengthOf(0);
            expect(framePass.scenePassHalf).to.equal(null);
            expect(framePass.options.prepassEnabled || framePass.options.sceneTextureDepth).to.equal(false);
            expect(cameraFrame._activeEffects).to.not.include(cameraFrame.dof);
        });

        it('renders the depth it needs when enabled while the camera frame was disabled', function () {
            // nothing else needing the depth
            const assert = stub(Debug, 'assert');
            cameraFrame.taa.enabled = false;
            cameraFrame.dof.enabled = false;
            cameraFrame.update();

            // changed while disabled, which the update ignores, and applied when enabled again
            cameraFrame.enabled = false;
            cameraFrame.dof.enabled = true;
            cameraFrame.update();
            cameraFrame.enabled = true;

            const framePass = cameraFrame.renderPassCamera;
            expect(dofPasses()).to.have.lengthOf(1);
            expect(framePass.options.prepassEnabled || framePass.options.sceneTextureDepth).to.equal(true);
            expect(assert.getCalls().filter(call => !call.args[0])).to.have.lengthOf(0);
            assert.restore();
        });

        it('keeps its debug views while it is enabled', function () {
            for (const view of ['dofcoc', 'dofblur']) {
                cameraFrame.debug = view;
                cameraFrame.dof.enabled = true;
                cameraFrame.update();
                expect(cameraFrame.renderPassCamera.composePass.debug).to.equal(view);
                cameraFrame.dof.enabled = false;
                cameraFrame.update();
                expect(cameraFrame.renderPassCamera.composePass.debug).to.equal(null);
            }
        });
    });

    describe('resolving the scene', function () {

        /** @type {ResolveEffect} */
        let resolve;

        beforeEach(function () {
            resolve = new ResolveEffect(app.graphicsDevice);
        });

        afterEach(function () {
            resolve.destroy();
        });

        it('runs the passes resolving the scene after the scene, before its half resolution copy, each reading what the one before it resolved', function () {
            const frameUpdate = spy(resolve, 'frameUpdate');
            cameraFrame.addEffect(resolve);
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;
            const passes = framePass.beforePasses;
            const taaPass = cameraFrame.taa._pass;
            const dofPass = cameraFrame.dof._pass;

            // TAA is registered first, as a built-in effect
            expect(passes.indexOf(framePass.scenePass)).to.be.below(passes.indexOf(taaPass));
            expect(passes.indexOf(taaPass)).to.be.below(passes.indexOf(resolve.pass));
            expect(passes.indexOf(resolve.pass)).to.be.below(passes.indexOf(framePass.scenePassHalf));
            expect(passes.indexOf(framePass.scenePassHalf)).to.be.below(passes.indexOf(dofPass));

            for (let i = 0; i < 2; i++) {
                framePass.frameUpdate();

                // the TAA resolves the scene render target's color, and this effect the TAA output
                expect(taaPass.sourceTexture).to.equal(framePass.sceneTexture);
                expect(resolve.inputs[resolve.inputs.length - 1]).to.equal(taaPass.historyTexture);

                // the rest of the frame reads what this effect resolved
                expect(framePass.composePass.sceneTexture).to.equal(resolve.output);
                expect(framePass.scenePassHalf.sourceTexture).to.equal(resolve.output);
                const [frame] = frameUpdate.lastCall.args;
                expect(frame.sceneTexture).to.equal(resolve.output);
                expect([frame.renderWidth, frame.renderHeight]).to.deep.equal([frame.sceneWidth, frame.sceneHeight]);
            }
        });

        it('resolves the scene before the TAA when inserted before it', function () {
            cameraFrame.insertEffectBefore(resolve, cameraFrame.taa);
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;
            const passes = framePass.beforePasses;
            const taaPass = cameraFrame.taa._pass;
            expect(passes.indexOf(resolve.pass)).to.be.below(passes.indexOf(taaPass));

            framePass.frameUpdate();
            expect(resolve.inputs).to.deep.equal([framePass.sceneTexture]);
            expect(taaPass.sourceTexture).to.equal(resolve.output);
            expect(framePass.composePass.sceneTexture).to.equal(taaPass.historyTexture);
        });

        it('reads the scene render target when no effect resolves the scene', function () {
            cameraFrame.taa.enabled = false;
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;
            expect(cameraFrame.taa._pass).to.equal(null);

            framePass.frameUpdate();
            expect(framePass.composePass.sceneTexture).to.equal(framePass.sceneTexture);
            expect(framePass.scenePassHalf.sourceTexture).to.equal(framePass.sceneTexture);
        });

        it('jitters the camera by the most the effects taking part need, and not at all once none does', function () {
            const { cameraComponent, taa } = cameraFrame;
            taa.jitter = 0.25;
            cameraFrame.update();
            expect(cameraComponent.jitter).to.equal(0.25);

            // applied with the effects, on the next update
            resolve.jitterNeeded = 0.75;
            cameraFrame.addEffect(resolve);
            expect(cameraComponent.jitter).to.equal(0.25);
            cameraFrame.update();
            expect(cameraComponent.jitter).to.equal(0.75);

            taa.enabled = false;
            cameraFrame.update();
            expect(cameraComponent.jitter).to.equal(0.75);

            cameraFrame.removeEffect(resolve);
            cameraFrame.update();
            expect(cameraComponent.jitter).to.equal(0);

            // disabling the camera frame stops the jitter, and enabling it applies it again
            taa.enabled = true;
            cameraFrame.update();
            cameraFrame.enabled = false;
            expect(cameraComponent.jitter).to.equal(0);
            cameraFrame.enabled = true;
            expect(cameraComponent.jitter).to.equal(0.25);
        });

        it('keeps resolving the scene with a removed TAA until the next update, upscaling included', function () {
            const { taa } = cameraFrame;
            taa.upscale = true;
            cameraFrame.rendering.renderTargetScale = 0.5;
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;
            const pass = taa._pass;
            framePass.frameUpdate();

            // the removal applies at the next update, the frame rendering the TAA until then
            cameraFrame.removeEffect(taa);
            expect(taa.cameraFrame).to.equal(null);
            for (let i = 0; i < 2; i++) {
                expect(() => framePass.frameUpdate()).to.not.throw();
                expect(framePass.composePass.sceneTexture).to.equal(pass.historyTexture);
            }

            cameraFrame.update();
            expect(cameraFrame.renderPassCamera.beforePasses).to.not.include(pass);
            expect(cameraFrame.cameraComponent.jitter).to.equal(0);
        });

        it('renders the scene depth for the TAA', function () {
            cameraFrame.dof.enabled = false;
            cameraFrame.update();
            expect(cameraFrame.options.depthRequired).to.equal(true);

            cameraFrame.taa.enabled = false;
            cameraFrame.update();
            expect(cameraFrame.options.depthRequired).to.equal(false);
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
            expect(passes.indexOf(pass)).to.be.below(passes.indexOf(cameraFrame.taa._pass));
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

    describe('lens flare', function () {

        it('keeps drawing the flares after it is removed, until the next update', function () {
            const lensFlare = new LensFlareEffect(app.graphicsDevice);
            lensFlare.add(new LensFlare(null, { position: new Vec3(0, 0, -10) }));
            cameraFrame.addEffect(lensFlare);
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;
            const pass = lensFlare._pass;
            expect(framePass.beforePasses).to.include(pass);
            framePass.frameUpdate();

            cameraFrame.removeEffect(lensFlare);
            expect(lensFlare.cameraFrame).to.equal(null);
            expect(() => framePass.frameUpdate()).to.not.throw();

            cameraFrame.update();
            expect(cameraFrame.renderPassCamera.beforePasses).to.not.include(pass);
            lensFlare.destroy();
        });
    });

    describe('volumetric fog', function () {

        const fogPass = () => cameraFrame.renderPassCamera.beforePasses.find(pass => pass instanceof FramePassVolumetricFog);

        // lit by a directional light, with nothing else but TAA needing the depth
        beforeEach(function () {
            const entity = new Entity('Light');
            entity.addComponent('light', { type: 'directional' });
            app.root.addChild(entity);
            cameraFrame.volumetricFog.light = entity.light;
            cameraFrame.volumetricFog.enabled = true;
            cameraFrame.bloom.intensity = 0;
            cameraFrame.dof.enabled = false;
        });

        it('blends the fog into the scene after the scene and the occlusion, before TAA', function () {
            cameraFrame.ssao.type = SSAOTYPE_COMBINE;
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;
            const passes = framePass.beforePasses;
            const pass = fogPass();
            const ssao = passes.find(p => p instanceof RenderPassSsao);

            expect(pass).to.equal(cameraFrame.volumetricFog._pass);
            expect(passes.indexOf(framePass.scenePass)).to.be.below(passes.indexOf(ssao));
            expect(passes.indexOf(ssao)).to.be.below(passes.indexOf(pass));
            expect(passes.indexOf(pass)).to.be.below(passes.indexOf(cameraFrame.taa._pass));
            expect(cameraFrame._activeEffects).to.include(cameraFrame.volumetricFog);
        });

        it('keeps rendering its passes after it is removed, until the next update', function () {
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;
            const fog = cameraFrame.volumetricFog;
            const pass = fogPass();
            framePass.frameUpdate();

            cameraFrame.removeEffect(fog);
            expect(fog.cameraFrame).to.equal(null);
            expect(() => framePass.frameUpdate()).to.not.throw();
            expect(pass.localPass.scenePass).to.equal(framePass.scenePass);

            cameraFrame.update();
            expect(fogPass()).to.equal(undefined);
        });

        it('renders the depth while it is active, and releases its passes once disabled', function () {
            cameraFrame.taa.enabled = false;
            cameraFrame.update();
            let framePass = cameraFrame.renderPassCamera;
            const pass = fogPass();
            expect(framePass.options.prepassEnabled || framePass.options.sceneTextureDepth).to.equal(true);

            const destroy = spy(pass, 'destroy');
            cameraFrame.volumetricFog.enabled = false;
            cameraFrame.update();
            framePass = cameraFrame.renderPassCamera;
            expect(destroy.callCount).to.equal(1);
            expect(fogPass()).to.equal(undefined);
            expect(framePass.options.prepassEnabled || framePass.options.sceneTextureDepth).to.equal(false);
            expect(cameraFrame._activeEffects).to.not.include(cameraFrame.volumetricFog);
        });

        it('blends into the scene color alone while the scene renders the depth, and into the multi-sampled scene', function () {

            // the scene renders the depth on a device capable of it, which the null device is made
            const device = app.graphicsDevice;
            if (device.isNull) {
                device.supportsIndependentBlending = true;
                device.textureFloatBlendable = true;
            }
            cameraFrame.update();
            let framePass = cameraFrame.renderPassCamera;
            let target = fogPass().combinePass.renderTarget;
            if (device.isNull) {
                expect(framePass.options.sceneTextureDepth).to.equal(true);
            }
            if (framePass.options.sceneTextureDepth) {
                expect(target).to.equal(framePass.rtSceneColor);
                expect(target.depth).to.equal(false);
                expect(target.colorBufferCount).to.equal(1);
            } else {
                expect(target).to.equal(framePass.rt);
            }
            expect(target.colorBuffer).to.equal(framePass.sceneTexture);

            // the depth is then rendered by the prepass, to its own render target
            cameraFrame.rendering.samples = 4;
            cameraFrame.update();
            framePass = cameraFrame.renderPassCamera;
            target = fogPass().combinePass.renderTarget;
            expect(framePass.options.prepassEnabled).to.equal(true);
            expect(framePass.rtSceneColor).to.equal(null);
            expect(target).to.equal(framePass.rt);
        });

        it('is inactive without a light source, and on an orthographic camera', function () {
            const fog = cameraFrame.volumetricFog;
            const warnOnce = stub(Debug, 'warnOnce');
            fog.light = null;
            cameraFrame.update();
            expect(fogPass()).to.equal(undefined);

            fog.localSpotLights = true;
            cameraFrame.update();
            expect(fogPass()).to.not.equal(undefined);
            expect(warnOnce.callCount).to.equal(0);

            cameraFrame.cameraComponent.projection = PROJECTION_ORTHOGRAPHIC;
            cameraFrame.update();
            expect(fogPass()).to.equal(undefined);
            expect(warnOnce.callCount).to.be.above(0);
        });

        it('lights the fog by the local lights with the light clusters of the scene pass, also once rebuilt', function () {
            cameraFrame.volumetricFog.localSpotLights = true;
            cameraFrame.update();
            let framePass = cameraFrame.renderPassCamera;
            framePass.frameUpdate();
            expect(fogPass().localPass.scenePass).to.equal(framePass.scenePass);

            // a change of the scene format rebuilds the frame passes, with a new scene pass
            const { scenePass } = framePass;
            cameraFrame.rendering.samples = 4;
            cameraFrame.update();
            framePass = cameraFrame.renderPassCamera;
            framePass.frameUpdate();
            expect(framePass.scenePass).to.not.equal(scenePass);
            expect(fogPass().localPass.scenePass).to.equal(framePass.scenePass);
        });

        it('cycles its noise pattern over the frames while TAA is enabled', function () {
            cameraFrame.update();
            const framePass = cameraFrame.renderPassCamera;
            framePass.frameUpdate();
            fogPass().frameUpdate();
            expect(fogPass().temporalDither).to.equal(true);
            expect(fogPass().fogPass.noiseOffset).to.not.equal(0);

            cameraFrame.taa.enabled = false;
            cameraFrame.update();
            fogPass().frameUpdate();
            expect(fogPass().temporalDither).to.equal(false);
            expect(fogPass().fogPass.noiseOffset).to.equal(0);
        });
    });
});
