import { expect } from 'chai';
import sinon from 'sinon';

import { EventHandler } from '../../../../src/core/event-handler.js';
import { WebgpuDrawCommands } from '../../../../src/platform/graphics/webgpu/webgpu-draw-commands.js';

describe('WebGPU draw command recovery', function () {
    it('reuploads active CPU commands after each restoration and removes its listener on destruction', function () {
        const device = new EventHandler();
        const commands = new WebgpuDrawCommands(device);
        const storage = { write: sinon.spy(), destroy: sinon.spy() };
        commands.storage = storage;
        commands.gpuIndirect = new Uint32Array(10);
        commands.gpuIndirectSigned = new Int32Array(commands.gpuIndirect.buffer);
        commands.add(0, 36, 12, 3, -2, 7);
        commands.update(1);
        storage.write.resetHistory();

        device.fire('devicerestored');
        device.fire('devicerestored');
        expect(storage.write.callCount).to.equal(2);
        expect(storage.write.alwaysCalledWithExactly(0, commands.gpuIndirect, 0, 5)).to.be.true;
        expect([...commands.gpuIndirectSigned.subarray(0, 5)]).to.deep.equal([36, 12, 3, -2, 7]);

        commands.destroy();
        device.fire('devicerestored');
        expect(storage.write.callCount).to.equal(2);
        expect(storage.destroy.calledOnce).to.be.true;
        expect(device.hasEvent('devicerestored')).to.be.false;
    });
});
