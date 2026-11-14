// The scene color map of the camera, attached using Compute#setSceneColorMap
#include "sceneColorCS"

// The number of threads the dispatch was set up for using Compute#setupDispatchThreads
#include "dispatchThreadsCS"

// The histogram: 256 bins for each of the red, green and blue channels and the luminance, one
// after another. Simplified-syntax declaration (no @group/@binding) - the engine reflects it into a
// bind group automatically, so the example does not provide a computeBindGroupFormat.
var<storage, read_write> bins: array<atomic<u32>>;

const numBins = 256u;

// The bins of the workgroup. Most pixels of an image fall into a few bins, and the threads adding
// to the same bin wait for each other, so each workgroup first counts its pixels into its own
// bins, which are fast to access, and then adds them to the histogram once.
var<workgroup> localBins: array<atomic<u32>, 4 * numBins>;

// the bin a value between 0 and 1 falls into
fn binIndex(value: f32) -> u32 {
    return min(u32(saturate(value) * f32(numBins)), numBins - 1u);
}

// a workgroup of 256 threads, one for each bin of a channel
@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_invocation_id: vec3u, @builtin(local_invocation_index) local_index: u32) {
    // a thread for each pixel - the threads beyond the image, as the dispatch is rounded up to whole
    // workgroups, do not count a pixel, but still help to add the bins to the histogram
    if (dispatchThreadInRange(global_invocation_id)) {

        // the color of the image as displayed - the camera stores the color gamma encoded already,
        // in which case the conversion does nothing
        let position = vec2i(global_invocation_id.xy);
        let color = sceneColorToDisplay(sceneColorLoad(position, 0).rgb);
        let luminance = dot(color, vec3f(0.2126, 0.7152, 0.0722));

        atomicAdd(&localBins[binIndex(color.r)], 1u);
        atomicAdd(&localBins[numBins + binIndex(color.g)], 1u);
        atomicAdd(&localBins[2u * numBins + binIndex(color.b)], 1u);
        atomicAdd(&localBins[3u * numBins + binIndex(luminance)], 1u);
    }

    // wait for all threads of the workgroup to count their pixels
    workgroupBarrier();

    // each thread adds one bin of each channel to the histogram
    for (var channel = 0u; channel < 4u; channel++) {
        let bin = channel * numBins + local_index;
        let count = atomicLoad(&localBins[bin]);
        if (count > 0u) {
            atomicAdd(&bins[bin], count);
        }
    }
}
