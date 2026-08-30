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

    describe('sample_mask builtin', function () {

        it('adds the sample_mask output when the shader assigns it', function () {
            const source = `
                output.color = vec4f(1.0);
                output.sampleMask = 0x1u;
            `;
            const result = WebgpuShaderProcessorWGSL.generateFragmentOutputStruct(source, 1);
            expect(result).to.contain('@builtin(sample_mask) sampleMask : u32');
        });

        it('does not add the sample_mask output for a comparison', function () {
            const source = `
                output.color = select(vec4f(0.0), vec4f(1.0), input.sampleMask == 3u);
            `;
            const result = WebgpuShaderProcessorWGSL.generateFragmentOutputStruct(source, 1);
            expect(result).to.not.contain('sample_mask');
        });

        it('combines fragDepth and sample_mask outputs', function () {
            const source = `
                output.color = vec4f(1.0);
                output.fragDepth = 0.5;
                output.sampleMask = 0x3u;
            `;
            const result = WebgpuShaderProcessorWGSL.generateFragmentOutputStruct(source, 1);
            expect(result).to.contain('@builtin(frag_depth) fragDepth : f32,');
            expect(result).to.contain('@builtin(sample_mask) sampleMask : u32,');
        });

        it('adds the sample_mask fragment input when read through the input struct', function () {
            const source = 'let coverage = input.sampleMask;';
            const result = WebgpuShaderProcessorWGSL.processVaryings([], new Map(), false, {}, source, 'input');
            expect(result).to.contain('@builtin(sample_mask) sampleMask : u32');
            expect(result).to.contain('var<private> pcSampleMask: u32');
            expect(result).to.contain('pcSampleMask = input.sampleMask;');
        });

        it('adds the sample_mask fragment input when read through the private global', function () {
            const source = 'let coverage = pcSampleMask;';
            const result = WebgpuShaderProcessorWGSL.processVaryings([], new Map(), false, {}, source, 'input');
            expect(result).to.contain('@builtin(sample_mask) sampleMask : u32');
        });

        it('does not add the sample_mask fragment input when unused', function () {
            const source = 'let x = pcPosition.xy;';
            const result = WebgpuShaderProcessorWGSL.processVaryings([], new Map(), false, {}, source, 'input');
            expect(result).to.not.contain('sample_mask');
        });
    });
});
