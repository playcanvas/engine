export default /* wgsl */`
// Container format: declarations (uniforms + read functions) are injected via include
#include "gsplatContainerDeclarationsVS"

// Variables set by user's read code
var<private> splatCenter: vec3f;
var<private> splatColor: vec4f;
var<private> splatScale: vec3f;
var<private> splatRotation: vec4f;

// read the model-space center of the gaussian
fn readCenter(source: ptr<function, SplatSource>) -> vec3f {
    splatUV = (*source).uv;
    #include "gsplatContainerReadVS"
    return splatCenter;
}

fn getRotation() -> vec4f {
    return splatRotation;
}

fn getScale() -> vec3f {
    return splatScale;
}

fn readColor(source: ptr<function, SplatSource>) -> vec4f {
    return splatColor;
}
`;
