export default /* glsl */`
void occludeSpecular(Frontend frontend) {
    dSpecularLight *= frontend.ao;
    dReflection *= frontend.ao;
}
`;
