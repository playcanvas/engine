import { expect } from 'chai';

import { PlaceholderTextures } from '../../../src/framework/handlers/placeholder-textures.js';
import {
    PIXELFORMAT_RGBA8, PIXELFORMAT_SRGBA8,
    TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBE, TEXTURETYPE_RGBM, TEXTURETYPE_RGBP, TEXTURETYPE_SWIZZLEGGGR
} from '../../../src/platform/graphics/constants.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { createGraphicsDevice } from '../../device.mjs';

describe('PlaceholderTextures', function () {

    let device;
    let placeholders;

    beforeEach(function () {
        device = createGraphicsDevice({ width: 1, height: 1 });
        placeholders = new PlaceholderTextures(device);
    });

    afterEach(function () {
        placeholders.destroy();
        device.destroy();
    });

    // the placeholder of a texture referenced by one texture parameter, sampling all its channels
    const one = name => [{ name }];

    // the texel of a placeholder, in the range 0..1
    const texel = texture => Array.from(texture._levels[0]).map(c => c / 255);

    // the color the shader decodes from a texel, as the decode functions of the shader chunks do
    const decode = (texture) => {
        const [r, g, b, a] = texel(texture);
        switch (texture.type) {
            case TEXTURETYPE_RGBM: return [r, g, b].map(c => (8 * a * c) ** 2);
            case TEXTURETYPE_RGBP: return [r, g, b].map(c => (c * (8 - 7 * a)) ** 2);
            case TEXTURETYPE_RGBE: return [r, g, b].map(c => (a === 0 ? 0 : c * 2 ** (a * 255 - 128)));
            default: return [r, g, b].map(c => c ** 2.2);
        }
    };

    it('returns the same texture for the same parameter, color space and type', function () {
        const texture = placeholders.get(one('diffuseMap'), true, TEXTURETYPE_DEFAULT);
        expect(texture).to.be.an.instanceof(Texture);
        expect(placeholders.get(one('diffuseMap'), true, TEXTURETYPE_DEFAULT)).to.equal(texture);
    });

    it('returns a texture of its own for each parameter, color space and type', function () {
        const textures = [
            placeholders.get(one('diffuseMap'), false, TEXTURETYPE_DEFAULT),
            placeholders.get(one('diffuseMap'), true, TEXTURETYPE_DEFAULT),
            placeholders.get(one('diffuseMap'), false, TEXTURETYPE_RGBM),
            placeholders.get(one('glossMap'), false, TEXTURETYPE_DEFAULT),
            placeholders.get(one('opacityMap'), false, TEXTURETYPE_DEFAULT)
        ];
        expect(new Set(textures).size).to.equal(textures.length);
    });

    it('recognizes its textures', function () {
        const texture = placeholders.get(one('normalMap'), false, TEXTURETYPE_DEFAULT);
        expect(placeholders.has(texture)).to.equal(true);
        expect(placeholders.has(new Texture(device, { width: 1, height: 1 }))).to.equal(false);
        expect(placeholders.has(null)).to.equal(false);
        expect(placeholders.has(undefined)).to.equal(false);
    });

    it('decodes like a texture of the same color space and type', function () {
        for (const srgb of [false, true]) {
            for (const type of [TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBM, TEXTURETYPE_RGBE, TEXTURETYPE_RGBP, TEXTURETYPE_SWIZZLEGGGR]) {
                const placeholder = placeholders.get(one('emissiveMap'), srgb, type);
                const texture = new Texture(device, { width: 4, height: 4, format: PIXELFORMAT_RGBA8, srgb, type });
                expect(placeholder.format).to.equal(srgb ? PIXELFORMAT_SRGBA8 : PIXELFORMAT_RGBA8);
                expect(placeholder.format).to.equal(texture.format);
                expect(placeholder.type).to.equal(type);
                expect(placeholder.encoding).to.equal(texture.encoding);
            }
        }
    });

    it('shows the color of the parameter in any of the encoded types', function () {
        // the gamma space texels the placeholders of the default type store
        const colors = { lightMap: 1, emissiveMap: 128 / 255, sheenMap: 0 };
        for (const [parameterName, value] of Object.entries(colors)) {
            const expected = value ** 2.2;
            expect(decode(placeholders.get(one(parameterName), false, TEXTURETYPE_DEFAULT))[0]).to.be.closeTo(expected, 1e-6);
            for (const type of [TEXTURETYPE_RGBM, TEXTURETYPE_RGBE, TEXTURETYPE_RGBP]) {
                const decoded = decode(placeholders.get(one(parameterName), false, type));
                for (const c of decoded) {
                    expect(c).to.be.closeTo(expected, 0.01, `${parameterName} ${type}`);
                }
            }
        }
    });

    describe('an sRGB texture', function () {

        // the value sampling decodes from an sRGB texel, as the graphics hardware does
        const srgbToLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
        const sampled = texture => texel(texture).slice(0, 3).map(srgbToLinear);

        it('samples the value of the default texel in the maps using the value as it is', function () {
            const gloss = placeholders.get(one('glossMap'), true, TEXTURETYPE_DEFAULT);
            expect(gloss.format).to.equal(PIXELFORMAT_SRGBA8);

            // stored gamma encoded, sampled as the linear placeholder stores it
            expect(Array.from(gloss._levels[0])).to.eql([188, 188, 188, 255]);
            for (const c of sampled(gloss)) {
                expect(c).to.be.closeTo(128 / 255, 0.005);
            }

            // a flat normal
            const normal = sampled(placeholders.get(one('normalMap'), true, TEXTURETYPE_DEFAULT)).map(c => c * 2 - 1);
            expect(normal[0]).to.be.closeTo(0, 0.01);
            expect(normal[1]).to.be.closeTo(0, 0.01);
            expect(normal[2]).to.be.closeTo(1, 1e-6);
        });

        it('samples the color of the default texel in the maps decoding a color', function () {
            // the hardware decodes the color the shader decodes from the texel of a linear texture
            const diffuse = placeholders.get(one('diffuseMap'), true, TEXTURETYPE_DEFAULT);
            expect(Array.from(diffuse._levels[0])).to.eql([128, 128, 128, 255]);
            for (const c of sampled(diffuse)) {
                expect(c).to.be.closeTo((128 / 255) ** 2.2, 0.005);
            }
        });
    });

    it('stores a flat normal in the channels a swizzled normal map uses', function () {
        const [, g, , a] = texel(placeholders.get(one('normalMap'), false, TEXTURETYPE_SWIZZLEGGGR));

        // the x and y of the normal are read from the alpha and green channels
        expect(a * 2 - 1).to.be.closeTo(0, 0.01);
        expect(g * 2 - 1).to.be.closeTo(0, 0.01);

        // an unswizzled normal map stores it in the red, green and blue channels
        expect(texel(placeholders.get(one('normalMap'), false, TEXTURETYPE_DEFAULT)).slice(0, 3).map(c => c * 2 - 1))
        .to.satisfy(n => Math.abs(n[0]) < 0.01 && Math.abs(n[1]) < 0.01 && n[2] === 1);
    });

    describe('a texture referenced by several parameters', function () {

        const texelOf = maps => Array.from(placeholders.get(maps, false, TEXTURETYPE_DEFAULT)._levels[0]);

        it('shows the color of each parameter in the channel it samples', function () {
            // a texture packing occlusion, gloss and metalness into its channels
            expect(texelOf([
                { name: 'aoMap', channel: 'r' },
                { name: 'glossMap', channel: 'g' },
                { name: 'metalnessMap', channel: 'b' }
            ])).to.eql([255, 128, 0, 255]);

            // a color map with its opacity in the alpha channel
            expect(texelOf([
                { name: 'diffuseMap', channel: 'rgb' },
                { name: 'opacityMap', channel: 'a' }
            ])).to.eql([128, 128, 128, 255]);
        });

        it('shows the lower value where two parameters sample the same channel', function () {
            // no metalness, rather than no occlusion
            expect(texelOf([{ name: 'aoMap', channel: 'g' }, { name: 'metalnessMap', channel: 'g' }])[1]).to.equal(0);
            expect(texelOf([{ name: 'aoMap', channel: 'g' }, { name: 'glossMap', channel: 'g' }])[1]).to.equal(128);
        });

        it('shows the color of the first parameter in the channels none samples', function () {
            expect(texelOf([{ name: 'aoMap', channel: 'g' }, { name: 'metalnessMap', channel: 'g' }])).to.eql([255, 0, 255, 255]);
        });

        it('returns a texture of its own for the parameters of each texture', function () {
            const maps = [{ name: 'aoMap', channel: 'g' }, { name: 'metalnessMap', channel: 'b' }];
            const texture = placeholders.get(maps, false, TEXTURETYPE_DEFAULT);
            expect(placeholders.get(maps, false, TEXTURETYPE_DEFAULT)).to.equal(texture);

            // another texture of a material, which a different parameter comes first for, gets
            // another placeholder even when the colors are the same
            expect(placeholders.get([{ name: 'metalnessMap', channel: 'b' }, { name: 'aoMap', channel: 'g' }], false, TEXTURETYPE_DEFAULT)).to.not.equal(texture);
        });
    });

    it('is destroyed with the graphics device', function () {
        const texture = placeholders.get(one('aoMap'), false, TEXTURETYPE_DEFAULT);
        device.destroy();
        expect(texture.device).to.equal(null);
        expect(placeholders.has(texture)).to.equal(false);

        // a request after the destroy creates the texture again
        device = createGraphicsDevice({ width: 1, height: 1 });
        placeholders = new PlaceholderTextures(device);
        expect(placeholders.get(one('aoMap'), false, TEXTURETYPE_DEFAULT)).to.not.equal(texture);
    });
});
