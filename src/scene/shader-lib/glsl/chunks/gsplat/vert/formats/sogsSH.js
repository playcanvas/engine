// Spherical Harmonics for SOGS GSplat format
export default /* glsl */`
#if SH_BANDS > 0
uniform highp sampler2D packedShN;

uniform float shN_mins;
uniform float shN_maxs;

void readSHData(in SplatSource source, out vec3 sh[SH_COEFFS], out float scale) {
    // extract spherical harmonics palette index
    ivec2 t = ivec2(packedSample.xy & 255u);
    int n = t.x + t.y * 256;
    int u = (n % 64) * SH_COEFFS;
    int v = n / 64;

    // calculate offset into the centroids texture and read consecutive texels
    for (int i = 0; i < SH_COEFFS; i++) {
        sh[i] = mix(vec3(shN_mins), vec3(shN_maxs), unpack111110(pack8888(texelFetch(packedShN, ivec2(u + i, v), 0))));
    }

    scale = 1.0;
}
#endif
`;
