// The histogram the compute shader wrote: 256 bins for each of the red, green and blue channels
// and the luminance, one after another
var<storage, read> bins: array<u32>;

// the number of pixels the histogram counted
uniform pixelCount: f32;

// the size of the panel, in CSS pixels
uniform panelSize: vec2f;

varying uv: vec2f;

const numBins = 256.0;

// The height of the histogram of a channel at x, between 0 and 1. The neighboring bins are
// interpolated, for a smooth curve. The counts are shown on a logarithmic scale, so the tones
// holding only a few pixels are visible next to the tones holding most of them: a bin holding all
// pixels reaches the top, and a bin holding the average count a third of the way up.
fn histogram(channel: u32, x: f32) -> f32 {
    let f = clamp(x * numBins - 0.5, 0.0, numBins - 1.0);
    let i = channel * 256u + u32(f);
    let j = channel * 256u + min(u32(f) + 1u, 255u);
    let count = mix(f32(bins[i]), f32(bins[j]), fract(f));
    let average = uniform.pixelCount / numBins;
    return log2(1.0 + 16.0 * count / average) / log2(1.0 + 16.0 * numBins);
}

// the signed distance from a point to a rectangle with rounded corners, centered at the origin
fn roundedRect(p: vec2f, halfSize: vec2f, radius: f32) -> f32 {
    let q = abs(p) - halfSize + radius;
    return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - radius;
}

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    let size = uniform.panelSize;
    let p = input.uv * size;

    // the panel: a dark rounded rectangle with a faint outline
    let d = roundedRect(p - size * 0.5, size * 0.5, 14.0);
    var color = vec3f(0.06, 0.07, 0.09);
    color = mix(color, vec3f(1.0), saturate(1.0 - abs(d + 1.0)) * 0.1);
    let alpha = saturate(0.5 - d) * 0.85;

    // the chart, leaving room at the top for the labels, and at the bottom for the tone ramp
    let chartMin = vec2f(16.0, 28.0);
    let chartMax = size - vec2f(16.0, 40.0);
    let chartSize = chartMax - chartMin;
    let c = (p - chartMin) / chartSize;

    if (c.x >= 0.0 && c.x <= 1.0 && c.y >= 0.0 && c.y <= 1.0) {
        // faint lines dividing the tones into quarters
        let quarter = abs(fract(c.x * 4.0 + 0.5) - 0.5) * chartSize.x * 0.25;
        color += saturate(1.0 - quarter) * 0.05;

        // The areas under the red, green and blue histograms are added together, so where they
        // overlap they mix to white. One pixel tall edges keep them smooth.
        let pixel = 1.0 / chartSize.y;
        let r = saturate((histogram(0u, c.x) - c.y) / pixel);
        let g = saturate((histogram(1u, c.x) - c.y) / pixel);
        let b = saturate((histogram(2u, c.x) - c.y) / pixel);
        color += r * vec3f(0.55, 0.12, 0.16) + g * vec3f(0.12, 0.5, 0.2) + b * vec3f(0.12, 0.25, 0.6);

        // The luminance histogram, as a white line along its top. The distance to the line is
        // measured in pixels, taking its slope into account, so it has the same width everywhere.
        let dx = 1.0 / chartSize.x;
        let slope = (histogram(3u, c.x + dx) - histogram(3u, c.x - dx)) * 0.5 * chartSize.y;
        let line = abs(histogram(3u, c.x) - c.y) * chartSize.y / sqrt(1.0 + slope * slope);
        color = mix(color, vec3f(1.0), saturate(1.5 - line) * 0.9);
    }

    // the tone ramp under the chart, from black to white
    if (c.x >= 0.0 && c.x <= 1.0 && p.y >= 14.0 && p.y <= 20.0) {
        color = vec3f(c.x);
    }

    var output: FragmentOutput;
    output.color = vec4f(color, alpha);
    return output;
}
