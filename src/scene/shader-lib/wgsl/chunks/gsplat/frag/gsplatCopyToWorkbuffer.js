// fragment shader to copy splats in any supported format to MRT work-buffer
export default /* wgsl */`

#define GSPLAT_CENTER_NOPROJ

#include "gsplatStructsVS"
#include "gsplatCenterVS"
#include "gsplatEvalSHVS"
#include "gsplatQuatToMat3VS"
#include "gsplatSourceFormatVS"
#include "packHalfPS"

uniform uStartLine: i32;      // Start row in destination texture
uniform uViewportWidth: i32;  // Width of the destination viewport in pixels

#ifdef GSPLAT_LOD
    // LOD intervals texture
    var uIntervalsTexture: texture_2d<u32>;
#endif

uniform uColorMultiply: vec3f;

// number of splats
uniform uActiveSplats: i32;

// pre-computed model matrix decomposition
uniform model_scale: vec3f;
uniform model_rotation: vec4f;  // (x,y,z,w) format

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    
    // local fragment coordinates (within the viewport)
    let localFragCoords = vec2i(i32(input.position.x), i32(input.position.y) - uniform.uStartLine);

    // linear index of the splat
    let targetIndex = localFragCoords.y * uniform.uViewportWidth + localFragCoords.x;
    
    if (targetIndex >= uniform.uActiveSplats) {

        // Out of bounds: write zeros
        output.color = vec4f(0.0);
        #ifndef GSPLAT_COLOR_ONLY
            output.color1 = vec4u(0u);
            output.color2 = vec2u(0u);
        #endif

    } else {

        #ifdef GSPLAT_LOD
            // Use intervals texture to remap target index to source index
            let intervalsSize = i32(textureDimensions(uIntervalsTexture, 0).x);
            let intervalUV = vec2i(targetIndex % intervalsSize, targetIndex / intervalsSize);
            let originalIndex = textureLoad(uIntervalsTexture, intervalUV, 0).r;
        #else
            let originalIndex = targetIndex;
        #endif
        
        // source texture size
        var srcSize: u32;
        #if defined(GSPLAT_SOGS_DATA) || defined(GSPLAT_COMPRESSED_DATA)
            srcSize = u32(textureDimensions(packedTexture, 0).x);
        #else
            srcSize = u32(textureDimensions(splatColor, 0).x);
        #endif
        
        // Create SplatSource used to sample splat data textures
        var source: SplatSource;
        source.id = u32(originalIndex);
        source.uv = vec2i(i32(source.id % srcSize), i32(source.id / srcSize));

        // read center in local space
        var modelCenter = readCenter(&source);

        // compute world-space center for storage
        let worldCenter = (uniform.matrix_model * vec4f(modelCenter, 1.0)).xyz;
        var center: SplatCenter;
        initCenter(modelCenter, &center);

        // Get source rotation and scale
        // getRotation() returns (w,x,y,z) format, convert to (x,y,z,w) for quatMul
        let srcRotation = getRotation().yzwx;
        let srcScale = getScale();

        // Combine: world = model * source (both in x,y,z,w format)
        var worldRotation = quatMul(uniform.model_rotation, srcRotation);
        // Ensure w is positive so sqrt() reconstruction works correctly
        // (quaternions q and -q represent the same rotation)
        if (worldRotation.w < 0.0) {
            worldRotation = -worldRotation;
        }
        let worldScale = uniform.model_scale * srcScale;

        // read color
        var color = readColor(&source);

        // evaluate spherical harmonics
        #if SH_BANDS > 0
            // calculate the model-space view direction
            let dir = normalize(center.view * mat3x3f(center.modelView[0].xyz, center.modelView[1].xyz, center.modelView[2].xyz));

            // read sh coefficients
            var sh: array<vec3f, SH_COEFFS>;
            var scale: f32;
            readSHData(&source, &sh, &scale);

            // evaluate
            color = vec4f(color.xyz + evalSH(&sh, dir) * scale, color.w);
        #endif

        color = vec4f(color.xyz * uniform.uColorMultiply, color.w);

        // write out results
        output.color = color;
        #ifndef GSPLAT_COLOR_ONLY
            // Store rotation (xyz, w derived) and scale as 6 half-floats
            output.color1 = vec4u(bitcast<u32>(worldCenter.x), bitcast<u32>(worldCenter.y), bitcast<u32>(worldCenter.z), pack2x16floatSafe(worldRotation.xy));
            output.color2 = vec2u(pack2x16floatSafe(vec2f(worldRotation.z, worldScale.x)), pack2x16floatSafe(worldScale.yz));
        #endif
    }
    
    return output;
}
`;
