export default /* glsl */`
uniform highp sampler2D sh_centroids;

uniform float shN_mins;
uniform float shN_maxs;

// per-band codebook of size 256 (/ 64 vec4s)
uniform vec4 shN_codebook[192];

// To support each SH degree, readSHData is overloaded based on the SH vector depth 

void readSHData(in SplatSource source, out vec3 sh[SH_COEFFS], out float scale) {
    // extract spherical harmonics palette index
    ivec2 t = ivec2(packedSample.xy & 255u);
    int n = t.x + t.y * 256;
    int u = (n % 64) * SH_COEFFS;
    int v = n / 64;

    // calculate offset into the centroids texture and read consecutive texels
    for (int i = 0; i < SH_COEFFS; i++) {
        uvec3 idx = uvec3(texelFetch(sh_centroids, ivec2(u + i, v), 0).xyz * 255.0);
        uint o = 64u * (i < 3 ? 0u : (i < 8 ? 1u : 2u));
        sh[i] = vec3(
            shN_codebook[o + (idx.x >> 2u)][idx.x & 3u],
            shN_codebook[o + (idx.y >> 2u)][idx.y & 3u],
            shN_codebook[o + (idx.z >> 2u)][idx.z & 3u]
        );
    }

    scale = 1.0;
}
`;
