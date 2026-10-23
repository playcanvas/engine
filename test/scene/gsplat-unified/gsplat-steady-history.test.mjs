import { expect } from 'chai';

import { FloatPacking } from '../../../src/core/math/float-packing.js';
import { Mat4 } from '../../../src/core/math/mat4.js';
import { Compute } from '../../../src/platform/graphics/compute.js';
import {
    BUFFERUSAGE_COPY_DST, BUFFERUSAGE_COPY_SRC, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F,
    PIXELFORMAT_RG32U, SHADERLANGUAGE_WGSL
} from '../../../src/platform/graphics/constants.js';
import { Shader } from '../../../src/platform/graphics/shader.js';
import { StorageBuffer } from '../../../src/platform/graphics/storage-buffer.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { Camera } from '../../../src/scene/camera.js';
import historySource from '../../../src/scene/shader-lib/wgsl/chunks/gsplat/compute-gsplat-steady-history.js';
import resolveSource from '../../../src/scene/shader-lib/wgsl/chunks/gsplat/compute-gsplat-steady-resolve.js';
import commonSource from '../../../src/scene/shader-lib/wgsl/chunks/gsplat/gsplat-steady-common.js';
import { createGraphicsDevice } from '../../device.mjs';

const WIDTH = 8;
const HEIGHT = 8;
const PIXELS = WIDTH * HEIGHT;
const CENTER = 3 + 3 * WIDTH;

const packHalf2 = (a, b) => (FloatPacking.float2Half(a) | (FloatPacking.float2Half(b) << 16)) >>> 0;

const quantize = (value) => {
    const bits = FloatPacking.float2Half(value);
    const exponent = (bits >> 10) & 31;
    return 2 ** (exponent ? exponent - 15 : -14) * ((exponent ? 1 : 0) + (bits & 1023) / 1024);
};

describe('GSplat SteadySplats GPU probability ratios', function () {
    let device;
    let resources;
    let shaders;
    let computes;
    let projected;
    let stableIds;
    let history;
    let samples;
    let weights;
    let compute;
    let projectedWords;
    let projectedFloats;

    const buffer = (size) => {
        const result = new StorageBuffer(device, size, BUFFERUSAGE_COPY_DST | BUFFERUSAGE_COPY_SRC);
        resources.push(result);
        return result;
    };

    const texture = (format, storage = false) => {
        const result = new Texture(device, { width: WIDTH, height: HEIGHT, format, storage, mipmaps: false });
        resources.push(result);
        return result;
    };

    const upload = (target, data) => {
        target.lock().set(data);
        target.unlock();
    };

    const createCompute = (name, source, defines) => {
        const shader = new Shader(device, { name, shaderLanguage: SHADERLANGUAGE_WGSL, cshader: source, cdefines: defines });
        const result = new Compute(device, shader, name);
        if (defines?.has('STEADY_TEMPORAL')) result.setParameter('steadyBackground', [0, 0, 0]);
        result.setupDispatch(1, 1, 1);
        shaders.push(shader);
        computes.push(result);
        return result;
    };

    // Independent CPU alpha oracle for two axis-aligned projected splats. Centers and alpha
    // are exactly representable here, so the packed cache does not introduce an extra tolerance.
    const alpha = (splat, x, y) => {
        const cx = 4 + splat * 0.5;
        const cy = 4;
        const radius = ((x - cx) ** 2 + (y - cy) ** 2) / 16;
        const value = (splat ? 0.5 : 0.75) * (Math.exp(-4 * radius) - Math.exp(-4)) / (1 - Math.exp(-4));
        return radius <= 1 && value >= 1 / 255 ? Math.min(0.999, value) : 0;
    };

    const samplePixels = (index, id, depth) => {
        const data = new Uint32Array(PIXELS * 2);
        const floats = new Float32Array(data.buffer);
        for (let p = 0; p < PIXELS; p++) {
            data[p * 2] = index;
            floats[p * 2 + 1] = depth;
        }
        if (index) stableIds.write((index - 1) * 4, new Uint32Array([id - 1]));
        upload(samples, data);
    };

    const cachedOccluder = (id) => {
        const data = new Float32Array(PIXELS * 17);
        const ids = new Uint32Array(data.buffer);
        const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (let p = 0; p < PIXELS; p++) {
            const base = p * 17;
            const x = p % WIDTH + 0.5;
            const y = Math.floor(p / WIDTH) + 0.5;
            ids[base] = id;
            ids[base + 16] = 1 << 2;
            data[base + 1] = 1;
            const ratios = directions.map(([dx, dy]) => (1 - alpha(0, x + dx, y + dy)) / (1 - alpha(0, x, y)));
            ids[base + 2] = packHalf2(ratios[0], ratios[1]);
            ids[base + 3] = packHalf2(ratios[2], ratios[3]);
        }
        history.write(0, data);
    };

    const readFifo = async () => {
        const data = new Uint32Array((await history.read(0, history.byteSize, null, true)).buffer);
        const base = CENTER * 17;
        const state = data[base + 16];
        const head = state & 3;
        const count = state >>> 2;
        return [0, 1, 2, 3].map(k => (k < count ? data[base + ((head + k) & 3) * 4] : 0));
    };

    const dispatch = () => {
        device.computeDispatch([compute]);
        device.submit();
    };

    beforeEach(function () {
        device = createGraphicsDevice({ width: WIDTH, height: HEIGHT });
        if (!device.isWebGPU) this.skip();
        resources = [];
        shaders = [];
        computes = [];
        projected = buffer(2 * 32);
        stableIds = buffer(2 * 4);
        projectedWords = new Uint32Array(16);
        projectedFloats = new Float32Array(projectedWords.buffer);
        for (let i = 0; i < 2; i++) {
            projectedFloats.set([i / WIDTH, 0, 0.5, 1], i * 8);
            projectedWords[i * 8 + 4] = packHalf2(8, 0);
            projectedWords[i * 8 + 5] = packHalf2(0, 8);
            projectedWords[i * 8 + 7] = packHalf2(0, i ? 0.5 : 0.75);
        }
        projected.write(0, projectedWords);
        history = buffer(PIXELS * 68);
        samples = texture(PIXELFORMAT_RG32U);
        weights = texture(PIXELFORMAT_RGBA32F, true);
        compute = createCompute('SteadyHistoryOracle', commonSource + historySource);
        compute.setParameter('steadySize', [WIDTH, HEIGHT]);
        compute.setParameter('steadyCacheStride', 8);
        compute.setParameter('alphaClipForward', 1 / 255);
        compute.setParameter('steadyValid', 1);
        compute.setParameter('steadyRowStart', 0);
        compute.setParameter('steadyRowCount', HEIGHT);
        compute.setParameter('projCache', projected);
        compute.setParameter('steadyIds', stableIds);
        compute.setParameter('steadyHistory', history);
        compute.setParameter('steadySamples', samples);
        compute.setParameter('steadyWeights', weights);
    });

    afterEach(function () {
        computes?.forEach(item => item.destroy());
        shaders?.forEach(item => item.destroy());
        resources?.forEach(item => item.destroy());
        device?.destroy();
    });

    const requireExecution = function () {
        if (!process.env.PC_WEBGPU_BACKEND || process.env.PC_WEBGPU_BACKEND === 'null') this.skip();
    };

    it('matches the closed-form target/source alpha and nearer-occluder ratios', async function () {
        requireExecution.call(this);
        cachedOccluder(7);
        await samplePixels(2, 13, 2);
        dispatch();
        const actual = await weights.read(0, 0, WIDTH, HEIGHT, { immediate: true });
        const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (let n = 0; n < 4; n++) {
            const [dx, dy] = directions[n];
            const targetX = 3.5 + dx;
            const targetY = 3.5 + dy;
            const expected = alpha(1, targetX, targetY) / alpha(1, 3.5, 3.5) *
                quantize((1 - alpha(0, targetX, targetY)) / (1 - alpha(0, 3.5, 3.5)));
            expect(actual[CENTER * 4 + n]).to.be.closeTo(expected, 2e-5);
        }
        expect(await readFifo()).to.deep.equal([13, 7, 0, 0]);
    });

    it('excludes a repeated stable ID even when its cached depth is nearer', async function () {
        requireExecution.call(this);
        cachedOccluder(13);
        await samplePixels(2, 13, 2);
        dispatch();
        const actual = await weights.read(0, 0, WIDTH, HEIGHT, { immediate: true });
        expect(actual[CENTER * 4]).to.be.closeTo(alpha(1, 4.5, 3.5) / alpha(1, 3.5, 3.5), 2e-5);
        expect(await readFifo()).to.deep.equal([13, 0, 0, 0]);
    });

    it('wraps the distinct FIFO without shifting records and ignores stale entries after a reset', async function () {
        requireExecution.call(this);
        // Adjacent 32-bit identities must stay distinct after the compact visibility lookup.
        const ids = [0x80000001, 0x80000002, 0x80000003, 0x80000004, 0x80000005, 0x80000006];
        for (const id of ids) {
            samplePixels(1, id, 2);
            dispatch();
        }
        expect(await readFifo()).to.deep.equal(ids.slice(2).reverse());
        const before = await history.read(0, history.byteSize, null, true);
        // A different frame-local cache index still resolves to the same stable identity.
        samplePixels(2, ids[4], 2);
        dispatch();
        samplePixels(0, 0, 0);
        dispatch();
        expect(await history.read(0, history.byteSize, null, true)).to.deep.equal(before);

        compute.setParameter('steadyValid', 0);
        dispatch();
        expect(await readFifo()).to.deep.equal([0, 0, 0, 0]);
        compute.setParameter('steadyValid', 1);
        samplePixels(1, ids[0], 2);
        dispatch();
        expect(await readFifo()).to.deep.equal([ids[0], 0, 0, 0]);
    });

    it('keeps packed nearly-opaque occluder ratios finite without quantizing depth or identity', async function () {
        requireExecution.call(this);
        projectedFloats[0] = -0.125;
        projectedFloats[1] = 0.125;
        projectedWords[4] = packHalf2(1, 0);
        projectedWords[5] = packHalf2(0, 1);
        projectedWords[7] = packHalf2(0, 1);
        projected.write(0, projectedWords);
        const depth = Math.fround(1.234567);
        samplePixels(1, 0xfedcba98, depth);
        dispatch();
        expect(await readFifo()).to.deep.equal([0xfedcba98, 0, 0, 0]);
        const bytes = await history.read(0, history.byteSize, null, true);
        const words = new Uint32Array(bytes.buffer);
        const floats = new Float32Array(bytes.buffer);
        const base = CENTER * 17 + (words[CENTER * 17 + 16] & 3) * 4;
        expect(floats[base + 1]).to.equal(depth);
        samplePixels(0, 0, 0);
        dispatch();
        const actual = await weights.read(0, 0, WIDTH, HEIGHT, { immediate: true });
        for (let n = 0; n < 4; n++) {
            expect(actual[CENTER * 4 + n]).to.be.closeTo(1000, 1);
        }
    });

    it('includes background transmission and clears stale entries on reset', async function () {
        requireExecution.call(this);
        cachedOccluder(7);
        await samplePixels(0, 0, 0);
        dispatch();
        let actual = await weights.read(0, 0, WIDTH, HEIGHT, { immediate: true });
        expect(actual[CENTER * 4]).to.be.closeTo(quantize((1 - alpha(0, 4.5, 3.5)) / (1 - alpha(0, 3.5, 3.5))), 2e-5);
        compute.setParameter('steadyValid', 0);
        dispatch();
        actual = await weights.read(0, 0, WIDTH, HEIGHT, { immediate: true });
        expect(Array.from(actual)).to.deep.equal(Array(PIXELS * 4).fill(1));
    });

    it('retains rare occluders across repeated background samples until history is invalidated', async function () {
        requireExecution.call(this);
        cachedOccluder(7);
        samplePixels(0, 0, 0);
        for (let i = 0; i < 16; i++) {
            dispatch();
        }
        expect(await readFifo()).to.deep.equal([7, 0, 0, 0]);
        const background = await weights.read(0, 0, WIDTH, HEIGHT, { immediate: true });
        expect(background[CENTER * 4]).to.be.closeTo(quantize((1 - alpha(0, 4.5, 3.5)) / (1 - alpha(0, 3.5, 3.5))), 2e-5);

        // Geometry changes invalidate history rather than treating empty stochastic draws as
        // evidence that a rare occluder left the view.
        compute.setParameter('steadyValid', 0);
        projectedFloats[0] = 100;
        projected.write(0, projectedWords);
        samplePixels(2, 13, 2);
        dispatch();
        const actual = await weights.read(0, 0, WIDTH, HEIGHT, { immediate: true });
        const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (let n = 0; n < 4; n++) {
            const [dx, dy] = directions[n];
            const expected = alpha(1, 3.5 + dx, 3.5 + dy) / alpha(1, 3.5, 3.5);
            expect(actual[CENTER * 4 + n]).to.be.closeTo(expected, 2e-5);
        }
    });

    it('gathers each source outward weight and preserves premultiplied background coverage', async function () {
        requireExecution.call(this);
        const raw = texture(PIXELFORMAT_RGBA16F);
        const spatial = texture(PIXELFORMAT_RGBA16F, true);
        const pixels = new Uint16Array(PIXELS * 4);
        const ratios = new Float32Array(PIXELS * 4);
        const set = (p, rgba) => pixels.set(rgba.map(FloatPacking.float2Half), p * 4);
        set(CENTER, [1, 0, 0, 1]);
        set(CENTER - 1, [0, 1, 0, 1]);
        set(CENTER + 1, [0, 0, 1, 1]);
        set(CENTER - WIDTH, [0, 0, 0, 0]);
        set(CENTER + WIDTH, [1, 1, 1, 1]);
        ratios[(CENTER - 1) * 4] = 2;
        ratios[(CENTER + 1) * 4 + 1] = 3;
        ratios[(CENTER - WIDTH) * 4 + 2] = 4;
        ratios[(CENTER + WIDTH) * 4 + 3] = 5;
        upload(raw, pixels);
        upload(weights, ratios);
        const spatialCompute = createCompute('SteadySpatialOracle', resolveSource);
        spatialCompute.setParameter('steadySize', [WIDTH, HEIGHT]);
        spatialCompute.setParameter('steadyRaw', raw);
        spatialCompute.setParameter('steadyWeights', weights);
        spatialCompute.setParameter('steadyOutput', spatial);
        device.computeDispatch([spatialCompute]);
        device.submit();
        const actual = await spatial.read(0, 0, WIDTH, HEIGHT, { immediate: true });
        const expected = [6 / 15, 7 / 15, 8 / 15, 11 / 15].map(FloatPacking.float2Half);
        for (let c = 0; c < 4; c++) {
            // Storage conversion may differ by one half-float ULP across GPU backends.
            expect(Math.abs(actual[CENTER * 4 + c] - expected[c])).to.be.at.most(1);
        }
    });

    it('addresses row-band histories locally while writing global image coordinates', async function () {
        requireExecution.call(this);
        upload(weights, new Float32Array(PIXELS * 4).fill(7));
        await samplePixels(2, 13, 2);
        compute.setParameter('steadyRowStart', 4);
        compute.setParameter('steadyRowCount', 4);
        compute.setParameter('steadyValid', 0);
        dispatch();
        const actual = await weights.read(0, 0, WIDTH, HEIGHT, { immediate: true });
        expect(actual[CENTER * 4]).to.equal(7);
        expect(actual[(3 + 5 * WIDTH) * 4 + 1]).to.be.closeTo(alpha(1, 2.5, 5.5) / alpha(1, 3.5, 5.5), 2e-5);
    });

    it('attenuates an outlier history by weight instead of clamping its RGB', async function () {
        requireExecution.call(this);
        const raw = texture(PIXELFORMAT_RGBA16F);
        const previous = texture(PIXELFORMAT_RGBA16F);
        const output = texture(PIXELFORMAT_RGBA16F, true);
        const currentPixels = new Uint16Array(PIXELS * 4);
        const previousPixels = new Uint16Array(PIXELS * 4);
        for (let p = 0; p < PIXELS; p++) {
            currentPixels.set([0.125, 0.125, 0.125, 1].map(FloatPacking.float2Half), p * 4);
            previousPixels.set([2, 0, 0, 1].map(FloatPacking.float2Half), p * 4);
        }
        upload(raw, currentPixels);
        upload(previous, previousPixels);
        await samplePixels(1, 7, 2);
        const projection = new Mat4().setPerspective(60, 1, 0.1, 100);
        Camera.applyShaderProjectionTransform(projection, projection, false, true);
        const temporal = createCompute('SteadyTemporalOracle', resolveSource, new Map([['STEADY_TEMPORAL', '']]));
        temporal.setParameter('steadySize', [WIDTH, HEIGHT]);
        temporal.setParameter('steadyValid', 1);
        temporal.setParameter('steadyCameraStill', 0);
        temporal.setParameter('steadyRetention', 0.7);
        temporal.setParameter('steadyInverseProjection', new Mat4().invert(projection).data);
        temporal.setParameter('steadyInverseView', new Mat4().data);
        temporal.setParameter('steadyPreviousViewProjection', projection.data);
        temporal.setParameter('steadyRaw', raw);
        temporal.setParameter('steadySamples', samples);
        temporal.setParameter('steadyWeights', weights);
        temporal.setParameter('steadyPrevious', previous);
        temporal.setParameter('steadyOutput', output);
        device.computeDispatch([temporal]);
        device.submit();
        const actual = await output.read(0, 0, WIDTH, HEIGHT, { immediate: true });
        // Flat raw neighborhood: chroma-Co extent is 0.005, so red history gives m=200.
        // Clamping history to that neighborhood would erase this retained contribution.
        const retention = 0.7 / 200;
        const expected = FloatPacking.float2Half(0.125 + (2 - 0.125) * retention);
        expect(Math.abs(actual[CENTER * 4] - expected)).to.be.at.most(1);
        expect(actual[CENTER * 4]).to.be.greaterThan(FloatPacking.float2Half(0.125));
    });

    it('retains same-pixel background history at stationary image borders and honors resets', async function () {
        requireExecution.call(this);
        const raw = texture(PIXELFORMAT_RGBA16F);
        const previous = texture(PIXELFORMAT_RGBA16F);
        const output = texture(PIXELFORMAT_RGBA16F, true);
        const pixels = new Uint16Array(PIXELS * 4);
        pixels[0] = FloatPacking.float2Half(1 / 256);
        pixels[3] = FloatPacking.float2Half(1 / 128);
        upload(previous, pixels);
        upload(raw, new Uint16Array(PIXELS * 4));
        upload(samples, new Uint32Array(PIXELS * 2));
        upload(weights, new Float32Array(PIXELS * 4));
        const temporal = createCompute('SteadyStationaryHistoryOracle', resolveSource, new Map([['STEADY_TEMPORAL', '']]));
        temporal.setParameter('steadySize', [WIDTH, HEIGHT]);
        temporal.setParameter('steadyValid', 1);
        temporal.setParameter('steadyCameraStill', 1);
        temporal.setParameter('steadyRetention', 0.7);
        // The stationary path has no need for a sampled surface or a reprojection transform.
        temporal.setParameter('steadyInverseProjection', new Float32Array(16));
        temporal.setParameter('steadyInverseView', new Float32Array(16));
        temporal.setParameter('steadyPreviousViewProjection', new Float32Array(16));
        temporal.setParameter('steadyRaw', raw);
        temporal.setParameter('steadySamples', samples);
        temporal.setParameter('steadyWeights', weights);
        temporal.setParameter('steadyPrevious', previous);
        temporal.setParameter('steadyOutput', output);
        device.computeDispatch([temporal]);
        device.submit();
        const actual = await output.read(0, 0, WIDTH, HEIGHT, { immediate: true });
        expect(Math.abs(actual[0] - FloatPacking.float2Half(0.7 / 256))).to.be.at.most(1);
        expect(Math.abs(actual[3] - FloatPacking.float2Half(0.7 / 128))).to.be.at.most(1);
        expect(actual[4]).to.equal(0);
        temporal.setParameter('steadyValid', 0);
        device.computeDispatch([temporal]);
        device.submit();
        const reset = await output.read(0, 0, 1, 1, { immediate: true });
        expect(Array.from(reset)).to.deep.equal([0, 0, 0, 0]);
    });
    it('bases confidence on composited radiance instead of rejecting an otherwise invisible alpha edge', async function () {
        requireExecution.call(this);
        const raw = texture(PIXELFORMAT_RGBA16F);
        const previous = texture(PIXELFORMAT_RGBA16F);
        const output = texture(PIXELFORMAT_RGBA16F, true);
        const color = new Uint16Array(PIXELS * 4);
        for (let p = 0; p < PIXELS; p++) color.set([0.5, 0.5, 0.5, 1].map(FloatPacking.float2Half), p * 4);
        upload(raw, new Uint16Array(PIXELS * 4));
        upload(previous, color);
        upload(weights, new Float32Array(PIXELS * 4).fill(1));
        const temporal = createCompute('SteadyBackgroundConfidence', resolveSource, new Map([['STEADY_TEMPORAL', '']]));
        temporal.setParameter('steadySize', [WIDTH, HEIGHT]);
        temporal.setParameter('steadyValid', 1);
        temporal.setParameter('steadyCameraStill', 1);
        temporal.setParameter('steadyRetention', 0.7);
        temporal.setParameter('steadyBackground', [0.5, 0.5, 0.5]);
        temporal.setParameter('steadyInverseProjection', new Mat4().data);
        temporal.setParameter('steadyInverseView', new Mat4().data);
        temporal.setParameter('steadyPreviousViewProjection', new Mat4().data);
        temporal.setParameter('steadyRaw', raw);
        temporal.setParameter('steadySamples', samples);
        temporal.setParameter('steadyWeights', weights);
        temporal.setParameter('steadyPrevious', previous);
        temporal.setParameter('steadyOutput', output);
        device.computeDispatch([temporal]);
        device.submit();
        const actual = await output.read(3, 3, 1, 1, { immediate: true });
        expect(Math.abs(actual[0] - FloatPacking.float2Half(0.35))).to.be.at.most(1);
        expect(Math.abs(actual[3] - FloatPacking.float2Half(0.7))).to.be.at.most(1);
    });
});
