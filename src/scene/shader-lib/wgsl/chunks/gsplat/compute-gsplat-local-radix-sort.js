// Per-tile radix sort for tiles with up to 1976 entries.
// Uses 5×4-bit radix sort (16 buckets per pass) in 16KB shared memory,
// with ping-pong buffers. 1 element per thread per step.
// Requires subgroup support for stable scatter via subgroupBallot.
// Ballot processing uses only .x component — correct only for sgSize <= 32
// (NVIDIA, Intel, ARM Mali). Not safe for AMD wave64 or Qualcomm Adreno (sgSize 64+).
//
// Shared memory layout (16,384 bytes):
//   sA[1976]                = 7,904 bytes  (ping buffer)
//   sB[1976]                = 7,904 bytes  (pong buffer)
//   histogram[16]           =    64 bytes  (atomic, reused for min/max, histogram, prefix sums)
//   warpCounts[8×16=128]    =   512 bytes  (per-subgroup per-digit counts)
export const computeGsplatLocalRadixSortSource = /* wgsl */`

const RADIX_MAX_ENTRIES: u32 = 1976u;
const RADIX_WG_SIZE: u32 = 256u;
const RADIX_BITS: u32 = 4u;
const NUM_BUCKETS: u32 = 16u;
const BUCKET_MASK: u32 = 0xFu;
const NUM_PASSES: u32 = 5u;
const MAX_SUBGROUPS: u32 = 8u;
const INDEX_BITS: u32 = 11u;
const INDEX_MASK: u32 = 0x7FFu;
const DEPTH_LEVELS: f32 = 1048575.0;

var<workgroup> sA: array<u32, 1976>;
var<workgroup> sB: array<u32, 1976>;
var<workgroup> histogram: array<atomic<u32>, 16>;
var<workgroup> warpCounts: array<u32, 128>;

fn radixSortRange(localIdx: u32, sgInvId: u32, sgSize: u32, tStart: u32, count: u32) {
    let clampedCount = min(count, RADIX_MAX_ENTRIES);

    if (clampedCount <= 1u) {
        return;
    }

    let sgId = localIdx / sgSize;
    let numSgs = RADIX_WG_SIZE / sgSize;
    let sgInvMask = (1u << sgInvId) - 1u;

    // Phase 1: Load f32 depths into sA
    if (localIdx == 0u) {
        atomicStore(&histogram[0], 0xFFFFFFFFu);
        atomicStore(&histogram[1], 0u);
    }

    for (var i: u32 = localIdx; i < clampedCount; i += RADIX_WG_SIZE) {
        let entryIdx = tileEntries[tStart + i];
        sA[i] = depthBuffer[entryIdx];
    }

    workgroupBarrier();

    // Phase 2: Min/max reduction via atomics
    for (var i: u32 = localIdx; i < clampedCount; i += RADIX_WG_SIZE) {
        atomicMin(&histogram[0], sA[i]);
        atomicMax(&histogram[1], sA[i]);
    }

    workgroupBarrier();

    let depthMin = bitcast<f32>(atomicLoad(&histogram[0]));
    let depthMax = bitcast<f32>(atomicLoad(&histogram[1]));

    let logMin = log(max(depthMin, 1e-6));
    let logRange = log(max(depthMax, 1e-6)) - logMin;
    let invLogRange = select(DEPTH_LEVELS / logRange, 0.0, logRange < 1e-10);

    // Phase 3: Repack to (depth20 << 11 | localIndex11)
    for (var i: u32 = localIdx; i < clampedCount; i += RADIX_WG_SIZE) {
        let depth = bitcast<f32>(sA[i]);
        let logDepth = log(max(depth, 1e-6));
        let depth20 = min(u32((logDepth - logMin) * invLogRange + 0.5), u32(DEPTH_LEVELS));
        sA[i] = (depth20 << INDEX_BITS) | i;
    }

    workgroupBarrier();

    // Phase 4: 5-pass radix sort (4 bits per pass, bits 11..30).
    // After 5 passes (odd count), result is in sB.
    for (var p: u32 = 0u; p < NUM_PASSES; p++) {
        let bitOffset = INDEX_BITS + p * RADIX_BITS;
        let even = (p % 2u == 0u);

        // 4a: Zero histogram
        if (localIdx < NUM_BUCKETS) {
            atomicStore(&histogram[localIdx], 0u);
        }
        workgroupBarrier();

        // 4b: Build histogram
        for (var i: u32 = localIdx; i < clampedCount; i += RADIX_WG_SIZE) {
            var v: u32;
            if (even) { v = sA[i]; } else { v = sB[i]; }
            atomicAdd(&histogram[(v >> bitOffset) & BUCKET_MASK], 1u);
        }
        workgroupBarrier();

        // 4c: Exclusive prefix sum (single thread — only 16 entries)
        if (localIdx == 0u) {
            var sum: u32 = 0u;
            for (var d: u32 = 0u; d < NUM_BUCKETS; d++) {
                let c = atomicLoad(&histogram[d]);
                atomicStore(&histogram[d], sum);
                sum += c;
            }
        }
        workgroupBarrier();

        // 4d: Stable scatter — 1 element per thread, using subgroupBallot.
        // Ballot .x-only: correct only for sgSize <= 32 (NVIDIA, Intel, ARM Mali).
        let numSteps = (clampedCount + RADIX_WG_SIZE - 1u) / RADIX_WG_SIZE;

        for (var step: u32 = 0u; step < numSteps; step++) {
            let idx = step * RADIX_WG_SIZE + localIdx;
            let valid = idx < clampedCount;

            var val: u32 = 0u;
            var digit: u32 = 0u;
            if (valid) {
                if (even) { val = sA[idx]; } else { val = sB[idx]; }
                digit = (val >> bitOffset) & BUCKET_MASK;
            }

            var intraRank: u32 = 0u;

            for (var d: u32 = 0u; d < NUM_BUCKETS; d++) {
                let ballot = subgroupBallot(valid && digit == d);
                let cnt = countOneBits(ballot.x);

                if (valid && digit == d) {
                    intraRank = countOneBits(ballot.x & sgInvMask);
                }

                if (sgInvId == d) {
                    warpCounts[sgId * NUM_BUCKETS + d] = cnt;
                }
            }

            workgroupBarrier();

            if (valid) {
                var rank: u32 = atomicLoad(&histogram[digit]);
                for (var w: u32 = 0u; w < sgId; w++) {
                    rank += warpCounts[w * NUM_BUCKETS + digit];
                }
                rank += intraRank;
                if (even) { sB[rank] = val; } else { sA[rank] = val; }
            }

            workgroupBarrier();

            if (localIdx < NUM_BUCKETS) {
                var total: u32 = 0u;
                for (var w: u32 = 0u; w < numSgs; w++) {
                    total += warpCounts[w * NUM_BUCKETS + localIdx];
                }
                atomicAdd(&histogram[localIdx], total);
            }

            workgroupBarrier();
        }
    }

    // After 5 passes (odd count), sorted data is in sB.

    // Phase 5: Extract local indices and write sorted global entries back.
    for (var i: u32 = localIdx; i < clampedCount; i += RADIX_WG_SIZE) {
        let localIndex = sB[i] & INDEX_MASK;
        sA[i] = tileEntries[tStart + localIndex];
    }

    workgroupBarrier();

    for (var i: u32 = localIdx; i < clampedCount; i += RADIX_WG_SIZE) {
        tileEntries[tStart + i] = sA[i];
    }
}
`;
