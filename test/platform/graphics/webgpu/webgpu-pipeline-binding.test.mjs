import { expect } from 'chai';
import sinon from 'sinon';

import { Color } from '../../../../src/core/math/color.js';
import { PRIMITIVE_TRIANGLES } from '../../../../src/platform/graphics/constants.js';
import { WebgpuDebug } from '../../../../src/platform/graphics/webgpu/webgpu-debug.js';
import { WebgpuGraphicsDevice } from '../../../../src/platform/graphics/webgpu/webgpu-graphics-device.js';

describe('WebGPU render pipeline binding', function () {
    const primitive = { type: PRIMITIVE_TRIANGLES, count: 3, base: 0 };
    let device;
    let pipeline;
    let encoder;

    beforeEach(function () {
        sinon.stub(WebgpuDebug, 'validate');
        sinon.stub(WebgpuDebug, 'end');

        pipeline = {};
        encoder = { setPipeline: sinon.spy(), draw: sinon.spy() };
        device = Object.assign(Object.create(WebgpuGraphicsDevice.prototype), {
            passEncoder: encoder,
            pipeline: null,
            shader: { ready: true, failed: false },
            vertexBuffers: [],
            renderPipeline: { get: sinon.stub().returns(pipeline) },
            validateAttributes() {},
            blendColor: new Color(),
            _drawCallsPerFrame: 0,
            _primitiveCount: 0
        });
    });

    afterEach(function () {
        sinon.restore();
    });

    it('binds an unchanged pipeline once across ordinary draws', function () {
        device.draw(primitive);
        device.draw(primitive);
        device.draw(primitive);

        expect(encoder.setPipeline.calledOnceWithExactly(pipeline)).to.be.true;
        expect(encoder.draw.callCount).to.equal(3);
        expect(device.renderPipeline.get.callCount).to.equal(3);
    });

    it('binds each pipeline change, including returning to a previously used pipeline', function () {
        const otherPipeline = {};
        device.renderPipeline.get.onSecondCall().returns(otherPipeline);

        device.draw(primitive);
        device.draw(primitive);
        device.draw(primitive);

        expect(encoder.setPipeline.callCount).to.equal(3);
        expect(encoder.setPipeline.firstCall.args[0]).to.equal(pipeline);
        expect(encoder.setPipeline.secondCall.args[0]).to.equal(otherPipeline);
        expect(encoder.setPipeline.thirdCall.args[0]).to.equal(pipeline);
        expect(encoder.draw.callCount).to.equal(3);
    });

    it('rebinds the same pipeline on a new render pass encoder', function () {
        device.draw(primitive);

        const nextEncoder = { setPipeline: sinon.spy(), draw: sinon.spy() };
        device.passEncoder = nextEncoder;
        device.setupPassEncoderDefaults();
        device.draw(primitive);

        expect(encoder.setPipeline.calledOnceWithExactly(pipeline)).to.be.true;
        expect(nextEncoder.setPipeline.calledOnceWithExactly(pipeline)).to.be.true;
        expect(nextEncoder.draw.calledOnce).to.be.true;
    });

    it('retains the pipeline after the last view while clearing pending vertex buffers', function () {
        const vertexBuffer = {};
        device.submitVertexBuffer = sinon.stub().returns(1);
        device.setVertexBuffer(vertexBuffer);

        device.draw(primitive, undefined, 1, undefined, true, false);
        expect(device.vertexBuffers).to.deep.equal([vertexBuffer]);
        device.draw(primitive, undefined, 1, undefined, false, true);
        expect(device.vertexBuffers).to.have.lengthOf(0);

        device.setVertexBuffer(vertexBuffer);
        device.draw(primitive);

        expect(device.vertexBuffers).to.have.lengthOf(0);
        expect(device.submitVertexBuffer.calledTwice).to.be.true;
        expect(device.renderPipeline.get.calledTwice).to.be.true;
        expect(encoder.setPipeline.calledOnceWithExactly(pipeline)).to.be.true;
        expect(encoder.draw.callCount).to.equal(3);
    });
});
