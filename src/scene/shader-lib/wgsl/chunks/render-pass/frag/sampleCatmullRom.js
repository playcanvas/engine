// Shader function for sampling a 2D texture with Catmull-Rom filtering, using 9 texture samples instead of 16
// based on https://gist.github.com/TheRealMJP/c83b8c0f46b63f3a88a5986f4fa982b1

export default /* wgsl */`

fn SampleTextureCatmullRom(tex: texture_2d<f32>, texSampler: sampler, uv: vec2f, texSize: vec2f) -> vec4f {
    // We're going to sample a a 4x4 grid of texels surrounding the target UV coordinate. We'll do this by rounding
    // down the sample location to get the exact center of our "starting" texel. The starting texel will be at
    // location [1, 1] in the grid, where [0, 0] is the top left corner.
    let samplePos: vec2f = uv * texSize;
    let texPos1: vec2f = floor(samplePos - 0.5) + 0.5;

    // Compute the fractional offset from our starting texel to our original sample location, which we'll
    // feed into the Catmull-Rom spline function to get our filter weights.
    let f: vec2f = samplePos - texPos1;

    // Compute the Catmull-Rom weights using the fractional offset that we calculated earlier.
    // These equations are pre-expanded based on our knowledge of where the texels will be located,
    // which lets us avoid having to evaluate a piece-wise function.
    let w0: vec2f = f * (-0.5 + f * (1.0 - 0.5 * f));
    let w1: vec2f = 1.0 + f * f * (-2.5 + 1.5 * f);
    let w2: vec2f = f * (0.5 + f * (2.0 - 1.5 * f));
    let w3: vec2f = f * f * (-0.5 + 0.5 * f);

    // Work out weighting factors and sampling offsets that will let us use bilinear filtering to
    // simultaneously evaluate the middle 2 samples from the 4x4 grid.
    let w12: vec2f = w1 + w2;
    let offset12: vec2f = w2 / w12;

    // Compute the final UV coordinates we'll use for sampling the texture
    let texPos0: vec2f = (texPos1 - 1.0) / texSize;
    let texPos3: vec2f = (texPos1 + 2.0) / texSize;
    let texPos12: vec2f = (texPos1 + offset12) / texSize;

    var result: vec4f = vec4f(0.0);
    result = result + textureSampleLevel(tex, texSampler, vec2f(texPos0.x, texPos0.y), 0.0) * w0.x * w0.y;
    result = result + textureSampleLevel(tex, texSampler, vec2f(texPos12.x, texPos0.y), 0.0) * w12.x * w0.y;
    result = result + textureSampleLevel(tex, texSampler, vec2f(texPos3.x, texPos0.y), 0.0) * w3.x * w0.y;

    result = result + textureSampleLevel(tex, texSampler, vec2f(texPos0.x, texPos12.y), 0.0) * w0.x * w12.y;
    result = result + textureSampleLevel(tex, texSampler, vec2f(texPos12.x, texPos12.y), 0.0) * w12.x * w12.y;
    result = result + textureSampleLevel(tex, texSampler, vec2f(texPos3.x, texPos12.y), 0.0) * w3.x * w12.y;

    result = result + textureSampleLevel(tex, texSampler, vec2f(texPos0.x, texPos3.y), 0.0) * w0.x * w3.y;
    result = result + textureSampleLevel(tex, texSampler, vec2f(texPos12.x, texPos3.y), 0.0) * w12.x * w3.y;
    result = result + textureSampleLevel(tex, texSampler, vec2f(texPos3.x, texPos3.y), 0.0) * w3.x * w3.y;

    return result;
}
`;
