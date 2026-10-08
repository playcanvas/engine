import { expect } from 'chai';
import { restore, spy, stub } from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { CameraFrameEffect } from '../../../src/extras/render-passes/camera-frame-effect.js';
import { CameraFrame } from '../../../src/extras/render-passes/camera-frame.js';
import {
    COMPOSESLOT_HDR, COMPOSESLOT_LDR, COMPOSESLOT_SCENE, FRAMERESOURCE_DEPTH, FRAMERESOURCE_PREPASSDEPTH,
    FRAMERESOURCE_SCENECOLORHALF, SSAOTYPE_COMBINE, SSAOTYPE_LIGHTING, SSAOTYPE_NONE
} from '../../../src/extras/render-passes/constants.js';
import { BloomEffect } from '../../../src/extras/render-passes/effects/bloom-effect.js';
import { CasEffect } from '../../../src/extras/render-passes/effects/cas-effect.js';
import { ColorEnhanceEffect } from '../../../src/extras/render-passes/effects/color-enhance-effect.js';
import { ColorLutEffect } from '../../../src/extras/render-passes/effects/color-lut-effect.js';
import { FringingEffect } from '../../../src/extras/render-passes/effects/fringing-effect.js';
import { GradingEffect } from '../../../src/extras/render-passes/effects/grading-effect.js';
import { SsaoEffect } from '../../../src/extras/render-passes/effects/ssao-effect.js';
import { VignetteEffect } from '../../../src/extras/render-passes/effects/vignette-effect.js';
import { FramePassBloom } from '../../../src/extras/render-passes/frame-pass-bloom.js';
import { RenderPassCompose } from '../../../src/extras/render-passes/render-pass-compose.js';
import { RenderPassSsao } from '../../../src/extras/render-passes/render-pass-ssao.js';
import { PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA8, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../../src/platform/graphics/constants.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { CameraShaderParams } from '../../../src/scene/camera-shader-params.js';
import { RenderPassShaderQuad } from '../../../src/scene/graphics/render-pass-shader-quad.js';
import { setProgramLibrary } from '../../../src/scene/shader-lib/get-program-library.js';
import { shaderChunksGLSL } from '../../../src/scene/shader-lib/glsl/collections/shader-chunks-glsl.js';
import { ProgramLibrary } from '../../../src/scene/shader-lib/program-library.js';
import { ShaderChunks } from '../../../src/scene/shader-lib/shader-chunks.js';
import { shaderChunksWGSL } from '../../../src/scene/shader-lib/wgsl/collections/shader-chunks-wgsl.js';

describe('CameraFrameEffect', function () {

    /** @type {NullGraphicsDevice} */
    let device;

    // a camera frame with a device behind it but no frame passes - enough for the effect registry
    // and the effects' uniform and define plumbing, without rendering anything
    const createCameraFrame = () => {
        const cameraFrame = Object.create(CameraFrame.prototype);
        cameraFrame.app = { graphicsDevice: device };
        cameraFrame.effects = [];
        cameraFrame._activeEffects = [];
        cameraFrame.renderPassCamera = null;
        return cameraFrame;
    };

    // a data-driven effect: the base class constructed with its declarations
    const createEffect = (id, slot, declarations = {}) => new CameraFrameEffect(device, id, { slot, ...declarations });

    const failedAsserts = () => Debug.assert.getCalls().filter(call => !call.args[0]).map(call => call.args[1]);

    beforeEach(function () {
        device = new NullGraphicsDevice({ width: 128, height: 128 });
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).add(shaderChunksGLSL);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).add(shaderChunksWGSL);
        setProgramLibrary(device, new ProgramLibrary(device));
        stub(Debug, 'assert');
        stub(Debug, 'warnOnce');
    });

    afterEach(function () {
        restore();
        device.destroy();
    });

    describe('identity', function () {

        it('takes its id and declarations from the constructor', function () {
            const effect = new CameraFrameEffect(device, 'grain', {
                slot: COMPOSESLOT_LDR,
                glsl: 'g',
                wgsl: 'w',
                debugViews: ['grain'],
                requires: ['depth']
            });
            expect(effect.id).to.equal('grain');
            expect(effect.slot).to.equal(COMPOSESLOT_LDR);
            expect(effect.glsl).to.equal('g');
            expect(effect.wgsl).to.equal('w');
            expect(effect.getChunk(SHADERLANGUAGE_WGSL)).to.equal('w');
            expect(effect.debugViews).to.deep.equal(['grain']);
            expect(effect.requires).to.deep.equal(['depth']);
        });

        it('has no slot, chunk, passes or debug views unless given them', function () {
            const effect = new CameraFrameEffect(device, 'fog');
            expect(effect.slot).to.equal(null);
            expect(effect.glsl).to.equal(null);
            expect(effect.wgsl).to.equal(null);
            expect(effect.debugViews).to.deep.equal([]);
            expect(effect.requires).to.deep.equal([]);
            expect(effect._ownsPasses).to.equal(false);
        });

        it('keeps its declarations read-only', function () {
            const effect = new CameraFrameEffect(device, 'grain', { slot: COMPOSESLOT_LDR, glsl: 'g' });
            for (const name of ['id', 'slot', 'glsl', 'wgsl', 'debugViews', 'chunkName', 'entryPoint', 'requires']) {
                expect(() => {
                    effect[name] = 'x';
                }, name).to.throw(TypeError);
            }
        });

        it('lets a subclass compute a declaration from a parameter', function () {
            class Ssao extends CameraFrameEffect {
                lighting = false;

                constructor() {
                    super(device, 'ssao');
                }

                get requires() {
                    return [this.lighting ? 'prepassDepth' : 'depth'];
                }
            }
            const effect = new Ssao();
            expect(effect.requires).to.deep.equal(['depth']);
            effect.lighting = true;
            expect(effect.requires).to.deep.equal(['prepassDepth']);
        });

        it('owns passes when it implements createPasses', function () {
            class WithPasses extends CameraFrameEffect {
                createPasses(resources, passes) {
                }
            }
            expect(new WithPasses(device, 'withPasses')._ownsPasses).to.equal(true);
            expect(new BloomEffect(device)._ownsPasses).to.equal(true);
            expect(new CameraFrameEffect(device, 'plain')._ownsPasses).to.equal(false);
            expect(new VignetteEffect(device)._ownsPasses).to.equal(false);
        });

        it('asserts when constructed without an id or a device', function () {
            expect(new CameraFrameEffect(device).id).to.equal(undefined);
            expect(failedAsserts()).to.have.lengthOf(1);
            expect(new CameraFrameEffect(null, 'x').device).to.equal(null);
            expect(failedAsserts()).to.have.lengthOf(2);
        });

        it('keeps its device', function () {
            expect(new CameraFrameEffect(device, 'x').device).to.equal(device);
        });

        it('is used by the built-in effects, each at the slot matching its place in the composition', function () {
            const builtIns = [
                [CasEffect, 'cas', COMPOSESLOT_SCENE],
                [FringingEffect, 'fringing', COMPOSESLOT_SCENE],
                [SsaoEffect, 'ssao', COMPOSESLOT_HDR],
                [BloomEffect, 'bloom', COMPOSESLOT_HDR],
                [ColorEnhanceEffect, 'colorEnhance', COMPOSESLOT_HDR],
                [GradingEffect, 'grading', COMPOSESLOT_HDR],
                [ColorLutEffect, 'colorLut', COMPOSESLOT_LDR],
                [VignetteEffect, 'vignette', COMPOSESLOT_LDR]
            ];
            for (const [EffectClass, id, slot] of builtIns) {
                const effect = new EffectClass(device);
                expect(effect.id).to.equal(id);
                expect(effect.slot).to.equal(slot);
                expect(effect.glsl).to.be.a('string');
                expect(effect.wgsl).to.be.a('string');
            }
        });
    });

    describe('derived names', function () {

        it('derives the chunk name, entry point and define from the id', function () {
            const effect = new CameraFrameEffect(device, 'colorEnhance');
            expect(effect.chunkName).to.equal('composeColorEnhancePS');
            expect(effect.entryPoint).to.equal('applyColorEnhance');
            expect(effect.defineName).to.equal('COLOR_ENHANCE');
        });

        it('keeps acronyms in the define', function () {
            expect(new CameraFrameEffect(device, 'colorLUT').defineName).to.equal('COLOR_LUT');
        });

        it('reproduces the names of the built-in chunks', function () {
            expect(new VignetteEffect(device).chunkName).to.equal('composeVignettePS');
            expect(new VignetteEffect(device).entryPoint).to.equal('applyVignette');
            expect(new GradingEffect(device).chunkName).to.equal('composeGradingPS');
            expect(new GradingEffect(device).defineName).to.equal('GRADING');
            expect(new SsaoEffect(device).chunkName).to.equal('composeSsaoPS');
            expect(new SsaoEffect(device).defineName).to.equal('SSAO');
            expect(new BloomEffect(device).chunkName).to.equal('composeBloomPS');
            expect(new BloomEffect(device).defineName).to.equal('BLOOM');
            expect(new CasEffect(device).chunkName).to.equal('composeCasPS');
            expect(new CasEffect(device).defineName).to.equal('CAS');
            expect(new FringingEffect(device).chunkName).to.equal('composeFringingPS');
            expect(new ColorEnhanceEffect(device).chunkName).to.equal('composeColorEnhancePS');
            expect(new ColorLutEffect(device).chunkName).to.equal('composeColorLutPS');
            expect(new ColorLutEffect(device).defineName).to.equal('COLOR_LUT');
        });

        it('names an entry function each built-in chunk declares', function () {
            for (const EffectClass of [CasEffect, FringingEffect, SsaoEffect, BloomEffect, ColorEnhanceEffect, GradingEffect, ColorLutEffect, VignetteEffect]) {
                const effect = new EffectClass(device);
                expect(effect.glsl, effect.id).to.include(` ${effect.entryPoint}(`);
                expect(effect.wgsl, effect.id).to.include(`fn ${effect.entryPoint}(`);
            }
        });

        it('lets the derived names be given explicitly', function () {
            const effect = new CameraFrameEffect(device, 'vignette', { chunkName: 'composeMyVignettePS', entryPoint: 'myVignette' });
            expect(effect.chunkName).to.equal('composeMyVignettePS');
            expect(effect.entryPoint).to.equal('myVignette');
        });
    });

    describe('active', function () {

        it('follows enabled by default', function () {
            const effect = new CameraFrameEffect(device, 'test');
            expect(effect.active).to.equal(true);
            effect.enabled = false;
            expect(effect.active).to.equal(false);
        });

        it('is gated on the intensity for the vignette', function () {
            const effect = new VignetteEffect(device);
            expect(effect.active).to.equal(false);
            effect.intensity = 0.5;
            expect(effect.active).to.equal(true);
            effect.enabled = false;
            expect(effect.active).to.equal(false);
        });

        it('is off by default for grading and color enhancement', function () {
            for (const EffectClass of [GradingEffect, ColorEnhanceEffect]) {
                const effect = new EffectClass(device);
                expect(effect.active).to.equal(false);
                effect.enabled = true;
                expect(effect.active).to.equal(true);
            }
        });

        it('is gated on the intensity for fringing and the sharpness for CAS', function () {
            const fringing = new FringingEffect(device);
            expect(fringing.active).to.equal(false);
            fringing.intensity = 10;
            expect(fringing.active).to.equal(true);

            const cas = new CasEffect(device);
            expect(cas.active).to.equal(false);
            cas.sharpness = 0.5;
            expect(cas.active).to.equal(true);
            cas.enabled = false;
            expect(cas.active).to.equal(false);
        });

        it('is gated on the primary texture for the color LUT', function () {
            const lut = new ColorLutEffect(device);
            expect(lut.active).to.equal(false);
            lut.texture2 = /** @type {any} */ ({});
            expect(lut.active).to.equal(false);
            lut.texture = /** @type {any} */ ({});
            expect(lut.active).to.equal(true);
        });
    });

    describe('update of the built-in effects', function () {

        it('maps an HDR scene to LDR around the sharpening, from the scene format of the camera frame', function () {
            const cas = new CasEffect(device);
            expect(cas._defines.get('CAS_HDR')).to.equal(true);

            cas.cameraFrame = /** @type {any} */ ({ hdrFormat: PIXELFORMAT_RGBA8 });
            cas.update();
            expect(cas._defines.has('CAS_HDR')).to.equal(false);

            cas.cameraFrame = /** @type {any} */ ({ hdrFormat: PIXELFORMAT_RGBA16F });
            cas.update();
            expect(cas._defines.get('CAS_HDR')).to.equal(true);
        });

        it('samples the secondary LUT only while one is assigned', function () {
            const lut = new ColorLutEffect(device);
            lut.texture = /** @type {any} */ ({ width: 256, height: 16, srgb: true });
            lut.update();
            expect(lut._defines.has('COLOR_LUT2')).to.equal(false);

            lut.texture2 = lut.texture;
            lut.update();
            expect(lut._defines.get('COLOR_LUT2')).to.equal(true);

            lut.texture2 = null;
            lut.update();
            expect(lut._defines.has('COLOR_LUT2')).to.equal(false);
        });

        it('warns once about a LUT texture configured differently from how it is sampled', function () {
            const lut = new ColorLutEffect(device);
            lut.texture = /** @type {any} */ ({ name: 'badLut', width: 64, height: 64, srgb: false, mipmaps: true });
            lut.update();
            lut.update();

            expect(Debug.warnOnce.callCount).to.equal(1);
            expect(Debug.warnOnce.firstCall.args[0]).to.include('CameraFrame.colorLUT.texture: texture \'badLut\'');
            expect(Debug.warnOnce.firstCall.args[0]).to.include('size: 256x16');
        });
    });

    describe('bloom', function () {

        // a bloom effect on a camera frame stand-in supplying the scene format
        const createBloom = (hdrFormat = PIXELFORMAT_RGBA16F) => {
            const bloom = new BloomEffect(device);
            bloom.cameraFrame = /** @type {any} */ ({ hdrFormat });
            return bloom;
        };

        // the frame resources the camera frame would provide for it, under the constant's value
        const createResources = () => {
            const texture = new Texture(device, { name: 'half', width: 64, height: 32, format: PIXELFORMAT_RGBA16F });
            return { [FRAMERESOURCE_SCENECOLORHALF]: texture };
        };

        // the passes it creates after the temporal anti-aliasing, the only stage it uses
        const createPasses = (bloom, resources = createResources()) => {
            const passes = { preScene: [], postOpaque: [], postScene: [], postTemporal: [] };
            bloom.createPasses(resources, passes);
            expect(passes.preScene.length + passes.postOpaque.length + passes.postScene.length).to.equal(0);
            return passes.postTemporal;
        };

        it('owns passes, which read the half resolution scene', function () {
            const bloom = createBloom();
            expect(bloom._ownsPasses).to.equal(true);
            expect(bloom.requires).to.deep.equal([FRAMERESOURCE_SCENECOLORHALF]);
            expect(bloom.debugViews).to.deep.equal(['bloom']);
        });

        it('is active with an intensity on an HDR scene only', function () {
            const bloom = createBloom();
            expect(bloom.active).to.equal(false);
            bloom.intensity = 0.05;
            expect(bloom.active).to.equal(true);
            bloom.enabled = false;
            expect(bloom.active).to.equal(false);

            const ldr = createBloom(PIXELFORMAT_RGBA8);
            ldr.intensity = 0.05;
            expect(ldr.active).to.equal(false);
        });

        it('creates its pass over the half resolution scene, and destroys it', function () {
            const bloom = createBloom();
            const resources = createResources();
            const passes = createPasses(bloom, resources);
            expect(passes).to.have.lengthOf(1);
            const [pass] = passes;
            expect(pass).to.be.an.instanceOf(FramePassBloom);
            expect(pass._sourceTexture).to.equal(resources.sceneColorHalf);
            expect(pass.textureFormat).to.equal(PIXELFORMAT_RGBA16F);

            const destroy = spy(pass, 'destroy');
            bloom.destroyPasses();
            expect(destroy.callCount).to.equal(1);

            // and again is a no-op, the passes being gone
            bloom.destroyPasses();
            bloom.cameraFrame = null;
            bloom.destroy();
            expect(destroy.callCount).to.equal(1);
        });

        it('applies its parameters to its pass and the composition when updated', function () {
            const bloom = createBloom();
            bloom.intensity = 0.05;
            const [pass] = createPasses(bloom);

            bloom.blurLevel = 5;
            bloom.threshold = 2;
            bloom.update();
            expect(pass.blurLevel).to.equal(5);
            expect(pass.threshold).to.equal(2);

            bloom._bindUniforms();
            expect(device.scope.resolve('bloomTexture').value).to.equal(pass.bloomTexture);
            expect(device.scope.resolve('bloomIntensity').value).to.equal(0.05);
        });

        it('generates the bloom from the full resolution scene of each frame in high quality', function () {
            const bloom = createBloom();
            bloom.highQuality = true;
            expect(bloom.requires).to.deep.equal([]);

            const [pass] = createPasses(bloom, {});
            expect(pass._sourceTexture).to.equal(null);
            expect(pass._removeInvalid).to.equal(true);

            const scene = new Texture(device, { name: 'scene', width: 128, height: 64, format: PIXELFORMAT_RGBA16F });
            bloom.frameUpdate({ sceneTexture: scene, sceneWidth: 128, sceneHeight: 64 });
            expect(pass._sourceTexture).to.equal(scene);

            // one more level, the first being a finer one, keeps the blur the same size on screen
            bloom.blurLevel = 5;
            bloom.update();
            expect(pass.blurLevel).to.equal(6);
        });

        it('renders what its passes were built for until they are rebuilt', function () {
            const bloom = createBloom();
            const resources = createResources();
            const [pass] = createPasses(bloom, resources);
            expect(pass._removeInvalid).to.equal(false);

            // high quality takes a rebuild, which a change of the requirements causes on update
            bloom.highQuality = true;
            const scene = new Texture(device, { name: 'scene', width: 128, height: 64, format: PIXELFORMAT_RGBA16F });
            bloom.frameUpdate({ sceneTexture: scene, sceneWidth: 128, sceneHeight: 64 });
            expect(pass._sourceTexture).to.equal(resources.sceneColorHalf);
            bloom.blurLevel = 5;
            bloom.update();
            expect(pass.blurLevel).to.equal(5);
        });
    });

    describe('ssao', function () {

        // an SSAO effect on a camera frame stand-in supplying the camera
        const createSsao = (type = SSAOTYPE_COMBINE) => {
            const ssao = new SsaoEffect(device);
            ssao.type = type;
            ssao.cameraFrame = /** @type {any} */ ({ cameraComponent: { shaderParams: new CameraShaderParams() } });
            return ssao;
        };

        // the scene depth the camera frame would provide for it, under both names
        const createResources = () => {
            const texture = new Texture(device, { name: 'depth', width: 64, height: 32, format: PIXELFORMAT_RGBA16F });
            const depth = { texture, defines: new Map(), key: '' };
            return { [FRAMERESOURCE_DEPTH]: depth, [FRAMERESOURCE_PREPASSDEPTH]: depth };
        };

        const createPasses = (ssao, resources = createResources()) => {
            const passes = { preScene: [], postOpaque: [], postScene: [], postTemporal: [] };
            ssao.createPasses(resources, passes);
            return passes;
        };

        it('is active unless its type is none', function () {
            const ssao = createSsao(SSAOTYPE_NONE);
            expect(ssao.active).to.equal(false);
            ssao.type = SSAOTYPE_LIGHTING;
            expect(ssao.active).to.equal(true);
            ssao.type = SSAOTYPE_COMBINE;
            expect(ssao.active).to.equal(true);
            ssao.enabled = false;
            expect(ssao.active).to.equal(false);
        });

        it('requires the depth of the prepass in the lighting mode, and any scene depth otherwise', function () {
            const ssao = createSsao(SSAOTYPE_COMBINE);
            expect(ssao.requires).to.deep.equal([FRAMERESOURCE_DEPTH]);
            ssao.type = SSAOTYPE_LIGHTING;
            expect(ssao.requires).to.deep.equal([FRAMERESOURCE_PREPASSDEPTH]);
            expect(ssao.debugViews).to.deep.equal(['ssao']);
        });

        it('rebuilds its passes when the blur is switched', function () {
            const ssao = createSsao();
            const key = ssao.buildKey();
            ssao.blurEnabled = false;
            expect(ssao.buildKey()).to.not.equal(key);
        });

        it('generates the occlusion after the scene in the combine mode', function () {
            const ssao = createSsao(SSAOTYPE_COMBINE);
            const resources = createResources();
            const passes = createPasses(ssao, resources);
            expect(passes.postScene).to.have.lengthOf(1);
            expect(passes.preScene).to.have.lengthOf(0);
            const [pass] = passes.postScene;
            expect(pass).to.be.an.instanceOf(RenderPassSsao);
            expect(pass.sourceTexture).to.equal(resources.depth.texture);
            expect(ssao.cameraFrame.cameraComponent.shaderParams.ssaoEnabled).to.equal(false);

            ssao.update();
            expect(ssao._defines.has('SSAO_LIGHTING')).to.equal(false);
        });

        it('generates the occlusion before the scene for the lit materials in the lighting mode', function () {
            const ssao = createSsao(SSAOTYPE_LIGHTING);
            const resources = createResources();
            const passes = createPasses(ssao, resources);
            expect(passes.preScene).to.have.lengthOf(1);
            expect(passes.postScene).to.have.lengthOf(0);
            expect(passes.preScene[0].sourceTexture).to.equal(resources.prepassDepth.texture);
            expect(ssao.cameraFrame.cameraComponent.shaderParams.ssaoEnabled).to.equal(true);

            // the composition then only displays it in the debug view
            ssao.update();
            expect(ssao._defines.get('SSAO_LIGHTING')).to.equal(true);
        });

        it('applies its parameters to its pass and the composition when updated', function () {
            const ssao = createSsao();
            const [pass] = createPasses(ssao).postScene;
            Object.assign(ssao, { intensity: 0.7, power: 3, radius: 4, samples: 20, minAngle: 15, scale: 0.5, randomize: true });
            ssao.update();
            expect(pass.intensity).to.equal(0.7);
            expect(pass.power).to.equal(3);
            expect(pass.radius).to.equal(4);
            expect(pass.sampleCount).to.equal(20);
            expect(pass.minAngle).to.equal(15);
            expect(pass.scale).to.equal(0.5);
            expect(pass.randomize).to.equal(true);

            ssao._bindUniforms();
            expect(device.scope.resolve('ssaoTexture').value).to.equal(pass.ssaoTexture);
        });

        it('renders what its passes were built for until they are rebuilt', function () {
            const ssao = createSsao(SSAOTYPE_COMBINE);
            createPasses(ssao);
            ssao.type = SSAOTYPE_LIGHTING;
            ssao.update();
            expect(ssao._defines.has('SSAO_LIGHTING')).to.equal(false);
        });

        it('destroys its pass once', function () {
            const ssao = createSsao();
            const [pass] = createPasses(ssao).postScene;
            const destroy = spy(pass, 'destroy');
            ssao.destroyPasses();
            ssao.destroyPasses();
            expect(destroy.callCount).to.equal(1);
        });
    });

    describe('setDefine', function () {

        it('versions the defines only when they change', function () {
            const effect = new CameraFrameEffect(device, 'test');
            expect(effect._definesVersion).to.equal(0);

            effect.setDefine('A', true);
            expect(effect._definesVersion).to.equal(1);
            expect(effect._defines.get('A')).to.equal(true);

            effect.setDefine('A', true);
            expect(effect._definesVersion).to.equal(1);

            effect.setDefine('A', 2);
            expect(effect._definesVersion).to.equal(2);
        });

        it('removes a define set to false, and ignores removing an absent one', function () {
            const effect = new CameraFrameEffect(device, 'test');
            effect.setDefine('A', true);
            effect.setDefine('A', false);
            expect(effect._defines.has('A')).to.equal(false);
            expect(effect._definesVersion).to.equal(2);

            effect.setDefine('B', false);
            expect(effect._definesVersion).to.equal(2);
        });
    });

    describe('setUniform', function () {

        it('stores a value by reference, bound when the composition draws', function () {
            const effect = createEffect('tint', COMPOSESLOT_LDR);
            const values = new Float32Array([1, 2, 3]);
            effect.setUniform('tintColor', values);

            // updated in place after it was set, as a material parameter can be
            values[0] = 5;
            effect._bindUniforms();
            const bound = device.scope.resolve('tintColor').value;
            expect(bound).to.equal(values);
            expect(bound[0]).to.equal(5);
        });

        it('replaces the value set before under the same name', function () {
            const effect = createEffect('tint', COMPOSESLOT_LDR);
            effect.setUniform('tintAmount', 0.25);
            effect.setUniform('tintAmount', 0.75);
            effect._bindUniforms();
            expect(device.scope.resolve('tintAmount').value).to.equal(0.75);
        });
    });

    describe('registry', function () {

        it('attaches on add and detaches on remove', function () {
            const cameraFrame = createCameraFrame();
            const effect = new VignetteEffect(device);

            cameraFrame.addEffect(effect);
            expect(effect.cameraFrame).to.equal(cameraFrame);
            expect(cameraFrame.effects).to.deep.equal([effect]);
            expect(cameraFrame.getEffect('vignette')).to.equal(effect);

            cameraFrame.removeEffect(effect);
            expect(effect.cameraFrame).to.equal(null);
            expect(cameraFrame.effects).to.deep.equal([]);
            expect(cameraFrame.getEffect('vignette')).to.equal(undefined);
        });

        it('applies neither adding nor removing an effect until the effects are applied', function () {
            const cameraFrame = createCameraFrame();
            const vignette = new VignetteEffect(device);
            vignette.intensity = 0.5;
            const update = spy(vignette, 'update');

            cameraFrame.addEffect(vignette);
            expect(cameraFrame._activeEffects).to.deep.equal([]);
            expect(update.callCount).to.equal(0);

            cameraFrame._applyEffects();
            expect(cameraFrame._activeEffects).to.deep.equal([vignette]);
            expect(update.callCount).to.equal(1);

            cameraFrame.removeEffect(vignette);
            expect(cameraFrame._activeEffects).to.deep.equal([vignette]);
            expect(update.callCount).to.equal(1);
        });

        it('inserts before another effect by instance or by id', function () {
            const cameraFrame = createCameraFrame();
            const grading = new GradingEffect(device);
            const vignette = new VignetteEffect(device);
            cameraFrame.addEffect(grading);
            cameraFrame.addEffect(vignette);

            const grain = new CameraFrameEffect(device, 'grain');
            const dither = new CameraFrameEffect(device, 'dither');
            cameraFrame.insertEffectBefore(grain, vignette);
            cameraFrame.insertEffectBefore(dither, 'grading');

            expect(cameraFrame.effects).to.deep.equal([dither, grading, grain, vignette]);
            expect(failedAsserts()).to.have.lengthOf(0);
        });

        it('is silent for a well-behaved custom effect', function () {
            const cameraFrame = createCameraFrame();
            cameraFrame.addEffect(new VignetteEffect(device));
            cameraFrame.addEffect(createEffect('grain', COMPOSESLOT_LDR, {
                glsl: 'vec3 applyGrain(vec3 c, vec2 uv) { return c; }',
                debugViews: ['grain']
            }));
            expect(failedAsserts()).to.have.lengthOf(0);
            expect(Debug.warnOnce.callCount).to.equal(0);
        });

        it('asserts when the effect was created on another device', function () {
            const cameraFrame = createCameraFrame();
            const other = new NullGraphicsDevice({ width: 8, height: 8 });
            cameraFrame.addEffect(new CameraFrameEffect(other, 'elsewhere'));
            expect(failedAsserts().some(message => message.includes('different graphics device'))).to.equal(true);
            other.destroy();
        });

        it('asserts on a duplicate id', function () {
            const cameraFrame = createCameraFrame();
            cameraFrame.addEffect(new VignetteEffect(device));
            cameraFrame.addEffect(new VignetteEffect(device));
            expect(failedAsserts().some(message => message.includes('id \'vignette\' is already registered'))).to.equal(true);
        });

        it('asserts on a debug view another effect provides', function () {
            const cameraFrame = createCameraFrame();
            cameraFrame.addEffect(new VignetteEffect(device));
            cameraFrame.addEffect(createEffect('other', null, { debugViews: ['vignette'] }));
            expect(failedAsserts().some(message => message.includes('already provided by effect \'vignette\''))).to.equal(true);
        });

        it('asserts on a debug view shadowing a built-in one', function () {
            const cameraFrame = createCameraFrame();
            cameraFrame.addEffect(createEffect('shadow', null, { debugViews: ['depth'] }));
            expect(failedAsserts().some(message => message.includes('shadows a built-in debug view'))).to.equal(true);
        });
    });

    describe('destroy', function () {

        it('removes the effect from its camera frame and releases its passes', function () {
            const cameraFrame = createCameraFrame();
            const effect = new VignetteEffect(device);
            cameraFrame.addEffect(effect);
            const destroyPasses = spy(effect, 'destroyPasses');

            effect.destroy();

            expect(cameraFrame.effects).to.deep.equal([]);
            expect(effect.cameraFrame).to.equal(null);
            expect(effect.device).to.equal(null);
            expect(destroyPasses.callCount).to.equal(1);
        });

        it('is safe on an effect that was never registered', function () {
            const effect = new VignetteEffect(device);
            effect.destroy();
            expect(effect.device).to.equal(null);
            expect(failedAsserts()).to.have.lengthOf(0);
        });
    });

    describe('composition', function () {

        const createPass = () => new RenderPassCompose(device, { shaderParams: new CameraShaderParams() });

        // the declarations the composition assembles from its active effects
        const declarationsOf = (pass) => {
            return pass._buildEffectChunks(SHADERLANGUAGE_GLSL, new Map()).get('composeEffectDeclarationsPS');
        };

        // applies the effects to the composition the way CameraFrame#update does: the active ones
        // take part, each applying its parameters first
        const applyEffects = (pass, effects) => {
            const active = effects.filter(effect => effect.active);
            active.forEach(effect => effect.update());
            pass.effects = active;
        };

        it('uses a user override of an effect chunk, and the effect source otherwise', function () {
            const chunks = ShaderChunks.get(device, SHADERLANGUAGE_GLSL);
            chunks.set('composeVignettePS', 'vec3 applyVignette(vec3 c, vec2 uv) { return c * 0.5; }');

            const pass = createPass();
            const vignette = new VignetteEffect(device);
            const grading = new GradingEffect(device);
            vignette.intensity = 0.5;
            grading.enabled = true;
            applyEffects(pass, [vignette, grading]);

            const declarations = declarationsOf(pass);
            expect(declarations).to.include('return c * 0.5');
            expect(declarations).to.include(grading.glsl);

            // the effect sources stay with the effects - the chunk map only holds overrides
            expect(chunks.get('composeGradingPS')).to.equal(undefined);
        });

        it('uses the source of an effect replacing one with the same id', function () {
            const red = createEffect('swap', COMPOSESLOT_LDR, { glsl: 'vec3 applySwap(vec3 c, vec2 uv) { return vec3(1, 0, 0); }' });
            const blue = createEffect('swap', COMPOSESLOT_LDR, { glsl: 'vec3 applySwap(vec3 c, vec2 uv) { return vec3(0, 0, 1); }' });

            const pass = createPass();
            applyEffects(pass, [red]);
            const redKey = pass.getShaderVariant(SHADERLANGUAGE_GLSL).key;

            red.destroy();
            applyEffects(pass, [blue]);

            expect(declarationsOf(pass)).to.include('vec3(0, 0, 1)');
            expect(declarationsOf(pass)).to.not.include('vec3(1, 0, 0)');
            expect(pass.getShaderVariant(SHADERLANGUAGE_GLSL).key).to.not.equal(redKey);
        });

        it('uses the own source of each camera\'s effect when their ids match', function () {
            const passes = ['vec3(1, 0, 0)', 'vec3(0, 0, 1)'].map((color) => {
                const pass = createPass();
                applyEffects(pass, [createEffect('tint', COMPOSESLOT_LDR, { glsl: `vec3 applyTint(vec3 c, vec2 uv) { return ${color}; }` })]);
                return pass;
            });

            expect(declarationsOf(passes[0])).to.include('vec3(1, 0, 0)');
            expect(declarationsOf(passes[1])).to.include('vec3(0, 0, 1)');
        });

        it('rebuilds the shader when an override is set or removed after the effect is registered', function () {
            const chunks = ShaderChunks.get(device, SHADERLANGUAGE_GLSL);
            const pass = createPass();
            const vignette = new VignetteEffect(device);
            vignette.intensity = 0.5;
            applyEffects(pass, [vignette]);

            pass.frameUpdate();
            const ownKey = pass._key;

            chunks.set('composeVignettePS', 'vec3 applyVignette(vec3 c, vec2 uv) { return c; }');
            pass.frameUpdate();
            const overrideKey = pass._key;

            chunks.delete('composeVignettePS');
            pass.frameUpdate();

            expect(overrideKey).to.not.equal(ownKey);
            expect(pass._key).to.equal(ownKey);
        });

        it('stops tracking the chunks of effects no longer registered', function () {
            const pass = createPass();
            const vignette = new VignetteEffect(device);
            vignette.intensity = 0.5;
            applyEffects(pass, [vignette]);
            expect([...pass._customComposeChunks.keys()]).to.include('composeVignettePS');

            applyEffects(pass, []);
            expect([...pass._customComposeChunks.keys()]).to.deep.equal(['composeDeclarationsPS', 'composeMainStartPS', 'composeMainEndPS']);
        });

        it('contributes nothing but zero counts for inactive effects', function () {
            const pass = createPass();
            applyEffects(pass, [new VignetteEffect(device), new GradingEffect(device)]);

            const defines = new Map();
            const includes = pass._buildEffectChunks(SHADERLANGUAGE_GLSL, defines);

            expect(includes.get('composeEffectDeclarationsPS')).to.equal('');
            for (const slot of ['SCENE', 'HDR', 'LDR', 'OUTPUT']) {
                expect(defines.get(`COMPOSE_${slot}_COUNT`)).to.equal('0');
            }
            expect([...defines.keys()].filter(name => !name.endsWith('_COUNT'))).to.deep.equal([]);
        });

        it('contributes the declarations, the slot call, the define and the debug view of an active effect', function () {
            const pass = createPass();
            const vignette = new VignetteEffect(device);
            const grading = new GradingEffect(device);
            vignette.intensity = 0.3;
            grading.enabled = true;
            grading.setDefine('GRADING_CUSTOM', 3);
            applyEffects(pass, [grading, vignette]);
            pass.debug = 'vignette';

            const defines = new Map();
            const includes = pass._buildEffectChunks(SHADERLANGUAGE_GLSL, defines);

            expect(defines.get('VIGNETTE')).to.equal(true);
            expect(defines.get('GRADING')).to.equal(true);
            expect(defines.get('GRADING_CUSTOM')).to.equal(3);
            expect(includes.get('composeEffectDeclarationsPS')).to.include('vec3 applyVignette(vec3 color, vec2 uv)');
            expect(includes.get('composeEffectDeclarationsPS')).to.include('vec3 applyGrading(vec3 color, vec2 uv)');

            // one call in each of the two slots, naming the entry functions
            expect(defines.get('COMPOSE_HDR_COUNT')).to.equal('1');
            expect(defines.get('{COMPOSE_HDR_FN0}')).to.equal('applyGrading');
            expect(defines.get('COMPOSE_LDR_COUNT')).to.equal('1');
            expect(defines.get('{COMPOSE_LDR_FN0}')).to.equal('applyVignette');
            expect(defines.get('COMPOSE_SCENE_COUNT')).to.equal('0');

            // the active debug view belongs to the vignette
            expect(defines.get('COMPOSE_EFFECT_DEBUG')).to.equal(true);
            expect(defines.get('{COMPOSE_DEBUG_FN}')).to.equal('debugVignette');
        });

        it('selects no debug function when the active view belongs to no effect', function () {
            const pass = createPass();
            const vignette = new VignetteEffect(device);
            vignette.intensity = 0.3;
            applyEffects(pass, [vignette]);
            pass.debug = 'bloom';

            const defines = new Map();
            pass._buildEffectChunks(SHADERLANGUAGE_GLSL, defines);

            expect(defines.has('COMPOSE_EFFECT_DEBUG')).to.equal(false);
            expect(defines.has('{COMPOSE_DEBUG_FN}')).to.equal(false);
        });

        it('operates on the scene sample for the scene slot', function () {
            const pass = createPass();
            applyEffects(pass, [createEffect('alpha', COMPOSESLOT_SCENE, {
                glsl: 'vec4 applyAlpha(vec4 s, vec2 uv) { return s; }'
            })]);

            const defines = new Map();
            pass._buildEffectChunks(SHADERLANGUAGE_GLSL, defines);
            expect(defines.get('COMPOSE_SCENE_COUNT')).to.equal('1');
            expect(defines.get('{COMPOSE_SCENE_FN0}')).to.equal('applyAlpha');
        });

        it('calls the effects of a slot in registration order', function () {
            const pass = createPass();
            applyEffects(pass, [
                createEffect('b', COMPOSESLOT_HDR, { glsl: 'vec3 applyB(vec3 c, vec2 uv) { return c; }' }),
                createEffect('a', COMPOSESLOT_HDR, { glsl: 'vec3 applyA(vec3 c, vec2 uv) { return c; }' })
            ]);

            const defines = new Map();
            pass._buildEffectChunks(SHADERLANGUAGE_GLSL, defines);
            expect(defines.get('COMPOSE_HDR_COUNT')).to.equal('2');
            expect(defines.get('{COMPOSE_HDR_FN0}')).to.equal('applyB');
            expect(defines.get('{COMPOSE_HDR_FN1}')).to.equal('applyA');
        });

        it('changes the shader key when an applied effect becomes active, changes a define, or its chunk is overridden', function () {
            const pass = createPass();
            const vignette = new VignetteEffect(device);
            applyEffects(pass, [vignette]);
            const key0 = pass.getShaderVariant(SHADERLANGUAGE_GLSL).key;

            // a change takes part once the effects are applied, as CameraFrame#update does
            vignette.intensity = 0.5;
            expect(pass.getShaderVariant(SHADERLANGUAGE_GLSL).key).to.equal(key0);
            applyEffects(pass, [vignette]);
            const key1 = pass.getShaderVariant(SHADERLANGUAGE_GLSL).key;

            vignette.setDefine('VIGNETTE_SQUARE', true);
            applyEffects(pass, [vignette]);
            const key2 = pass.getShaderVariant(SHADERLANGUAGE_GLSL).key;
            ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('composeVignettePS', 'vec3 applyVignette(vec3 c, vec2 uv) { return c; }');
            const key3 = pass.getShaderVariant(SHADERLANGUAGE_GLSL).key;

            expect(new Set([key0, key1, key2, key3]).size).to.equal(4);

            // the active effects are legible in the key (it names the shader), the rest is hashed
            expect(key1).to.include('-fx:vignette-');
            expect(key1).to.not.match(/[{}=]/);
        });

        it('provides empty per-frame hooks', function () {
            const effect = createEffect('tint', COMPOSESLOT_LDR);
            expect(effect.frameUpdate()).to.equal(undefined);
            expect(effect.update()).to.equal(undefined);
        });

        it('rebuilds its shader only when the applied effects or their defines change', function () {
            const pass = createPass();
            const vignette = new VignetteEffect(device);
            vignette.intensity = 0.5;
            applyEffects(pass, [vignette]);
            pass.frameUpdate();
            expect(pass._shaderDirty).to.equal(false);

            // applied again unchanged, as CameraFrame#update called every frame does
            applyEffects(pass, [vignette]);
            expect(pass._shaderDirty).to.equal(false);

            vignette.setDefine('VIGNETTE_SQUARE', true);
            applyEffects(pass, [vignette]);
            expect(pass._shaderDirty).to.equal(true);
        });

        it('binds the uniform values of its effects when it draws', function () {
            let drawn = null;
            stub(RenderPassShaderQuad.prototype, 'execute').callsFake(() => {
                drawn = device.scope.resolve('vignetterParams').value[3];
            });
            const pass = createPass();
            pass.sceneTexture = { width: 4, height: 4 };
            const vignette = new VignetteEffect(device);
            vignette.intensity = 0.5;
            applyEffects(pass, [vignette]);

            // the shared uniform written in between, as the effect of another camera would
            device.scope.resolve('vignetterParams').setValue(new Float32Array(4));
            pass.execute();
            expect(drawn).to.equal(0.5);
        });

        it('provides the size of the scene texture to the chunks', function () {
            stub(RenderPassShaderQuad.prototype, 'execute');
            const pass = createPass();
            pass.sceneTexture = { width: 64, height: 32 };
            pass.execute();
            expect([...device.scope.resolve('sceneTextureSize').value]).to.deep.equal([64, 32, 1 / 64, 1 / 32]);
        });

        it('renders each camera with its own effect values', function () {
            // the frame graph prepares every camera before any of them renders, and the cameras
            // share the device's uniforms - each must still draw with the values of its own effect
            const drawn = [];
            stub(RenderPassShaderQuad.prototype, 'execute').callsFake(() => {
                drawn.push(device.scope.resolve('vignetterParams').value[3]);
            });

            const passes = [0.25, 0.75].map((intensity) => {
                const pass = createPass();
                pass.sceneTexture = { width: 4, height: 4 };
                const vignette = new VignetteEffect(device);
                vignette.intensity = intensity;
                applyEffects(pass, [vignette]);
                return pass;
            });

            passes.forEach(pass => pass.frameUpdate());
            passes.forEach(pass => pass.execute());

            expect(drawn).to.deep.equal([0.25, 0.75]);
        });

        it('warns when two effects supply the same chunk name', function () {
            const pass = createPass();
            const vignette = new VignetteEffect(device);
            vignette.intensity = 0.5;
            applyEffects(pass, [vignette, createEffect('clash', COMPOSESLOT_LDR, {
                chunkName: 'composeVignettePS',
                glsl: 'vec3 applyClash(vec3 c, vec2 uv) { return c; }'
            })]);

            expect(Debug.warnOnce.callCount).to.equal(1);
            expect(Debug.warnOnce.firstCall.args[0]).to.include('both use the shader chunk name \'composeVignettePS\'');
        });
    });
});
