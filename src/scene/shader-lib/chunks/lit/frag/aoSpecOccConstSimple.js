export default /* glsl */`
void occludeSpecular(float ao) {
    dSpecularLight *= ao;
    dReflection *= ao;
}
`;
