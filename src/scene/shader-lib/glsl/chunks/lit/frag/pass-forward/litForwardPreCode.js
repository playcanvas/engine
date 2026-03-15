// backend shader implementation code which executes prior to the front end code, and contains code
// which is required by the frontend code.
export default /* glsl */`

#include "basePS"
#include "sphericalPS"
#include "decodePS"
#include "gammaPS"
#include "tonemappingPS"
#include "fogPS"

// 9-slice support code
#if LIT_NONE_SLICE_MODE == SLICED
    #include "baseNineSlicedPS"
#elif LIT_NONE_SLICE_MODE == TILED
    #include "baseNineSlicedTiledPS"
#endif

// TBN
#ifdef LIT_TBN
    #include "TBNPS"

    #ifdef LIT_TWO_SIDED_LIGHTING
        #include "twoSidedLightingPS"
    #endif
#endif

`;
