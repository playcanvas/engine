import { DebugHelper } from '../../core/debug.js';
import { BUFFERUSAGE_COPY_DST } from '../../platform/graphics/constants.js';
import { StorageBuffer } from '../../platform/graphics/storage-buffer.js';
import { GSplatIntervalCompaction } from './gsplat-interval-compaction.js';
import { buildGSplatIntervalData, INTERVAL_STRIDE } from './gsplat-interval-data.js';

/**
 * @import { GSplatWorldState } from './gsplat-world-state.js'
 */

// Bound each workgroup to 16 runs of 256 consecutive indices in the existing scatter shader.
const STEADY_INTERVAL_SIZE = 4096;

/**
 * Splits large intervals for SteadySplats while retaining their bounds and output order. Small
 * and empty intervals keep one entry. The source metadata belongs to the native renderers.
 *
 * @param {Uint32Array} intervals - Original packed interval metadata.
 * @returns {Uint32Array} SteadySplats interval metadata with bounded splat counts.
 * @ignore
 */
function buildGSplatSteadyIntervals(intervals) {
    let count = 0;
    for (let i = 0; i < intervals.length; i += INTERVAL_STRIDE) {
        count += Math.max(1, Math.ceil(intervals[i + 1] / STEADY_INTERVAL_SIZE));
    }
    const data = new Uint32Array(count * INTERVAL_STRIDE);
    let write = 0;
    for (let i = 0; i < intervals.length; i += INTERVAL_STRIDE) {
        const splatCount = intervals[i + 1];
        for (let start = 0; start < Math.max(1, splatCount); start += STEADY_INTERVAL_SIZE) {
            data[write++] = intervals[i] + start;
            data[write++] = Math.min(STEADY_INTERVAL_SIZE, splatCount - start);
            data[write++] = intervals[i + 2];
            data[write++] = intervals[i + 3];
        }
    }
    return data;
}

/**
 * SteadySplats-only interval scheduling. Reuses the native cull, prefix sum and scatter without
 * changing their shaders or dispatch behavior for sorted rendering, picking or shadows.
 *
 * @ignore
 */
class GSplatSteadyCompaction extends GSplatIntervalCompaction {
    numIntervals = 0;

    /**
     * Builds bounded intervals only when world metadata changes. The native compactor has its own
     * buffers and version tracking, so picking and sorted fallback retain the original metadata.
     *
     * @param {GSplatWorldState} worldState - Render-ready world state.
     */
    uploadIntervals(worldState) {
        if (worldState.version === this._uploadedVersion) return;
        this._uploadedVersion = worldState.version;
        this.numIntervals = 0;
        if (worldState.totalIntervals === 0) return;

        const data = buildGSplatSteadyIntervals(buildGSplatIntervalData(worldState));
        this.numIntervals = data.length / INTERVAL_STRIDE;
        if (this.numIntervals > this.allocatedIntervalCount) {
            this.intervalsBuffer?.destroy();
            this.allocatedIntervalCount = this.numIntervals;
            this.intervalsBuffer = new StorageBuffer(this.device, data.byteLength, BUFFERUSAGE_COPY_DST);
            DebugHelper.setName(this.intervalsBuffer, 'GsplatSteadyCompaction.intervals');
        }
        this.intervalsBuffer.write(0, data);
    }
}

export { GSplatSteadyCompaction, buildGSplatSteadyIntervals, STEADY_INTERVAL_SIZE };
