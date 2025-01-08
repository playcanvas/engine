import { PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTH16, PIXELFORMAT_R32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F } from '../platform/graphics/constants.js';

/**
 * Subtract the color of the source fragment from the destination fragment and write the result to
 * the frame buffer.
 *
 * @type {number}
 * @category Graphics
 */
export const BLEND_SUBTRACTIVE = 0;

/**
 * Add the color of the source fragment to the destination fragment and write the result to the
 * frame buffer.
 *
 * @type {number}
 * @category Graphics
 */
export const BLEND_ADDITIVE = 1;

/**
 * Enable simple translucency for materials such as glass. This is equivalent to enabling a source
 * blend mode of {@link BLENDMODE_SRC_ALPHA} and a destination blend mode of
 * {@link BLENDMODE_ONE_MINUS_SRC_ALPHA}.
 *
 * @type {number}
 * @category Graphics
 */
export const BLEND_NORMAL = 2;

/**
 * Disable blending.
 *
 * @type {number}
 * @category Graphics
 */
export const BLEND_NONE = 3;

/**
 * Similar to {@link BLEND_NORMAL} expect the source fragment is assumed to have already been
 * multiplied by the source alpha value.
 *
 * @type {number}
 * @category Graphics
 */
export const BLEND_PREMULTIPLIED = 4;

/**
 * Multiply the color of the source fragment by the color of the destination fragment and write the
 * result to the frame buffer.
 *
 * @type {number}
 * @category Graphics
 */
export const BLEND_MULTIPLICATIVE = 5;

/**
 * Same as {@link BLEND_ADDITIVE} except the source RGB is multiplied by the source alpha.
 *
 * @type {number}
 * @category Graphics
 */
export const BLEND_ADDITIVEALPHA = 6;

/**
 * Multiplies colors and doubles the result.
 *
 * @type {number}
 * @category Graphics
 */
export const BLEND_MULTIPLICATIVE2X = 7;

/**
 * Softer version of additive.
 *
 * @type {number}
 * @category Graphics
 */
export const BLEND_SCREEN = 8;

/**
 * Minimum color.
 *
 * @type {number}
 * @category Graphics
 */
export const BLEND_MIN = 9;

/**
 * Maximum color.
 *
 * @type {number}
 * @category Graphics
 */
export const BLEND_MAX = 10;

/**
 * No fog is applied to the scene.
 *
 * @type {string}
 * @category Graphics
 */
export const FOG_NONE = 'none';

/**
 * Fog rises linearly from zero to 1 between a start and end depth.
 *
 * @type {string}
 * @category Graphics
 */
export const FOG_LINEAR = 'linear';

/**
 * Fog rises according to an exponential curve controlled by a density value.
 *
 * @type {string}
 * @category Graphics
 */
export const FOG_EXP = 'exp';

/**
 * Fog rises according to an exponential curve controlled by a density value.
 *
 * @type {string}
 * @category Graphics
 */
export const FOG_EXP2 = 'exp2';

/**
 * No Fresnel.
 *
 * @type {number}
 * @category Graphics
 */
export const FRESNEL_NONE = 0;

/**
 * Schlick's approximation of Fresnel.
 *
 * @type {number}
 * @category Graphics
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
 * The world layer.
 *
 * @type {number}
 * @category Graphics
 */
export const LAYERID_WORLD = 0;

/**
 * The depth layer.
 *
 * @type {number}
 * @category Graphics
 */
export const LAYERID_DEPTH = 1;

/**
 * The skybox layer.
 *
 * @type {number}
 * @category Graphics
 */
export const LAYERID_SKYBOX = 2;

/**
 * The immediate layer.
 *
 * @type {number}
 * @category Graphics
 */
export const LAYERID_IMMEDIATE = 3;

/**
 * The UI layer.
 *
 * @type {number}
 * @category Graphics
 */
export const LAYERID_UI = 4;

/**
 * Directional (global) light source.
 *
 * @type {number}
 * @category Graphics
 */
export const LIGHTTYPE_DIRECTIONAL = 0;

/**
 * Omni-directional (local) light source.
 *
 * @type {number}
 * @category Graphics
 */
export const LIGHTTYPE_OMNI = 1;

/**
 * Point (local) light source.
 *
 * @type {number}
 * @ignore
 * @category Graphics
 */
export const LIGHTTYPE_POINT = LIGHTTYPE_OMNI;

/**
 * Spot (local) light source.
 *
 * @type {number}
 * @category Graphics
 */
export const LIGHTTYPE_SPOT = 2;

// private - the number of light types
export const LIGHTTYPE_COUNT = 3;

/**
 * Infinitesimally small point light source shape.
 *
 * @type {number}
 * @category Graphics
 */
export const LIGHTSHAPE_PUNCTUAL = 0;

/**
 * Rectangle shape of light source.
 *
 * @type {number}
 * @category Graphics
 */
export const LIGHTSHAPE_RECT = 1;

/**
 * Disk shape of light source.
 *
 * @type {number}
 * @category Graphics
 */
export const LIGHTSHAPE_DISK = 2;

/**
 * Sphere shape of light source.
 *
 * @type {number}
 * @category Graphics
 */
export const LIGHTSHAPE_SPHERE = 3;

/**
 * Linear distance falloff model for light attenuation.
 *
 * @type {number}
 * @category Graphics
 */
export const LIGHTFALLOFF_LINEAR = 0;

/**
 * Inverse squared distance falloff model for light attenuation.
 *
 * @type {number}
 * @category Graphics
 */
export const LIGHTFALLOFF_INVERSESQUARED = 1;

/**
 * A shadow sampling technique using 32bit shadow map that averages depth comparisons from a 3x3
 * grid of texels for softened shadow edges.
 *
 * @type {number}
 * @category Graphics
 */
export const SHADOW_PCF3_32F = 0;

/** @deprecated */
export const SHADOW_PCF3 = 0; // alias for SHADOW_PCF3_32F for backwards compatibility

/**
 * A shadow sampling technique using a 16-bit exponential variance shadow map that leverages
 * variance to approximate shadow boundaries, enabling soft shadows. Only supported when
 * {@link GraphicsDevice#textureHalfFloatRenderable} is true. Falls back to {@link SHADOW_PCF3_32F},
 * if not supported.
 *
 * @type {number}
 * @category Graphics
 */
export const SHADOW_VSM_16F = 2;

/** @deprecated */
export const SHADOW_VSM16 = 2; // alias for SHADOW_VSM_16F for backwards compatibility

/**
 * A shadow sampling technique using a 32-bit exponential variance shadow map that leverages
 * variance to approximate shadow boundaries, enabling soft shadows. Only supported when
 * {@link GraphicsDevice#textureFloatRenderable} is true. Falls back to {@link SHADOW_VSM_16F}, if
 * not supported.
 *
 * @type {number}
 * @category Graphics
 */
export const SHADOW_VSM_32F = 3;

/** @deprecated */
export const SHADOW_VSM32 = 3; // alias for SHADOW_VSM_32F for backwards compatibility

/**
 * A shadow sampling technique using 32bit shadow map that averages depth comparisons from a 5x5
 * grid of texels for softened shadow edges.
 *
 * @type {number}
 * @category Graphics
 */
export const SHADOW_PCF5_32F = 4;

/** @deprecated */
export const SHADOW_PCF5 = 4;  // alias for SHADOW_PCF5_32F for backwards compatibility

/**
 * A shadow sampling technique using a 32-bit shadow map that performs a single depth comparison for
 * sharp shadow edges.
 *
 * @type {number}
 * @category Graphics
 */
export const SHADOW_PCF1_32F = 5;

/** @deprecated */
export const SHADOW_PCF1 = 5;  // alias for SHADOW_PCF1_32F for backwards compatibility

/**
 * A shadow sampling technique using a 32-bit shadow map that adjusts filter size based on blocker
 * distance, producing realistic, soft shadow edges that vary with the light's occlusion.
 *
 * @type {number}
 * @category Graphics
 */
export const SHADOW_PCSS_32F = 6;

/**
 * A shadow sampling technique using a 16-bit shadow map that performs a single depth comparison for
 * sharp shadow edges.
 *
 * @type {number}
 * @category Graphics
 */
export const SHADOW_PCF1_16F = 7;

/**
 * A shadow sampling technique using 16-bit shadow map that averages depth comparisons from a 3x3
 * grid of texels for softened shadow edges.
 *
 * @type {number}
 * @category Graphics
 */
export const SHADOW_PCF3_16F = 8;

/**
 * A shadow sampling technique using 16-bit shadow map that averages depth comparisons from a 3x3
 * grid of texels for softened shadow edges.
 *
 * @type {number}
 * @category Graphics
 */
export const SHADOW_PCF5_16F = 9;

/**
 * Information about shadow types.
 *
 * @type {Map<number, { name: string, format: number, pcf?: boolean, vsm?: boolean }>}
 * @ignore
 */
export const shadowTypeInfo = new Map([
    [SHADOW_PCF1_32F,    { name: 'PCF1_32F', format: PIXELFORMAT_DEPTH, pcf: true }],
    [SHADOW_PCF3_32F,    { name: 'PCF3_32F', format: PIXELFORMAT_DEPTH, pcf: true }],
    [SHADOW_PCF5_32F,    { name: 'PCF5_32F', format: PIXELFORMAT_DEPTH, pcf: true }],
    [SHADOW_PCF1_16F,    { name: 'PCF1_16F', format: PIXELFORMAT_DEPTH16, pcf: true }],
    [SHADOW_PCF3_16F,    { name: 'PCF3_16F', format: PIXELFORMAT_DEPTH16, pcf: true }],
    [SHADOW_PCF5_16F,    { name: 'PCF5_16F', format: PIXELFORMAT_DEPTH16, pcf: true }],
    [SHADOW_VSM_16F,     { name: 'VSM_16F', format: PIXELFORMAT_RGBA16F, vsm: true }],
    [SHADOW_VSM_32F,     { name: 'VSM_32F', format: PIXELFORMAT_RGBA32F, vsm: true }],
    [SHADOW_PCSS_32F,    { name: 'PCSS_32F', format: PIXELFORMAT_R32F, pcss: true }]
]);

/**
 * Box filter.
 *
 * @type {number}
 * @category Graphics
 */
export const BLUR_BOX = 0;

/**
 * Gaussian filter. May look smoother than box, but requires more samples.
 *
 * @type {number}
 * @category Graphics
 */
export const BLUR_GAUSSIAN = 1;

/**
 * No sorting, particles are drawn in arbitrary order. Can be simulated on GPU.
 *
 * @type {number}
 * @category Graphics
 */
export const PARTICLESORT_NONE = 0;

/**
 * Sorting based on distance to the camera. CPU only.
 *
 * @type {number}
 * @category Graphics
 */
export const PARTICLESORT_DISTANCE = 1;

/**
 * Newer particles are drawn first. CPU only.
 *
 * @type {number}
 * @category Graphics
 */
export const PARTICLESORT_NEWER_FIRST = 2;

/**
 * Older particles are drawn first. CPU only.
 *
 * @type {number}
 * @category Graphics
 */
export const PARTICLESORT_OLDER_FIRST = 3;

export const PARTICLEMODE_GPU = 0;
export const PARTICLEMODE_CPU = 1;

/**
 * Box shape parameterized by emitterExtents. Initial velocity is directed towards local Z axis.
 *
 * @type {number}
 * @category Graphics
 */
export const EMITTERSHAPE_BOX = 0;

/**
 * Sphere shape parameterized by emitterRadius. Initial velocity is directed outwards from the
 * center.
 *
 * @type {number}
 * @category Graphics
 */
export const EMITTERSHAPE_SPHERE = 1;

/**
 * Particles are facing camera.
 *
 * @type {number}
 * @category Graphics
 */
export const PARTICLEORIENTATION_SCREEN = 0;

/**
 * User defines world space normal (particleNormal) to set planes orientation.
 *
 * @type {number}
 * @category Graphics
 */
export const PARTICLEORIENTATION_WORLD = 1;

/**
 * Similar to previous, but the normal is affected by emitter(entity) transformation.
 *
 * @type {number}
 * @category Graphics
 */
export const PARTICLEORIENTATION_EMITTER = 2;

/**
 * A perspective camera projection where the frustum shape is essentially pyramidal.
 *
 * @type {number}
 * @category Graphics
 */
export const PROJECTION_PERSPECTIVE = 0;

/**
 * An orthographic camera projection where the frustum shape is essentially a cuboid.
 *
 * @type {number}
 * @category Graphics
 */
export const PROJECTION_ORTHOGRAPHIC = 1;

/**
 * Render mesh instance as solid geometry.
 *
 * @type {number}
 * @category Graphics
 */
export const RENDERSTYLE_SOLID = 0;

/**
 * Render mesh instance as wireframe.
 *
 * @type {number}
 * @category Graphics
 */
export const RENDERSTYLE_WIREFRAME = 1;

/**
 * Render mesh instance as points.
 *
 * @type {number}
 * @category Graphics
 */
export const RENDERSTYLE_POINTS = 2;

/**
 * The cube map is treated as if it is infinitely far away.
 *
 * @type {number}
 * @category Graphics
 */
export const CUBEPROJ_NONE = 0;

/**
 * The cube map is box-projected based on a world space axis-aligned bounding box.
 *
 * @type {number}
 * @category Graphics
 */
export const CUBEPROJ_BOX = 1;

/**
 * Multiply together the primary and secondary colors.
 *
 * @type {string}
 * @category Graphics
 */
export const DETAILMODE_MUL = 'mul';

/**
 * Add together the primary and secondary colors.
 *
 * @type {string}
 * @category Graphics
 */
export const DETAILMODE_ADD = 'add';

/**
 * Softer version of {@link DETAILMODE_ADD}.
 *
 * @type {string}
 * @category Graphics
 */
export const DETAILMODE_SCREEN = 'screen';

/**
 * Multiplies or screens the colors, depending on the primary color.
 *
 * @type {string}
 * @category Graphics
 */
export const DETAILMODE_OVERLAY = 'overlay';

/**
 * Select whichever of the primary and secondary colors is darker, component-wise.
 *
 * @type {string}
 * @category Graphics
 */
export const DETAILMODE_MIN = 'min';

/**
 * Select whichever of the primary and secondary colors is lighter, component-wise.
 *
 * @type {string}
 * @category Graphics
 */
export const DETAILMODE_MAX = 'max';

/**
 * No gamma correction.
 *
 * @type {number}
 * @category Graphics
 */
export const GAMMA_NONE = 0;

/**
 * Apply sRGB gamma correction.
 *
 * @type {number}
 * @category Graphics
 */
export const GAMMA_SRGB = 1;

/**
 * Linear tonemapping. The colors are preserved, but the exposure is applied.
 *
 * @type {number}
 * @category Graphics
 */
export const TONEMAP_LINEAR = 0;

/**
 * Filmic tonemapping curve.
 *
 * @type {number}
 * @category Graphics
 */
export const TONEMAP_FILMIC = 1;

/**
 * Hejl filmic tonemapping curve.
 *
 * @type {number}
 * @category Graphics
 */
export const TONEMAP_HEJL = 2;

/**
 * ACES filmic tonemapping curve.
 *
 * @type {number}
 * @category Graphics
 */
export const TONEMAP_ACES = 3;

/**
 * ACES v2 filmic tonemapping curve.
 *
 * @type {number}
 * @category Graphics
 */
export const TONEMAP_ACES2 = 4;

/**
 * Khronos PBR Neutral tonemapping curve.
 *
 * @type {number}
 * @category Graphics
 */
export const TONEMAP_NEUTRAL = 5;

/**
 * No tonemapping or exposure is applied. Used for HDR rendering.
 *
 * @type {number}
 * @category Graphics
 */
export const TONEMAP_NONE = 6;

// names of the tonemaps
export const tonemapNames = [
    'LINEAR',
    'FILMIC',
    'HEJL',
    'ACES',
    'ACES2',
    'NEUTRAL',
    'NONE'
];

/**
 * No specular occlusion.
 *
 * @type {number}
 * @category Graphics
 */
export const SPECOCC_NONE = 0;

/**
 * Use AO directly to occlude specular.
 *
 * @type {number}
 * @category Graphics
 */
export const SPECOCC_AO = 1;

/**
 * Modify AO based on material glossiness/view angle to occlude specular.
 *
 * @type {number}
 * @category Graphics
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
export const SHADERDEF_LMAMBIENT = 4096; // lightmaps contain ambient
export const SHADERDEF_MORPH_TEXTURE_BASED_INT = 8192;
export const SHADERDEF_BATCH = 16384;

/**
 * The shadow map is not to be updated.
 *
 * @type {number}
 * @category Graphics
 */
export const SHADOWUPDATE_NONE = 0;

/**
 * The shadow map is regenerated this frame and not on subsequent frames.
 *
 * @type {number}
 * @category Graphics
 */
export const SHADOWUPDATE_THISFRAME = 1;

/**
 * The shadow map is regenerated every frame.
 *
 * @type {number}
 * @category Graphics
 */
export const SHADOWUPDATE_REALTIME = 2;

export const SORTKEY_FORWARD = 0;
export const SORTKEY_DEPTH = 1;

// flags used on the mask property of the Light, and also on mask property of the MeshInstance
export const MASK_AFFECT_DYNAMIC = 1;
export const MASK_AFFECT_LIGHTMAPPED = 2;
export const MASK_BAKE = 4;

/**
 * Render shaded materials using forward rendering.
 *
 * @type {number}
 * @category Graphics
 */
export const SHADER_FORWARD = 0;

export const SHADER_PREPASS = 1;

/**
 * Render RGBA-encoded depth value.
 *
 * @type {number}
 * @category Graphics
 */
export const SHADER_DEPTH = 2;

// shader pass used by the Picker class to render mesh ID
export const SHADER_PICK = 3;

// shadow pass used by the shadow rendering code
export const SHADER_SHADOW = 4;

/**
 * Shader that performs forward rendering.
 *
 * @type {string}
 * @category Graphics
 */
export const SHADERPASS_FORWARD = 'forward';

/**
 * Shader used for debug rendering of albedo.
 *
 * @type {string}
 * @category Graphics
 */
export const SHADERPASS_ALBEDO = 'debug_albedo';

/**
 * Shader used for debug rendering of world normal.
 *
 * @type {string}
 * @category Graphics
 */
export const SHADERPASS_WORLDNORMAL = 'debug_world_normal';

/**
 * Shader used for debug rendering of opacity.
 *
 * @type {string}
 * @category Graphics
 */
export const SHADERPASS_OPACITY = 'debug_opacity';

/**
 * Shader used for debug rendering of specularity.
 *
 * @type {string}
 * @category Graphics
 */
export const SHADERPASS_SPECULARITY = 'debug_specularity';

/**
 * Shader used for debug rendering of gloss.
 *
 * @type {string}
 * @category Graphics
 */
export const SHADERPASS_GLOSS = 'debug_gloss';

/**
 * Shader used for debug rendering of metalness.
 *
 * @type {string}
 * @category Graphics
 */
export const SHADERPASS_METALNESS = 'debug_metalness';

/**
 * Shader used for debug rendering of ao.
 *
 * @type {string}
 * @category Graphics
 */
export const SHADERPASS_AO = 'debug_ao';

/**
 * Shader used for debug rendering of emission.
 *
 * @type {string}
 * @category Graphics
 */
export const SHADERPASS_EMISSION = 'debug_emission';

/**
 * Shader used for debug rendering of lighting.
 *
 * @type {string}
 * @category Graphics
 */
export const SHADERPASS_LIGHTING = 'debug_lighting';

/**
 * Shader used for debug rendering of UV0 texture coordinates.
 *
 * @type {string}
 * @category Graphics
 */
export const SHADERPASS_UV0 = 'debug_uv0';

/**
 * This mode renders a sprite as a simple quad.
 *
 * @type {number}
 * @category Graphics
 */
export const SPRITE_RENDERMODE_SIMPLE = 0;

/**
 * This mode renders a sprite using 9-slicing in 'sliced' mode. Sliced mode stretches the top and
 * bottom regions of the sprite horizontally, the left and right regions vertically and the middle
 * region both horizontally and vertically.
 *
 * @type {number}
 * @category Graphics
 */
export const SPRITE_RENDERMODE_SLICED = 1;

/**
 * This mode renders a sprite using 9-slicing in 'tiled' mode. Tiled mode tiles the top and bottom
 * regions of the sprite horizontally, the left and right regions vertically and the middle region
 * both horizontally and vertically.
 *
 * @type {number}
 * @category Graphics
 */
export const SPRITE_RENDERMODE_TILED = 2;

/**
 * Single color lightmap.
 *
 * @type {number}
 * @category Graphics
 */
export const BAKE_COLOR = 0;

/**
 * Single color lightmap + dominant light direction (used for bump/specular).
 *
 * @type {number}
 * @category Graphics
 */
export const BAKE_COLORDIR = 1;

/**
 * Center of view.
 *
 * @type {number}
 * @category Graphics
 */
export const VIEW_CENTER = 0;

/**
 * Left of view. Only used in stereo rendering.
 *
 * @type {number}
 * @category Graphics
 */
export const VIEW_LEFT = 1;

/**
 * Right of view. Only used in stereo rendering.
 *
 * @type {number}
 * @category Graphics
 */
export const VIEW_RIGHT = 2;

/**
 * No sorting is applied. Mesh instances are rendered in the same order they were added to a layer.
 *
 * @type {number}
 * @category Graphics
 */
export const SORTMODE_NONE = 0;

/**
 * Mesh instances are sorted based on {@link MeshInstance#drawOrder}.
 *
 * @type {number}
 * @category Graphics
 */
export const SORTMODE_MANUAL = 1;

/**
 * Mesh instances are sorted to minimize switching between materials and meshes to improve
 * rendering performance.
 *
 * @type {number}
 * @category Graphics
 */
export const SORTMODE_MATERIALMESH = 2;

/**
 * Mesh instances are sorted back to front. This is the way to properly render many
 * semi-transparent objects on different depth, one is blended on top of another.
 *
 * @type {number}
 * @category Graphics
 */
export const SORTMODE_BACK2FRONT = 3;

/**
 * Mesh instances are sorted front to back. Depending on GPU and the scene, this option may give
 * better performance than {@link SORTMODE_MATERIALMESH} due to reduced overdraw.
 *
 * @type {number}
 * @category Graphics
 */
export const SORTMODE_FRONT2BACK = 4;

/**
 * Provide custom functions for sorting drawcalls and calculating distance.
 *
 * @type {number}
 * @ignore
 * @category Graphics
 */
export const SORTMODE_CUSTOM = 5;

/**
 * Automatically set aspect ratio to current render target's width divided by height.
 *
 * @type {number}
 * @category Graphics
 */
export const ASPECT_AUTO = 0;

/**
 * Use the manual aspect ratio value.
 *
 * @type {number}
 * @category Graphics
 */
export const ASPECT_MANUAL = 1;

/**
 * Horizontal orientation.
 *
 * @type {number}
 * @category Graphics
 */
export const ORIENTATION_HORIZONTAL = 0;

/**
 * Vertical orientation.
 *
 * @type {number}
 * @category Graphics
 */
export const ORIENTATION_VERTICAL = 1;

/**
 * A sky texture is rendered using an infinite projection.
 *
 * @type {string}
 * @category Graphics
 */
export const SKYTYPE_INFINITE = 'infinite';

/**
 * A sky texture is rendered using a box projection. This is generally suitable for interior
 * environments.
 *
 * @type {string}
 * @category Graphics
 */
export const SKYTYPE_BOX = 'box';

/**
 *  A sky texture is rendered using a dome projection. This is generally suitable for exterior
 * environments.
 *
 * @type {string}
 * @category Graphics
 */
export const SKYTYPE_DOME = 'dome';

/**
 * Opacity dithering is disabled.
 *
 * @type {string}
 * @category Graphics
 */
export const DITHER_NONE = 'none';

/**
 * Opacity is dithered using a Bayer 8 matrix.
 *
 * @type {string}
 * @category Graphics
 */
export const DITHER_BAYER8 = 'bayer8';

/**
 * Opacity is dithered using a blue noise.
 *
 * @type {string}
 * @category Graphics
 */
export const DITHER_BLUENOISE = 'bluenoise';

/**
 * Opacity is dithered using an interleaved gradient noise.
 *
 * @type {string}
 * @category Graphics
 */
export const DITHER_IGNNOISE = 'ignnoise';

/**
 * Name of event fired before the camera renders the scene.
 *
 * @type {string}
 * @ignore
 */
export const EVENT_PRERENDER = 'prerender';

/**
 * Name of event fired after the camera renders the scene.
 *
 * @type {string}
 * @ignore
 */
export const EVENT_POSTRENDER = 'postrender';

/**
 * Name of event fired before a layer is rendered by a camera.
 *
 * @type {string}
 * @ignore
 */
export const EVENT_PRERENDER_LAYER = 'prerender:layer';

/**
 * Name of event fired after a layer is rendered by a camera.
 *
 * @type {string}
 * @ignore
 */
export const EVENT_POSTRENDER_LAYER = 'postrender:layer';

/**
 * Name of event fired before visibility culling is performed for the camera
 *
 * @type {string}
 * @ignore
 */
export const EVENT_PRECULL = 'precull';

/**
 * Name of event after before visibility culling is performed for the camera
 *
 * @type {string}
 * @ignore
 */
export const EVENT_POSTCULL = 'postcull';
