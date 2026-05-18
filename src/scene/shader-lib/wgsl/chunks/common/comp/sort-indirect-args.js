export default /* wgsl */`
// Writes up to 3 indirect dispatch slots for a compute-based sorter, using
// sorter-provided metadata. Each slot occupies 3 consecutive u32 entries
// (workgroup count x, y, z) in the dispatch buffer; this helper writes a 1D
// dispatch of ceil(count / granularity[i]) workgroups into slots
// (baseSlot + i) for every active slot i.
//
// Parameters:
//   buf       - indirect dispatch buffer (plain array<u32>, not atomic).
//   baseSlot  - index of the first slot to write (u32 offset = baseSlot * 3).
//   count     - number of elements the sort will process.
//   slotInfo  - sorter metadata, obtained verbatim from
//               ComputeRadixSort#prepareIndirect() and passed in as a
//               vec4<u32>:
//                 .x = slotCount (1..3)
//                 .y/.z/.w = per-slot elements-per-workgroup (granularity);
//                            unused trailing entries are 0.
fn writeSortIndirectArgs(
    buf: ptr<storage, array<u32>, read_write>,
    baseSlot: u32,
    count: u32,
    slotInfo: vec4<u32>
) {
    let n = slotInfo.x;

    if (n >= 1u) {
        let g = slotInfo.y;
        let wc = (count + g - 1u) / g;
        let off = baseSlot * 3u;
        (*buf)[off + 0u] = wc;
        (*buf)[off + 1u] = 1u;
        (*buf)[off + 2u] = 1u;
    }
    if (n >= 2u) {
        let g = slotInfo.z;
        let wc = (count + g - 1u) / g;
        let off = (baseSlot + 1u) * 3u;
        (*buf)[off + 0u] = wc;
        (*buf)[off + 1u] = 1u;
        (*buf)[off + 2u] = 1u;
    }
    if (n >= 3u) {
        let g = slotInfo.w;
        let wc = (count + g - 1u) / g;
        let off = (baseSlot + 2u) * 3u;
        (*buf)[off + 0u] = wc;
        (*buf)[off + 1u] = 1u;
        (*buf)[off + 2u] = 1u;
    }
}
`;
