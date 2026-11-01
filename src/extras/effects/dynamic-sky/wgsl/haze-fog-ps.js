// The fog chunk of the dynamic sky effect, which takes the place of the engine's fog chunk. An effect
// with the haze enabled gives its camera a fog of the type of its own, for which the camera sets FOG
// to DYNAMICSKYHAZE: the lit materials are then hazed by the sky, see DynamicSkyEffect#haze, and the
// other shaders, the particles and the gaussian splats, which have no world position of their
// fragments, render without fog. LIT_BLEND_TYPE is set by the lit fragment shaders alone. The other
// types of fog are the fog of the scene, as before.
export default /* wgsl */`
#if (FOG == DYNAMICSKYHAZE)

    var<private> dBlendModeFogFactor : f32 = 1.0;

    #if defined(LIT_BLEND_TYPE) && !defined(DYNAMIC_SKY_NO_HAZE)

        #include "dynamicSkyHazePS"

        fn addFog(color: vec3f) -> vec3f {
            let amount = dynamicSkyHazeAmount(uniform.view_position, vPositionW);
            return mix(color, dynamicSkyHazeColor(vPositionW - uniform.view_position) * dBlendModeFogFactor, vec3f(amount));
        }

    #elif defined(VERTEXSHADER)
        fn addFog(color: vec3f, depth: f32) -> vec3f {
            return color;
        }
    #else
        fn addFog(color: vec3f) -> vec3f {
            return color;
        }
    #endif

#else
    #include "dynamicSkySceneFogPS"
#endif
`;
