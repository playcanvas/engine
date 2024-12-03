export default /* glsl */`

uniform mediump sampler2D splatColor;

vec4 readColor(in SplatState state) {
    return texelFetch(splatColor, state.uv, 0);
}

`;
