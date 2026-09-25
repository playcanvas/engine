import { expect } from 'chai';

import lightSpecularAnisoGGXGLSL from '../../../src/scene/shader-lib/glsl/chunks/lit/frag/lightSpecularAnisoGGX.js';
import lightSpecularAnisoGGXWGSL from '../../../src/scene/shader-lib/wgsl/chunks/lit/frag/lightSpecularAnisoGGX.js';

/**
 * Evaluates the scalar declarations at the start of the anisotropic GGX chunk (the ones before
 * the anisotropy inputs are read) for a given gloss, and returns the declared values by name.
 *
 * @param {string} chunk - The GLSL or WGSL chunk source.
 * @param {number} gloss - The gloss value passed to calcLightSpecular.
 * @returns {Object<string, number>} The evaluated declarations.
 */
const evaluateRoughness = (chunk, gloss) => {
    const body = chunk.slice(chunk.indexOf('calcLightSpecular'), chunk.indexOf('dAnisotropy'));
    const decl = /(?:float|let)\s+(\w+)(?:\s*:\s*f32)?\s*=\s*([^;\s][^;]*);/g;
    const scope = { gloss };
    for (const [, name, expr] of body.matchAll(decl)) {
        if (name === 'PI' || name === 'anisotropy') continue;
        const names = Object.keys(scope);
        // eslint-disable-next-line no-new-func
        const fn = new Function(...names, 'max', `return ${expr};`);
        scope[name] = fn(...names.map(n => scope[n]), Math.max);
    }
    return scope;
};

describe('lightSpecularAnisoGGX', function () {

    const chunks = {
        glsl: lightSpecularAnisoGGXGLSL,
        wgsl: lightSpecularAnisoGGXWGSL
    };

    for (const [language, chunk] of Object.entries(chunks)) {

        // KHR_materials_anisotropy derives at / ab from alphaRoughness = perceptualRoughness^2,
        // with perceptualRoughness = 1 - gloss, the same as the isotropic GGX chunk.
        it(`uses alphaRoughness = (1 - gloss)^2 (${language})`, function () {
            for (const perceptualRoughness of [0.3, 0.5, 0.7, 1.0]) {
                const { alphaRoughness } = evaluateRoughness(chunk, 1 - perceptualRoughness);
                expect(alphaRoughness).to.be.closeTo(perceptualRoughness * perceptualRoughness, 1e-6);
            }
        });
    }
});
