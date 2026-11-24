import { expect } from 'chai';
import sinon from 'sinon';

import { NullGraphicsDevice } from '../../../../src/platform/graphics/null/null-graphics-device.js';
import { WebgpuDrawCommands } from '../../../../src/platform/graphics/webgpu/webgpu-draw-commands.js';
import { WebgpuGraphicsDevice } from '../../../../src/platform/graphics/webgpu/webgpu-graphics-device.js';

describe('WebGPU draw command recovery', function () {
    it('reuploads commands after buffer restoration and unregisters them on destruction', function () {
        const device = new NullGraphicsDevice({ width: 1, height: 1 });
        device._bindGroupFormats = new Set();
        device._computes = new Set();
        device._drawCommands = new Set();
        device.supportsIndirectFirstInstance = true;
        const commands = new WebgpuDrawCommands(device, true);
        let bufferReady = true;
        const storage = {
            restoreContext() {
                bufferReady = true;
            },
            write: sinon.spy(() => expect(bufferReady).to.be.true),
            destroy: sinon.spy(() => device.buffers.delete(storage))
        };
        device.buffers.add(storage);
        commands.storage = storage;
        commands.gpuIndirect = new Uint32Array(10);
        commands.gpuIndirectSigned = new Int32Array(commands.gpuIndirect.buffer);
        commands.add(0, 36, 12, 3, -2, 7);
        commands.update(1);
        storage.write.resetHistory();

        expect(device._drawCommands.has(commands)).to.be.true;
        expect(device.hasEvent('devicerestored')).to.be.false;
        for (let cycle = 1; cycle <= 2; cycle++) {
            bufferReady = false;
            WebgpuGraphicsDevice.prototype.restoreContext.call(device);
            expect(storage.write.callCount).to.equal(cycle);
        }
        expect(storage.write.callCount).to.equal(2);
        expect(storage.write.alwaysCalledWithExactly(0, commands.gpuIndirect, 0, 5)).to.be.true;
        expect([...commands.gpuIndirectSigned.subarray(0, 5)]).to.deep.equal([36, 12, 3, -2, 7]);

        commands.destroy();
        expect(device._drawCommands.size).to.equal(0);
        WebgpuGraphicsDevice.prototype.restoreContext.call(device);
        expect(storage.write.callCount).to.equal(2);
        expect(storage.destroy.calledOnce).to.be.true;
        device.destroy();
    });
});

describe('WebGPU draw command layout', function () {

    const createCommands = (indexed) => {
        const device = { _drawCommands: new Set(), supportsIndirectFirstInstance: true };
        const commands = new WebgpuDrawCommands(device, indexed);
        commands.gpuIndirect = new Uint32Array(10);
        commands.gpuIndirectSigned = new Int32Array(commands.gpuIndirect.buffer);
        return commands;
    };

    it('writes the drawIndexedIndirect layout for an indexed mesh', function () {
        const commands = createCommands(true);
        commands.add(1, 36, 2, 3, -4, 5);
        expect([...commands.gpuIndirectSigned.subarray(5, 10)]).to.deep.equal([36, 2, 3, -4, 5]);
    });

    it('writes firstInstance into the fourth word that drawIndirect reads for a non-indexed mesh', function () {
        const commands = createCommands(false);
        commands.gpuIndirect.fill(99);
        commands.add(1, 36, 2, 3, 0, 5);
        expect([...commands.gpuIndirect.subarray(5, 10)]).to.deep.equal([36, 2, 3, 5, 0]);
    });
});
