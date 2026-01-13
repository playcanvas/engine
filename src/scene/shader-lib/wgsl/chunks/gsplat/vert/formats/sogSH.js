// Spherical Harmonics for SOG GSplat format
export default /* wgsl */`
#if SH_BANDS > 0
var packedShN: texture_2d<f32>;

uniform shN_mins: f32;
uniform shN_maxs: f32;

fn readSHData(source: ptr<function, SplatSource>, sh: ptr<function, array<vec3f, SH_COEFFS>>, scale: ptr<function, f32>) {
    // extract spherical harmonics palette index
    let t = vec2i(packedSample.xy & vec2u(255u));
    let n = t.x + t.y * 256;
    let u = (n % 64) * SH_COEFFS;
    let v = n / 64;

    // calculate offset into the centroids texture and read consecutive texels
    for (var i: i32 = 0; i < SH_COEFFS; i = i + 1) {
        sh[i] = mix(vec3f(uniform.shN_mins), vec3f(uniform.shN_maxs), unpack111110(pack8888(textureLoad(packedShN, vec2i(u + i, v), 0))));
    }

    *scale = 1.0;
}
#endif
`;
