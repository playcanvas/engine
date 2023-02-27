export default /* glsl */`
void occludeDiffuse(Frontend frontend) {
    dDiffuseLight *= frontend.ao;
}
`;
