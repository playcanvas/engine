import { expect } from 'chai';

import lightSpecularAnisoGGXGLSL from '../../../src/scene/shader-lib/glsl/chunks/lit/frag/lightSpecularAnisoGGX.js';
import reflDirAnisoGLSL from '../../../src/scene/shader-lib/glsl/chunks/lit/frag/reflDirAniso.js';
import lightSpecularAnisoGGXWGSL from '../../../src/scene/shader-lib/wgsl/chunks/lit/frag/lightSpecularAnisoGGX.js';
import reflDirAnisoWGSL from '../../../src/scene/shader-lib/wgsl/chunks/lit/frag/reflDirAniso.js';

/**
 * Evaluates the scalar declarations at the start of an anisotropy chunk function (the ones
 * before the anisotropy inputs are read) for a given gloss, and returns the declared values by
 * name.
 *
 * @param {string} chunk - The GLSL or WGSL chunk source.
 * @param {string} fnName - The name of the function to evaluate.
 * @param {number} gloss - The gloss value passed to the function.
 * @returns {Object<string, number>} The evaluated declarations.
 */
const evaluateRoughness = (chunk, fnName, gloss) => {
    const start = chunk.indexOf(fnName);
    const body = chunk.slice(start, chunk.indexOf('dAnisotropy', start));
    const decl = /(?:float|let)\s+(\w+)(?:\s*:\s*f32)?\s*=\s*([^;\s][^;]*);/g;
    const scope = { gloss };
    for (const [, name, expr] of body.matchAll(decl)) {
        if (name === 'PI' || name === 'anisotropy') continue;
        const names = Object.keys(scope);
        // eslint-disable-next-line no-new-func
        const fn = new Function(...names, 'max', 'min', 'sqrt', `return ${expr};`);
        scope[name] = fn(...names.map(n => scope[n]), Math.max, Math.min, Math.sqrt);
    }
    return scope;
};

const perceptualRoughnessValues = [0.3, 0.5, 0.7, 1.0];

describe('lightSpecularAnisoGGX', function () {

    const chunks = {
        glsl: lightSpecularAnisoGGXGLSL,
        wgsl: lightSpecularAnisoGGXWGSL
    };

    for (const [language, chunk] of Object.entries(chunks)) {

        // KHR_materials_anisotropy derives at / ab from alphaRoughness = perceptualRoughness^2,
        // with perceptualRoughness = 1 - gloss, the same as the isotropic GGX chunk.
        it(`uses alphaRoughness = (1 - gloss)^2 (${language})`, function () {
            for (const perceptualRoughness of perceptualRoughnessValues) {
                const { alphaRoughness } = evaluateRoughness(chunk, 'calcLightSpecular', 1 - perceptualRoughness);
                expect(alphaRoughness).to.be.closeTo(perceptualRoughness * perceptualRoughness, 1e-6);
            }
        });
    }
});

describe('reflDirAniso', function () {

    const chunks = {
        glsl: reflDirAnisoGLSL,
        wgsl: reflDirAnisoWGSL
    };

    for (const [language, chunk] of Object.entries(chunks)) {

        // The glTF reference bends the reflection normal using perceptualRoughness itself.
        it(`bends the normal with perceptual roughness 1 - gloss (${language})`, function () {
            for (const perceptualRoughness of perceptualRoughnessValues) {
                const { roughness } = evaluateRoughness(chunk, 'getReflDir', 1 - perceptualRoughness);
                expect(roughness).to.be.closeTo(perceptualRoughness, 1e-6);
            }
        });
    }
});
