import { expect } from 'chai';

import {
    PIXELFORMAT_RGBA8, PIXELFORMAT_R8, PIXELFORMAT_DXT1
} from '../../../src/platform/graphics/constants.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('Texture#copy', function () {

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

    const makeTexture = (opts = {}) => new Texture(device, {
        name: 'test',
        width: 4,
        height: 4,
        format: PIXELFORMAT_RGBA8,
        mipmaps: false,
        ...opts
    });

    it('copies a matching texture successfully', function () {
        const src = makeTexture();
        const dst = makeTexture();
        expect(dst.copy(src)).to.equal(true);
    });

    it('returns false when no source is provided', function () {
        const dst = makeTexture();
        expect(dst.copy(null)).to.equal(false);
    });

    it('returns false when formats differ', function () {
        const src = makeTexture({ format: PIXELFORMAT_R8 });
        const dst = makeTexture({ format: PIXELFORMAT_RGBA8 });
        expect(dst.copy(src)).to.equal(false);
    });

    it('returns false for an out-of-range source mip level', function () {
        const src = makeTexture({ mipmaps: true });
        const dst = makeTexture({ mipmaps: true });
        // a 4x4 texture has 3 mip levels (4, 2, 1)
        expect(dst.copy(src, { sourceMipLevel: 3 })).to.equal(false);
    });

    it('returns false for an out-of-range destination mip level', function () {
        const src = makeTexture({ mipmaps: true });
        const dst = makeTexture({ mipmaps: true });
        expect(dst.copy(src, { destMipLevel: 3 })).to.equal(false);
    });

    it('copies between matching mip levels successfully', function () {
        const src = makeTexture({ mipmaps: true });
        const dst = makeTexture({ mipmaps: true });
        expect(dst.copy(src, { sourceMipLevel: 1, destMipLevel: 1 })).to.equal(true);
    });

    it('returns false when the copy region is out of bounds', function () {
        const src = makeTexture();
        const dst = makeTexture();
        expect(dst.copy(src, { width: 8, height: 8 })).to.equal(false);
        expect(dst.copy(src, { sourceX: 2, width: 4 })).to.equal(false);
        expect(dst.copy(src, { destX: 3, width: 2 })).to.equal(false);
    });

    it('copies a valid sub-region successfully', function () {
        const src = makeTexture();
        const dst = makeTexture();
        expect(dst.copy(src, { sourceX: 1, sourceY: 1, width: 2, height: 2, destX: 0, destY: 0 })).to.equal(true);
    });

    it('returns false for compressed textures', function () {
        const src = makeTexture({ format: PIXELFORMAT_DXT1 });
        const dst = makeTexture({ format: PIXELFORMAT_DXT1 });
        expect(dst.copy(src)).to.equal(false);
    });

    it('returns false for volume textures', function () {
        const src = makeTexture({ volume: true, depth: 4 });
        const dst = makeTexture({ volume: true, depth: 4 });
        expect(dst.copy(src)).to.equal(false);
    });
});
