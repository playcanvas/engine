// The fog chunk of the dynamic sky effect, which takes the place of the engine's fog chunk. An effect
// with the haze enabled gives its camera a fog of the type of its own, for which the camera sets FOG
// to DYNAMICSKYHAZE: the lit materials are then hazed by the sky, see DynamicSkyEffect#haze, and the
// other shaders, the particles and the gaussian splats, which have no world position of their
// fragments, render without fog. LIT_BLEND_TYPE is set by the lit fragment shaders alone. The other
// types of fog are the fog of the scene, as before.
export default /* glsl */`
#if (FOG == DYNAMICSKYHAZE)

    float dBlendModeFogFactor = 1.0;

    #if defined(LIT_BLEND_TYPE) && !defined(DYNAMIC_SKY_NO_HAZE)

        #include "dynamicSkyHazePS"

        vec3 addFog(vec3 color) {
            float amount = dynamicSkyHazeAmount(view_position, vPositionW);
            return mix(color, dynamicSkyHazeColor(vPositionW - view_position) * dBlendModeFogFactor, amount);
        }

    #elif defined(VERTEXSHADER)
        vec3 addFog(vec3 color, float depth) {
            return color;
        }
    #else
        vec3 addFog(vec3 color) {
            return color;
        }
    #endif

#else
    #include "dynamicSkySceneFogPS"
#endif
`;
