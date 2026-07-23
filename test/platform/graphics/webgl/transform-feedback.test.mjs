import { expect } from 'chai';
import { assert, stub } from 'sinon';

import { BUFFER_GPUDYNAMIC, SEMANTIC_POSITION } from '../../../../src/platform/graphics/constants.js';
import { VertexBuffer } from '../../../../src/platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../../../src/platform/graphics/vertex-format.js';
import { WebglGraphicsDevice } from '../../../../src/platform/graphics/webgl/webgl-graphics-device.js';
import { mockWebgl2Canvas } from '../../../canvas-webgl-mock.js';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('WebglGraphicsDevice#transformFeedback', function () {
    /** @type {WebglGraphicsDevice} */
    let device;
    let canvas;

    let bufferIds = 0;
    function createMockSimpleBuffer() {

        const buffer = new VertexBuffer(
            device,
            new VertexFormat(device, [{ semantic: SEMANTIC_POSITION, components: 3, type: 'float' }]),
            1,
            { usege: BUFFER_GPUDYNAMIC }
        );

        // set buffer id
        buffer.impl = {
            bufferId: bufferIds++
        };

        return buffer;
    }

    beforeEach(function () {
        jsdomSetup();
        canvas = mockWebgl2Canvas();
        device = new WebglGraphicsDevice(canvas, {
            alpha: false,
            antialias: false,
            stencil: false,
            depth: false
        });
    });

    afterEach(function () {
        if (device) {
            device.destroy();
            device = null;
        }

        if (canvas && canvas.restore) {
            canvas.restore();
            canvas = null;
        }

        jsdomTeardown();
    });

    it('should set and clear transform feedback buffers', function () {
        const outputBuffer = createMockSimpleBuffer();

        expect(device.transformFeedbackNumSlots).to.equal(0);

        device.setTransformFeedbackBuffer(outputBuffer, 0);
        expect(device.transformFeedbackNumSlots).to.equal(1);
        expect(device.transformFeedbackBuffers[0]).to.equal(outputBuffer);

        device.setTransformFeedbackBuffer(null, 0);
        expect(device.transformFeedbackNumSlots).to.equal(0);
        expect(device.transformFeedbackBuffers[0]).to.be.null;

        outputBuffer.destroy();
    });

    it('should handle multiple transform feedback buffers', function () {
        const buffer0 = createMockSimpleBuffer();
        const buffer1 = createMockSimpleBuffer();

        device.setTransformFeedbackBuffer(buffer0, 0);
        device.setTransformFeedbackBuffer(buffer1, 1);

        expect(device.transformFeedbackNumSlots).to.equal(2);
        expect(device.transformFeedbackBuffers[0]).to.equal(buffer0);
        expect(device.transformFeedbackBuffers[1]).to.equal(buffer1);

        device.setTransformFeedbackBuffer(null, 1);
        expect(device.transformFeedbackNumSlots).to.equal(1);
        expect(device.transformFeedbackBuffers[1]).to.be.null;

        device.setTransformFeedbackBuffer(null, 0);
        expect(device.transformFeedbackNumSlots).to.equal(0);

        buffer0.destroy();
        buffer1.destroy();
    });

    it('should expand array when setting buffer at a higher slot', function () {
        const buffer = createMockSimpleBuffer();

        device.setTransformFeedbackBuffer(buffer, 5);

        expect(device.transformFeedbackBuffers.length).to.be.at.least(6);
        expect(device.transformFeedbackBuffers[5]).to.equal(buffer);
        expect(device.transformFeedbackNumSlots).to.equal(6);

        buffer.destroy();
    });

    it('should correctly recalc numSlots after clearing a higher slot while lower slots remain', function () {
        const buffer0 = createMockSimpleBuffer();
        const buffer1 = createMockSimpleBuffer();
        const buffer2 = createMockSimpleBuffer();

        device.setTransformFeedbackBuffer(buffer0, 0);
        device.setTransformFeedbackBuffer(buffer1, 2);
        device.setTransformFeedbackBuffer(buffer2, 4);

        expect(device.transformFeedbackNumSlots).to.equal(5);

        device.setTransformFeedbackBuffer(null, 4);

        expect(device.transformFeedbackNumSlots).to.equal(3);
        expect(device.transformFeedbackBuffers[0]).to.equal(buffer0);
        expect(device.transformFeedbackBuffers[2]).to.equal(buffer1);
        expect(device.transformFeedbackBuffers[4]).to.be.null;

        buffer0.destroy();
        buffer1.destroy();
        buffer2.destroy();
    });

    it('should handle setting null at a slot that is not the highest', function () {
        const buffer0 = createMockSimpleBuffer();
        const buffer1 = createMockSimpleBuffer();

        device.setTransformFeedbackBuffer(buffer0, 0);
        device.setTransformFeedbackBuffer(buffer1, 2);

        device.setTransformFeedbackBuffer(null, 0);

        expect(device.transformFeedbackNumSlots).to.equal(3);
        expect(device.transformFeedbackBuffers[0]).to.be.null;
        expect(device.transformFeedbackBuffers[2]).to.equal(buffer1);

        device.setTransformFeedbackBuffer(null, 2);

        expect(device.transformFeedbackNumSlots).to.equal(0);
        expect(device.transformFeedbackBuffers[2]).to.be.null;

        buffer0.destroy();
        buffer1.destroy();
    });

    it('should bind transform feedback only when first buffer is set and unbind when all cleared', function () {
        expect(device.feedback).to.be.null;

        const mockFeedback = {};
        const gl = device.gl;

        gl.createTransformFeedback = stub().returns(mockFeedback);
        gl.bindTransformFeedback = stub();

        const buffer = createMockSimpleBuffer();

        device.setTransformFeedbackBuffer(buffer, 0);

        expect(device.feedback).to.equal(mockFeedback);
        assert.calledOnce(gl.createTransformFeedback);
        assert.calledWith(gl.bindTransformFeedback, gl.TRANSFORM_FEEDBACK, mockFeedback);

        device.setTransformFeedbackBuffer(null, 0);

        expect(device.transformFeedbackNumSlots).to.equal(0);
        assert.calledWith(gl.bindTransformFeedback, gl.TRANSFORM_FEEDBACK, null);

        gl.createTransformFeedback.resetHistory();

        device.setTransformFeedbackBuffer(buffer, 0);

        assert.notCalled(gl.createTransformFeedback);
        assert.calledWith(gl.bindTransformFeedback, gl.TRANSFORM_FEEDBACK, mockFeedback);

        buffer.destroy();
    });

    it('should not bind if numSlots remains > 0 after clearing a lower slot', function () {
        const buffer0 = createMockSimpleBuffer();
        const buffer1 = createMockSimpleBuffer();

        device.setTransformFeedbackBuffer(buffer0, 0);
        device.setTransformFeedbackBuffer(buffer1, 1);

        const gl = device.gl;
        gl.bindTransformFeedback.resetHistory();

        device.setTransformFeedbackBuffer(null, 0);

        expect(device.transformFeedbackNumSlots).to.equal(2);
        assert.notCalled(gl.bindTransformFeedback);

        device.setTransformFeedbackBuffer(null, 1);

        expect(device.transformFeedbackNumSlots).to.equal(0);
        assert.calledWith(gl.bindTransformFeedback, gl.TRANSFORM_FEEDBACK, null);

        buffer0.destroy();
        buffer1.destroy();
    });

    it('should replace existing buffer at a slot and recalc numSlots correctly', function () {
        const bufferA = createMockSimpleBuffer();
        const bufferB = createMockSimpleBuffer();

        device.setTransformFeedbackBuffer(bufferA, 2);
        expect(device.transformFeedbackNumSlots).to.equal(3);

        device.setTransformFeedbackBuffer(bufferB, 2);

        expect(device.transformFeedbackBuffers[2]).to.equal(bufferB);
        expect(device.transformFeedbackNumSlots).to.equal(3);

        device.setTransformFeedbackBuffer(null, 2);

        expect(device.transformFeedbackNumSlots).to.equal(0);

        bufferA.destroy();
        bufferB.destroy();
    });

    it('should handle setting buffer at slot 0 when array has trailing nulls', function () {
        const bufferHigh = createMockSimpleBuffer();
        const bufferLow = createMockSimpleBuffer();

        device.setTransformFeedbackBuffer(bufferHigh, 5);
        expect(device.transformFeedbackNumSlots).to.equal(6);

        device.setTransformFeedbackBuffer(bufferLow, 0);

        expect(device.transformFeedbackNumSlots).to.equal(6);
        expect(device.transformFeedbackBuffers[0]).to.equal(bufferLow);

        device.setTransformFeedbackBuffer(null, 5);

        expect(device.transformFeedbackNumSlots).to.equal(1);
        expect(device.transformFeedbackBuffers[0]).to.equal(bufferLow);

        bufferHigh.destroy();
        bufferLow.destroy();
    });

    it('should maintain correct numSlots when setting null beyond current length', function () {
        const buffer = createMockSimpleBuffer();

        device.setTransformFeedbackBuffer(buffer, 3);
        expect(device.transformFeedbackNumSlots).to.equal(4);

        device.setTransformFeedbackBuffer(null, 10);

        expect(device.transformFeedbackBuffers.length).to.be.at.least(11);
        expect(device.transformFeedbackNumSlots).to.equal(4);
        expect(device.transformFeedbackBuffers[3]).to.equal(buffer);

        for (let i = 4; i < 11; i++) {
            expect(device.transformFeedbackBuffers[i]).to.be.null;
        }

        buffer.destroy();
    });

    it('should begin and end transform feedback around draw when buffers are set', function () {
        const gl = device.gl;
        const buffer0 = createMockSimpleBuffer();
        const buffer1 = createMockSimpleBuffer();

        device.setTransformFeedbackBuffer(buffer0, 0);
        device.setTransformFeedbackBuffer(buffer1, 1);

        const tfbBuffer0 = buffer0.impl.bufferId;
        const tfbBuffer1 = buffer1.impl.bufferId;

        const primitive = {
            type: 0,
            count: 3,
            base: 0,
            indexed: false
        };

        device.shader = {
            definition: { useDualSourceBlending: false },
            impl: {
                samplers: [],
                uniforms: []
            },
            name: 'mockShader',
            label: 'mockShader'
        };
        device.shaderValid = true;
        device.activateShader = stub();
        device.validateAttributes = stub();
        device.setBuffers = stub();
        device.setTexture = stub();
        device.commitFunction = {};
        device.glPrimitive = [gl.TRIANGLES];
        device.vertexBuffers = [];
        device.blendState = { usesDualSourceBlending: false };

        device.draw(primitive, null, 0, null, true, true);

        assert.calledWith(gl.bindBufferBase, gl.TRANSFORM_FEEDBACK_BUFFER, 0, tfbBuffer0);
        assert.calledWith(gl.bindBufferBase, gl.TRANSFORM_FEEDBACK_BUFFER, 1, tfbBuffer1);
        assert.calledOnce(gl.beginTransformFeedback);
        assert.calledOnce(gl.drawArrays);
        assert.calledOnce(gl.endTransformFeedback);

        assert.calledWith(gl.bindBufferBase, gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
        assert.calledWith(gl.bindBufferBase, gl.TRANSFORM_FEEDBACK_BUFFER, 1, null);

        assert.callOrder(
            gl.bindBufferBase,
            gl.beginTransformFeedback,
            gl.drawArrays,
            gl.endTransformFeedback
        );

        buffer0.destroy();
        buffer1.destroy();
    });
});
