import { expect } from 'chai';

import { Color } from '../../../src/core/math/color.js';
import { PIXELFORMAT_DEPTH, PIXELFORMAT_R32F, PIXELFORMAT_RGBA8 } from '../../../src/platform/graphics/constants.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { RenderPass } from '../../../src/platform/graphics/render-pass.js';
import { RenderTarget } from '../../../src/platform/graphics/render-target.js';
import { Texture } from '../../../src/platform/graphics/texture.js';

describe('RenderPass', function () {

    /** @type {NullGraphicsDevice} */
    let device;

    /** @type {RenderTarget} */
    let renderTarget;

    /** @type {RenderPass} */
    let renderPass;

    const createTexture = name => new Texture(device, {
        name: name,
        width: 4,
        height: 4,
        format: PIXELFORMAT_RGBA8,
        mipmaps: false
    });

    beforeEach(function () {
        device = new NullGraphicsDevice({ width: 100, height: 100 });
        renderTarget = new RenderTarget({
            colorBuffers: [createTexture('color0'), createTexture('color1')],
            depth: false
        });
        renderPass = new RenderPass(device);
        renderPass.init(renderTarget);
    });

    afterEach(function () {
        renderTarget.destroyTextureBuffers();
        renderTarget.destroy();
        device.destroy();
        device = null;
    });

    describe('#setClearColor', function () {

        const red = new Color(1, 0.5, 0.25, 1);
        const blue = new Color(0.25, 0.5, 1, 1);

        it('allocates one color ops entry per attachment', function () {
            expect(renderPass.colorArrayOps.length).to.equal(2);
            expect(renderPass.colorArrayOps[0].clear).to.equal(false);
            expect(renderPass.colorArrayOps[1].clear).to.equal(false);
        });

        it('applies the color to all attachments when no index is specified', function () {
            renderPass.setClearColor(red);

            for (let i = 0; i < 2; i++) {
                const ops = renderPass.colorArrayOps[i];
                expect(ops.clear).to.equal(true);
                expect(ops.clearValue.equals(red)).to.equal(true);
            }
        });

        it('applies the color to a single attachment when an index is specified', function () {
            renderPass.setClearColor(red, 1);

            expect(renderPass.colorArrayOps[0].clear).to.equal(false);
            expect(renderPass.colorArrayOps[1].clear).to.equal(true);
            expect(renderPass.colorArrayOps[1].clearValue.equals(red)).to.equal(true);
        });

        it('supports a different color per attachment', function () {
            renderPass.setClearColor(red, 0);
            renderPass.setClearColor(blue, 1);

            expect(renderPass.colorArrayOps[0].clearValue.equals(red)).to.equal(true);
            expect(renderPass.colorArrayOps[1].clearValue.equals(blue)).to.equal(true);
        });

        it('keeps the linear clear value in sync', function () {
            renderPass.setClearColor(red, 1);

            const linear = new Color().linear(red);
            expect(renderPass.colorArrayOps[1].clearValueLinear.equals(linear)).to.equal(true);
        });

        it('disables the clear of a single attachment when passing undefined with an index', function () {
            renderPass.setClearColor(red);
            renderPass.setClearColor(undefined, 1);

            expect(renderPass.colorArrayOps[0].clear).to.equal(true);
            expect(renderPass.colorArrayOps[1].clear).to.equal(false);

            // the previously set color is preserved, only the clear flag is disabled
            expect(renderPass.colorArrayOps[1].clearValue.equals(red)).to.equal(true);
        });

        it('disables the clear of all attachments when passing undefined without an index', function () {
            renderPass.setClearColor(red);
            renderPass.setClearColor(undefined);

            expect(renderPass.colorArrayOps[0].clear).to.equal(false);
            expect(renderPass.colorArrayOps[1].clear).to.equal(false);
        });

    });

    describe('#allocateAttachments: explicit multisampled attachments', function () {

        const createMsTexture = (name, format = PIXELFORMAT_RGBA8) => {
            device.isWebGPU = true;
            device.maxSamples = 4;
            return new Texture(device, { name, width: 4, height: 4, format, samples: 4 });
        };

        it('stores the samples when there is no resolve buffer', function () {
            const rt = new RenderTarget({ colorBuffer: createMsTexture('ms'), depth: false });
            const pass = new RenderPass(device);
            pass.init(rt);

            expect(pass.samples).to.equal(4);
            expect(pass.colorArrayOps[0].store).to.equal(true);
            expect(pass.colorArrayOps[0].resolve).to.equal(false);

            rt.destroyTextureBuffers();
            rt.destroy();
        });

        it('resolves and discards the samples when a resolve buffer is assigned', function () {
            const resolve = new Texture(device, { name: 'resolve', width: 4, height: 4, format: PIXELFORMAT_RGBA8, mipmaps: false });
            const rt = new RenderTarget({ colorBuffer: createMsTexture('ms2'), resolveBuffer: resolve, depth: false });
            const pass = new RenderPass(device);
            pass.init(rt);

            expect(pass.colorArrayOps[0].store).to.equal(false);
            expect(pass.colorArrayOps[0].resolve).to.equal(true);

            rt.destroyTextureBuffers();
            rt.destroy();
        });

        it('applies the defaults per attachment', function () {
            const resolve = new Texture(device, { name: 'resolve0', width: 4, height: 4, format: PIXELFORMAT_RGBA8, mipmaps: false });
            const rt = new RenderTarget({
                colorBuffers: [createMsTexture('msA'), createMsTexture('msB')],
                resolveBuffers: [resolve, null],
                depth: false
            });
            const pass = new RenderPass(device);
            pass.init(rt);

            expect(pass.colorArrayOps[0].store).to.equal(false);
            expect(pass.colorArrayOps[0].resolve).to.equal(true);
            expect(pass.colorArrayOps[1].store).to.equal(true);
            expect(pass.colorArrayOps[1].resolve).to.equal(false);

            rt.destroyTextureBuffers();
            rt.destroy();
        });

    });

    describe('#allocateAttachments: multisampled depth', function () {

        const createMsDepth = () => {
            device.isWebGPU = true;
            device.maxSamples = 4;
            return new Texture(device, { name: 'msDepth', width: 4, height: 4, format: PIXELFORMAT_DEPTH, samples: 4 });
        };

        it('stores depth and does not resolve without a depth resolve buffer', function () {
            const rt = new RenderTarget({ depthBuffer: createMsDepth() });
            const pass = new RenderPass(device);
            pass.init(rt);

            expect(pass.depthStencilOps.storeDepth).to.equal(true);
            expect(pass.depthStencilOps.resolveDepth).to.equal(false);

            rt.destroyTextureBuffers();
            rt.destroy();
        });

        it('resolves depth by default when a depth resolve buffer is assigned', function () {
            const resolve = new Texture(device, { name: 'depthResolve', width: 4, height: 4, format: PIXELFORMAT_R32F, mipmaps: false });
            const rt = new RenderTarget({ depthBuffer: createMsDepth(), depthResolveBuffer: resolve });
            const pass = new RenderPass(device);
            pass.init(rt);

            expect(pass.depthStencilOps.storeDepth).to.equal(true);
            expect(pass.depthStencilOps.resolveDepth).to.equal(true);

            rt.destroyTextureBuffers();
            rt.destroy();
        });

    });

});
