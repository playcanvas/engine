import { expect } from 'chai';

import { BindTextureFormat } from '../../../../src/platform/graphics/bind-group-format.js';
import {
    SAMPLETYPE_DEPTH, SAMPLETYPE_UNFILTERABLE_FLOAT, SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D
} from '../../../../src/platform/graphics/constants.js';
import { WebgpuBindGroupFormat } from '../../../../src/platform/graphics/webgpu/webgpu-bind-group-format.js';

// createDescriptor uses WebgpuUtils.shaderStage, which reads the WebGPU GPUShaderStage global.
// The headless test runner has no GPUDevice; stub the enum with the spec values.
if (typeof globalThis.GPUShaderStage === 'undefined') {
    globalThis.GPUShaderStage = {
        VERTEX: 0x1,
        FRAGMENT: 0x2,
        COMPUTE: 0x4
    };
}

const createDescriptor = (textureFormat) => {
    textureFormat.slot = 0;
    return WebgpuBindGroupFormat.prototype.createDescriptor({
        uniformBufferFormats: [],
        textureFormats: [textureFormat],
        storageTextureFormats: [],
        storageBufferFormats: []
    });
};

describe('WebgpuBindGroupFormat#createDescriptor', function () {

    it('emits multisampled false and a sampler entry by default', function () {
        const format = new BindTextureFormat('diffuse', SHADERSTAGE_FRAGMENT);
        const { key, desc } = createDescriptor(format);

        expect(desc.entries).to.have.lengthOf(2);
        expect(desc.entries[0].texture.multisampled).to.equal(false);
        expect(desc.entries[0].texture.sampleType).to.equal('float');
        expect(desc.entries[0].texture.viewDimension).to.equal(TEXTUREDIMENSION_2D);
        expect(desc.entries[1].sampler).to.not.equal(undefined);
        expect(key).to.contain('-false');
        expect(key).to.match(/S:/);
    });

    it('emits multisampled true and no sampler entry for a multisampled texture', function () {
        const format = new BindTextureFormat(
            'msColor',
            SHADERSTAGE_FRAGMENT,
            TEXTUREDIMENSION_2D,
            SAMPLETYPE_UNFILTERABLE_FLOAT,
            false,
            null,
            true
        );
        const { key, desc } = createDescriptor(format);

        expect(desc.entries).to.have.lengthOf(1);
        expect(desc.entries[0].binding).to.equal(0);
        expect(desc.entries[0].visibility).to.equal(GPUShaderStage.FRAGMENT);
        expect(desc.entries[0].texture.multisampled).to.equal(true);
        expect(desc.entries[0].texture.sampleType).to.equal('unfilterable-float');
        expect(desc.entries[0].texture.viewDimension).to.equal(TEXTUREDIMENSION_2D);
        expect(key).to.contain(`#0T:${GPUShaderStage.FRAGMENT}-unfilterable-float-${TEXTUREDIMENSION_2D}-true`);
        expect(key).to.not.match(/S:/);
    });

    it('includes the multisampled flag in the pipeline-cache key', function () {
        const sampled = new BindTextureFormat('color', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT, false);
        const multisampled = new BindTextureFormat('msColor', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT, false, null, true);

        const sampledKey = createDescriptor(sampled).key;
        const multisampledKey = createDescriptor(multisampled).key;

        expect(sampledKey).to.not.equal(multisampledKey);
        expect(sampledKey).to.contain(`#0T:${GPUShaderStage.FRAGMENT}-unfilterable-float-${TEXTUREDIMENSION_2D}-false`);
        expect(multisampledKey).to.contain(`#0T:${GPUShaderStage.FRAGMENT}-unfilterable-float-${TEXTUREDIMENSION_2D}-true`);
    });

    it('emits a depth multisampled entry with no sampler', function () {
        const format = new BindTextureFormat(
            'msDepth',
            SHADERSTAGE_FRAGMENT,
            TEXTUREDIMENSION_2D,
            SAMPLETYPE_DEPTH,
            false,
            null,
            true
        );
        const { key, desc } = createDescriptor(format);

        expect(desc.entries).to.have.lengthOf(1);
        expect(desc.entries[0].texture.multisampled).to.equal(true);
        expect(desc.entries[0].texture.sampleType).to.equal('depth');
        expect(key).to.contain(`#0T:${GPUShaderStage.FRAGMENT}-depth-${TEXTUREDIMENSION_2D}-true`);
        expect(key).to.not.match(/S:/);
    });
});
