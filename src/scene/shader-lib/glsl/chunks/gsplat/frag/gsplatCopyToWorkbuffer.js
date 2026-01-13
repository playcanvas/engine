// fragment shader to copy splats in any supported format to MRT work-buffer
export default /* glsl */`

#define GSPLAT_CENTER_NOPROJ

#include "gsplatStructsVS"
#include "gsplatCenterVS"
#include "gsplatEvalSHVS"
#include "gsplatQuatToMat3VS"
#include "gsplatFormatVS"
#include "gsplatReadVS"

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

void main(void) {
    // local fragment coordinates (within the viewport)
    ivec2 localFragCoords = ivec2(int(gl_FragCoord.x), int(gl_FragCoord.y) - uStartLine);

    // linear index of the splat
    int targetIndex = localFragCoords.y * uViewportWidth + localFragCoords.x;
    if (targetIndex >= uActiveSplats) {

        // Out of bounds: write zeros
        #ifdef GSPLAT_COLOR_UINT
            pcFragColor0 = uvec4(0u);
        #else
            pcFragColor0 = vec4(0.0);
        #endif
        #ifndef GSPLAT_COLOR_ONLY
            pcFragColor1 = uvec4(0u);
            pcFragColor2 = uvec2(0u);
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
        
        // source texture size (set by all resource types via splatTextureSize uniform)
        uint srcSize = splatTextureSize;
        
        // Create SplatSource used to sample splat data textures
        SplatSource source;
        source.id = uint(originalIndex);
        source.uv = ivec2(source.id % srcSize, source.id / srcSize);

        // read center in local space
        vec3 modelCenter = readCenter(source);

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

        // read color
        vec4 color = readColor(source);

        // evaluate spherical harmonics
        #if SH_BANDS > 0
            // calculate the model-space view direction
            vec3 dir = normalize(center.view * mat3(center.modelView));

            // read sh coefficients
            vec3 sh[SH_COEFFS];
            float scale;
            readSHData(source, sh, scale);

            // evaluate
            color.xyz += evalSH(sh, dir) * scale;
        #endif

        color.xyz *= uColorMultiply;

        // write out results
        #ifdef GSPLAT_COLOR_UINT
            // Pack RGBA as 4x half-float (16-bit) values for RGBA16U format
            uint packed_rg = packHalf2x16(color.rg);
            uint packed_ba = packHalf2x16(color.ba);
            pcFragColor0 = uvec4(
                packed_rg & 0xFFFFu,    // R as half
                packed_rg >> 16u,       // G as half
                packed_ba & 0xFFFFu,    // B as half
                packed_ba >> 16u        // A as half
            );
        #else
            pcFragColor0 = color;
        #endif
        #ifndef GSPLAT_COLOR_ONLY
            // Store rotation (xyz, w derived) and scale as 6 half-floats
            pcFragColor1 = uvec4(floatBitsToUint(worldCenter.x), floatBitsToUint(worldCenter.y), floatBitsToUint(worldCenter.z), packHalf2x16(worldRotation.xy));
            pcFragColor2 = uvec2(packHalf2x16(vec2(worldRotation.z, worldScale.x)), packHalf2x16(worldScale.yz));
        #endif
    }
}
`;
