export default /* glsl */`
void occludeSpecular(Frontend frontend) {
    dSpecularLight *= frontend.dAo;
    dReflection *= frontend.dAo;
}
`;
