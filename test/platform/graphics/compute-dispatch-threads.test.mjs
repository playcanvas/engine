import { expect } from 'chai';
import sinon from 'sinon';

import { Compute } from '../../../src/platform/graphics/compute.js';
import { BUFFERUSAGE_COPY_SRC, SHADERLANGUAGE_WGSL } from '../../../src/platform/graphics/constants.js';
import { Shader } from '../../../src/platform/graphics/shader.js';
import { StorageBuffer } from '../../../src/platform/graphics/storage-buffer.js';
import { WebgpuShaderProcessorWGSL } from '../../../src/platform/graphics/webgpu/webgpu-shader-processor-wgsl.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * @import { Application } from '../../../src/framework/application.js'
 */

// Dawn's null backend validates the API and compiles the shaders, but executes no GPU work, so the
// values the shaders compute are only checked on a backend which runs them
const executesGpuWork = !!process.env.PC_WEBGPU_BACKEND && process.env.PC_WEBGPU_BACKEND !== 'null';

describe('WebgpuShaderProcessorWGSL.getWorkgroupSize', function () {

    const getSize = (source, entryPoint = 'main') => WebgpuShaderProcessorWGSL.getWorkgroupSize(source, entryPoint);

    it('reads the workgroup size, defaulting y and z to 1', function () {
        expect(getSize('@compute @workgroup_size(64) fn main() {}')).to.deep.equal([64, 1, 1]);
        expect(getSize('@compute @workgroup_size(8, 8) fn main() {}')).to.deep.equal([8, 8, 1]);
        expect(getSize('@compute @workgroup_size(4, 4, 4,) fn main() {}')).to.deep.equal([4, 4, 4]);
    });

    it('reads literals with a suffix', function () {
        expect(getSize('@compute @workgroup_size(64u, 4i) fn main() {}')).to.deep.equal([64, 4, 1]);
    });

    it('reads the attributes in any order, across lines', function () {
        const source = `
            @workgroup_size(16, 16)
            @compute
            fn main(@builtin(global_invocation_id) id: vec3u) {}
        `;
        expect(getSize(source)).to.deep.equal([16, 16, 1]);
    });

    it('does not resolve names', function () {
        expect(getSize('const SIZE = 64u; @compute @workgroup_size(SIZE) fn main() {}')).to.equal(null);
        expect(getSize('override SIZE = 64; @compute @workgroup_size(SIZE) fn main() {}')).to.equal(null);

        // a function-local constant of the same name, which is not in scope of the attribute
        const shadowed = `
            fn helper() -> u32 { const SIZE = 128u; return SIZE; }
            const SIZE = 64u;
            @compute @workgroup_size(SIZE) fn main() {}
        `;
        expect(getSize(shadowed)).to.equal(null);
    });

    it('reads the attribute of the entry point', function () {
        const source = `
            @compute @workgroup_size(32) fn first() {}
            @compute @workgroup_size(8, 4) fn second() {}
        `;
        expect(getSize(source, 'first')).to.deep.equal([32, 1, 1]);
        expect(getSize(source, 'second')).to.deep.equal([8, 4, 1]);
    });

    it('ignores comments', function () {
        const source = `
            // @workgroup_size(1)
            /* @workgroup_size(2) */
            @compute @workgroup_size(128) fn main() {}
        `;
        expect(getSize(source)).to.deep.equal([128, 1, 1]);
    });

    it('returns null when the size cannot be determined', function () {
        expect(getSize('@compute @workgroup_size(32 * 2) fn main() {}')).to.equal(null);
        expect(getSize('@compute @workgroup_size(0x40) fn main() {}')).to.equal(null);
        expect(getSize('@compute fn main() {}')).to.equal(null);
        expect(getSize('@compute @workgroup_size(64) fn other() {}')).to.equal(null);
    });
});

describe('Compute#setupDispatchThreads', function () {

    // stands in for a device with a compute backend, and for a shader with a workgroup size, which
    // declares the uniforms of the dispatchThreadsCS chunk when it includes it
    const createCompute = (workgroupSize, includesChunk = true, maxDimension = 65535) => {
        const device = {
            supportsCompute: true,
            limits: { maxComputeWorkgroupsPerDimension: maxDimension },
            createComputeImpl: () => ({ destroy() {} })
        };
        const uniforms = new Map(includesChunk ? [['computeDispatchThreadCount', {}], ['computeDispatchRowThreads', {}]] : []);
        const shader = { impl: { computeWorkgroupSize: workgroupSize, computeReflectedUniformBufferFormat: uniforms } };
        return new Compute(/** @type {any} */ (device), /** @type {any} */ (shader), 'Test');
    };

    const dispatchSize = compute => [compute.countX, compute.countY, compute.countZ];

    const captureConsole = (method) => {
        const messages = [];
        sinon.stub(console, method).callsFake((...args) => {
            messages.push(args.map(String).join(' '));
        });
        return messages;
    };

    afterEach(function () {
        sinon.restore();
    });

    it('dispatches whole workgroups for the threads', function () {
        const compute = createCompute([64, 1, 1]);
        compute.setupDispatchThreads(100);
        expect(dispatchSize(compute)).to.deep.equal([2, 1, 1]);

        const grid = createCompute([8, 8, 1]);
        grid.setupDispatchThreads(100, 50);
        expect(dispatchSize(grid)).to.deep.equal([13, 7, 1]);

        const volume = createCompute([4, 4, 4]);
        volume.setupDispatchThreads(16, 17, 3);
        expect(dispatchSize(volume)).to.deep.equal([4, 5, 1]);
    });

    it('sets the thread count and the threads in a row for the chunk', function () {
        const compute = createCompute([8, 8, 1]);
        compute.setupDispatchThreads(100, 50);
        expect(Array.from(compute.getParameter('computeDispatchThreadCount'))).to.deep.equal([100, 50, 1]);
        expect(compute.getParameter('computeDispatchRowThreads')).to.equal(100);
    });

    it('does not set the parameters of the chunk when the shader does not include it', function () {
        const compute = createCompute([64, 1, 1], false);
        compute.setupDispatchThreads(100);
        expect(compute.parameters.size).to.equal(0);
    });

    it('spreads a dispatch in one dimension over rows of workgroups when it needs to', function () {
        const compute = createCompute([64, 1, 1], true, 4);
        compute.setupDispatchThreads(64 * 10);

        // 10 workgroups do not fit in a dimension of 4, and are spread over 3 rows of 4
        expect(dispatchSize(compute)).to.deep.equal([4, 3, 1]);
        expect(compute.getParameter('computeDispatchRowThreads')).to.equal(4 * 64);
    });

    it('reports a dispatch spread over rows when the shader does not include the chunk', function () {
        const messages = captureConsole('error');
        const compute = createCompute([64, 1, 1], false, 4);
        compute.setupDispatchThreads(64 * 10);
        expect(messages.some(m => m.includes('dispatchThreadsCS'))).to.equal(true);
    });

    it('reports a dispatch in more dimensions which needs too many workgroups', function () {
        const messages = captureConsole('error');
        const compute = createCompute([8, 8, 1], true, 4);
        compute.setupDispatchThreads(64, 8);
        expect(messages.some(m => m.includes('more than the 4'))).to.equal(true);
    });

    it('warns when the workgroup has more dimensions than the dispatch', function () {
        const messages = captureConsole('warn');
        const compute = createCompute([8, 8, 1]);
        compute.setupDispatchThreads(100);
        expect(messages.some(m => m.includes('more dimensions'))).to.equal(true);
    });

    it('reports a shader without a workgroup size it can determine', function () {
        const messages = captureConsole('error');
        const compute = createCompute(null);
        compute.setupDispatchThreads(100);
        expect(messages.some(m => m.includes('cannot determine the workgroup size'))).to.equal(true);
    });

    it('cannot have the parameters of the chunk set', function () {
        const messages = captureConsole('error');
        const compute = createCompute([64, 1, 1]);
        compute.setParameter('computeDispatchRowThreads', 1);
        expect(messages.some(m => m.includes('assigned by setupDispatchThreads'))).to.equal(true);
    });
});

describe('Compute#setupDispatchThreads on the GPU', function () {
    /** @type {Application} */
    let app;

    /** @type {import('../../../src/platform/graphics/graphics-device.js').GraphicsDevice} */
    let device;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        device = app.graphicsDevice;
        if (!device.supportsCompute) {
            this.skip();
        }
    });

    afterEach(function () {
        sinon.restore();
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    // writes one more than the index of each thread in range, so threads which are not are left 0
    const source = /* wgsl */`
        #include "dispatchThreadsCS"

        var<storage, read_write> result: array<u32>;

        @compute @workgroup_size({WORKGROUP_SIZE})
        fn main(@builtin(global_invocation_id) id: vec3u) {
            if (!dispatchThreadInRange(id)) { return; }
            let index = dispatchThreadIndex(id);
            result[index] = index + 1u;
        }
    `;

    it('reads the workgroup size of the shader from a define, and indexes the threads spread over rows', async function () {
        // the workgroup size is injected into the shader as a define
        const shader = new Shader(device, {
            name: 'DispatchThreadsTest',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            cshader: source,
            cdefines: new Map([['{WORKGROUP_SIZE}', '4']])
        });
        expect(shader.impl.computeWorkgroupSize).to.deep.equal([4, 1, 1]);

        // a limit of 2 workgroups in a dimension spreads the 3 workgroups of the 10 threads over
        // 2 rows of 2
        const threads = 10;
        sinon.stub(device, 'limits').value({ ...device.limits, maxComputeWorkgroupsPerDimension: 2 });

        const results = new StorageBuffer(device, 16 * 4, BUFFERUSAGE_COPY_SRC);
        const compute = new Compute(device, shader, 'DispatchThreadsTest');
        compute.setParameter('result', results);
        compute.setupDispatchThreads(threads);
        expect([compute.countX, compute.countY, compute.countZ]).to.deep.equal([2, 2, 1]);

        device.computeDispatch([compute], 'DispatchThreadsTest');
        const data = await results.read(0, 16 * 4, new Uint32Array(16), true);
        if (executesGpuWork) {
            const expected = Array.from({ length: 16 }, (_, i) => (i < threads ? i + 1 : 0));
            expect(Array.from(data)).to.deep.equal(expected);
        }

        compute.destroy();
        shader.destroy();
        results.destroy();
    });
});
