import { expect } from 'chai';
import sinon from 'sinon';

import { WebgpuBuffer } from '../../../../src/platform/graphics/webgpu/webgpu-buffer.js';
import { WebgpuGraphicsDevice } from '../../../../src/platform/graphics/webgpu/webgpu-graphics-device.js';

describe('WebGPU device destruction', function () {
    it('keeps resource destruction deferred until submission while the device is alive', function () {
        const device = new WebgpuGraphicsDevice({ width: 1, height: 1 });
        const resource = { destroy: sinon.spy() };

        device.deferDestroy(resource);
        expect(resource.destroy.called).to.be.false;

        device.submit();
        expect(resource.destroy.calledOnce).to.be.true;
        expect(device._deferredDestroys).to.be.empty;
        device.destroy();
        expect(resource.destroy.calledOnce).to.be.true;
    });

    it('releases queued, owned and destroy-listener resources before destroying the native device', async function () {
        const device = new WebgpuGraphicsDevice({ width: 1, height: 1 });
        const queued = { destroy: sinon.spy() };
        const owned = { destroy: sinon.spy() };
        const listener = { destroy: sinon.spy() };
        const buffer = new WebgpuBuffer();
        buffer.buffer = owned;
        device.quadVertexBuffer = { destroy: () => buffer.destroy(device) };
        device.wgpu = { destroy: sinon.spy(() => {
            expect(device._destroyed).to.be.true;
            expect(device._deferredDestroys).to.be.empty;
            for (const resource of [queued, owned, listener]) {
                expect(resource.destroy.calledOnce).to.be.true;
            }
        }) };
        device.on('destroy', () => device.deferDestroy(listener));
        device.deferDestroy(queued);
        const submit = sinon.spy(device, 'submit');
        const createDevice = sinon.stub(device, 'createDevice');

        device.destroy();
        expect(device.wgpu.destroy.calledOnce).to.be.true;
        expect(submit.called).to.be.false;

        await device.handleDeviceLost({ reason: 'destroyed' });
        expect(createDevice.called).to.be.false;
    });

    it('can destroy a device before native initialization', function () {
        const device = new WebgpuGraphicsDevice({ width: 1, height: 1 });
        expect(() => device.destroy()).not.to.throw();
        expect(device._destroyed).to.be.true;
    });
});
