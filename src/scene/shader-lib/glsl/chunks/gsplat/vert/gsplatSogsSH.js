export default /* glsl */`
uniform highp sampler2D sh_labels;
uniform highp sampler2D sh_centroids;

uniform float shN_mins;
uniform float shN_maxs;

// To support each SH degree, readSHData is overloaded based on the SH vector depth 

void readSHData(in SplatSource source, out vec3 sh[SH_COEFFS], out float scale) {
    // extract spherical harmonics palette index
    ivec2 t = ivec2(texelFetch(sh_labels, source.uv, 0).xy * 255.0);
    int n = t.x + t.y * 256;
    int u = (n % 64) * SH_COEFFS;
    int v = n / 64;

    // calculate offset into the centroids texture and read consecutive texels
    for (int i = 0; i < SH_COEFFS; i++) {
        sh[i] = mix(vec3(shN_mins), vec3(shN_maxs), texelFetch(sh_centroids, ivec2(u + i, v), 0).xyz);
    }

    scale = 1.0;
}
`;
