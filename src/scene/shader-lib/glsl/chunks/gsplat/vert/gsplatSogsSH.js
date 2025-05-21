export default /* glsl */`
uniform highp sampler2D sh_labels;
uniform highp sampler2D sh_centroids;

uniform float shN_mins;
uniform float shN_maxs;

void readSHData(in SplatSource source, out vec3 sh[15], out float scale) {
    // extract spherical harmonics palette index
    ivec2 t = ivec2(texelFetch(sh_labels, source.uv, 0).xy * 255.0);
    int n = t.x + t.y * 256;
    int u = (n % 64) * 15;
    int v = n / 64;

    // calculate offset into the centroids texture and read 15 consecutive texels
    for (int i = 0; i < 15; i++) {
        sh[i] = mix(vec3(shN_mins), vec3(shN_maxs), texelFetch(sh_centroids, ivec2(u + i, v), 0).xyz);
    }

    scale = 1.0;
}
`;
