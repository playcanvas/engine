export default /* glsl */`
void occludeSpecular() {
    dSpecularLight *= dAo;
    dReflection *= dAo;
}
`;
