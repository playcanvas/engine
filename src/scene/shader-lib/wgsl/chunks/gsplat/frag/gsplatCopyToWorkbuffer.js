// fragment shader to copy splats in any supported format to MRT work-buffer
export default /* wgsl */`

#define GSPLAT_CENTER_NOPROJ

#include "gsplatStructsVS"
#include "gsplatCenterVS"
#include "gsplatEvalSHVS"
#include "gsplatQuatToMat3VS"
#include "gsplatSourceFormatVS"

uniform uTransform: mat4x4f;

uniform uStartLine: i32;      // Start row in destination texture
uniform uViewportWidth: i32;  // Width of the destination viewport in pixels

#ifdef GSPLAT_LOD
    // LOD intervals texture
    var uIntervalsTexture: texture_2d<u32>;
#endif

// number of splats
uniform uActiveSplats: i32;

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
        output.color1 = vec4f(0.0);
        output.color2 = vec4f(0.0);
        output.color3 = vec4f(0.0);

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
        #ifdef GSPLAT_SOGS_DATA
            srcSize = u32(textureDimensions(packedTexture, 0).x);
        #elif GSPLAT_COMPRESSED_DATA
            srcSize = u32(textureDimensions(packedTexture, 0).x);
        #else
            srcSize = u32(textureDimensions(splatColor, 0).x);
        #endif
        
        // Create SplatSource used to sample splat data textures
        var source: SplatSource;
        source.id = u32(originalIndex);
        source.uv = vec2i(i32(source.id % srcSize), i32(source.id / srcSize));

        // read and transform center
        var modelCenter = readCenter(&source);
        modelCenter = (uniform.uTransform * vec4f(modelCenter, 1.0)).xyz;
        var center: SplatCenter;
        initCenter(modelCenter, &center);

        // read and transform covariance
        var covA: vec3f;
        var covB: vec3f;
        readCovariance(&source, &covA, &covB);

        let C = mat3x3f(
            vec3f(covA.x, covA.y, covA.z),
            vec3f(covA.y, covB.x, covB.y),
            vec3f(covA.z, covB.y, covB.z)
        );
        let linear = mat3x3f(uniform.uTransform[0].xyz, uniform.uTransform[1].xyz, uniform.uTransform[2].xyz);
        let Ct = linear * C * transpose(linear);
        covA = Ct[0];
        covB = vec3f(Ct[1][1], Ct[1][2], Ct[2][2]);

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

        // write out results
        output.color = color;
        output.color1 = vec4f(modelCenter, 1.0);
        output.color2 = vec4f(covA, 1.0);
        output.color3 = vec4f(covB, 1.0);
    }
    
    return output;
}
`;
