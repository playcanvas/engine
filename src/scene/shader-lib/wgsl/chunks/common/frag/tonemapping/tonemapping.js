export default /* wgsl */`
#ifndef TONEMAP_NO_EXPOSURE_UNIFORM
    #if TONEMAP != NONE
        uniform exposure: f32;
        fn getExposure() -> f32 { return uniform.exposure; }
    #else
        fn getExposure() -> f32 { return 1.0; }
    #endif
#else
    #if TONEMAP != NONE
        fn getExposure() -> f32 { return uniforms.exposure; }
    #else
        fn getExposure() -> f32 { return 1.0; }
    #endif
#endif

#if (TONEMAP == NONE)
    #include "tonemappingNonePS"
#elif TONEMAP == FILMIC
    #include "tonemappingFilmicPS"
#elif TONEMAP == LINEAR
    #include "tonemappingLinearPS"
#elif TONEMAP == HEJL
    #include "tonemappingHejlPS"
#elif TONEMAP == ACES
    #include "tonemappingAcesPS"
#elif TONEMAP == ACES2
    #include "tonemappingAces2PS"
#elif TONEMAP == NEUTRAL
    #include "tonemappingNeutralPS"
#endif
`;
