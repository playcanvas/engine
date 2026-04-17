// Shared bitonic sort logic for per-tile sorting of splat entries.
// Included by both the small-tile sort and chunk-sort shaders.
// Expects the including shader to declare:
//   var<storage, read_write> tileEntries: array<u32>;
//   var<storage, read> depthBuffer: array<u32>;
export const computeGsplatLocalBitonicSource = /* wgsl */`

const MAX_TILE_ENTRIES: u32 = 4096u;
const INDEX_BITS: u32 = 12u;
const INDEX_MASK: u32 = 0xFFFu;
const DEPTH_LEVELS: f32 = 1048575.0;
const BITONIC_WG_SIZE: u32 = 256u;

var<workgroup> sData: array<u32, 4096>;
var<workgroup> sDepthMin: atomic<u32>;
var<workgroup> sDepthMax: atomic<u32>;

fn insertZeroBit(v: u32, bitPos: u32) -> u32 {
    let mask = (1u << bitPos) - 1u;
    return ((v >> bitPos) << (bitPos + 1u)) | (v & mask);
}

fn bitonicSortRange(localIdx: u32, tStart: u32, count: u32) {
    let clampedCount = min(count, MAX_TILE_ENTRIES);

    if (clampedCount <= 1u) {
        return;
    }

    // Phase 1: Load f32 depths (as bitcast u32) into shared memory
    if (localIdx == 0u) {
        atomicStore(&sDepthMin, 0xFFFFFFFFu);
        atomicStore(&sDepthMax, 0u);
    }

    var sortN: u32 = 1u;
    while (sortN < clampedCount) {
        sortN = sortN << 1u;
    }

    for (var i: u32 = localIdx; i < sortN; i += BITONIC_WG_SIZE) {
        if (i < clampedCount) {
            let entryIdx = tileEntries[tStart + i];
            sData[i] = depthBuffer[entryIdx];
        } else {
            sData[i] = 0xFFFFFFFFu;
        }
    }

    workgroupBarrier();

    // Phase 2: Per-tile min/max reduction via atomics
    for (var i: u32 = localIdx; i < clampedCount; i += BITONIC_WG_SIZE) {
        atomicMin(&sDepthMin, sData[i]);
        atomicMax(&sDepthMax, sData[i]);
    }

    workgroupBarrier();

    let depthMinU = atomicLoad(&sDepthMin);
    let depthMaxU = atomicLoad(&sDepthMax);
    let depthMin = bitcast<f32>(depthMinU);
    let depthMax = bitcast<f32>(depthMaxU);

    // Logarithmic quantization: more precision for near depths, less for far,
    // matching the bucket sort's approach. Reduces depth collisions at distance.
    let logMin = log(max(depthMin, 1e-6));
    let logRange = log(max(depthMax, 1e-6)) - logMin;
    let invLogRange = select(DEPTH_LEVELS / logRange, 0.0, logRange < 1e-10);

    // Phase 3: In-place repack to (depth20 << 12 | localIndex12)
    for (var i: u32 = localIdx; i < sortN; i += BITONIC_WG_SIZE) {
        if (i < clampedCount) {
            let depth = bitcast<f32>(sData[i]);
            let logDepth = log(max(depth, 1e-6));
            let depth20 = min(u32((logDepth - logMin) * invLogRange + 0.5), u32(DEPTH_LEVELS));
            sData[i] = (depth20 << INDEX_BITS) | i;
        } else {
            sData[i] = 0xFFFFFFFFu;
        }
    }

    workgroupBarrier();

    // Phase 4: Bitonic sort on packed values
    for (var k: u32 = 2u; k <= sortN; k = k << 1u) {
        for (var j: u32 = k >> 1u; j > 0u; j = j >> 1u) {
            let bitPos = countTrailingZeros(j);
            let halfN = sortN >> 1u;
            for (var c: u32 = localIdx; c < halfN; c += BITONIC_WG_SIZE) {
                let l = insertZeroBit(c, bitPos);
                let r = l | j;

                let ascending = (l & k) == 0u;
                let shouldSwap = select(sData[l] < sData[r], sData[l] > sData[r], ascending);
                if (shouldSwap) {
                    let tmp = sData[l]; sData[l] = sData[r]; sData[r] = tmp;
                }
            }
            workgroupBarrier();
        }
    }

    // Phase 5: Extract local indices and write sorted global entries back
    for (var i: u32 = localIdx; i < clampedCount; i += BITONIC_WG_SIZE) {
        let localIndex = sData[i] & INDEX_MASK;
        sData[i] = tileEntries[tStart + localIndex];
    }

    workgroupBarrier();

    for (var i: u32 = localIdx; i < clampedCount; i += BITONIC_WG_SIZE) {
        tileEntries[tStart + i] = sData[i];
    }
}
`;
