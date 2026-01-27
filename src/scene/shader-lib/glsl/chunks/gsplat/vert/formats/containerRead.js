// Read functions for Container GSplat format
export default /* glsl */`
vec3 getCenter() {
    #include "gsplatContainerUserReadVS"
    return splatCenter;
}

vec4 getRotation() {
    return splatRotation;
}

vec3 getScale() {
    return splatScale;
}

vec4 getColor() {
    return splatColor;
}
`;
