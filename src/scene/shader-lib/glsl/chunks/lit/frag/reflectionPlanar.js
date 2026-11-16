// Reflections sampled from a planar reflection texture: the scene rendered by a camera mirrored by
// the plane, with the view projection matrix of that camera.
export default /* glsl */`
uniform sampler2D texture_planarReflectionMap;
uniform mat4 planarReflectionMatrix;
uniform float planarReflectionMipmaps;
uniform float material_reflectivity;

// The weights of the cubic B-spline of the four texels around a sample position.
vec4 planarCubicWeights(float v) {
    vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
    vec4 s = n * n * n;
    float x = s.x;
    float y = s.y - 4.0 * s.x;
    float z = s.z - 4.0 * s.y + 6.0 * s.x;
    return vec4(x, y, z, 6.0 - x - y - z) * (1.0 / 6.0);
}

// A mip level of the reflection, filtered by a bicubic B-spline from four bilinear taps. Where a
// small mip level covers many pixels, this is smooth, while the bilinear filtering shows its texels.
vec3 samplePlanarBicubic(vec2 uv, float level) {
    vec2 size = vec2(textureSize(texture_planarReflectionMap, int(level)));
    vec2 texel = uv * size - 0.5;
    vec2 f = fract(texel);
    texel -= f;

    vec4 wx = planarCubicWeights(f.x);
    vec4 wy = planarCubicWeights(f.y);
    vec4 c = texel.xxyy + vec2(-0.5, 1.5).xyxy;
    vec4 s = vec4(wx.xz + wx.yw, wy.xz + wy.yw);
    vec4 offset = (c + vec4(wx.yw, wy.yw) / s) / size.xxyy;

    vec3 s0 = {reflectionDecode}(texture2DLod(texture_planarReflectionMap, offset.xz, level));
    vec3 s1 = {reflectionDecode}(texture2DLod(texture_planarReflectionMap, offset.yz, level));
    vec3 s2 = {reflectionDecode}(texture2DLod(texture_planarReflectionMap, offset.xw, level));
    vec3 s3 = {reflectionDecode}(texture2DLod(texture_planarReflectionMap, offset.yw, level));

    float sx = s.x / (s.x + s.y);
    float sy = s.z / (s.z + s.w);
    return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
}

vec3 calcReflection(vec3 reflDir, float gloss) {

    // Project a point a short distance along the reflected ray into the texture. For a surface
    // lying on the plane, this is the pixel the surface itself projects to. A normal tilted away
    // from the plane, by a normal map or a bevel, moves the point, distorting the reflection.
    vec4 clipPos = planarReflectionMatrix * vec4(litArgs_worldPosition + reflDir * 0.2, 1.0);
    vec2 uv = getGrabScreenPos(clipPos);

    // rougher surfaces sample the smaller mipmaps of the texture, blurring the reflection, up to
    // its last mip level, when it has mipmaps
    vec2 size = vec2(textureSize(texture_planarReflectionMap, 0));
    float maxLevel = floor(log2(max(size.x, size.y))) * planarReflectionMipmaps;
    float lod = min((1.0 - gloss) * log2(size.x), maxLevel);
    float level = floor(lod);

    // the top level is sampled bilinearly, which keeps a mirror sharp, and the blurred levels by
    // the bicubic B-spline, blending the two levels around the level of detail
    vec3 reflection;
    if (level < 1.0) {
        reflection = {reflectionDecode}(texture2DLod(texture_planarReflectionMap, uv, 0.0));
    } else {
        reflection = samplePlanarBicubic(uv, level);
    }
    if (lod > level) {
        reflection = mix(reflection, samplePlanarBicubic(uv, level + 1.0), lod - level);
    }
    return reflection;
}

void addReflection(vec3 reflDir, float gloss) {
    dReflection += vec4(calcReflection(reflDir, gloss), material_reflectivity);
}
`;
