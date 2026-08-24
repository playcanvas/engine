import { expect } from 'chai';

import {
    PIXELFORMAT_111110F, PIXELFORMAT_RGBA8, PIXELFORMAT_SRGBA8, PIXELFORMAT_DXT1, PIXELFORMAT_DXT1_SRGB,
    PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, isMultisampleCapablePixelFormat
} from '../../../src/platform/graphics/constants.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('Texture', function () {

    /** @type {NullGraphicsDevice} */
    let device;

    beforeEach(function () {
        jsdomSetup();
        const canvas = document.createElement('canvas');
        device = new NullGraphicsDevice(canvas);
    });

    afterEach(function () {
        device.destroy();
        device = null;
        jsdomTeardown();
    });

    describe('#constructor: srgb option', function () {

        it('creates the sRGB variant of the format when srgb is true', function () {
            const texture = new Texture(device, { format: PIXELFORMAT_RGBA8, srgb: true });
            expect(texture.format).to.equal(PIXELFORMAT_SRGBA8);
            expect(texture.srgb).to.be.true;
            texture.destroy();
        });

        it('creates the sRGB variant of a compressed format when srgb is true', function () {
            const texture = new Texture(device, { format: PIXELFORMAT_DXT1, srgb: true });
            expect(texture.format).to.equal(PIXELFORMAT_DXT1_SRGB);
            texture.destroy();
        });

        it('keeps the requested format when srgb is not set', function () {
            const texture = new Texture(device, { format: PIXELFORMAT_RGBA8 });
            expect(texture.format).to.equal(PIXELFORMAT_RGBA8);
            expect(texture.srgb).to.be.false;
            texture.destroy();
        });

        it('ignores srgb for a format with no sRGB variant', function () {
            const texture = new Texture(device, { format: PIXELFORMAT_RGBA16F, srgb: true });
            expect(texture.format).to.equal(PIXELFORMAT_RGBA16F);
            texture.destroy();
        });
    });

    describe('#constructor: samples option', function () {

        it('defaults to 1', function () {
            const texture = new Texture(device, { format: PIXELFORMAT_RGBA16F });
            expect(texture.samples).to.equal(1);
            texture.destroy();
        });

        it('is ignored with a warning on a non-WebGPU device', function () {
            const warn = console.warn;
            const messages = [];
            console.warn = (...args) => {
                messages.push(args.join(' '));
            };
            try {
                const texture = new Texture(device, { name: 'msTex', format: PIXELFORMAT_RGBA16F, samples: 4 });
                expect(texture.samples).to.equal(1);
                expect(messages.some(m => m.includes('samples'))).to.be.true;
                texture.destroy();
            } finally {
                console.warn = warn;
            }
        });

        it('is normalized to the device sample count on WebGPU', function () {
            device.isWebGPU = true;
            device.maxSamples = 4;
            const texture = new Texture(device, { format: PIXELFORMAT_RGBA16F, samples: 2 });
            expect(texture.samples).to.equal(4);
            texture.destroy();
        });

        it('forces mipmaps off on a multisampled texture', function () {
            device.isWebGPU = true;
            device.maxSamples = 4;
            const texture = new Texture(device, { format: PIXELFORMAT_RGBA16F, samples: 4, mipmaps: true, width: 16, height: 16 });
            expect(texture.mipmaps).to.be.false;
            expect(texture.numLevels).to.equal(1);
            texture.destroy();
        });

        it('accounts for the sample count in gpuSize and VRAM tracking', function () {
            device.isWebGPU = true;
            device.maxSamples = 4;
            const before = device._vram.tex;
            const texture = new Texture(device, { format: PIXELFORMAT_RGBA8, width: 8, height: 8, samples: 4 });

            // 8x8 * 4 bytes * 4 samples
            expect(texture.gpuSize).to.equal(1024);

            // tracked at creation (a multisampled texture is never uploaded)
            expect(device._vram.tex - before).to.equal(1024);

            // re-accounted across a resize
            texture.resize(4, 4);
            expect(device._vram.tex - before).to.equal(256);

            // released on destroy
            texture.destroy();
            expect(device._vram.tex).to.equal(before);
        });

        it('reports multisample capability per format, including feature-gated 111110F', function () {
            expect(isMultisampleCapablePixelFormat(PIXELFORMAT_RGBA8)).to.be.true;
            expect(isMultisampleCapablePixelFormat(PIXELFORMAT_111110F)).to.be.true;
            expect(isMultisampleCapablePixelFormat(PIXELFORMAT_RGBA32F)).to.be.false;
        });

        it('asserts on a multisampled texture with an incapable format', function () {
            device.isWebGPU = true;
            device.maxSamples = 4;
            const error = console.error;
            const errors = [];
            console.error = (...args) => {
                errors.push(args.join(' '));
            };
            try {
                const texture = new Texture(device, { format: PIXELFORMAT_111110F, width: 8, height: 8, samples: 4 });
                expect(errors).to.have.lengthOf(0);
                texture.destroy();

                const texture2 = new Texture(device, { format: PIXELFORMAT_RGBA32F, width: 8, height: 8, samples: 4 });
                expect(errors.some(m => m.includes('does not support multisampling'))).to.be.true;
                texture2.destroy();
            } finally {
                console.error = error;
            }
        });
    });

    describe('#copy: multisampled textures', function () {

        let errors;
        let originalError;

        beforeEach(function () {
            originalError = console.error;
            errors = [];
            console.error = (...args) => {
                errors.push(args.join(' '));
            };
            device.isWebGPU = true;
            device.maxSamples = 4;
        });

        afterEach(function () {
            console.error = originalError;
        });

        const createMs = (options = {}) => {
            return new Texture(device, { format: PIXELFORMAT_RGBA16F, width: 8, height: 8, samples: 4, ...options });
        };

        it('allows a full-texture copy between multisampled textures', function () {
            const src = createMs({ name: 'src' });
            const dst = createMs({ name: 'dst' });
            expect(dst.copy(src)).to.be.true;
            expect(errors).to.have.lengthOf(0);
            src.destroy();
            dst.destroy();
        });

        it('rejects a copy between different sample counts', function () {
            const src = createMs({ name: 'src' });
            const dst = new Texture(device, { name: 'dst', format: PIXELFORMAT_RGBA16F, width: 8, height: 8, mipmaps: false });
            expect(dst.copy(src)).to.be.false;
            expect(errors.some(m => m.includes('sample counts'))).to.be.true;
            src.destroy();
            dst.destroy();
        });

        it('rejects a partial copy of multisampled textures', function () {
            const src = createMs({ name: 'src' });
            const dst = createMs({ name: 'dst' });
            expect(dst.copy(src, { width: 4, height: 4 })).to.be.false;
            expect(errors.some(m => m.includes('entire texture'))).to.be.true;
            src.destroy();
            dst.destroy();
        });

        it('rejects an offset copy of multisampled textures', function () {
            const src = createMs({ name: 'src', width: 4, height: 4 });
            const dst = createMs({ name: 'dst' });
            expect(dst.copy(src, { destX: 4, destY: 4 })).to.be.false;
            expect(errors.some(m => m.includes('entire texture'))).to.be.true;
            src.destroy();
            dst.destroy();
        });
    });
});
