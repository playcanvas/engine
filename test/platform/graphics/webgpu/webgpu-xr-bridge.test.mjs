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

    const createBridge = () => {
        const device = {
            wgpu: {},
            xrSubImages: [],
            resolver: { clearDepth: sinon.spy() },
            on: () => ({ off() {} }),
            getCommandEncoder: () => ({}),
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
        depthTexture = { format: 'depth24plus' };
        const bridge = createBridge();
        bridge.impl.beginFrame(frame(2), {});

        const { clearDepth } = bridge.device.resolver;
        expect(bridge.device.xrSubImages).to.have.length(2);
        expect(clearDepth.calledTwice).to.be.true;
        for (let view = 0; view < 2; view++) {
            expect(clearDepth.getCall(view).args[1]).to.equal(depthTexture);
            expect(clearDepth.getCall(view).args[2].baseArrayLayer).to.equal(view);
        }
    });

    it('clears no depth for a view without one', function () {
        const bridge = createBridge();
        bridge.impl.beginFrame(frame(1), {});
        expect(bridge.device.xrSubImages).to.have.length(1);
        expect(bridge.device.resolver.clearDepth.called).to.be.false;
    });
});
