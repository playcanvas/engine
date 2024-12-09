export default /* glsl */`
uniform highp usampler2D transformA;
uniform highp sampler2D transformB;

// work values
uint tAw;

// read the model-space center of the gaussian
vec3 readCenter(SplatSource source) {
    // read transform data
    uvec4 tA = texelFetch(transformA, source.uv, 0);
    tAw = tA.w;
    return uintBitsToFloat(tA.xyz);
}

// sample covariance vectors
void readCovariance(in SplatSource source, out vec3 covA, out vec3 covB) {
    vec4 tB = texelFetch(transformB, source.uv, 0);
    vec2 tC = unpackHalf2x16(tAw);
    covA = tB.xyz;
    covB = vec3(tC.x, tC.y, tB.w);
}
`;
