import { expect } from 'chai';
import sinon from 'sinon';

import { WebgpuUploadStream } from '../../../../src/platform/graphics/webgpu/webgpu-upload-stream.js';

describe('WebGPU upload stream recovery', function () {
    const originalMapMode = globalThis.GPUMapMode;
    before(function () {
        globalThis.GPUMapMode = { WRITE: 2 };
    });
    after(function () {
        if (originalMapMode === undefined) delete globalThis.GPUMapMode;
        else globalThis.GPUMapMode = originalMapMode;
    });

    it('discards pooled buffers and excludes a late mapping from the replacement device pool', async function () {
        let completeMapping;
        const device = { wgpu: {},
            mapBufferAsync: () => new Promise((resolve) => {
                completeMapping = resolve;
            }) };
        const stream = new WebgpuUploadStream({ device });
        const available = { size: 16, destroy: sinon.spy() };
        const pending = { size: 16, destroy: sinon.spy() };
        const mapping = { size: 16, destroy: sinon.spy() };
        stream.pendingStagingBuffers.push(mapping);
        stream.update(16);
        stream.availableStagingBuffers.push(available);
        stream.pendingStagingBuffers.push(pending);
        stream._lastUploadSubmitVersion = 42;
        stream._onDeviceLost();
        device.wgpu = {};
        completeMapping(true);
        await Promise.resolve();
        expect(stream.availableStagingBuffers).to.have.lengthOf(0);
        expect(stream.pendingStagingBuffers).to.have.lengthOf(0);
        expect(stream._lastUploadSubmitVersion).to.equal(-1);
        for (const buffer of [available, pending, mapping]) expect(buffer.destroy.calledOnce).to.be.true;
        stream.destroy();
        for (const buffer of [available, pending, mapping]) expect(buffer.destroy.calledOnce).to.be.true;
    });
});
