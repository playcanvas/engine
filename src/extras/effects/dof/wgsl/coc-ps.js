export default /* wgsl */`
#include "screenDepthPS"
varying uv0: vec2f;
uniform params: vec3f;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    let depth: f32 = getLinearScreenDepth(uv0);

    // near and far focus ranges
    let focusDistance: f32 = uniform.params.x;
    let focusRange: f32 = uniform.params.y;
    let invRange: f32 = uniform.params.z;
    let farRange: f32 = focusDistance + focusRange * 0.5;

    // near and far CoC
    let cocFar: f32 = min((depth - farRange) * invRange, 1.0);

    #ifdef NEAR_BLUR
        let nearRange: f32 = focusDistance - focusRange * 0.5;
        var cocNear: f32 = min((nearRange - depth) * invRange, 1.0);
    #else
        var cocNear: f32 = 0.0;
    #endif

    output.color = vec4f(cocFar, cocNear, 0.0, 0.0);
    return output;
}
`;
