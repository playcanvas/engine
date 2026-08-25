import { expect } from 'chai';

import { Preprocessor } from '../../../../src/core/preprocessor.js';
import webgpuDepthResolve from '../../../../src/platform/graphics/shader-chunks/frag/webgpu-depth-resolve.js';

// mirrors how WebgpuResolver#getShader builds the shader source for a resolve mode, and how the
// Shader class preprocesses WGSL (stripDefines: true)
const process = (mode) => {
    const code = `#define DEPTH_RESOLVE_${mode.toUpperCase()}\n${webgpuDepthResolve}`;
    return Preprocessor.run(code, new Map(), { stripDefines: true });
};

describe('WebgpuResolver depth resolve shader chunk', function () {

    it('loads only sample 0 for the sample0 mode', function () {
        const code = process('sample0');
        expect(code).to.contain('textureLoad(img, coord, 0u)');
        expect(code).to.not.contain('textureNumSamples');
        expect(code).to.not.contain('#');
    });

    it('reduces all samples with min for the min mode', function () {
        const code = process('min');
        expect(code).to.contain('textureNumSamples(img)');
        expect(code).to.contain('min(depth, textureLoad(img, coord, i))');
        expect(code).to.not.contain('max(depth');
        expect(code).to.not.contain('#');
    });

    it('reduces all samples with max for the max mode', function () {
        const code = process('max');
        expect(code).to.contain('textureNumSamples(img)');
        expect(code).to.contain('max(depth, textureLoad(img, coord, i))');
        expect(code).to.not.contain('min(depth');
        expect(code).to.not.contain('#');
    });
});
