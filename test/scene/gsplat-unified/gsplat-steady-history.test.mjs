import { expect } from 'chai';

import { FloatPacking } from '../../../src/core/math/float-packing.js';
import { Mat4 } from '../../../src/core/math/mat4.js';
import { Compute } from '../../../src/platform/graphics/compute.js';
import {
    BUFFERUSAGE_COPY_DST, BUFFERUSAGE_COPY_SRC, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F,
    PIXELFORMAT_RGBA32U, SHADERLANGUAGE_WGSL
} from '../../../src/platform/graphics/constants.js';
import { Shader } from '../../../src/platform/graphics/shader.js';
import { StorageBuffer } from '../../../src/platform/graphics/storage-buffer.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { Camera } from '../../../src/scene/camera.js';
import historySource from '../../../src/scene/shader-lib/wgsl/chunks/gsplat/compute-gsplat-steady-history.js';
import spatialSource from '../../../src/scene/shader-lib/wgsl/chunks/gsplat/compute-gsplat-steady-spatial.js';
import temporalSource from '../../../src/scene/shader-lib/wgsl/chunks/gsplat/compute-gsplat-steady-temporal.js';
import commonSource from '../../../src/scene/shader-lib/wgsl/chunks/gsplat/gsplat-steady-common.js';
import { createGraphicsDevice } from '../../device.mjs';

const WIDTH = 8;
const HEIGHT = 8;
const PIXELS = WIDTH * HEIGHT;
const CENTER = 3 + 3 * WIDTH;

const packHalf2 = (a, b) => (FloatPacking.float2Half(a) | (FloatPacking.float2Half(b) << 16)) >>> 0;

describe('GSplat SteadySplats GPU probability ratios', function () {
    let device;
    let resources;
    let shaders;
    let computes;
    let projected;
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

    const createCompute = (name, source) => {
        const shader = new Shader(device, { name, shaderLanguage: SHADERLANGUAGE_WGSL, cshader: source });
        const result = new Compute(device, shader, name);
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
        const data = new Uint32Array(PIXELS * 4);
        const floats = new Float32Array(data.buffer);
        for (let p = 0; p < PIXELS; p++) {
            data[p * 4] = index;
            data[p * 4 + 1] = id;
            floats[p * 4 + 2] = depth;
        }
        upload(samples, data);
    };

    const cachedOccluder = (id) => {
        const data = new Float32Array(PIXELS * 4 * 6);
        const ids = new Uint32Array(data.buffer);
        const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (let p = 0; p < PIXELS; p++) {
            const base = p * 24;
            const x = p % WIDTH + 0.5;
            const y = Math.floor(p / WIDTH) + 0.5;
            ids[base] = id;
            data[base + 1] = 1;
            for (let n = 0; n < 4; n++) {
                const [dx, dy] = directions[n];
                data[base + 2 + n] = (1 - alpha(0, x + dx, y + dy)) / (1 - alpha(0, x, y));
            }
        }
        history.write(0, data);
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
        projectedWords = new Uint32Array(16);
        projectedFloats = new Float32Array(projectedWords.buffer);
        for (let i = 0; i < 2; i++) {
            projectedFloats.set([i / WIDTH, 0, 0.5, 1], i * 8);
            projectedWords[i * 8 + 4] = packHalf2(8, 0);
            projectedWords[i * 8 + 5] = packHalf2(0, 8);
            projectedWords[i * 8 + 7] = packHalf2(0, i ? 0.5 : 0.75);
        }
        projected.write(0, projectedWords);
        history = buffer(PIXELS * 4 * 24);
        samples = texture(PIXELFORMAT_RGBA32U);
        weights = texture(PIXELFORMAT_RGBA32F, true);
        compute = createCompute('SteadyHistoryOracle', commonSource + historySource);
        compute.setParameter('steadySize', [WIDTH, HEIGHT]);
        compute.setParameter('steadyCacheStride', 8);
        compute.setParameter('alphaClipForward', 1 / 255);
        compute.setParameter('steadyValid', 1);
        compute.setParameter('steadyRowStart', 0);
        compute.setParameter('steadyRowCount', HEIGHT);
        compute.setParameter('projCache', projected);
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
                (1 - alpha(0, targetX, targetY)) / (1 - alpha(0, 3.5, 3.5));
            expect(actual[CENTER * 4 + n]).to.be.closeTo(expected, 2e-5);
        }
        const fifo = new Uint32Array((await history.read(0, history.byteSize, null, true)).buffer);
        expect([fifo[CENTER * 24], fifo[CENTER * 24 + 6]]).to.deep.equal([13, 7]);
    });

    it('excludes a repeated stable ID even when its cached depth is nearer', async function () {
        requireExecution.call(this);
        cachedOccluder(13);
        await samplePixels(2, 13, 2);
        dispatch();
        const actual = await weights.read(0, 0, WIDTH, HEIGHT, { immediate: true });
        expect(actual[CENTER * 4]).to.be.closeTo(alpha(1, 4.5, 3.5) / alpha(1, 3.5, 3.5), 2e-5);
        const fifo = new Uint32Array((await history.read(0, history.byteSize, null, true)).buffer);
        expect([fifo[CENTER * 24], fifo[CENTER * 24 + 6]]).to.deep.equal([13, 0]);
    });

    it('includes background transmission and clears stale entries on reset', async function () {
        requireExecution.call(this);
        cachedOccluder(7);
        await samplePixels(0, 0, 0);
        dispatch();
        let actual = await weights.read(0, 0, WIDTH, HEIGHT, { immediate: true });
        expect(actual[CENTER * 4]).to.be.closeTo((1 - alpha(0, 4.5, 3.5)) / (1 - alpha(0, 3.5, 3.5)), 2e-5);
        compute.setParameter('steadyValid', 0);
        dispatch();
        actual = await weights.read(0, 0, WIDTH, HEIGHT, { immediate: true });
        expect(Array.from(actual)).to.deep.equal(Array(PIXELS * 4).fill(1));
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
        const spatialCompute = createCompute('SteadySpatialOracle', spatialSource);
        spatialCompute.setParameter('steadySize', [WIDTH, HEIGHT]);
        spatialCompute.setParameter('steadyRaw', raw);
        spatialCompute.setParameter('steadyWeights', weights);
        spatialCompute.setParameter('steadySpatial', spatial);
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
        const spatial = texture(PIXELFORMAT_RGBA16F);
        const previous = texture(PIXELFORMAT_RGBA16F);
        const output = texture(PIXELFORMAT_RGBA16F, true);
        const currentPixels = new Uint16Array(PIXELS * 4);
        const previousPixels = new Uint16Array(PIXELS * 4);
        for (let p = 0; p < PIXELS; p++) {
            currentPixels.set([0.125, 0.125, 0.125, 1].map(FloatPacking.float2Half), p * 4);
            previousPixels.set([2, 0, 0, 1].map(FloatPacking.float2Half), p * 4);
        }
        upload(raw, currentPixels);
        upload(spatial, currentPixels);
        upload(previous, previousPixels);
        await samplePixels(1, 7, 2);
        const projection = new Mat4().setPerspective(60, 1, 0.1, 100);
        Camera.applyShaderProjectionTransform(projection, projection, false, true);
        const temporal = createCompute('SteadyTemporalOracle', temporalSource);
        temporal.setParameter('steadySize', [WIDTH, HEIGHT]);
        temporal.setParameter('steadyValid', 1);
        temporal.setParameter('steadyRetention', 0.7);
        temporal.setParameter('steadyInverseProjection', new Mat4().invert(projection).data);
        temporal.setParameter('steadyInverseView', new Mat4().data);
        temporal.setParameter('steadyPreviousViewProjection', projection.data);
        temporal.setParameter('steadyRaw', raw);
        temporal.setParameter('steadySamples', samples);
        temporal.setParameter('steadySpatial', spatial);
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
});
