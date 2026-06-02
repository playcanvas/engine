import { expect } from 'chai';

import {
    SHADERSTAGE_COMPUTE,
    SAMPLETYPE_FLOAT, SAMPLETYPE_UNFILTERABLE_FLOAT
} from '../../../../src/platform/graphics/constants.js';
import { ScopeSpace } from '../../../../src/platform/graphics/scope-space.js';
import { WebgpuShaderProcessorWGSL } from '../../../../src/platform/graphics/webgpu/webgpu-shader-processor-wgsl.js';

// Minimal device mock - BindGroupFormat / UniformBufferFormat only need scope.resolve and
// createBindGroupFormatImpl. A real WebGPU device is not available in the headless test runner.
function createMockDevice() {
    let implKey = 0;
    return {
        scope: new ScopeSpace('test'),
        createBindGroupFormatImpl() {
            return { key: implKey++, destroy() {} };
        }
    };
}

function run(source, reflectedGroupIndex = 1) {
    const device = createMockDevice();
    const shader = { failed: false, name: 'test' };
    const result = WebgpuShaderProcessorWGSL.runCompute(device, source, {}, shader, reflectedGroupIndex);
    return { result, shader };
}

describe('WebgpuShaderProcessorWGSL - compute reflection', function () {

    it('reflects a read_write storage buffer (regex fix)', function () {
        const src = `
            var<storage, read_write> outBuf: array<u32>;
            @compute @workgroup_size(1) fn main() { outBuf[0] = 1u; }
        `;
        const { result, shader } = run(src);
        expect(shader.failed).to.equal(false);

        const fmt = result.computeBindGroupFormat;
        expect(fmt.storageBufferFormats).to.have.lengthOf(1);
        const sb = fmt.storageBufferFormats[0];
        expect(sb.name).to.equal('outBuf');
        expect(sb.readOnly).to.equal(false);
        expect(sb.visibility).to.equal(SHADERSTAGE_COMPUTE);
        expect(sb.slot).to.equal(0);
        expect(result.computeUniformBufferFormat).to.equal(null);

        expect(result.cshader).to.contain('@group(1) @binding(0) var<storage, read_write> outBuf : array<u32>;');
        // original simplified declaration removed
        expect(result.cshader).to.not.match(/^\s*var<storage, read_write> outBuf: array<u32>;/m);
    });

    it('reflects a read-only storage buffer', function () {
        const src = `
            var<storage, read> inBuf: array<u32>;
            @compute @workgroup_size(1) fn main() { let x = inBuf[0]; }
        `;
        const { result } = run(src);
        const sb = result.computeBindGroupFormat.storageBufferFormats[0];
        expect(sb.readOnly).to.equal(true);
        expect(result.cshader).to.contain('@group(1) @binding(0) var<storage, read> inBuf : array<u32>;');
    });

    it('reflects a texture and its sampler (two slots)', function () {
        const src = `
            var srcTex: texture_2d<f32>;
            var srcTexSampler: sampler;
            @compute @workgroup_size(1) fn main() { }
        `;
        const { result } = run(src);
        const fmt = result.computeBindGroupFormat;
        expect(fmt.textureFormats).to.have.lengthOf(1);
        const tf = fmt.textureFormats[0];
        expect(tf.name).to.equal('srcTex');
        expect(tf.hasSampler).to.equal(true);
        expect(tf.sampleType).to.equal(SAMPLETYPE_FLOAT);
        expect(tf.slot).to.equal(0);

        expect(result.cshader).to.contain('@group(1) @binding(0) var srcTex: texture_2d<f32>;');
        expect(result.cshader).to.contain('@group(1) @binding(1) var srcTexSampler: sampler;');
    });

    it('detects unfilterable-float (uff) textures', function () {
        const src = `
            var dataTex: texture_2d<uff>;
            @compute @workgroup_size(1) fn main() { }
        `;
        const { result } = run(src);
        const tf = result.computeBindGroupFormat.textureFormats[0];
        expect(tf.sampleType).to.equal(SAMPLETYPE_UNFILTERABLE_FLOAT);
    });

    it('collapses loose uniforms into a single uniform buffer and renames access', function () {
        const src = `
            uniform scale: f32;
            uniform tint: vec4f;
            @compute @workgroup_size(1) fn main() { let s = uniform.scale * uniform.tint.x; }
        `;
        const { result } = run(src);

        // one uniform buffer binding, no texture/storage
        const ubf = result.computeUniformBufferFormat;
        expect(ubf).to.not.equal(null);
        expect(ubf.get('scale')).to.not.equal(undefined);
        expect(ubf.get('tint')).to.not.equal(undefined);
        expect(result.computeBindGroupFormat.uniformBufferFormats).to.have.lengthOf(1);

        // generated struct + buffer declaration
        expect(result.cshader).to.contain('struct struct_ub_compute');
        expect(result.cshader).to.contain('var<uniform> ub_compute : struct_ub_compute;');

        // uniform.x references rewritten to ub_compute.x
        expect(result.cshader).to.contain('ub_compute.scale');
        expect(result.cshader).to.contain('ub_compute.tint.x');
        expect(result.cshader).to.not.contain('uniform.scale');
    });

    it('combines storage buffers, a texture, and uniforms in one reflected group', function () {
        const src = `
            uniform scale: f32;
            var srcTex: texture_2d<f32>;
            var srcTexSampler: sampler;
            var<storage, read> inBuf: array<u32>;
            var<storage, read_write> outBuf: array<u32>;
            @compute @workgroup_size(1) fn main() { }
        `;
        const { result } = run(src);
        const fmt = result.computeBindGroupFormat;
        expect(fmt.textureFormats).to.have.lengthOf(1);
        expect(fmt.storageBufferFormats).to.have.lengthOf(2);
        expect(fmt.uniformBufferFormats).to.have.lengthOf(1);

        // texture(0) + sampler(1) + 2 storage buffers(2,3) + uniform buffer(4)
        expect(fmt.textureFormats[0].slot).to.equal(0);
        const ubSlot = fmt.uniformBufferFormats[0].slot;
        expect(ubSlot).to.equal(4);
        expect(result.cshader).to.contain(`@group(1) @binding(${ubSlot}) var<uniform> ub_compute`);
    });

    it('uses group 0 when no caller bind group format is supplied', function () {
        const src = `
            var<storage, read_write> outBuf: array<u32>;
            @compute @workgroup_size(1) fn main() { }
        `;
        const { result } = run(src, 0);
        expect(result.cshader).to.contain('@group(0) @binding(0) var<storage, read_write> outBuf : array<u32>;');
    });

    it('is a no-op when there is nothing to reflect (strictly additive)', function () {
        const src = `
            @group(0) @binding(0) var<storage, read_write> outBuf: array<u32>;
            @compute @workgroup_size(1) fn main() { outBuf[0] = 1u; }
        `;
        const { result } = run(src);
        expect(result.computeBindGroupFormat).to.equal(null);
        expect(result.computeUniformBufferFormat).to.equal(null);
        expect(result.cshader).to.equal(src);
    });

    it('ignores workgroup, private and local variables', function () {
        const src = `
            var<workgroup> wgScratch: array<u32, 64>;
            var<private> counter: u32;
            @compute @workgroup_size(1) fn main() {
                var localVar: u32 = 0u;
                let alias = wgScratch[0];
            }
        `;
        const { result } = run(src);
        // nothing reflected
        expect(result.computeBindGroupFormat).to.equal(null);
        // declarations left untouched in the source
        expect(result.cshader).to.contain('var<workgroup> wgScratch: array<u32, 64>;');
        expect(result.cshader).to.contain('var<private> counter: u32;');
        expect(result.cshader).to.contain('var localVar: u32 = 0u;');
    });

    it('reflects a write-only storage texture', function () {
        const src = `
            var outTex: texture_storage_2d<rgba8unorm, write>;
            @compute @workgroup_size(1) fn main() { }
        `;
        const { result } = run(src);
        const fmt = result.computeBindGroupFormat;
        expect(fmt.storageTextureFormats).to.have.lengthOf(1);
        const st = fmt.storageTextureFormats[0];
        expect(st.name).to.equal('outTex');
        expect(st.write).to.equal(true);
        expect(st.read).to.equal(false);
        expect(st.slot).to.equal(0);
        expect(result.cshader).to.contain('@group(1) @binding(0) var outTex: texture_storage_2d<rgba8unorm, write>;');
    });

    it('round-trips a read_write storage texture', function () {
        const src = `
            var rwTex: texture_storage_2d<r32uint, read_write>;
            @compute @workgroup_size(1) fn main() { }
        `;
        const { result } = run(src);
        const st = result.computeBindGroupFormat.storageTextureFormats[0];
        expect(st.write).to.equal(true);
        expect(st.read).to.equal(true);
        expect(result.cshader).to.contain('@group(1) @binding(0) var rwTex: texture_storage_2d<r32uint, read_write>;');
    });

    it('reflects a sampled texture + sampler + storage texture (edge-detect layout, group 0)', function () {
        const src = `
            var inputTexture: texture_2d<f32>;
            var inputTexture_sampler: sampler;
            var outputTexture: texture_storage_2d<rgba8unorm, write>;
            @compute @workgroup_size(8, 8, 1) fn main() { }
        `;
        const { result } = run(src, 0);
        const fmt = result.computeBindGroupFormat;
        expect(fmt.textureFormats).to.have.lengthOf(1);
        expect(fmt.storageTextureFormats).to.have.lengthOf(1);

        // inputTexture(0) + sampler(1) + outputTexture(2)
        expect(fmt.textureFormats[0].slot).to.equal(0);
        expect(fmt.storageTextureFormats[0].slot).to.equal(2);

        expect(result.cshader).to.contain('@group(0) @binding(0) var inputTexture: texture_2d<f32>;');
        expect(result.cshader).to.contain('@group(0) @binding(1) var inputTexture_sampler: sampler;');
        expect(result.cshader).to.contain('@group(0) @binding(2) var outputTexture: texture_storage_2d<rgba8unorm, write>;');
    });

    it('reflects the particles-simulation pattern (loose uniforms + rw/ro storage, group 0)', function () {
        const src = `
            struct Sphere { center: vec3<f32>, radius: f32 }
            uniform count: u32;
            uniform dt: f32;
            uniform sphereCount: u32;
            var<storage, read_write> particles: array<Particle>;
            var<storage, read> spheres: array<Sphere>;
            @compute @workgroup_size(64) fn main() { let n = uniform.count; }
        `;
        const { result } = run(src, 0);
        const fmt = result.computeBindGroupFormat;

        // two storage buffers + one generated uniform buffer
        expect(fmt.storageBufferFormats.map(f => f.name)).to.have.members(['particles', 'spheres']);
        expect(fmt.uniformBufferFormats).to.have.lengthOf(1);

        const particlesFmt = fmt.storageBufferFormats.find(f => f.name === 'particles');
        const spheresFmt = fmt.storageBufferFormats.find(f => f.name === 'spheres');
        expect(particlesFmt.readOnly).to.equal(false);
        expect(spheresFmt.readOnly).to.equal(true);

        // particles(0), spheres(1), ub_compute(2)
        expect(result.cshader).to.contain('@group(0) @binding(0) var<storage, read_write> particles : array<Particle>;');
        expect(result.cshader).to.contain('@group(0) @binding(1) var<storage, read> spheres : array<Sphere>;');
        expect(result.cshader).to.contain('@group(0) @binding(2) var<uniform> ub_compute');
        expect(result.cshader).to.contain('ub_compute.count');
    });

    it('leaves explicitly-bound resources untouched while reflecting simplified ones', function () {
        const src = `
            @group(0) @binding(0) var<storage, read_write> manualOut: array<u32>;
            uniform scale: f32;
            var<storage, read> reflectedIn: array<u32>;
            @compute @workgroup_size(1) fn main() { manualOut[0] = u32(uniform.scale); }
        `;
        const { result } = run(src);

        // explicit binding stays exactly as written, in group 0
        expect(result.cshader).to.contain('@group(0) @binding(0) var<storage, read_write> manualOut: array<u32>;');

        // reflected resources go to group 1
        const fmt = result.computeBindGroupFormat;
        expect(fmt.storageBufferFormats.map(f => f.name)).to.include('reflectedIn');
        expect(fmt.storageBufferFormats.map(f => f.name)).to.not.include('manualOut');
        expect(result.cshader).to.contain('@group(1) @binding(0) var<storage, read> reflectedIn : array<u32>;');
        expect(result.cshader).to.contain('ub_compute.scale');
    });

});
