// fragment shader to copy splats in any supported format to MRT work-buffer
export default /* glsl */`
struct SplatSource {
    ivec2 uv;    
    uint id; // only used for compressed splats       
};

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

// number of splats
uniform int uActiveSplats;

void main(void) {
    // local fragment coordinates (within the viewport)
    ivec2 localFragCoords = ivec2(int(gl_FragCoord.x), int(gl_FragCoord.y) - uStartLine);

    // linear index of the splat
    int targetIndex = localFragCoords.y * uViewportWidth + localFragCoords.x;
    if (targetIndex >= uActiveSplats) {

        // Out of bounds: write zeros
        pcFragColor0 = vec4(0.0);
        pcFragColor1 = vec4(0.0);
        pcFragColor2 = vec4(0.0);
        pcFragColor3 = vec4(0.0);

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
        #ifdef GSPLAT_SOGS_DATA
            uint srcSize = uint(textureSize(scales, 0).x);
        #elif GSPLAT_COMPRESSED_DATA
            uint srcSize = uint(textureSize(packedTexture, 0).x);
        #else
            uint srcSize = uint(textureSize(splatColor, 0).x);
        #endif
        
        // Create SplatSource used to sample splat data textures
        SplatSource source;
        source.id = uint(originalIndex);
        source.uv = ivec2(source.id % srcSize, source.id / srcSize);

        // read and transform center
        vec3 center = readCenter(source);
        center = (uTransform * vec4(center, 1.0)).xyz;

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

        // write out results
        pcFragColor0 = color;
        pcFragColor1 = vec4(center, 1.0);
        pcFragColor2 = vec4(covA, 1.0);
        pcFragColor3 = vec4(covB, 1.0);
    }
}
`;
