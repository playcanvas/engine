export default /* glsl */`
uniform highp sampler2D sh_centroids;

uniform float shN_mins;
uniform float shN_maxs;

uniform vec4 shN_codebook[64];

void readSHData(in SplatSource source, out vec3 sh[SH_COEFFS], out float scale) {
    // extract spherical harmonics palette index
    ivec2 t = ivec2(packedSample.xy & 255u);
    int n = t.x + t.y * 256;
    int u = (n % 64) * SH_COEFFS;
    int v = n / 64;

    // calculate offset into the centroids texture and read consecutive texels
    for (int i = 0; i < SH_COEFFS; i++) {
        // sh[i] = mix(vec3(shN_mins), vec3(shN_maxs), texelFetch(sh_centroids, ivec2(u + i, v), 0).xyz);

        uvec3 idx = uvec3(texelFetch(sh_centroids, ivec2(u + i, v), 0).xyz * 255.0);

        sh[i] = vec3(
            shN_codebook[idx.x >> 2u][idx.x & 3u],
            shN_codebook[idx.y >> 2u][idx.y & 3u],
            shN_codebook[idx.z >> 2u][idx.z & 3u]
        );
    }

    scale = 1.0;
}
`;
