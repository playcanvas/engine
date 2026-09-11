import { expect } from 'chai';

import { INDEXFORMAT_UINT16, SEMANTIC_POSITION, TYPE_FLOAT32, UNIFORMTYPE_VEC4 } from '../../../src/platform/graphics/constants.js';
import { DynamicBufferAllocation, DynamicBuffers } from '../../../src/platform/graphics/dynamic-buffers.js';
import { IndexBuffer } from '../../../src/platform/graphics/index-buffer.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { UniformBufferFormat, UniformFormat } from '../../../src/platform/graphics/uniform-buffer-format.js';
import { UniformBuffer } from '../../../src/platform/graphics/uniform-buffer.js';
import { VertexBuffer } from '../../../src/platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../../src/platform/graphics/vertex-format.js';
import { WebglDynamicBuffers } from '../../../src/platform/graphics/webgl/webgl-dynamic-buffers.js';
import { WebgpuGraphicsDevice } from '../../../src/platform/graphics/webgpu/webgpu-graphics-device.js';

describe('Tracked resource counts', function () {
    it('reflects allocation and destruction in the existing registries', function () {
        const device = new NullGraphicsDevice({ width: 16, height: 16 });
        const counts = new Map();
        device.getResourceCounts(counts);
        const before = new Map(counts);
        const resources = [
            new VertexBuffer(device, new VertexFormat(device, [{ semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 }]), 3),
            new IndexBuffer(device, INDEXFORMAT_UINT16, 3),
            new UniformBuffer(device, new UniformBufferFormat(device, [new UniformFormat('value', UNIFORMTYPE_VEC4)]))
        ];
        device.getResourceCounts(counts);
        for (const key of ['vertexBuffers', 'indexBuffers', 'uniformBuffers']) {
            expect(counts.get(key)).to.equal(before.get(key) + 1);
        }
        for (const resource of resources) resource.destroy();
        device.getResourceCounts(counts);
        expect(counts).to.deep.equal(before);
        device.destroy();
    });

    it('counts WebGPU backing uniform buffers across pool states, excluding staging buffers', function () {
        const buffers = new DynamicBuffers(null, 1024, 256);
        buffers.gpuBuffers.push({}, {});
        buffers.stagingBuffers.push({}, {}, {});
        expect(buffers.bufferCount).to.equal(2);
        buffers.activeBuffer = { gpuBuffer: buffers.gpuBuffers.pop() };
        expect(buffers.bufferCount).to.equal(2);
        buffers.scheduleSubmit();
        expect(buffers.bufferCount).to.equal(2);
        buffers.gpuBuffers.push(buffers.usedBuffers.pop().gpuBuffer);
        expect(buffers.bufferCount).to.equal(2);
    });

    it('counts WebGL pooled uniform buffers once as they are allocated and returned', function () {
        const device = new NullGraphicsDevice({ width: 16, height: 16 });
        const buffers = new WebglDynamicBuffers(device);
        const first = new DynamicBufferAllocation();
        const second = new DynamicBufferAllocation();
        buffers.alloc(first, 16);
        buffers.alloc(second, 32);
        expect(buffers.bufferCount).to.equal(2);
        buffers.onFrameEnd();
        expect(buffers.bufferCount).to.equal(2);
        buffers.alloc(first, 16);
        expect(buffers.bufferCount).to.equal(2);
        buffers.onFrameEnd();
        buffers.destroy();
        expect(buffers.bufferCount).to.equal(0);
        device.destroy();
    });

    it('counts pipelines within collision buckets and reads cleared or replaced caches', function () {
        const device = {
            buffers: new Set(),
            textures: new Set(),
            targets: new Set(),
            _bindGroups: new Set([{}]),
            _bindGroupFormats: new Set([{}, {}]),
            _computes: new Set(),
            _drawCommands: new Set([{}]),
            renderPipeline: { cache: new Map([[1, [{}, {}]], [2, [{}]]]) },
            computePipeline: { cache: new Map([[1, [{}, {}]]]) }
        };
        const counts = new Map();
        WebgpuGraphicsDevice.prototype.getResourceCounts.call(device, counts);
        expect(counts.get('renderPipelines')).to.equal(3);
        expect(counts.get('computePipelines')).to.equal(2);
        expect(counts.get('bindGroups')).to.equal(1);
        expect(counts.get('bindGroupFormats')).to.equal(2);
        expect(counts.get('computes')).to.equal(0);
        expect(counts.get('drawCommands')).to.equal(1);
        device.renderPipeline.cache.clear();
        device.computePipeline.cache = new Map();
        device._bindGroups.clear();
        WebgpuGraphicsDevice.prototype.getResourceCounts.call(device, counts);
        expect(counts.get('renderPipelines')).to.equal(0);
        expect(counts.get('computePipelines')).to.equal(0);
        expect(counts.get('bindGroups')).to.equal(0);
    });
});
