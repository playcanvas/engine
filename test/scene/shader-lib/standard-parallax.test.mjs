import { expect } from 'chai';

import { JsonStandardMaterialParser } from '../../../src/framework/parsers/material/json-standard-material.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { CameraShaderParams } from '../../../src/scene/camera-shader-params.js';
import {
    PARALLAX_OCCLUSION, PARALLAX_OFFSET,
    SHADER_FORWARD, SHADER_PREPASS, SHADER_SHADOW,
    SHADERDEF_TANGENTS, SHADERDEF_UV0
} from '../../../src/scene/constants.js';
import { StandardMaterialValidator } from '../../../src/scene/materials/standard-material-validator.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * Extract the body of a function from the generated shader source.
 *
 * @param {string} source - The shader source.
 * @param {string} name - The function name.
 * @returns {string} The function body, or an empty string if the function is not present.
 */
const functionBody = (source, name) => {
    const start = source.indexOf(`void ${name}(`);
    if (start < 0) return '';
    const open = source.indexOf('{', start);
    let depth = 0;
    for (let i = open; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}' && --depth === 0) return source.substring(open, i);
    }
    return '';
};

describe('StandardMaterial parallax mapping', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        // the clustered lighting shader chunks are registered by the renderer, which does not run
        // in these tests - disable clustered lighting so they are not required
        app.scene.clusteredLightingEnabled = false;
    });

    afterEach(function () {
        app.destroy();
        app = null;
        jsdomTeardown();
    });

    /**
     * @param {object} options - Material configuration.
     * @returns {StandardMaterial} The material.
     */
    const createMaterial = (options = {}) => {
        const device = app.graphicsDevice;
        const texture = () => new Texture(device, { name: 'test', width: 4, height: 4 });

        const material = new StandardMaterial();
        material.diffuseMap = texture();
        if (!options.noHeightMap) material.heightMap = texture();
        if (options.parallaxMode) material.parallaxMode = options.parallaxMode;
        if (options.parallaxShadowSamples !== undefined) material.parallaxShadowSamples = options.parallaxShadowSamples;
        if (options.normalMap) material.normalMap = texture();
        if (options.alphaTest) {
            material.opacityMap = texture();
            material.alphaTest = 0.5;
        }
        material.update();
        return material;
    };

    /**
     * @param {StandardMaterial} material - The material.
     * @param {number} pass - The shader pass.
     * @param {number} objDefs - The object shader defines.
     * @returns {string} The generated fragment shader source.
     */
    const fragmentSource = (material, pass, objDefs = SHADERDEF_UV0 | SHADERDEF_TANGENTS) => {
        const shader = material.getShaderVariant({
            device: app.graphicsDevice,
            scene: app.scene,
            objDefs: objDefs,
            pass: pass,
            sortedLights: [[], [], []],
            cameraShaderParams: new CameraShaderParams()
        });

        // a null source means the shader failed to preprocess
        expect(shader.definition.fshader).to.be.a('string');
        return shader.definition.fshader;
    };

    it('marches the height field towards the light only when a tap budget is given', function () {
        // the tap count doubles as the switch, so zero has to take the march out of the shader
        // entirely rather than leaving a loop which runs no iterations
        const off = fragmentSource(createMaterial({ parallaxMode: PARALLAX_OCCLUSION }), SHADER_FORWARD);
        expect(off).to.not.include('getParallaxSelfShadow');
        expect(off).to.not.include('material_parallaxShadowSamples');

        const on = fragmentSource(
            createMaterial({ parallaxMode: PARALLAX_OCCLUSION, parallaxShadowSamples: 8 }),
            SHADER_FORWARD
        );
        expect(on).to.include('getParallaxSelfShadow');
        expect(on).to.include('material_parallaxShadowSamples');
    });

    it('does not march towards the light in offset mode, which has no hit point to march from', function () {
        const source = fragmentSource(
            createMaterial({ parallaxMode: PARALLAX_OFFSET, parallaxShadowSamples: 8 }),
            SHADER_FORWARD
        );
        expect(source).to.not.include('getParallaxSelfShadow');
    });

    it('carries the hit depth and mip level to the self shadow march', function () {
        // the march runs per light, after the front end has finished, so what it needs from the view
        // march has to be handed over in globals rather than recomputed
        const source = fragmentSource(
            createMaterial({ parallaxMode: PARALLAX_OCCLUSION, parallaxShadowSamples: 8 }),
            SHADER_FORWARD
        );
        expect(source).to.include('dParallaxHitDepth');
        expect(source).to.include('dParallaxLod');
        expect(functionBody(source, 'getParallax')).to.include('dParallaxHitDepth = ');
    });

    it('takes every self shadow tap at an explicit mip level', function () {
        // the march is non-uniform control flow, where an implicit derivative is undefined in GLSL
        // and rejected outright by WGSL - which silently removed every parallax surface once
        const source = fragmentSource(
            createMaterial({ parallaxMode: PARALLAX_OCCLUSION, parallaxShadowSamples: 8 }),
            SHADER_FORWARD
        );
        const start = source.indexOf('float getParallaxSelfShadow(');
        expect(start).to.be.above(-1);
        const body = source.substring(start, source.indexOf('\n    }', start));
        expect(body).to.include('texture2DLod(');
        expect(body).to.not.include('texture2DBias(');
        expect(body).to.not.match(/dFdx|dFdy/);
    });

    it('rebuilds the shader only when the self shadow tap count crosses zero', function () {
        // the count doubles as the switch, so zero is the only value which changes the generated
        // shader - the generic number property rule invalidates on 1 as well, which would rebuild
        // for nothing every time the count is dragged past it
        const material = createMaterial({ parallaxMode: PARALLAX_OCCLUSION, parallaxShadowSamples: 8 });
        expect(material._dirtyShader).to.equal(false);

        material.parallaxShadowSamples = 16;
        expect(material._dirtyShader).to.equal(false);

        material.parallaxShadowSamples = 1;
        expect(material._dirtyShader).to.equal(false);

        material.parallaxShadowSamples = 0;
        expect(material._dirtyShader).to.equal(true);

        material.update();
        material.parallaxShadowSamples = 4;
        expect(material._dirtyShader).to.equal(true);
    });

    it('carries the self shadow tap count through a clone', function () {
        // the property is declared by hand, so this is what keeps it inside the reset and copy loops
        const material = createMaterial({ parallaxMode: PARALLAX_OCCLUSION, parallaxShadowSamples: 12 });
        expect(material.clone().parallaxShadowSamples).to.equal(12);
        expect(new StandardMaterial().parallaxShadowSamples).to.equal(0);
    });

    it('accepts the self shadow tap count from a material asset', function () {
        // a public property has to be in the parameter registry as well: without it the validator
        // marks the whole material invalid and warns, and the parser only assigns the value through
        // its untyped fallback, so it never gets number validation
        const validator = new StandardMaterialValidator();
        const data = { parallaxMode: 'occlusion', parallaxShadowSamples: 8 };
        validator.validate(data);
        expect(validator.valid).to.equal(true);
        expect(data.parallaxShadowSamples).to.equal(8);

        const material = new StandardMaterial();
        new JsonStandardMaterialParser().initialize(material, data);
        expect(material.parallaxShadowSamples).to.equal(8);
    });

    it('evaluates the parallax offset before it is used by any other map', function () {
        const source = fragmentSource(createMaterial({ normalMap: true, alphaTest: true }), SHADER_FORWARD);

        expect(source).to.include('dUvOffset = ');
        expect(source).to.include('+ dUvOffset');

        // getParallax must be called before getOpacity, which samples the opacity map using the offset
        const parallaxCall = source.indexOf('getParallax();');
        const opacityCall = source.indexOf('getOpacity();');
        expect(parallaxCall).to.be.above(-1);
        expect(opacityCall).to.be.above(-1);
        expect(parallaxCall).to.be.below(opacityCall);
    });

    it('does not reference the parallax offset in passes which do not evaluate it', function () {
        const material = createMaterial({ normalMap: true, alphaTest: true });

        // dUvOffset is only declared and evaluated by the forward pass, so referencing it from any
        // other pass fails to compile. Note that the passes the renderer uses for shadows and the
        // pre-pass are built from the minimal set of options, which never enables the height map, so
        // this is the invariant which keeps that true rather than a reachable bug today
        for (const pass of [SHADER_SHADOW, SHADER_PREPASS]) {
            const source = fragmentSource(material, pass);
            expect(source).to.not.include('dUvOffset');
        }
    });

    it('generates a TBN matrix for a height map used without a normal map', function () {
        // parallax mapping needs the TBN matrix to bring the view direction into tangent space
        for (const objDefs of [SHADERDEF_UV0, SHADERDEF_UV0 | SHADERDEF_TANGENTS]) {
            const source = fragmentSource(createMaterial(), SHADER_FORWARD, objDefs);
            expect(source).to.include('getTBN(');
            expect(functionBody(source, 'getParallax')).to.include('dTBN');
        }
    });

    it('offsets the uv along increasing v, not along the tangent frame y axis', function () {
        // the y axis of the TBN points along decreasing v, which is the convention normal maps are
        // authored in, so the offset's v component must be negated - without it the parallax is
        // inverted whenever the surface is viewed from above or below
        const body = functionBody(fragmentSource(createMaterial(), SHADER_FORWARD), 'getParallax');
        expect(body).to.include('-viewDirT.y');
    });

    it('does not apply the parallax offset to the uv used to build the TBN matrix', function () {
        // the TBN matrix is evaluated before the parallax offset is known, so using the offset
        // there would be a circular dependency
        for (const options of [{}, { normalMap: true }]) {
            const source = fragmentSource(createMaterial(options), SHADER_FORWARD, SHADERDEF_UV0);
            expect(functionBody(source, 'getTBN')).to.not.include('dUvOffset');
        }
    });

    it('marches the view ray through the height field in occlusion mode', function () {
        const offset = functionBody(fragmentSource(createMaterial({ parallaxMode: PARALLAX_OFFSET }), SHADER_FORWARD), 'getParallax');
        const occlusion = functionBody(fragmentSource(createMaterial({ parallaxMode: PARALLAX_OCCLUSION }), SHADER_FORWARD), 'getParallax');

        // the offset mode is a single tap, the occlusion mode marches
        expect(offset).to.not.include('for (');
        expect(occlusion).to.include('for (');
        expect(occlusion).to.include('dUvOffset = ');
    });

    it('refines the hit by resampling inside the bracketing step', function () {
        // interpolating between the ends of the step instead assumes the height field runs straight
        // between them, which at a shallow view angle snaps the hit to the step grid and terraces
        const occlusion = functionBody(fragmentSource(createMaterial({ parallaxMode: PARALLAX_OCCLUSION }), SHADER_FORWARD), 'getParallax');

        // the linear search and the refinement are two separate loops, both sampling the map
        expect((occlusion.match(/for \(/g) ?? []).length).to.equal(2);
        expect((occlusion.match(/texture2DLod\(/g) ?? []).length).to.be.at.least(3);
    });

    it('samples the height map with an explicit mip level while marching', function () {
        // the march is non-uniform control flow, where implicit derivatives are undefined - a
        // texture2DBias tap inside it would trip WGSL's derivative_uniformity diagnostic
        const occlusion = functionBody(fragmentSource(createMaterial({ parallaxMode: PARALLAX_OCCLUSION }), SHADER_FORWARD), 'getParallax');

        expect(occlusion).to.include('texture2DLod(');
        expect(occlusion).to.not.include('texture2DBias(');
    });

    it('generates a separate shader for each parallax mode', function () {
        // parallaxMode is assigned onto the shared options object rather than declared on it, so
        // this guards against it being left out of the shader cache key
        const offset = fragmentSource(createMaterial({ parallaxMode: PARALLAX_OFFSET }), SHADER_FORWARD);
        const occlusion = fragmentSource(createMaterial({ parallaxMode: PARALLAX_OCCLUSION }), SHADER_FORWARD);

        expect(offset).to.not.equal(occlusion);
    });

    it('declares the sample count uniform only when marching', function () {
        const offset = fragmentSource(createMaterial({ parallaxMode: PARALLAX_OFFSET }), SHADER_FORWARD);
        const occlusion = fragmentSource(createMaterial({ parallaxMode: PARALLAX_OCCLUSION }), SHADER_FORWARD);

        expect(offset).to.not.include('material_parallaxSamples');
        expect(occlusion).to.include('material_parallaxSamples');
    });

    it('ignores the parallax mode when no height map is assigned', function () {
        const source = fragmentSource(createMaterial({ noHeightMap: true, parallaxMode: PARALLAX_OCCLUSION }), SHADER_FORWARD);

        expect(source).to.not.include('dUvOffset');
        expect(source).to.not.include('material_parallaxSamples');
    });
});
