// the texture storing the height of the surface in its alpha, and the size of its texel
var uHeightTexture: texture_2d<f32>;
var uHeightTextureSampler: sampler;
uniform uTexelSize: vec2f;

// the strength of the bumps
uniform uBumpiness: f32;

varying uv0: vec2f;

// the height at an offset in texels from the rendered texel. The texture repeats, and so the
// normals at its edges are computed from the texels on the opposite side
fn heightAt(uv: vec2f, offset: vec2f) -> f32 {
    return textureSampleLevel(uHeightTexture, uHeightTextureSampler, uv + offset * uniform.uTexelSize, 0.0).a;
}

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    let uv = input.uv0;

    // the slope of the height along the texture axes, using the Sobel filter, which also smooths it
    let tl = heightAt(uv, vec2f(-1.0, 1.0));
    let t = heightAt(uv, vec2f(0.0, 1.0));
    let tr = heightAt(uv, vec2f(1.0, 1.0));
    let l = heightAt(uv, vec2f(-1.0, 0.0));
    let r = heightAt(uv, vec2f(1.0, 0.0));
    let bl = heightAt(uv, vec2f(-1.0, -1.0));
    let b = heightAt(uv, vec2f(0.0, -1.0));
    let br = heightAt(uv, vec2f(1.0, -1.0));

    var slope = vec2f((tr + 2.0 * r + br) - (tl + 2.0 * l + bl), (tl + 2.0 * t + tr) - (bl + 2.0 * b + br));

    // the slope per unit of the texture coordinates, which keeps the bumps the same at any resolution
    slope /= 8.0 * uniform.uTexelSize;

    // the tangent space normal, encoded into the 0 .. 1 range
    let normal = normalize(vec3f(-slope * uniform.uBumpiness, 1.0));
    output.color = vec4f(normal * 0.5 + 0.5, 1.0);
    return output;
}
