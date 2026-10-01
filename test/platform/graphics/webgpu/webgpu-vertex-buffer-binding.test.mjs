import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../../../src/core/debug.js';
import { Color } from '../../../../src/core/math/color.js';
import { PRIMITIVE_TRIANGLES } from '../../../../src/platform/graphics/constants.js';
import { WebgpuDebug } from '../../../../src/platform/graphics/webgpu/webgpu-debug.js';
import { WebgpuGraphicsDevice } from '../../../../src/platform/graphics/webgpu/webgpu-graphics-device.js';

// WebGPU keeps the vertex and index buffers bound across draws for the whole render pass, so the
// device binds only what differs from the previous draw - a mesh drawn many times in a row binds
// its buffers once.
describe('WebGPU vertex and index buffer binding', function () {
    const primitive = { type: PRIMITIVE_TRIANGLES, count: 36, base: 0 };
    let device;
    let encoder;

    const createEncoder = () => ({
        setPipeline: sinon.spy(),
        setVertexBuffer: sinon.spy(),
        setIndexBuffer: sinon.spy(),
        draw: sinon.spy(),
        drawIndexed: sinon.spy()
    });

    // a vertex buffer of a single interleaved stream
    const interleaved = (renderingHash = 1) => ({
        format: { interleaved: true, elements: [{ offset: 0 }], renderingHash },
        impl: { buffer: {} }
    });

    // a vertex buffer of one stream per attribute, at the given offsets in a single GPU buffer
    const separate = (offsets, buffer = {}) => ({
        format: { interleaved: false, elements: offsets.map(offset => ({ offset })), renderingHash: 2 },
        impl: { buffer }
    });

    const indexBuffer = (format = 'uint16') => ({ format: 1, impl: { buffer: {}, format } });

    const drawMesh = (vertexBuffer, ib) => {
        device.setVertexBuffer(vertexBuffer);
        device.draw(primitive, ib);
    };

    beforeEach(function () {
        sinon.stub(WebgpuDebug, 'validate');
        sinon.stub(WebgpuDebug, 'end');
        sinon.stub(Debug, 'call');

        encoder = createEncoder();
        device = Object.assign(Object.create(WebgpuGraphicsDevice.prototype), {
            passEncoder: encoder,
            pipeline: null,
            shader: { ready: true, failed: false },
            vertexBuffers: [],
            renderPipeline: { get: sinon.stub().returns({}) },
            blendColor: new Color(),
            bindGroupFormats: [],
            _boundVertexBuffers: [],
            _boundVertexOffsets: [],
            _boundIndexBuffer: null,
            _boundIndexFormat: null,
            _pipelineDirty: true,
            _drawCallsPerFrame: 0,
            _primitiveCount: 0
        });
    });

    afterEach(function () {
        sinon.restore();
    });

    it('binds the buffers of a mesh drawn repeatedly once', function () {
        const vb = interleaved();
        const ib = indexBuffer();
        drawMesh(vb, ib);
        drawMesh(vb, ib);
        drawMesh(vb, ib);

        expect(encoder.setVertexBuffer.callCount).to.equal(1);
        expect(encoder.setVertexBuffer.firstCall.args).to.deep.equal([0, vb.impl.buffer, 0]);
        expect(encoder.setIndexBuffer.callCount).to.equal(1);
        expect(encoder.setIndexBuffer.firstCall.args).to.deep.equal([ib.impl.buffer, 'uint16']);
        expect(encoder.drawIndexed.callCount).to.equal(3);
    });

    it('binds each attribute stream of a non-interleaved mesh once', function () {
        const vb = separate([0, 288, 576, 768]);
        drawMesh(vb);
        drawMesh(vb);

        expect(encoder.setVertexBuffer.callCount).to.equal(4);
        expect(encoder.setVertexBuffer.args.map(args => [args[0], args[2]])).to.deep.equal([[0, 0], [1, 288], [2, 576], [3, 768]]);
        expect(encoder.draw.callCount).to.equal(2);
    });

    it('rebinds when the next draw uses the buffers of another mesh', function () {
        const a = interleaved();
        const b = interleaved();
        const ibA = indexBuffer();
        const ibB = indexBuffer();
        drawMesh(a, ibA);
        drawMesh(b, ibB);
        drawMesh(a, ibA);

        expect(encoder.setVertexBuffer.args.map(args => args[1])).to.deep.equal([a.impl.buffer, b.impl.buffer, a.impl.buffer]);
        expect(encoder.setIndexBuffer.args.map(args => args[0])).to.deep.equal([ibA.impl.buffer, ibB.impl.buffer, ibA.impl.buffer]);
    });

    it('rebinds only the streams whose buffer or offset changed', function () {
        const buffer = {};
        drawMesh(separate([0, 100, 200], buffer));
        drawMesh(separate([0, 100, 300], buffer));

        expect(encoder.setVertexBuffer.callCount).to.equal(4);
        expect(encoder.setVertexBuffer.lastCall.args).to.deep.equal([2, buffer, 300]);
    });

    it('rebinds an index buffer when its format changes', function () {
        const ib = indexBuffer('uint16');
        drawMesh(interleaved(), ib);
        ib.impl.format = 'uint32';
        device.draw(primitive, ib);

        expect(encoder.setIndexBuffer.args.map(args => args[1])).to.deep.equal(['uint16', 'uint32']);
    });

    it('rebinds every buffer in a new render pass', function () {
        const vb = interleaved();
        const ib = indexBuffer();
        drawMesh(vb, ib);

        const nextEncoder = createEncoder();
        device.passEncoder = nextEncoder;
        device.setupPassEncoderDefaults();
        drawMesh(vb, ib);

        expect(encoder.setVertexBuffer.callCount).to.equal(1);
        expect(nextEncoder.setVertexBuffer.callCount).to.equal(1);
        expect(nextEncoder.setIndexBuffer.callCount).to.equal(1);
        expect(nextEncoder.drawIndexed.callCount).to.equal(1);
    });
});
