// Scene texture support for custom shaders (for example ShaderMaterial). The scene textures are the
// additional color attachments the scene pass renders alongside the scene color, holding per pixel
// data such as the linear depth, which the post-processing effects then consume.
//
// Include this chunk and call the write function of each scene texture at the end of the fragment
// shader, passing a pointer to the fragment output alongside the fragment's own values:
//     writeSceneTextureDepth(&output, linearDepth, 1.0);
//
// The calls need no guarding - when the camera does not render a scene texture, its write function
// does nothing. A material has to declare that its shader writes the scene textures by setting
// Material#sceneTexturesWrite, and once it does, it has to write all of them.
export default /* wgsl */`

#ifndef SCENE_TEXTURES
#define SCENE_TEXTURES

// Writes the fragment's contribution to the scene depth texture.
//
// The alpha is the fragment's coverage: opaque geometry passes 1.0, blended geometry (gaussian splats)
// its own alpha. What is accumulated is the reciprocal of the depth, pre-multiplied by that coverage, so
// that under the premultiplied blending the splats already use the attachment holds a coverage weighted
// average of the reciprocal - the weights sum to one on their own, with whatever coverage is left over
// falling to the value the attachment was cleared to. Clearing it to the reciprocal of the far clip
// therefore makes the background a surface at that distance, and averaging reciprocals rather than
// depths is what stops it dragging a partly covered pixel most of the way out to it. The read inverts
// the average back into a depth. Opaque geometry, passing 1.0, simply overwrites.
fn writeSceneTextureDepth(output: ptr<function, FragmentOutput>, linearDepth: f32, alpha: f32) {
    #ifdef SCENE_TEXTURE_DEPTH
        (*output).color{SCENE_TEXTURE_DEPTH_SLOT} = vec4f(alpha / max(linearDepth, 1e-6), 0.0, 0.0, alpha);
    #endif
}

#endif // SCENE_TEXTURES
`;
