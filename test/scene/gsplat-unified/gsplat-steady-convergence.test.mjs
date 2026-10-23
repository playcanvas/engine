import { expect } from 'chai';

import { FloatPacking } from '../../../src/core/math/float-packing.js';
import { Compute } from '../../../src/platform/graphics/compute.js';
import {
    BUFFERUSAGE_COPY_DST, BUFFERUSAGE_COPY_SRC, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F,
    SHADERLANGUAGE_WGSL
} from '../../../src/platform/graphics/constants.js';
import { Shader } from '../../../src/platform/graphics/shader.js';
import { StorageBuffer } from '../../../src/platform/graphics/storage-buffer.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import resolveSource from '../../../src/scene/shader-lib/wgsl/chunks/gsplat/compute-gsplat-steady-resolve.js';
import { createGraphicsDevice } from '../../device.mjs';

describe('GSplat SteadySplats stationary average', function () {
    const width = 8;
    const height = 8;
    const center = 3 + 3 * width;
    let device;
    let raw;
    let weights;
    let output;
    let average;
    let shader;
    let compute;

    const upload = (texture, values) => {
        texture.lock().set(values);
        texture.unlock();
    };
    const dispatch = (frames) => {
        compute.setParameter('steadyRestFrames', frames);
        device.computeDispatch([compute]);
        device.submit();
    };
    const readAverage = async () => {
        const bytes = await average.read(0, average.byteSize, null, true);
        return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
    };
    const requireExecution = function () {
        if (!process.env.PC_WEBGPU_BACKEND || process.env.PC_WEBGPU_BACKEND === 'null') this.skip();
    };

    beforeEach(function () {
        device = createGraphicsDevice({ width, height });
        if (!device.isWebGPU) this.skip();
        raw = new Texture(device, { width, height, format: PIXELFORMAT_RGBA16F, mipmaps: false });
        weights = new Texture(device, { width, height, format: PIXELFORMAT_RGBA32F, mipmaps: false });
        output = new Texture(device, { width, height, format: PIXELFORMAT_RGBA16F, storage: true, mipmaps: false });
        average = new StorageBuffer(device, width * height * 16, BUFFERUSAGE_COPY_SRC | BUFFERUSAGE_COPY_DST);
        shader = new Shader(device, {
            name: 'SteadyConvergenceOracle',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: resolveSource,
            cdefines: new Map([['STEADY_CONVERGENCE', '']])
        });
        compute = new Compute(device, shader);
        compute.setParameter('steadySize', [width, height]);
        compute.setParameter('steadyCameraStill', 0);
        compute.setParameter('steadyRaw', raw);
        compute.setParameter('steadyWeights', weights);
        compute.setParameter('steadyOutput', output);
        compute.setParameter('steadyRest', average);
        compute.setParameter('steadyRowStart', 0);
        compute.setParameter('steadyRowCount', height);
        compute.setupDispatch(1, 1, 1);
        upload(weights, new Float32Array(width * height * 4).fill(1));
        const pixels = new Uint16Array(width * height * 4);
        pixels[center * 4] = FloatPacking.float2Half(1);
        pixels[center * 4 + 3] = FloatPacking.float2Half(1);
        upload(raw, pixels);
    });

    afterEach(function () {
        compute?.destroy();
        shader?.destroy();
        average?.destroy();
        raw?.destroy();
        weights?.destroy();
        output?.destroy();
        compute = shader = average = raw = weights = output = null;
        device?.destroy();
    });

    it('switches from spatial estimates to a full-precision raw-sample average after eight frames', async function () {
        requireExecution.call(this);
        for (let frame = 1; frame <= 8; frame++) dispatch(frame);
        const initial = await readAverage();
        expect(initial[center * 4]).to.be.closeTo(0.2, 1e-7);
        dispatch(9);
        const current = await readAverage();
        const expected = (8 * 0.2 + 1) / 9;
        expect(current[center * 4]).to.be.closeTo(expected, 1e-7);
        expect(current[center * 4 + 3]).to.be.closeTo(expected, 1e-7);
        const image = await output.read(3, 3, 1, 1, { immediate: true });
        const expectedOutput = FloatPacking.float2Half(0.2 + (expected - 0.2) * 9 / 17);
        expect(Math.abs(image[0] - expectedOutput)).to.be.at.most(1);
    });

    it('leaves the average alone during motion and overwrites it when the camera stops again', async function () {
        requireExecution.call(this);
        dispatch(1);
        await readAverage();
        const pixels = new Uint16Array(width * height * 4);
        pixels[center * 4 + 2] = FloatPacking.float2Half(1);
        pixels[center * 4 + 3] = FloatPacking.float2Half(1);
        upload(raw, pixels);
        dispatch(0);
        expect((await readAverage())[center * 4]).to.be.closeTo(0.2, 1e-7);
        dispatch(1);
        const current = await readAverage();
        expect(current[center * 4]).to.equal(0);
        expect(current[center * 4 + 2]).to.be.closeTo(0.2, 1e-7);
    });

    it('addresses a partial row band locally without touching other output rows', async function () {
        requireExecution.call(this);
        compute.setParameter('steadyRowStart', 3);
        compute.setParameter('steadyRowCount', 2);
        upload(output, new Uint16Array(width * height * 4).fill(FloatPacking.float2Half(0.75)));
        average.write(0, new Float32Array(width * height * 4).fill(-1));
        dispatch(1);
        const current = await readAverage();
        expect(current[3 * 4]).to.be.closeTo(0.2, 1e-7);
        expect(current[2 * width * 4]).to.equal(-1);
        const image = await output.read(0, 0, width, height, { immediate: true });
        expect(image[center * 4]).to.equal(FloatPacking.float2Half(0.2));
        expect(image[(3 + 2 * width) * 4]).to.equal(FloatPacking.float2Half(0.75));
        expect(image[(3 + 5 * width) * 4]).to.equal(FloatPacking.float2Half(0.75));
    });
});
