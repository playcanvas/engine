export default /* glsl */`
void getTBN(vec3 tangent, vec3 binormal, vec3 normal) {
    #ifdef TWO_SIDED_LIGHTING
        dTBN = mat3(
            (gl_FrontFacing ? tangent  : -tangent ) * twoSidedLightingNegScaleFactor,
            (gl_FrontFacing ? binormal : -binormal) * twoSidedLightingNegScaleFactor,
            (gl_FrontFacing ? normal   : -normal  ) * twoSidedLightingNegScaleFactor
        );
    #else
        dTBN = mat3(tangent, binormal, normal);
    #endif
}
`;
