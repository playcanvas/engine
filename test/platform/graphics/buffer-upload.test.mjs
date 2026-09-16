import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { BufferUtils } from '../../../src/platform/graphics/buffer-utils.js';
import { BUFFER_STATIC, INDEXFORMAT_UINT16, SEMANTIC_POSITION, TYPE_FLOAT32 } from '../../../src/platform/graphics/constants.js';
import { IndexBuffer } from '../../../src/platform/graphics/index-buffer.js';
import { VertexBuffer } from '../../../src/platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../../src/platform/graphics/vertex-format.js';
import { VertexIterator } from '../../../src/platform/graphics/vertex-iterator.js';
import { WebglIndexBuffer } from '../../../src/platform/graphics/webgl/webgl-index-buffer.js';
import { WebglVertexBuffer } from '../../../src/platform/graphics/webgl/webgl-vertex-buffer.js';
import { WebgpuIndexBuffer } from '../../../src/platform/graphics/webgpu/webgpu-index-buffer.js';
import { WebgpuVertexBuffer } from '../../../src/platform/graphics/webgpu/webgpu-vertex-buffer.js';

// Emulate byte transfers so the tests check preservation of neighboring GPU data as well as ranges.
const createDevice = (backend) => {
    let boundBuffer;
    const device = {
        _vram: { vb: 0, ib: 0 },
        buffers: new Set(),
        isWebGPU: backend === 'WebGPU',
        createVertexBufferImpl: (buffer, format, options) => (backend === 'WebGPU' ?
            new WebgpuVertexBuffer(buffer, format, options) : new WebglVertexBuffer()),
        createIndexBufferImpl: (buffer, options) => (backend === 'WebGPU' ?
            new WebgpuIndexBuffer(buffer, options) : new WebglIndexBuffer(buffer)),
        gl: {
            createBuffer: sinon.spy(() => ({})),
            bindBuffer: (target, buffer) => {
                boundBuffer = buffer;
            },
            bufferData: sinon.spy((target, storage) => {
                const view = new Uint8Array(storage.buffer ?? storage, storage.byteOffset ?? 0, storage.byteLength);
                boundBuffer.data = new Uint8Array(view);
            }),
            bufferSubData: sinon.spy((target, offset, storage, srcOffset = 0, length = storage.byteLength) => {
                const view = new Uint8Array(storage.buffer ?? storage, (storage.byteOffset ?? 0) + srcOffset, length);
                boundBuffer.data.set(view, offset);
            })
        },
        wgpu: {
            createBuffer: sinon.spy(({ size }) => ({ size, data: new Uint8Array(size) })),
            queue: {
                writeBuffer: sinon.spy((buffer, offset, storage, srcOffset, length) => {
                    const view = new Uint8Array(storage.buffer ?? storage, (storage.byteOffset ?? 0) + srcOffset, length);
                    buffer.data.set(view, offset);
                })
            }
        }
    };
    return device;
};

describe('Buffer uploads', function () {
    let previousUsage;

    before(function () {
        previousUsage = globalThis.GPUBufferUsage;
        globalThis.GPUBufferUsage = { COPY_DST: 8, INDEX: 16, VERTEX: 32, UNIFORM: 64, STORAGE: 128 };
    });

    after(function () {
        if (previousUsage === undefined) {
            delete globalThis.GPUBufferUsage;
        } else {
            globalThis.GPUBufferUsage = previousUsage;
        }
    });

    ['WebGL', 'WebGPU'].forEach((backend) => {
        ['vertex', 'index'].forEach((kind) => {
            describe(`${backend} ${kind} buffer`, function () {
                let device;
                let buffer;

                const gpuData = () => (backend === 'WebGPU' ? buffer.impl.buffer : buffer.impl.bufferId)?.data;
                const upload = () => (backend === 'WebGPU' ? device.wgpu.queue.writeBuffer : device.gl.bufferSubData);
                const allocation = () => (backend === 'WebGPU' ? device.wgpu.createBuffer : device.gl.createBuffer);

                beforeEach(function () {
                    device = createDevice(backend);
                    buffer = kind === 'vertex' ?
                        new VertexBuffer(device, new VertexFormat(device, [
                            { semantic: SEMANTIC_POSITION, components: 1, type: TYPE_FLOAT32 }
                        ]), 4) :
                        new IndexBuffer(device, INDEXFORMAT_UINT16, 8, BUFFER_STATIC);
                });

                afterEach(function () {
                    sinon.restore();
                });

                it('initializes the full allocation even when the first upload requests a range', function () {
                    const data = BufferUtils.createStorageView(buffer, Uint8Array);
                    data.fill(7);
                    buffer.unlock(4, 4);

                    expect(Array.from(gpuData())).to.deep.equal(Array(16).fill(7));
                    expect(allocation().callCount).to.equal(1);
                    expect(buffer.numBytes).to.equal(16);
                });

                it('updates only the requested GPU range while CPU reads retain all edits', function () {
                    buffer.unlock();
                    const data = BufferUtils.createStorageView(buffer, Uint8Array);
                    data.fill(9);
                    buffer.unlock(4, 4);

                    expect(Array.from(gpuData())).to.deep.equal([0, 0, 0, 0, 9, 9, 9, 9, 0, 0, 0, 0, 0, 0, 0, 0]);
                    expect(allocation().callCount).to.equal(1);
                    expect(buffer.lock()).to.equal(data.buffer);
                    expect(buffer.numBytes).to.equal(16);
                    const read = [];
                    if (kind === 'vertex') {
                        expect(new VertexIterator(buffer).readData(SEMANTIC_POSITION, read)).to.equal(4);
                        expect(read).to.deep.equal(Array.from(new Float32Array(data.buffer)));
                    } else {
                        expect(buffer.readData(read)).to.equal(8);
                        expect(read).to.deep.equal(Array.from(new Uint16Array(data.buffer)));
                    }
                });

                it('defaults the range length to the remaining bytes', function () {
                    buffer.unlock();
                    BufferUtils.createStorageView(buffer, Uint8Array).fill(3);
                    buffer.unlock(4);

                    expect(Array.from(gpuData())).to.deep.equal([0, 0, 0, 0, ...Array(12).fill(3)]);
                });

                it('does nothing for zero length, even before GPU allocation', function () {
                    buffer.unlock(0, 0);
                    expect(allocation().callCount).to.equal(0);
                    expect(upload().callCount).to.equal(0);
                    buffer.unlock();
                    upload().resetHistory();
                    buffer.unlock(16, 0);
                    expect(upload().callCount).to.equal(0);
                });

                it('honors typed storage view offsets and refreshes cached views after setData', function () {
                    const first = new Uint16Array(new ArrayBuffer(40), 6, 8);
                    first.fill(1);
                    buffer.setData(first);
                    first.fill(2);
                    buffer.unlock(4, 4);
                    buffer.unlock(8, 4);
                    if (backend === 'WebGL') {
                        expect(upload().lastCall.args[2]).to.equal(upload().getCall(0).args[2]);
                    } else {
                        expect(upload().lastCall.args[2]).to.equal(first.buffer);
                    }

                    // The same backing buffer with a different view offset must also refresh the cache.
                    const second = new Uint16Array(first.buffer, 8, 8);
                    second.fill(3);
                    buffer.setData(second);
                    second.fill(4);
                    buffer.unlock(4, 4);
                    const expected = new Uint8Array(16);
                    expected.set(new Uint8Array(new Uint16Array(8).fill(3).buffer));
                    expected.set(new Uint8Array(second.buffer, second.byteOffset + 4, 4), 4);
                    expect(Array.from(gpuData())).to.deep.equal(Array.from(expected));
                    expect(buffer.lock()).to.equal(second);
                });

                it('restores the full CPU storage after context loss', function () {
                    buffer.unlock();
                    BufferUtils.createStorageView(buffer, Uint8Array).fill(5);
                    buffer.unlock(4, 4);
                    buffer.loseContext();
                    buffer.restoreContext();

                    expect(allocation().callCount).to.equal(2);
                    expect(Array.from(gpuData())).to.deep.equal(Array(16).fill(5));
                });

                it('asserts invalid ranges and skips GPU allocation even with assertions disabled', function () {
                    const assertion = sinon.stub(Debug, 'assert');
                    const invalid = [[2, 4], [0, 2], [4, 6], [-4, 4], [0, -4], [0.5, 4], [0, 4.5], [12, 8], [20, 0], [NaN, 4], [0, Infinity]];
                    invalid.forEach(([offset, length]) => {
                        assertion.resetHistory();
                        buffer.unlock(offset, length);
                        expect(assertion.getCalls().some(call => !call.args[0]), `${offset}, ${length}`).to.equal(true);
                    });
                    expect(allocation().callCount).to.equal(0);
                    expect(upload().callCount).to.equal(0);
                    assertion.resetHistory();
                    buffer.unlock(4, 8);
                    expect(allocation().callCount).to.equal(1);
                    expect(assertion.getCalls().every(call => call.args[0])).to.equal(true);
                });

                it('leaves all GPU bytes unchanged after an invalid partial upload with assertions disabled', function () {
                    const data = BufferUtils.createStorageView(buffer, Uint8Array);
                    data.fill(0xaa);
                    buffer.unlock();
                    data.fill(0x11, 4, 10);
                    upload().resetHistory();
                    sinon.stub(Debug, 'assert');
                    buffer.unlock(4, 6);

                    expect(upload().callCount).to.equal(0);
                    expect(allocation().callCount).to.equal(1);
                    expect(Array.from(gpuData())).to.deep.equal(Array(16).fill(0xaa));
                });

                if (kind === 'index') {
                    [[], [0], [0, 6]].forEach((args) => {
                        it(`uploads an odd-sized full buffer with unlock(${args.join(', ')}) on first and subsequent calls`, function () {
                            buffer = new IndexBuffer(device, INDEXFORMAT_UINT16, 3, BUFFER_STATIC);
                            const data = BufferUtils.createStorageView(buffer, Uint16Array);
                            const assertion = sinon.stub(Debug, 'assert');
                            data.set([1, 2, 3]);
                            buffer.unlock(...args);

                            expect(allocation().callCount).to.equal(1);
                            expect(Array.from(gpuData().subarray(0, 6))).to.deep.equal([1, 0, 2, 0, 3, 0]);
                            data.set([4, 5, 6]);
                            buffer.unlock(...args);
                            expect(allocation().callCount).to.equal(1);
                            expect(Array.from(gpuData().subarray(0, 6))).to.deep.equal([4, 0, 5, 0, 6, 0]);
                            expect(assertion.getCalls().every(call => call.args[0])).to.equal(true);
                            if (backend === 'WebGPU') {
                                expect(Array.from(gpuData().subarray(6))).to.deep.equal([0, 0]);
                            }
                        });
                    });

                    it('still rejects unaligned partial ranges in an odd-sized buffer', function () {
                        buffer = new IndexBuffer(device, INDEXFORMAT_UINT16, 3, BUFFER_STATIC);
                        const assertion = sinon.stub(Debug, 'assert');
                        const invalid = [[0, 2], [2, 4], [4, 2]];
                        invalid.forEach((args) => {
                            assertion.resetHistory();
                            buffer.unlock(...args);
                            expect(assertion.getCalls().some(call => !call.args[0])).to.equal(true);
                        });
                        expect(allocation().callCount).to.equal(0);
                        expect(upload().callCount).to.equal(0);

                        BufferUtils.createStorageView(buffer, Uint8Array).fill(0xaa);
                        buffer.unlock(0, 6);
                        BufferUtils.createStorageView(buffer, Uint8Array).fill(0x11);
                        upload().resetHistory();
                        invalid.forEach(args => buffer.unlock(...args));
                        expect(upload().callCount).to.equal(0);
                        expect(Array.from(gpuData().subarray(0, 6))).to.deep.equal(Array(6).fill(0xaa));
                    });

                    it('preserves full uploads of odd index counts, including first partial upload', function () {
                        buffer = new IndexBuffer(device, INDEXFORMAT_UINT16, 3, BUFFER_STATIC);
                        const data = BufferUtils.createStorageView(buffer, Uint16Array);
                        data.set([1, 2, 3]);
                        buffer.unlock(0, 4);
                        expect(Array.from(gpuData().subarray(0, 6))).to.deep.equal([1, 0, 2, 0, 3, 0]);
                        data.set([4, 5, 6]);
                        buffer.unlock();
                        expect(Array.from(gpuData().subarray(0, 6))).to.deep.equal([4, 0, 5, 0, 6, 0]);
                        if (backend === 'WebGPU') {
                            expect(Array.from(gpuData().subarray(6))).to.deep.equal([0, 0]);
                        }
                    });
                }
            });
        });
    });
});
