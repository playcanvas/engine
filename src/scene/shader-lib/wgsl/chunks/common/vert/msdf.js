export default /* wgsl */`
attribute vertex_outlineParameters: vec3f;
attribute vertex_shadowParameters: vec3f;

varying outline_color: vec4f;
varying outline_thickness: f32;
varying shadow_color: vec4f;
varying shadow_offset: vec2f;

var<private> dOutlineColor: vec4f;
var<private> dOutlineThickness: f32;
var<private> dShadowColor: vec4f;
var<private> dShadowOffset: vec2f;

fn unpackMsdfParams() {
    let little: vec3f = vertex_outlineParameters % vec3f(256.0);
    let big: vec3f = (vertex_outlineParameters - little) / 256.0;

    dOutlineColor = vec4f(little.x, big.x, little.y, big.y) / 255.0;

    // _outlineThicknessScale === 0.2
    dOutlineThickness = little.z / 255.0 * 0.2;

    let little_shadow = vertex_shadowParameters % vec3f(256.0);
    let big_shadow = (vertex_shadowParameters - little_shadow) / 256.0;

    dShadowColor = vec4f(little_shadow.x, big_shadow.x, little_shadow.y, big_shadow.y) / 255.0;

    // vec2(little.z, big.z) / 127. - 1. remaps shadow offset from [0, 254] to [-1, 1]
    // _shadowOffsetScale === 0.005
    dShadowOffset = (vec2f(little_shadow.z, big_shadow.z) / 127.0 - 1.0) * 0.005;
}
`;
