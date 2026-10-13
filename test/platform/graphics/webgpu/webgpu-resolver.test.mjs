import { expect } from 'chai';
import sinon from 'sinon';

import { WebgpuResolver } from '../../../../src/platform/graphics/webgpu/webgpu-resolver.js';

describe('WebgpuResolver', function () {

    describe('#clearDepth', function () {

        // clears a depth texture of the format, recording the view it creates and the render pass
        // it encodes, and returns the pass's depth-stencil attachment
        const clear = (format, viewDescriptor) => {
            const view = { format };
            const texture = { format, createView: sinon.stub().returns(view) };
            const passEncoder = { end: sinon.spy() };
            const commandEncoder = { beginRenderPass: sinon.stub().returns(passEncoder) };

            new WebgpuResolver({}).clearDepth(commandEncoder, texture, viewDescriptor);

            expect(texture.createView.calledOnceWithExactly(viewDescriptor)).to.be.true;
            expect(commandEncoder.beginRenderPass.calledOnce).to.be.true;
            expect(passEncoder.end.calledOnce).to.be.true;
            const descriptor = commandEncoder.beginRenderPass.firstCall.args[0];
            expect(descriptor.colorAttachments).to.deep.equal([]);
            expect(descriptor.depthStencilAttachment.view).to.equal(view);
            return descriptor.depthStencilAttachment;
        };

        it('clears a slice of a depth texture to the far plane and stores it', function () {
            const viewDescriptor = { dimension: '2d', baseArrayLayer: 1, arrayLayerCount: 1 };
            const attachment = clear('depth24plus', viewDescriptor);
            expect(attachment.depthClearValue).to.equal(1);
            expect(attachment.depthLoadOp).to.equal('clear');
            expect(attachment.depthStoreOp).to.equal('store');

            // a depth-only format takes no stencil operations
            expect(attachment).to.not.have.property('stencilLoadOp');
            expect(attachment).to.not.have.property('stencilStoreOp');
        });

        it('clears the stencil of a depth-stencil texture along with its depth', function () {
            const attachment = clear('depth24plus-stencil8', undefined);
            expect(attachment.depthLoadOp).to.equal('clear');
            expect(attachment.depthStoreOp).to.equal('store');
            expect(attachment.stencilLoadOp).to.equal('clear');
            expect(attachment.stencilStoreOp).to.equal('store');
        });
    });
});
