export default /* glsl */`
// Modify splat center position
void modifySplatCenter(inout vec3 center) {
    // Example: center.y += 1.0; // offset all splats up by 1 unit
}

// Modify splat rotation and scale (more efficient than modifyCovariance)
// Parameters:
//   originalCenter - center before any modification
//   modifiedCenter - center after modifyCenter/modifySplatCenter
//   rotation       - quaternion (x,y,z,w) format
//   scale          - scale vector
void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
    // Example to scale all splats by 2x:
    // scale *= 2.0;
    //
    // Example to clamp size to a range:
    // float size = gsplatGetSizeFromScale(scale);
    // float newSize = clamp(size, 0.01, 0.5);
    // scale *= newSize / size;
    //
    // Example to make splats spherical:
    // float size = gsplatGetSizeFromScale(scale);
    // gsplatMakeSpherical(scale, size * 0.5);
    //
    // To hide a splat:
    // scale = vec3(0.0);
}

// Modify splat color
void modifySplatColor(vec3 center, inout vec4 color) {
    // Example: color.rgb *= 0.5; // darken all splats
}
`;
