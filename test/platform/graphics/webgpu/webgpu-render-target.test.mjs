import { expect } from 'chai';

import { WebgpuRenderTarget, getMultisampledColorUsage } from '../../../../src/platform/graphics/webgpu/webgpu-render-target.js';

// getMultisampledColorUsage reads the WebGPU GPUTextureUsage global. The headless test runner
// has no GPUDevice; stub the enum with the spec values.
if (typeof globalThis.GPUTextureUsage === 'undefined') {
    globalThis.GPUTextureUsage = {
        COPY_SRC: 0x01,
        COPY_DST: 0x02,
        TEXTURE_BINDING: 0x04,
        STORAGE_BINDING: 0x08,
        RENDER_ATTACHMENT: 0x10,
        TRANSIENT_ATTACHMENT: 0x20
    };
}

describe('getMultisampledColorUsage', function () {

    it('is RENDER_ATTACHMENT only by default', function () {
        expect(getMultisampledColorUsage(false, false)).to.equal(GPUTextureUsage.RENDER_ATTACHMENT);
    });

    it('adds TRANSIENT_ATTACHMENT when transient', function () {
        expect(getMultisampledColorUsage(true, false)).to.equal(
            GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TRANSIENT_ATTACHMENT
        );
    });

    it('adds TEXTURE_BINDING when bindMultisampled', function () {
        expect(getMultisampledColorUsage(false, true)).to.equal(
            GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        );
    });

    it('does not add TEXTURE_BINDING when transient (mutually exclusive)', function () {
        expect(getMultisampledColorUsage(true, true)).to.equal(
            GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TRANSIENT_ATTACHMENT
        );
    });
});

describe('WebgpuRenderTarget#initColor', function () {

    it('creates the MSAA color texture with TEXTURE_BINDING when bindMultisampled is set', function () {
        const created = [];
        const wgpu = {
            createTexture(desc) {
                created.push(desc);
                return {
                    createView() {
                        return {};
                    }
                };
            }
        };
        const colorBuffer = {
            cubemap: false,
            format: 7,
            impl: {
                format: 'rgba16float',
                createView() {
                    return { resolve: true };
                }
            }
        };
        const renderTarget = {
            samples: 4,
            width: 4,
            height: 4,
            mipLevel: 0,
            face: 0,
            name: 'msaa-rt',
            transientColor: false,
            bindMultisampled: true,
            getColorBuffer: () => colorBuffer
        };
        const device = {
            wgpu,
            createTextureImpl() {
                return {
                    destroy() {},
                    propertyChanged() {},
                    loseContext() {}
                };
            }
        };
        const impl = new WebgpuRenderTarget(renderTarget);
        impl.initColor(device, wgpu, renderTarget, 0);

        expect(created).to.have.lengthOf(1);
        expect(created[0].sampleCount).to.equal(4);
        expect(created[0].usage).to.equal(
            GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        );
    });
});
