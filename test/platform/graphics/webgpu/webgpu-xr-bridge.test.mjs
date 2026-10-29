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

    // the projection layers made so far, whether a new one is lost from the start, and whether one
    // cannot be made at all: a lost layer's texture cannot be acquired, as the Quest Browser's after
    // the headset sleeps and wakes
    let layers;
    let newLayersLost;
    let newLayersFail;

    beforeEach(function () {
        previousBinding = globalThis.XRGPUBinding;
        depthTexture = null;
        layers = [];
        newLayersLost = false;
        newLayersFail = false;
        globalThis.XRGPUBinding = class {
            getPreferredColorFormat() {
                return 'bgra8unorm';
            }

            createProjectionLayer(options) {
                if (newLayersFail) {
                    throw new Error('Unable to create the WebGPU projection layer.');
                }
                const layer = { options, lost: newLayersLost, fixedFoveation: 0, destroy: sinon.spy() };
                layers.push(layer);
                return layer;
            }

            // a view's sub-image: a slice of the layer's color, and the depth
            getViewSubImage(layer, view) {
                if (layer.lost) {
                    throw new Error('Unable to acquire the WebGPU projection layer texture.');
                }
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
            updateRenderState: sinon.spy()
        }, { framebufferScaleFactor: 1, depthNear: 0.1, depthFar: 1000, onBindingError: sinon.spy() });
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

    it('makes the projection layer again once a second frame in a row cannot acquire its texture', function () {
        const bridge = createBridge();
        const session = bridge._session;
        const lost = bridge.impl.presentationLayer;
        lost.lost = true;

        // the first frame the layer is lost in reports the error and has no views
        bridge.impl.beginFrame(frame(2), {});
        expect(bridge._onBindingError.calledOnce).to.be.true;
        expect(bridge.device.xrSubImages).to.have.length(0);
        expect(layers).to.have.length(1);

        // the second replaces it in the session with a new layer, with the session's own settings,
        // and destroys it
        bridge.impl.beginFrame(frame(2), {});
        expect(bridge._onBindingError.calledTwice).to.be.true;
        const layer = bridge.impl.presentationLayer;
        expect(layer).to.not.equal(lost);
        expect(layers).to.have.length(2);
        expect(session.updateRenderState.lastCall.args[0]).to.deep.equal({
            layers: [layer],
            depthNear: 0.1,
            depthFar: 1000
        });
        expect(lost.destroy.calledOnce).to.be.true;

        // and the next frame draws into it
        bridge.impl.beginFrame(frame(2), {});
        expect(bridge.device.xrSubImages).to.have.length(2);
        expect(bridge._onBindingError.calledTwice).to.be.true;
    });

    it('keeps the projection layer when a single frame cannot acquire its texture', function () {
        const bridge = createBridge();
        const layer = bridge.impl.presentationLayer;

        for (let i = 0; i < 2; i++) {
            layer.lost = true;
            bridge.impl.beginFrame(frame(1), {});
            layer.lost = false;
            bridge.impl.beginFrame(frame(1), {});
            expect(bridge.device.xrSubImages).to.have.length(1);
        }
        expect(layers).to.have.length(1);
        expect(layer.destroy.called).to.be.false;
    });

    it('makes the projection layer again once while the new one fails as well', function () {
        const bridge = createBridge();
        bridge.impl.presentationLayer.lost = true;
        newLayersLost = true;

        for (let i = 0; i < 4; i++) bridge.impl.beginFrame(frame(1), {});
        expect(layers).to.have.length(2);
        expect(bridge._onBindingError.callCount).to.equal(4);
    });

    it('makes the projection layer again for a later loss, once a frame has drawn', function () {
        const bridge = createBridge();
        bridge.impl.presentationLayer.lost = true;
        for (let i = 0; i < 3; i++) bridge.impl.beginFrame(frame(1), {});
        expect(bridge.device.xrSubImages).to.have.length(1);

        bridge.impl.presentationLayer.lost = true;
        for (let i = 0; i < 2; i++) bridge.impl.beginFrame(frame(1), {});
        expect(layers).to.have.length(3);
    });

    it('keeps the fixed foveation of the lost projection layer', function () {
        const bridge = createBridge();
        const lost = bridge.impl.presentationLayer;
        lost.fixedFoveation = 0.5;
        lost.lost = true;

        for (let i = 0; i < 2; i++) bridge.impl.beginFrame(frame(1), {});
        expect(bridge.impl.presentationLayer).to.not.equal(lost);
        expect(bridge.impl.presentationLayer.fixedFoveation).to.equal(0.5);
    });

    it('reports a failure to make the projection layer again', function () {
        const bridge = createBridge();
        const lost = bridge.impl.presentationLayer;
        lost.lost = true;
        newLayersFail = true;

        // the acquire failure of both frames, then the failure to make the layer
        for (let i = 0; i < 2; i++) {
            expect(() => bridge.impl.beginFrame(frame(1), {})).to.not.throw();
        }
        expect(bridge._onBindingError.callCount).to.equal(3);
        expect(bridge._onBindingError.lastCall.args[0].message).to.equal('Unable to create the WebGPU projection layer.');
        expect(lost.destroy.called).to.be.false;
    });
});
