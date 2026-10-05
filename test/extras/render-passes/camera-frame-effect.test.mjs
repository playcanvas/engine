import { expect } from 'chai';
import { restore, spy, stub } from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { CameraFrameEffect } from '../../../src/extras/render-passes/camera-frame-effect.js';
import { CameraFrame } from '../../../src/extras/render-passes/camera-frame.js';
import { COMPOSESLOT_HDR, COMPOSESLOT_LDR, COMPOSESLOT_SCENE } from '../../../src/extras/render-passes/constants.js';
import { GradingEffect } from '../../../src/extras/render-passes/effects/grading-effect.js';
import { VignetteEffect } from '../../../src/extras/render-passes/effects/vignette-effect.js';
import { RenderPassCompose } from '../../../src/extras/render-passes/render-pass-compose.js';
import { SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../../src/platform/graphics/constants.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
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
                requires: ['depth'],
                stage: 'postscene'
            });
            expect(effect.id).to.equal('grain');
            expect(effect.slot).to.equal(COMPOSESLOT_LDR);
            expect(effect.glsl).to.equal('g');
            expect(effect.wgsl).to.equal('w');
            expect(effect.getChunk(SHADERLANGUAGE_WGSL)).to.equal('w');
            expect(effect.debugViews).to.deep.equal(['grain']);
            expect(effect.requires).to.deep.equal(['depth']);
            expect(effect.stage).to.equal('postscene');
        });

        it('has no slot, chunk, passes or debug views unless given them', function () {
            const effect = new CameraFrameEffect(device, 'fog');
            expect(effect.slot).to.equal(null);
            expect(effect.glsl).to.equal(null);
            expect(effect.wgsl).to.equal(null);
            expect(effect.debugViews).to.deep.equal([]);
            expect(effect.requires).to.deep.equal([]);
            expect(effect.stage).to.equal(null);
        });

        it('keeps its declarations read-only', function () {
            const effect = new CameraFrameEffect(device, 'grain', { slot: COMPOSESLOT_LDR, glsl: 'g' });
            for (const name of ['id', 'slot', 'glsl', 'wgsl', 'debugViews', 'chunkName', 'entryPoint', 'requires', 'stage']) {
                expect(() => {
                    effect[name] = 'x';
                }, name).to.throw(TypeError);
            }
        });

        it('lets a subclass compute a declaration from a parameter', function () {
            class Ssao extends CameraFrameEffect {
                lighting = false;

                constructor() {
                    super(device, 'ssao', { requires: ['depth'] });
                }

                get stage() {
                    return this.lighting ? 'prescene' : 'postscene';
                }
            }
            const effect = new Ssao();
            expect(effect.stage).to.equal('postscene');
            effect.lighting = true;
            expect(effect.stage).to.equal('prescene');
            expect(effect.requires).to.deep.equal(['depth']);
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

        it('is used by the built-in effects', function () {
            expect(new VignetteEffect(device).id).to.equal('vignette');
            expect(new VignetteEffect(device).slot).to.equal(COMPOSESLOT_LDR);
            expect(new GradingEffect(device).id).to.equal('grading');
            expect(new GradingEffect(device).slot).to.equal(COMPOSESLOT_HDR);
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

        it('is off by default for grading', function () {
            const effect = new GradingEffect(device);
            expect(effect.active).to.equal(false);
            effect.enabled = true;
            expect(effect.active).to.equal(true);
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
            cameraFrame.addEffect(createEffect('shadow', null, { debugViews: ['bloom'] }));
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

        it('registers the chunks of its effects without overwriting a user override', function () {
            const chunks = ShaderChunks.get(device, SHADERLANGUAGE_GLSL);
            chunks.set('composeVignettePS', 'vec3 applyVignette(vec3 c, vec2 uv) { return c * 0.5; }');

            const pass = createPass();
            pass.effects = [new VignetteEffect(device)];

            expect(chunks.get('composeVignettePS')).to.include('return c * 0.5');
            expect(chunks.get('composeGradingPS')).to.equal(undefined);
        });

        it('contributes nothing but zero counts for inactive effects', function () {
            const pass = createPass();
            pass.effects = [new VignetteEffect(device), new GradingEffect(device)];

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
            pass.effects = [grading, vignette];
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
            pass.effects = [vignette];
            pass.debug = 'bloom';

            const defines = new Map();
            pass._buildEffectChunks(SHADERLANGUAGE_GLSL, defines);

            expect(defines.has('COMPOSE_EFFECT_DEBUG')).to.equal(false);
            expect(defines.has('{COMPOSE_DEBUG_FN}')).to.equal(false);
        });

        it('operates on the scene sample for the scene slot', function () {
            const pass = createPass();
            pass.effects = [createEffect('alpha', COMPOSESLOT_SCENE, {
                glsl: 'vec4 applyAlpha(vec4 s, vec2 uv) { return s; }'
            })];

            const defines = new Map();
            pass._buildEffectChunks(SHADERLANGUAGE_GLSL, defines);
            expect(defines.get('COMPOSE_SCENE_COUNT')).to.equal('1');
            expect(defines.get('{COMPOSE_SCENE_FN0}')).to.equal('applyAlpha');
        });

        it('calls the effects of a slot in registration order', function () {
            const pass = createPass();
            pass.effects = [
                createEffect('b', COMPOSESLOT_HDR, { glsl: 'vec3 applyB(vec3 c, vec2 uv) { return c; }' }),
                createEffect('a', COMPOSESLOT_HDR, { glsl: 'vec3 applyA(vec3 c, vec2 uv) { return c; }' })
            ];

            const defines = new Map();
            pass._buildEffectChunks(SHADERLANGUAGE_GLSL, defines);
            expect(defines.get('COMPOSE_HDR_COUNT')).to.equal('2');
            expect(defines.get('{COMPOSE_HDR_FN0}')).to.equal('applyB');
            expect(defines.get('{COMPOSE_HDR_FN1}')).to.equal('applyA');
        });

        it('changes the shader key when an effect becomes active, changes a define, or its chunk is overridden', function () {
            const pass = createPass();
            const vignette = new VignetteEffect(device);
            pass.effects = [vignette];

            const key0 = pass.getShaderVariant(SHADERLANGUAGE_GLSL).key;
            vignette.intensity = 0.5;
            const key1 = pass.getShaderVariant(SHADERLANGUAGE_GLSL).key;
            vignette.setDefine('VIGNETTE_SQUARE', true);
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

        it('writes the uniforms of active effects when it draws, not while the frame is prepared', function () {
            stub(RenderPassShaderQuad.prototype, 'execute');
            const pass = createPass();
            pass.sceneTexture = { width: 4, height: 4 };
            const vignette = new VignetteEffect(device);
            const grading = new GradingEffect(device);
            pass.effects = [vignette, grading];
            vignette.intensity = 0.5;
            const vignetteUpdate = spy(vignette, 'update');
            const gradingUpdate = spy(grading, 'update');

            pass.frameUpdate();
            expect(vignetteUpdate.callCount).to.equal(0);

            pass.execute();
            expect(vignetteUpdate.callCount).to.equal(1);
            expect(vignetteUpdate.calledBefore(RenderPassShaderQuad.prototype.execute)).to.equal(true);

            // grading is disabled, so inactive, and leaves the uniforms alone
            expect(gradingUpdate.callCount).to.equal(0);
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
                pass.effects = [vignette];
                return pass;
            });

            passes.forEach(pass => pass.frameUpdate());
            passes.forEach(pass => pass.execute());

            expect(drawn).to.deep.equal([0.25, 0.75]);
        });

        it('warns when two effects supply the same chunk name', function () {
            const pass = createPass();
            pass.effects = [new VignetteEffect(device), createEffect('clash', COMPOSESLOT_LDR, {
                chunkName: 'composeVignettePS',
                glsl: 'vec3 applyClash(vec3 c, vec2 uv) { return c; }'
            })];

            expect(Debug.warnOnce.callCount).to.equal(1);
            expect(Debug.warnOnce.firstCall.args[0]).to.include('both supply the shader chunk \'composeVignettePS\'');
        });
    });
});
