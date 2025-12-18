export default /* wgsl */`
// Modify splat center position
fn modifySplatCenter(center: ptr<function, vec3f>) {
    // Example: *center.y += 1.0; // offset all splats up by 1 unit
}

// Modify splat rotation and scale (more efficient than modifyCovariance)
// Parameters:
//   originalCenter - center before any modification
//   modifiedCenter - center after modifyCenter/modifySplatCenter
//   rotation       - quaternion (x,y,z,w) format
//   scale          - scale vector
fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
    // Example to scale all splats by 2x:
    // *scale *= 2.0;
    //
    // Example to clamp size to a range:
    // let size = gsplatGetSizeFromScale(*scale);
    // let newSize = clamp(size, 0.01, 0.5);
    // *scale *= newSize / size;
    //
    // Example to make splats spherical:
    // let size = gsplatGetSizeFromScale(*scale);
    // gsplatMakeSpherical(scale, size * 0.5);
    //
    // To hide a splat:
    // *scale = vec3f(0.0);
}

// Modify splat color
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
    // Example: *color.rgb *= 0.5; // darken all splats
}
`;
