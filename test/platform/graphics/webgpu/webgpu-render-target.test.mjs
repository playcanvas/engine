import { expect } from 'chai';

import { WebgpuRenderTarget } from '../../../../src/platform/graphics/webgpu/webgpu-render-target.js';

// initColor reads the WebGPU GPUTextureUsage global on the internal-allocation path. The headless
// test runner has no GPUDevice; stub the enum with the spec values.
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

const msView = { ms: true };
const resolveView = { resolve: true };

const createMocks = ({ msColorBuffer = true, resolveBuffer = false } = {}) => {
    const created = [];
    const wgpu = {
        createTexture(desc) {
            created.push(desc);
            return {
                createView() {
                    return { internalMs: true };
                }
            };
        }
    };
    const colorBuffer = {
        cubemap: false,
        samples: msColorBuffer ? 4 : 1,
        format: 7,
        impl: {
            format: 'rgba16float',
            createView() {
                return msView;
            }
        }
    };
    const resolve = resolveBuffer ? {
        impl: {
            createView() {
                return resolveView;
            }
        }
    } : null;
    const renderTarget = {
        samples: 4,
        width: 4,
        height: 4,
        mipLevel: 0,
        face: 0,
        name: 'msaa-rt',
        transientColor: false,
        getColorBuffer: () => colorBuffer,
        getResolveBuffer: () => resolve
    };
    const device = { wgpu };
    return { created, wgpu, renderTarget, device };
};

describe('WebgpuRenderTarget#initColor', function () {

    it('renders directly into an explicit multisampled color buffer without allocating one', function () {
        const { created, wgpu, renderTarget, device } = createMocks();
        const impl = new WebgpuRenderTarget(renderTarget);
        const colorAttachment = impl.initColor(device, wgpu, renderTarget, 0);

        expect(created).to.have.lengthOf(0);
        expect(colorAttachment.view).to.equal(msView);
        expect(colorAttachment.resolveTarget).to.equal(undefined);
        expect(impl.colorAttachments[0].format).to.equal('rgba16float');
        expect(impl.colorAttachments[0].multisampledBuffer).to.equal(undefined);
    });

    it('wires the resolve buffer as the resolve target', function () {
        const { created, wgpu, renderTarget, device } = createMocks({ resolveBuffer: true });
        const impl = new WebgpuRenderTarget(renderTarget);
        const colorAttachment = impl.initColor(device, wgpu, renderTarget, 0);

        expect(created).to.have.lengthOf(0);
        expect(colorAttachment.view).to.equal(msView);
        expect(colorAttachment.resolveTarget).to.equal(resolveView);
        expect(impl.colorAttachments[0].resolveView).to.equal(resolveView);
    });

    it('allocates the internal multisampled buffer for the implicit path', function () {
        const { created, wgpu, renderTarget, device } = createMocks({ msColorBuffer: false });
        const impl = new WebgpuRenderTarget(renderTarget);
        const colorAttachment = impl.initColor(device, wgpu, renderTarget, 0);

        expect(created).to.have.lengthOf(1);
        expect(created[0].sampleCount).to.equal(4);
        expect(created[0].usage).to.equal(GPUTextureUsage.RENDER_ATTACHMENT);
        expect(colorAttachment.view.internalMs).to.equal(true);
        expect(colorAttachment.resolveTarget).to.equal(msView);
    });
});
