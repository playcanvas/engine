export default /* glsl */`
// Flips the normals of a back face to face the viewer, so that it is lit on the side that is seen.
// The vertex normal is the shading normal when no normal map is used, and it also drives the
// shadow normal offset and the directional lightmap. The TBN matrix is built from the unflipped
// normal before this runs, and only its normal column is flipped, leaving the tangent and binormal
// unchanged.
void handleTwoSidedLighting() {
    if (!gl_FrontFacing) {
        dVertexNormalW = -dVertexNormalW;

        #ifdef LIT_TBN
            dTBN[2] = -dTBN[2];
        #endif
    }
}
`;
