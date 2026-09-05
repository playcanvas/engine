import { expect } from 'chai';
import { restore, spy, stub } from 'sinon';

import {
    PRIMITIVE_POINTS, PRIMITIVE_LINES, PRIMITIVE_LINELOOP, PRIMITIVE_LINESTRIP,
    PRIMITIVE_TRIANGLES, PRIMITIVE_TRISTRIP, PRIMITIVE_TRIFAN
} from '../../../src/platform/graphics/constants.js';
import { DrawCommands } from '../../../src/platform/graphics/draw-commands.js';
import { getPrimitiveCount } from '../../../src/platform/graphics/primitive-utils.js';
import { WebglDrawCommands } from '../../../src/platform/graphics/webgl/webgl-draw-commands.js';
import { WebglGraphicsDevice } from '../../../src/platform/graphics/webgl/webgl-graphics-device.js';
import { WebgpuDebug } from '../../../src/platform/graphics/webgpu/webgpu-debug.js';
import { WebgpuDrawCommands } from '../../../src/platform/graphics/webgpu/webgpu-draw-commands.js';
import { WebgpuGraphicsDevice } from '../../../src/platform/graphics/webgpu/webgpu-graphics-device.js';

describe('Primitive counting', function () {
    afterEach(restore);

    it('counts assembled primitives rather than submitted vertices or indices', function () {
        expect(getPrimitiveCount(PRIMITIVE_POINTS, 7)).to.equal(7);
        expect(getPrimitiveCount(PRIMITIVE_LINES, 7)).to.equal(3);
        expect(getPrimitiveCount(PRIMITIVE_LINELOOP, 7)).to.equal(7);
        expect(getPrimitiveCount(PRIMITIVE_LINESTRIP, 7)).to.equal(6);
        expect(getPrimitiveCount(PRIMITIVE_TRIANGLES, 7)).to.equal(2);
        expect(getPrimitiveCount(PRIMITIVE_TRISTRIP, 7)).to.equal(5);
        expect(getPrimitiveCount(PRIMITIVE_TRIFAN, 7)).to.equal(5);
    });

    it('ignores incomplete primitives and empty draws', function () {
        for (const type of [PRIMITIVE_POINTS, PRIMITIVE_LINES, PRIMITIVE_LINELOOP, PRIMITIVE_LINESTRIP,
            PRIMITIVE_TRIANGLES, PRIMITIVE_TRISTRIP, PRIMITIVE_TRIFAN]) {
            expect(getPrimitiveCount(type, 0)).to.equal(0);
        }
        expect(getPrimitiveCount(PRIMITIVE_LINES, 1)).to.equal(0);
        expect(getPrimitiveCount(PRIMITIVE_LINELOOP, 1)).to.equal(0);
        expect(getPrimitiveCount(PRIMITIVE_LINESTRIP, 1)).to.equal(0);
        expect(getPrimitiveCount(PRIMITIVE_TRIANGLES, 2)).to.equal(0);
        expect(getPrimitiveCount(PRIMITIVE_TRISTRIP, 2)).to.equal(0);
        expect(getPrimitiveCount(PRIMITIVE_TRIFAN, 2)).to.equal(0);
    });

    for (const backend of ['WebGL', 'WebGPU']) {
        describe(backend, function () {
            let device;
            let commands;
            let draw;

            beforeEach(function () {
                device = {
                    _primitiveCount: 0,
                    _drawCallsPerFrame: 0,
                    shader: { ready: true, impl: { samplers: [], uniforms: [] } },
                    shaderValid: true,
                    activateShader() {},
                    vertexBuffers: [],
                    pipeline: {},
                    glPrimitive: [],
                    gl: { drawArrays() {}, drawArraysInstanced() {} },
                    extMultiDraw: { multiDrawArraysWEBGL() {}, multiDrawArraysInstancedWEBGL() {} },
                    passEncoder: { draw() {}, drawIndirect() {} },
                    _vram: { sb: 0 },
                    buffers: new Set(),
                    createBufferImpl: () => ({ buffer: {}, allocate() {}, write() {}, destroy() {} })
                };
                const webgl = backend === 'WebGL';
                device.createDrawCommandImpl = () => (webgl ? new WebglDrawCommands(0) : new WebgpuDrawCommands(device));
                commands = new DrawCommands(device);
                commands.allocate(3);
                const prototype = webgl ? WebglGraphicsDevice.prototype : WebgpuGraphicsDevice.prototype;
                draw = (type, count, instances, multiDraw) => {
                    prototype.draw.call(device, { type, count, base: 0 }, null, instances, multiDraw, false, false);
                };
                stub(WebgpuDebug, 'validate');
                stub(WebgpuDebug, 'end');
            });

            afterEach(function () {
                commands.destroy();
            });

            it('deducts strip overhead per draw instance and accumulates different topologies', function () {
                draw(PRIMITIVE_TRISTRIP, 4, 2);
                expect(device._primitiveCount).to.equal(4);
                draw(PRIMITIVE_TRISTRIP, 4, 1);
                draw(PRIMITIVE_TRIANGLES, 7, 3);
                draw(PRIMITIVE_LINES, 5, 1);
                draw(PRIMITIVE_POINTS, 3, 1);
                expect(device._primitiveCount).to.equal(17);
            });

            it('matches the backend behavior for a zero instance argument', function () {
                draw(PRIMITIVE_TRIANGLES, 6, 0);
                // WebGL uses zero as its legacy non-instanced draw path; WebGPU draws no instances.
                expect(device._primitiveCount).to.equal(backend === 'WebGL' ? 2 : 0);
            });

            it('counts each multi-draw command independently and ignores zero instances', function () {
                commands.add(0, 4, 2, 0);
                commands.add(1, 5, 3, 0);
                commands.add(2, 100, 0, 0);
                commands.update(3);
                draw(PRIMITIVE_TRISTRIP, 999, 1, commands);
                expect(device._primitiveCount).to.equal(13);
                draw(PRIMITIVE_TRIANGLES, 999, 1, commands);
                expect(device._primitiveCount).to.equal(18);
            });

            it('reuses multi-draw totals until the commands, topology or instancing mode change', function () {
                commands.add(0, 4, 2, 0);
                commands.add(1, 5, 3, 0);
                commands.update(2);
                const calculate = spy(commands.impl, 'getPrimitiveCount');
                expect(commands.getPrimitiveCount(PRIMITIVE_TRISTRIP)).to.equal(13);
                expect(commands.getPrimitiveCount(PRIMITIVE_TRISTRIP)).to.equal(13);
                expect(calculate.callCount).to.equal(1);
                expect(commands.getPrimitiveCount(PRIMITIVE_TRIANGLES)).to.equal(5);
                commands.add(0, 6, 1, 0);
                commands.update(1);
                expect(commands.getPrimitiveCount(PRIMITIVE_TRIANGLES)).to.equal(2);
                expect(calculate.callCount).to.equal(3);
                commands.update(0);
                expect(commands.getPrimitiveCount(PRIMITIVE_TRIANGLES)).to.equal(0);
            });

            if (backend === 'WebGL') {
                it('ignores command instance counts when submitting non-instanced multi-draws', function () {
                    commands.add(0, 4, 2, 0);
                    commands.add(1, 5, 0, 0);
                    commands.update(2);
                    draw(PRIMITIVE_TRISTRIP, 999, 1, commands);
                    expect(device._primitiveCount).to.equal(4);
                    draw(PRIMITIVE_TRISTRIP, 999, 0, commands);
                    expect(device._primitiveCount).to.equal(9);
                });
            } else {
                it('does not invent counts for GPU-authored indirect commands', function () {
                    const indirect = new DrawCommands(device);
                    indirect.update(3);
                    expect(indirect.getPrimitiveCount(PRIMITIVE_TRIANGLES)).to.equal(0);
                    indirect.destroy();
                });
            }
        });
    }
});
