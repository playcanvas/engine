/**
 * WGSL compute shader chunk giving access to the scene depth map of a camera, attached to the
 * compute instance with {@link Compute#setSceneDepthMap}.
 *
 * Usage in compute shaders: #include "sceneDepthCS"
 *
 * Provides:
 * - sceneDepthSize() -> vec2u: the dimensions of the depth map.
 * - sceneDepthNearClip() -> f32, sceneDepthFarClip() -> f32: the clip planes the depth map was
 * rendered with.
 * - sceneDepthLinear(texel: vec2i) -> f32: the linear camera depth, in world units.
 * - sceneDepthWorldPosition(texel: vec2i) -> vec3f: the world position of the surface at the texel.
 *
 * The producers of the depth map store it differently, and the engine compiles a variant of the
 * shader for the way the attached depth map is stored, using the SCENE_DEPTHMAP_LINEAR and
 * SCENE_DEPTHMAP_RECIPROCAL defines, so the decode involves no branching.
 *
 * @ignore
 */
export default /* wgsl */`
var computeSceneDepthMap: texture_2d<uff>;

// the camera parameters the depth map was rendered with, laid out as camera_params: x: 1 / far
// clip, y: far clip, z: near clip, w: 1 for an orthographic projection, 0 for a perspective one
uniform computeSceneDepthCameraParams: vec4f;

// the inverse of the view projection matrix the depth map was rendered with
uniform computeSceneDepthViewProjectionInverse: mat4x4f;

fn sceneDepthSize() -> vec2u {
    return textureDimensions(computeSceneDepthMap, 0);
}

fn sceneDepthNearClip() -> f32 {
    return uniform.computeSceneDepthCameraParams.z;
}

fn sceneDepthFarClip() -> f32 {
    return uniform.computeSceneDepthCameraParams.y;
}

fn sceneDepthLinear(texel: vec2i) -> f32 {
    let value = textureLoad(computeSceneDepthMap, texel, 0).r;
    let params = uniform.computeSceneDepthCameraParams;

    #ifdef SCENE_DEPTHMAP_LINEAR
        #ifdef SCENE_DEPTHMAP_RECIPROCAL
            // a coverage weighted average of the reciprocals of the depths, inverted back into a
            // depth. Zero is a texel nothing was rendered to, which reads as the far clip.
            return select(params.y, 1.0 / value, value > 0.0);
        #else
            return value;
        #endif
    #else
        // the depth buffer value, linearized for either projection
        let perspective = (params.z * params.y) / (params.y + value * (params.z - params.y));
        let orthographic = params.z + value * (params.y - params.z);
        return select(perspective, orthographic, params.w > 0.5);
    #endif
}

fn sceneDepthUnproject(ndc: vec3f) -> vec3f {
    let position = uniform.computeSceneDepthViewProjectionInverse * vec4f(ndc, 1.0);
    return position.xyz / position.w;
}

fn sceneDepthWorldPosition(texel: vec2i) -> vec3f {
    let uv = (vec2f(texel) + 0.5) / vec2f(sceneDepthSize());
    let ndc = vec2f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);

    #ifdef SCENE_DEPTHMAP_LINEAR
        // the linear depth places the surface between the points of the texel on the near and the
        // far plane, along which the depth changes linearly
        let params = uniform.computeSceneDepthCameraParams;
        let nearPoint = sceneDepthUnproject(vec3f(ndc, 0.0));
        let farPoint = sceneDepthUnproject(vec3f(ndc, 1.0));
        return mix(nearPoint, farPoint, (sceneDepthLinear(texel) - params.z) / (params.y - params.z));
    #else
        // the depth buffer value is the depth the surface was projected to
        return sceneDepthUnproject(vec3f(ndc, textureLoad(computeSceneDepthMap, texel, 0).r));
    #endif
}
`;
