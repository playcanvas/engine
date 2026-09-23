import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../../../src/core/debug.js';
import { Color } from '../../../../src/core/math/color.js';
import { BlendState } from '../../../../src/platform/graphics/blend-state.js';
import {
    CULLFACE_BACK, CULLFACE_NONE, FRONTFACE_CCW, FRONTFACE_CW, INDEXFORMAT_UINT16, INDEXFORMAT_UINT32,
    PRIMITIVE_TRIANGLES, PRIMITIVE_TRISTRIP
} from '../../../../src/platform/graphics/constants.js';
import { DepthState } from '../../../../src/platform/graphics/depth-state.js';
import { StencilParameters } from '../../../../src/platform/graphics/stencil-parameters.js';
import { WebgpuDebug } from '../../../../src/platform/graphics/webgpu/webgpu-debug.js';
import { WebgpuGraphicsDevice } from '../../../../src/platform/graphics/webgpu/webgpu-graphics-device.js';

// The device looks a render pipeline up only when one of its inputs changed since the previous
// lookup - a render state, tracked by the setters, or an argument of the draw - and otherwise
// draws with the pipeline it already has.
describe('WebGPU render pipeline binding', function () {
    const primitive = { type: PRIMITIVE_TRIANGLES, count: 3, base: 0 };
    let device;
    let pipeline;
    let encoder;

    const bindGroup = formatKey => ({
        impl: { bindGroup: {} },
        uniformBufferOffsets: new Uint32Array(0),
        format: { impl: { key: formatKey } }
    });

    const lookups = () => device.renderPipeline.get.callCount;

    beforeEach(function () {
        sinon.stub(WebgpuDebug, 'validate');
        sinon.stub(WebgpuDebug, 'end');

        // the debug build verifies every reused pipeline with a lookup of its own, which these
        // tests count separately, see the last test
        sinon.stub(Debug, 'call');

        pipeline = {};
        encoder = {
            setPipeline: sinon.spy(),
            draw: sinon.spy(),
            drawIndexed: sinon.spy(),
            setIndexBuffer: sinon.spy(),
            setBindGroup: sinon.spy(),
            setStencilReference: sinon.spy()
        };
        device = Object.assign(Object.create(WebgpuGraphicsDevice.prototype), {
            passEncoder: encoder,
            pipeline: null,
            shader: { ready: true, failed: false },
            vertexBuffers: [],
            renderPipeline: { get: sinon.stub().returns(pipeline) },
            validateAttributes() {},
            submitVertexBuffer: sinon.stub().returns(1),
            blendColor: new Color(),
            blendState: new BlendState(),
            depthState: new DepthState(),
            stencilEnabled: false,
            stencilFront: new StencilParameters(),
            stencilBack: new StencilParameters(),
            stencilRef: 0,
            cullMode: CULLFACE_BACK,
            frontFace: FRONTFACE_CCW,
            alphaToCoverage: false,
            bindGroupFormats: [],
            _boundVertexBuffers: [],
            _boundVertexOffsets: [],
            _pipelineDirty: true,
            _drawCallsPerFrame: 0,
            _primitiveCount: 0
        });
    });

    afterEach(function () {
        sinon.restore();
    });

    it('looks the pipeline up once across draws with unchanged state', function () {
        device.draw(primitive);
        device.draw(primitive);
        device.draw(primitive);

        expect(lookups()).to.equal(1);
        expect(encoder.setPipeline.calledOnceWithExactly(pipeline)).to.be.true;
        expect(encoder.draw.callCount).to.equal(3);
    });

    it('looks the pipeline up again when a state it depends on changes', function () {
        device.draw(primitive);

        const changes = {
            'shader': () => device.setShader({ ready: true, failed: false }),
            'blend state': () => device.setBlendState(BlendState.ALPHABLEND),
            'depth state': () => device.setDepthState(DepthState.NODEPTH),
            'cull mode': () => device.setCullMode(CULLFACE_NONE),
            'front face': () => device.setFrontFace(FRONTFACE_CW),
            'alpha to coverage': () => device.setAlphaToCoverage(true),
            'enabling stencil': () => device.setStencilState(new StencilParameters({ ref: 1 })),
            'stencil parameters': () => device.setStencilState(new StencilParameters({ ref: 1, readMask: 0x0f })),
            'disabling stencil': () => device.setStencilState(null, null),
            'a bind group format': () => device.setBindGroup(2, bindGroup(7)),
            'another bind group format': () => device.setBindGroup(2, bindGroup(8))
        };
        for (const [name, change] of Object.entries(changes)) {
            const before = lookups();
            change();
            device.draw(primitive);
            expect(lookups(), name).to.equal(before + 1);
        }
    });

    it('looks the pipeline up again when an argument of the draw changes', function () {
        device.setVertexBuffer({ format: { renderingHash: 1 } });
        device.draw(primitive);
        expect(lookups()).to.equal(1);

        device.draw({ type: PRIMITIVE_TRISTRIP, count: 3, base: 0 });
        expect(lookups(), 'primitive type').to.equal(2);

        device.draw(primitive);
        expect(lookups(), 'primitive type back').to.equal(3);

        device.setVertexBuffer({ format: { renderingHash: 2 } });
        device.draw(primitive);
        expect(lookups(), 'vertex layout').to.equal(4);
    });

    it('looks the pipeline up again when the index format of a strip changes, only', function () {
        const indexBuffer16 = { format: INDEXFORMAT_UINT16, impl: { buffer: {}, format: 'uint16' } };
        const indexBuffer32 = { format: INDEXFORMAT_UINT32, impl: { buffer: {}, format: 'uint32' } };

        // a triangle list does not depend on the index format, so meshes of 16 and 32 bit indices
        // share its pipeline
        device.draw(primitive);
        device.draw(primitive, indexBuffer16);
        device.draw(primitive, indexBuffer32);
        device.draw(primitive, indexBuffer16);
        expect(lookups(), 'triangle list').to.equal(1);

        // a strip does, as its strip index format
        const strip = { type: PRIMITIVE_TRISTRIP, count: 3, base: 0 };
        device.draw(strip, indexBuffer16);
        expect(lookups(), 'strip').to.equal(2);
        device.draw(strip, indexBuffer16);
        expect(lookups(), 'same strip index format').to.equal(2);
        device.draw(strip, indexBuffer32);
        expect(lookups(), 'strip index format').to.equal(3);
    });

    it('keeps the pipeline when a state is set to the value it already has', function () {
        device.setBindGroup(2, bindGroup(7));
        device.setVertexBuffer({ format: { renderingHash: 1 } });
        device.draw(primitive);
        expect(lookups()).to.equal(1);

        device.setShader(device.shader);
        device.setBlendState(BlendState.NOBLEND);
        device.setDepthState(DepthState.DEFAULT);
        device.setCullMode(CULLFACE_BACK);
        device.setFrontFace(FRONTFACE_CCW);
        device.setAlphaToCoverage(false);
        device.setStencilState(null, null);

        // a different format or vertex format object of the same layout is the same pipeline
        device.setBindGroup(2, bindGroup(7));
        device.setVertexBuffer({ format: { renderingHash: 1 } });
        device.draw(primitive);

        expect(lookups()).to.equal(1);
        expect(encoder.setPipeline.calledOnce).to.be.true;
    });

    it('binds each pipeline change, including returning to a previously used pipeline', function () {
        const otherPipeline = {};
        device.renderPipeline.get.onSecondCall().returns(otherPipeline);

        device.draw(primitive);
        device.setCullMode(CULLFACE_NONE);
        device.draw(primitive);
        device.setCullMode(CULLFACE_BACK);
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

        expect(lookups()).to.equal(2);
        expect(encoder.setPipeline.calledOnceWithExactly(pipeline)).to.be.true;
        expect(nextEncoder.setPipeline.calledOnceWithExactly(pipeline)).to.be.true;
        expect(nextEncoder.draw.calledOnce).to.be.true;
    });

    it('retains the pipeline after the last view while clearing pending vertex buffers', function () {
        const vertexBuffer = { format: { renderingHash: 1 } };
        device.setVertexBuffer(vertexBuffer);

        device.draw(primitive, undefined, 1, undefined, true, false);
        expect(device.vertexBuffers).to.deep.equal([vertexBuffer]);
        device.draw(primitive, undefined, 1, undefined, false, true);
        expect(device.vertexBuffers).to.have.lengthOf(0);

        device.setVertexBuffer(vertexBuffer);
        device.draw(primitive);

        expect(device.vertexBuffers).to.have.lengthOf(0);
        expect(device.submitVertexBuffer.calledTwice).to.be.true;
        expect(lookups()).to.equal(1);
        expect(encoder.setPipeline.calledOnceWithExactly(pipeline)).to.be.true;
        expect(encoder.draw.callCount).to.equal(3);
    });

    it('reports a state change which bypassed the setters, in the debug build', function () {
        Debug.call.restore();
        const error = sinon.stub(console, 'error');

        const otherPipeline = {};
        device.renderPipeline.get.callsFake(() => (device.cullMode === CULLFACE_NONE ? otherPipeline : pipeline));

        device.draw(primitive);
        expect(error.called).to.be.false;

        // written directly, so the device does not know the pipeline changed
        device.cullMode = CULLFACE_NONE;
        device.draw(primitive);

        expect(error.calledWithMatch('ASSERT FAILED: ', sinon.match(/stale render pipeline/))).to.be.true;
    });
});
