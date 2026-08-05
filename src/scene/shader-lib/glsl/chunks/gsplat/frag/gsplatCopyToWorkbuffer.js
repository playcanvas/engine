// fragment shader to copy splats in any supported format to MRT work-buffer
export default /* glsl */`

#define GSPLAT_CENTER_NOPROJ

// pre-computed model matrix decomposition (declared before includes, used by
// gsplatWorkBufferGeometryPS)
uniform vec3 model_scale;
uniform vec4 model_rotation;  // (x,y,z,w) format

#include "gsplatHelpersVS"
#include "gsplatFormatVS"
#include "gsplatStructsVS"
#include "gsplatDeclarationsVS"
#include "gsplatCenterVS"
#include "gsplatEvalSHVS"
#include "gsplatQuatToMat3VS"
#include "gsplatReadVS"
#include "gsplatWorkBufferGeometryPS"
#include "gsplatWorkBufferOutputVS"
#include "gsplatWriteVS"
#include "gsplatModifyVS"

// Packed sub-draw params: (sourceBase, colStart, rowWidth, rowStart)
flat varying ivec4 vSubDraw;

uniform vec3 uColorMultiply;

#ifdef GSPLAT_ID
    uniform uint uId;
#endif

void main(void) {
    // Compute source index from packed sub-draw varying: (sourceBase, colStart, rowWidth, rowStart)
    int localRow = int(gl_FragCoord.y) - vSubDraw.w;
    int localCol = int(gl_FragCoord.x) - vSubDraw.y;
    uint originalIndex = uint(vSubDraw.x + localRow * vSubDraw.z + localCol);

    // Initialize global splat for format read functions
    setSplat(originalIndex);

    // World-space geometry to store. Rotation/scale default to identity and are only computed on
    // the full-render path; under GSPLAT_COLOR_ONLY they are ignored by writeSplat (DCE'd).
    vec3 worldCenter;
    vec4 worldRotation = vec4(0.0, 0.0, 0.0, 1.0);
    vec3 worldScale = vec3(1.0);
    #if SH_BANDS > 0
        vec3 dir;   // model-space view direction
    #endif

    #ifdef GSPLAT_WORKBUFFER_GEOMETRY

        // Color-only update sourcing geometry from previously written work buffer data at this
        // destination pixel. The stored center already includes the model transform and
        // modifySplatCenter / modifySplatRotationScale, so neither is re-applied here.
        initWorkBufferGeometry(ivec2(gl_FragCoord.xy));
        worldCenter = workBufferWorldCenter();

        #if SH_BANDS > 0
            // model-space view direction (matches the source path up to non-uniform model scale)
            dir = normalize(quatRotateInv(model_rotation, worldCenter - uCameraPosition));
        #endif

    #else

        // read center in local space
        vec3 modelCenter = getCenter();

        // compute world-space center for storage
        worldCenter = (matrix_model * vec4(modelCenter, 1.0)).xyz;
        SplatCenter center;
        initCenter(modelCenter, center);

        // Get source rotation and scale
        // getRotation() returns (w,x,y,z) format, convert to (x,y,z,w) for quatMul
        vec4 srcRotation = getRotation().yzwx;
        vec3 srcScale = getScale();

        // Combine: world = model * source (both in x,y,z,w format)
        worldRotation = quatMul(model_rotation, srcRotation);
        // Ensure w is positive so sqrt() reconstruction works correctly
        // (quaternions q and -q represent the same rotation)
        if (worldRotation.w < 0.0) {
            worldRotation = -worldRotation;
        }
        worldScale = model_scale * srcScale;

        // Apply custom center modification
        vec3 originalCenter = worldCenter;
        modifySplatCenter(worldCenter);

        // Apply custom rotation/scale modification
        modifySplatRotationScale(originalCenter, worldCenter, worldRotation, worldScale);

        #if SH_BANDS > 0
            // calculate the model-space view direction
            dir = normalize(center.view * mat3(center.modelView));
        #endif

    #endif

    // read color
    vec4 color = getColor();

    // evaluate spherical harmonics
    #if SH_BANDS > 0
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

    // write color + transform using format-specific encoding (rotation/scale ignored under
    // GSPLAT_COLOR_ONLY)
    writeSplat(worldCenter, worldRotation, worldScale, color);

    #ifdef GSPLAT_ID
        writePcId(uvec4(uId, 0u, 0u, 0u));
    #endif
}
`;
