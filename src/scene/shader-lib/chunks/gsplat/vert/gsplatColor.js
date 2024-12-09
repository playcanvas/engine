export default /* glsl */`

uniform mediump sampler2D splatColor;

vec4 readColor(in SplatSource source) {
    return texelFetch(splatColor, source.uv, 0);
}

`;
