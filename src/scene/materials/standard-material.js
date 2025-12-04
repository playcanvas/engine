import { Debug } from '../../core/debug.js';
import { Color } from '../../core/math/color.js';
import { math } from '../../core/math/math.js';
import { Vec2 } from '../../core/math/vec2.js';
import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import {
    CUBEPROJ_BOX, CUBEPROJ_NONE,
    DETAILMODE_MUL,
    DITHER_NONE,
    FRESNEL_SCHLICK,
    SHADER_PICK,
    SHADER_PREPASS,
    SPECOCC_AO,
    tonemapNames
} from '../constants.js';
import { ShaderPass } from '../shader-pass.js';
import { EnvLighting } from '../graphics/env-lighting.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';
import { _matTex2D, standard } from '../shader-lib/programs/standard.js';
import { Material } from './material.js';
import { StandardMaterialOptionsBuilder } from './standard-material-options-builder.js';
import { standardMaterialCubemapParameters, standardMaterialTextureParameters } from './standard-material-parameters.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { ShaderUtils } from '../shader-lib/shader-utils.js';

/**
 * @import { BoundingBox } from '../../core/shape/bounding-box.js'
 * @import { StandardMaterialOptions } from './standard-material-options.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 */

// properties that get created on a standard material
const _props = {};

// special uniform functions on a standard material
const _uniforms = {};

// temporary set of params
let _params = new Set();

const _tempColor = new Color();

/**
 * @callback UpdateShaderCallback
 * Callback used by {@link StandardMaterial#onUpdateShader}.
 * @param {StandardMaterialOptions} options - An object with shader generator settings (based on current
 * material and scene properties), that you can change and then return. Properties of the object passed
 * into this function are documented in {@link StandardMaterial}. Also contains a member named litOptions
 * which holds some of the options only used by the lit shader backend {@link LitShaderOptions}.
 * @returns {StandardMaterialOptions} Returned settings will be used by the shader.
 */

/**
 * A standard material is the main, general purpose material that is most often used for rendering.
 * It can approximate a wide variety of surface types and can simulate dynamic reflected light.
 * Most maps can use 3 types of input values in any combination: constant ({@link Color} or number),
 * mesh vertex colors and a {@link Texture}. All enabled inputs are multiplied together.
 *
 * @property {Color} ambient The ambient color of the material. This color value is 3-component
 * (RGB), where each component is between 0 and 1.
 * @property {Color} diffuse The diffuse color of the material. This color value is 3-component
 * (RGB), where each component is between 0 and 1. Defines basic surface color (aka albedo).
 * @property {Texture|null} diffuseMap The main (primary) diffuse map of the material (default is
 * null).
 * @property {number} diffuseMapUv Main (primary) diffuse map UV channel.
 * @property {Vec2} diffuseMapTiling Controls the 2D tiling of the main (primary) diffuse map.
 * @property {Vec2} diffuseMapOffset Controls the 2D offset of the main (primary) diffuse map. Each
 * component is between 0 and 1.
 * @property {number} diffuseMapRotation Controls the 2D rotation (in degrees) of the main
 * (primary) diffuse map.
 * @property {string} diffuseMapChannel Color channels of the main (primary) diffuse map to use.
 * Can be "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} diffuseVertexColor Multiply diffuse by the mesh vertex colors.
 * @property {string} diffuseVertexColorChannel Vertex color channels to use for diffuse. Can be
 * "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {Texture|null} diffuseDetailMap The detail (secondary) diffuse map of the material
 * (default is null). Will only be used if main (primary) diffuse map is non-null.
 * @property {number} diffuseDetailMapUv Detail (secondary) diffuse map UV channel.
 * @property {Vec2} diffuseDetailMapTiling Controls the 2D tiling of the detail (secondary) diffuse
 * map.
 * @property {Vec2} diffuseDetailMapOffset Controls the 2D offset of the detail (secondary) diffuse
 * map. Each component is between 0 and 1.
 * @property {number} diffuseDetailMapRotation Controls the 2D rotation (in degrees) of the main
 * (secondary) diffuse map.
 * @property {string} diffuseDetailMapChannel Color channels of the detail (secondary) diffuse map
 * to use. Can be "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {string} diffuseDetailMode Determines how the main (primary) and detail (secondary)
 * diffuse maps are blended together. Can be:
 *
 * - {@link DETAILMODE_MUL}: Multiply together the primary and secondary colors.
 * - {@link DETAILMODE_ADD}: Add together the primary and secondary colors.
 * - {@link DETAILMODE_SCREEN}: Softer version of {@link DETAILMODE_ADD}.
 * - {@link DETAILMODE_OVERLAY}: Multiplies or screens the colors, depending on the primary color.
 * - {@link DETAILMODE_MIN}: Select whichever of the primary and secondary colors is darker,
 * component-wise.
 * - {@link DETAILMODE_MAX}: Select whichever of the primary and secondary colors is lighter,
 * component-wise.
 *
 * Defaults to {@link DETAILMODE_MUL}.
 * @property {Color} specular The specular color of the material. This color value is 3-component
 * (RGB), where each component is between 0 and 1. Defines surface reflection/specular color.
 * Affects specular intensity and tint.
 * @property {boolean} specularTint Multiply specular map and/or specular vertex color by the
 * constant specular value.
 * @property {Texture|null} specularMap The specular map of the material (default is null).
 * @property {number} specularMapUv Specular map UV channel.
 * @property {Vec2} specularMapTiling Controls the 2D tiling of the specular map.
 * @property {Vec2} specularMapOffset Controls the 2D offset of the specular map. Each component is
 * between 0 and 1.
 * @property {number} specularMapRotation Controls the 2D rotation (in degrees) of the specular map.
 * @property {string} specularMapChannel Color channels of the specular map to use. Can be "r", "g",
 * "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} specularVertexColor Use mesh vertex colors for specular. If specularMap or
 * are specularTint are set, they'll be multiplied by vertex colors.
 * @property {string} specularVertexColorChannel Vertex color channels to use for specular. Can be
 * "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} specularityFactorTint Multiply specularity factor map and/or specular vertex color by the
 * constant specular value.
 * @property {number} specularityFactor The factor of specular intensity, used to weight the fresnel and specularity. Default is 1.0.
 * @property {Texture|null} specularityFactorMap The factor of specularity as a texture (default is
 * null).
 * @property {number} specularityFactorMapUv Specularity factor map UV channel.
 * @property {Vec2} specularityFactorMapTiling Controls the 2D tiling of the specularity factor map.
 * @property {Vec2} specularityFactorMapOffset Controls the 2D offset of the specularity factor map. Each component is
 * between 0 and 1.
 * @property {number} specularityFactorMapRotation Controls the 2D rotation (in degrees) of the specularity factor map.
 * @property {string} specularityFactorMapChannel The channel used by the specularity factor texture to sample from (default is 'a').
 * @property {boolean} specularityFactorVertexColor Use mesh vertex colors for specularity factor. If specularityFactorMap or
 * are specularityFactorTint are set, they'll be multiplied by vertex colors.
 * @property {string} specularityFactorVertexColorChannel Vertex color channels to use for specularity factor. Can be
 * "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} enableGGXSpecular Enables GGX specular. Also enables
 * {@link StandardMaterial#anisotropyIntensity} parameter to set material anisotropy.
 * @property {number} anisotropyIntensity Defines amount of anisotropy. Requires
 * {@link StandardMaterial#enableGGXSpecular} is set to true.
 * - When anisotropyIntensity == 0, specular is isotropic.
 * - Specular anisotropy increases as anisotropyIntensity value increases to maximum of 1.
 * @property {number} anisotropyRotation Defines the rotation (in degrees) of anisotropy.
 * @property {Texture|null} anisotropyMap The anisotropy map of the material (default is null).
 * @property {number} anisotropyMapUv Anisotropy map UV channel.
 * @property {Vec2} anisotropyMapTiling Controls the 2D tiling of the anisotropy map.
 * @property {Vec2} anisotropyMapOffset Controls the 2D offset of the anisotropy map. Each
 * component is between 0 and 1.
 * @property {number} anisotropyMapRotation Controls the 2D rotation (in degrees) of the anisotropy map.
 * @property {number} clearCoat Defines intensity of clearcoat layer from 0 to 1. Clearcoat layer
 * is disabled when clearCoat == 0. Default value is 0 (disabled).
 * @property {Texture|null} clearCoatMap Monochrome clearcoat intensity map (default is null). If
 * specified, will be multiplied by normalized 'clearCoat' value and/or vertex colors.
 * @property {number} clearCoatMapUv Clearcoat intensity map UV channel.
 * @property {Vec2} clearCoatMapTiling Controls the 2D tiling of the clearcoat intensity map.
 * @property {Vec2} clearCoatMapOffset Controls the 2D offset of the clearcoat intensity map. Each
 * component is between 0 and 1.
 * @property {number} clearCoatMapRotation Controls the 2D rotation (in degrees) of the clearcoat
 * intensity map.
 * @property {string} clearCoatMapChannel Color channel of the clearcoat intensity map to use. Can
 * be "r", "g", "b" or "a".
 * @property {boolean} clearCoatVertexColor Use mesh vertex colors for clearcoat intensity. If
 * clearCoatMap is set, it'll be multiplied by vertex colors.
 * @property {string} clearCoatVertexColorChannel Vertex color channel to use for clearcoat
 * intensity. Can be "r", "g", "b" or "a".
 * @property {number} clearCoatGloss Defines the clearcoat glossiness of the clearcoat layer
 * from 0 (rough) to 1 (mirror).
 * @property {boolean} clearCoatGlossInvert Invert the clearcoat gloss component (default is false).
 * Enabling this flag results in material treating the clear coat gloss members as roughness.
 * @property {Texture|null} clearCoatGlossMap Monochrome clearcoat glossiness map (default is
 * null). If specified, will be multiplied by normalized 'clearCoatGloss' value and/or vertex
 * colors.
 * @property {number} clearCoatGlossMapUv Clearcoat gloss map UV channel.
 * @property {Vec2} clearCoatGlossMapTiling Controls the 2D tiling of the clearcoat gloss map.
 * @property {Vec2} clearCoatGlossMapOffset Controls the 2D offset of the clearcoat gloss map.
 * Each component is between 0 and 1.
 * @property {number} clearCoatGlossMapRotation Controls the 2D rotation (in degrees) of the clear
 * coat gloss map.
 * @property {string} clearCoatGlossMapChannel Color channel of the clearcoat gloss map to use.
 * Can be "r", "g", "b" or "a".
 * @property {boolean} clearCoatGlossVertexColor Use mesh vertex colors for clearcoat glossiness.
 * If clearCoatGlossMap is set, it'll be multiplied by vertex colors.
 * @property {string} clearCoatGlossVertexColorChannel Vertex color channel to use for clearcoat
 * glossiness. Can be "r", "g", "b" or "a".
 * @property {Texture|null} clearCoatNormalMap The clearcoat normal map of the material (default is
 * null). The texture must contains normalized, tangent space normals.
 * @property {number} clearCoatNormalMapUv Clearcoat normal map UV channel.
 * @property {Vec2} clearCoatNormalMapTiling Controls the 2D tiling of the main clearcoat normal
 * map.
 * @property {Vec2} clearCoatNormalMapOffset Controls the 2D offset of the main clearcoat normal
 * map. Each component is between 0 and 1.
 * @property {number} clearCoatNormalMapRotation Controls the 2D rotation (in degrees) of the main
 * clearcoat map.
 * @property {number} clearCoatBumpiness The bumpiness of the clearcoat layer. This value scales
 * the assigned main clearcoat normal map. It should be normally between 0 (no bump mapping) and 1
 * (full bump mapping), but can be set to e.g. 2 to give even more pronounced bump effect.
 * @property {boolean} useIridescence Enable thin-film iridescence.
 * @property {Texture|null} iridescenceMap The per-pixel iridescence intensity. Only used when
 * useIridescence is enabled.
 * @property {number} iridescenceMapUv Iridescence map UV channel.
 * @property {Vec2} iridescenceMapTiling Controls the 2D tiling of the iridescence map.
 * @property {Vec2} iridescenceMapOffset Controls the 2D offset of the iridescence map. Each component is
 * between 0 and 1.
 * @property {number} iridescenceMapRotation Controls the 2D rotation (in degrees) of the iridescence
 * map.
 * @property {string} iridescenceMapChannel Color channels of the iridescence map to use. Can be "r",
 * "g", "b" or "a".
 * @property {Texture|null} iridescenceThicknessMap The per-pixel iridescence thickness. Defines a
 * gradient weight between iridescenceThicknessMin and iridescenceThicknessMax. Only used when
 * useIridescence is enabled.
 * @property {number} iridescenceThicknessMapUv Iridescence thickness map UV channel.
 * @property {Vec2} iridescenceThicknessMapTiling Controls the 2D tiling of the iridescence
 * thickness map.
 * @property {Vec2} iridescenceThicknessMapOffset Controls the 2D offset of the iridescence
 * thickness map. Each component is between 0 and 1.
 * @property {number} iridescenceThicknessMapRotation Controls the 2D rotation (in degrees)
 * of the iridescence map.
 * @property {string} iridescenceThicknessMapChannel Color channels of the iridescence thickness
 * map to use. Can be "r", "g", "b" or "a".
 * @property {number} iridescenceThicknessMin The minimum thickness for the iridescence layer.
 * Only used when an iridescence thickness map is used. The unit is in nm.
 * @property {number} iridescenceThicknessMax The maximum thickness for the iridescence layer.
 * Used as the 'base' thickness when no iridescence thickness map is defined. The unit is in nm.
 * @property {number} iridescenceRefractionIndex The index of refraction of the iridescent
 * thin-film. Affects the color phase shift as described here:
 * https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_iridescence
 * @property {boolean} useMetalness Use metalness properties instead of specular. When enabled,
 * diffuse colors also affect specular instead of the dedicated specular map. This can be used as
 * alternative to specular color to save space. With metalness == 0, the pixel is assumed to be
 * dielectric, and diffuse color is used as normal. With metalness == 1, the pixel is fully
 * metallic, and diffuse color is used as specular color instead.
 * @property {boolean} useMetalnessSpecularColor When metalness is enabled, use the
 * specular map to apply color tint to specular reflections.
 * at direct angles.
 * @property {number} metalness Defines how much the surface is metallic. From 0 (dielectric) to 1
 * (metal).
 * @property {Texture|null} metalnessMap Monochrome metalness map (default is null).
 * @property {number} metalnessMapUv Metalness map UV channel.
 * @property {Vec2} metalnessMapTiling Controls the 2D tiling of the metalness map.
 * @property {Vec2} metalnessMapOffset Controls the 2D offset of the metalness map. Each component
 * is between 0 and 1.
 * @property {number} metalnessMapRotation Controls the 2D rotation (in degrees) of the metalness
 * map.
 * @property {string} metalnessMapChannel Color channel of the metalness map to use. Can be "r",
 * "g", "b" or "a".
 * @property {boolean} metalnessVertexColor Use mesh vertex colors for metalness. If metalnessMap
 * is set, it'll be multiplied by vertex colors.
 * @property {string} metalnessVertexColorChannel Vertex color channel to use for metalness. Can be
 * "r", "g", "b" or "a".
 * @property {number} gloss Defines the glossiness of the material from 0 (rough) to 1 (shiny).
 * @property {Texture|null} glossMap Gloss map (default is null). If specified, will be multiplied
 * by normalized gloss value and/or vertex colors.
 * @property {boolean} glossInvert Invert the gloss component (default is false). Enabling this
 * flag results in material treating the gloss members as roughness.
 * @property {number} glossMapUv Gloss map UV channel.
 * @property {string} glossMapChannel Color channel of the gloss map to use. Can be "r", "g", "b"
 * or "a".
 * @property {Vec2} glossMapTiling Controls the 2D tiling of the gloss map.
 * @property {Vec2} glossMapOffset Controls the 2D offset of the gloss map. Each component is
 * between 0 and 1.
 * @property {number} glossMapRotation Controls the 2D rotation (in degrees) of the gloss map.
 * @property {boolean} glossVertexColor Use mesh vertex colors for glossiness. If glossMap is set,
 * it'll be multiplied by vertex colors.
 * @property {string} glossVertexColorChannel Vertex color channel to use for glossiness. Can be
 * "r", "g", "b" or "a".
 * @property {number} refraction Defines the visibility of refraction. Material can refract the
 * same cube map as used for reflections.
 * @property {Texture|null} refractionMap The map of the refraction visibility.
 * @property {number} refractionMapUv Refraction map UV channel.
 * @property {Vec2} refractionMapTiling Controls the 2D tiling of the refraction map.
 * @property {Vec2} refractionMapOffset Controls the 2D offset of the refraction map. Each component
 * is between 0 and 1.
 * @property {number} refractionMapRotation Controls the 2D rotation (in degrees) of the emissive
 * map.
 * @property {string} refractionMapChannel Color channels of the refraction map to use. Can be "r",
 * "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} refractionVertexColor Use mesh vertex colors for refraction. If
 * refraction map is set, it will be be multiplied by vertex colors.
 * @property {boolean} refractionVertexColorChannel Vertex color channel to use for refraction.
 * Can be "r", "g", "b" or "a".
 * @property {number} refractionIndex Defines the index of refraction, i.e. The amount of
 * distortion. The value is calculated as (outerIor / surfaceIor), where inputs are measured
 * indices of refraction, the one around the object and the one of its own surface. In most
 * situations outer medium is air, so outerIor will be approximately 1. Then you only need to do
 * (1.0 / surfaceIor).
 * @property {number} dispersion The strength of the angular separation of colors (chromatic
 * aberration) transmitting through a volume. Defaults to 0, which is equivalent to no dispersion.
 * @property {boolean} useDynamicRefraction Enables higher quality refractions using the grab pass
 * instead of pre-computed cube maps for refractions.
 * @property {number} thickness The thickness of the medium, only used when useDynamicRefraction
 * is enabled. The unit is in base units, and scales with the size of the object.
 * @property {Texture|null} thicknessMap The per-pixel thickness of the medium, only used when
 * useDynamicRefraction is enabled.
 * @property {number} thicknessMapUv Thickness map UV channel.
 * @property {Vec2} thicknessMapTiling Controls the 2D tiling of the thickness map.
 * @property {Vec2} thicknessMapOffset Controls the 2D offset of the thickness map. Each component is
 * between 0 and 1.
 * @property {number} thicknessMapRotation Controls the 2D rotation (in degrees) of the thickness
 * map.
 * @property {string} thicknessMapChannel Color channels of the thickness map to use. Can be "r",
 * "g", "b" or "a".
 * @property {boolean} thicknessVertexColor Use mesh vertex colors for thickness. If
 * thickness map is set, it will be be multiplied by vertex colors.
 * @property {Color} attenuation The attenuation color for refractive materials, only used when
 * useDynamicRefraction is enabled.
 * @property {number} attenuationDistance The distance defining the absorption rate of light
 * within the medium. Only used when useDynamicRefraction is enabled.
 * @property {Color} emissive The emissive color of the material. This color value is 3-component
 * (RGB), where each component is between 0 and 1.
 * @property {Texture|null} emissiveMap The emissive map of the material (default is null). Can be
 * HDR. When the emissive map is applied, the emissive color is multiplied by the texel color in the
 * map. Since the emissive color is black by default, the emissive map won't be visible unless the
 * emissive color is changed.
 * @property {number} emissiveIntensity Emissive color multiplier.
 * @property {number} emissiveMapUv Emissive map UV channel.
 * @property {Vec2} emissiveMapTiling Controls the 2D tiling of the emissive map.
 * @property {Vec2} emissiveMapOffset Controls the 2D offset of the emissive map. Each component is
 * between 0 and 1.
 * @property {number} emissiveMapRotation Controls the 2D rotation (in degrees) of the emissive
 * map.
 * @property {string} emissiveMapChannel Color channels of the emissive map to use. Can be "r",
 * "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} emissiveVertexColor Use mesh vertex colors for emission. If emissiveMap or
 * emissive are set, they'll be multiplied by vertex colors.
 * @property {string} emissiveVertexColorChannel Vertex color channels to use for emission. Can be
 * "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} useSheen Toggle sheen specular effect on/off.
 * @property {Color} sheen The specular color of the sheen (fabric) microfiber structure.
 * This color value is 3-component (RGB), where each component is between 0 and 1.
 * @property {Texture|null} sheenMap The sheen microstructure color map of the material (default is
 * null).
 * @property {number} sheenMapUv Sheen map UV channel.
 * @property {Vec2} sheenMapTiling Controls the 2D tiling of the sheen map.
 * @property {Vec2} sheenMapOffset Controls the 2D offset of the sheen map. Each component is
 * between 0 and 1.
 * @property {number} sheenMapRotation Controls the 2D rotation (in degrees) of the sheen
 * map.
 * @property {string} sheenMapChannel Color channels of the sheen map to use. Can be "r",
 * "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} sheenVertexColor Use mesh vertex colors for sheen. If sheen map or
 * sheen tint are set, they'll be multiplied by vertex colors.
 * @property {number} sheenGloss The glossiness of the sheen (fabric) microfiber structure.
 * This color value is a single value between 0 and 1.
 * @property {boolean} sheenGlossInvert Invert the sheen gloss component (default is false).
 * Enabling this flag results in material treating the sheen gloss members as roughness.
 * @property {Texture|null} sheenGlossMap The sheen glossiness microstructure color map of the
 * material (default is null).
 * @property {number} sheenGlossMapUv Sheen map UV channel.
 * @property {Vec2} sheenGlossMapTiling Controls the 2D tiling of the sheen glossiness map.
 * @property {Vec2} sheenGlossMapOffset Controls the 2D offset of the sheen glossiness map.
 * Each component is between 0 and 1.
 * @property {number} sheenGlossMapRotation Controls the 2D rotation (in degrees) of the sheen
 * glossiness map.
 * @property {string} sheenGlossMapChannel Color channels of the sheen glossiness map to use.
 * Can be "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} sheenGlossVertexColor Use mesh vertex colors for sheen glossiness.
 * If sheen glossiness map or sheen glossiness tint are set, they'll be multiplied by vertex colors.
 * @property {string} sheenGlossVertexColorChannel Vertex color channels to use for sheen glossiness.
 * Can be "r", "g", "b" or "a".
 * @property {number} opacity The opacity of the material. This value can be between 0 and 1, where
 * 0 is fully transparent and 1 is fully opaque. If you want the material to be semi-transparent
 * you also need to set the {@link Material#blendType} to {@link BLEND_NORMAL},
 * {@link BLEND_ADDITIVE} or any other mode. Also note that for most semi-transparent objects you
 * want {@link Material#depthWrite} to be false, otherwise they can fully occlude objects behind
 * them.
 * @property {Texture|null} opacityMap The opacity map of the material (default is null).
 * @property {number} opacityMapUv Opacity map UV channel.
 * @property {string} opacityMapChannel Color channel of the opacity map to use. Can be "r", "g",
 * "b" or "a".
 * @property {Vec2} opacityMapTiling Controls the 2D tiling of the opacity map.
 * @property {Vec2} opacityMapOffset Controls the 2D offset of the opacity map. Each component is
 * between 0 and 1.
 * @property {number} opacityMapRotation Controls the 2D rotation (in degrees) of the opacity map.
 * @property {boolean} opacityVertexColor Use mesh vertex colors for opacity. If opacityMap is set,
 * it'll be multiplied by vertex colors.
 * @property {string} opacityVertexColorChannel Vertex color channels to use for opacity. Can be
 * "r", "g", "b" or "a".
 * @property {boolean} opacityFadesSpecular Used to specify whether specular and reflections are
 * faded out using {@link StandardMaterial#opacity}. Default is true. When set to false use
 * {@link Material#alphaFade} to fade out materials.
 * @property {string} opacityDither Used to specify whether opacity is dithered, which allows
 * transparency without alpha blending. Can be:
 *
 * - {@link DITHER_NONE}: Opacity dithering is disabled.
 * - {@link DITHER_BAYER8}: Opacity is dithered using a Bayer 8 matrix.
 * - {@link DITHER_BLUENOISE}: Opacity is dithered using a blue noise.
 * - {@link DITHER_IGNNOISE}: Opacity is dithered using an interleaved gradient noise.
 *
 * Defaults to {@link DITHER_NONE}.
 * @property {boolean} opacityShadowDither Used to specify whether shadow opacity is dithered, which
 * allows shadow transparency without alpha blending.  Can be:
 *
 * - {@link DITHER_NONE}: Opacity dithering is disabled.
 * - {@link DITHER_BAYER8}: Opacity is dithered using a Bayer 8 matrix.
 * - {@link DITHER_BLUENOISE}: Opacity is dithered using a blue noise.
 * - {@link DITHER_IGNNOISE}: Opacity is dithered using an interleaved gradient noise.
 *
 * Defaults to {@link DITHER_NONE}.
 * @property {number} alphaFade Used to fade out materials when
 * {@link StandardMaterial#opacityFadesSpecular} is set to false.
 * @property {Texture|null} normalMap The main (primary) normal map of the material (default is
 * null). The texture must contains normalized, tangent space normals.
 * @property {number} normalMapUv Main (primary) normal map UV channel.
 * @property {Vec2} normalMapTiling Controls the 2D tiling of the main (primary) normal map.
 * @property {Vec2} normalMapOffset Controls the 2D offset of the main (primary) normal map. Each
 * component is between 0 and 1.
 * @property {number} normalMapRotation Controls the 2D rotation (in degrees) of the main (primary)
 * normal map.
 * @property {number} bumpiness The bumpiness of the material. This value scales the assigned main
 * (primary) normal map. It should be normally between 0 (no bump mapping) and 1 (full bump
 * mapping), but can be set to e.g. 2 to give even more pronounced bump effect.
 * @property {Texture|null} normalDetailMap The detail (secondary) normal map of the material
 * (default is null). Will only be used if main (primary) normal map is non-null.
 * @property {number} normalDetailMapUv Detail (secondary) normal map UV channel.
 * @property {Vec2} normalDetailMapTiling Controls the 2D tiling of the detail (secondary) normal
 * map.
 * @property {Vec2} normalDetailMapOffset Controls the 2D offset of the detail (secondary) normal
 * map. Each component is between 0 and 1.
 * @property {number} normalDetailMapRotation Controls the 2D rotation (in degrees) of the detail
 * (secondary) normal map.
 * @property {number} normalDetailMapBumpiness The bumpiness of the material. This value scales the
 * assigned detail (secondary) normal map. It should be normally between 0 (no bump mapping) and 1
 * (full bump mapping), but can be set to e.g. 2 to give even more pronounced bump effect.
 * @property {Texture|null} heightMap The height map of the material (default is null). Used for a
 * view-dependent parallax effect. The texture must represent the height of the surface where
 * darker pixels are lower and lighter pixels are higher. It is recommended to use it together with
 * a normal map.
 * @property {number} heightMapUv Height map UV channel.
 * @property {string} heightMapChannel Color channel of the height map to use. Can be "r", "g", "b"
 * or "a".
 * @property {Vec2} heightMapTiling Controls the 2D tiling of the height map.
 * @property {Vec2} heightMapOffset Controls the 2D offset of the height map. Each component is
 * between 0 and 1.
 * @property {number} heightMapRotation Controls the 2D rotation (in degrees) of the height map.
 * @property {number} heightMapFactor Height map multiplier. Affects the strength of the parallax
 * effect.
 * @property {Texture|null} envAtlas The prefiltered environment lighting atlas (default is null).
 * This setting overrides cubeMap and sphereMap and will replace the scene lighting environment.
 * @property {Texture|null} cubeMap The cubic environment map of the material (default is null).
 * This setting overrides sphereMap and will replace the scene lighting environment.
 * @property {Texture|null} sphereMap The spherical environment map of the material (default is
 * null). This will replace the scene lighting environment.
 * @property {number} cubeMapProjection The type of projection applied to the cubeMap property:
 * - {@link CUBEPROJ_NONE}: The cube map is treated as if it is infinitely far away.
 * - {@link CUBEPROJ_BOX}: Box-projection based on a world space axis-aligned bounding box.
 * Defaults to {@link CUBEPROJ_NONE}.
 * @property {BoundingBox} cubeMapProjectionBox The world space axis-aligned bounding box
 * defining the box-projection used for the cubeMap property. Only used when cubeMapProjection is
 * set to {@link CUBEPROJ_BOX}.
 * @property {number} reflectivity Environment map intensity.
 * @property {Texture|null} lightMap A custom lightmap of the material (default is null). Lightmaps
 * are textures that contain pre-rendered lighting. Can be HDR.
 * @property {number} lightMapUv Lightmap UV channel
 * @property {string} lightMapChannel Color channels of the lightmap to use. Can be "r", "g", "b",
 * "a", "rgb" or any swizzled combination.
 * @property {Vec2} lightMapTiling Controls the 2D tiling of the lightmap.
 * @property {Vec2} lightMapOffset Controls the 2D offset of the lightmap. Each component is
 * between 0 and 1.
 * @property {number} lightMapRotation Controls the 2D rotation (in degrees) of the lightmap.
 * @property {boolean} lightVertexColor Use baked vertex lighting. If lightMap is set, it'll be
 * multiplied by vertex colors.
 * @property {string} lightVertexColorChannel Vertex color channels to use for baked lighting. Can
 * be "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {number} aoIntensity Ambient occlusion intensity. Defaults to 1.
 * @property {Texture|null} aoMap The main (primary) baked ambient occlusion (AO) map (default is
 * null). Modulates ambient color.
 * @property {number} aoMapUv Main (primary) AO map UV channel
 * @property {string} aoMapChannel Color channel of the main (primary) AO map to use. Can be "r", "g", "b" or "a".
 * @property {Vec2} aoMapTiling Controls the 2D tiling of the main (primary) AO map.
 * @property {Vec2} aoMapOffset Controls the 2D offset of the main (primary) AO map. Each component is between 0
 * and 1.
 * @property {number} aoMapRotation Controls the 2D rotation (in degrees) of the main (primary) AO map.
 * @property {boolean} aoVertexColor Use mesh vertex colors for AO. If aoMap is set, it'll be
 * multiplied by vertex colors.
 * @property {string} aoVertexColorChannel Vertex color channels to use for AO. Can be "r", "g",
 * "b" or "a".
 * @property {Texture|null} aoDetailMap The detail (secondary) baked ambient occlusion (AO) map of
 * the material (default is null). Will only be used if main (primary) ao map is non-null.
 * @property {number} aoDetailMapUv Detail (secondary) AO map UV channel.
 * @property {Vec2} aoDetailMapTiling Controls the 2D tiling of the detail (secondary) AO map.
 * @property {Vec2} aoDetailMapOffset Controls the 2D offset of the detail (secondary) AO map. Each
 * component is between 0 and 1.
 * @property {number} aoDetailMapRotation Controls the 2D rotation (in degrees) of the detail
 * (secondary) AO map.
 * @property {string} aoDetailMapChannel Color channels of the detail (secondary) AO map to use.
 * Can be "r", "g", "b" or "a" (default is "g").
 * @property {string} aoDetailMode Determines how the main (primary) and detail (secondary)
 * AO maps are blended together. Can be:
 *
 * - {@link DETAILMODE_MUL}: Multiply together the primary and secondary colors.
 * - {@link DETAILMODE_ADD}: Add together the primary and secondary colors.
 * - {@link DETAILMODE_SCREEN}: Softer version of {@link DETAILMODE_ADD}.
 * - {@link DETAILMODE_OVERLAY}: Multiplies or screens the colors, depending on the primary color.
 * - {@link DETAILMODE_MIN}: Select whichever of the primary and secondary colors is darker,
 * component-wise.
 * - {@link DETAILMODE_MAX}: Select whichever of the primary and secondary colors is lighter,
 * component-wise.
 *
 * Defaults to {@link DETAILMODE_MUL}.
 * @property {number} occludeSpecular Uses ambient occlusion to darken specular/reflection. It's a
 * hack, because real specular occlusion is view-dependent. However, it can be better than nothing.
 *
 * - {@link SPECOCC_NONE}: No specular occlusion
 * - {@link SPECOCC_AO}: Use AO directly to occlude specular.
 * - {@link SPECOCC_GLOSSDEPENDENT}: Modify AO based on material glossiness/view angle to occlude
 * specular.
 *
 * @property {number} occludeSpecularIntensity Controls visibility of specular occlusion.
 * @property {boolean} occludeDirect Tells if AO should darken directional lighting. Defaults to
 * false.
 * @property {number} fresnelModel Defines the formula used for Fresnel effect.
 * As a side-effect, enabling any Fresnel model changes the way diffuse and reflection components
 * are combined. When Fresnel is off, legacy non energy-conserving combining is used. When it is
 * on, combining behavior is energy-conserving.
 *
 * - {@link FRESNEL_NONE}: No Fresnel.
 * - {@link FRESNEL_SCHLICK}: Schlick's approximation of Fresnel (recommended). Parameterized by
 * specular color.
 *
 * @property {boolean} useFog Apply fogging (as configured in scene settings)
 * @property {boolean} useLighting Apply lighting
 * @property {boolean} useSkybox Apply scene skybox as prefiltered environment map
 * @property {boolean} useTonemap Apply tonemapping (as configured in {@link Scene#rendering} or
 * {@link CameraComponent.rendering}). Defaults to true.
 * @property {boolean} pixelSnap Align vertices to pixel coordinates when rendering. Useful for
 * pixel perfect 2D graphics.
 * @property {boolean} twoSidedLighting Calculate proper normals (and therefore lighting) on
 * backfaces.
 * @property {boolean} shadowCatcher When enabled, the material will output accumulated directional
 * shadow value in linear space as the color.
 * @property {boolean} vertexColorGamma When set to true, the vertex shader converts vertex colors
 * from gamma to linear space to ensure correct interpolation in the fragment shader. This flag is
 * provided for backwards compatibility, allowing users to mark their materials to handle vertex
 * colors in gamma space. Defaults to false, which indicates that vertex colors are stored in
 * linear space.
 *
 * @category Graphics
 */
class StandardMaterial extends Material {
    static TEXTURE_PARAMETERS = standardMaterialTextureParameters;

    static CUBEMAP_PARAMETERS = standardMaterialCubemapParameters;

    userAttributes = new Map();

    /**
     * A custom function that will be called after all shader generator properties are collected
     * and before shader code is generated. This function will receive an object with shader
     * generator settings (based on current material and scene properties), that you can change and
     * then return. Returned value will be used instead. This is mostly useful when rendering the
     * same set of objects, but with different shader variations based on the same material. For
     * example, you may wish to render a depth or normal pass using textures assigned to the
     * material, a reflection pass with simpler shaders and so on. These properties are split into
     * two sections, generic standard material options and lit options. Properties of the standard
     * material options are {@link StandardMaterialOptions} and the options for the lit options are
     * {@link LitShaderOptions}.
     *
     * @type {UpdateShaderCallback|undefined}
     */
    onUpdateShader;

    /**
     * Create a new StandardMaterial instance.
     *
     * @example
     * // Create a new Standard material
     * const material = new pc.StandardMaterial();
     *
     * // Update the material's diffuse and specular properties
     * material.diffuse.set(1, 0, 0);
     * material.specular.set(1, 1, 1);
     *
     * // Notify the material that it has been modified
     * material.update();
     * @example
     * // Create a new Standard material
     * const material = new pc.StandardMaterial();
     *
     * // Assign a texture to the diffuse slot
     * material.diffuseMap = texture;
     *
     * // Use the alpha channel of the texture for alpha testing with a reference value of 0.5
     * material.opacityMap = texture;
     * material.alphaTest = 0.5;
     *
     * // Notify the material that it has been modified
     * material.update();
     */
    constructor() {
        super();

        // storage for texture and cubemap asset references
        this._assetReferences = {};

        this._activeParams = new Set();
        this._activeLightingParams = new Set();

        this.shaderOptBuilder = new StandardMaterialOptionsBuilder();

        this.reset();
    }

    reset() {
        // set default values
        Object.keys(_props).forEach((name) => {
            this[`_${name}`] = _props[name].value();
        });

        this._uniformCache = { };
    }

    /**
     * Copy a `StandardMaterial`.
     *
     * @param {StandardMaterial} source - The material to copy from.
     * @returns {StandardMaterial} The destination material.
     */
    copy(source) {
        super.copy(source);

        // set properties
        Object.keys(_props).forEach((k) => {
            this[k] = source[k];
        });

        // clone user attributes
        this.userAttributes = new Map(source.userAttributes);

        return this;
    }

    /**
     * Sets a vertex shader attribute on a material.
     *
     * @param {string} name - The name of the parameter to set.
     * @param {string} semantic - Semantic to map the vertex data. Must match with the semantic set
     * on vertex stream of the mesh.
     * @example
     * mesh.setVertexStream(pc.SEMANTIC_ATTR15, offset, 3);
     * material.setAttribute('offset', pc.SEMANTIC_ATTR15);
     */
    setAttribute(name, semantic) {
        this.userAttributes.set(semantic, name);
    }

    _setParameter(name, value) {
        _params.add(name);
        this.setParameter(name, value);
    }

    _setParameters(parameters) {
        parameters.forEach((v) => {
            this._setParameter(v.name, v.value);
        });
    }

    _processParameters(paramsName) {
        const prevParams = this[paramsName];
        prevParams.forEach((param) => {
            if (!_params.has(param)) {
                delete this.parameters[param];
            }
        });

        this[paramsName] = _params;
        _params = prevParams;
        _params.clear();
    }

    _updateMap(p) {
        const mname = `${p}Map`;
        const map = this[mname];
        if (map) {
            this._setParameter(`texture_${mname}`, map);

            const tname = `${mname}Transform`;
            const uniform = this.getUniform(tname);
            if (uniform) {
                this._setParameters(uniform);
            }
        }
    }

    // allocate a uniform if it doesn't already exist in the uniform cache
    _allocUniform(name, allocFunc) {
        let uniform = this._uniformCache[name];
        if (!uniform) {
            uniform = allocFunc();
            this._uniformCache[name] = uniform;
        }
        return uniform;
    }

    getUniform(name, device, scene) {
        return _uniforms[name](this, device, scene);
    }

    updateUniforms(device, scene) {
        const getUniform = (name) => {
            return this.getUniform(name, device, scene);
        };

        this._setParameter('material_ambient', getUniform('ambient'));
        this._setParameter('material_diffuse', getUniform('diffuse'));
        this._setParameter('material_aoIntensity', this.aoIntensity);

        if (this.useMetalness) {
            if (!this.metalnessMap || this.metalness < 1) {
                this._setParameter('material_metalness', this.metalness);
            }
            if (!this.specularMap || this.specularTint) {
                this._setParameter('material_specular', getUniform('specular'));
            }
            if (!this.specularityFactorMap || this.specularityFactorTint) {
                this._setParameter('material_specularityFactor', this.specularityFactor);
            }

            this._setParameter('material_sheen', getUniform('sheen'));
            this._setParameter('material_sheenGloss', this.sheenGloss);

            this._setParameter('material_refractionIndex', this.refractionIndex);
        } else {
            if (!this.specularMap || this.specularTint) {
                this._setParameter('material_specular', getUniform('specular'));
            }
        }

        if (this.enableGGXSpecular) {
            this._setParameter('material_anisotropyIntensity', this.anisotropyIntensity);
            this._setParameter('material_anisotropyRotation', [Math.cos(this.anisotropyRotation * math.DEG_TO_RAD), Math.sin(this.anisotropyRotation * math.DEG_TO_RAD)]);
        }

        if (this.clearCoat > 0) {
            this._setParameter('material_clearCoat', this.clearCoat);
            this._setParameter('material_clearCoatGloss', this.clearCoatGloss);
            this._setParameter('material_clearCoatBumpiness', this.clearCoatBumpiness);
        }

        this._setParameter('material_gloss', this.gloss);

        Debug.call(() => {
            if (this.emissiveMap && this.emissive.r === 0 && this.emissive.g === 0 && this.emissive.b === 0) {
                Debug.warnOnce(`Emissive map is set but emissive color is black, making the map invisible. Set emissive color to white to make the map visible. Rendering [${DebugGraphics.toString()}]`, this);
            }
        });

        this._setParameter('material_emissive', getUniform('emissive'));
        this._setParameter('material_emissiveIntensity', this.emissiveIntensity);

        if (this.refraction > 0) {
            this._setParameter('material_refraction', this.refraction);
        }

        if (this.dispersion > 0) {
            this._setParameter('material_dispersion', this.dispersion);
        }

        if (this.useDynamicRefraction) {
            this._setParameter('material_thickness', this.thickness);
            this._setParameter('material_attenuation', getUniform('attenuation'));
            this._setParameter('material_invAttenuationDistance', this.attenuationDistance === 0 ? 0 : 1.0 / this.attenuationDistance);
        }

        if (this.useIridescence) {
            this._setParameter('material_iridescence', this.iridescence);
            this._setParameter('material_iridescenceRefractionIndex', this.iridescenceRefractionIndex);
            this._setParameter('material_iridescenceThicknessMin', this.iridescenceThicknessMin);
            this._setParameter('material_iridescenceThicknessMax', this.iridescenceThicknessMax);
        }

        this._setParameter('material_opacity', this.opacity);

        if (this.opacityFadesSpecular === false) {
            this._setParameter('material_alphaFade', this.alphaFade);
        }

        if (this.occludeSpecular) {
            this._setParameter('material_occludeSpecularIntensity', this.occludeSpecularIntensity);
        }

        if (this.cubeMapProjection === CUBEPROJ_BOX) {
            this._setParameter(getUniform('cubeMapProjectionBox'));
        }

        for (const p in _matTex2D) {
            this._updateMap(p);
        }

        if (this.ambientSH) {
            this._setParameter('ambientSH[0]', this.ambientSH);
        }

        if (this.normalMap) {
            this._setParameter('material_bumpiness', this.bumpiness);
        }

        if (this.normalMap && this.normalDetailMap) {
            this._setParameter('material_normalDetailMapBumpiness', this.normalDetailMapBumpiness);
        }

        if (this.heightMap) {
            this._setParameter('material_heightMapFactor', getUniform('heightMapFactor'));
        }

        // set overridden environment textures
        if (this.envAtlas && this.cubeMap) {
            this._setParameter('texture_envAtlas', this.envAtlas);
            this._setParameter('texture_cubeMap', this.cubeMap);
        } else if (this.envAtlas) {
            this._setParameter('texture_envAtlas', this.envAtlas);
        } else if (this.cubeMap) {
            this._setParameter('texture_cubeMap', this.cubeMap);
        } else if (this.sphereMap) {
            this._setParameter('texture_sphereMap', this.sphereMap);
        }

        this._setParameter('material_reflectivity', this.reflectivity);

        // remove unused params
        this._processParameters('_activeParams');

        super.updateUniforms(device, scene);
    }

    updateEnvUniforms(device, scene) {
        const hasLocalEnvOverride = this.envAtlas || this.cubeMap || this.sphereMap;

        if (!hasLocalEnvOverride && this.useSkybox) {
            if (scene.envAtlas && scene.skybox) {
                this._setParameter('texture_envAtlas', scene.envAtlas);
                this._setParameter('texture_cubeMap', scene.skybox);
            } else if (scene.envAtlas) {
                this._setParameter('texture_envAtlas', scene.envAtlas);
            } else if (scene.skybox) {
                this._setParameter('texture_cubeMap', scene.skybox);
            }
        }

        this._processParameters('_activeLightingParams');
    }

    getShaderVariant(params) {

        const { device, scene, pass, objDefs, sortedLights, cameraShaderParams } = params;

        // update prefiltered lighting data
        this.updateEnvUniforms(device, scene);

        // Minimal options for Depth, Shadow and Prepass passes
        const shaderPassInfo = ShaderPass.get(device).getByIndex(pass);
        const minimalOptions = pass === SHADER_PICK || pass === SHADER_PREPASS || shaderPassInfo.isShadow;
        let options = minimalOptions ? standard.optionsContextMin : standard.optionsContext;
        options.defines = ShaderUtils.getCoreDefines(this, params);

        if (minimalOptions) {
            this.shaderOptBuilder.updateMinRef(options, scene, this, objDefs, pass, sortedLights);
        } else {
            this.shaderOptBuilder.updateRef(options, scene, cameraShaderParams, this, objDefs, pass, sortedLights);
        }

        // standard material can overwrite camera's fog setting
        if (!this.useFog) options.defines.set('FOG', 'NONE');

        // standard material can overwrite camera's tonemapping setting
        options.defines.set('TONEMAP', tonemapNames[options.litOptions.toneMap]);

        // execute user callback to modify the options
        if (this.onUpdateShader) {
            options = this.onUpdateShader(options);
        }

        const processingOptions = new ShaderProcessorOptions(params.viewUniformFormat, params.viewBindGroupFormat, params.vertexFormat);

        const library = getProgramLibrary(device);
        library.register('standard', standard);
        const shader = library.getProgram('standard', options, processingOptions, this.userId);

        this._dirtyShader = false;
        return shader;
    }

    /**
     * Removes this material from the scene and possibly frees up memory from its shaders (if there
     * are no other materials using it).
     */
    destroy() {
        // unbind (texture) asset references
        for (const asset in this._assetReferences) {
            this._assetReferences[asset]._unbind();
        }
        this._assetReferences = null;

        super.destroy();
    }
}

// define a uniform get function
const defineUniform = (name, getUniformFunc) => {
    _uniforms[name] = getUniformFunc;
};

const definePropInternal = (name, constructorFunc, setterFunc, getterFunc) => {
    Object.defineProperty(StandardMaterial.prototype, name, {
        get: getterFunc || function () {
            return this[`_${name}`];
        },
        set: setterFunc
    });

    _props[name] = {
        value: constructorFunc
    };
};

// define a simple value property (float, string etc)
const defineValueProp = (prop) => {
    const internalName = `_${prop.name}`;
    const dirtyShaderFunc = prop.dirtyShaderFunc || (() => true);

    const setterFunc = function (value) {
        const oldValue = this[internalName];
        if (oldValue !== value) {
            this._dirtyShader = this._dirtyShader || dirtyShaderFunc(oldValue, value);
            this[internalName] = value;
        }
    };

    definePropInternal(prop.name, () => prop.defaultValue, setterFunc, prop.getterFunc);
};

// define an aggregate property (color, vec3 etc)
const defineAggProp = (prop) => {
    const internalName = `_${prop.name}`;
    const dirtyShaderFunc = prop.dirtyShaderFunc || (() => true);

    const setterFunc = function (value) {
        const oldValue = this[internalName];
        if (!oldValue.equals(value)) {
            this._dirtyShader = this._dirtyShader || dirtyShaderFunc(oldValue, value);
            this[internalName] = oldValue.copy(value);
        }
    };

    definePropInternal(prop.name, () => prop.defaultValue.clone(), setterFunc, prop.getterFunc);
};

// define either a value or aggregate property
const defineProp = (prop) => {
    return prop.defaultValue && prop.defaultValue.clone ? defineAggProp(prop) : defineValueProp(prop);
};

function _defineTex2D(name, channel = 'rgb', vertexColor = true, uv = 0) {
    // store texture name
    _matTex2D[name] = channel.length || -1;

    defineProp({
        name: `${name}Map`,
        defaultValue: null,
        dirtyShaderFunc: (oldValue, newValue) => {
            return !!oldValue !== !!newValue ||
                oldValue && (oldValue.type !== newValue.type || oldValue.format !== newValue.format);
        }
    });

    defineProp({
        name: `${name}MapTiling`,
        defaultValue: new Vec2(1, 1)
    });

    defineProp({
        name: `${name}MapOffset`,
        defaultValue: new Vec2(0, 0)
    });

    defineProp({
        name: `${name}MapRotation`,
        defaultValue: 0
    });

    defineProp({
        name: `${name}MapUv`,
        defaultValue: uv
    });

    if (channel) {
        defineProp({
            name: `${name}MapChannel`,
            defaultValue: channel
        });

        if (vertexColor) {
            defineProp({
                name: `${name}VertexColor`,
                defaultValue: false
            });

            defineProp({
                name: `${name}VertexColorChannel`,
                defaultValue: channel
            });
        }
    }

    // construct the transform uniform
    const mapTiling = `${name}MapTiling`;
    const mapOffset = `${name}MapOffset`;
    const mapRotation = `${name}MapRotation`;
    const mapTransform = `${name}MapTransform`;
    defineUniform(mapTransform, (material, device, scene) => {
        const tiling = material[mapTiling];
        const offset = material[mapOffset];
        const rotation = material[mapRotation];

        if (tiling.x === 1 && tiling.y === 1 &&
            offset.x === 0 && offset.y === 0 &&
            rotation === 0) {
            return null;
        }

        const uniform = material._allocUniform(mapTransform, () => {
            return [{
                name: `texture_${mapTransform}0`,
                value: new Float32Array(3)
            }, {
                name: `texture_${mapTransform}1`,
                value: new Float32Array(3)
            }];
        });

        const cr = Math.cos(rotation * math.DEG_TO_RAD);
        const sr = Math.sin(rotation * math.DEG_TO_RAD);

        const uniform0 = uniform[0].value;
        uniform0[0] = cr * tiling.x;
        uniform0[1] = -sr * tiling.y;
        uniform0[2] = offset.x;

        const uniform1 = uniform[1].value;
        uniform1[0] = sr * tiling.x;
        uniform1[1] = cr * tiling.y;
        uniform1[2] = 1.0 - tiling.y - offset.y;

        return uniform;
    });
}

function _defineColor(name, defaultValue) {
    defineProp({
        name: name,
        defaultValue: defaultValue,
        getterFunc: function () {
            // HACK: since we can't detect whether a user is going to set a color property
            // after calling this getter (i.e doing material.ambient.r = 0.5) we must assume
            // the worst and flag the shader as dirty.
            // This means currently animating a material color is horribly slow.
            this._dirtyShader = true;
            return this[`_${name}`];
        }
    });

    defineUniform(name, (material, device, scene) => {
        const uniform = material._allocUniform(name, () => new Float32Array(3));
        const color = material[name];

        // uniforms are always in linear space
        _tempColor.linear(color);
        uniform[0] = _tempColor.r;
        uniform[1] = _tempColor.g;
        uniform[2] = _tempColor.b;

        return uniform;
    });
}

function _defineFloat(name, defaultValue, getUniformFunc) {
    defineProp({
        name: name,
        defaultValue: defaultValue,
        dirtyShaderFunc: (oldValue, newValue) => {
            // This is not always optimal and will sometimes trigger redundant shader
            // recompilation. However, no number property on a standard material
            // triggers a shader recompile if the previous and current values both
            // have a fractional part.
            return (oldValue === 0 || oldValue === 1) !== (newValue === 0 || newValue === 1);
        }
    });

    defineUniform(name, getUniformFunc);
}

function _defineObject(name, getUniformFunc) {
    defineProp({
        name: name,
        defaultValue: null,
        dirtyShaderFunc: (oldValue, newValue) => {
            return !!oldValue === !!newValue;
        }
    });

    defineUniform(name, getUniformFunc);
}

function _defineFlag(name, defaultValue) {
    defineProp({
        name: name,
        defaultValue: defaultValue
    });
}

function _defineMaterialProps() {
    _defineColor('ambient', new Color(1, 1, 1));
    _defineColor('diffuse', new Color(1, 1, 1));
    _defineColor('specular', new Color(0, 0, 0));
    _defineColor('emissive', new Color(0, 0, 0));
    _defineColor('sheen', new Color(1, 1, 1));
    _defineColor('attenuation', new Color(1, 1, 1));
    _defineFloat('emissiveIntensity', 1);
    _defineFloat('specularityFactor', 1);
    _defineFloat('sheenGloss', 0.0);
    _defineFloat('gloss', 0.25);
    _defineFloat('aoIntensity', 1);

    _defineFloat('heightMapFactor', 1, (material, device, scene) => {
        return material.heightMapFactor * 0.025;
    });
    _defineFloat('opacity', 1);
    _defineFloat('alphaFade', 1);
    _defineFloat('alphaTest', 0);       // NOTE: overwrites Material.alphaTest
    _defineFloat('bumpiness', 1);
    _defineFloat('normalDetailMapBumpiness', 1);
    _defineFloat('reflectivity', 1);
    _defineFloat('occludeSpecularIntensity', 1);
    _defineFloat('refraction', 0);
    _defineFloat('refractionIndex', 1.0 / 1.5); // approx. (air ior / glass ior)
    _defineFloat('dispersion', 0);
    _defineFloat('thickness', 0);
    _defineFloat('attenuationDistance', 0);
    _defineFloat('metalness', 1);
    _defineFloat('anisotropyIntensity', 0);
    _defineFloat('anisotropyRotation', 0);
    _defineFloat('clearCoat', 0);
    _defineFloat('clearCoatGloss', 1);
    _defineFloat('clearCoatBumpiness', 1);
    _defineFloat('aoUvSet', 0, null); // legacy

    _defineFloat('iridescence', 0);
    _defineFloat('iridescenceRefractionIndex', 1.0 / 1.5);
    _defineFloat('iridescenceThicknessMin', 0);
    _defineFloat('iridescenceThicknessMax', 0);

    _defineObject('ambientSH');

    _defineObject('cubeMapProjectionBox', (material, device, scene) => {
        const uniform = material._allocUniform('cubeMapProjectionBox', () => {
            return [{
                name: 'envBoxMin',
                value: new Float32Array(3)
            }, {
                name: 'envBoxMax',
                value: new Float32Array(3)
            }];
        });

        const bboxMin = material.cubeMapProjectionBox.getMin();
        const minUniform = uniform[0].value;
        minUniform[0] = bboxMin.x;
        minUniform[1] = bboxMin.y;
        minUniform[2] = bboxMin.z;

        const bboxMax = material.cubeMapProjectionBox.getMax();
        const maxUniform = uniform[1].value;
        maxUniform[0] = bboxMax.x;
        maxUniform[1] = bboxMax.y;
        maxUniform[2] = bboxMax.z;

        return uniform;
    });

    _defineFlag('specularTint', false);
    _defineFlag('specularityFactorTint', false);
    _defineFlag('useMetalness', false);
    _defineFlag('useMetalnessSpecularColor', false);
    _defineFlag('useSheen', false);
    _defineFlag('enableGGXSpecular', false);
    _defineFlag('occludeDirect', false);
    _defineFlag('opacityFadesSpecular', true);
    _defineFlag('occludeSpecular', SPECOCC_AO);
    _defineFlag('fresnelModel', FRESNEL_SCHLICK); // NOTE: this has been made to match the default shading model (to fix a bug)
    _defineFlag('useDynamicRefraction', false);
    _defineFlag('cubeMapProjection', CUBEPROJ_NONE);
    _defineFlag('useFog', true);
    _defineFlag('useLighting', true);
    _defineFlag('useTonemap', true);
    _defineFlag('useSkybox', true);
    _defineFlag('forceUv1', false);
    _defineFlag('pixelSnap', false);
    _defineFlag('twoSidedLighting', false);
    _defineFlag('nineSlicedMode', undefined); // NOTE: this used to be SPRITE_RENDERMODE_SLICED but was undefined pre-Rollup
    _defineFlag('msdfTextAttribute', false);
    _defineFlag('useIridescence', false);
    _defineFlag('glossInvert', false);
    _defineFlag('sheenGlossInvert', false);
    _defineFlag('clearCoatGlossInvert', false);
    _defineFlag('opacityDither', DITHER_NONE);
    _defineFlag('opacityShadowDither', DITHER_NONE);
    _defineFlag('shadowCatcher', false);
    _defineFlag('vertexColorGamma', false);

    _defineTex2D('diffuse');
    _defineTex2D('specular');
    _defineTex2D('emissive');
    _defineTex2D('thickness', 'g');
    _defineTex2D('specularityFactor', 'g');
    _defineTex2D('normal', '');
    _defineTex2D('metalness', 'g');
    _defineTex2D('gloss', 'g');
    _defineTex2D('opacity', 'a');
    _defineTex2D('refraction', 'g');
    _defineTex2D('height', 'g', false);
    _defineTex2D('ao', 'g');
    _defineTex2D('light', 'rgb', true, 1);
    _defineTex2D('msdf', '');
    _defineTex2D('diffuseDetail', 'rgb', false);
    _defineTex2D('normalDetail', '');
    _defineTex2D('aoDetail', 'g', false);
    _defineTex2D('clearCoat', 'g');
    _defineTex2D('clearCoatGloss', 'g');
    _defineTex2D('clearCoatNormal', '');
    _defineTex2D('sheen', 'rgb');
    _defineTex2D('sheenGloss', 'g');
    _defineTex2D('iridescence', 'g');
    _defineTex2D('iridescenceThickness', 'g');
    _defineTex2D('anisotropy', '');

    _defineFlag('diffuseDetailMode', DETAILMODE_MUL);
    _defineFlag('aoDetailMode', DETAILMODE_MUL);

    _defineObject('cubeMap');
    _defineObject('sphereMap');
    _defineObject('envAtlas');

    // prefiltered cubemap getter
    const getterFunc = function () {
        return this._prefilteredCubemaps;
    };

    // prefiltered cubemap setter
    const setterFunc = function (value) {
        const cubemaps = this._prefilteredCubemaps;

        value = value || [];

        let changed = false;
        let complete = true;
        for (let i = 0; i < 6; ++i) {
            const v = value[i] || null;
            if (cubemaps[i] !== v) {
                cubemaps[i] = v;
                changed = true;
            }
            complete = complete && (!!cubemaps[i]);
        }

        if (changed) {
            if (complete) {
                this.envAtlas = EnvLighting.generatePrefilteredAtlas(cubemaps, {
                    target: this.envAtlas
                });
            } else {
                if (this.envAtlas) {
                    this.envAtlas.destroy();
                    this.envAtlas = null;
                }
            }
            this._dirtyShader = true;
        }
    };

    const empty = [null, null, null, null, null, null];

    definePropInternal('prefilteredCubemaps', () => empty.slice(), setterFunc, getterFunc);
}

_defineMaterialProps();

export { StandardMaterial };
