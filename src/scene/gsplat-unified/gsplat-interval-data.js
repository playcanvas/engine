/**
 * @import { GSplatWorldState } from './gsplat-world-state.js'
 */

// 4 u32 per interval: { workBufferBase, splatCount, boundsIndex, pad }
const INTERVAL_STRIDE = 4;

/**
 * Builds the flat interval metadata array for a world state, shared by the forward GPU-sort path
 * ({@link GSplatIntervalCompaction}) and the directional-shadow path ({@link GSplatShadowRenderer}).
 *
 * Each interval is a contiguous run of work-buffer splat slots for one octree node (or one whole
 * splat in the non-octree case), packed as 4 u32s:
 * - `workBufferBase` — first work-buffer pixel index of the run
 * - `splatCount` — number of splats in the run
 * - `boundsIndex` — index into the frustum culler's per-node bounds (for coarse sphere culling)
 * - `pad` — padding to 16 bytes
 *
 * @param {GSplatWorldState} worldState - The world state to extract intervals from.
 * @returns {Uint32Array} The packed interval data (`worldState.totalIntervals * INTERVAL_STRIDE` u32s).
 */
function buildGSplatIntervalData(worldState) {
    const splats = worldState.splats;
    const numIntervals = worldState.totalIntervals;

    const data = new Uint32Array(numIntervals * INTERVAL_STRIDE);
    let writeIdx = 0;

    for (let s = 0; s < splats.length; s++) {
        const splat = splats[s];

        if (splat.intervals.length > 0) {
            // Octree: each interval has its own offset from per-node allocation
            const nodeIndices = splat.intervalNodeIndices;
            for (let i = 0; i < splat.intervals.length; i += 2) {
                const count = splat.intervals[i + 1] - splat.intervals[i];
                data[writeIdx++] = splat.intervalOffsets[i / 2];
                data[writeIdx++] = count;
                data[writeIdx++] = splat.boundsBaseIndex + (nodeIndices.length > 0 ? nodeIndices[i / 2] : 0);
                data[writeIdx++] = 0;
            }
        } else {
            // Non-octree: single interval covering the entire splat
            data[writeIdx++] = splat.intervalOffsets[0];
            data[writeIdx++] = splat.activeSplats;
            data[writeIdx++] = splat.boundsBaseIndex;
            data[writeIdx++] = 0;
        }
    }

    return data;
}

export { buildGSplatIntervalData, INTERVAL_STRIDE };
