/**
 * @constant
 * @name pc.BLEND_SUBTRACTIVE
 * @type {number}
 * @description Subtract the color of the source fragment from the destination fragment
 * and write the result to the frame buffer.
 */
export var BLEND_SUBTRACTIVE = 0;
/**
 * @constant
 * @name pc.BLEND_ADDITIVE
 * @type {number}
 * @description Add the color of the source fragment to the destination fragment
 * and write the result to the frame buffer.
 */
export var BLEND_ADDITIVE = 1;
/**
 * @constant
 * @name pc.BLEND_NORMAL
 * @type {number}
 * @description Enable simple translucency for materials such as glass. This is
 * equivalent to enabling a source blend mode of pc.BLENDMODE_SRC_ALPHA and a destination
 * blend mode of pc.BLENDMODE_ONE_MINUS_SRC_ALPHA.
 */
export var BLEND_NORMAL = 2;
/**
 * @constant
 * @name pc.BLEND_NONE
 * @type {number}
 * @description Disable blending.
 */
export var BLEND_NONE = 3;
/**
 * @constant
 * @name pc.BLEND_PREMULTIPLIED
 * @type {number}
 * @description Similar to pc.BLEND_NORMAL expect the source fragment is assumed to have
 * already been multiplied by the source alpha value.
 */
export var BLEND_PREMULTIPLIED = 4;
/**
 * @constant
 * @name pc.BLEND_MULTIPLICATIVE
 * @type {number}
 * @description Multiply the color of the source fragment by the color of the destination
 * fragment and write the result to the frame buffer.
 */
export var BLEND_MULTIPLICATIVE = 5;
/**
 * @constant
 * @name pc.BLEND_ADDITIVEALPHA
 * @type {number}
 * @description Same as pc.BLEND_ADDITIVE except the source RGB is multiplied by the source alpha.
 */
export var BLEND_ADDITIVEALPHA = 6;

/**
 * @constant
 * @name pc.BLEND_MULTIPLICATIVE2X
 * @type {number}
 * @description Multiplies colors and doubles the result.
 */
export var BLEND_MULTIPLICATIVE2X = 7;

/**
 * @constant
 * @name pc.BLEND_SCREEN
 * @type {number}
 * @description Softer version of additive.
 */
export var BLEND_SCREEN = 8;

/**
 * @constant
 * @name pc.BLEND_MIN
 * @type {number}
 * @description Minimum color. Check app.graphicsDevice.extBlendMinmax for support.
 */
export var BLEND_MIN = 9;

/**
 * @constant
 * @name pc.BLEND_MAX
 * @type {number}
 * @description Maximum color. Check app.graphicsDevice.extBlendMinmax for support.
 */
export var BLEND_MAX = 10;

/**
 * @constant
 * @name pc.FOG_NONE
 * @type {string}
 * @description No fog is applied to the scene.
 */
export var FOG_NONE = 'none';
/**
 * @constant
 * @name pc.FOG_LINEAR
 * @type {string}
 * @description Fog rises linearly from zero to 1 between a start and end depth.
 */
export var FOG_LINEAR = 'linear';
/**
 * @constant
 * @name pc.FOG_EXP
 * @type {string}
 * @description Fog rises according to an exponential curve controlled by a density value.
 */
export var FOG_EXP = 'exp';
/**
 * @constant
 * @name pc.FOG_EXP2
 * @type {string}
 * @description Fog rises according to an exponential curve controlled by a density value.
 */
export var FOG_EXP2 = 'exp2';

/**
 * @constant
 * @name pc.FRESNEL_NONE
 * @type {number}
 * @description No Fresnel.
 */
export var FRESNEL_NONE = 0;
/**
 * @constant
 * @name pc.FRESNEL_SCHLICK
 * @type {number}
 * @description Schlick's approximation of Fresnel.
 */
export var FRESNEL_SCHLICK = 2;

// Legacy
export var LAYER_HUD = 0;
export var LAYER_GIZMO = 1;
export var LAYER_FX = 2;
// 3 - 14 are custom user layers
export var LAYER_WORLD = 15;

// New layers
/**
 * @constant
 * @name pc.LAYERID_WORLD
 * @type {number}
 * @description The world layer.
 */
export var LAYERID_WORLD = 0;
/**
 * @constant
 * @name pc.LAYERID_DEPTH
 * @type {number}
 * @description The depth layer.
 */
export var LAYERID_DEPTH = 1;
/**
 * @constant
 * @name pc.LAYERID_SKYBOX
 * @type {number}
 * @description The skybox layer.
 */
export var LAYERID_SKYBOX = 2;
/**
 * @constant
 * @name pc.LAYERID_IMMEDIATE
 * @type {number}
 * @description The immediate layer.
 */
export var LAYERID_IMMEDIATE = 3;
/**
 * @constant
 * @name pc.LAYERID_UI
 * @type {number}
 * @description The UI layer.
 */
export var LAYERID_UI = 4;

/**
 * @constant
 * @name pc.LIGHTTYPE_DIRECTIONAL
 * @type {number}
 * @description Directional (global) light source.
 */
export var LIGHTTYPE_DIRECTIONAL = 0;
/**
 * @constant
 * @name pc.LIGHTTYPE_POINT
 * @type {number}
 * @description Point (local) light source.
 */
export var LIGHTTYPE_POINT = 1;
/**
 * @constant
 * @name pc.LIGHTTYPE_SPOT
 * @type {number}
 * @description Spot (local) light source.
 */
export var LIGHTTYPE_SPOT = 2;

/**
 * @constant
 * @name pc.LIGHTSHAPE_PUNCTUAL
 * @type {number}
 * @description Rectangle shape of light source.
 */
export var LIGHTSHAPE_PUNCTUAL = 0;

/**
 * @constant
 * @name pc.LIGHTSHAPE_RECT
 * @type {number}
 * @description Rectangle shape of light source.
 */
export var LIGHTSHAPE_RECT = 1;

/**
 * @constant
 * @name pc.LIGHTFALLOFF_LINEAR
 * @type {number}
 * @description Linear distance falloff model for light attenuation.
 */
export var LIGHTFALLOFF_LINEAR = 0;
/**
 * @constant
 * @name pc.LIGHTFALLOFF_INVERSESQUARED
 * @type {number}
 * @description Inverse squared distance falloff model for light attenuation.
 */
export var LIGHTFALLOFF_INVERSESQUARED = 1;

/**
 * @constant
 * @name pc.SHADOW_PCF3
 * @type {number}
 * @description Render depth (color-packed on WebGL 1.0), can be used for PCF 3x3 sampling.
 */
export var SHADOW_PCF3 = 0;
export var SHADOW_DEPTH = 0; // alias for SHADOW_PCF3 for backwards compatibility
/**
 * @constant
 * @name pc.SHADOW_VSM8
 * @type {number}
 * @description Render packed variance shadow map. All shadow receivers must also cast shadows for this mode to work correctly.
 */
export var SHADOW_VSM8 = 1;
/**
 * @constant
 * @name pc.SHADOW_VSM16
 * @type {number}
 * @description Render 16-bit exponential variance shadow map. Requires OES_texture_half_float extension. Falls back to pc.SHADOW_VSM8, if not supported.
 */
export var SHADOW_VSM16 = 2;
/**
 * @constant
 * @name pc.SHADOW_VSM32
 * @type {number}
 * @description Render 32-bit exponential variance shadow map. Requires OES_texture_float extension. Falls back to pc.SHADOW_VSM16, if not supported.
 */
export var SHADOW_VSM32 = 3;
/**
 * @constant
 * @name pc.SHADOW_PCF5
 * @type {number}
 * @description Render depth buffer only, can be used for hardware-accelerated PCF 5x5 sampling. Requires WebGL2. Falls back to pc.SHADOW_PCF3 on WebGL 1.0.
 */
export var SHADOW_PCF5 = 4;

/**
 * @constant
 * @name pc.BLUR_BOX
 * @type {number}
 * @description Box filter.
 */
export var BLUR_BOX = 0;
/**
 * @constant
 * @name pc.BLUR_GAUSSIAN
 * @type {number}
 * @description Gaussian filter. May look smoother than box, but requires more samples.
 */
export var BLUR_GAUSSIAN = 1;

/**
 * @constant
 * @name pc.PARTICLESORT_NONE
 * @type {number}
 * @description No sorting, particles are drawn in arbitrary order. Can be simulated on GPU.
 */
export var PARTICLESORT_NONE = 0;
/**
 * @constant
 * @name pc.PARTICLESORT_DISTANCE
 * @type {number}
 * @description Sorting based on distance to the camera. CPU only.
 */
export var PARTICLESORT_DISTANCE = 1;
/**
 * @constant
 * @name pc.PARTICLESORT_NEWER_FIRST
 * @type {number}
 * @description Newer particles are drawn first. CPU only.
 */
export var PARTICLESORT_NEWER_FIRST = 2;
/**
 * @constant
 * @name pc.PARTICLESORT_OLDER_FIRST
 * @type {number}
 * @description Older particles are drawn first. CPU only.
 */
export var PARTICLESORT_OLDER_FIRST = 3;

export var PARTICLEMODE_GPU = 0;
export var PARTICLEMODE_CPU = 1;

/**
 * @constant
 * @name pc.EMITTERSHAPE_BOX
 * @type {number}
 * @description Box shape parameterized by emitterExtents. Initial velocity is directed towards local Z axis.
 */
export var EMITTERSHAPE_BOX = 0;
/**
 * @constant
 * @name pc.EMITTERSHAPE_SPHERE
 * @type {number}
 * @description Sphere shape parameterized by emitterRadius. Initial velocity is directed outwards from the center.
 */
export var EMITTERSHAPE_SPHERE = 1;

/**
 * @constant
 * @name pc.PARTICLEORIENTATION_SCREEN
 * @type {number}
 * @description Particles are facing camera.
 */
export var PARTICLEORIENTATION_SCREEN = 0;
/**
 * @constant
 * @name pc.PARTICLEORIENTATION_WORLD
 * @type {number}
 * @description User defines world space normal (particleNormal) to set planes orientation.
 */
export var PARTICLEORIENTATION_WORLD = 1;
/**
 * @constant
 * @name pc.PARTICLEORIENTATION_EMITTER
 * @type {number}
 * @description Similar to previous, but the normal is affected by emitter(entity) transformation.
 */
export var PARTICLEORIENTATION_EMITTER = 2;

/**
 * @constant
 * @name pc.PROJECTION_PERSPECTIVE
 * @type {number}
 * @description A perspective camera projection where the frustum shape is essentially pyramidal.
 */
export var PROJECTION_PERSPECTIVE = 0;
/**
 * @constant
 * @name pc.PROJECTION_ORTHOGRAPHIC
 * @type {number}
 * @description An orthographic camera projection where the frustum shape is essentially a cuboid.
 */
export var PROJECTION_ORTHOGRAPHIC = 1;

/**
 * @constant
 * @name pc.RENDERSTYLE_SOLID
 * @type {number}
 * @description Render mesh instance as solid geometry.
 */
export var RENDERSTYLE_SOLID = 0;
/**
 * @constant
 * @name pc.RENDERSTYLE_WIREFRAME
 * @type {number}
 * @description Render mesh instance as wireframe.
 */
export var RENDERSTYLE_WIREFRAME = 1;
/**
 * @constant
 * @name pc.RENDERSTYLE_POINTS
 * @type {number}
 * @description Render mesh instance as points.
 */
export var RENDERSTYLE_POINTS = 2;

/**
 * @constant
 * @name pc.CUBEPROJ_NONE
 * @type {number}
 * @description The cube map is treated as if it is infinitely far away.
 */
export var CUBEPROJ_NONE = 0;
/**
 * @constant
 * @name pc.CUBEPROJ_BOX
 * @type {number}
 * @description The cube map is box-projected based on a world space axis-aligned bounding box.
 */
export var CUBEPROJ_BOX = 1;

/**
 * @constant
 * @name pc.SPECULAR_PHONG
 * @type {number}
 * @description Phong without energy conservation. You should only use it as a backwards compatibility with older projects.
 */
export var SPECULAR_PHONG = 0;
/**
 * @constant
 * @name pc.SPECULAR_BLINN
 * @type {number}
 * @description Energy-conserving Blinn-Phong.
 */
export var SPECULAR_BLINN = 1;

/**
 * @constant
 * @name pc.DETAILMODE_MUL
 * @type {string}
 * @description Multiply together the primary and secondary colors.
 */
export var DETAILMODE_MUL = 'mul';
/**
 * @constant
 * @name pc.DETAILMODE_ADD
 * @type {string}
 * @description Add together the primary and secondary colors.
 */
export var DETAILMODE_ADD = 'add';
/**
 * @constant
 * @name pc.DETAILMODE_SCREEN
 * @type {string}
 * @description Softer version of {@link pc.DETAILMODE_ADD}.
 */
export var DETAILMODE_SCREEN = 'screen';
/**
 * @constant
 * @name pc.DETAILMODE_OVERLAY
 * @type {string}
 * @description Multiplies or screens the colors, depending on the primary color.
 */
export var DETAILMODE_OVERLAY = 'overlay';
/**
 * @constant
 * @name pc.DETAILMODE_MIN
 * @type {string}
 * @description Select whichever of the primary and secondary colors is darker, component-wise.
 */
export var DETAILMODE_MIN = 'min';
/**
 * @constant
 * @name pc.DETAILMODE_MAX
 * @type {string}
 * @description Select whichever of the primary and secondary colors is lighter, component-wise.
 */
export var DETAILMODE_MAX = 'max';

/**
 * @constant
 * @name pc.GAMMA_NONE
 * @type {number}
 * @description No gamma correction.
 */
export var GAMMA_NONE = 0;
/**
 * @constant
 * @name pc.GAMMA_SRGB
 * @type {number}
 * @description Apply sRGB gamma correction.
 */
export var GAMMA_SRGB = 1;
/**
 * @deprecated
 * @constant
 * @name pc.GAMMA_SRGBFAST
 * @type {number}
 * @description Apply sRGB (fast) gamma correction.
 */
export var GAMMA_SRGBFAST = 2; // deprecated
/**
 * @constant
 * @name pc.GAMMA_SRGBHDR
 * @type {number}
 * @description Apply sRGB (HDR) gamma correction.
 */
export var GAMMA_SRGBHDR = 3;

/**
 * @constant
 * @name pc.TONEMAP_LINEAR
 * @type {number}
 * @description Linear tonemapping.
 */
export var TONEMAP_LINEAR = 0;
/**
 * @constant
 * @name pc.TONEMAP_FILMIC
 * @type {number}
 * @description Filmic tonemapping curve.
 */
export var TONEMAP_FILMIC = 1;
/**
 * @constant
 * @name pc.TONEMAP_HEJL
 * @type {number}
 * @description Hejl filmic tonemapping curve.
 */
export var TONEMAP_HEJL = 2;
/**
 * @constant
 * @name pc.TONEMAP_ACES
 * @type {number}
 * @description ACES filmic tonemapping curve.
 */
export var TONEMAP_ACES = 3;
/**
 * @constant
 * @name pc.TONEMAP_ACES2
 * @type {number}
 * @description ACES v2 filmic tonemapping curve.
 */
export var TONEMAP_ACES2 = 4;

/**
 * @constant
 * @name pc.SPECOCC_NONE
 * @type {number}
 * @description No specular occlusion.
 */
export var SPECOCC_NONE = 0;
/**
 * @constant
 * @name pc.SPECOCC_AO
 * @type {number}
 * @description Use AO directly to occlude specular.
 */
export var SPECOCC_AO = 1;
/**
 * @constant
 * @name pc.SPECOCC_GLOSSDEPENDENT
 * @type {number}
 * @description Modify AO based on material glossiness/view angle to occlude specular.
 */
export var SPECOCC_GLOSSDEPENDENT = 2;

// 16 bits for shader defs
export var SHADERDEF_NOSHADOW = 1;
export var SHADERDEF_SKIN = 2;
export var SHADERDEF_UV0 = 4;
export var SHADERDEF_UV1 = 8;
export var SHADERDEF_VCOLOR = 16;
export var SHADERDEF_INSTANCING = 32;
export var SHADERDEF_LM = 64;
export var SHADERDEF_DIRLM = 128;
export var SHADERDEF_SCREENSPACE = 256;
export var SHADERDEF_TANGENTS = 512;
export var SHADERDEF_MORPH_POSITION = 1024;
export var SHADERDEF_MORPH_NORMAL = 2048;
export var SHADERDEF_MORPH_TEXTURE_BASED = 4096;

export var LINEBATCH_WORLD = 0;
export var LINEBATCH_OVERLAY = 1;
export var LINEBATCH_GIZMO = 2;

/**
 * @constant
 * @name pc.SHADOWUPDATE_NONE
 * @type {number}
 * @description The shadow map is not to be updated.
 */
export var SHADOWUPDATE_NONE = 0;
/**
 * @constant
 * @name pc.SHADOWUPDATE_THISFRAME
 * @type {number}
 * @description The shadow map is regenerated this frame and not on subsequent frames.
 */
export var SHADOWUPDATE_THISFRAME = 1;
/**
 * @constant
 * @name pc.SHADOWUPDATE_REALTIME
 * @type {number}
 * @description The shadow map is regenerated every frame.
 */
export var SHADOWUPDATE_REALTIME = 2;

export var SORTKEY_FORWARD = 0;
export var SORTKEY_DEPTH = 1;

export var MASK_DYNAMIC = 1;
export var MASK_BAKED = 2;
export var MASK_LIGHTMAP = 4;

/**
 * @constant
 * @name pc.SHADER_FORWARD
 * @type {number}
 * @description Render shaded materials with gamma correction and tonemapping.
 */
export var SHADER_FORWARD = 0;

/**
 * @constant
 * @name pc.SHADER_FORWARDHDR
 * @type {number}
 * @description Render shaded materials without gamma correction and tonemapping.
 */
export var SHADER_FORWARDHDR = 1;

/**
 * @constant
 * @name pc.SHADER_DEPTH
 * @type {number}
 * @description Render RGBA-encoded depth value.
 */
export var SHADER_DEPTH = 2;

// next are undocumented
export var SHADER_SHADOW = 3; // PCF3
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
export var SHADER_PICK = 18;

/**
 * @constant
 * @type {number}
 * @name pc.SPRITE_RENDERMODE_SIMPLE
 * @description This mode renders a sprite as a simple quad.
 */
export var SPRITE_RENDERMODE_SIMPLE = 0;

/**
 * @constant
 * @type {number}
 * @name pc.SPRITE_RENDERMODE_SLICED
 * @description This mode renders a sprite using 9-slicing in 'sliced' mode. Sliced mode stretches the
 * top and bottom regions of the sprite horizontally, the left and right regions vertically and the middle region
 * both horizontally and vertically.
 */
export var SPRITE_RENDERMODE_SLICED = 1;

/**
 * @constant
 * @type {number}
 * @name pc.SPRITE_RENDERMODE_TILED
 * @description This mode renders a sprite using 9-slicing in 'tiled' mode. Tiled mode tiles the
 * top and bottom regions of the sprite horizontally, the left and right regions vertically and the middle region
 * both horizontally and vertically.
 */
export var SPRITE_RENDERMODE_TILED = 2;

/**
 * @constant
 * @name pc.BAKE_COLOR
 * @type {number}
 * @description Single color lightmap.
 */
export var BAKE_COLOR = 0;
/**
 * @constant
 * @name pc.BAKE_COLORDIR
 * @type {number}
 * @description Single color lightmap + dominant light direction (used for bump/specular).
 */
export var BAKE_COLORDIR = 1;

/**
 * @constant
 * @name pc.VIEW_CENTER
 * @type {number}
 * @description Center of view.
 */
export var VIEW_CENTER = 0;
/**
 * @constant
 * @name pc.VIEW_LEFT
 * @type {number}
 * @description Left of view. Only used in stereo rendering.
 */
export var VIEW_LEFT = 1;
/**
 * @constant
 * @name pc.VIEW_RIGHT
 * @type {number}
 * @description Right of view. Only used in stereo rendering.
 */
export var VIEW_RIGHT = 2;

/**
 * @constant
 * @name pc.SORTMODE_NONE
 * @type {number}
 * @description No sorting is applied. Mesh instances are rendered in the same order they were added to a layer.
 */
export var SORTMODE_NONE = 0;

/**
 * @constant
 * @name pc.SORTMODE_MANUAL
 * @type {number}
 * @description Mesh instances are sorted based on {@link pc.MeshInstance#drawOrder}.
 */
export var SORTMODE_MANUAL = 1;

/**
 * @constant
 * @name pc.SORTMODE_MATERIALMESH
 * @type {number}
 * @description Mesh instances are sorted to minimize switching between materials and meshes to improve rendering performance.
 */
export var SORTMODE_MATERIALMESH = 2;

/**
 * @constant
 * @name pc.SORTMODE_BACK2FRONT
 * @type {number}
 * @description Mesh instances are sorted back to front. This is the way to properly render many semi-transparent objects on different depth, one is blended on top of another.
 */
export var SORTMODE_BACK2FRONT = 3;

/**
 * @constant
 * @name pc.SORTMODE_FRONT2BACK
 * @type {number}
 * @description Mesh instances are sorted front to back. Depending on GPU and the scene, this option may give better performance than pc.SORTMODE_MATERIALMESH due to reduced overdraw.
 */
export var SORTMODE_FRONT2BACK = 4;

/**
 * @private
 * @constant
 * @name  pc.SORTMODE_CUSTOM
 * @type {number}
 * @description Provide custom functions for sorting drawcalls and calculating distance.
 */
export var SORTMODE_CUSTOM = 5;

export var COMPUPDATED_INSTANCES = 1;
export var COMPUPDATED_LIGHTS = 2;
export var COMPUPDATED_CAMERAS = 4;
export var COMPUPDATED_BLEND = 8;

/**
 * @constant
 * @name pc.ASPECT_AUTO
 * @type {number}
 * @description Automatically set aspect ratio to current render target's width divided by height.
 */
export var ASPECT_AUTO = 0;
/**
 * @constant
 * @name pc.ASPECT_MANUAL
 * @type {number}
 * @description Use the manual aspect ratio value.
 */
export var ASPECT_MANUAL = 1;

/**
 * @constant
 * @name pc.ORIENTATION_HORIZONTAL
 * @type {number}
 * @description Horizontal orientation.
 */
export var ORIENTATION_HORIZONTAL = 0;
/**
 * @constant
 * @name pc.ORIENTATION_VERTICAL
 * @type {number}
 * @description Vertical orientation.
 */
export var ORIENTATION_VERTICAL = 1;
