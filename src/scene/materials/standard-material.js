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
    SHADER_DEPTH, SHADER_PICK,
    SHADER_PREPASS_VELOCITY,
    SPECOCC_AO,
    SPECULAR_BLINN, SPECULAR_PHONG
} from '../constants.js';
import { ShaderPass } from '../shader-pass.js';
import { EnvLighting } from '../graphics/env-lighting.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';
import { _matTex2D, standard } from '../shader-lib/programs/standard.js';
import { Material } from './material.js';
import { StandardMaterialOptionsBuilder } from './standard-material-options-builder.js';
import { standardMaterialCubemapParameters, standardMaterialTextureParameters } from './standard-material-parameters.js';

// properties that get created on a standard material
const _props = {};

// special uniform functions on a standard material
const _uniforms = {};

// temporary set of params
let _params = new Set();

/**
 * Callback used by {@link StandardMaterial#onUpdateShader}.
 *
 * @callback UpdateShaderCallback
 * @param {import('./standard-material-options.js').StandardMaterialOptions} options - An object
 * with shader generator settings (based on current material and scene properties), that you can
 * change and then return. Properties of the object passed into this function are documented in
 * {@link StandardMaterial}. Also contains a member named litOptions which holds some of the options
 * only used by the lit shader backend {@link LitShaderOptions}.
 * @returns {import('./standard-material-options.js').StandardMaterialOptions} Returned settings
 * will be used by the shader.
 */

/**
 * A Standard material is the main, general purpose material that is most often used for rendering.
 * It can approximate a wide variety of surface types and can simulate dynamic reflected light.
 * Most maps can use 3 types of input values in any combination: constant (color or number), mesh
 * vertex colors and a texture. All enabled inputs are multiplied together.
 *
 * @category Graphics
 */
class StandardMaterial extends Material {
    static TEXTURE_PARAMETERS = standardMaterialTextureParameters;

    static CUBEMAP_PARAMETERS = standardMaterialCubemapParameters;

    userAttributes = new Map();

    /**
     * Used to fade out materials when {@link StandardMaterial#opacityFadesSpecular} is set to false.
     *
     * @type {boolean}
     */
    alphaFade;


    /**
     * The ambient color of the material. This color value is 3-component (RGB), where each
     * component is between 0 and 1.
     *
     * @type {Color}
     */
    ambient;


    /**
     * Enables scene ambient multiplication by material ambient color.
     *
     * @type {boolean}
     */
    ambientTint;


    /**
     * Defines amount of anisotropy. Requires {@link StandardMaterial#enableGGXSpecular} is set to
     * true.
     *
     * - When anisotropy == 0, specular is isotropic.
     * - When anisotropy < 0, anisotropy direction aligns with the tangent, and specular anisotropy
     * increases as the anisotropy value decreases to minimum of -1. - When anisotropy > 0,
     * anisotropy direction aligns with the bi-normal, and specular anisotropy increases as
     * anisotropy value increases to maximum of 1.
     *
     * @type {number}
     */
    anisotropy;


    /**
     * The main (primary) baked ambient occlusion (AO) map (default is null). Modulates ambient
     * color.
     *
     * @type {import('../../platform/graphics/texture.js').Texture | null}
     */
    aoMap;


    /**
     * Color channel of the main (primary) AO map to use. Can be "r", "g", "b" or "a".
     *
     * @type {string}
     */
    aoMapChannel;


    /**
     * Controls the 2D offset of the main (primary) AO map. Each component is between 0 and 1.
     *
     * @type {Vec2}
     */
    aoMapOffset;


    /**
     * Controls the 2D rotation (in degrees) of the main (primary) AO map.
     *
     * @type {number}
     */
    aoMapRotation;


    /**
     * Controls the 2D tiling of the main (primary) AO map.
     *
     * @type {Vec2}
     */
    aoMapTiling;


    /**
     * Main (primary) AO map UV channel
     *
     * @type {number}
     */
    aoMapUv;


    /**
     * The detail (secondary) baked ambient occlusion (AO) map of the material (default is null).
     * Will only be used if main (primary) ao map is non-null.
     *
     * @type {import('../../platform/graphics/texture.js').Texture | null}
     */
    aoDetailMap;


    /**
     * Color channels of the detail (secondary) AO map to use. Can be "r", "g", "b" or "a"
     * (default is "g").
     *
     * @type {string}
     */
    aoDetailMapChannel;


    /**
     * Controls the 2D offset of the detail (secondary) AO map. Each component is between 0 and 1.
     *
     * @type {Vec2}
     */
    aoDetailMapOffset;


    /**
     * Controls the 2D rotation (in degrees) of the detail (secondary) AO map.
     *
     * @type {number}
     */
    aoDetailMapRotation;


    /**
     * Controls the 2D tiling of the detail (secondary) AO map.
     *
     * @type {Vec2}
     */
    aoDetailMapTiling;


    /**
     * Detail (secondary) AO map UV channel.
     *
     * @type {number}
     */
    aoDetailMapUv;


    /**
     * Determines how the main (primary) and detail (secondary) AO maps are blended together.
     * Can be:
     *
     * - {@link DETAILMODE_MUL}: Multiply together the primary and secondary colors.
     * - {@link DETAILMODE_ADD}: Add together the primary and secondary colors.
     * - {@link DETAILMODE_SCREEN}: Softer version of {@link DETAILMODE_ADD}.
     * - {@link DETAILMODE_OVERLAY}: Multiplies or screens the colors, depending on the primary
     * color.
     * - {@link DETAILMODE_MIN}: Select whichever of the primary and secondary colors is darker,
     * component-wise.
     * - {@link DETAILMODE_MAX}: Select whichever of the primary and secondary colors is lighter,
     * component-wise.
     *
     * Defaults to {@link DETAILMODE_MUL}.
     *
     * @type {string}
     */
    aoDetailMode;


    /**
     * Use mesh vertex colors for AO. If aoMap is set, it'll be multiplied by vertex colors.
     *
     * @type {boolean}
     */
    aoVertexColor;


    /**
     * Vertex color channels to use for AO. Can be "r", "g", "b" or "a".
     *
     * @type {string}
     */
    aoVertexColorChannel;


    /**
     * The bumpiness of the material. This value scales the assigned main (primary) normal map. It
     * should be normally between 0 (no bump mapping) and 1 (full bump mapping), but can be set to
     * e.g. 2 to give even more pronounced bump effect.
     *
     * @type {number}
     */
    bumpiness;


    /**
     * Defines intensity of clearcoat layer from 0 to 1. Clearcoat layer is disabled when
     * clearCoat == 0. Default value is 0 (disabled).
     *
     * @type {number}
     */
    clearCoat;


    /**
     * The bumpiness of the clearcoat layer. This value scales the assigned main clearcoat normal
     * map. It should be normally between 0 (no bump mapping) and 1 (full bump mapping), but can be
     * set to e.g. 2 to give even more pronounced bump effect.
     *
     * @type {number}
     */
    clearCoatBumpiness;


    /**
     * Invert the clearcoat gloss component (default is false). Enabling this flag results in
     * material treating the clear coat gloss members as roughness.
     *
     * @type {boolean}
     */
    clearCoatGlossInvert;


    /**
     * Monochrome clearcoat glossiness map (default is null). If specified, will be multiplied by
     * normalized 'clearCoatGloss' value and/or vertex colors.
     *
     * @type {import('../../platform/graphics/texture.js').Texture | null}
     */
    clearCoatGlossMap;


    /**
     * Color channel of the clearcoat gloss map to use. Can be "r", "g", "b" or "a".
     *
     * @type {string}
     */
    clearCoatGlossMapChannel;


    /**
     * Controls the 2D offset of the clearcoat gloss map. Each component is between 0 and 1.
     *
     * @type {Vec2}
     */
    clearCoatGlossMapOffset;


    /**
     * Controls the 2D rotation (in degrees) of the clear coat gloss map.
     *
     * @type {number}
     */
    clearCoatGlossMapRotation;


    /**
     * Controls the 2D tiling of the clearcoat gloss map.
     *
     * @type {Vec2}
     */
    clearCoatGlossMapTiling;


    /**
     * Clearcoat gloss map UV channel.
     *
     * @type {number}
     */
    clearCoatGlossMapUv;


    /**
     * Use mesh vertex colors for clearcoat glossiness. If clearCoatGlossMap is set, it'll be
     * multiplied by vertex colors.
     *
     * @type {boolean}
     */
    clearCoatGlossVertexColor;


    /**
     * Vertex color channel to use for clearcoat glossiness. Can be "r", "g", "b" or "a".
     *
     * @type {string}
     */
    clearCoatGlossVertexColorChannel;


    /**
     * Defines the clearcoat glossiness of the clearcoat layer from 0 (rough) to 1 (mirror).
     *
     * @type {number}
     */
    clearCoatGloss;


    /**
     * Monochrome clearcoat intensity map (default is null). If specified, will be multiplied by
     * normalized 'clearCoat' value and/or vertex colors.
     *
     * @type {import('../../platform/graphics/texture.js').Texture | null}
     */
    clearCoatMap;


    /**
     * Color channel of the clearcoat intensity map to use. Can be "r", "g", "b" or "a".
     *
     * @type {string}
     */
    clearCoatMapChannel;


    /**
     * Controls the 2D offset of the clearcoat intensity map. Each component is between 0 and 1.
     *
     * @type {Vec2}
     */
    clearCoatMapOffset;


    /**
     * Controls the 2D rotation (in degrees) of the clearcoat intensity map.
     *
     * @type {number}
     */
    clearCoatMapRotation;


    /**
     * Controls the 2D tiling of the clearcoat intensity map.
     *
     * @type {Vec2}
     */
    clearCoatMapTiling;


    /**
     * Clearcoat intensity map UV channel.
     *
     * @type {number}
     */
    clearCoatMapUv;


    /**
     * The clearcoat normal map of the material (default is null). The texture must contains
     * normalized, tangent space normals.
     *
     * @type {import('../../platform/graphics/texture.js').Texture | null}
     */
    clearCoatNormalMap;


    /**
     * Controls the 2D offset of the main clearcoat normal map. Each component is between 0 and 1.
     *
     * @type {Vec2}
     */
    clearCoatNormalMapOffset;


    /**
     * Controls the 2D rotation (in degrees) of the main clearcoat map.
     *
     * @type {number}
     */
    clearCoatNormalMapRotation;


    /**
     * Controls the 2D tiling of the main clearcoat normal map.
     *
     * @type {Vec2}
     */
    clearCoatNormalMapTiling;


    /**
     * Clearcoat normal map UV channel.
     *
     * @type {number}
     */
    clearCoatNormalMapUv;


    /**
     * Use mesh vertex colors for clearcoat intensity. If clearCoatMap is set, it'll be multiplied
     * by vertex colors.
     *
     * @type {boolean}
     */
    clearCoatVertexColor;


    /**
     * Vertex color channel to use for clearcoat intensity. Can be "r", "g", "b" or "a".
     *
     * @type {string}
     */
    clearCoatVertexColorChannel;


    /**
     * Defines how diffuse and specular components are combined when Fresnel is on. It is recommended
     * that you leave this option enabled, although you may want to disable it in case when all
     * reflection comes only from a few light sources, and you don't use an environment map,
     * therefore having mostly black reflection.
     *
     * @type {boolean}
     */
    conserveEnergy;


    /**
     * The cubic environment map of the material (default is null). This setting overrides sphereMap
     * and will replace the scene lighting environment.
     *
     * @type {import('../../platform/graphics/texture.js').Texture | null}
     */
    cubeMap;


    /**
     * The type of projection applied to the cubeMap property:
     *
     * - {@link CUBEPROJ_NONE}: The cube map is treated as if it is infinitely far away.
     * - {@link CUBEPROJ_BOX}: Box-projection based on a world space axis-aligned bounding box.
     *
     * Defaults to {@link CUBEPROJ_NONE}.
     *
     * @type {number}
     */
    cubeMapProjection;


    /**
     * The world space axis-aligned bounding box defining the box-projection used for the cubeMap
     * property. Only used when cubeMapProjection is set to {@link CUBEPROJ_BOX}.
     *
     * @type {BoundingBox}
     */
    cubeMapProjectionBox;


    /**
     * The diffuse color of the material. This color value is 3-component (RGB), where each
     * component is between 0 and 1. Defines basic surface color (aka albedo).
     *
     * @type {Color}
     */
    diffuse;


    /**
     * The detail (secondary) diffuse map of the material (default is null). Will only be used if
     * main (primary) diffuse map is non-null.
     *
     * @type {import('../../platform/graphics/texture.js').Texture | null}
     */
    diffuseDetailMap;


    /**
     * Color channels of the detail (secondary) diffuse map to use. Can be "r", "g", "b", "a", "rgb"
     * or any swizzled combination.
     *
     * @type {string}
     */
    diffuseDetailMapChannel;


    /**
     * Controls the 2D offset of the detail (secondary) diffuse map. Each component is between 0 and
     * 1.
     *
     * @type {Vec2}
     */
    diffuseDetailMapOffset;


    /**
     * Controls the 2D rotation (in degrees) of the main (secondary) diffuse map.
     *
     * @type {number}
     */
    diffuseDetailMapRotation;


    /**
     * Controls the 2D tiling of the detail (secondary) diffuse map.
     *
     * @type {Vec2}
     */
    diffuseDetailMapTiling;


    /**
     * Detail (secondary) diffuse map UV channel.
     *
     * @type {number}
     */
    diffuseDetailMapUv;


    /**
     * Determines how the main (primary) and detail (secondary) diffuse maps are blended together.
     * Can be: - {@link DETAILMODE_MUL}: Multiply together the primary and secondary colors.
     *
     * - {@link DETAILMODE_ADD}: Add together the primary and secondary colors.
     * - {@link DETAILMODE_SCREEN}: Softer version of {@link DETAILMODE_ADD}.
     * - {@link DETAILMODE_OVERLAY}: Multiplies or screens the colors, depending on the primary
     * color.
     * - {@link DETAILMODE_MIN}: Select whichever of the primary and secondary colors is darker,
     * component-wise. - {@link DETAILMODE_MAX}: Select whichever of the primary and secondary
     * colors is lighter, component-wise. Defaults to {@link DETAILMODE_MUL}.
     *
     * @type {string}
     */
    diffuseDetailMode;


    /**
     * The main (primary) diffuse map of the material (default is null).
     *
     * @type {import('../../platform/graphics/texture.js').Texture | null}
     */
    diffuseMap;


    /**
     * Color channels of the main (primary) diffuse map to use. Can be "r", "g", "b", "a", "rgb" or
     * any swizzled combination.
     *
     * @type {string}
     */
    diffuseMapChannel;


    /**
     * Controls the 2D offset of the main (primary) diffuse map. Each component is between 0 and 1.
     *
     * @type {Vec2}
     */
    diffuseMapOffset;


    /**
     * Controls the 2D rotation (in degrees) of the main (primary) diffuse map.
     *
     * @type {number}
     */
    diffuseMapRotation;


    /**
     * Controls the 2D tiling of the main (primary) diffuse map.
     *
     * @type {Vec2}
     */
    diffuseMapTiling;


    /**
     * Main (primary) diffuse map UV channel.
     *
     * @type {number}
     */
    diffuseMapUv;


    /**
     * Multiply main (primary) diffuse map and/or diffuse vertex color by the constant diffuse
     * value.
     *
     * @type {boolean}
     */
    diffuseTint;


    /**
     * Use mesh vertex colors for diffuse. If diffuseMap or are diffuseTint are set, they'll be
     * multiplied by vertex colors.
     *
     * @type {boolean}
     */
    diffuseVertexColor;


    /**
     * Vertex color channels to use for diffuse. Can be "r", "g", "b", "a", "rgb" or any swizzled
     * combination.
     *
     * @type {string}
     */
    diffuseVertexColorChannel;


    /**
     * The emissive color of the material. This color value is 3-component (RGB), where each
     * component is between 0 and 1.
     *
     * @type {Color}
     */
    emissive;


    /**
     * Emissive color multiplier.
     *
     * @type {number}
     */
    emissiveIntensity;


    /**
     * The emissive map of the material (default is null). Can be HDR.
     *
     * @type {import('../../platform/graphics/texture.js').Texture | null}
     */
    emissiveMap;


    /**
     * Color channels of the emissive map to use. Can be "r", "g", "b", "a", "rgb" or any swizzled
     * combination.
     *
     * @type {string}
     */
    emissiveMapChannel;


    /**
     * Controls the 2D offset of the emissive map. Each component is between 0 and 1.
     *
     * @type {Vec2}
     */
    emissiveMapOffset;


    /**
     * Controls the 2D rotation (in degrees) of the emissive map.
     *
     * @type {number}
     */
    emissiveMapRotation;


    /**
     * Controls the 2D tiling of the emissive map.
     *
     * @type {Vec2}
     */
    emissiveMapTiling;


    /**
     * Emissive map UV channel.
     *
     * @type {number}
     */
    emissiveMapUv;


    /**
     * Multiply emissive map and/or emissive vertex color by the constant emissive value.
     *
     * @type {boolean}
     */
    emissiveTint;


    /**
     * Use mesh vertex colors for emission. If emissiveMap or emissiveTint are set, they'll be
     * multiplied by vertex colors.
     *
     * @type {boolean}
     */
    emissiveVertexColor;


    /**
     * Vertex color channels to use for emission. Can be "r", "g", "b", "a", "rgb" or any swizzled
     * combination.
     *
     * @type {string}
     */
    emissiveVertexColorChannel;


    /**
     * Enables GGX specular. Also enables {@link StandardMaterial#anisotropy}  parameter to set
     * material anisotropy.
     *
     * @type {boolean}
     */
    enableGGXSpecular;


    /**
     * The prefiltered environment lighting atlas (default is null). This setting overrides cubeMap
     * and sphereMap and will replace the scene lighting environment.
     *
     * @type {import('../../platform/graphics/texture.js').Texture | null}
     */
    envAtlas;


    /**
     * Defines the formula used for Fresnel effect. As a side-effect, enabling any Fresnel model
     * changes the way diffuse and reflection components are combined. When Fresnel is off, legacy
     * non energy-conserving combining is used. When it is on, combining behavior is defined by
     * conserveEnergy parameter.
     *
     * - {@link FRESNEL_NONE}: No Fresnel.
     * - {@link FRESNEL_SCHLICK}: Schlick's approximation of Fresnel (recommended). Parameterized by
     * specular color.
     *
     * @type {number}
     */
    fresnelModel;


    /**
     * Defines the glossiness of the material from 0 (rough) to 1 (shiny).
     *
     * @type {number}
     */
    gloss;


    /**
     * Invert the gloss component (default is false). Enabling this flag results in material treating
     * the gloss members as roughness.
     *
     * @type {boolean}
     */
    glossInvert;


    /**
     * Gloss map (default is null). If specified, will be multiplied by normalized gloss value and/or
     * vertex colors.
     *
     * @type {import('../../platform/graphics/texture.js').Texture | null}
     */
    glossMap;


    /**
     * Color channel of the gloss map to use. Can be "r", "g", "b" or "a".
     *
     * @type {string}
     */
    glossMapChannel;


    /**
     * Controls the 2D offset of the gloss map. Each component is between 0 and 1.
     *
     * @type {Vec2}
     */
    glossMapOffset;


    /**
     * Controls the 2D rotation (in degrees) of the gloss map.
     *
     * @type {number}
     */
    glossMapRotation;


    /**
     * Controls the 2D tiling of the gloss map.
     *
     * @type {Vec2}
     */
    glossMapTiling;


    /**
     * Gloss map UV channel.
     *
     * @type {number}
     */
    glossMapUv;


    /**
     * Use mesh vertex colors for glossiness. If glossMap is set, it'll be multiplied by vertex
     * colors.
     *
     * @type {boolean}
     */
    glossVertexColor;


    /**
     * Vertex color channel to use for glossiness. Can be "r", "g", "b" or "a".
     *
     * @type {string}
     */
    glossVertexColorChannel;


    /**
     * The height map of the material (default is null). Used for a view-dependent parallax effect.
     * The texture must represent the height of the surface where darker pixels are lower and
     * lighter pixels are higher. It is recommended to use it together with a normal map.
     *
     * @type {import('../../platform/graphics/texture.js').Texture | null}
     */
    heightMap;


    /**
     * Color channel of the height map to use. Can be "r", "g", "b" or "a".
     *
     * @type {string}
     */
    heightMapChannel;


    /**
     * Height map multiplier. Affects the strength of the parallax effect.
     *
     * @type {number}
     */
    heightMapFactor;


    /**
     * Controls the 2D offset of the height map. Each component is between 0 and 1.
     *
     * @type {Vec2}
     */
    heightMapOffset;


    /**
     * Controls the 2D rotation (in degrees) of the height map.
     *
     * @type {number}
     */
    heightMapRotation;


    /**
     * Controls the 2D tiling of the height map.
     *
     * @type {Vec2}
     */
    heightMapTiling;


    /**
     * Height map UV channel.
     *
     * @type {number}
     */
    heightMapUv;


    /**
     * A custom lightmap of the material (default is null). Lightmaps are textures that contain
     * pre-rendered lighting. Can be HDR.
     *
     * @type {import('../../platform/graphics/texture.js').Texture | null}
     */
    lightMap;


    /**
     * Color channels of the lightmap to use. Can be "r", "g", "b", "a", "rgb" or any swizzled
     * combination.
     *
     * @type {string}
     */
    lightMapChannel;


    /**
     * Controls the 2D offset of the lightmap. Each component is between 0 and 1.
     *
     * @type {Vec2}
     */
    lightMapOffset;


    /**
     * Controls the 2D rotation (in degrees) of the lightmap.
     *
     * @type {number}
     */
    lightMapRotation;


    /**
     * Controls the 2D tiling of the lightmap.
     *
     * @type {Vec2}
     */
    lightMapTiling;


    /**
     * Lightmap UV channel
     *
     * @type {number}
     */
    lightMapUv;


    /**
     * Use baked vertex lighting. If lightMap is set, it'll be multiplied by vertex colors.
     *
     * @type {boolean}
     */
    lightVertexColor;


    /**
     * Vertex color channels to use for baked lighting. Can be "r", "g", "b", "a", "rgb" or any
     * swizzled combination.
     *
     * @type {string}
     */
    lightVertexColorChannel;


    /**
     * Defines how much the surface is metallic. From 0 (dielectric) to 1 (metal).
     *
     * @type {number}
     */
    metalness;


    /**
     * Monochrome metalness map (default is null).
     *
     * @type {import('../../platform/graphics/texture.js').Texture | null}
     */
    metalnessMap;


    /**
     * Color channel of the metalness map to use. Can be "r", "g", "b" or "a".
     *
     * @type {string}
     */
    metalnessMapChannel;


    /**
     * Controls the 2D offset of the metalness map. Each component is between 0 and 1.
     *
     * @type {Vec2}
     */
    metalnessMapOffset;


    /**
     * Controls the 2D rotation (in degrees) of the metalness map.
     *
     * @type {number}
     */
    metalnessMapRotation;


    /**
     * Controls the 2D tiling of the metalness map.
     *
     * @type {Vec2}
     */
    metalnessMapTiling;


    /**
     * Metalness map UV channel.
     *
     * @type {number}
     */
    metalnessMapUv;


    /**
     * Use mesh vertex colors for metalness. If metalnessMap is set, it'll be multiplied by vertex
     * colors.
     *
     * @type {boolean}
     */
    metalnessVertexColor;


    /**
     * Vertex color channel to use for metalness. Can be "r", "g", "b" or "a".
     *
     * @type {string}
     */
    metalnessVertexColorChannel;


    /**
     * The detail (secondary) normal map of the material (default is null). Will only be used if
     * main (primary) normal map is non-null.
     *
     * @type {import('../../platform/graphics/texture.js').Texture | null}
     */
    normalDetailMap;


    /**
     * The bumpiness of the material. This value scales the assigned detail (secondary) normal map.
     * It should be normally between 0 (no bump mapping) and 1 (full bump mapping), but can be set
     * to e.g. 2 to give even more pronounced bump effect.
     *
     * @type {number}
     */
    normalDetailMapBumpiness;


    /**
     * Controls the 2D offset of the detail (secondary) normal map. Each component is between 0 and
     * 1.
     *
     * @type {Vec2}
     */
    normalDetailMapOffset;


    /**
     * Controls the 2D rotation (in degrees) of the detail (secondary) normal map.
     *
     * @type {number}
     */
    normalDetailMapRotation;


    /**
     * Controls the 2D tiling of the detail (secondary) normal map.
     *
     * @type {Vec2}
     */
    normalDetailMapTiling;


    /**
     * Detail (secondary) normal map UV channel.
     *
     * @type {number}
     */
    normalDetailMapUv;


    /**
     * The main (primary) normal map of the material (default is null). The texture must contains
     * normalized, tangent space normals.
     *
     * @type {import('../../platform/graphics/texture.js').Texture | null}
     */
    normalMap;


    /**
     * Controls the 2D offset of the main (primary) normal map. Each component is between 0 and 1.
     *
     * @type {Vec2}
     */
    normalMapOffset;


    /**
     * Controls the 2D rotation (in degrees) of the main (primary) normal map.
     *
     * @type {number}
     */
    normalMapRotation;


    /**
     * Controls the 2D tiling of the main (primary) normal map.
     *
     * @type {Vec2}
     */
    normalMapTiling;


    /**
     * Main (primary) normal map UV channel.
     *
     * @type {number}
     */
    normalMapUv;


    /**
     * Tells if AO should darken directional lighting. Defaults to false.
     *
     * @type {number}
     */
    occludeDirect;


    /**
     * Uses ambient occlusion to darken specular/reflection. It's a hack, because real specular
     * occlusion is view-dependent. However, it can be better than nothing.
     *
     * - {@link SPECOCC_NONE}: No specular occlusion
     * - {@link SPECOCC_AO}: Use AO directly to occlude specular.
     * - {@link SPECOCC_GLOSSDEPENDENT}: Modify AO based on material glossiness/view angle to
     * occlude specular.
     *
     * @type {number}
     */
    occludeSpecular;


    /**
     * Controls visibility of specular occlusion.
     *
     * @type {number}
     */
    occludeSpecularIntensity;


    /**
     * A custom function that will be called after all shader generator properties are collected and
     * before shader code is generated. This function will receive an object with shader generator
     * settings (based on current material and scene properties), that you can change and then
     * return. Returned value will be used instead. This is mostly useful when rendering the same
     * set of objects, but with different shader variations based on the same material. For example,
     * you may wish to render a depth or normal pass using textures assigned to the material, a
     * reflection pass with simpler shaders and so on. These properties are split into two sections,
     * generic standard material options and lit options. Properties of the standard material
     * options are {@link StandardMaterialOptions} and the options for the lit options are
     * {@link LitShaderOptions}.
     *
     * @type {UpdateShaderCallback}
     */
    onUpdateShader;


    /**
     * The opacity of the material. This value can be between 0 and 1, where 0 is fully transparent
     * and 1 is fully opaque. If you want the material to be semi-transparent you also need to set
     * the {@link Material#blendType} to {@link BLEND_NORMAL}, {@link BLEND_ADDITIVE} or any other
     * mode. Also note that for most semi-transparent objects you want {@link Material#depthWrite}
     * to be false, otherwise they can fully occlude objects behind them.
     *
     * @type {number}
     */
    opacity;


    /**
     * Used to specify whether opacity is dithered, which allows transparency without alpha
     * blending. Can be:
     *
     * - {@link DITHER_NONE}: Opacity dithering is disabled.
     * - {@link DITHER_BAYER8}: Opacity is dithered using a Bayer 8 matrix.
     * - {@link DITHER_BLUENOISE}: Opacity is dithered using a blue noise.
     * - {@link DITHER_IGNNOISE}: Opacity is dithered using an interleaved gradient noise.
     *
     * Defaults to {@link DITHER_NONE}.
     *
     * @type {string}
     */
    opacityDither;


    /**
     * Used to specify whether shadow opacity is dithered, which allows shadow transparency without
     * alpha blending.  Can be:
     *
     * - {@link DITHER_NONE}: Opacity dithering is disabled.
     * - {@link DITHER_BAYER8}: Opacity is dithered using a Bayer 8 matrix.
     * - {@link DITHER_BLUENOISE}: Opacity is dithered using a blue noise.
     * - {@link DITHER_IGNNOISE}: Opacity is dithered using an interleaved gradient noise.
     *
     * Defaults to {@link DITHER_NONE}.
     *
     * @type {string}
     */
    opacityShadowDither;


    /**
     * Used to specify whether specular and reflections are faded out using
     * {@link StandardMaterial#opacity}. Default is true. When set to false use
     * {@link Material#alphaFade} to fade out materials.
     *
     * @type {boolean}
     */
    opacityFadesSpecular;


    /**
     * The opacity map of the material (default is null).
     *
     * @type {import('../../platform/graphics/texture.js').Texture | null}
     */
    opacityMap;


    /**
     * Color channel of the opacity map to use. Can be "r", "g", "b" or "a".
     *
     * @type {string}
     */
    opacityMapChannel;


    /**
     * Controls the 2D offset of the opacity map. Each component is between 0 and 1.
     *
     * @type {Vec2}
     */
    opacityMapOffset;


    /**
     * Controls the 2D rotation (in degrees) of the opacity map.
     *
     * @type {number}
     */
    opacityMapRotation;


    /**
     * Controls the 2D tiling of the opacity map.
     *
     * @type {Vec2}
     */
    opacityMapTiling;


    /**
     * Opacity map UV channel.
     *
     * @type {number}
     */
    opacityMapUv;


    /**
     * Use mesh vertex colors for opacity. If opacityMap is set, it'll be multiplied by vertex
     * colors.
     *
     * @type {boolean}
     */
    opacityVertexColor;


    /**
     * Vertex color channels to use for opacity. Can be "r", "g", "b" or "a".
     *
     * @type {string}
     */
    opacityVertexColorChannel;


    /**
     * Align vertices to pixel coordinates when rendering. Useful for pixel perfect 2D graphics.
     *
     * @type {boolean}
     */
    pixelSnap;


    /**
     * Environment map intensity.
     *
     * @type {number}
     */
    reflectivity;


    /**
     * Defines the visibility of refraction. Material can refract the same cube map as used for
     * reflections.
     *
     * @type {number}
     */
    refraction;


    /**
     * Defines the index of refraction, i.e. The amount of distortion. The value is calculated as
     * (outerIor / surfaceIor), where inputs are measured indices of refraction, the one around the
     * object and the one of its own surface. In most situations outer medium is air, so outerIor
     * will be approximately 1. Then you only need to do (1.0 / surfaceIor).
     *
     * @type {number}
     */
    refractionIndex;


    /**
     * The strength of the angular separation of colors (chromatic aberration) transmitting through
     * a volume. Defaults to 0, which is equivalent to no dispersion.
     *
     * @type {number}
     */
    dispersion;


    /**
     * Defines the shading model.
     *
     * - {@link SPECULAR_PHONG}: Phong without energy conservation. You
     * should only use it as a backwards compatibility with older projects.
     * - {@link SPECULAR_BLINN}: Energy-conserving Blinn-Phong.
     *
     * @type {number}
     */
    shadingModel;


    /**
     * The specular color of the material. This color value is 3-component (RGB), where each
     * component is between 0 and 1. Defines surface reflection/specular color. Affects specular
     * intensity and tint.
     *
     * @type {Color}
     */
    specular;


    /**
     * The specular map of the material (default is null).
     *
     * @type {import('../../platform/graphics/texture.js').Texture | null}
     */
    specularMap;


    /**
     * Color channels of the specular map to use. Can be "r", "g", "b", "a", "rgb" or any swizzled
     * combination.
     *
     * @type {string}
     */
    specularMapChannel;


    /**
     * Controls the 2D offset of the specular map. Each component is between 0 and 1.
     *
     * @type {Vec2}
     */
    specularMapOffset;


    /**
     * Controls the 2D rotation (in degrees) of the specular map.
     *
     * @type {number}
     */
    specularMapRotation;


    /**
     * Controls the 2D tiling of the specular map.
     *
     * @type {Vec2}
     */
    specularMapTiling;


    /**
     * Specular map UV channel.
     *
     * @type {number}
     */
    specularMapUv;


    /**
     * Multiply specular map and/or specular vertex color by the constant specular value.
     *
     * @type {boolean}
     */
    specularTint;


    /**
     * Use mesh vertex colors for specular. If specularMap or are specularTint are set, they'll be
     * multiplied by vertex colors.
     *
     * @type {boolean}
     */
    specularVertexColor;


    /**
     * Vertex color channels to use for specular. Can be
     *
     * @type {string}
     */
    specularVertexColorChannel;


    /**
     * The factor of specular intensity, used to weight the fresnel and specularity. Default is 1.0.
     *
     * @type {number}
     */
    specularityFactor;


    /**
     * The factor of specularity as a texture (default is null).
     *
     * @type {import('../../platform/graphics/texture.js').Texture | null}
     */
    specularityFactorMap;


    /**
     * The channel used by the specularity factor texture to sample from (default is 'a').
     *
     * @type {string}
     */
    specularityFactorMapChannel;


    /**
     * Controls the 2D offset of the specularity factor map. Each component is between 0 and 1.
     *
     * @type {Vec2}
     */
    specularityFactorMapOffset;


    /**
     * Controls the 2D rotation (in degrees) of the specularity factor map.
     *
     * @type {number}
     */
    specularityFactorMapRotation;


    /**
     * Controls the 2D tiling of the specularity factor map.
     *
     * @type {Vec2}
     */
    specularityFactorMapTiling;


    /**
     * Specularity factor map UV channel.
     *
     * @type {number}
     */
    specularityFactorMapUv;


    /**
     * Toggle sheen specular effect on/off.
     *
     * @type {boolean}
     */
    useSheen;


    /**
     * The specular color of the sheen (fabric) microfiber structure. This color value is 3-component
     * (RGB), where each component is between 0 and 1.
     *
     * @type {Color}
     */
    sheen;


    /**
     * The sheen microstructure color map of the material (default is null).
     *
     * @type {import('../../platform/graphics/texture.js').Texture | null}
     */
    sheenMap;


    /**
     * Color channels of the sheen map to use. Can be "r", "g", "b", "a", "rgb" or any swizzled
     * combination.
     *
     * @type {string}
     */
    sheenMapChannel;


    /**
     * Controls the 2D offset of the sheen map. Each component is between 0 and 1.
     *
     * @type {Vec2}
     */
    sheenMapOffset;


    /**
     * Controls the 2D rotation (in degrees) of the sheen map.
     *
     * @type {number}
     */
    sheenMapRotation;


    /**
     * Controls the 2D tiling of the sheen map.
     *
     * @type {Vec2}
     */
    sheenMapTiling;


    /**
     * Sheen map UV channel.
     *
     * @type {number}
     */
    sheenMapUv;


    /**
     * Multiply sheen map and/or sheen vertex color by the constant sheen value.
     *
     * @type {boolean}
     */
    sheenTint;


    /**
     * Use mesh vertex colors for sheen. If sheen map or sheen tint are set, they'll be multiplied
     * by vertex colors.
     *
     * @type {boolean}
     */
    sheenVertexColor;


    /**
     * TODO:sheenVertexColorChannel
     *
     * @type {string}
     */
    sheenVertexColorChannel;


    /**
     * The spherical environment map of the material (default is null). This will replace the scene
     * lighting environment.
     *
     * @type {import('../../platform/graphics/texture.js').Texture | null}
     */
    sphereMap;


    /**
     * Calculate proper normals (and therefore lighting) on backfaces.
     *
     * @type {boolean}
     */
    twoSidedLighting;


    /**
     * Apply fogging (as configured in scene settings)
     *
     * @type {boolean}
     */
    useFog;


    /**
     * Apply gamma correction and tonemapping (as configured in scene settings).
     *
     * @type {boolean}
     */
    useGammaTonemap;


    /**
     * Apply lighting
     *
     * @type {boolean}
     */
    useLighting;


    /**
     * Use metalness properties instead of specular. When enabled, diffuse colors also affect
     * specular instead of the dedicated specular map. This can be used as alternative to specular
     * color to save space. With metalness == 0, the pixel is assumed to be dielectric and diffuse
     * color is used as normal. With metalness == 1, the pixel is fully metallic, and diffuse color
     * is used as specular color instead.
     *
     * @type {boolean}
     */
    useMetalness;


    /**
     * When metalness is enabled, use the specular map to apply color tint to specular reflections.
     * at direct angles.
     *
     * @type {boolean}
     */
    useMetalnessSpecularColor;


    /**
     * Apply scene skybox as prefiltered environment map
     *
     * @type {boolean}
     */
    useSkybox;

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

        this._dirtyShader = true;

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
            // remove existing undefined values (will force class to use set/get instead)
            delete this[name];
            this[`_${name}`] = _props[name].value();
        });

        /**
         * @type {Object<string, string>}
         * @private
         */
        this._chunks = { };
        this._uniformCache = { };
    }

    /** @ignore */
    set shader(shader) {
        Debug.warn('StandardMaterial#shader property is not implemented, and should not be used.');
    }

    /** @ignore */
    get shader() {
        Debug.warn('StandardMaterial#shader property is not implemented, and should not be used.');
        return null;
    }

    /**
     * Object containing custom shader chunks that will replace default ones.
     *
     * @type {Object<string, string>}
     */
    set chunks(value) {
        this._dirtyShader = true;
        this._chunks = value;
    }

    get chunks() {
        this._dirtyShader = true;
        return this._chunks;
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

        // clone chunks
        for (const p in source._chunks) {
            if (source._chunks.hasOwnProperty(p))
                this._chunks[p] = source._chunks[p];
        }

        return this;
    }

    /**
     * Sets a vertex shader attribute on a material.
     *
     * @param {string} name - The name of the parameter to set.
     * @param {string} semantic - Semantic to map the vertex data. Must match with the semantic set on vertex stream
     * of the mesh.
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
        const mname = p + 'Map';
        const map = this[mname];
        if (map) {
            this._setParameter('texture_' + mname, map);

            const tname = mname + 'Transform';
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

        if (!this.diffuseMap || this.diffuseTint) {
            this._setParameter('material_diffuse', getUniform('diffuse'));
        }

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
            if (!this.sheenMap || this.sheenTint) {
                this._setParameter('material_sheen', getUniform('sheen'));
            }
            if (!this.sheenGlossMap || this.sheenGlossTint) {
                this._setParameter('material_sheenGloss', this.sheenGloss);
            }

            this._setParameter('material_refractionIndex', this.refractionIndex);
        } else {
            if (!this.specularMap || this.specularTint) {
                this._setParameter('material_specular', getUniform('specular'));
            }
        }

        if (this.enableGGXSpecular) {
            this._setParameter('material_anisotropy', this.anisotropy);
        }

        if (this.clearCoat > 0) {
            this._setParameter('material_clearCoat', this.clearCoat);
            this._setParameter('material_clearCoatGloss', this.clearCoatGloss);
            this._setParameter('material_clearCoatBumpiness', this.clearCoatBumpiness);
        }

        this._setParameter('material_gloss', getUniform('gloss'));

        if (!this.emissiveMap || this.emissiveTint) {
            this._setParameter('material_emissive', getUniform('emissive'));
        }
        if (this.emissiveIntensity !== 1) {
            this._setParameter('material_emissiveIntensity', this.emissiveIntensity);
        }

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

        const isPhong = this.shadingModel === SPECULAR_PHONG;

        // set overridden environment textures
        if (this.envAtlas && this.cubeMap && !isPhong) {
            this._setParameter('texture_envAtlas', this.envAtlas);
            this._setParameter('texture_cubeMap', this.cubeMap);
        } else if (this.envAtlas && !isPhong) {
            this._setParameter('texture_envAtlas', this.envAtlas);
        } else if (this.cubeMap) {
            this._setParameter('texture_cubeMap', this.cubeMap);
        } else if (this.sphereMap) {
            this._setParameter('texture_sphereMap', this.sphereMap);
        }

        this._setParameter('material_reflectivity', this.reflectivity);

        // remove unused params
        this._processParameters('_activeParams');

        if (this._dirtyShader) {
            this.clearVariants();
        }
    }

    updateEnvUniforms(device, scene) {
        const isPhong = this.shadingModel === SPECULAR_PHONG;
        const hasLocalEnvOverride = (this.envAtlas && !isPhong) || this.cubeMap || this.sphereMap;

        if (!hasLocalEnvOverride && this.useSkybox) {
            if (scene.envAtlas && scene.skybox && !isPhong) {
                this._setParameter('texture_envAtlas', scene.envAtlas);
                this._setParameter('texture_cubeMap', scene.skybox);
            } else if (scene.envAtlas && !isPhong) {
                this._setParameter('texture_envAtlas', scene.envAtlas);
            } else if (scene.skybox) {
                this._setParameter('texture_cubeMap', scene.skybox);
            }
        }

        this._processParameters('_activeLightingParams');
    }

    getShaderVariant(device, scene, objDefs, unused, pass, sortedLights, viewUniformFormat, viewBindGroupFormat, vertexFormat) {

        // update prefiltered lighting data
        this.updateEnvUniforms(device, scene);

        // Minimal options for Depth, Shadow and Prepass passes
        const shaderPassInfo = ShaderPass.get(device).getByIndex(pass);
        const minimalOptions = pass === SHADER_DEPTH || pass === SHADER_PICK || pass === SHADER_PREPASS_VELOCITY || shaderPassInfo.isShadow;
        let options = minimalOptions ? standard.optionsContextMin : standard.optionsContext;

        if (minimalOptions)
            this.shaderOptBuilder.updateMinRef(options, scene, this, objDefs, pass, sortedLights);
        else
            this.shaderOptBuilder.updateRef(options, scene, this, objDefs, pass, sortedLights);

        // execute user callback to modify the options
        if (this.onUpdateShader) {
            options = this.onUpdateShader(options);
        }

        const processingOptions = new ShaderProcessorOptions(viewUniformFormat, viewBindGroupFormat, vertexFormat);

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
        if (!oldValue?.equals(value)) {
            this._dirtyShader = this._dirtyShader || dirtyShaderFunc(oldValue, value);
            this[internalName] = oldValue ? oldValue.copy(value) : value;
        }
    };

    definePropInternal(prop.name, () => prop.defaultValue.clone(), setterFunc, prop.getterFunc);
};

// define either a value or aggregate property
const defineProp = (prop) => {
    return prop.defaultValue && prop.defaultValue.clone ? defineAggProp(prop) : defineValueProp(prop);
};

function _defineTex2D(name, channel = "rgb", vertexColor = true, uv = 0) {
    // store texture name
    _matTex2D[name] = channel.length || -1;

    defineProp({
        name: `${name}Map`,
        defaultValue: null,
        dirtyShaderFunc: (oldValue, newValue) => {
            return !!oldValue !== !!newValue ||
                oldValue && (oldValue.type !== newValue.type ||
                             oldValue.fixCubemapSeams !== newValue.fixCubemapSeams ||
                             oldValue.format !== newValue.format);
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
        const gamma = material.useGammaTonemap && scene.gammaCorrection;

        if (gamma) {
            uniform[0] = Math.pow(color.r, 2.2);
            uniform[1] = Math.pow(color.g, 2.2);
            uniform[2] = Math.pow(color.b, 2.2);
        } else {
            uniform[0] = color.r;
            uniform[1] = color.g;
            uniform[2] = color.b;
        }

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
    _defineColor('ambient', new Color(0.7, 0.7, 0.7));
    _defineColor('diffuse', new Color(1, 1, 1));
    _defineColor('specular', new Color(0, 0, 0));
    _defineColor('emissive', new Color(0, 0, 0));
    _defineColor('sheen', new Color(1, 1, 1));
    _defineColor('attenuation', new Color(1, 1, 1));
    _defineFloat('emissiveIntensity', 1);
    _defineFloat('specularityFactor', 1);
    _defineFloat('sheenGloss', 0.0);

    _defineFloat('gloss', 0.25, (material, device, scene) => {
        return material.shadingModel === SPECULAR_PHONG ?
            // legacy: expand back to specular power
            Math.pow(2, material.gloss * 11) :
            material.gloss;
    });

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
    _defineFloat('anisotropy', 0);
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

    _defineFlag('ambientTint', false);
    _defineFlag('diffuseTint', false);
    _defineFlag('specularTint', false);
    _defineFlag('specularityFactorTint', false);
    _defineFlag('emissiveTint', false);
    _defineFlag('fastTbn', false);
    _defineFlag('useMetalness', false);
    _defineFlag('useMetalnessSpecularColor', false);
    _defineFlag('useSheen', false);
    _defineFlag('enableGGXSpecular', false);
    _defineFlag('occludeDirect', false);
    _defineFlag('normalizeNormalMap', true);
    _defineFlag('conserveEnergy', true);
    _defineFlag('opacityFadesSpecular', true);
    _defineFlag('occludeSpecular', SPECOCC_AO);
    _defineFlag('shadingModel', SPECULAR_BLINN);
    _defineFlag('fresnelModel', FRESNEL_SCHLICK); // NOTE: this has been made to match the default shading model (to fix a bug)
    _defineFlag('useDynamicRefraction', false);
    _defineFlag('cubeMapProjection', CUBEPROJ_NONE);
    _defineFlag('customFragmentShader', null);
    _defineFlag('useFog', true);
    _defineFlag('useLighting', true);
    _defineFlag('useGammaTonemap', true);
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
