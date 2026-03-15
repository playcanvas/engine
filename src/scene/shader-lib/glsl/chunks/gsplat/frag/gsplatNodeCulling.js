// Fragment shader for GPU frustum culling of bounding spheres.
// Each fragment processes 32 consecutive spheres and outputs a packed bitmask
// (bit b = 1 means sphere baseIndex+b is visible). The visibility texture is
// 32x smaller than the bounds texture.
export default /* glsl */`
uniform sampler2D boundsSphereTexture;
uniform usampler2D boundsTransformIndexTexture;
uniform sampler2D transformsTexture;

uniform int boundsTextureWidth;
uniform int transformsTextureWidth;
uniform int totalBoundsEntries;
uniform vec4 frustumPlanes[6];

void main(void) {
    // Linear texel index in the (small) visibility texture
    int visWidth = boundsTextureWidth / 32;
    int texelIndex = int(gl_FragCoord.y) * visWidth + int(gl_FragCoord.x);

    // Base sphere index for this group of 32
    int baseIndex = texelIndex * 32;

    // Since boundsTextureWidth is a multiple of 32, all 32 spheres are on the same row.
    // Compute row coordinates once.
    int baseX = baseIndex % boundsTextureWidth;
    int boundsY = baseIndex / boundsTextureWidth;

    uint visBits = 0u;
    uint cachedTransformIdx = 0xFFFFFFFFu;
    mat4 worldMatrix;
    vec4 row0, row1, row2;

    for (int b = 0; b < 32; b++) {
        int sphereIndex = baseIndex + b;
        if (sphereIndex >= totalBoundsEntries) break;

        ivec2 boundsCoord = ivec2(baseX + b, boundsY);

        // Read local-space bounding sphere (center.xyz, radius)
        vec4 sphere = texelFetch(boundsSphereTexture, boundsCoord, 0);
        vec3 localCenter = sphere.xyz;
        float radius = sphere.w;

        // Read GSplatInfo transform index
        uint transformIdx = texelFetch(boundsTransformIndexTexture, boundsCoord, 0).r;

        // Reconstruct world matrix only when transform index changes.
        // The texture stores 3 texels per matrix (rows of a 4x3 affine matrix).
        // Transpose back to column-major mat4 and append the implicit (0,0,0,1) row.
        if (transformIdx != cachedTransformIdx) {
            cachedTransformIdx = transformIdx;
            int baseTexel = int(transformIdx) * 3;
            int tx = baseTexel % transformsTextureWidth;
            int ty = baseTexel / transformsTextureWidth;
            row0 = texelFetch(transformsTexture, ivec2(tx,     ty), 0);
            row1 = texelFetch(transformsTexture, ivec2(tx + 1, ty), 0);
            row2 = texelFetch(transformsTexture, ivec2(tx + 2, ty), 0);
            worldMatrix = mat4(
                row0.x, row1.x, row2.x, 0,
                row0.y, row1.y, row2.y, 0,
                row0.z, row1.z, row2.z, 0,
                row0.w, row1.w, row2.w, 1
            );
        }

        // Transform sphere center to world space
        vec3 worldCenter = (worldMatrix * vec4(localCenter, 1.0)).xyz;

        // World-space radius (uniform scale: all column lengths are equal)
        float worldRadius = radius * length(vec3(row0.x, row1.x, row2.x));

        // Test against 6 frustum planes
        bool visible = true;
        for (int p = 0; p < 6; p++) {
            float dist = dot(frustumPlanes[p].xyz, worldCenter) + frustumPlanes[p].w;
            if (dist <= -worldRadius) {
                visible = false;
                break;
            }
        }

        if (visible) {
            visBits |= (1u << uint(b));
        }
    }

    gl_FragColor = visBits;
}
`;
