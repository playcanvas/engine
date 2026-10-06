// The scene color map of the camera, attached using Compute#setSceneColorMap
#include "sceneColorCS"

// Simplified-syntax declaration (no @group/@binding) - the engine reflects it into a bind group
// automatically, so the example does not provide a computeBindGroupFormat.
var<storage, read_write> bins: array<atomic<u32>>;

fn luminance(color: vec3f) -> f32 {
    return saturate(dot(color, vec3f(0.2126, 0.7152, 0.0722)));
}

@compute @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) global_invocation_id: vec3u) {
    let numBins = f32(arrayLength(&bins));
    let lastBinIndex = u32(numBins - 1);
    let position = vec2i(global_invocation_id.xy);

    // the histogram of the image as displayed - the camera stores the color gamma encoded already,
    // in which case the conversion does nothing
    let color = sceneColorToDisplay(sceneColorLoad(position, 0).rgb);

    let v = luminance(color);
    let bin = min(u32(v * numBins), lastBinIndex);
    atomicAdd(&bins[bin], 1u);
}
