import { expect } from 'chai';

import { Texture } from '../../../src/platform/graphics/texture.js';
import { CameraShaderParams } from '../../../src/scene/camera-shader-params.js';
import {
    SHADER_FORWARD, SHADER_PREPASS, SHADER_SHADOW,
    SHADERDEF_TANGENTS, SHADERDEF_UV0
} from '../../../src/scene/constants.js';
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
        material.heightMap = texture();
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
});
