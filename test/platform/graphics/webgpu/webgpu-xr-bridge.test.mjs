import { expect } from 'chai';
import sinon from 'sinon';

import { EventHandler } from '../../../../src/core/event-handler.js';
import { WebgpuXrBridge } from '../../../../src/platform/graphics/webgpu/webgpu-xr-bridge.js';
import { XrBridge } from '../../../../src/platform/graphics/xr-bridge.js';

describe('WebgpuXrBridge', function () {

    let previousBinding;

    // the depth texture the runtime hands out with every view's sub-image, as Safari on visionOS
    // does whether or not the layer asked for one, or null for none
    let depthTexture;

    beforeEach(function () {
        previousBinding = globalThis.XRGPUBinding;
        depthTexture = null;
        globalThis.XRGPUBinding = class {
            getPreferredColorFormat() {
                return 'bgra8unorm';
            }

            createProjectionLayer(options) {
                return { options };
            }

            // a view's sub-image: a slice of the layer's color, and the depth
            getViewSubImage(layer, view) {
                return {
                    colorTexture: { width: 64, height: 64, format: 'bgra8unorm' },
                    depthStencilTexture: depthTexture,
                    viewport: { x: 0, y: 0, width: 64, height: 64 },
                    getViewDescriptor: () => ({ baseArrayLayer: view.index })
                };
            }
        };
    });

    afterEach(function () {
        globalThis.XRGPUBinding = previousBinding;
    });

    // a depth texture of the format, whose views record the descriptor they were created with
    const createDepthTexture = format => ({
        format,
        createView: sinon.stub().callsFake(descriptor => ({ descriptor }))
    });

    const createBridge = () => {
        const passEncoder = { end: sinon.spy() };
        const commandEncoder = { beginRenderPass: sinon.stub().returns(passEncoder) };
        const device = {
            wgpu: {},
            xrSubImages: [],
            passEncoder,
            commandEncoder,
            on: () => ({ off() {} }),
            getCommandEncoder: () => commandEncoder,
            setXrBackBufferFormat() {},
            _clearXrState() {
                this.xrSubImages.length = 0;
            },
            createXrBridgeImpl: bridge => new WebgpuXrBridge(bridge)
        };
        const bridge = new XrBridge(device, new EventHandler());
        bridge.attachPresentation({
            renderState: { depthNear: 0.1, depthFar: 1000 },
            updateRenderState() {}
        }, { framebufferScaleFactor: 1, depthNear: 0.1, depthFar: 1000 });
        return bridge;
    };

    // an XR frame whose viewer pose has the given number of views
    const frame = viewCount => ({
        getViewerPose: () => ({ views: Array.from({ length: viewCount }, (_, index) => ({ index })) })
    });

    it('clears the depth of every view to the far plane', function () {
        depthTexture = createDepthTexture('depth24plus');
        const bridge = createBridge();
        bridge.impl.beginFrame(frame(2), {});

        const { commandEncoder, passEncoder } = bridge.device;
        expect(bridge.device.xrSubImages).to.have.length(2);
        expect(depthTexture.createView.calledTwice).to.be.true;
        expect(commandEncoder.beginRenderPass.calledTwice).to.be.true;
        expect(passEncoder.end.calledTwice).to.be.true;

        for (let view = 0; view < 2; view++) {
            // the view's own array layer of the depth
            const viewDescriptor = depthTexture.createView.getCall(view).args[0];
            expect(viewDescriptor).to.deep.equal({
                dimension: '2d',
                baseMipLevel: 0,
                mipLevelCount: 1,
                baseArrayLayer: view,
                arrayLayerCount: 1
            });

            const descriptor = commandEncoder.beginRenderPass.getCall(view).args[0];
            expect(descriptor.colorAttachments).to.deep.equal([]);
            const attachment = descriptor.depthStencilAttachment;
            expect(attachment.view).to.equal(depthTexture.createView.getCall(view).returnValue);
            expect(attachment.depthClearValue).to.equal(1);
            expect(attachment.depthLoadOp).to.equal('clear');
            expect(attachment.depthStoreOp).to.equal('store');

            // a depth-only format takes no stencil operations
            expect(attachment).to.not.have.property('stencilLoadOp');
            expect(attachment).to.not.have.property('stencilStoreOp');
        }
    });

    it('clears the stencil of a depth-stencil texture along with its depth', function () {
        depthTexture = createDepthTexture('depth24plus-stencil8');
        const bridge = createBridge();
        bridge.impl.beginFrame(frame(1), {});

        const attachment = bridge.device.commandEncoder.beginRenderPass.firstCall.args[0].depthStencilAttachment;
        expect(attachment.depthLoadOp).to.equal('clear');
        expect(attachment.depthStoreOp).to.equal('store');
        expect(attachment.stencilLoadOp).to.equal('clear');
        expect(attachment.stencilStoreOp).to.equal('store');
    });

    it('clears no depth for a view without one', function () {
        const bridge = createBridge();
        bridge.impl.beginFrame(frame(1), {});
        expect(bridge.device.xrSubImages).to.have.length(1);
        expect(bridge.device.commandEncoder.beginRenderPass.called).to.be.false;
    });
});
