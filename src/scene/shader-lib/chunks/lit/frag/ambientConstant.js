export default /* glsl */`
void addAmbient(vec3 worldNormal) {
    dDiffuseLight += light_globalAmbient;
}
`;
