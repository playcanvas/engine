import { expect } from 'chai';

import { GpuProfiler } from '../../../src/platform/graphics/gpu-profiler.js';
import { WebglGpuProfiler } from '../../../src/platform/graphics/webgl/webgl-gpu-profiler.js';
import { WebgpuGpuProfiler } from '../../../src/platform/graphics/webgpu/webgpu-gpu-profiler.js';

describe('GpuProfiler frame timing', function () {
    let profiler;

    beforeEach(function () {
        profiler = new GpuProfiler();
        profiler.enabled = true;
        profiler.processEnableRequest();
    });

    const request = (profiler, version) => {
        profiler.getSlot('First');
        profiler.getSlot('Second');
        profiler.request(version);
    };

    it('waits for a result and uses the GPU frame span instead of summing overlapping passes', function () {
        expect(profiler.frameTime).to.equal(undefined);
        request(profiler, 1);
        expect(profiler.frameTime).to.equal(undefined);
        profiler.report(1, [3, 4], 5);
        expect(profiler.frameTime).to.equal(5);
    });

    it('accepts a valid zero-duration result', function () {
        request(profiler, 1);
        profiler.report(1, [0, 0], 0);
        expect(profiler.frameTime).to.equal(0);
    });

    it('does not treat an empty report as a valid measurement', function () {
        profiler.request(1);
        profiler.report(1, [], 0);
        expect(profiler.frameTime).to.equal(undefined);
    });

    it('invalidates immediately on disable and rejects delayed results after re-enabling', function () {
        request(profiler, 1);
        profiler.report(1, [3, 4], 5);
        request(profiler, 2);
        profiler.enabled = false;
        expect(profiler.frameTime).to.equal(undefined);
        profiler.enabled = true;
        profiler.processEnableRequest();
        profiler.report(2, [10, 10], 20);
        expect(profiler.frameTime).to.equal(undefined);
        request(profiler, 3);
        profiler.report(3, [1, 2], 2);
        expect(profiler.frameTime).to.equal(2);
    });

    it('keeps a valid result when enablement is unchanged', function () {
        request(profiler, 1);
        profiler.report(1, [3, 4], 5);
        profiler.enabled = true;
        expect(profiler.frameTime).to.equal(5);
    });

    it('invalidates on context loss and rejects pending reports', function () {
        request(profiler, 1);
        profiler.report(1, [3, 4], 5);
        request(profiler, 2);
        profiler.loseContext();
        profiler.report(2, [10, 10], 20);
        expect(profiler.frameTime).to.equal(undefined);
        expect(profiler.passTimings.size).to.equal(0);
    });

    it('leaves unsupported WebGL and WebGPU devices unavailable even when enabled', function () {
        const profilers = [
            new WebglGpuProfiler({ extDisjointTimerQuery: null, gl: {}, renderVersion: 1 }),
            new WebgpuGpuProfiler({ supportsTimestampQuery: false, renderVersion: 1 })
        ];
        for (const gpuProfiler of profilers) {
            gpuProfiler.enabled = true;
            gpuProfiler.frameStart();
            gpuProfiler.frameEnd();
            gpuProfiler.request();
            expect(gpuProfiler.frameTime).to.equal(undefined);
            gpuProfiler.destroy();
        }
    });

    it('invalidates WebGL measurements after a disjoint query', function () {
        const gl = {
            getQueryParameter: () => true,
            getParameter: () => true
        };
        const gpuProfiler = new WebglGpuProfiler({ extDisjointTimerQuery: {}, gl, renderVersion: 3 });
        gpuProfiler.enabled = true;
        gpuProfiler.processEnableRequest();
        gpuProfiler.getSlot('GpuFrame');
        GpuProfiler.prototype.request.call(gpuProfiler, 1);
        gpuProfiler.report(1, [2]);
        expect(gpuProfiler.frameTime).to.equal(2);
        gpuProfiler.previousFrameQueries.push({ renderVersion: 2, queries: [{}], destroy() {} });
        gpuProfiler.request();
        expect(gpuProfiler.frameTime).to.equal(undefined);
        gpuProfiler.destroy();
    });
});
