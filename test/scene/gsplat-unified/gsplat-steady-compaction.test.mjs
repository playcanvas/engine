import { expect } from 'chai';

import { Vec2 } from '../../../src/core/math/vec2.js';
import { Compute } from '../../../src/platform/graphics/compute.js';
import { BUFFERUSAGE_COPY_DST, BUFFERUSAGE_COPY_SRC } from '../../../src/platform/graphics/constants.js';
import { StorageBuffer } from '../../../src/platform/graphics/storage-buffer.js';
import { GSplatHybridRendererScratch } from '../../../src/scene/gsplat-unified/gsplat-hybrid-renderer-scratch.js';
import { GSplatIntervalCompaction } from '../../../src/scene/gsplat-unified/gsplat-interval-compaction.js';
import { GSplatSteadyCompaction, buildGSplatSteadyIntervals, STEADY_INTERVAL_SIZE } from '../../../src/scene/gsplat-unified/gsplat-steady-compaction.js';
import { createGraphicsDevice } from '../../device.mjs';

describe('GSplat SteadySplats interval scheduling', function () {
    it('splits only SteadySplats metadata while preserving native intervals, bounds and output order', function () {
        const intervals = new Uint32Array([
            100, 0, 0, 0,
            200, 1, 1, 0,
            300, STEADY_INTERVAL_SIZE, 2, 0,
            10000, STEADY_INTERVAL_SIZE + 1, 3, 0
        ]);
        const original = intervals.slice();
        expect(Array.from(buildGSplatSteadyIntervals(intervals))).to.deep.equal([
            100, 0, 0, 0,
            200, 1, 1, 0,
            300, STEADY_INTERVAL_SIZE, 2, 0,
            10000, STEADY_INTERVAL_SIZE, 3, 0,
            10000 + STEADY_INTERVAL_SIZE, 1, 3, 0
        ]);
        expect(intervals).to.deep.equal(original);
        expect(buildGSplatSteadyIntervals(new Uint32Array())).to.have.length(0);
        expect(buildGSplatSteadyIntervals(new Uint32Array(4))).to.deep.equal(new Uint32Array(4));
    });

    const cases = [
        { name: 'a large contiguous model', counts: [3211894], visible: [true] },
        { name: 'mixed sizes and invisible intervals', counts: [0, 1, 4096, 4097, 131077, 29], visible: [true, true, false, true, true, false] },
        { name: 'an entirely culled model', counts: [8193, 13], visible: [false, false] },
        { name: 'a tiled dispatch with partial final workgroups', counts: Array(8).fill(4097), visible: Array(8).fill(true), tiled: true }
    ];

    for (const Compaction of [GSplatIntervalCompaction, GSplatSteadyCompaction]) {
        for (const config of cases) {
            it(`${Compaction.name} preserves exact output indices for ${config.name}`, async function () {
                if (!process.env.PC_WEBGPU_BACKEND || process.env.PC_WEBGPU_BACKEND === 'null') this.skip();
                const device = createGraphicsDevice({ width: 8, height: 8 });
                const scratch = new GSplatHybridRendererScratch(device);
                const compaction = new Compaction(device, scratch);
                const buffers = [];
                const buffer = (data) => {
                    const result = new StorageBuffer(device, data.byteLength, BUFFERUSAGE_COPY_SRC | BUFFERUSAGE_COPY_DST);
                    result.write(0, data);
                    buffers.push(result);
                    return result;
                };
                const compute = new Compute(device, compaction._scatterShader);
                try {
                    const intervals = new Uint32Array(config.counts.length * 4);
                    const expected = [];
                    for (let i = 0; i < config.counts.length; i++) {
                        const base = 0x80000001 + i * 4000000;
                        intervals.set([base, config.counts[i], i, 0], i * 4);
                        if (config.visible[i]) {
                            for (let j = 0; j < config.counts[i]; j++) expected.push(base + j);
                        }
                    }
                    const data = Compaction === GSplatSteadyCompaction ? buildGSplatSteadyIntervals(intervals) : intervals;
                    const numIntervals = data.length / 4;
                    const prefix = new Uint32Array(numIntervals + 1);
                    for (let i = 0; i < numIntervals; i++) {
                        prefix[i + 1] = prefix[i] + (config.visible[data[i * 4 + 2]] ? data[i * 4 + 1] : 0);
                    }
                    compaction.uploadIntervals({
                        version: 1,
                        totalIntervals: config.counts.length,
                        splats: config.counts.map((count, i) => ({
                            intervals: [],
                            intervalOffsets: [intervals[i * 4]],
                            activeSplats: count,
                            boundsBaseIndex: i
                        }))
                    });
                    if (Compaction === GSplatSteadyCompaction) {
                        expect(compaction.numIntervals).to.equal(numIntervals);
                    }
                    const sentinel = 0xdeadbeef;
                    const output = buffer(new Uint32Array(expected.length + 23).fill(sentinel));
                    compute.setParameter('intervals', compaction.intervalsBuffer);
                    compute.setParameter('prefixSumBuffer', buffer(prefix));
                    compute.setParameter('compactedOutput', output);
                    compute.setParameter('numIntervals', numIntervals);
                    compute.setParameter('pad0', 0);
                    compute.setParameter('pad1', 0);
                    compute.setParameter('pad2', 0);
                    const dispatch = new Vec2();
                    Compute.calcDispatchSize(numIntervals, dispatch, config.tiled ? 7 : device.limits.maxComputeWorkgroupsPerDimension);
                    compute.setupDispatch(dispatch.x, dispatch.y, 1);
                    device.computeDispatch([compute]);
                    device.submit();
                    const bytes = await output.read(0, output.byteSize, null, true);
                    const actual = new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
                    let mismatch = -1;
                    for (let i = 0; i < actual.length; i++) {
                        if (actual[i] !== (i < expected.length ? expected[i] : sentinel)) {
                            mismatch = i;
                            break;
                        }
                    }
                    expect(mismatch).to.equal(-1);

                    // Exercise the complete pipeline with independent bounds and expected indices,
                    // including the expanded prefix-sum sentinel used by indirect argument writes.
                    const bounds = new Float32Array(config.counts.length * 8);
                    for (let i = 0; i < config.counts.length; i++) {
                        bounds[i * 8] = config.visible[i] ? 0 : 10;
                        bounds[i * 8 + 3] = 1;
                    }
                    compaction.dispatchCompact({
                        boundsBuffer: buffer(bounds),
                        transformsBuffer: buffer(new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0])),
                        frustumPlanes: new Float32Array([
                            1, 0, 0, 5, -1, 0, 0, 5, 0, 1, 0, 5,
                            0, -1, 0, 5, 0, 0, 1, 5, 0, 0, -1, 5
                        ])
                    }, numIntervals, config.counts.reduce((sum, value) => sum + value, 0), false);
                    compaction.writeIndirectArgs(device.getIndirectDrawSlot(), device.getIndirectDispatchSlot(),
                        numIntervals, new Uint32Array(4));
                    device.submit();
                    const countBytes = await compaction.numSplatsBuffer.read(0, 4, null, true);
                    expect(new Uint32Array(countBytes.buffer, countBytes.byteOffset, 1)[0]).to.equal(expected.length);
                    if (expected.length) {
                        const compacted = await compaction.compactedSplatIds.read(0, expected.length * 4, null, true);
                        const indices = new Uint32Array(compacted.buffer, compacted.byteOffset, expected.length);
                        let indexMismatch = -1;
                        for (let i = 0; i < expected.length; i++) {
                            if (indices[i] !== expected[i]) {
                                indexMismatch = i;
                                break;
                            }
                        }
                        expect(indexMismatch).to.equal(-1);
                    }
                } finally {
                    compute.destroy();
                    buffers.forEach(value => value.destroy());
                    compaction.destroy();
                    scratch.destroy();
                    device.destroy();
                }
            });
        }
    }
});
