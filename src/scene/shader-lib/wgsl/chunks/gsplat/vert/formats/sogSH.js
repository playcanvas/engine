// Spherical Harmonics for SOG GSplat format
export default /* wgsl */`
#if SH_BANDS > 0
var packedShN: texture_2d<f32>;

uniform shN_mins: f32;
uniform shN_maxs: f32;

fn readSHTexel(u: i32, v: i32) -> half3 {
    return mix(half3(half(uniform.shN_mins)), half3(half(uniform.shN_maxs)), half3(unpack111110(pack8888(textureLoad(packedShN, vec2i(u, v), 0)))));
}

fn readSHData(sh: ptr<function, array<half3, SH_COEFFS>>, scale: ptr<function, f32>) {
    // extract spherical harmonics palette index
    let t = vec2i(packedSample.xy & vec2u(255u));
    let n = t.x + t.y * 256;
    let u = (n % 64) * SH_COEFFS;
    let v = n / 64;

    // read consecutive texels (unrolled to avoid Dawn's forward progress volatile wrapper)
    sh[0] = readSHTexel(u, v);
    sh[1] = readSHTexel(u + 1, v);
    sh[2] = readSHTexel(u + 2, v);
    #if SH_BANDS > 1
        sh[3] = readSHTexel(u + 3, v);
        sh[4] = readSHTexel(u + 4, v);
        sh[5] = readSHTexel(u + 5, v);
        sh[6] = readSHTexel(u + 6, v);
        sh[7] = readSHTexel(u + 7, v);
    #endif
    #if SH_BANDS > 2
        sh[8]  = readSHTexel(u + 8, v);
        sh[9]  = readSHTexel(u + 9, v);
        sh[10] = readSHTexel(u + 10, v);
        sh[11] = readSHTexel(u + 11, v);
        sh[12] = readSHTexel(u + 12, v);
        sh[13] = readSHTexel(u + 13, v);
        sh[14] = readSHTexel(u + 14, v);
    #endif

    *scale = 1.0;
}
#endif
`;
