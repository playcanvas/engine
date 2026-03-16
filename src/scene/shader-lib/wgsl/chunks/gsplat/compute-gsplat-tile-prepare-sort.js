export const computeGsplatTilePrepareSortSource = /* wgsl */`

@group(0) @binding(0) var<storage, read> splatTileCounts: array<u32>;
@group(0) @binding(1) var<storage, read_write> indirectDispatchArgs: array<u32>;
@group(0) @binding(2) var<storage, read_write> sortElementCountBuf: array<u32>;

struct Uniforms {
    numSplats: u32,
    dispatchSlotOffset: u32,
    maxWorkgroupsPerDim: u32,
    sortThreadsPerWorkgroup: u32,
    maxEntries: u32,
    _pad0: u32,
    _pad1: u32,
    _pad2: u32,
}
@group(0) @binding(3) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(1)
fn main() {
    let total = min(splatTileCounts[uniforms.numSplats], uniforms.maxEntries);
    sortElementCountBuf[0] = total;

    let workgroupCount = (total + uniforms.sortThreadsPerWorkgroup - 1u) / uniforms.sortThreadsPerWorkgroup;
    let maxDim = uniforms.maxWorkgroupsPerDim;

    var dispX: u32;
    var dispY: u32;
    if (workgroupCount <= maxDim) {
        dispX = workgroupCount;
        dispY = 1u;
    } else {
        dispX = u32(ceil(sqrt(f32(workgroupCount))));
        dispY = (workgroupCount + dispX - 1u) / dispX;
    }

    let off = uniforms.dispatchSlotOffset;
    indirectDispatchArgs[off + 0u] = dispX;
    indirectDispatchArgs[off + 1u] = dispY;
    indirectDispatchArgs[off + 2u] = 1u;
}
`;
