import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect } from 'chai';

import { MapUtils } from '../../../src/core/map-utils.js';
import { Preprocessor } from '../../../src/core/preprocessor.js';
import { CasEffect } from '../../../src/extras/render-passes/effects/cas-effect.js';
import { ColorEnhanceEffect } from '../../../src/extras/render-passes/effects/color-enhance-effect.js';
import { ColorLutEffect } from '../../../src/extras/render-passes/effects/color-lut-effect.js';
import { FringingEffect } from '../../../src/extras/render-passes/effects/fringing-effect.js';
import { GradingEffect } from '../../../src/extras/render-passes/effects/grading-effect.js';
import { VignetteEffect } from '../../../src/extras/render-passes/effects/vignette-effect.js';
import { RenderPassCompose } from '../../../src/extras/render-passes/render-pass-compose.js';
import {
    ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR, PIXELFORMAT_R32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA8,
    SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL
} from '../../../src/platform/graphics/constants.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { ShaderDefinitionUtils } from '../../../src/platform/graphics/shader-definition-utils.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { CameraShaderParams } from '../../../src/scene/camera-shader-params.js';
import {
    GAMMA_NONE, GAMMA_SRGB, TONEMAP_ACES, TONEMAP_ACES2, TONEMAP_FILMIC, TONEMAP_HEJL, TONEMAP_NEUTRAL
} from '../../../src/scene/constants.js';
import { setProgramLibrary } from '../../../src/scene/shader-lib/get-program-library.js';
import { shaderChunksGLSL } from '../../../src/scene/shader-lib/glsl/collections/shader-chunks-glsl.js';
import { ProgramLibrary } from '../../../src/scene/shader-lib/program-library.js';
import { ShaderChunks } from '../../../src/scene/shader-lib/shader-chunks.js';
import { shaderChunksWGSL } from '../../../src/scene/shader-lib/wgsl/collections/shader-chunks-wgsl.js';

/**
 * Snapshot of the compose shader source across the combinations of effects it can be built for, in
 * both shader languages. The composition is being restructured around registered effects, and the
 * restructuring must not change the program any combination compiles to. This test pins the
 * preprocessed fragment source of each combination, normalised for whitespace - the restructured
 * chunk leaves blank lines where nothing is included - so any change to what a combination compiles
 * to fails here rather than in a renderer.
 *
 * Update the fixture deliberately, having checked the diff is the intended one, with:
 *
 *     UPDATE_COMPOSE_SNAPSHOT=1 npx mocha test/extras/render-passes/compose-shader-snapshot.test.mjs
 *
 * To inspect a failing combination, set COMPOSE_SNAPSHOT_DUMP to a directory and the preprocessed
 * source of every combination is written there, one file per combination and language.
 */
describe('RenderPassCompose shader snapshot', function () {

    const fixturePath = join(dirname(fileURLToPath(import.meta.url)), 'compose-shader-snapshot.json');
    const update = !!process.env.UPDATE_COMPOSE_SNAPSHOT;
    const dumpDir = process.env.COMPOSE_SNAPSHOT_DUMP;

    /** @type {NullGraphicsDevice} */
    let device;

    /** @type {Object<string, Texture>} */
    let textures;

    const createTexture = (name, width, height, format, srgb = false) => {
        return new Texture(device, {
            name,
            width,
            height,
            format,
            srgb,
            mipmaps: false,
            minFilter: FILTER_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
    };

    before(function () {
        device = new NullGraphicsDevice({ width: 128, height: 128 });
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).add(shaderChunksGLSL);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).add(shaderChunksWGSL);
        setProgramLibrary(device, new ProgramLibrary(device));

        textures = {
            bloom: createTexture('bloom', 64, 64, PIXELFORMAT_RGBA16F),
            coc: createTexture('coc', 128, 128, PIXELFORMAT_RGBA8),
            blur: createTexture('blur', 64, 64, PIXELFORMAT_RGBA16F),
            ssao: createTexture('ssao', 128, 128, PIXELFORMAT_R32F),
            lut: createTexture('lut', 256, 16, PIXELFORMAT_RGBA8, true),
            lut2: createTexture('lut2', 256, 16, PIXELFORMAT_RGBA8, true)
        };
    });

    after(function () {
        Object.values(textures).forEach(texture => texture.destroy());
        device.destroy();
    });

    // a compose pass in the state a CameraFrame would leave it in for the given combination. The
    // pass is constructed fresh per combination so that no state leaks between them.
    const createPass = () => {
        const cameraComponent = { shaderParams: new CameraShaderParams() };
        const pass = new RenderPassCompose(device, cameraComponent);
        pass._gammaCorrection = GAMMA_SRGB;

        // the built-in effects a CameraFrame registers, in the order it registers them. The
        // combinations drive their state; only getShaderVariant is exercised, so the camera frame
        // behind the effects is a stub supplying the scene format the sharpening reads
        pass.cas = new CasEffect(device);
        pass.fringing = new FringingEffect(device);
        pass.colorEnhance = new ColorEnhanceEffect(device);
        pass.grading = new GradingEffect(device);
        pass.colorLut = new ColorLutEffect(device);
        pass.vignette = new VignetteEffect(device);
        const effects = [pass.cas, pass.fringing, pass.colorEnhance, pass.grading, pass.colorLut, pass.vignette];
        const cameraFrame = { hdrFormat: PIXELFORMAT_RGBA16F };
        effects.forEach((effect) => {
            effect.cameraFrame = cameraFrame;
        });
        pass.builtInEffects = effects;
        return pass;
    };

    const enableAll = (pass) => {
        pass.bloomTexture = textures.bloom;
        pass.cocTexture = textures.coc;
        pass.blurTexture = textures.blur;
        pass.blurTextureUpscale = true;
        pass.ssaoTexture = textures.ssao;
        pass.grading.enabled = true;
        pass.colorEnhance.enabled = true;
        pass.colorLut.texture = textures.lut;
        pass.colorLut.texture2 = textures.lut2;
        pass.vignette.intensity = 0.3;
        pass.fringing.intensity = 10;
        pass.taaEnabled = true;
        pass.cas.sharpness = 0.5;
    };

    const withDepth = (pass, available) => {
        const { shaderParams } = pass.cameraComponent;
        shaderParams.sceneDepthMapLinear = available;
        shaderParams.sceneDepthMapPacked = false;
        shaderParams.sceneDepthMapReciprocal = false;
        pass.sceneDepthAvailable = available;
    };

    /**
     * @typedef {object} Combination
     * @property {string} name - The name, which keys the snapshot.
     * @property {boolean} [all] - Whether every effect is enabled before `set` is applied.
     * @property {boolean} [depth] - Whether the scene depth is available, when the combination cares.
     * @property {boolean} [customChunks] - Whether the legacy user injection points are filled.
     * @property {(pass: RenderPassCompose, textures: Object<string, Texture>) => object|void} [set] - Applies
     * state to the pass: either returns properties to assign to it, or acts on it directly.
     */

    /** @type {Combination[]} */
    const combinations = [
        { name: 'off' },
        { name: 'off-gamma-none', set: () => ({ _gammaCorrection: GAMMA_NONE }) },
        { name: 'bloom', set: (pass, t) => ({ bloomTexture: t.bloom }) },
        { name: 'dof', set: (pass, t) => ({ cocTexture: t.coc, blurTexture: t.blur }) },
        { name: 'dof-upscale', set: (pass, t) => ({ cocTexture: t.coc, blurTexture: t.blur, blurTextureUpscale: true }) },
        { name: 'ssao', set: (pass, t) => ({ ssaoTexture: t.ssao }) },
        { name: 'grading', set: pass => (pass.grading.enabled = true) },
        { name: 'color-enhance', set: pass => (pass.colorEnhance.enabled = true) },
        { name: 'color-lut', set: (pass, t) => (pass.colorLut.texture = t.lut) },
        {
            name: 'color-lut2',
            set: (pass, t) => {
                pass.colorLut.texture = t.lut;
                pass.colorLut.texture2 = t.lut2;
            }
        },
        { name: 'vignette', set: pass => (pass.vignette.intensity = 0.3) },
        { name: 'fringing', set: pass => (pass.fringing.intensity = 10) },
        { name: 'taa', set: () => ({ taaEnabled: true }) },
        { name: 'cas-hdr', set: pass => (pass.cas.sharpness = 0.5) },
        {
            name: 'cas-ldr',
            set: (pass) => {
                pass.cas.sharpness = 0.5;
                pass.cas.cameraFrame.hdrFormat = PIXELFORMAT_RGBA8;
            }
        },
        { name: 'all', all: true },
        { name: 'all-gamma-none', all: true, set: () => ({ _gammaCorrection: GAMMA_NONE }) },
        ...[TONEMAP_FILMIC, TONEMAP_HEJL, TONEMAP_ACES, TONEMAP_ACES2, TONEMAP_NEUTRAL].map(toneMapping => ({
            name: `all-tonemap-${toneMapping}`, all: true, set: () => ({ toneMapping })
        })),
        ...['scene', 'bloom', 'dofcoc', 'dofblur', 'ssao', 'vignette'].map(debug => ({
            name: `all-debug-${debug}`, all: true, set: () => ({ debug })
        })),
        { name: 'all-debug-depth', all: true, depth: true, set: () => ({ debug: 'depth' }) },
        { name: 'all-debug-depthmissing', all: true, depth: false, set: () => ({ debug: 'depth' }) },
        { name: 'all-custom-chunks', all: true, customChunks: true }
    ];

    const apply = (pass, combination) => {
        if (combination.all) enableAll(pass);
        if (combination.depth !== undefined) withDepth(pass, combination.depth);
        if (combination.set) {
            const properties = combination.set(pass, textures);
            if (properties && typeof properties === 'object') Object.assign(pass, properties);
        }
        // the effects applied the way CameraFrame#update applies them: the active ones take part,
        // each applying its parameters, the defines among them
        const active = pass.builtInEffects.filter(effect => effect.active);
        active.forEach(effect => effect.update());
        pass.effects = active;
        if (combination.customChunks) {
            // the documented customisation path: user chunks at the three legacy injection points
            pass._customComposeChunks.set('composeDeclarationsPS', 'uniform float custom;');
            pass._customComposeChunks.set('composeMainStartPS', 'float customStart = 1.0;');
            pass._customComposeChunks.set('composeMainEndPS', 'result *= customStart;');
        }
    };

    // the include map a shader build would resolve against: the device chunks, the user chunks the
    // combination set, and whatever the variant supplies
    const includesFor = (pass, shaderLanguage, includes) => {
        const chunks = ShaderChunks.get(device, shaderLanguage);
        const custom = new Map();
        pass._customComposeChunks.forEach((value, name) => {
            if (value) custom.set(name, value);
        });
        return MapUtils.merge(chunks, custom, includes);
    };

    // what Shader does to the fragment source before compiling it, minus the platform preamble that
    // is identical for every combination
    const preprocess = (pass, shaderLanguage) => {
        const { defines, includes } = pass.getShaderVariant(shaderLanguage);
        const chunks = ShaderChunks.get(device, shaderLanguage);
        const source = ShaderDefinitionUtils.getDefinesCode(device, defines) + chunks.get('composePS');
        return Preprocessor.run(source, includesFor(pass, shaderLanguage, includes), {
            stripDefines: shaderLanguage === SHADERLANGUAGE_WGSL,
            sourceName: `compose ${shaderLanguage}`
        });
    };

    const normalise = source => source.replace(/\s+/g, ' ').trim();
    const digest = source => createHash('sha1').update(normalise(source)).digest('hex');

    const fixture = existsSync(fixturePath) ? JSON.parse(readFileSync(fixturePath, 'utf8')) : {};
    const actual = {};

    for (const shaderLanguage of [SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL]) {
        for (const combination of combinations) {
            const { name } = combination;
            const id = `${name}:${shaderLanguage}`;

            it(`compiles the same program for ${id}`, function () {
                const pass = createPass();
                apply(pass, combination);

                const source = preprocess(pass, shaderLanguage);
                expect(source, 'preprocessing failed').to.be.a('string').and.not.equal('');

                if (dumpDir) {
                    mkdirSync(dumpDir, { recursive: true });
                    writeFileSync(join(dumpDir, `${name}.${shaderLanguage}.txt`), source);
                }

                actual[id] = digest(source);
                if (!update) {
                    expect(fixture[id], `no snapshot for ${id} - run with UPDATE_COMPOSE_SNAPSHOT=1`).to.be.a('string');
                    expect(actual[id], `${id} compiles to a different program than the snapshot`).to.equal(fixture[id]);
                }
            });
        }
    }

    after(function () {
        if (update) {
            writeFileSync(fixturePath, `${JSON.stringify(actual, null, 4)}\n`);
        }
    });
});
