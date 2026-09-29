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
        const texture = placeholders.get('diffuseMap', true, TEXTURETYPE_DEFAULT);
        expect(texture).to.be.an.instanceof(Texture);
        expect(placeholders.get('diffuseMap', true, TEXTURETYPE_DEFAULT)).to.equal(texture);
    });

    it('returns a texture of its own for each parameter, color space and type', function () {
        const textures = [
            placeholders.get('diffuseMap', false, TEXTURETYPE_DEFAULT),
            placeholders.get('diffuseMap', true, TEXTURETYPE_DEFAULT),
            placeholders.get('diffuseMap', false, TEXTURETYPE_RGBM),
            placeholders.get('glossMap', false, TEXTURETYPE_DEFAULT),
            placeholders.get('opacityMap', false, TEXTURETYPE_DEFAULT)
        ];
        expect(new Set(textures).size).to.equal(textures.length);
    });

    it('recognizes its textures', function () {
        const texture = placeholders.get('normalMap', false, TEXTURETYPE_DEFAULT);
        expect(placeholders.has(texture)).to.equal(true);
        expect(placeholders.has(new Texture(device, { width: 1, height: 1 }))).to.equal(false);
        expect(placeholders.has(null)).to.equal(false);
        expect(placeholders.has(undefined)).to.equal(false);
    });

    it('decodes like a texture of the same color space and type', function () {
        for (const srgb of [false, true]) {
            for (const type of [TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBM, TEXTURETYPE_RGBE, TEXTURETYPE_RGBP, TEXTURETYPE_SWIZZLEGGGR]) {
                const placeholder = placeholders.get('emissiveMap', srgb, type);
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
            expect(decode(placeholders.get(parameterName, false, TEXTURETYPE_DEFAULT))[0]).to.be.closeTo(expected, 1e-6);
            for (const type of [TEXTURETYPE_RGBM, TEXTURETYPE_RGBE, TEXTURETYPE_RGBP]) {
                const decoded = decode(placeholders.get(parameterName, false, type));
                for (const c of decoded) {
                    expect(c).to.be.closeTo(expected, 0.01, `${parameterName} ${type}`);
                }
            }
        }
    });

    it('stores a flat normal in the channels a swizzled normal map uses', function () {
        const [, g, , a] = texel(placeholders.get('normalMap', false, TEXTURETYPE_SWIZZLEGGGR));

        // the x and y of the normal are read from the alpha and green channels
        expect(a * 2 - 1).to.be.closeTo(0, 0.01);
        expect(g * 2 - 1).to.be.closeTo(0, 0.01);

        // an unswizzled normal map stores it in the red, green and blue channels
        expect(texel(placeholders.get('normalMap', false, TEXTURETYPE_DEFAULT)).slice(0, 3).map(c => c * 2 - 1))
        .to.satisfy(n => Math.abs(n[0]) < 0.01 && Math.abs(n[1]) < 0.01 && n[2] === 1);
    });

    it('is destroyed with the graphics device', function () {
        const texture = placeholders.get('aoMap', false, TEXTURETYPE_DEFAULT);
        device.destroy();
        expect(texture.device).to.equal(null);
        expect(placeholders.has(texture)).to.equal(false);

        // a request after the destroy creates the texture again
        device = createGraphicsDevice({ width: 1, height: 1 });
        placeholders = new PlaceholderTextures(device);
        expect(placeholders.get('aoMap', false, TEXTURETYPE_DEFAULT)).to.not.equal(texture);
    });
});
