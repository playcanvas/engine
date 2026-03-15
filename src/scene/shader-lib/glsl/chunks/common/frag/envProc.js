export default /* glsl */`
#ifdef LIT_SKYBOX_INTENSITY
    uniform float skyboxIntensity;
#endif

vec3 processEnvironment(vec3 color) {
    #ifdef LIT_SKYBOX_INTENSITY
        return color * skyboxIntensity;
    #else
        return color;
    #endif
}
`;
