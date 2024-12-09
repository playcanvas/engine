export default /* glsl */`
attribute vec3 vertex_position;         // xy: cornerUV, z: render order offset
attribute uint vertex_id_attrib;        // render order base

uniform uvec2 tex_params;               // num splats, texture width
uniform highp usampler2D splatOrder;
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
