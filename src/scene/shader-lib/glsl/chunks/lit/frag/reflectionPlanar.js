// Reflections sampled from a planar reflection texture: the scene rendered by a camera mirrored by
// the plane, with the view projection matrix of that camera.
export default /* glsl */`
uniform sampler2D texture_planarReflectionMap;
uniform mat4 planarReflectionMatrix;
uniform float material_reflectivity;

vec3 calcReflection(vec3 reflDir, float gloss) {

    // Project a point a short distance along the reflected ray into the texture. For a surface
    // lying on the plane, this is the pixel the surface itself projects to. A normal tilted away
    // from the plane, by a normal map or a bevel, moves the point, distorting the reflection.
    vec4 clipPos = planarReflectionMatrix * vec4(vPositionW + reflDir * 0.2, 1.0);
    vec2 uv = getGrabScreenPos(clipPos);

    // rougher surfaces sample the smaller mipmaps of the texture, blurring the reflection
    float maxLod = log2(float(textureSize(texture_planarReflectionMap, 0).x));
    float lod = (1.0 - gloss) * maxLod;

    return {reflectionDecode}(texture2DLod(texture_planarReflectionMap, uv, lod));
}

void addReflection(vec3 reflDir, float gloss) {
    dReflection += vec4(calcReflection(reflDir, gloss), material_reflectivity);
}
`;
