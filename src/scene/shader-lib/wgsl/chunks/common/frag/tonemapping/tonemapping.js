export default /* wgsl */`
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
