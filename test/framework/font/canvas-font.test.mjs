import { expect } from 'chai';

import { Color } from '../../../src/core/math/color.js';
import { CanvasFont } from '../../../src/framework/font/canvas-font.js';
import { TEXTURELOCK_READ } from '../../../src/platform/graphics/constants.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('CanvasFont', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    // the pixels of the first atlas texture of a font
    const readAtlas = (font) => {
        const texture = font.textures[0];
        const pixels = texture.lock({ mode: TEXTURELOCK_READ });
        texture.unlock();
        return pixels;
    };

    // the canvas rounds the color of a partly covered pixel when it removes its premultiplication,
    // so colors are compared to within a level
    const expectColor = (pixels, i, color) => {
        for (let c = 0; c < 3; c++) {
            expect(pixels[i + c]).to.be.closeTo(color[c], 1);
        }
    };

    // whether any of the 8 pixels around a pixel has alpha
    const nextToGlyph = (pixels, size, x, y) => {
        for (let ny = Math.max(y - 1, 0); ny <= Math.min(y + 1, size - 1); ny++) {
            for (let nx = Math.max(x - 1, 0); nx <= Math.min(x + 1, size - 1); nx++) {
                if (pixels[(ny * size + nx) * 4 + 3] > 0) {
                    return true;
                }
            }
        }
        return false;
    };

    describe('#createTextures', function () {

        it('draws the atlas transparent outside the glyphs, in the font color', function () {
            const size = 64;
            const font = new CanvasFont(app, {
                color: new Color(1, 0, 0),
                fontSize: 32,
                width: size,
                height: size
            });
            font.createTextures('A');

            const pixels = readAtlas(font);
            expect(pixels.length).to.equal(size * size * 4);

            let covered = 0;
            for (let i = 0; i < pixels.length; i += 4) {
                expectColor(pixels, i, [255, 0, 0]);
                if (pixels[i + 3] > 0) {
                    covered++;
                }
            }

            // the glyph is drawn, and the corner away from it is fully transparent
            expect(covered).to.be.greaterThan(0);
            expect(covered).to.be.lessThan(size * size / 2);
            expect(pixels[pixels.length - 1]).to.equal(0);

            font.destroy();
        });

        it('gives transparent pixels next to a glyph the color of the glyph', function () {
            const size = 64;
            const font = new CanvasFont(app, {
                color: new Color(1, 1, 1),
                fontSize: 32,
                width: size,
                height: size
            });

            // draw the glyphs in a color other than the font color
            font.renderCharacter = (context, char, x, y) => {
                context.fillStyle = 'rgb(0, 255, 0)';
                context.fillText(char, x, y);
            };
            font.createTextures('A');

            const pixels = readAtlas(font);
            let bled = 0;
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const i = (y * size + x) * 4;
                    if (pixels[i + 3] === 0 && nextToGlyph(pixels, size, x, y)) {
                        expectColor(pixels, i, [0, 255, 0]);
                        bled++;
                    }
                }
            }
            expect(bled).to.be.greaterThan(0);

            // away from the glyph, transparent pixels take the font color
            const corner = pixels.slice(pixels.length - 4);
            expect(Array.from(corner)).to.deep.equal([255, 255, 255, 0]);

            font.destroy();
        });

    });

});
