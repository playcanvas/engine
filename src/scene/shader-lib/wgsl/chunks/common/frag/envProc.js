export default /* wgsl */`
#ifdef LIT_SKYBOX_INTENSITY
    uniform skyboxIntensity : f32;
#endif

fn processEnvironment(color : vec3f) -> vec3f {
    #ifdef LIT_SKYBOX_INTENSITY
        return color * uniform.skyboxIntensity;
    #else
        return color;
    #endif
}
`;
