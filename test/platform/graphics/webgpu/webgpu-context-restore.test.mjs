import { expect } from 'chai';
import sinon from 'sinon';

import { BindGroupFormat } from '../../../../src/platform/graphics/bind-group-format.js';
import { BindGroup } from '../../../../src/platform/graphics/bind-group.js';
import { Compute } from '../../../../src/platform/graphics/compute.js';
import { SHADERLANGUAGE_WGSL } from '../../../../src/platform/graphics/constants.js';
import { GpuProfiler } from '../../../../src/platform/graphics/gpu-profiler.js';
import { NullGraphicsDevice } from '../../../../src/platform/graphics/null/null-graphics-device.js';
import { WebgpuBindGroupFormat } from '../../../../src/platform/graphics/webgpu/webgpu-bind-group-format.js';
import { WebgpuBindGroup } from '../../../../src/platform/graphics/webgpu/webgpu-bind-group.js';
import { WebgpuComputePipeline } from '../../../../src/platform/graphics/webgpu/webgpu-compute-pipeline.js';
import { WebgpuCompute } from '../../../../src/platform/graphics/webgpu/webgpu-compute.js';
import { WebgpuDynamicBuffers } from '../../../../src/platform/graphics/webgpu/webgpu-dynamic-buffers.js';
import { WebgpuGraphicsDevice } from '../../../../src/platform/graphics/webgpu/webgpu-graphics-device.js';
import { WebgpuShaderProcessorWGSL } from '../../../../src/platform/graphics/webgpu/webgpu-shader-processor-wgsl.js';
import { WebgpuShader } from '../../../../src/platform/graphics/webgpu/webgpu-shader.js';

describe('WebGPU context restoration', function () {
    it('stops rendering before debug destruction detaches mapped buffers', function () {
        const device = {
            contextLost: false,
            wgpu: { destroy: sinon.spy(() => expect(device.contextLost).to.be.true) }
        };
        WebgpuGraphicsDevice.prototype.debugLoseContext.call(device, 100);
        expect(device.wgpu.destroy.calledOnce).to.be.true;
        WebgpuGraphicsDevice.prototype.debugLoseContext.call(device, 100);
        expect(device.wgpu.destroy.calledOnce).to.be.true;
    });

    it('restores shared compute pipelines before dispatch and unregisters destroyed computes', function () {
        const device = new NullGraphicsDevice({ width: 1, height: 1 });
        const createDevice = () => ({
            createBindGroupLayout: desc => ({ desc }),
            createPipelineLayout: desc => ({ desc }),
            createComputePipeline: sinon.spy(desc => ({ desc })),
            pushErrorScope() {},
            popErrorScope: () => Promise.resolve(null)
        });
        device.wgpu = createDevice();
        device.supportsCompute = true;
        device._bindGroups = new Set();
        device._bindGroupFormats = new Set();
        device._computes = new Set();
        device.commandBuffers = [];
        device.bindGroupFormats = [];
        device._deferredDestroys = [];
        device.renderPipeline = { cache: new Map() };
        device.computePipeline = new WebgpuComputePipeline(device);
        device.destroyDeviceResources = () => {};
        device.createBindGroupFormatImpl = format => new WebgpuBindGroupFormat(format);
        device.createBindGroupImpl = bindGroup => new WebgpuBindGroup(bindGroup);
        device.createComputeImpl = compute => new WebgpuCompute(compute);
        const format = new BindGroupFormat(device, []);
        const shader = { impl: {
            computeBindGroupFormat: format,
            computeKey: 1,
            getComputeShaderModule: () => ({}),
            computeEntryPoint: 'main'
        } };
        const first = new Compute(device, shader);
        const second = new Compute(device, shader);
        const oldPipeline = first.impl.pipeline;
        expect(second.impl.pipeline).to.equal(oldPipeline);
        expect(device.wgpu.createComputePipeline.calledOnce).to.be.true;

        for (let cycle = 0; cycle < 2; cycle++) {
            WebgpuGraphicsDevice.prototype.loseContext.call(device);
            expect(first.impl.pipeline).to.equal(null);
            expect(second.impl.pipeline).to.equal(null);
            device.wgpu = createDevice();
            WebgpuGraphicsDevice.prototype.restoreContext.call(device);
            expect(first.impl.pipeline).not.to.equal(oldPipeline);
            expect(second.impl.pipeline).to.equal(first.impl.pipeline);
            expect(first.impl.pipeline.desc.layout.desc.bindGroupLayouts[0]).to.equal(format.impl.bindGroupLayout);
            expect(device.wgpu.createComputePipeline.calledOnce).to.be.true;
            device.passEncoder = { setPipeline: sinon.spy(), dispatchWorkgroups() {} };
            first.impl.dispatch(1, 1, 1);
            expect(device.passEncoder.setPipeline.calledOnceWithExactly(first.impl.pipeline)).to.be.true;
        }

        first.destroy();
        second.destroy();
        expect(device._computes.size).to.equal(0);
        format.destroy();
        device.destroy();
    });

    for (const enabled of [true, false]) {
        it(`preserves the requested profiler enabled state (${enabled}) on recovery`, async function () {
            const device = {
                gpuProfiler: new GpuProfiler(),
                loseContext() {
                    this.gpuProfiler = null;
                },
                createDevice() {
                    this.gpuProfiler = new GpuProfiler();
                    return Promise.resolve();
                },
                restoreContext() {},
                fire(event) {
                    if (event === 'devicerestored') {
                        expect(this.gpuProfiler.enabled).to.equal(enabled);
                    }
                }
            };
            device.gpuProfiler.enabled = enabled;
            // The pending enable request must survive even before the next frame applies it.
            expect(device.gpuProfiler._enabled).to.be.false;
            await WebgpuGraphicsDevice.prototype.handleDeviceLost.call(device, { reason: 'unknown', message: 'test loss' });
            expect(device.gpuProfiler.enabled).to.equal(enabled);
        });
    }

    it('clears cached timestamp writes when profiling cannot assign a query', function () {
        const profiler = new GpuProfiler();
        profiler.timestampQueriesSet = { querySet: {} };
        profiler.enabled = true;
        profiler.processEnableRequest();
        const device = { gpuProfiler: profiler };
        const setup = descriptor => WebgpuGraphicsDevice.prototype.setupTimeStampWrites.call(device, descriptor, 'test pass');
        const descriptor = setup(undefined);
        expect(descriptor.timestampWrites.querySet).to.equal(profiler.timestampQueriesSet.querySet);

        profiler.enabled = false;
        profiler.processEnableRequest();
        expect(setup(descriptor)).to.equal(descriptor);
        expect(descriptor.timestampWrites).to.be.undefined;
        expect(setup(undefined)).to.be.undefined;

        profiler.enabled = true;
        profiler.processEnableRequest();
        const replacement = { querySet: {} };
        profiler.timestampQueriesSet = replacement;
        setup(descriptor);
        expect(descriptor.timestampWrites.querySet).to.equal(replacement.querySet);

        profiler.timestampQueriesSet = null;
        setup(descriptor);
        expect(descriptor.timestampWrites).to.be.undefined;

        profiler.timestampQueriesSet = replacement;
        setup(descriptor);
        profiler.maxCount = profiler.slotCount;
        setup(descriptor);
        expect(descriptor.timestampWrites).to.be.undefined;
    });

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
        device._computes = new Set();
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
