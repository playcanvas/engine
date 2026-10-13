/**
 * WGSL compute shader chunk giving access to the scene color map of a camera, attached to the
 * compute instance with {@link Compute#setSceneColorMap}.
 *
 * Usage in compute shaders: #include "sceneColorCS"
 *
 * Provides:
 * - sceneColorSize(lod: i32) -> vec2u: the dimensions of a mip level of the color map.
 * - sceneColorLoad(texel: vec2i, lod: i32) -> vec4f: the color of a texel, as stored.
 * - sceneColorSample(uv: vec2f, lod: f32) -> vec4f: the color sampled with filtering, as stored.
 * - sceneColorToLinear(color: vec3f) -> vec3f: converts a stored color to linear.
 * - sceneColorToDisplay(color: vec3f) -> vec3f: converts a stored color to gamma encoded.
 *
 * The colors are returned the way the camera stored them - linear when it renders without gamma
 * correction (for example using CameraFrame), and gamma encoded otherwise. SCENE_COLORMAP_GAMMA is
 * defined when they are gamma encoded, and the conversion functions compile to nothing when the
 * color is already in the requested space. The engine compiles a variant of the shader for the
 * attached color map, so none of this involves branching.
 *
 * When the format of the color map cannot be filtered on the device, SCENE_COLORMAP_UNFILTERABLE is
 * defined and sceneColorSample returns the nearest texel.
 *
 * @ignore
 */
export default /* wgsl */`
#ifdef SCENE_COLORMAP_UNFILTERABLE
    var computeSceneColorMap: texture_2d<uff>;
#else
    var computeSceneColorMap: texture_2d<f32>;
    var computeSceneColorMap_sampler: sampler;
#endif

fn sceneColorSize(lod: i32) -> vec2u {
    return textureDimensions(computeSceneColorMap, lod);
}

fn sceneColorLoad(texel: vec2i, lod: i32) -> vec4f {
    return textureLoad(computeSceneColorMap, texel, lod);
}

fn sceneColorSample(uv: vec2f, lod: f32) -> vec4f {
    #ifdef SCENE_COLORMAP_UNFILTERABLE
        let level = clamp(i32(round(lod)), 0, i32(textureNumLevels(computeSceneColorMap)) - 1);
        let size = vec2i(textureDimensions(computeSceneColorMap, level));
        let texel = clamp(vec2i(uv * vec2f(size)), vec2i(0), size - vec2i(1));
        return textureLoad(computeSceneColorMap, texel, level);
    #else
        return textureSampleLevel(computeSceneColorMap, computeSceneColorMap_sampler, uv, lod);
    #endif
}

fn sceneColorToLinear(color: vec3f) -> vec3f {
    #ifdef SCENE_COLORMAP_GAMMA
        return pow(max(color, vec3f(0.0)), vec3f(2.2));
    #else
        return color;
    #endif
}

fn sceneColorToDisplay(color: vec3f) -> vec3f {
    #ifdef SCENE_COLORMAP_GAMMA
        return color;
    #else
        return pow(max(color, vec3f(0.0)), vec3f(1.0 / 2.2));
    #endif
}
`;
