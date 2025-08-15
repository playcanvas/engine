export default /* glsl */`
uniform highp sampler2D sh_centroids;
uniform highp sampler2D sh_codebooks;

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
        sh[i] = vec3(
            texelFetch(sh_codebooks, ivec2(idx.x >> 2u, i), 0)[idx.x & 3u],
            texelFetch(sh_codebooks, ivec2(idx.y >> 2u, i), 0)[idx.y & 3u],
            texelFetch(sh_codebooks, ivec2(idx.z >> 2u, i), 0)[idx.z & 3u]
        );
    }

    scale = 1.0;
}
`;
