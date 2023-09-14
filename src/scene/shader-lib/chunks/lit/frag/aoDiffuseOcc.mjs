export default /* glsl */`
void occludeDiffuse(float ao) {
    dDiffuseLight *= ao;
}
`;
