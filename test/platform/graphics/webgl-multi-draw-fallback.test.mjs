import { expect } from 'chai';
import { spy } from 'sinon';

import { PRIMITIVE_TRIANGLES } from '../../../src/platform/graphics/constants.js';
import { DrawCommands } from '../../../src/platform/graphics/draw-commands.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { WebglDrawCommands } from '../../../src/platform/graphics/webgl/webgl-draw-commands.js';
import { WebglGraphicsDevice } from '../../../src/platform/graphics/webgl/webgl-graphics-device.js';

// Exercises the loop used on WebGL2 devices without the WEBGL_multi_draw extension, which submits
// one draw per sub-draw. It is driven directly, as the real path needs a context missing the
// extension.
describe('WebGL multi-draw fallback loop', function () {

    const INDEX_SIZE_BYTES = 2;
    const INDICES_PER_SUBDRAW = 36;
    const MAX_SUBDRAWS = 4;

    let device;
    let commands;
    let gl;

    const indexBuffer = { impl: { glFormat: 0x1403 /* UNSIGNED_SHORT */ } };

    const submit = (indexed, numInstances) => WebglGraphicsDevice.prototype._multiDrawLoopFallback.call(
        { gl }, gl.TRIANGLES, { indexed, type: PRIMITIVE_TRIANGLES, count: INDICES_PER_SUBDRAW, base: 0 },
        indexBuffer, numInstances, commands
    );

    beforeEach(function () {
        gl = {
            TRIANGLES: 0x0004,
            drawElements: spy(),
            drawElementsInstanced: spy(),
            drawArrays: spy(),
            drawArraysInstanced: spy()
        };

        device = new NullGraphicsDevice({ width: 1, height: 1 });

        // the WebGL implementation, driven through the owner so the count travels the real route
        commands = new DrawCommands(device, INDEX_SIZE_BYTES);
        commands.impl = new WebglDrawCommands(INDEX_SIZE_BYTES);
        commands.allocate(MAX_SUBDRAWS);
        for (let i = 0; i < MAX_SUBDRAWS; i++) {
            commands.add(i, INDICES_PER_SUBDRAW, 1, i * INDICES_PER_SUBDRAW);
        }
        commands.update(MAX_SUBDRAWS);
    });

    afterEach(function () {
        device.destroy();
    });

    it('submits one indexed draw per sub-draw', function () {
        submit(true, 0);

        expect(gl.drawElements.callCount).to.equal(MAX_SUBDRAWS);
        for (let i = 0; i < MAX_SUBDRAWS; i++) {
            expect(gl.drawElements.getCall(i).args).to.deep.equal([
                gl.TRIANGLES, INDICES_PER_SUBDRAW, indexBuffer.impl.glFormat,
                i * INDICES_PER_SUBDRAW * INDEX_SIZE_BYTES
            ]);
        }
        expect(gl.drawElementsInstanced.notCalled).to.be.true;
    });

    it('submits one instanced indexed draw per sub-draw', function () {
        submit(true, 1);

        expect(gl.drawElementsInstanced.callCount).to.equal(MAX_SUBDRAWS);
        expect(gl.drawElementsInstanced.getCall(0).args).to.deep.equal([
            gl.TRIANGLES, INDICES_PER_SUBDRAW, indexBuffer.impl.glFormat, 0, 1
        ]);
        expect(gl.drawElements.notCalled).to.be.true;
    });

    it('submits one non-indexed draw per sub-draw', function () {
        submit(false, 0);

        expect(gl.drawArrays.callCount).to.equal(MAX_SUBDRAWS);
        expect(gl.drawArraysInstanced.notCalled).to.be.true;
    });

    it('submits one instanced non-indexed draw per sub-draw', function () {
        submit(false, 1);

        expect(gl.drawArraysInstanced.callCount).to.equal(MAX_SUBDRAWS);
        expect(gl.drawArrays.notCalled).to.be.true;
    });

    it('submits only the active sub-draws, not everything allocated', function () {
        // the culling pattern used by the multi-draw example: pack the visible sub-draws into the
        // front of the arrays and shrink the count
        commands.update(2);
        submit(true, 0);

        expect(gl.drawElements.callCount).to.equal(2);
    });

    it('submits nothing when the count is zero', function () {
        commands.update(0);
        submit(true, 0);

        expect(gl.drawElements.notCalled).to.be.true;
    });
});
