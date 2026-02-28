// fragment shader to copy splats in any supported format to MRT work-buffer
export default /* glsl */`

#define GSPLAT_CENTER_NOPROJ

#include "gsplatHelpersVS"
#include "gsplatFormatVS"
#include "gsplatStructsVS"
#include "gsplatDeclarationsVS"
#include "gsplatCenterVS"
#include "gsplatEvalSHVS"
#include "gsplatQuatToMat3VS"
#include "gsplatReadVS"
#include "gsplatWorkBufferOutputVS"
#include "gsplatWriteVS"
#include "gsplatModifyVS"

// Packed sub-draw params: (sourceBase, colStart, rowWidth, rowStart)
flat varying ivec4 vSubDraw;

uniform vec3 uColorMultiply;

// pre-computed model matrix decomposition
uniform vec3 model_scale;
uniform vec4 model_rotation;  // (x,y,z,w) format

#ifdef GSPLAT_ID
    uniform uint uId;
#endif

#ifdef GSPLAT_NODE_INDEX
    uniform uint uBoundsBaseIndex;
    #ifdef HAS_NODE_MAPPING
        uniform usampler2D nodeMappingTexture;
        uniform usampler2D nodeToLocalBoundsTexture;
        uniform int nodeToLocalBoundsWidth;
    #endif
#endif

void main(void) {
    // Compute source index from packed sub-draw varying: (sourceBase, colStart, rowWidth, rowStart)
    int localRow = int(gl_FragCoord.y) - vSubDraw.w;
    int localCol = int(gl_FragCoord.x) - vSubDraw.y;
    uint originalIndex = uint(vSubDraw.x + localRow * vSubDraw.z + localCol);

    // Initialize global splat for format read functions
    setSplat(originalIndex);

    // read center in local space
    vec3 modelCenter = getCenter();

    // compute world-space center for storage
    vec3 worldCenter = (matrix_model * vec4(modelCenter, 1.0)).xyz;
    SplatCenter center;
    initCenter(modelCenter, center);

    // Get source rotation and scale
    // getRotation() returns (w,x,y,z) format, convert to (x,y,z,w) for quatMul
    vec4 srcRotation = getRotation().yzwx;
    vec3 srcScale = getScale();

    // Combine: world = model * source (both in x,y,z,w format)
    vec4 worldRotation = quatMul(model_rotation, srcRotation);
    // Ensure w is positive so sqrt() reconstruction works correctly
    // (quaternions q and -q represent the same rotation)
    if (worldRotation.w < 0.0) {
        worldRotation = -worldRotation;
    }
    vec3 worldScale = model_scale * srcScale;

    // Apply custom center modification
    vec3 originalCenter = worldCenter;
    modifySplatCenter(worldCenter);

    // Apply custom rotation/scale modification
    modifySplatRotationScale(originalCenter, worldCenter, worldRotation, worldScale);

    // read color
    vec4 color = getColor();

    // evaluate spherical harmonics
    #if SH_BANDS > 0
        // calculate the model-space view direction
        vec3 dir = normalize(center.view * mat3(center.modelView));

        // read sh coefficients
        vec3 sh[SH_COEFFS];
        float scale;
        readSHData(sh, scale);

        // evaluate
        color.xyz += evalSH(sh, dir) * scale;
    #endif

    // Apply custom color modification
    modifySplatColor(worldCenter, color);

    color.xyz *= uColorMultiply;

    // write color + transform using format-specific encoding
    writeSplat(worldCenter, worldRotation, worldScale, color);

    #ifdef GSPLAT_ID
        writePcId(uvec4(uId, 0u, 0u, 0u));
    #endif

    #ifdef GSPLAT_NODE_INDEX
        #ifdef HAS_NODE_MAPPING
            // Octree resource: look up node index from source splat, then local bounds index
            int srcTextureWidth = int(textureSize(nodeMappingTexture, 0).x);
            ivec2 sourceCoord = ivec2(int(originalIndex) % srcTextureWidth, int(originalIndex) / srcTextureWidth);
            uint nodeIndex = texelFetch(nodeMappingTexture, sourceCoord, 0).r;
            ivec2 ntlCoord = ivec2(int(nodeIndex) % nodeToLocalBoundsWidth, int(nodeIndex) / nodeToLocalBoundsWidth);
            uint localBoundsIdx = texelFetch(nodeToLocalBoundsTexture, ntlCoord, 0).r;
            writePcNodeIndex(uvec4(uBoundsBaseIndex + localBoundsIdx, 0u, 0u, 0u));
        #else
            // Non-octree resource: single bounds entry
            writePcNodeIndex(uvec4(uBoundsBaseIndex, 0u, 0u, 0u));
        #endif
    #endif
}
`;
