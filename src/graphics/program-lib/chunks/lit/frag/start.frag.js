export default /* glsl */`
void main(void) {
    dReflection = vec4(0);

    #ifdef CLEARCOAT
    ccSpecularLight = vec3(0);
    ccReflection = vec4(0);
    #endif
`;
