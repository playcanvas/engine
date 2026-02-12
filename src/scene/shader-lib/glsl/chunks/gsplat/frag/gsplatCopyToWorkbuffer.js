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
#include "gsplatModifyVS"

uniform int uStartLine;      // Start row in destination texture
uniform int uViewportWidth;  // Width of the destination viewport in pixels

#ifdef GSPLAT_LOD
    // LOD intervals texture
    uniform usampler2D uIntervalsTexture;
#endif

uniform vec3 uColorMultiply;

// number of splats
uniform int uActiveSplats;

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
    // local fragment coordinates (within the viewport)
    ivec2 localFragCoords = ivec2(int(gl_FragCoord.x), int(gl_FragCoord.y) - uStartLine);

    // linear index of the splat
    int targetIndex = localFragCoords.y * uViewportWidth + localFragCoords.x;
    if (targetIndex >= uActiveSplats) {

        // Out of bounds: write zeros
        #ifdef GSPLAT_COLOR_UINT
            writeDataColor(uvec4(0u));
        #else
            writeDataColor(vec4(0.0));
        #endif
        #ifndef GSPLAT_COLOR_ONLY
            writeDataTransformA(uvec4(0u));
            writeDataTransformB(uvec4(0u));
        #endif

    } else {

        #ifdef GSPLAT_LOD
            // Use intervals texture to remap target index to source index
            int intervalsSize = int(textureSize(uIntervalsTexture, 0).x);
            ivec2 intervalUV = ivec2(targetIndex % intervalsSize, targetIndex / intervalsSize);
            uint originalIndex = texelFetch(uIntervalsTexture, intervalUV, 0).r;
        #else
            uint originalIndex = uint(targetIndex);
        #endif
        
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

        // write out results using generated write functions
        #ifdef GSPLAT_COLOR_UINT
            // Pack RGBA as 4x half-float (16-bit) values for RGBA16U format
            uint packed_rg = packHalf2x16(color.rg);
            uint packed_ba = packHalf2x16(color.ba);
            writeDataColor(uvec4(
                packed_rg & 0xFFFFu,    // R as half
                packed_rg >> 16u,       // G as half
                packed_ba & 0xFFFFu,    // B as half
                packed_ba >> 16u        // A as half
            ));
        #else
            writeDataColor(color);
        #endif
        #ifndef GSPLAT_COLOR_ONLY
            // Store rotation (xyz, w derived) and scale as 6 half-floats
            writeDataTransformA(uvec4(floatBitsToUint(worldCenter.x), floatBitsToUint(worldCenter.y), floatBitsToUint(worldCenter.z), packHalf2x16(worldRotation.xy)));
            writeDataTransformB(uvec4(packHalf2x16(vec2(worldRotation.z, worldScale.x)), packHalf2x16(worldScale.yz), 0u, 0u));
        #endif

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
}
`;
