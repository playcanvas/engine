import { expect } from 'chai';
import sinon from 'sinon';

import { GraphicsDevice } from '../../../../src/platform/graphics/graphics-device.js';
import { WebgpuGraphicsDevice } from '../../../../src/platform/graphics/webgpu/webgpu-graphics-device.js';

const deferred = () => {
    let resolve;
    const promise = new Promise((done) => {
        resolve = done;
    });
    return { promise, resolve };
};

describe('WebGPU destruction during recovery', function () {
    let windowDescriptor;
    let device;
    let adapter;
    let nativeDevice;
    let gpu;
    let restored;
    let restoreContext;
    let initDeviceCaps;

    beforeEach(function () {
        nativeDevice = { destroy: sinon.spy() };
        adapter = { features: new Set(), requestDevice: sinon.stub().resolves(nativeDevice) };
        gpu = { requestAdapter: sinon.stub().resolves(adapter) };
        windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
        Object.defineProperty(globalThis, 'window', {
            configurable: true,
            value: { navigator: { gpu } }
        });

        device = new WebgpuGraphicsDevice({ width: 1, height: 1 });
        device.gpuProfiler = { enabled: false, destroy() {}, loseContext() {} };
        restored = sinon.spy();
        device.on('devicerestored', restored);
        restoreContext = sinon.stub(GraphicsDevice.prototype, 'restoreContext');
        // Cancelled requests must never reach GPU resource creation.
        initDeviceCaps = sinon.stub(device, 'initDeviceCaps').throws(new Error('Unexpected GPU initialization'));
    });

    afterEach(function () {
        device.destroy();
        sinon.restore();
        if (windowDescriptor) {
            Object.defineProperty(globalThis, 'window', windowDescriptor);
        } else {
            delete globalThis.window;
        }
    });

    const expectCancelled = () => {
        expect(device._destroyed).to.be.true;
        expect(device.wgpu).to.equal(null);
        expect(device.gpuAdapter).to.equal(null);
        expect(device.gpuContext).to.equal(null);
        expect(device.canvasConfig).to.equal(null);
        expect(initDeviceCaps.called).to.be.false;
        expect(restoreContext.called).to.be.false;
        expect(restored.called).to.be.false;
    };

    it('does not request an adapter after destruction', async function () {
        device.destroy();
        expect(await device.createDevice()).to.equal(null);
        expect(gpu.requestAdapter.called).to.be.false;
        expectCancelled();
    });

    it('cancels recovery when destroyed while requesting an adapter', async function () {
        const request = deferred();
        gpu.requestAdapter.returns(request.promise);
        const recovery = device.handleDeviceLost({ reason: 'unknown', message: 'test loss' });
        expect(gpu.requestAdapter.calledOnce).to.be.true;

        device.destroy();
        request.resolve(adapter);
        await recovery;

        expect(adapter.requestDevice.called).to.be.false;
        expect(nativeDevice.destroy.called).to.be.false;
        expectCancelled();
    });

    it('destroys a device returned after teardown without creating resources on it', async function () {
        const request = deferred();
        const requested = deferred();
        adapter.requestDevice.callsFake(() => {
            requested.resolve();
            return request.promise;
        });
        const recovery = device.handleDeviceLost({ reason: 'unknown', message: 'test loss' });
        await requested.promise;

        device.destroy();
        request.resolve(nativeDevice);
        await recovery;

        expect(nativeDevice.destroy.calledOnce).to.be.true;
        expectCancelled();
    });

    it('does not start recovery when a device-lost listener destroys the device', async function () {
        device.on('devicelost', () => device.destroy());
        await device.handleDeviceLost({ reason: 'unknown', message: 'test loss' });
        expect(gpu.requestAdapter.called).to.be.false;
        expectCancelled();
    });

    it('does not restore when destroyed after creation completes but before recovery resumes', async function () {
        sinon.stub(device, 'createDevice').callsFake(() => {
            // Queue teardown ahead of the continuation awaiting this completed creation.
            queueMicrotask(() => device.destroy());
            return Promise.resolve(device);
        });
        await device.handleDeviceLost({ reason: 'unknown', message: 'test loss' });
        expectCancelled();
    });

    it('still restores resources and emits the event when recovery is not cancelled', async function () {
        sinon.stub(device, 'createDevice').callsFake(() => {
            device.gpuProfiler = { enabled: false, destroy() {} };
            return Promise.resolve(device);
        });
        await device.handleDeviceLost({ reason: 'unknown', message: 'test loss' });
        expect(device._destroyed).to.be.false;
        expect(restoreContext.calledOnce).to.be.true;
        expect(restored.calledOnce).to.be.true;
    });
});
