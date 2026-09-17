import { expect } from 'chai';

import { PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA16U } from '../../../../src/platform/graphics/constants.js';
import { WebgpuTexture } from '../../../../src/platform/graphics/webgpu/webgpu-texture.js';

// WebgpuTexture reads the WebGPU GPUTextureUsage global. The headless test runner has no
// GPUDevice; stub the enum with the spec values.
if (typeof globalThis.GPUTextureUsage === 'undefined') {
    globalThis.GPUTextureUsage = {
        COPY_SRC: 0x01,
        COPY_DST: 0x02,
        TEXTURE_BINDING: 0x04,
        STORAGE_BINDING: 0x08,
        RENDER_ATTACHMENT: 0x10,
        TRANSIENT_ATTACHMENT: 0x20
    };
}

// minimal mock of a WebGPU device - createTexture captures descriptors, and the error scope
// functions satisfy WebgpuDebug.validate / WebgpuDebug.end
const createMockDevice = (created) => {
    return {
        wgpu: {
            createTexture(desc) {
                created.push(desc);
                return {
                    createView() {
                        return {};
                    }
                };
            },
            pushErrorScope() {},
            popErrorScope() {
                return Promise.resolve(null);
            }
        }
    };
};

const createMockTexture = (device, overrides = {}) => {
    return {
        name: 'tex',
        format: PIXELFORMAT_RGBA16F,
        width: 8,
        height: 8,
        cubemap: false,
        volume: false,
        array: false,
        arrayLength: 0,
        storage: false,
        numLevels: 1,
        samples: 1,
        device,
        ...overrides
    };
};

describe('WebgpuTexture', function () {

    it('creates a single-sampled texture by default', function () {
        const created = [];
        const device = createMockDevice(created);
        const impl = new WebgpuTexture(createMockTexture(device));

        expect(created).to.have.lengthOf(1);
        expect(created[0].sampleCount).to.equal(1);
        expect(impl.gpuTexture).to.not.equal(null);
    });

    it('creates a multisampled texture with the expected descriptor', function () {
        const created = [];
        const device = createMockDevice(created);
        const impl = new WebgpuTexture(createMockTexture(device, { name: 'msColor', samples: 4 }));

        expect(created).to.have.lengthOf(1);
        expect(impl.gpuTexture).to.not.equal(null);
        const desc = created[0];
        expect(desc.sampleCount).to.equal(4);
        expect(desc.mipLevelCount).to.equal(1);
        expect(desc.dimension).to.equal('2d');
        expect(desc.size).to.deep.equal({ width: 8, height: 8, depthOrArrayLayers: 1 });

        // RENDER_ATTACHMENT is required for multisampled textures, TEXTURE_BINDING and COPY_*
        // are allowed, STORAGE_BINDING is forbidden
        expect(desc.usage & GPUTextureUsage.RENDER_ATTACHMENT).to.not.equal(0);
        expect(desc.usage & GPUTextureUsage.TEXTURE_BINDING).to.not.equal(0);
        expect(desc.usage & GPUTextureUsage.COPY_SRC).to.not.equal(0);
        expect(desc.usage & GPUTextureUsage.COPY_DST).to.not.equal(0);
        expect(desc.usage & GPUTextureUsage.STORAGE_BINDING).to.equal(0);
    });

    it('creates a multisampled integer texture', function () {
        const created = [];
        const device = createMockDevice(created);
        const impl = new WebgpuTexture(createMockTexture(device, { name: 'msId', format: PIXELFORMAT_RGBA16U, samples: 4 }));

        expect(created).to.have.lengthOf(1);
        expect(impl.gpuTexture).to.not.equal(null);
        expect(created[0].format).to.equal('rgba16uint');
        expect(created[0].sampleCount).to.equal(4);
    });
});
