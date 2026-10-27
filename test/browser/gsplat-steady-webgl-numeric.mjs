import { FloatPacking } from '../../src/core/math/float-packing.js';
import { Mat4 } from '../../src/core/math/mat4.js';
import { PIXELFORMAT_R32F, SEMANTIC_POSITION } from '../../src/platform/graphics/constants.js';
import { RenderTarget } from '../../src/platform/graphics/render-target.js';
import { Texture } from '../../src/platform/graphics/texture.js';
import { getSTBNTexture } from '../../src/scene/graphics/noise-textures.js';
import { RenderPassShaderQuad } from '../../src/scene/graphics/render-pass-shader-quad.js';
import { GSplatSteadyWebglPass } from '../../src/scene/gsplat-unified/gsplat-steady-webgl-pass.js';
import noiseSource from '../../src/scene/shader-lib/glsl/chunks/gsplat/gsplat-steady-noise.js';
import { ShaderUtils } from '../../src/scene/shader-lib/shader-utils.js';

const half = (value) => {
    const sign = value & 0x8000 ? -1 : 1;
    const exponent = (value >> 10) & 31;
    const mantissa = value & 1023;
    return sign * (exponent ? 2 ** (exponent - 15) * (1 + mantissa / 1024) : 2 ** -14 * mantissa / 1024);
};

export async function runSteadyWebglNumericTests(device, owner, forwardRenderer, assert) {
    const width = 8;
    const pixels = width * width;
    const center = 3 + 3 * width;
    const tests = [];
    const thresholds = new Texture(device, { width: 1024, height: 1024, format: PIXELFORMAT_R32F, mipmaps: false });
    const thresholdTarget = new RenderTarget({ colorBuffer: thresholds, depth: false });
    const thresholdPass = new RenderPassShaderQuad(device);
    thresholdPass.shader = ShaderUtils.createShader(device, {
        uniqueName: 'SteadyGLSamplingOracle',
        attributes: { aPosition: SEMANTIC_POSITION },
        vertexChunk: 'quadVS',
        fragmentGLSL: `${noiseSource}
            uniform highp sampler3D noise;
            uniform uint period;
            void main(void) {
                uint p = uint(gl_FragCoord.x) + uint(gl_FragCoord.y) * 1024u;
                uint id = (p & 16383u) + 1u;
                uvec2 offset = (id * uvec2(3242174889u, 2447445415u)) >> 27u;
                uint rank = uint(texelFetch(noise, ivec3(ivec2(offset), int(p >> 14u)), 0).r * 255.0 + 0.5);
                pcFragColor0 = vec4(steadyNoiseThreshold(rank, steadyPrimitivePhase(id), period));
            }`
    });
    thresholdPass.init(thresholdTarget);
    try {
        device.scope.resolve('noise').setValue(getSTBNTexture(device));
        await [0, 0x9e3779b9].reduce(async (previous, period) => {
            await previous;
            device.scope.resolve('period').setValue(period);
            thresholdPass.render();
            const values = await thresholds.read(0, 0, 1024, 1024, { immediate: true });
            assert(values.every(value => value >= 0 && value < 1), 'STBN thresholds fall outside [0, 1)');
            assert(values[7] !== values[472], 'Primitives with colliding spatial offsets share their threshold pattern');
            for (const alpha of [0.005, 0.01, 0.05, 0.1, 0.5, 0.9, 0.999]) {
                let accepted = 0;
                for (const value of values) if (value < alpha) accepted++;
                assert(Math.abs(accepted / values.length - alpha) < 0.0006, `STBN coverage probability does not match alpha=${alpha}`);
            }
        }, Promise.resolve());
        tests.push('preserves fine-opacity coverage and distinct primitive phases through the full GLSL STBN lookup');
    } finally {
        thresholdPass.destroy();
        thresholdTarget.destroy();
        thresholds.destroy();
    }
    const near = (actual, expected, tolerance, message) => assert(Math.abs(actual - expected) <= tolerance,
        `${message}: expected ${expected}, received ${actual}`);
    const upload = (texture, data) => {
        texture.lock().set(data);
        texture.unlock();
    };
    const packHalf2 = (a, b) => (FloatPacking.float2Half(a) | (FloatPacking.float2Half(b) << 16)) >>> 0;
    const pass = new GSplatSteadyWebglPass(device, owner, forwardRenderer, owner._sampleMesh);
    pass.resize(width, width);
    const bind = (quad, index, valid) => {
        quad.setParameter('steadySize', [width, width]);
        quad.setParameter('alphaClipForward', 1 / 255);
        quad.setParameter('steadyValid', valid);
        quad.setParameter('steadySamples', pass.samples);
        quad.setParameter('steadyGaussians', pass.gaussians);
        for (let k = 0; k < 4; k++) quad.setParameter(`steadyHistory${k}`, pass.histories[1 - index][k]);
        quad.setParameter('steadyRaw', pass.raw);
        quad.setParameter('steadyBackground', [0, 0, 0]);
    };
    const clearHistory = () => {
        for (const history of pass.histories) {
            for (const texture of history) upload(texture, new Uint32Array(pixels * 4));
        }
    };
    const samples = new Uint32Array(pixels * 4);
    const sampleFloats = new Float32Array(samples.buffer);
    const gaussians = new Float32Array(pixels * 4);
    const cache = new Uint32Array(pixels * 4);
    const cacheFloats = new Float32Array(cache.buffer);
    const ratios = [0.5, 2, 1, 0.75];
    for (let p = 0; p < pixels; p++) {
        samples[p * 4] = 13;
        sampleFloats.set([2, 4.5, 4], p * 4 + 1);
        gaussians.set([1 / 16, 0, 1 / 16, 0.5], p * 4);
        cache[p * 4] = 7;
        cacheFloats[p * 4 + 1] = 1;
        cache[p * 4 + 2] = packHalf2(ratios[0], ratios[1]);
        cache[p * 4 + 3] = packHalf2(ratios[2], ratios[3]);
    }
    try {
        clearHistory();
        upload(pass.histories[1][0], cache);
        upload(pass.samples, samples);
        upload(pass.gaussians, gaussians);
        const raw = new Uint16Array(pixels * 4);
        const rgba = [
            [center, [1, 0, 0, 1]], [center - 1, [0, 1, 0, 1]],
            [center + 1, [0, 0, 1, 1]], [center - width, [0, 0, 0, 0]],
            [center + width, [1, 1, 1, 1]]
        ];
        for (const [p, color] of rgba) raw.set(color.map(FloatPacking.float2Half), p * 4);
        upload(pass.raw, raw);
        pass._configureResolve(false, false);
        bind(pass.resolvePasses[0], 0, 1);
        pass.resolvePasses[0].render();
        const image = await pass.colors[0].read(3, 3, 1, 1, { immediate: true });
        const alpha = (x, y) => 0.5 * (Math.exp(-4 * ((x - 4.5) ** 2 + (y - 4) ** 2) / 16) - Math.exp(-4)) / (1 - Math.exp(-4));
        const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const colors = [[0, 1, 0, 1], [0, 0, 1, 1], [0, 0, 0, 0], [1, 1, 1, 1]];
        const expected = [1, 0, 0, 1];
        let mass = 1;
        for (let n = 0; n < 4; n++) {
            const [dx, dy] = directions[n];
            const weight = alpha(3.5, 3.5) / alpha(3.5 - dx, 3.5 - dy) * ratios[n];
            mass += weight;
            for (let c = 0; c < 4; c++) expected[c] += colors[n][c] * weight;
        }
        for (let c = 0; c < 4; c++) near(half(image[c]), expected[c] / mass, 1e-3, 'Spatial PDF/occluder ratio');
        tests.push('matches an independent CPU oracle for spatial opacity and occluder ratios');

        upload(pass.samples, new Uint32Array(pixels * 4));
        for (let i = 0; i < 16; i++) {
            const index = i % 2;
            bind(pass.historyPasses[index], index, 1);
            pass.historyPasses[index].render();
        }
        const entries = await Promise.all(pass.histories[1].map(texture => texture.read(3, 3, 1, 1, { immediate: true })));
        assert(entries[0][0] === 7 && entries.slice(1).every(entry => entry[0] === 0), 'Background samples evicted a rare foreground occluder');
        tests.push('retains rare foreground history across repeated background samples');

        clearHistory();
        upload(pass.samples, samples);
        const flat = new Uint16Array(pixels * 4);
        const previous = new Uint16Array(pixels * 4);
        for (let p = 0; p < pixels; p++) {
            flat.set([0.125, 0.125, 0.125, 1].map(FloatPacking.float2Half), p * 4);
            previous.set([2, 0, 0, 1].map(FloatPacking.float2Half), p * 4);
        }
        pass._configureResolve(true, false);
        upload(pass.raw, flat);
        upload(pass.colors[1], previous);
        const temporal = pass.resolvePasses[0];
        bind(temporal, 0, 1);
        const projection = new Mat4().setPerspective(60, 1, 0.1, 100);
        temporal.setParameter('steadyRetention', 0.7);
        temporal.setParameter('steadyCameraStill', 0);
        temporal.setParameter('steadyInverseProjection', new Mat4().invert(projection).data);
        temporal.setParameter('steadyInverseView', new Mat4().data);
        temporal.setParameter('steadyPreviousViewProjection', projection.data);
        temporal.setParameter('steadyPrevious', pass.colors[1]);
        temporal.render();
        const rejected = await pass.colors[0].read(3, 3, 1, 1, { immediate: true });
        near(half(rejected[0]), 0.125 + (2 - 0.125) * 0.7 / 200, 2e-4, 'Soft temporal rejection');
        tests.push('matches soft temporal history rejection without clamping historical RGB');

        upload(pass.raw, new Uint16Array(pixels * 4));
        upload(pass.samples, new Uint32Array(pixels * 4));
        const cornerHistory = new Uint16Array(pixels * 4);
        cornerHistory[0] = FloatPacking.float2Half(1 / 256);
        cornerHistory[3] = FloatPacking.float2Half(1 / 128);
        upload(pass.colors[1], cornerHistory);
        temporal.setParameter('steadyCameraStill', 1);
        temporal.render();
        const corner = await pass.colors[0].read(0, 0, 1, 1, { immediate: true });
        near(half(corner[0]), 0.7 / 256, 2e-6, 'Stationary border history');
        near(half(corner[3]), 0.7 / 128, 4e-6, 'Stationary border coverage');
        temporal.setParameter('steadyValid', 0);
        temporal.render();
        const resetCorner = await pass.colors[0].read(0, 0, 1, 1, { immediate: true });
        assert(Array.from(resetCorner).every(value => value === 0), 'A history reset retained stationary border color');
        tests.push('retains stationary background history at image borders and honors resets');

        upload(pass.raw, new Uint16Array(pixels * 4));
        const matchingBackground = new Uint16Array(pixels * 4);
        for (let p = 0; p < pixels; p++) matchingBackground.set([0.5, 0.5, 0.5, 1].map(FloatPacking.float2Half), p * 4);
        upload(pass.colors[1], matchingBackground);
        temporal.setParameter('steadyValid', 1);
        temporal.setParameter('steadyBackground', [0.5, 0.5, 0.5]);
        temporal.render();
        const matching = await pass.colors[0].read(3, 3, 1, 1, { immediate: true });
        near(half(matching[0]), 0.35, 3e-4, 'Background-aware color retention');
        near(half(matching[3]), 0.7, 5e-4, 'Background-aware coverage retention');
        tests.push('retains nominal history confidence when foreground and background have matching radiance');

        pass._configureResolve(true, true);
        const impulse = new Uint16Array(pixels * 4);
        impulse[center * 4] = FloatPacking.float2Half(1);
        impulse[center * 4 + 3] = FloatPacking.float2Half(1);
        upload(pass.raw, impulse);
        upload(pass.samples, new Uint32Array(pixels * 4));
        const dispatchRest = (frames) => {
            const index = (frames - 1) % 2;
            const quad = pass.resolvePasses[index];
            bind(quad, index, 0);
            quad.setParameter('steadyRetention', 0.7);
            quad.setParameter('steadyRest', pass.averages[1 - index]);
            quad.setParameter('steadyRestFrames', frames);
            quad.render();
            return index;
        };
        for (let frames = 1; frames <= 8; frames++) dispatchRest(frames);
        const initial = await pass.averages[1].read(3, 3, 1, 1, { immediate: true });
        near(initial[0], 0.2, 1e-6, 'First eight stationary spatial estimates');
        dispatchRest(9);
        const later = await pass.averages[0].read(3, 3, 1, 1, { immediate: true });
        near(later[0], (8 * 0.2 + 1) / 9, 1e-6, 'Raw stationary sample after frame eight');
        tests.push('uses eight spatial estimates followed by full-precision raw-sample averaging');
        return tests;
    } finally {
        pass.destroy();
    }
}
