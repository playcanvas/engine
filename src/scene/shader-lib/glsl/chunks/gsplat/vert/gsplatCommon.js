export default /* glsl */`

// stores the source UV and order of the splat
struct SplatSource {
    uint order;         // render order
    uint id;            // splat id
    ivec2 uv;           // splat uv
    vec2 cornerUV;      // corner coordinates for this vertex of the gaussian (-1, -1)..(1, 1)
};

// stores the camera and clip space position of the gaussian center
struct SplatCenter {
    vec3 view;          // center in view space
    vec4 proj;          // center in clip space
    mat4 modelView;     // model-view matrix
    float projMat00;    // element [0][0] of the projection matrix
};

// stores the offset from center for the current gaussian
struct SplatCorner {
    vec2 offset;        // corner offset from center in clip space
    vec2 uv;            // corner uv
    #if GSPLAT_AA
        float aaFactor; // for scenes generated with antialiasing
    #endif

    vec2 v;
    float dlen;
};

#include "gsplatEvalSHVS"
#include "gsplatQuatToMat3VS"

#if GSPLAT_COMPRESSED_DATA == true
    #include "gsplatCompressedDataVS"
    #if SH_COEFFS > 0
        #include "gsplatCompressedSHVS"
    #endif
#elif GSPLAT_SOGS_DATA == true
    #include "gsplatSogsDataVS"
    #include "gsplatSogsColorVS"
    #if SH_COEFFS > 0
        #include "gsplatSogsSHVS"
    #endif
#else
    #include "gsplatDataVS"
    #include "gsplatColorVS"
    #if SH_COEFFS > 0
        #include "gsplatSHVS"
    #endif
#endif

#include "gsplatSourceVS"
#include "gsplatCenterVS"
#include "gsplatCornerVS"
#include "gsplatOutputVS"

// modify the gaussian corner so it excludes gaussian regions with alpha less than 1/255
void clipCorner(inout SplatCorner corner, float alpha) {
    float clip = min(1.0, sqrt(-log(1.0 / 255.0 / alpha)) / 2.0);
    corner.offset *= clip;
    corner.uv *= clip;
}
`;
