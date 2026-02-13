// Fragment shader for GPU frustum culling of bounding spheres.
// Each fragment processes 32 consecutive spheres and outputs a packed bitmask
// (bit b = 1 means sphere baseIndex+b is visible). The visibility texture is
// 32x smaller than the bounds texture.
export default /* wgsl */`
var boundsSphereTexture: texture_2d<f32>;
var boundsTransformIndexTexture: texture_2d<u32>;
var transformsTexture: texture_2d<f32>;

uniform boundsTextureWidth: i32;
uniform transformsTextureWidth: i32;
uniform totalBoundsEntries: i32;
uniform frustumPlanes: array<vec4f, 6>;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    // Linear texel index in the (small) visibility texture
    let visWidth = uniform.boundsTextureWidth / 32;
    let texelIndex = i32(input.position.y) * visWidth + i32(input.position.x);

    // Base sphere index for this group of 32
    let baseIndex = texelIndex * 32;

    // Since boundsTextureWidth is a multiple of 32, all 32 spheres are on the same row.
    // Compute row coordinates once.
    let baseX = baseIndex % uniform.boundsTextureWidth;
    let boundsY = baseIndex / uniform.boundsTextureWidth;

    var visBits = 0u;
    var cachedTransformIdx = 0xFFFFFFFFu;
    var row0: vec4f;
    var row1: vec4f;
    var row2: vec4f;
    var worldMatrix: mat4x4f;

    for (var b = 0; b < 32; b++) {
        let sphereIndex = baseIndex + b;
        if (sphereIndex >= uniform.totalBoundsEntries) { break; }

        let boundsCoord = vec2i(baseX + b, boundsY);

        // Read local-space bounding sphere (center.xyz, radius)
        let sphere = textureLoad(boundsSphereTexture, boundsCoord, 0);
        let localCenter = sphere.xyz;
        let radius = sphere.w;

        // Read GSplatInfo transform index
        let transformIdx = textureLoad(boundsTransformIndexTexture, boundsCoord, 0).r;

        // Reconstruct world matrix only when transform index changes.
        // The texture stores 3 texels per matrix (rows of a 4x3 affine matrix).
        // Transpose back to column-major mat4 and append the implicit (0,0,0,1) row.
        if (transformIdx != cachedTransformIdx) {
            cachedTransformIdx = transformIdx;
            let baseTexel = i32(transformIdx) * 3;
            let tx = baseTexel % uniform.transformsTextureWidth;
            let ty = baseTexel / uniform.transformsTextureWidth;
            row0 = textureLoad(transformsTexture, vec2i(tx,     ty), 0);
            row1 = textureLoad(transformsTexture, vec2i(tx + 1, ty), 0);
            row2 = textureLoad(transformsTexture, vec2i(tx + 2, ty), 0);
            worldMatrix = mat4x4f(
                row0.x, row1.x, row2.x, 0,
                row0.y, row1.y, row2.y, 0,
                row0.z, row1.z, row2.z, 0,
                row0.w, row1.w, row2.w, 1.0
            );
        }

        // Transform sphere center to world space
        let worldCenter = (worldMatrix * vec4f(localCenter, 1.0)).xyz;

        // World-space radius (uniform scale: all column lengths are equal)
        let worldRadius = radius * length(vec3f(row0.x, row1.x, row2.x));

        // Test against 6 frustum planes
        var visible = true;
        for (var p = 0; p < 6; p++) {
            let plane = uniform.frustumPlanes[p];
            let dist = dot(plane.xyz, worldCenter) + plane.w;
            if (dist <= -worldRadius) {
                visible = false;
                break;
            }
        }

        if (visible) {
            visBits |= (1u << u32(b));
        }
    }

    output.color = visBits;
    return output;
}
`;
