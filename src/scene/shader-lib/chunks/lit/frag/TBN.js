export default /* glsl */`
void getTBN(vec3 tangent, vec3 binormal, vec3 normal) {
    #ifdef TWO_SIDED_LIGHTING
        dTBN = mat3(
            normalize((gl_FrontFacing ? tangent  : -tangent ) * twoSidedLightingNegScaleFactor),
            normalize((gl_FrontFacing ? binormal : -binormal) * twoSidedLightingNegScaleFactor),
            normalize((gl_FrontFacing ? normal   : -normal  ) * twoSidedLightingNegScaleFactor)
        );
    #else
        dTBN = mat3(normalize(tangent), normalize(binormal), normalize(normal));
    #endif
}
`;
