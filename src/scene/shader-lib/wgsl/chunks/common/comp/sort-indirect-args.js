export default /* wgsl */`
// Writes up to 3 indirect dispatch slots for a compute-based sorter, using
// sorter-provided metadata. Each slot occupies 3 consecutive u32 entries
// (workgroup count x, y, z) in the dispatch buffer; this helper writes a 1D
// dispatch of ceil(count / granularity[i]) workgroups into slots
// (baseSlot + i) for every active slot i.
//
// Contract: the calling shader must declare a storage binding named
// 'indirectDispatchArgs' of type array<u32> with read_write access. The helper
// references that global directly rather than taking it as a pointer
// parameter, because passing storage pointers across function boundaries
// requires the 'unrestricted_pointer_parameters' WGSL language feature, which
// is not portable (Firefox/naga rejects it).
//
// Parameters:
//   baseSlot  - index of the first slot to write (u32 offset = baseSlot * 3).
//   count     - number of elements the sort will process.
//   slotInfo  - sorter metadata, obtained verbatim from
//               ComputeRadixSort#prepareIndirect() and passed in as a
//               vec4<u32>:
//                 .x = slotCount (1..3)
//                 .y/.z/.w = per-slot elements-per-workgroup (granularity);
//                            unused trailing entries are 0.
fn writeSortIndirectArgs(
    baseSlot: u32,
    count: u32,
    slotInfo: vec4<u32>
) {
    let n = slotInfo.x;

    if (n >= 1u) {
        let g = slotInfo.y;
        let wc = (count + g - 1u) / g;
        let off = baseSlot * 3u;
        indirectDispatchArgs[off + 0u] = wc;
        indirectDispatchArgs[off + 1u] = 1u;
        indirectDispatchArgs[off + 2u] = 1u;
    }
    if (n >= 2u) {
        let g = slotInfo.z;
        let wc = (count + g - 1u) / g;
        let off = (baseSlot + 1u) * 3u;
        indirectDispatchArgs[off + 0u] = wc;
        indirectDispatchArgs[off + 1u] = 1u;
        indirectDispatchArgs[off + 2u] = 1u;
    }
    if (n >= 3u) {
        let g = slotInfo.w;
        let wc = (count + g - 1u) / g;
        let off = (baseSlot + 2u) * 3u;
        indirectDispatchArgs[off + 0u] = wc;
        indirectDispatchArgs[off + 1u] = 1u;
        indirectDispatchArgs[off + 2u] = 1u;
    }
}
`;
