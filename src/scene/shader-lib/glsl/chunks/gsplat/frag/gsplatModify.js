export default /* glsl */`
// Modify the final splat fragment color in the forward pass.
// Parameters:
//   gaussianUV - position of the fragment within the gaussian footprint: (0,0) at the splat
//                center, length 1 at the edge where the splat is clipped
//   color      - rgb: splat color, a: fragment alpha after gaussian falloff, before
//                premultiplication
void modifySplatColor(vec2 gaussianUV, inout vec4 color) {
    // Example: color.rgb *= 0.5; // darken all splats
}
`;
