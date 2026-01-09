export default /* glsl */`
// Container format: declarations (uniforms + read functions) are injected via include
#include "gsplatContainerDeclarationsVS"

// Variables set by user's read code
vec3 splatCenter;
vec4 splatColor;
vec3 splatScale;
vec4 splatRotation;

// read the model-space center of the gaussian
vec3 readCenter(SplatSource source) {
    splatUV = source.uv;
    #include "gsplatContainerReadVS"
    return splatCenter;
}

vec4 getRotation() {
    return splatRotation;
}

vec3 getScale() {
    return splatScale;
}

vec4 readColor(in SplatSource source) {
    return splatColor;
}
`;
