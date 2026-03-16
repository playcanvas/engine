export const computeGsplatTileRangesSource = /* wgsl */`

@group(0) @binding(0) var<storage, read> sortedKeys: array<u32>;
@group(0) @binding(1) var<storage, read> sortedEntryCount: array<u32>;
@group(0) @binding(2) var<storage, read_write> tileRanges: array<u32>;

struct Uniforms {
    numTiles: u32,
}
@group(0) @binding(3) var<uniform> uniforms: Uniforms;

fn lowerBound(key: u32, lo: u32, hi: u32) -> u32 {
    var l = lo;
    var h = hi;
    while (l < h) {
        let m = (l + h) / 2u;
        if (sortedKeys[m] < key) {
            l = m + 1u;
        } else {
            h = m;
        }
    }
    return l;
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let tileIdx = gid.x;
    if (tileIdx >= uniforms.numTiles) {
        return;
    }

    let totalEntries = sortedEntryCount[0];
    let start = lowerBound(tileIdx, 0u, totalEntries);
    let end = lowerBound(tileIdx + 1u, start, totalEntries);

    tileRanges[tileIdx * 2u] = start;
    tileRanges[tileIdx * 2u + 1u] = end;
}
`;
