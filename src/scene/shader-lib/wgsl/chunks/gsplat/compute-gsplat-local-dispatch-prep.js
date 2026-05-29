// Tiny 1-thread shader that reads the visible splat count and writes indirect dispatch
// args for both the tile-count pass and the place-entries pass. This avoids relying on
// the device-level indirect dispatch buffer written earlier in the frame.
export const computeGsplatLocalDispatchPrepSource = /* wgsl */`

@group(0) @binding(0) var<storage, read> sortElementCount: array<u32>;
@group(0) @binding(1) var<storage, read_write> dispatchArgs: array<u32>;

@compute @workgroup_size(1)
fn main() {
    let count = sortElementCount[0];
    let maxDim = {MAX_DIM}u;

    // Slot 0: tile-count pass (1 splat per thread)
    let countWg = (count + {SPLATS_PER_WG_MINUS_1}u) / {SPLATS_PER_WG}u;
    if (countWg <= maxDim) {
        dispatchArgs[0] = countWg;
        dispatchArgs[1] = 1u;
    } else {
        let y = (countWg + maxDim - 1u) / maxDim;
        let x = (countWg + y - 1u) / y;
        dispatchArgs[0] = x;
        dispatchArgs[1] = y;
    }
    dispatchArgs[2] = 1u;

    // Slot 1: place-entries pass (1 splat per thread)
    let placeWg = (count + 255u) / 256u;
    if (placeWg <= maxDim) {
        dispatchArgs[3] = placeWg;
        dispatchArgs[4] = 1u;
    } else {
        let y = (placeWg + maxDim - 1u) / maxDim;
        let x = (placeWg + y - 1u) / y;
        dispatchArgs[3] = x;
        dispatchArgs[4] = y;
    }
    dispatchArgs[5] = 1u;
}
`;
