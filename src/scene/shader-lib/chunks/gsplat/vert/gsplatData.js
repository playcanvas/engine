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
bool readCenter(out SplatState state) {
    // calculate splat order
    state.order = vertex_id_attrib + uint(vertex_position.z);

    // return if out of range (since the last block of splats may be partially full)
    if (state.order >= tex_params.x) {
        return false;
    }

    ivec2 orderUV = ivec2(state.order % tex_params.y, state.order / tex_params.y);

    // read splat id
    state.id = texelFetch(splatOrder, orderUV, 0).r;

    // map id to uv
    state.uv = ivec2(state.id % tex_params.y, state.id / tex_params.y);

    // read transform data
    uvec4 tA = texelFetch(transformA, state.uv, 0);
    tAw = tA.w;

    state.cornerUV = vertex_position.xy;
    state.center = uintBitsToFloat(tA.xyz);

    return true;
}

// sample covariance vectors
void readCovariance(in SplatState state, out vec3 covA, out vec3 covB) {
    vec4 tB = texelFetch(transformB, state.uv, 0);
    vec2 tC = unpackHalf2x16(tAw);
    covA = tB.xyz;
    covB = vec3(tC.x, tC.y, tB.w);
}
`;
