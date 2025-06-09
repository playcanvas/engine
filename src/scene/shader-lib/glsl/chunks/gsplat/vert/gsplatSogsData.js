export default /* glsl */`
uniform highp sampler2D means_u;
uniform highp sampler2D means_l;
uniform highp sampler2D quats;
uniform highp sampler2D scales;

uniform vec3 means_mins;
uniform vec3 means_maxs;

uniform vec3 quats_mins;
uniform vec3 quats_maxs;

uniform vec3 scales_mins;
uniform vec3 scales_maxs;

// read the model-space center of the gaussian
vec3 readPosition(SplatSource source) {
    vec3 u = texelFetch(means_u, source.uv, 0).xyz;
    vec3 l = texelFetch(means_l, source.uv, 0).xyz;
    vec3 n = (l * 255.0 + u * 255.0 * 256.0) / 65535.0;

    vec3 v = mix(means_mins, means_maxs, n);
    return sign(v) * (exp(abs(v)) - 1.0);
}

const float norm = 2.0 / sqrt(2.0);

// read rotation and scale data
void readRotationAndScale(in SplatSource source, out vec4 rotation, out vec3 scale) {
    vec4 qdata = texelFetch(quats, source.uv, 0);
    vec3 abc = (qdata.xyz - 0.5) * norm;
    float d = sqrt(max(0.0, 1.0 - dot(abc, abc)));

    uint mode = uint(qdata.w * 255.0 + 0.5) - 252u;

    rotation =  (mode == 0u) ? vec4(d, abc) :
               ((mode == 1u) ? vec4(abc.x, d, abc.yz) :
               ((mode == 2u) ? vec4(abc.xy, d, abc.z) : vec4(abc, d)));

    scale = exp(mix(scales_mins, scales_maxs, texelFetch(scales, source.uv, 0).xyz));
}
`;
