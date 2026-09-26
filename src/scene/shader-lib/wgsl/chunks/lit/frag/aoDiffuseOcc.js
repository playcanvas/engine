export default /* wgsl */`
fn occludeDiffuse(ao: f32) {
    dDiffuseLight = dDiffuseLight * ao;

    #ifdef LIT_DIFFUSE_TRANSMISSION
        dDiffuseTransmissionLight = dDiffuseTransmissionLight * ao;
    #endif
}
`;
