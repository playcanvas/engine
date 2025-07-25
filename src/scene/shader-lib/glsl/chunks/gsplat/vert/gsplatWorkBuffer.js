export default /* glsl */`
uniform highp sampler2D center;
uniform highp sampler2D covA;
uniform highp sampler2D covB;
uniform mediump sampler2D splatColor;

// read the model-space center of the gaussian
vec3 readCenter(SplatSource source) {
    return texelFetch(center, source.uv, 0).xyz;
}

// sample covariance vectors
void readCovariance(in SplatSource source, out vec3 cov_A, out vec3 cov_B) {
    cov_A = texelFetch(covA, source.uv, 0).xyz;
    cov_B = texelFetch(covB, source.uv, 0).xyz;
}

vec4 readColor(in SplatSource source) {
    return texelFetch(splatColor, source.uv, 0);
}
`;
