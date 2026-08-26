import { expect } from 'chai';

import { DEPTHRESOLVE_MAX, DEPTHRESOLVE_MIN, DEPTHRESOLVE_SAMPLE0, PIXELFORMAT_DEPTH, PIXELFORMAT_R32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA16U, PIXELFORMAT_RGBA8, RENDERTARGET_ORIGIN_BOTTOM, RENDERTARGET_ORIGIN_NATIVE, RENDERTARGET_ORIGIN_TOP } from '../../../src/platform/graphics/constants.js';
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

    describe('#constructor: multisampled color attachments', function () {

        let errors, warnings;
        let originalError, originalWarn;

        beforeEach(function () {
            device.isWebGPU = true;
            device.maxSamples = 4;
            originalError = console.error;
            originalWarn = console.warn;
            errors = [];
            warnings = [];
            console.error = (...args) => {
                errors.push(args.join(' '));
            };
            console.warn = (...args) => {
                warnings.push(args.join(' '));
            };
        });

        afterEach(function () {
            console.error = originalError;
            console.warn = originalWarn;
        });

        const createMs = (options = {}) => {
            return new Texture(device, { width: 4, height: 4, format: PIXELFORMAT_RGBA8, samples: 4, ...options });
        };

        const create1x = (options = {}) => {
            return new Texture(device, { width: 4, height: 4, format: PIXELFORMAT_RGBA8, mipmaps: false, ...options });
        };

        it('infers the sample count from the color buffer', function () {
            const rt = new RenderTarget({ name: 'ms-infer', colorBuffer: createMs(), depth: false });
            expect(rt.samples).to.equal(4);
            expect(errors).to.have.lengthOf(0);
            rt.destroyTextureBuffers();
            rt.destroy();
        });

        it('warns when the samples option disagrees with the color buffer', function () {
            const rt = new RenderTarget({ name: 'ms-mismatch', colorBuffer: createMs(), samples: 2, depth: false });
            expect(rt.samples).to.equal(4);
            expect(warnings.some(m => m.includes('samples option'))).to.be.true;
            rt.destroyTextureBuffers();
            rt.destroy();
        });

        it('stores the resolve buffer and exposes it through getters', function () {
            const resolve = create1x({ name: 'resolveTex' });
            const rt = new RenderTarget({ name: 'ms-resolve', colorBuffer: createMs(), resolveBuffer: resolve, depth: false });
            expect(rt.resolveBuffer).to.equal(resolve);
            expect(rt.getResolveBuffer(0)).to.equal(resolve);
            expect(rt.getResolveBuffer(1)).to.equal(null);
            expect(errors).to.have.lengthOf(0);
            rt.destroyTextureBuffers();
            rt.destroy();
        });

        it('errors when a resolveBuffer is used with a single-sampled colorBuffer', function () {
            const colorBuffer = create1x();
            const resolve = create1x();
            const rt = new RenderTarget({ name: 'ms-implicit-clash', colorBuffer, samples: 4, resolveBuffer: resolve, depth: false });
            expect(errors.some(m => m.includes('only supported when the color buffers are multisampled'))).to.be.true;
            expect(rt.resolveBuffer).to.equal(null);
            rt.destroyTextureBuffers();
            resolve.destroy();
            rt.destroy();
        });

        it('asserts on a multisampled resolveBuffer', function () {
            const rt = new RenderTarget({ name: 'ms-ms-resolve', colorBuffer: createMs(), resolveBuffer: createMs(), depth: false });
            expect(errors.some(m => m.includes('must be single-sampled'))).to.be.true;
            rt.destroyTextureBuffers();
            rt.destroy();
        });

        it('asserts on a resolveBuffer format mismatch', function () {
            const resolve = new Texture(device, { width: 4, height: 4, format: PIXELFORMAT_RGBA16F, mipmaps: false });
            const rt = new RenderTarget({ name: 'ms-format-mismatch', colorBuffer: createMs(), resolveBuffer: resolve, depth: false });
            expect(errors.some(m => m.includes('format does not match'))).to.be.true;
            rt.destroyTextureBuffers();
            rt.destroy();
        });

        it('asserts on a resolveBuffer size mismatch', function () {
            const resolve = create1x({ width: 8, height: 8 });
            const rt = new RenderTarget({ name: 'ms-size-mismatch', colorBuffer: createMs(), resolveBuffer: resolve, depth: false });
            expect(errors.some(m => m.includes('dimensions'))).to.be.true;
            rt.destroyTextureBuffers();
            rt.destroy();
        });

        it('asserts on a resolveBuffer for a format that cannot be hardware-resolved', function () {
            const ms = createMs({ format: PIXELFORMAT_RGBA16U });
            const resolve = create1x({ format: PIXELFORMAT_RGBA16U });
            const rt = new RenderTarget({ name: 'ms-int-resolve', colorBuffer: ms, resolveBuffer: resolve, depth: false });
            expect(errors.some(m => m.includes('cannot be hardware-resolved'))).to.be.true;
            rt.destroyTextureBuffers();
            rt.destroy();
        });

        it('asserts on mixed sample counts across MRT attachments', function () {
            const rt = new RenderTarget({ name: 'ms-mixed', colorBuffers: [createMs(), create1x()], depth: false });
            expect(errors.some(m => m.includes('same sample count'))).to.be.true;
            rt.destroyTextureBuffers();
            rt.destroy();
        });

        it('asserts on mixed sample counts when the first attachment is single-sampled', function () {
            const rt = new RenderTarget({ name: 'ms-mixed-reversed', colorBuffers: [create1x(), createMs()], depth: false });
            expect(errors.some(m => m.includes('same sample count'))).to.be.true;

            // the multisampled attachment still selects the explicit mode and its sample count
            expect(rt.samples).to.equal(4);
            rt.destroyTextureBuffers();
            rt.destroy();
        });

        it('asserts on a depth format color buffer', function () {
            const ms = createMs({ format: PIXELFORMAT_DEPTH });
            const rt = new RenderTarget({ name: 'ms-depth-color', colorBuffer: ms, depth: false });
            expect(errors.some(m => m.includes('depth format texture cannot be used as a color buffer'))).to.be.true;
            rt.destroyTextureBuffers();
            rt.destroy();
        });

        it('ignores transientColor with a warning', function () {
            device.supportsTransientAttachments = true;
            const rt = new RenderTarget({ name: 'ms-transient', colorBuffer: createMs(), transientColor: true, depth: false });
            expect(rt.transientColor).to.be.false;
            expect(warnings.some(m => m.includes('transient'))).to.be.true;
            rt.destroyTextureBuffers();
            rt.destroy();
        });

        it('ignores a mipLevel with an error', function () {
            const rt = new RenderTarget({ name: 'ms-miplevel', colorBuffer: createMs(), mipLevel: 1, depth: false });
            expect(rt.mipLevel).to.equal(0);
            expect(errors.some(m => m.includes('mipLevel'))).to.be.true;
            rt.destroyTextureBuffers();
            rt.destroy();
        });

        it('resizes the resolve buffers along with the color buffers', function () {
            const resolve = create1x();
            const rt = new RenderTarget({ name: 'ms-resize', colorBuffer: createMs(), resolveBuffer: resolve, depth: false });
            rt.resize(8, 8);
            expect(rt.colorBuffer.width).to.equal(8);
            expect(resolve.width).to.equal(8);
            expect(resolve.height).to.equal(8);
            rt.destroyTextureBuffers();
            rt.destroy();
        });
    });

    describe('#constructor: multisampled depth attachments', function () {

        let errors;
        let originalError;

        beforeEach(function () {
            device.isWebGPU = true;
            device.maxSamples = 4;
            originalError = console.error;
            errors = [];
            console.error = (...args) => {
                errors.push(args.join(' '));
            };
        });

        afterEach(function () {
            console.error = originalError;
        });

        const createMsDepth = (options = {}) => {
            return new Texture(device, { width: 4, height: 4, format: PIXELFORMAT_DEPTH, samples: 4, ...options });
        };

        const createMsColor = (options = {}) => {
            return new Texture(device, { width: 4, height: 4, format: PIXELFORMAT_RGBA8, samples: 4, ...options });
        };

        const createR32F = (options = {}) => {
            return new Texture(device, { width: 4, height: 4, format: PIXELFORMAT_R32F, mipmaps: false, ...options });
        };

        it('infers the sample count from a depth-only multisampled render target', function () {
            const rt = new RenderTarget({ name: 'msd-only', depthBuffer: createMsDepth() });
            expect(rt.samples).to.equal(4);
            expect(rt.depth).to.be.true;
            expect(errors).to.have.lengthOf(0);
            rt.destroyTextureBuffers();
            rt.destroy();
        });

        it('accepts matching multisampled color and depth buffers', function () {
            const rt = new RenderTarget({ name: 'msd-both', colorBuffer: createMsColor(), depthBuffer: createMsDepth() });
            expect(rt.samples).to.equal(4);
            expect(errors).to.have.lengthOf(0);
            rt.destroyTextureBuffers();
            rt.destroy();
        });

        it('asserts when the depth buffer sample count does not match the color buffers', function () {
            const oneSampleDepth = new Texture(device, { width: 4, height: 4, format: PIXELFORMAT_DEPTH, mipmaps: false });
            const rt = new RenderTarget({ name: 'msd-mixed', colorBuffer: createMsColor(), depthBuffer: oneSampleDepth });
            expect(errors.some(m => m.includes('same sample count'))).to.be.true;
            rt.destroyTextureBuffers();
            rt.destroy();
        });

        it('stores the depth resolve buffer and exposes it through the getter', function () {
            const resolve = createR32F();
            const rt = new RenderTarget({ name: 'msd-resolve', depthBuffer: createMsDepth(), depthResolveBuffer: resolve });
            expect(rt.depthResolveBuffer).to.equal(resolve);
            expect(errors).to.have.lengthOf(0);
            rt.destroyTextureBuffers();
            rt.destroy();
        });

        it('errors when depthResolveBuffer is used without a multisampled depthBuffer', function () {
            const depthBuffer = new Texture(device, { width: 4, height: 4, format: PIXELFORMAT_DEPTH, mipmaps: false });
            const resolve = createR32F();
            const rt = new RenderTarget({ name: 'msd-no-ms', depthBuffer, depthResolveBuffer: resolve });
            expect(errors.some(m => m.includes('only supported when the depthBuffer is a multisampled'))).to.be.true;
            expect(rt.depthResolveBuffer).to.equal(null);
            rt.destroyTextureBuffers();
            resolve.destroy();
            rt.destroy();
        });

        it('asserts on a depthResolveBuffer with the wrong format', function () {
            const resolve = new Texture(device, { width: 4, height: 4, format: PIXELFORMAT_RGBA8, mipmaps: false });
            const rt = new RenderTarget({ name: 'msd-format', depthBuffer: createMsDepth(), depthResolveBuffer: resolve });
            expect(errors.some(m => m.includes('PIXELFORMAT_R32F'))).to.be.true;
            rt.destroyTextureBuffers();
            rt.destroy();
        });

        it('asserts on a depthResolveBuffer with mismatched dimensions', function () {
            const resolve = createR32F({ width: 8, height: 8 });
            const rt = new RenderTarget({ name: 'msd-dims', depthBuffer: createMsDepth(), depthResolveBuffer: resolve });
            expect(errors.some(m => m.includes('dimensions'))).to.be.true;
            rt.destroyTextureBuffers();
            rt.destroy();
        });

        it('resizes the depth resolve buffer along with the other buffers', function () {
            const resolve = createR32F();
            const rt = new RenderTarget({ name: 'msd-resize', depthBuffer: createMsDepth(), depthResolveBuffer: resolve });
            rt.resize(8, 8);
            expect(rt.depthBuffer.width).to.equal(8);
            expect(resolve.width).to.equal(8);
            rt.destroyTextureBuffers();
            rt.destroy();
        });
    });

    describe('#depthResolveMode', function () {

        it('defaults to DEPTHRESOLVE_MIN', function () {
            const rt = createRenderTarget({ samples: 4 });
            expect(rt.depthResolveMode).to.equal(DEPTHRESOLVE_MIN);
            destroyRenderTarget(rt);
        });

        it('is set by the constructor option', function () {
            const rt = createRenderTarget({ samples: 4, depthResolveMode: DEPTHRESOLVE_SAMPLE0 });
            expect(rt.depthResolveMode).to.equal(DEPTHRESOLVE_SAMPLE0);
            destroyRenderTarget(rt);
        });

        it('is mutable at any time', function () {
            const rt = createRenderTarget({ samples: 4 });
            rt.depthResolveMode = DEPTHRESOLVE_MAX;
            expect(rt.depthResolveMode).to.equal(DEPTHRESOLVE_MAX);
            rt.depthResolveMode = DEPTHRESOLVE_MIN;
            expect(rt.depthResolveMode).to.equal(DEPTHRESOLVE_MIN);
            destroyRenderTarget(rt);
        });
    });
});
