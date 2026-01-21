// Read functions for Container GSplat format
export default /* glsl */`
vec3 getCenter(SplatSource source) {
    splatUV = source.uv;
    #include "gsplatContainerUserReadVS"
    return splatCenter;
}

vec4 getRotation() {
    return splatRotation;
}

vec3 getScale() {
    return splatScale;
}

vec4 getColor(in SplatSource source) {
    return splatColor;
}
`;
