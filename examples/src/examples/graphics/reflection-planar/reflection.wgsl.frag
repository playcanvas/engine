// Replaces the environment reflection of a lit material with a planar reflection: the texture a
// camera mirrored by the plane renders the scene into. The rest of the lighting is unchanged, so
// the reflection is still scaled by the fresnel term and the specularity of the material.

var planarReflectionMap: texture_2d<f32>;
var planarReflectionMapSampler: sampler;

// the view projection matrix of the mirrored camera
uniform planarReflectionViewProjection: mat4x4f;

uniform material_reflectivity: f32;

fn calcReflection(reflDir: vec3f, gloss: f32) -> vec3f {

    // Project a point a short distance along the reflected ray with the mirrored camera. For a
    // surface lying on the plane, this is the pixel the surface itself projects to. A normal tilted
    // away from the plane, by a normal map or a bevel, moves the point, distorting the reflection.
    let clipPos = uniform.planarReflectionViewProjection * vec4f(vPositionW + reflDir * 0.2, 1.0);
    let uv = getGrabScreenPos(clipPos);

    // rougher surfaces sample the smaller mipmaps of the texture, blurring the reflection
    let maxLod = log2(f32(textureDimensions(planarReflectionMap, 0).x));
    let lod = (1.0 - gloss) * maxLod;

    return textureSampleLevel(planarReflectionMap, planarReflectionMapSampler, uv, lod).rgb;
}

fn addReflection(reflDir: vec3f, gloss: f32) {
    dReflection = dReflection + vec4f(calcReflection(reflDir, gloss), uniform.material_reflectivity);
}
