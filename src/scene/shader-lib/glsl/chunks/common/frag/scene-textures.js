// Scene texture support for custom shaders (for example ShaderMaterial). The scene textures are the
// additional color attachments the scene pass renders alongside the scene color, holding per pixel
// data such as the linear depth, which the post-processing effects then consume.
//
// Include this chunk and call the write function of each scene texture at the end of the fragment
// shader, passing the fragment's own values:
//     writeSceneTextureDepth(linearDepth, 1.0);
//
// The calls need no guarding - when the camera does not render a scene texture, its write function
// does nothing. A material has to declare that its shader writes the scene textures by setting
// Material#sceneTexturesWrite, and once it does, it has to write all of them.
export default /* glsl */`

#ifndef SCENE_TEXTURES
#define SCENE_TEXTURES

// Writes the fragment's contribution to the scene depth texture.
//
// The alpha parameter is the fragment's coverage: opaque geometry passes 1.0, while blended geometry
// (gaussian splats) passes its own alpha. The depth is pre-multiplied by it, so that under the
// premultiplied blending the splats already use, the attachment accumulates a transmittance weighted
// average of the depth - it composites as depth * alpha + depth * (1 - alpha), converging on the
// depth of the surface the splats form. Opaque geometry, passing an alpha of 1.0, simply overwrites.
void writeSceneTextureDepth(float linearDepth, float alpha) {
    #ifdef SCENE_TEXTURE_DEPTH
        pcFragColor{SCENE_TEXTURE_DEPTH_SLOT} = vec4(linearDepth * alpha, 0.0, 0.0, alpha);
    #endif
}

#endif // SCENE_TEXTURES
`;
