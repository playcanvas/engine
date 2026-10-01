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
        const wgpu = { destroy: sinon.spy(() => {
            expect(device._destroyed).to.be.true;
            expect(device._deferredDestroys).to.be.empty;
            for (const resource of [queued, owned, listener]) {
                expect(resource.destroy.calledOnce).to.be.true;
            }
        }) };
        device.wgpu = wgpu;
        device.on('destroy', () => device.deferDestroy(listener));
        device.deferDestroy(queued);
        const submit = sinon.spy(device, 'submit');
        const createDevice = sinon.stub(device, 'createDevice');

        device.destroy();
        expect(wgpu.destroy.calledOnce).to.be.true;
        expect(submit.called).to.be.false;

        await device.handleDeviceLost({ reason: 'destroyed' });
        expect(createDevice.called).to.be.false;
    });

    it('can destroy a device before native initialization', function () {
        const device = new WebgpuGraphicsDevice({ width: 1, height: 1 });
        expect(() => device.destroy()).not.to.throw();
        expect(device._destroyed).to.be.true;
    });

    it('unconfigures the canvas and releases native device references only once', function () {
        const device = new WebgpuGraphicsDevice({ width: 1, height: 1 });
        const gpuContext = { unconfigure: sinon.spy() };
        const wgpu = { destroy: sinon.spy() };
        device.gpuContext = gpuContext;
        device.wgpu = wgpu;
        device.gpuAdapter = {};
        device.canvasConfig = { device: wgpu };

        device.destroy();
        device.destroy();

        expect(gpuContext.unconfigure.calledOnce).to.be.true;
        expect(gpuContext.unconfigure.calledBefore(wgpu.destroy)).to.be.true;
        expect(wgpu.destroy.calledOnce).to.be.true;
        expect(device.wgpu).to.be.null;
        expect(device.gpuAdapter).to.be.null;
        expect(device.gpuContext).to.be.null;
        expect(device.canvasConfig).to.be.null;
    });

    it('discards pending commands, cached pipelines and recovery registrations on destruction', function () {
        const device = new WebgpuGraphicsDevice({ width: 1, height: 1 });
        const encoder = { finish: sinon.spy() };
        device.commandEncoder = encoder;
        device.commandBuffers.push({});
        device.passEncoder = {};
        device.pipeline = {};
        device.insideRenderPass = true;
        device.bindGroupFormats.push({});
        device.renderPipeline.cache.set(1, [{}]);
        device.computePipeline.cache.set(2, [{}]);
        device._bindGroups.add({});
        device._bindGroupFormats.add({});
        device._computes.add({});
        device._drawCommands.add({});

        device.destroy();

        expect(encoder.finish.called).to.be.false;
        expect(device.commandEncoder).to.be.null;
        expect(device.commandBuffers).to.be.empty;
        expect(device.passEncoder).to.be.null;
        expect(device.pipeline).to.be.null;
        expect(device.insideRenderPass).to.be.false;
        expect(device.bindGroupFormats).to.be.empty;
        expect(device.renderPipeline.cache.size).to.equal(0);
        expect(device.computePipeline.cache.size).to.equal(0);
        expect(device._bindGroups.size).to.equal(0);
        expect(device._bindGroupFormats.size).to.equal(0);
        expect(device._computes.size).to.equal(0);
        expect(device._drawCommands.size).to.equal(0);
    });
});
