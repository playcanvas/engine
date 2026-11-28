import { expect } from 'chai';

import { WebglGraphicsDevice } from '../../../src/platform/graphics/webgl/webgl-graphics-device.js';

/**
 * A stand-in WebGL2 context: constants resolve to numbers, every parameter reads as 16, and every
 * other call does nothing.
 *
 * @returns {object} The context.
 */
const createGl = () => {
    let nextToken = 1;
    return new Proxy({}, {
        get(target, key) {
            if (key in target) return target[key];
            if (typeof key !== 'string' || key === 'then') return undefined;
            if (/^[A-Z0-9_]+$/.test(key)) {
                target[key] = nextToken++;
                return target[key];
            }
            switch (key) {
                case 'getSupportedExtensions': return () => [];
                case 'getParameter': return () => 16;
                case 'getShaderPrecisionFormat': return () => ({ precision: 23, rangeMin: 127, rangeMax: 127 });
                case 'getContextAttributes': return () => ({ antialias: false, alpha: true, depth: true, stencil: true });
                case 'isContextLost': return () => false;
            }
            target[key] = () => ({});
            return target[key];
        }
    });
};

// Each sampler name keeps its texture unit across shaders, so a texture which many shaders read
// under the same name stays bound when the shader changes.
describe('WebglGraphicsDevice#assignTextureUnits', function () {

    let device;

    beforeEach(function () {
        const gl = createGl();
        const canvas = {
            width: 4,
            height: 4,
            getContext: () => gl,
            addEventListener: () => {},
            removeEventListener: () => {},
            getBoundingClientRect: () => ({ width: 4, height: 4 })
        };
        device = new WebglGraphicsDevice(canvas, {});
    });

    afterEach(function () {
        device.destroy();
    });

    // the samplers of a shader, as WebglShader creates them, with their units assigned
    const link = (...names) => {
        const samplers = names.map(name => ({ scopeId: { name: name.replace(/\[\d+\]$/, '[0]') }, unit: 0 }));
        const sizes = names.map(name => +(/\[(\d+)\]$/.exec(name)?.[1] ?? 1));
        device.assignTextureUnits(samplers, sizes);
        return Object.fromEntries(samplers.map((s, i) => [names[i], s.unit]));
    };

    it('gives a sampler name the same unit in every shader', function () {
        const a = link('texture_diffuseMap', 'texture_normalMap', 'shadowAtlasTexture', 'lightsTexture');
        const b = link('texture_diffuseMap', 'shadowAtlasTexture', 'lightsTexture');
        const c = link('lightsTexture', 'texture_opacityMap', 'shadowAtlasTexture');

        expect(b.shadowAtlasTexture).to.equal(a.shadowAtlasTexture);
        expect(b.lightsTexture).to.equal(a.lightsTexture);
        expect(c.lightsTexture).to.equal(a.lightsTexture);
        expect(c.shadowAtlasTexture).to.equal(a.shadowAtlasTexture);
        expect(b.texture_diffuseMap).to.equal(a.texture_diffuseMap);
    });

    it('gives the samplers of a shader different units', function () {
        link('a', 'b', 'c');
        const units = Object.values(link('d', 'c', 'e', 'a'));
        expect(new Set(units).size).to.equal(units.length);
    });

    it('gives an array of samplers free consecutive units of the shader', function () {
        link('a', 'b', 'c', 'd');
        const units = link('a', 'arr[3]', 'd');
        const arrayUnits = [units['arr[3]'], units['arr[3]'] + 1, units['arr[3]'] + 2];
        expect(arrayUnits).to.not.include(units.a);
        expect(arrayUnits).to.not.include(units.d);
        expect(units['arr[3]'] + 2).to.be.below(device.maxCombinedTextures);
    });

    it('keeps the last unit off the names, and gives names over the limit free units of the shader', function () {
        const count = device.maxCombinedTextures;

        // every unit but the last goes to a name
        const names = Array.from({ length: count - 1 }, (_, i) => `t${i}`);
        const units = Object.values(link(...names));
        expect(new Set(units).size).to.equal(count - 1);
        expect(Math.max(...units)).to.equal(count - 2);

        // a further name uses a unit no other sampler of its shader uses
        const more = link('t0', 't1', 'extra1', 'extra2');
        const all = Object.values(more);
        expect(new Set(all).size).to.equal(4);
        expect(more.t0).to.equal(0);
        expect(more.t1).to.equal(1);
        expect(more.extra1).to.be.below(count);
        expect(more.extra2).to.be.below(count);
    });
});
