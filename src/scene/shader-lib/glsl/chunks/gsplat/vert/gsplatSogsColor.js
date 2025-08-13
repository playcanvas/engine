export default /* glsl */`
uniform mediump sampler2D sh0;

uniform vec4 sh0_mins;
uniform vec4 sh0_maxs;

uniform vec4 sh0_codebook[64];
uniform vec4 opacity_codebook[64];

float SH_C0 = 0.28209479177387814;

vec4 readColor(in SplatSource source) {
    uvec4 idx = uvec4(texelFetch(sh0, source.uv, 0) * 255.0);

    vec4 clr = vec4(
        sh0_codebook[idx.x >> 2u][idx.x & 3u],
        sh0_codebook[idx.y >> 2u][idx.y & 3u],
        sh0_codebook[idx.z >> 2u][idx.z & 3u],
        opacity_codebook[idx.w >> 2u][idx.w & 3u]
    );

    return vec4(vec3(0.5) + clr.xyz * SH_C0, 1.0 / (1.0 + exp(-clr.w)));
}
`;
