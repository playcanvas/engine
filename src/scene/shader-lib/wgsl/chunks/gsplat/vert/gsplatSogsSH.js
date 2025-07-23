export default /* wgsl */`
var sh_centroids: texture_2d<f32>;

uniform shN_mins: f32;
uniform shN_maxs: f32;

fn readSHData(source: ptr<function, SplatSource>, sh: ptr<function, array<vec3f, SH_COEFFS>>, scale: ptr<function, f32>) {
    // extract spherical harmonics palette index
    let t: vec2<i32> = vec2<i32>(packedSample.x & 255u, packedSample.y & 255u);
    let n: i32 = t.x + t.y * 256;
    let u: i32 = (n % 64) * SH_COEFFS;
    let v: i32 = n / 64;

    // calculate offset into the centroids texture and read consecutive texels
    for (var i: i32 = 0; i < SH_COEFFS; i = i + 1) {
        sh[i] = mix(vec3f(uniform.shN_mins), vec3f(uniform.shN_maxs), textureLoad(sh_centroids, vec2<i32>(u + i, v), 0).xyz);
    }

    *scale = 1.0;
}
`;
