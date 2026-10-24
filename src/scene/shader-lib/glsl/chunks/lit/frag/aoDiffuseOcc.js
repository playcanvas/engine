export default /* glsl */`
void occludeDiffuse(float ao) {
    dDiffuseLight *= ao;

    #ifdef LIT_DIFFUSE_TRANSMISSION
        dDiffuseTransmissionLight *= ao;
    #endif
}
`;
