import { expect } from 'chai';

import { Compute } from '../../../src/platform/graphics/compute.js';
import { BUFFERUSAGE_COPY_SRC, SHADERLANGUAGE_WGSL } from '../../../src/platform/graphics/constants.js';
import { Shader } from '../../../src/platform/graphics/shader.js';
import { StorageBuffer } from '../../../src/platform/graphics/storage-buffer.js';
import { getSTBNTexture } from '../../../src/scene/graphics/noise-textures.js';
import noiseSource from '../../../src/scene/shader-lib/wgsl/chunks/gsplat/gsplat-steady-noise.js';
import { createGraphicsDevice } from '../../device.mjs';

describe('GSplat SteadySplats sampling probabilities', function () {
    let device;
    let shader;
    let compute;
    let output;
    const count = 16384 * 64;

    beforeEach(function () {
        device = createGraphicsDevice({ width: 1, height: 1 });
        if (!device.isWebGPU) this.skip();
        output = new StorageBuffer(device, count * 4, BUFFERUSAGE_COPY_SRC);
        shader = new Shader(device, { name: 'SteadySamplingOracle',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: `${noiseSource}
                var noise: texture_3d<f32>;
                var<storage, read_write> output: array<f32>;
                uniform period: u32;
                @compute @workgroup_size(256)
                fn main(@builtin(global_invocation_id) p: vec3u) {
                    let id = (p.x & 16383u) + 1u;
                    let offset = vec2u(id * 3242174889u, id * 2447445415u) >> vec2u(27u);
                    let rank = u32(textureLoad(noise, vec3i(vec2i(offset), i32(p.x >> 14u)), 0).r * 255.0 + 0.5);
                    output[p.x] = steadyNoiseThreshold(rank, steadyPrimitivePhase(id), uniform.period);
                }` });
        compute = new Compute(device, shader);
        compute.setParameter('noise', getSTBNTexture(device));
        compute.setParameter('output', output);
        compute.setupDispatch(count / 256);
    });

    afterEach(function () {
        compute?.destroy();
        shader?.destroy();
        output?.destroy();
        compute = shader = output = null;
        device?.destroy();
    });

    it('preserves fine opacity probabilities and decorrelates colliding spatial offsets across periods', async function () {
        if (!process.env.PC_WEBGPU_BACKEND || process.env.PC_WEBGPU_BACKEND === 'null') this.skip();
        await [0, 0x9e3779b9].reduce(async (previous, period) => {
            await previous;
            compute.setParameter('period', period);
            device.computeDispatch([compute]);
            device.submit();
            const bytes = await output.read(0, output.byteSize, null, true);
            const values = new Float32Array(bytes.buffer, bytes.byteOffset, count);
            expect(values[7]).to.not.equal(values[472]); // IDs 8 and 473 have the same R2 offset.
            expect(values.every(value => value >= 0 && value < 1)).to.equal(true);
            for (const alpha of [0.005, 0.01, 0.05, 0.1, 0.5, 0.9, 0.999]) {
                let accepted = 0;
                for (const value of values) {
                    if (value < alpha) accepted++;
                }
                // R8 bin-center thresholds err by 0.0017 at alpha=0.01. Check the full GPU
                // lookup and primitive phases against continuous Bernoulli coverage instead.
                expect(accepted / count, `alpha=${alpha}, period=${period}`).to.be.closeTo(alpha, 0.0006);
            }
        }, Promise.resolve());
    });
});
