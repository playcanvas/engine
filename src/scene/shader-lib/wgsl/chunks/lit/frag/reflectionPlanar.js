// Reflections sampled from a planar reflection texture: the scene rendered by a camera mirrored by
// the plane, with the view projection matrix of that camera.
export default /* wgsl */`
var texture_planarReflectionMap: texture_2d<f32>;
var texture_planarReflectionMapSampler: sampler;
uniform planarReflectionMatrix: mat4x4f;
uniform material_reflectivity: f32;

fn calcReflection(reflDir: vec3f, gloss: f32) -> vec3f {

    // Project a point a short distance along the reflected ray into the texture. For a surface
    // lying on the plane, this is the pixel the surface itself projects to. A normal tilted away
    // from the plane, by a normal map or a bevel, moves the point, distorting the reflection.
    let clipPos = uniform.planarReflectionMatrix * vec4f(vPositionW + reflDir * 0.2, 1.0);
    let uv = getGrabScreenPos(clipPos);

    // rougher surfaces sample the smaller mipmaps of the texture, blurring the reflection
    let maxLod = log2(f32(textureDimensions(texture_planarReflectionMap, 0).x));
    let lod = (1.0 - gloss) * maxLod;

    return {reflectionDecode}(textureSampleLevel(texture_planarReflectionMap, texture_planarReflectionMapSampler, uv, lod));
}

fn addReflection(reflDir: vec3f, gloss: f32) {
    dReflection = dReflection + vec4f(calcReflection(reflDir, gloss), uniform.material_reflectivity);
}
`;
