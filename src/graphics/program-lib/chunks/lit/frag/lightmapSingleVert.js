export default /* glsl */`
void addLightMap() {
    dDiffuseLight += saturate(vVertexColor.$CH);
}
`;
