export default /* glsl */`
uniform float exposure;

vec3 toneMap(vec3 color) {
    return color * exposure;
}
`;
/*
  Magnopus check patch
vec3 toneMap(vec3 color) {
  // magnopus patched, remove exposure here
    return color;
}
`;
*/
