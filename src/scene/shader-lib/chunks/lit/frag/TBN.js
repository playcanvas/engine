export default /* glsl */`
void getTBN(vec3 tangent, vec3 binormal, vec3 normal) {
    dTBN = mat3(normalize(tangent), normalize(binormal), normalize(normal));

    #ifdef TWO_SIDED_LIGHTING
    dTBN *= ((gl_FrontFacing ? 1.0 : -1.0) * twoSidedLightingNegScaleFactor);
    #endif
}
`;
