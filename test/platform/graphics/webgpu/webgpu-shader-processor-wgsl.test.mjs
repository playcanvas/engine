import { expect } from 'chai';

import { WebgpuShaderProcessorWGSL } from '../../../../src/platform/graphics/webgpu/webgpu-shader-processor-wgsl.js';

describe('WebgpuShaderProcessorWGSL', function () {

    it('inserts generated declarations after WGSL directives', function () {
        const source = `enable dual_source_blending;
@fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    return output;
}`;

        const extracted = WebgpuShaderProcessorWGSL.extract(source);
        expect(extracted.src.indexOf('enable dual_source_blending;')).to.be.lessThan(extracted.src.indexOf('@@@'));
        expect(extracted.src.indexOf('@@@')).to.be.lessThan(extracted.src.indexOf('@fragment'));
    });

    it('generates dual-source fragment outputs', function () {
        const source = `
            output.color = vec4f(1.0);
            output.colorSecondary = vec4f(0.5);
        `;
        const result = WebgpuShaderProcessorWGSL.generateFragmentOutputStruct(source, 8, true);

        expect(result).to.contain('@location(0) @blend_src(0) color : pcOutType0');
        expect(result).to.contain('@location(0) @blend_src(1) colorSecondary : pcOutType0');
        expect(result).to.not.contain('@location(1)');
    });
});
