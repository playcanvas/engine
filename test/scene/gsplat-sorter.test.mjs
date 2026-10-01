import { expect } from 'chai';
import sinon from 'sinon';

import { EventHandler } from '../../src/core/event-handler.js';
import { GSplatSorter } from '../../src/scene/gsplat/gsplat-sorter.js';

describe('GSplatSorter recovery', function () {
    it('reuploads the latest order without a new camera update and detaches its listener on destruction', function () {
        const originalWorker = globalThis.Worker;
        globalThis.Worker = class {
            on(event, handler) {
                this.handler = handler;
            }

            postMessage() {}

            terminate() {}
        };
        const device = new EventHandler();
        device.isWebGPU = true;
        const upload = sinon.spy();
        device.createUploadStreamImpl = () => ({ upload, destroy() {} });
        let sorter;
        try {
            sorter = new GSplatSorter(device);
            const target = {};
            sorter.init(target, 3, new Float32Array(9));
            const order = new Uint32Array([2, 0, 1]);
            sorter.worker.handler({ order: order.buffer, count: 3 });
            expect(sorter.applyPendingSorted()).to.equal(3);
            expect(sorter.applyPendingSorted()).to.equal(-1);
            const updated = sinon.spy();
            sorter.on('updated', updated);

            device.fire('devicelost');
            device.fire('devicerestored');
            expect(updated.calledOnce).to.be.true;
            expect(sorter.applyPendingSorted()).to.equal(3);
            expect(upload.calledTwice).to.be.true;
            expect(upload.lastCall.args[0].buffer).to.equal(order.buffer);
            expect([...upload.lastCall.args[0]]).to.deep.equal([2, 0, 1]);
            expect(upload.lastCall.args[1]).to.equal(target);

            sorter.destroy();
            sorter = null;
            device.fire('devicerestored');
            expect(updated.calledOnce).to.be.true;
        } finally {
            sorter?.destroy();
            if (originalWorker === undefined) delete globalThis.Worker;
            else globalThis.Worker = originalWorker;
        }
    });
});
