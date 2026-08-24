export default /* wgsl */`

#ifndef TBNBASIS
    #define TBNBASIS
    uniform tbnBasis: f32;
#endif

// Returns the geometric normal of the triangle the fragment belongs to, in world space. Used to
// give the surface a faceted (flat shaded) look, instead of using the smooth normal interpolated
// from the vertex normals.
//
// This is exact rather than an approximation - both screen space derivatives of the world position
// lie in the plane of the triangle, and so their cross product is the normal of that plane. It works
// on skinned and morphed geometry at no additional cost, as it operates on the final world space
// positions.
//
// Note that the lit shader still declares the vertex normal attribute for flat shaded variants, as
// other parts of the vertex shader depend on it, and so a mesh without normals is not supported yet.
//
// The returned normal is oriented to match the winding of the triangle, and so it agrees with
// correctly authored vertex normals on both front and back faces. This keeps flat shading orthogonal
// to cull, frontFace and two sided lighting, which all behave as they do for smooth shading.
//
// Note that the derivatives require uniform control flow, and so this must not be called from inside
// a conditionally executed branch.
fn getFlatNormal(worldPos: vec3f) -> vec3f {

    let normal: vec3f = cross(dpdx(worldPos), dpdy(worldPos));

    // Two independent sign corrections, neither of which double counts the other:
    // - tbnBasis compensates for the Y flip applied to the projection matrix when rendering with
    //   flipY, and for WebGPU's Y-down framebuffer space. Both flip the sign of the screen space
    //   derivatives, and correcting for them leaves the cross product pointing at the viewer. See
    //   TBN.js, which uses tbnBasis for the same reason.
    // - pcFrontFacing then flips it back to the orientation implied by the winding. It is itself
    //   unaffected by flipY, which reverses the window space winding but is also folded into the
    //   front face state, and so cancels out.
    let basis: f32 = select(-uniform.tbnBasis, uniform.tbnBasis, pcFrontFacing);

    // degenerate triangles generate a zero length normal, avoid normalizing those
    let len: f32 = length(normal);
    return select(vec3f(0.0, 1.0, 0.0), normal * (basis / len), len > 0.0);
}
`;
