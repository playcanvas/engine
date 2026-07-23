import { expect } from 'chai';

import { PIXELFORMAT_RGBA8, RENDERTARGET_ORIGIN_BOTTOM, RENDERTARGET_ORIGIN_NATIVE, RENDERTARGET_ORIGIN_TOP } from '../../../src/platform/graphics/constants.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { RenderTarget } from '../../../src/platform/graphics/render-target.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('RenderTarget', function () {

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

    const createRenderTarget = (options = {}) => {
        const colorBuffer = new Texture(device, { width: 4, height: 4, format: PIXELFORMAT_RGBA8 });
        return new RenderTarget({ colorBuffer, ...options });
    };

    const destroyRenderTarget = (renderTarget) => {
        const colorBuffer = renderTarget.colorBuffer;
        renderTarget.destroy();
        colorBuffer.destroy();
    };

    // NullGraphicsDevice is not a WebGPU device, so origin resolves the same way as on WebGL:
    // 'top' flips, 'bottom' does not
    describe('#constructor: origin option', function () {

        it('does not flip when neither origin nor flipY is specified', function () {
            const rt = createRenderTarget();
            expect(rt.flipY).to.be.false;
            destroyRenderTarget(rt);
        });

        it('origin top flips on a non-WebGPU device', function () {
            const rt = createRenderTarget({ origin: RENDERTARGET_ORIGIN_TOP });
            expect(rt.flipY).to.be.true;
            destroyRenderTarget(rt);
        });

        it('origin bottom does not flip on a non-WebGPU device', function () {
            const rt = createRenderTarget({ origin: RENDERTARGET_ORIGIN_BOTTOM });
            expect(rt.flipY).to.be.false;
            destroyRenderTarget(rt);
        });

        it('origin native does not flip', function () {
            const rt = createRenderTarget({ origin: RENDERTARGET_ORIGIN_NATIVE });
            expect(rt.flipY).to.be.false;
            destroyRenderTarget(rt);
        });

        it('origin takes precedence over the deprecated flipY option', function () {
            const rt = createRenderTarget({ origin: RENDERTARGET_ORIGIN_BOTTOM, flipY: true });
            expect(rt.flipY).to.be.false;
            destroyRenderTarget(rt);
        });

        it('explicit origin native takes precedence over the deprecated flipY option', function () {
            const rt = createRenderTarget({ origin: RENDERTARGET_ORIGIN_NATIVE, flipY: true });
            expect(rt.flipY).to.be.false;
            destroyRenderTarget(rt);
        });

        it('respects the deprecated flipY option when origin is not specified', function () {
            const rt = createRenderTarget({ flipY: true });
            expect(rt.flipY).to.be.true;
            destroyRenderTarget(rt);
        });
    });

    // On a WebGPU device the native orientation is top-down, so origin resolution is mirrored
    // relative to WebGL: 'top' does not flip, 'bottom' flips, and the deprecated flipY option /
    // property derives origin bottom (not top). isWebGPU is stubbed on the null device, which is
    // sufficient as the origin resolution only reads that flag.
    describe('#constructor: origin option (WebGPU)', function () {

        beforeEach(function () {
            device.isWebGPU = true;
        });

        it('origin top does not flip on a WebGPU device', function () {
            const rt = createRenderTarget({ origin: RENDERTARGET_ORIGIN_TOP });
            expect(rt.flipY).to.be.false;
            expect(rt.origin).to.equal(RENDERTARGET_ORIGIN_TOP);
            destroyRenderTarget(rt);
        });

        it('origin bottom flips on a WebGPU device', function () {
            const rt = createRenderTarget({ origin: RENDERTARGET_ORIGIN_BOTTOM });
            expect(rt.flipY).to.be.true;
            expect(rt.origin).to.equal(RENDERTARGET_ORIGIN_BOTTOM);
            destroyRenderTarget(rt);
        });

        it('origin native does not flip on a WebGPU device', function () {
            const rt = createRenderTarget({ origin: RENDERTARGET_ORIGIN_NATIVE });
            expect(rt.flipY).to.be.false;
            expect(rt.origin).to.equal(RENDERTARGET_ORIGIN_NATIVE);
            destroyRenderTarget(rt);
        });

        it('derives origin bottom from the deprecated flipY option', function () {
            const rt = createRenderTarget({ flipY: true });
            expect(rt.flipY).to.be.true;
            expect(rt.origin).to.equal(RENDERTARGET_ORIGIN_BOTTOM);
            destroyRenderTarget(rt);
        });

        it('derives origin bottom from the deprecated flipY setter', function () {
            const rt = createRenderTarget();
            rt.flipY = true;
            expect(rt.origin).to.equal(RENDERTARGET_ORIGIN_BOTTOM);
            destroyRenderTarget(rt);
        });
    });

    describe('#flipY', function () {

        it('deprecated setter still updates the value', function () {
            const rt = createRenderTarget({ origin: RENDERTARGET_ORIGIN_BOTTOM });
            expect(rt.flipY).to.be.false;
            rt.flipY = true;
            expect(rt.flipY).to.be.true;
            destroyRenderTarget(rt);
        });
    });

    // origin resolution on a non-WebGPU device: flipY true is equivalent to origin top
    describe('#origin', function () {

        it('defaults to native', function () {
            const rt = createRenderTarget();
            expect(rt.origin).to.equal(RENDERTARGET_ORIGIN_NATIVE);
            destroyRenderTarget(rt);
        });

        it('returns the origin the render target was constructed with', function () {
            const rt = createRenderTarget({ origin: RENDERTARGET_ORIGIN_TOP });
            expect(rt.origin).to.equal(RENDERTARGET_ORIGIN_TOP);
            destroyRenderTarget(rt);
        });

        it('is derived from the deprecated flipY option', function () {
            const rt = createRenderTarget({ flipY: true });
            expect(rt.origin).to.equal(RENDERTARGET_ORIGIN_TOP);
            destroyRenderTarget(rt);
        });

        it('is derived from the deprecated flipY setter', function () {
            const rt = createRenderTarget({ origin: RENDERTARGET_ORIGIN_BOTTOM });
            rt.flipY = true;
            expect(rt.origin).to.equal(RENDERTARGET_ORIGIN_TOP);
            rt.flipY = false;
            expect(rt.origin).to.equal(RENDERTARGET_ORIGIN_NATIVE);
            destroyRenderTarget(rt);
        });
    });
});
