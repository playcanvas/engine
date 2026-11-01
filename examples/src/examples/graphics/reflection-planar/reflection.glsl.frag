// Replaces the environment reflection of a lit material with a planar reflection: the texture a
// camera mirrored by the plane renders the scene into. The rest of the lighting is unchanged, so
// the reflection is still scaled by the fresnel term and the specularity of the material.

uniform sampler2D planarReflectionMap;

// the view projection matrix of the mirrored camera
uniform mat4 planarReflectionViewProjection;

uniform float material_reflectivity;

vec3 calcReflection(vec3 reflDir, float gloss) {

    // Project a point a short distance along the reflected ray with the mirrored camera. For a
    // surface lying on the plane, this is the pixel the surface itself projects to. A normal tilted
    // away from the plane, by a normal map or a bevel, moves the point, distorting the reflection.
    vec4 clipPos = planarReflectionViewProjection * vec4(vPositionW + reflDir * 0.2, 1.0);
    vec2 uv = getGrabScreenPos(clipPos);

    // rougher surfaces sample the smaller mipmaps of the texture, blurring the reflection
    float maxLod = log2(float(textureSize(planarReflectionMap, 0).x));
    float lod = (1.0 - gloss) * maxLod;

    return texture2DLod(planarReflectionMap, uv, lod).rgb;
}

void addReflection(vec3 reflDir, float gloss) {
    dReflection += vec4(calcReflection(reflDir, gloss), material_reflectivity);
}
