export default /* glsl */`
attribute vec3 vertex_outlineParameters;
attribute vec3 vertex_shadowParameters;

varying vec4 outline_color;
varying float outline_thickness;
varying vec4 shadow_color;
varying vec2 shadow_offset;

void unpackMsdfParams() {
    outline_color.rb = mod(vertex_outlineParameters.xy, 256.) / 256.;
    outline_color.ga = vertex_outlineParameters.xy / 256. / 256.;

    // _outlineThicknessScale === 0.2
    outline_thickness = vertex_outlineParameters.z / 255. * 0.2;

    vec3 little = mod(vertex_shadowParameters, 256.) / 256.;
    vec3 big = vertex_shadowParameters / 256. / 256.;

    shadow_color.rb = little.xy;
    shadow_color.ga = big.xy;

    // vec2(little.z, big.z) * 2. srink from (0.5, 0.5) to (1, 1)
    // _shadowOffsetScale === 0.005
    shadow_offset = (vec2(little.z, big.z) * 2. - 1.) * 0.005;
}
`;
