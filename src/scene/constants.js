/**
 * @constant
 * @name BLEND_SUBTRACTIVE
 * @type {number}
 * @description Subtract the color of the source fragment from the destination fragment
 * and write the result to the frame buffer.
 */
export const BLEND_SUBTRACTIVE = 0;
/**
 * @constant
 * @name BLEND_ADDITIVE
 * @type {number}
 * @description Add the color of the source fragment to the destination fragment
 * and write the result to the frame buffer.
 */
export const BLEND_ADDITIVE = 1;
/**
 * @constant
 * @name BLEND_NORMAL
 * @type {number}
 * @description Enable simple translucency for materials such as glass. This is
 * equivalent to enabling a source blend mode of {@link BLENDMODE_SRC_ALPHA} and a destination
 * blend mode of {@link BLENDMODE_ONE_MINUS_SRC_ALPHA}.
 */
export const BLEND_NORMAL = 2;
/**
 * @constant
 * @name BLEND_NONE
 * @type {number}
 * @description Disable blending.
 */
export const BLEND_NONE = 3;
/**
 * @constant
 * @name BLEND_PREMULTIPLIED
 * @type {number}
 * @description Similar to {@link BLEND_NORMAL} expect the source fragment is assumed to have
 * already been multiplied by the source alpha value.
 */
export const BLEND_PREMULTIPLIED = 4;
/**
 * @constant
 * @name BLEND_MULTIPLICATIVE
 * @type {number}
 * @description Multiply the color of the source fragment by the color of the destination
 * fragment and write the result to the frame buffer.
 */
export const BLEND_MULTIPLICATIVE = 5;
/**
 * @constant
 * @name BLEND_ADDITIVEALPHA
 * @type {number}
 * @description Same as {@link BLEND_ADDITIVE} except the source RGB is multiplied by the source alpha.
 */
export const BLEND_ADDITIVEALPHA = 6;

/**
 * @constant
 * @name BLEND_MULTIPLICATIVE2X
 * @type {number}
 * @description Multiplies colors and doubles the result.
 */
export const BLEND_MULTIPLICATIVE2X = 7;

/**
 * @constant
 * @name BLEND_SCREEN
 * @type {number}
 * @description Softer version of additive.
 */
export const BLEND_SCREEN = 8;

/**
 * @constant
 * @name BLEND_MIN
 * @type {number}
 * @description Minimum color. Check app.graphicsDevice.extBlendMinmax for support.
 */
export const BLEND_MIN = 9;

/**
 * @constant
 * @name BLEND_MAX
 * @type {number}
 * @description Maximum color. Check app.graphicsDevice.extBlendMinmax for support.
 */
export const BLEND_MAX = 10;

/**
 * @constant
 * @name FOG_NONE
 * @type {string}
 * @description No fog is applied to the scene.
 */
export const FOG_NONE = 'none';
/**
 * @constant
 * @name FOG_LINEAR
 * @type {string}
 * @description Fog rises linearly from zero to 1 between a start and end depth.
 */
export const FOG_LINEAR = 'linear';
/**
 * @constant
 * @name FOG_EXP
 * @type {string}
 * @description Fog rises according to an exponential curve controlled by a density value.
 */
export const FOG_EXP = 'exp';
/**
 * @constant
 * @name FOG_EXP2
 * @type {string}
 * @description Fog rises according to an exponential curve controlled by a density value.
 */
export const FOG_EXP2 = 'exp2';

/**
 * @constant
 * @name FRESNEL_NONE
 * @type {number}
 * @description No Fresnel.
 */
export const FRESNEL_NONE = 0;
/**
 * @constant
 * @name FRESNEL_SCHLICK
 * @type {number}
 * @description Schlick's approximation of Fresnel.
 */
export const FRESNEL_SCHLICK = 2;

// Legacy
export const LAYER_HUD = 0;
export const LAYER_GIZMO = 1;
export const LAYER_FX = 2;
// 3 - 14 are custom user layers
export const LAYER_WORLD = 15;

// New layers
/**
 * @constant
 * @name LAYERID_WORLD
 * @type {number}
 * @description The world layer.
 */
export const LAYERID_WORLD = 0;
/**
 * @constant
 * @name LAYERID_DEPTH
 * @type {number}
 * @description The depth layer.
 */
export const LAYERID_DEPTH = 1;
/**
 * @constant
 * @name LAYERID_SKYBOX
 * @type {number}
 * @description The skybox layer.
 */
export const LAYERID_SKYBOX = 2;
/**
 * @constant
 * @name LAYERID_IMMEDIATE
 * @type {number}
 * @description The immediate layer.
 */
export const LAYERID_IMMEDIATE = 3;
/**
 * @constant
 * @name LAYERID_UI
 * @type {number}
 * @description The UI layer.
 */
export const LAYERID_UI = 4;

/**
 * @constant
 * @name LIGHTTYPE_DIRECTIONAL
 * @type {number}
 * @description Directional (global) light source.
 */
export const LIGHTTYPE_DIRECTIONAL = 0;
/**
 * @constant
 * @private
 * @name LIGHTTYPE_OMNI
 * @type {number}
 * @description Omni-directional (local) light source.
 */
export const LIGHTTYPE_OMNI = 1;
/**
 * @constant
 * @name LIGHTTYPE_POINT
 * @type {number}
 * @description Point (local) light source.
 */
export const LIGHTTYPE_POINT = LIGHTTYPE_OMNI;
/**
 * @constant
 * @name LIGHTTYPE_SPOT
 * @type {number}
 * @description Spot (local) light source.
 */
export const LIGHTTYPE_SPOT = 2;

/**
 * @constant
 * @name LIGHTSHAPE_PUNCTUAL
 * @type {number}
 * @description Infinitesimally small point light source shape.
 */
export const LIGHTSHAPE_PUNCTUAL = 0;

/**
 * @constant
 * @name LIGHTSHAPE_RECT
 * @type {number}
 * @description Rectangle shape of light source.
 */
export const LIGHTSHAPE_RECT = 1;

/**
 * @constant
 * @name LIGHTSHAPE_DISK
 * @type {number}
 * @description Disk shape of light source.
 */
export const LIGHTSHAPE_DISK = 2;

/**
 * @constant
 * @name LIGHTSHAPE_SPHERE
 * @type {number}
 * @description Sphere shape of light source.
 */
export const LIGHTSHAPE_SPHERE = 3;

/**
 * @constant
 * @name LIGHTFALLOFF_LINEAR
 * @type {number}
 * @description Linear distance falloff model for light attenuation.
 */
export const LIGHTFALLOFF_LINEAR = 0;
/**
 * @constant
 * @name LIGHTFALLOFF_INVERSESQUARED
 * @type {number}
 * @description Inverse squared distance falloff model for light attenuation.
 */
export const LIGHTFALLOFF_INVERSESQUARED = 1;

/**
 * @constant
 * @name SHADOW_PCF3
 * @type {number}
 * @description Render depth (color-packed on WebGL 1.0), can be used for PCF 3x3 sampling.
 */
export const SHADOW_PCF3 = 0;
export const SHADOW_DEPTH = 0; // alias for SHADOW_PCF3 for backwards compatibility
/**
 * @constant
 * @name SHADOW_VSM8
 * @type {number}
 * @description Render packed variance shadow map. All shadow receivers must also cast shadows for this mode to work correctly.
 */
export const SHADOW_VSM8 = 1;
/**
 * @constant
 * @name SHADOW_VSM16
 * @type {number}
 * @description Render 16-bit exponential variance shadow map. Requires OES_texture_half_float extension. Falls back to {@link SHADOW_VSM8}, if not supported.
 */
export const SHADOW_VSM16 = 2;
/**
 * @constant
 * @name SHADOW_VSM32
 * @type {number}
 * @description Render 32-bit exponential variance shadow map. Requires OES_texture_float extension. Falls back to {@link SHADOW_VSM16}, if not supported.
 */
export const SHADOW_VSM32 = 3;
/**
 * @constant
 * @name SHADOW_PCF5
 * @type {number}
 * @description Render depth buffer only, can be used for hardware-accelerated PCF 5x5 sampling. Requires WebGL2. Falls back to {@link SHADOW_PCF3} on WebGL 1.0.
 */
export const SHADOW_PCF5 = 4;

// non-public number of supported depth shadow modes
export const SHADOW_COUNT = 5;

/**
 * @constant
 * @name BLUR_BOX
 * @type {number}
 * @description Box filter.
 */
export const BLUR_BOX = 0;
/**
 * @constant
 * @name BLUR_GAUSSIAN
 * @type {number}
 * @description Gaussian filter. May look smoother than box, but requires more samples.
 */
export const BLUR_GAUSSIAN = 1;

/**
 * @constant
 * @name PARTICLESORT_NONE
 * @type {number}
 * @description No sorting, particles are drawn in arbitrary order. Can be simulated on GPU.
 */
export const PARTICLESORT_NONE = 0;
/**
 * @constant
 * @name PARTICLESORT_DISTANCE
 * @type {number}
 * @description Sorting based on distance to the camera. CPU only.
 */
export const PARTICLESORT_DISTANCE = 1;
/**
 * @constant
 * @name PARTICLESORT_NEWER_FIRST
 * @type {number}
 * @description Newer particles are drawn first. CPU only.
 */
export const PARTICLESORT_NEWER_FIRST = 2;
/**
 * @constant
 * @name PARTICLESORT_OLDER_FIRST
 * @type {number}
 * @description Older particles are drawn first. CPU only.
 */
export const PARTICLESORT_OLDER_FIRST = 3;

export const PARTICLEMODE_GPU = 0;
export const PARTICLEMODE_CPU = 1;

/**
 * @constant
 * @name EMITTERSHAPE_BOX
 * @type {number}
 * @description Box shape parameterized by emitterExtents. Initial velocity is directed towards local Z axis.
 */
export const EMITTERSHAPE_BOX = 0;
/**
 * @constant
 * @name EMITTERSHAPE_SPHERE
 * @type {number}
 * @description Sphere shape parameterized by emitterRadius. Initial velocity is directed outwards from the center.
 */
export const EMITTERSHAPE_SPHERE = 1;

/**
 * @constant
 * @name PARTICLEORIENTATION_SCREEN
 * @type {number}
 * @description Particles are facing camera.
 */
export const PARTICLEORIENTATION_SCREEN = 0;
/**
 * @constant
 * @name PARTICLEORIENTATION_WORLD
 * @type {number}
 * @description User defines world space normal (particleNormal) to set planes orientation.
 */
export const PARTICLEORIENTATION_WORLD = 1;
/**
 * @constant
 * @name PARTICLEORIENTATION_EMITTER
 * @type {number}
 * @description Similar to previous, but the normal is affected by emitter(entity) transformation.
 */
export const PARTICLEORIENTATION_EMITTER = 2;

/**
 * @constant
 * @name PROJECTION_PERSPECTIVE
 * @type {number}
 * @description A perspective camera projection where the frustum shape is essentially pyramidal.
 */
export const PROJECTION_PERSPECTIVE = 0;
/**
 * @constant
 * @name PROJECTION_ORTHOGRAPHIC
 * @type {number}
 * @description An orthographic camera projection where the frustum shape is essentially a cuboid.
 */
export const PROJECTION_ORTHOGRAPHIC = 1;

/**
 * @constant
 * @name RENDERSTYLE_SOLID
 * @type {number}
 * @description Render mesh instance as solid geometry.
 */
export const RENDERSTYLE_SOLID = 0;
/**
 * @constant
 * @name RENDERSTYLE_WIREFRAME
 * @type {number}
 * @description Render mesh instance as wireframe.
 */
export const RENDERSTYLE_WIREFRAME = 1;
/**
 * @constant
 * @name RENDERSTYLE_POINTS
 * @type {number}
 * @description Render mesh instance as points.
 */
export const RENDERSTYLE_POINTS = 2;

/**
 * @constant
 * @name CUBEPROJ_NONE
 * @type {number}
 * @description The cube map is treated as if it is infinitely far away.
 */
export const CUBEPROJ_NONE = 0;
/**
 * @constant
 * @name CUBEPROJ_BOX
 * @type {number}
 * @description The cube map is box-projected based on a world space axis-aligned bounding box.
 */
export const CUBEPROJ_BOX = 1;

/**
 * @constant
 * @name SPECULAR_PHONG
 * @type {number}
 * @description Phong without energy conservation. You should only use it as a backwards compatibility with older projects.
 */
export const SPECULAR_PHONG = 0;
/**
 * @constant
 * @name SPECULAR_BLINN
 * @type {number}
 * @description Energy-conserving Blinn-Phong.
 */
export const SPECULAR_BLINN = 1;

/**
 * @constant
 * @name DETAILMODE_MUL
 * @type {string}
 * @description Multiply together the primary and secondary colors.
 */
export const DETAILMODE_MUL = 'mul';
/**
 * @constant
 * @name DETAILMODE_ADD
 * @type {string}
 * @description Add together the primary and secondary colors.
 */
export const DETAILMODE_ADD = 'add';
/**
 * @constant
 * @name DETAILMODE_SCREEN
 * @type {string}
 * @description Softer version of {@link DETAILMODE_ADD}.
 */
export const DETAILMODE_SCREEN = 'screen';
/**
 * @constant
 * @name DETAILMODE_OVERLAY
 * @type {string}
 * @description Multiplies or screens the colors, depending on the primary color.
 */
export const DETAILMODE_OVERLAY = 'overlay';
/**
 * @constant
 * @name DETAILMODE_MIN
 * @type {string}
 * @description Select whichever of the primary and secondary colors is darker, component-wise.
 */
export const DETAILMODE_MIN = 'min';
/**
 * @constant
 * @name DETAILMODE_MAX
 * @type {string}
 * @description Select whichever of the primary and secondary colors is lighter, component-wise.
 */
export const DETAILMODE_MAX = 'max';

/**
 * @constant
 * @name GAMMA_NONE
 * @type {number}
 * @description No gamma correction.
 */
export const GAMMA_NONE = 0;
/**
 * @constant
 * @name GAMMA_SRGB
 * @type {number}
 * @description Apply sRGB gamma correction.
 */
export const GAMMA_SRGB = 1;
/**
 * @deprecated
 * @constant
 * @name GAMMA_SRGBFAST
 * @type {number}
 * @description Apply sRGB (fast) gamma correction.
 */
export const GAMMA_SRGBFAST = 2; // deprecated
/**
 * @constant
 * @name GAMMA_SRGBHDR
 * @type {number}
 * @description Apply sRGB (HDR) gamma correction.
 */
export const GAMMA_SRGBHDR = 3;

/**
 * @constant
 * @name TONEMAP_LINEAR
 * @type {number}
 * @description Linear tonemapping.
 */
export const TONEMAP_LINEAR = 0;
/**
 * @constant
 * @name TONEMAP_FILMIC
 * @type {number}
 * @description Filmic tonemapping curve.
 */
export const TONEMAP_FILMIC = 1;
/**
 * @constant
 * @name TONEMAP_HEJL
 * @type {number}
 * @description Hejl filmic tonemapping curve.
 */
export const TONEMAP_HEJL = 2;
/**
 * @constant
 * @name TONEMAP_ACES
 * @type {number}
 * @description ACES filmic tonemapping curve.
 */
export const TONEMAP_ACES = 3;
/**
 * @constant
 * @name TONEMAP_ACES2
 * @type {number}
 * @description ACES v2 filmic tonemapping curve.
 */
export const TONEMAP_ACES2 = 4;

/**
 * @constant
 * @name SPECOCC_NONE
 * @type {number}
 * @description No specular occlusion.
 */
export const SPECOCC_NONE = 0;
/**
 * @constant
 * @name SPECOCC_AO
 * @type {number}
 * @description Use AO directly to occlude specular.
 */
export const SPECOCC_AO = 1;
/**
 * @constant
 * @name SPECOCC_GLOSSDEPENDENT
 * @type {number}
 * @description Modify AO based on material glossiness/view angle to occlude specular.
 */
export const SPECOCC_GLOSSDEPENDENT = 2;

// 16 bits for shader defs
export const SHADERDEF_NOSHADOW = 1;
export const SHADERDEF_SKIN = 2;
export const SHADERDEF_UV0 = 4;
export const SHADERDEF_UV1 = 8;
export const SHADERDEF_VCOLOR = 16;
export const SHADERDEF_INSTANCING = 32;
export const SHADERDEF_LM = 64;
export const SHADERDEF_DIRLM = 128;
export const SHADERDEF_SCREENSPACE = 256;
export const SHADERDEF_TANGENTS = 512;
export const SHADERDEF_MORPH_POSITION = 1024;
export const SHADERDEF_MORPH_NORMAL = 2048;
export const SHADERDEF_MORPH_TEXTURE_BASED = 4096;

export const LINEBATCH_WORLD = 0;
export const LINEBATCH_OVERLAY = 1;
export const LINEBATCH_GIZMO = 2;

/**
 * @constant
 * @name SHADOWUPDATE_NONE
 * @type {number}
 * @description The shadow map is not to be updated.
 */
export const SHADOWUPDATE_NONE = 0;
/**
 * @constant
 * @name SHADOWUPDATE_THISFRAME
 * @type {number}
 * @description The shadow map is regenerated this frame and not on subsequent frames.
 */
export const SHADOWUPDATE_THISFRAME = 1;
/**
 * @constant
 * @name SHADOWUPDATE_REALTIME
 * @type {number}
 * @description The shadow map is regenerated every frame.
 */
export const SHADOWUPDATE_REALTIME = 2;

export const SORTKEY_FORWARD = 0;
export const SORTKEY_DEPTH = 1;

export const MASK_DYNAMIC = 1;
export const MASK_BAKED = 2;
export const MASK_LIGHTMAP = 4;

/**
 * @constant
 * @name SHADER_FORWARD
 * @type {number}
 * @description Render shaded materials with gamma correction and tonemapping.
 */
export const SHADER_FORWARD = 0;

/**
 * @constant
 * @name SHADER_FORWARDHDR
 * @type {number}
 * @description Render shaded materials without gamma correction and tonemapping.
 */
export const SHADER_FORWARDHDR = 1;

/**
 * @constant
 * @name SHADER_DEPTH
 * @type {number}
 * @description Render RGBA-encoded depth value.
 */
export const SHADER_DEPTH = 2;

// next are undocumented
export const SHADER_SHADOW = 3; // PCF3
// 4 = VSM8,
// 5 = VSM16,
// 6 = VSM32,
// 7 = PCF5,
// 8 = PCF3 POINT
// 9 = VSM8 POINT,
// 10 = VSM16 POINT,
// 11 = VSM32 POINT,
// 12 = PCF5 POINT
// 13 = PCF3 SPOT
// 14 = VSM8 SPOT,
// 15 = VSM16 SPOT,
// 16 = VSM32 SPOT,
// 17 = PCF5 SPOT
export const SHADER_PICK = 18;

/**
 * @constant
 * @type {number}
 * @name SPRITE_RENDERMODE_SIMPLE
 * @description This mode renders a sprite as a simple quad.
 */
export const SPRITE_RENDERMODE_SIMPLE = 0;

/**
 * @constant
 * @type {number}
 * @name SPRITE_RENDERMODE_SLICED
 * @description This mode renders a sprite using 9-slicing in 'sliced' mode. Sliced mode stretches the
 * top and bottom regions of the sprite horizontally, the left and right regions vertically and the middle region
 * both horizontally and vertically.
 */
export const SPRITE_RENDERMODE_SLICED = 1;

/**
 * @constant
 * @type {number}
 * @name SPRITE_RENDERMODE_TILED
 * @description This mode renders a sprite using 9-slicing in 'tiled' mode. Tiled mode tiles the
 * top and bottom regions of the sprite horizontally, the left and right regions vertically and the middle region
 * both horizontally and vertically.
 */
export const SPRITE_RENDERMODE_TILED = 2;

/**
 * @constant
 * @name BAKE_COLOR
 * @type {number}
 * @description Single color lightmap.
 */
export const BAKE_COLOR = 0;
/**
 * @constant
 * @name BAKE_COLORDIR
 * @type {number}
 * @description Single color lightmap + dominant light direction (used for bump/specular).
 */
export const BAKE_COLORDIR = 1;

/**
 * @constant
 * @name VIEW_CENTER
 * @type {number}
 * @description Center of view.
 */
export const VIEW_CENTER = 0;
/**
 * @constant
 * @name VIEW_LEFT
 * @type {number}
 * @description Left of view. Only used in stereo rendering.
 */
export const VIEW_LEFT = 1;
/**
 * @constant
 * @name VIEW_RIGHT
 * @type {number}
 * @description Right of view. Only used in stereo rendering.
 */
export const VIEW_RIGHT = 2;

/**
 * @constant
 * @name SORTMODE_NONE
 * @type {number}
 * @description No sorting is applied. Mesh instances are rendered in the same order they were added to a layer.
 */
export const SORTMODE_NONE = 0;

/**
 * @constant
 * @name SORTMODE_MANUAL
 * @type {number}
 * @description Mesh instances are sorted based on {@link MeshInstance#drawOrder}.
 */
export const SORTMODE_MANUAL = 1;

/**
 * @constant
 * @name SORTMODE_MATERIALMESH
 * @type {number}
 * @description Mesh instances are sorted to minimize switching between materials and meshes to improve rendering performance.
 */
export const SORTMODE_MATERIALMESH = 2;

/**
 * @constant
 * @name SORTMODE_BACK2FRONT
 * @type {number}
 * @description Mesh instances are sorted back to front. This is the way to properly render many semi-transparent objects on different depth, one is blended on top of another.
 */
export const SORTMODE_BACK2FRONT = 3;

/**
 * @constant
 * @name SORTMODE_FRONT2BACK
 * @type {number}
 * @description Mesh instances are sorted front to back. Depending on GPU and the scene, this option may give better performance than {@link SORTMODE_MATERIALMESH} due to reduced overdraw.
 */
export const SORTMODE_FRONT2BACK = 4;

/**
 * @private
 * @constant
 * @name SORTMODE_CUSTOM
 * @type {number}
 * @description Provide custom functions for sorting drawcalls and calculating distance.
 */
export const SORTMODE_CUSTOM = 5;

export const COMPUPDATED_INSTANCES = 1;
export const COMPUPDATED_LIGHTS = 2;
export const COMPUPDATED_CAMERAS = 4;
export const COMPUPDATED_BLEND = 8;

/**
 * @constant
 * @name ASPECT_AUTO
 * @type {number}
 * @description Automatically set aspect ratio to current render target's width divided by height.
 */
export const ASPECT_AUTO = 0;
/**
 * @constant
 * @name ASPECT_MANUAL
 * @type {number}
 * @description Use the manual aspect ratio value.
 */
export const ASPECT_MANUAL = 1;

/**
 * @constant
 * @name ORIENTATION_HORIZONTAL
 * @type {number}
 * @description Horizontal orientation.
 */
export const ORIENTATION_HORIZONTAL = 0;
/**
 * @constant
 * @name ORIENTATION_VERTICAL
 * @type {number}
 * @description Vertical orientation.
 */
export const ORIENTATION_VERTICAL = 1;
