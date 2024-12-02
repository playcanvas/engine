export default /* glsl */`

struct SplatState {
    uint order;         // render order
    uint id;            // splat id
    ivec2 uv;           // splat uv

    vec2 cornerUV;      // corner coordinates for this vertex of the gaussian (-2, -2)..(2, 2)
    vec3 center;        // model space center

    vec3 centerCam;     // center in camera space
    vec4 centerProj;    // center in screen space
    vec2 cornerOffset;  // corner offset in screen space
};

#if GSPLAT_COMPRESSED_DATA == true
    #include "gsplatCompressedCoreVS"
#else
    #include "gsplatCoreVS"
#endif

#include "gsplatOutputPS"

`;
