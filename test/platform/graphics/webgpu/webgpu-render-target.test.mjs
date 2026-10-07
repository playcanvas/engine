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
        layer: 0,
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

describe('WebgpuRenderTarget#initDepthStencil', function () {

    const createDepthMocks = ({ cubemap, array = false }) => {
        const views = [];
        const gpuTexture = {};
        const depthBuffer = {
            cubemap,
            array,
            samples: 1,
            impl: {
                format: 'depth24plus-stencil8',
                gpuTexture,
                createView(desc) {
                    views.push(desc);
                    return { desc };
                }
            }
        };
        const renderTarget = {
            samples: 1,
            width: 4,
            height: 4,
            depth: true,
            depthBuffer,
            layer: 3,
            name: 'depth-rt'
        };
        return { views, gpuTexture, renderTarget };
    };

    it('attaches a single face of a cubemap depth buffer', function () {
        const { views, gpuTexture, renderTarget } = createDepthMocks({ cubemap: true });
        const impl = new WebgpuRenderTarget(renderTarget);
        impl.initDepthStencil({}, {}, renderTarget);

        expect(views).to.deep.equal([{
            dimension: '2d',
            baseArrayLayer: 3,
            arrayLayerCount: 1,
            mipLevelCount: 1,
            baseMipLevel: 0
        }]);
        expect(impl.renderPassDescriptor.depthStencilAttachment.view.desc).to.equal(views[0]);
        expect(impl.depthAttachment.depthTexture).to.equal(gpuTexture);
        expect(impl.depthAttachment.hasStencil).to.equal(true);
    });

    it('attaches a single layer of a 2d array depth buffer', function () {
        const { views, renderTarget } = createDepthMocks({ cubemap: false, array: true });
        const impl = new WebgpuRenderTarget(renderTarget);
        impl.initDepthStencil({}, {}, renderTarget);

        expect(views).to.deep.equal([{
            dimension: '2d',
            baseArrayLayer: 3,
            arrayLayerCount: 1,
            mipLevelCount: 1,
            baseMipLevel: 0
        }]);
    });

    it('allocates a separate multisampled depth buffer for each layer of a depth buffer', function () {
        const device = { on() {} };
        const wgpu = {
            createTexture(desc) {
                return {
                    desc,
                    createView() {
                        return {};
                    }
                };
            }
        };
        const createDepthBuffer = (id, array) => ({
            id,
            cubemap: false,
            array,
            samples: 1,
            impl: { format: 'depth32float', gpuTexture: {} }
        });
        const init = (depthBuffer, layer) => {
            const renderTarget = {
                samples: 4,
                width: 4,
                height: 4,
                depth: true,
                depthBuffer,
                layer,
                name: `msaa-depth-${layer}`,
                getLayer: texture => ((texture?.cubemap || texture?.array) ? layer : 0)
            };
            const impl = new WebgpuRenderTarget(renderTarget);
            impl.initDepthStencil(device, wgpu, renderTarget);
            return impl.depthAttachment.multisampledDepthBuffer;
        };

        // a depth array - each layer has its own multisampled depth buffer
        const depthArray = createDepthBuffer(123456, true);
        const layer0 = init(depthArray, 0);
        const layer1 = init(depthArray, 1);
        const layer0Again = init(depthArray, 0);
        expect(layer0).to.not.equal(layer1);
        expect(layer0Again).to.equal(layer0);

        // a 2D depth buffer shared by render targets rendering to different color layers - the
        // layer does not apply to it, and so the multisampled depth buffer is shared
        const depth2d = createDepthBuffer(123457, false);
        expect(init(depth2d, 0)).to.equal(init(depth2d, 1));
    });

    it('attaches mip level 0 of a 2d depth buffer', function () {
        const { views, renderTarget } = createDepthMocks({ cubemap: false });
        const impl = new WebgpuRenderTarget(renderTarget);
        impl.initDepthStencil({}, {}, renderTarget);

        expect(views).to.deep.equal([{
            mipLevelCount: 1,
            baseMipLevel: 0
        }]);
        expect(impl.renderPassDescriptor.depthStencilAttachment.view.desc).to.equal(views[0]);
    });
});
