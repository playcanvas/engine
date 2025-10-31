// fragment shader to copy splats in any supported format to MRT work-buffer
export default /* glsl */`

#define GSPLAT_CENTER_NOPROJ

#include "gsplatStructsVS"
#include "gsplatCenterVS"
#include "gsplatEvalSHVS"
#include "gsplatQuatToMat3VS"
#include "gsplatSourceFormatVS"

uniform mat4 uTransform;

uniform int uStartLine;      // Start row in destination texture
uniform int uViewportWidth;  // Width of the destination viewport in pixels

#ifdef GSPLAT_LOD
    // LOD intervals texture
    uniform usampler2D uIntervalsTexture;
#endif

uniform vec3 uColorMultiply;

// number of splats
uniform int uActiveSplats;

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
        pcFragColor1 = uvec4(0u);
        pcFragColor2 = uvec2(0u);

    } else {

        #ifdef GSPLAT_LOD
            // Use intervals texture to remap target index to source index
            int intervalsSize = int(textureSize(uIntervalsTexture, 0).x);
            ivec2 intervalUV = ivec2(targetIndex % intervalsSize, targetIndex / intervalsSize);
            uint originalIndex = texelFetch(uIntervalsTexture, intervalUV, 0).r;
        #else
            uint originalIndex = uint(targetIndex);
        #endif
        
        // source texture size
        #if defined(GSPLAT_SOGS_DATA) || defined(GSPLAT_COMPRESSED_DATA)
            uint srcSize = uint(textureSize(packedTexture, 0).x);
        #else
            uint srcSize = uint(textureSize(splatColor, 0).x);
        #endif
        
        // Create SplatSource used to sample splat data textures
        SplatSource source;
        source.id = uint(originalIndex);
        source.uv = ivec2(source.id % srcSize, source.id / srcSize);

        // read and transform center
        vec3 modelCenter = readCenter(source);
        modelCenter = (uTransform * vec4(modelCenter, 1.0)).xyz;
        SplatCenter center;
        initCenter(modelCenter, center);

        // read and transform covariance
        vec3 covA, covB;
        readCovariance(source, covA, covB);

        mat3 C = mat3(
            covA.x, covA.y, covA.z,
            covA.y, covB.x, covB.y,
            covA.z, covB.y, covB.z
        );
        mat3 linear = mat3(uTransform);
        mat3 Ct = linear * C * transpose(linear);
        covA = Ct[0];
        covB = vec3(Ct[1][1], Ct[1][2], Ct[2][2]);

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
        pcFragColor1 = uvec4(floatBitsToUint(modelCenter.x), floatBitsToUint(modelCenter.y), floatBitsToUint(modelCenter.z), packHalf2x16(vec2(covA.z, covB.z)));
        pcFragColor2 = uvec2(packHalf2x16(covA.xy), packHalf2x16(covB.xy));
    }
}
`;
