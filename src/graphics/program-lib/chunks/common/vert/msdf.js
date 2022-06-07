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
  outline_thickness = vertex_outlineParameters.z / 255.;

  vec3 little = mod(vertex_shadowParameters, 256.) / 256.;
  vec3 big = vertex_shadowParameters / 256. / 256.;

  shadow_color.rb = little.xy;
  shadow_color.ga = big.xy;
  shadow_offset = vec2(little.z, big.z);
}
`;
