import { expect } from 'chai';
import sinon from 'sinon';

import { BindGroupFormat } from '../../../../src/platform/graphics/bind-group-format.js';
import { BindGroup } from '../../../../src/platform/graphics/bind-group.js';
import { SHADERLANGUAGE_WGSL } from '../../../../src/platform/graphics/constants.js';
import { NullGraphicsDevice } from '../../../../src/platform/graphics/null/null-graphics-device.js';
import { WebgpuBindGroupFormat } from '../../../../src/platform/graphics/webgpu/webgpu-bind-group-format.js';
import { WebgpuBindGroup } from '../../../../src/platform/graphics/webgpu/webgpu-bind-group.js';
import { WebgpuDynamicBuffers } from '../../../../src/platform/graphics/webgpu/webgpu-dynamic-buffers.js';
import { WebgpuGraphicsDevice } from '../../../../src/platform/graphics/webgpu/webgpu-graphics-device.js';
import { WebgpuShaderProcessorWGSL } from '../../../../src/platform/graphics/webgpu/webgpu-shader-processor-wgsl.js';
import { WebgpuShader } from '../../../../src/platform/graphics/webgpu/webgpu-shader.js';

describe('WebGPU context restoration', function () {
    it('rebuilds unchanged bind groups and layouts against the replacement device', function () {
        const device = new NullGraphicsDevice({ width: 1, height: 1 });
        const createDevice = () => ({
            createBindGroupLayout: sinon.spy(desc => ({ desc })),
            createBindGroup: sinon.spy(desc => ({ desc })),
            pushErrorScope() {},
            popErrorScope: () => Promise.resolve(null)
        });
        device.wgpu = createDevice();
        device._bindGroups = new Set();
        device._bindGroupFormats = new Set();
        device.createBindGroupFormatImpl = format => new WebgpuBindGroupFormat(format);
        device.createBindGroupImpl = bindGroup => new WebgpuBindGroup(bindGroup);
        const format = new BindGroupFormat(device, []);
        const bindGroup = new BindGroup(device, format);
        bindGroup.update();
        const oldGroup = bindGroup.impl.bindGroup;
        const oldLayout = format.impl.bindGroupLayout;

        expect(bindGroup.dirty).to.be.false;
        bindGroup.impl.loseContext();
        format.impl.loseContext();
        expect(bindGroup.dirty).to.be.true;
        expect(bindGroup.impl.bindGroup).to.equal(null);
        expect(format.impl.bindGroupLayout).to.equal(null);

        device.wgpu = createDevice();
        WebgpuGraphicsDevice.prototype.restoreContext.call(device);
        expect(bindGroup.impl.bindGroup).to.equal(null);
        expect(device.wgpu.createBindGroup.called).to.be.false;
        bindGroup.update();
        const newGroup = bindGroup.impl.bindGroup;
        expect(newGroup).not.to.equal(oldGroup);
        expect(newGroup.desc.layout).not.to.equal(oldLayout);
        expect(newGroup.desc.layout).to.equal(format.impl.bindGroupLayout);
        expect(bindGroup.impl.bindGroup).to.equal(newGroup);
        expect(device.wgpu.createBindGroup.calledOnce).to.be.true;
        expect(device.wgpu.createBindGroupLayout.calledOnce).to.be.true;
        expect(Object.getOwnPropertyDescriptor(bindGroup.impl, 'bindGroup').get).to.be.undefined;
        expect(Object.getOwnPropertyDescriptor(format.impl, 'bindGroupLayout').get).to.be.undefined;

        bindGroup.destroy();
        format.destroy();
        expect(device._bindGroups.size).to.equal(0);
        expect(device._bindGroupFormats.size).to.equal(0);
        WebgpuGraphicsDevice.prototype.restoreContext.call(device);
        expect(device.wgpu.createBindGroupLayout.calledOnce).to.be.true;
        device.destroy();
    });

    it('unregisters shader-generated layouts while leaving caller-owned layouts alive', function () {
        const device = new NullGraphicsDevice({ width: 1, height: 1 });
        device._bindGroupFormats = new Set();
        device.wgpu = { createBindGroupLayout: () => ({}) };
        device.createBindGroupFormatImpl = format => new WebgpuBindGroupFormat(format);
        const generated = new BindGroupFormat(device, []);
        const shared = new BindGroupFormat(device, []);
        const processor = sinon.stub(WebgpuShaderProcessorWGSL, 'run').returns({ meshBindGroupFormat: generated });
        try {
            const processedShader = { device, definition: { shaderLanguage: SHADERLANGUAGE_WGSL, processingOptions: {} } };
            const rawShader = { device, definition: { shaderLanguage: SHADERLANGUAGE_WGSL, meshBindGroupFormat: shared } };
            new WebgpuShader(processedShader).destroy(processedShader);
            new WebgpuShader(rawShader).destroy(rawShader);
            expect(device._bindGroupFormats.has(generated.impl)).to.be.false;
            expect(device._bindGroupFormats.has(shared.impl)).to.be.true;
        } finally {
            processor.restore();
            shared.destroy();
            device.destroy();
        }
    });

    it('releases active and unsubmitted dynamic allocations on destruction', function () {
        const device = {};
        const buffers = new WebgpuDynamicBuffers(device, 1024, 256);
        const gpuBuffer = { destroy: sinon.spy() };
        const stagingBuffer = { destroy: sinon.spy() };
        const pendingStagingBuffer = { destroy: sinon.spy() };
        buffers.activeBuffer = { gpuBuffer, stagingBuffer, offset: 0, size: 256 };
        buffers.pendingStagingBuffers.push(pendingStagingBuffer);

        buffers.destroy();

        for (const buffer of [gpuBuffer, stagingBuffer, pendingStagingBuffer]) {
            expect(buffer.destroy.calledOnceWithExactly(device)).to.be.true;
        }
        expect(buffers.activeBuffer).to.equal(null);
        expect(buffers.pendingStagingBuffers).to.have.lengthOf(0);
        expect(buffers.stagingBuffers).to.equal(null);
    });
});
