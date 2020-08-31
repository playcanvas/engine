import { Color } from '../../core/color.js';

import { Vec2 } from '../../math/vec2.js';
import { Vec4 } from '../../math/vec4.js';

import { generateDpAtlas } from '../../graphics/paraboloid.js';
import { shFromCubemap } from '../../graphics/prefilter-cubemap.js';
import { _matTex2D, standard } from '../../graphics/program-lib/programs/standard.js';

import {
    CUBEPROJ_BOX, CUBEPROJ_NONE,
    DETAILMODE_MUL,
    FRESNEL_NONE,
    SHADER_FORWARDHDR, SHADER_PICK,
    SPECOCC_AO,
    SPECULAR_BLINN, SPECULAR_PHONG
} from '../constants.js';
import { Material } from './material.js';
import { StandardMaterialOptionsBuilder } from './standard-material-options-builder.js';

import { Application } from '../../framework/application.js';

import { standardMaterialCubemapParameters, standardMaterialTextureParameters } from './standard-material-parameters.js';

/**
 * @class
 * @name pc.StandardMaterial
 * @augments pc.Material
 * @classdesc A Standard material is the main, general purpose material that is most often used for rendering.
 * It can approximate a wide variety of surface types and can simulate dynamic reflected light.
 * Most maps can use 3 types of input values in any combination: constant (color or number), mesh vertex colors and a texture. All enabled inputs are multiplied together.
 *
 * @property {pc.Color} ambient The ambient color of the material. This color value is 3-component (RGB),
 * where each component is between 0 and 1.
 *
 * @property {pc.Color} diffuse The diffuse color of the material. This color value is 3-component (RGB),
 * where each component is between 0 and 1.
 * Defines basic surface color (aka albedo).
 * @property {boolean} diffuseTint Multiply main (primary) diffuse map and/or diffuse vertex color by the constant diffuse value.
 * @property {pc.Texture|null} diffuseMap The main (primary) diffuse map of the material (default is null).
 * @property {number} diffuseMapUv Main (primary) diffuse map UV channel.
 * @property {pc.Vec2} diffuseMapTiling Controls the 2D tiling of the main (primary) diffuse map.
 * @property {pc.Vec2} diffuseMapOffset Controls the 2D offset of the main (primary) diffuse map. Each component is between 0 and 1.
 * @property {string} diffuseMapChannel Color channels of the main (primary) diffuse map to use. Can be "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} diffuseVertexColor Use mesh vertex colors for diffuse. If diffuseMap or are diffuseTint are set, they'll be multiplied by vertex colors.
 * @property {string} diffuseVertexColorChannel Vertex color channels to use for diffuse. Can be "r", "g", "b", "a", "rgb" or any swizzled combination.
 *
 * @property {pc.Texture|null} diffuseDetailMap The detail (secondary) diffuse map of the material (default is null). Will only be used if main (primary) diffuse map is non-null.
 * @property {number} diffuseDetailMapUv Detail (secondary) diffuse map UV channel.
 * @property {pc.Vec2} diffuseDetailMapTiling Controls the 2D tiling of the detail (secondary) diffuse map.
 * @property {pc.Vec2} diffuseDetailMapOffset Controls the 2D offset of the detail (secondary) diffuse map. Each component is between 0 and 1.
 * @property {string} diffuseDetailMapChannel Color channels of the detail (secondary) diffuse map to use. Can be "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {string} diffuseDetailMode Determines how the main (primary) and detail (secondary) diffuse maps are blended together. Can be:
 * * {@link pc.DETAILMODE_MUL}: Multiply together the primary and secondary colors.
 * * {@link pc.DETAILMODE_ADD}: Add together the primary and secondary colors.
 * * {@link pc.DETAILMODE_SCREEN}: Softer version of {@link pc.DETAILMODE_ADD}.
 * * {@link pc.DETAILMODE_OVERLAY}: Multiplies or screens the colors, depending on the primary color.
 * * {@link pc.DETAILMODE_MIN}: Select whichever of the primary and secondary colors is darker, component-wise.
 * * {@link pc.DETAILMODE_MAX}: Select whichever of the primary and secondary colors is lighter, component-wise.
 * Defaults to {@link pc.DETAILMODE_MUL}.
 *
 * @property {pc.Color} specular The specular color of the material. This color value is 3-component (RGB),
 * where each component is between 0 and 1.
 * Defines surface reflection/specular color. Affects specular intensity and tint.
 * @property {boolean} specularTint Multiply specular map and/or specular vertex color by the constant specular value.
 * @property {pc.Texture|null} specularMap The specular map of the material (default is null).
 * @property {number} specularMapUv Specular map UV channel.
 * @property {pc.Vec2} specularMapTiling Controls the 2D tiling of the specular map.
 * @property {pc.Vec2} specularMapOffset Controls the 2D offset of the specular map. Each component is between 0 and 1.
 * @property {string} specularMapChannel Color channels of the specular map to use. Can be "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} specularVertexColor Use mesh vertex colors for specular. If specularMap or are specularTint are set, they'll be multiplied by vertex colors.
 * @property {string} specularVertexColorChannel Vertex color channels to use for specular. Can be "r", "g", "b", "a", "rgb" or any swizzled combination.
 *
 * @property {boolean} enableGGXSpecular Enables GGX specular. Also enables anisotropy parameter to set material anisotropy.
 * @property {number} anisotropy Defines amount of anisotropy. Requires enableGGXSpecular is set to true.
 * * When anisotropy == 0, specular is isotropic.
 * * When anisotropy < 0, anistropy direction aligns with the tangent, and specular anisotropy increases as the anisotropy value decreases to minimum of -1.
 * * When anisotropy > 0, anistropy direction aligns with the bi-normal, and specular anisotropy increases as anisotropy value increases to maximum of 1.
 *
 * @property {number} clearCoat Defines intensity of clear coat layer from 0 to 1. Clear coat layer is disabled when clearCoat == 0. Default value is 0 (disabled).
 * @property {pc.Texture|null} clearCoatMap Monochrome clear coat intensity map (default is null). If specified, will be multiplied by normalized 'clearCoat' value and/or vertex colors.
 * @property {number} clearCoatMapUv Clear coat intensity map UV channel.
 * @property {pc.Vec2} clearCoatMapTiling Controls the 2D tiling of the clear coat intensity map.
 * @property {pc.Vec2} clearCoatMapOffset Controls the 2D offset of the clear coat intensity map. Each component is between 0 and 1.
 * @property {string} clearCoatMapChannel Color channel of the clear coat intensity map to use. Can be "r", "g", "b" or "a".
 * @property {boolean} clearCoatVertexColor Use mesh vertex colors for clear coat intensity. If clearCoatMap is set, it'll be multiplied by vertex colors.
 * @property {string} clearCoatVertexColorChannel Vertex color channel to use for clear coat intensity. Can be "r", "g", "b" or "a".
 * @property {number} clearCoatGlossiness Defines the clear coat glossiness of the clear coat layer from 0 (rough) to 1 (mirror).
 * @property {pc.Texture|null} clearCoatGlossMap Monochrome clear coat glossiness map (default is null). If specified, will be multiplied by normalized 'clearCoatGlossiness' value and/or vertex colors.
 * @property {number} clearCoatGlossMapUv Clear coat gloss map UV channel.
 * @property {pc.Vec2} clearCoatGlossMapTiling Controls the 2D tiling of the clear coat gloss map.
 * @property {pc.Vec2} clearCoatGlossMapOffset Controls the 2D offset of the clear coat gloss map. Each component is between 0 and 1.
 * @property {string} clearCoatGlossMapChannel Color channel of the clear coat gloss map to use. Can be "r", "g", "b" or "a".
 * @property {boolean} clearCoatGlossVertexColor Use mesh vertex colors for clear coat glossiness. If clearCoatGlossMap is set, it'll be multiplied by vertex colors.
 * @property {string} clearCoatGlossVertexColorChannel Vertex color channel to use for clear coat glossiness. Can be "r", "g", "b" or "a".
 * @property {pc.Texture|null} clearCoatNormalMap The clear coat normal map of the material (default is null). The texture must contains normalized, tangent space normals.
 * @property {number} clearCoatNormalMapUv Clear coat normal map UV channel.
 * @property {pc.Vec2} clearCoatNormalMapTiling Controls the 2D tiling of the main clear coat normal map.
 * @property {pc.Vec2} clearCoatNormalMapOffset Controls the 2D offset of the main clear coat normal map. Each component is between 0 and 1.
 * @property {number} clearCoatBumpiness The bumpiness of the clear coat layer. This value scales the assigned main clear coat normal map.
 * It should be normally between 0 (no bump mapping) and 1 (full bump mapping), but can be set to e.g. 2 to give even more pronounced bump effect.
 *
 * @property {boolean} useMetalness Use metalness properties instead of specular.
 * When enabled, diffuse colors also affect specular instead of the dedicated specular map.
 * This can be used as alternative to specular color to save space.
 * With metaless == 0, the pixel is assumed to be dielectric, and diffuse color is used as normal.
 * With metaless == 1, the pixel is fully metallic, and diffuse color is used as specular color instead.
 * @property {number} metalness Defines how much the surface is metallic. From 0 (dielectric) to 1 (metal).
 * @property {pc.Texture|null} metalnessMap Monochrome metalness map (default is null).
 * @property {number} metalnessMapUv Metalness map UV channel.
 * @property {pc.Vec2} metalnessMapTiling Controls the 2D tiling of the metalness map.
 * @property {pc.Vec2} metalnessMapOffset Controls the 2D offset of the metalness map. Each component is between 0 and 1.
 * @property {string} metalnessMapChannel Color channel of the metalness map to use. Can be "r", "g", "b" or "a".
 * @property {boolean} metalnessVertexColor Use mesh vertex colors for metalness. If metalnessMap is set, it'll be multiplied by vertex colors.
 * @property {string} metalnessVertexColorChannel Vertex color channel to use for metalness. Can be "r", "g", "b" or "a".
 *
 * @property {number} shininess Defines glossiness of the material from 0 (rough) to 100 (shiny mirror).
 * A higher shininess value results in a more focused specular highlight.
 * Glossiness map/vertex colors are always multiplied by this value (normalized to 0 - 1 range), or it is used directly as constant output.
 * @property {pc.Texture|null} glossMap Glossiness map (default is null). If specified, will be multiplied by normalized 'shininess' value and/or vertex colors.
 * @property {number} glossMapUv Gloss map UV channel.
 * @property {string} glossMapChannel Color channel of the gloss map to use. Can be "r", "g", "b" or "a".
 * @property {pc.Vec2} glossMapTiling Controls the 2D tiling of the gloss map.
 * @property {pc.Vec2} glossMapOffset Controls the 2D offset of the gloss map. Each component is between 0 and 1.
 * @property {boolean} glossVertexColor Use mesh vertex colors for glossiness. If glossMap is set, it'll be multiplied by vertex colors.
 * @property {string} glossVertexColorChannel Vertex color channel to use for glossiness. Can be "r", "g", "b" or "a".
 *
 * @property {number} refraction Defines the visibility of refraction. Material can refract the same cube map as used for reflections.
 * @property {number} refractionIndex Defines the index of refraction, i.e. The amount of distortion.
 * The value is calculated as (outerIor / surfaceIor), where inputs are measured indices of refraction, the one around the object and the one of it's own surface.
 * In most situations outer medium is air, so outerIor will be approximately 1. Then you only need to do (1.0 / surfaceIor).
 *
 * @property {pc.Color} emissive The emissive color of the material. This color value is 3-component (RGB),
 * where each component is between 0 and 1.
 * @property {boolean} emissiveTint Multiply emissive map and/or emissive vertex color by the constant emissive value.
 * @property {pc.Texture|null} emissiveMap The emissive map of the material (default is null). Can be HDR.
 * @property {number} emissiveIntensity Emissive color multiplier.
 * @property {number} emissiveMapUv Emissive map UV channel.
 * @property {pc.Vec2} emissiveMapTiling Controls the 2D tiling of the emissive map.
 * @property {pc.Vec2} emissiveMapOffset Controls the 2D offset of the emissive map. Each component is between 0 and 1.
 * @property {string} emissiveMapChannel Color channels of the emissive map to use. Can be "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} emissiveVertexColor Use mesh vertex colors for emission. If emissiveMap or emissiveTint are set, they'll be multiplied by vertex colors.
 * @property {string} emissiveVertexColorChannel Vertex color channels to use for emission. Can be "r", "g", "b", "a", "rgb" or any swizzled combination.
 *
 * @property {number} opacity The opacity of the material. This value can be between 0 and 1, where 0 is fully
 * transparent and 1 is fully opaque. If you want the material to be semi-transparent you also need to
 * set the {@link pc.Material#blendType} to pc.BLEND_NORMAL, pc.BLEND_ADDITIVE or any other mode.
 * Also note that for most semi-transparent objects you want {@link pc.Material#depthWrite} to be false, otherwise they can fully occlude objects behind them.
 * @property {pc.Texture|null} opacityMap The opacity map of the material (default is null).
 * @property {number} opacityMapUv Opacity map UV channel.
 * @property {string} opacityMapChannel Color channel of the opacity map to use. Can be "r", "g", "b" or "a".
 * @property {pc.Vec2} opacityMapTiling Controls the 2D tiling of the opacity map.
 * @property {pc.Vec2} opacityMapOffset Controls the 2D offset of the opacity map. Each component is between 0 and 1.
 * @property {boolean} opacityVertexColor Use mesh vertex colors for opacity. If opacityMap is set, it'll be multiplied by vertex colors.
 * @property {string} opacityVertexColorChannel Vertex color channels to use for opacity. Can be "r", "g", "b" or "a".
 *
 * @property {pc.Texture|null} normalMap The main (primary) normal map of the material (default is null).
 * The texture must contains normalized, tangent space normals.
 * @property {number} normalMapUv Main (primary) normal map UV channel.
 * @property {pc.Vec2} normalMapTiling Controls the 2D tiling of the main (primary) normal map.
 * @property {pc.Vec2} normalMapOffset Controls the 2D offset of the main (primary) normal map. Each component is between 0 and 1.
 * @property {number} bumpiness The bumpiness of the material. This value scales the assigned main (primary) normal map.
 * It should be normally between 0 (no bump mapping) and 1 (full bump mapping), but can be set to e.g. 2 to give even more pronounced bump effect.
 *
 * @property {pc.Texture|null} normalDetailMap The detail (secondary) normal map of the material (default is null). Will only be used if main (primary) normal map is non-null.
 * @property {number} normalDetailMapUv Detail (secondary) normal map UV channel.
 * @property {pc.Vec2} normalDetailMapTiling Controls the 2D tiling of the detail (secondary) normal map.
 * @property {pc.Vec2} normalDetailMapOffset Controls the 2D offset of the detail (secondary) normal map. Each component is between 0 and 1.
 * @property {number} normalDetailMapBumpiness The bumpiness of the material. This value scales the assigned detail (secondary) normal map.
 * It should be normally between 0 (no bump mapping) and 1 (full bump mapping), but can be set to e.g. 2 to give even more pronounced bump effect.
 *
 * @property {pc.Texture|null} heightMap The height map of the material (default is null). Used for a view-dependent parallax effect.
 * The texture must represent the height of the surface where darker pixels are lower and lighter pixels are higher.
 * It is recommended to use it together with a normal map.
 * @property {number} heightMapUv Height map UV channel.
 * @property {string} heightMapChannel Color channel of the height map to use. Can be "r", "g", "b" or "a".
 * @property {pc.Vec2} heightMapTiling Controls the 2D tiling of the height map.
 * @property {pc.Vec2} heightMapOffset Controls the 2D offset of the height map. Each component is between 0 and 1.
 * @property {number} heightMapFactor Height map multiplier. Affects the strength of the parallax effect.
 *
 * @property {pc.Texture|null} sphereMap The spherical environment map of the material (default is null). Affects reflections.
 * @property {pc.Texture|null} cubeMap The cubic environment map of the material (default is null). Overrides sphereMap. Affects reflections. If cubemap is prefiltered, will also affect ambient color.
 * @property {number} cubeMapProjection The type of projection applied to the cubeMap property:
 * * {@link pc.CUBEPROJ_NONE}: The cube map is treated as if it is infinitely far away.
 * * {@link pc.CUBEPROJ_BOX}: Box-projection based on a world space axis-aligned bounding box.
 * Defaults to pc.CUBEPROJ_NONE.
 * @property {pc.BoundingBox} cubeMapProjectionBox The world space axis-aligned bounding box defining the
 * box-projection used for the cubeMap property. Only used when cubeMapProjection is set to pc.CUBEPROJ_BOX.
 * @property {number} reflectivity Environment map intensity.
 *
 * @property {pc.Texture|null} lightMap A custom lightmap of the material (default is null). Lightmaps are textures that contain pre-rendered lighting. Can be HDR.
 * @property {number} lightMapUv Lightmap UV channel
 * @property {string} lightMapChannel Color channels of the lightmap to use. Can be "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {pc.Vec2} lightMapTiling Controls the 2D tiling of the lightmap.
 * @property {pc.Vec2} lightMapOffset Controls the 2D offset of the lightmap. Each component is between 0 and 1.
 * @property {boolean} lightVertexColor Use baked vertex lighting. If lightMap is set, it'll be multiplied by vertex colors.
 * @property {string} lightVertexColorChannel Vertex color channels to use for baked lighting. Can be "r", "g", "b", "a", "rgb" or any swizzled combination.
 *
 * @property {boolean} ambientTint Enables scene ambient multiplication by material ambient color.
 * @property {pc.Texture|null} aoMap Baked ambient occlusion (AO) map (default is null). Modulates ambient color.
 * @property {number} aoMapUv AO map UV channel
 * @property {string} aoMapChannel Color channel of the AO map to use. Can be "r", "g", "b" or "a".
 * @property {pc.Vec2} aoMapTiling Controls the 2D tiling of the AO map.
 * @property {pc.Vec2} aoMapOffset Controls the 2D offset of the AO map. Each component is between 0 and 1.
 * @property {boolean} aoVertexColor Use mesh vertex colors for AO. If aoMap is set, it'll be multiplied by vertex colors.
 * @property {string} aoVertexColorChannel Vertex color channels to use for AO. Can be "r", "g", "b" or "a".
 * @property {number} occludeSpecular Uses ambient occlusion to darken specular/reflection. It's a hack, because real specular occlusion is view-dependent. However, it can be better than nothing.
 * * {@link pc.SPECOCC_NONE}: No specular occlusion
 * * {@link pc.SPECOCC_AO}: Use AO directly to occlude specular.
 * * {@link pc.SPECOCC_GLOSSDEPENDENT}: Modify AO based on material glossiness/view angle to occlude specular.
 * @property {number} occludeSpecularIntensity Controls visibility of specular occlusion.
 * @property {number} occludeDirect Tells if AO should darken directional lighting.
 *
 * @property {boolean} specularAntialias Enables Toksvig AA for mipmapped normal maps with specular.
 * @property {boolean} conserveEnergy Defines how diffuse and specular components are combined when Fresnel is on.
 * It is recommended that you leave this option enabled, although you may want to disable it in case when all reflection comes only from a few light sources, and you don't use an environment map, therefore having mostly black reflection.
 * @property {number} shadingModel Defines the shading model.
 * * {@link pc.SPECULAR_PHONG}: Phong without energy conservation. You should only use it as a backwards compatibility with older projects.
 * * {@link pc.SPECULAR_BLINN}: Energy-conserving Blinn-Phong.
 * @property {number} fresnelModel Defines the formula used for Fresnel effect.
 * As a side-effect, enabling any Fresnel model changes the way diffuse and reflection components are combined.
 * When Fresnel is off, legacy non energy-conserving combining is used. When it is on, combining behavior is defined by conserveEnergy parameter.
 * * {@link pc.FRESNEL_NONE}: No Fresnel.
 * * {@link pc.FRESNEL_SCHLICK}: Schlick's approximation of Fresnel (recommended). Parameterized by specular color.
 * @property {boolean} useFog Apply fogging (as configured in scene settings)
 * @property {boolean} useLighting Apply lighting
 * @property {boolean} useSkybox Apply scene skybox as prefiltered environment map
 * @property {boolean} useGammaTonemap Apply gamma correction and tonemapping (as configured in scene settings)
 * @property {boolean} pixelSnap Align vertices to pixel co-ordinates when rendering. Useful for pixel perfect 2D graphics
 * @property {boolean} twoSidedLighting Calculate proper normals (and therefore lighting) on backfaces
 * @property {object} chunks Object containing custom shader chunks that will replace default ones.
 *
 * @property {pc.callbacks.UpdateShader} onUpdateShader A custom function that will be called after all shader generator properties are collected and before shader code is generated.
 * This function will receive an object with shader generator settings (based on current material and scene properties), that you can change and then return.
 * Returned value will be used instead. This is mostly useful when rendering the same set of objects, but with different shader variations based on the same material.
 * For example, you may wish to render a depth or normal pass using textures assigned to the material, a reflection pass with simpler shaders and so on.
 * Properties of the object passed into this function are:
 * * pass: value of {@link pc.Layer#shaderPass} of the Layer being rendered.
 * * chunks: Object containing custom shader chunks that will replace default ones.
 * * customFragmentShader: Completely replace fragment shader with this code.
 * * forceUv1: if UV1 (second set of texture coordinates) is required in the shader. Will be declared as "vUv1" and passed to the fragment shader.
 * * fog: the type of fog being applied in the shader. See {@link pc.Scene#fog} for the list of possible values.
 * * gamma: the type of gamma correction being applied in the shader. See {@link pc.Scene#gammaCorrection} for the list of possible values.
 * * toneMap: the type of tone mapping being applied in the shader. See {@link pc.Scene#toneMapping} for the list of possible values.
 * * ambientTint: the value of {@link pc.StandardMaterial#ambientTint}.
 * * specularAntialias: the value of {@link pc.StandardMaterial#specularAntialias}.
 * * conserveEnergy: the value of {@link pc.StandardMaterial#conserveEnergy}.
 * * occludeSpecular: the value of {@link pc.StandardMaterial#occludeSpecular}.
 * * occludeDirect: the value of {@link pc.StandardMaterial#occludeDirect}.
 * * shadingModel: the value of {@link pc.StandardMaterial#shadingModel}.
 * * fresnelModel: the value of {@link pc.StandardMaterial#fresnelModel}.
 * * cubeMapProjection: the value of {@link pc.StandardMaterial#cubeMapProjection}.
 * * useMetalness: the value of {@link pc.StandardMaterial#useMetalness}.
 * * blendType: the value of {@link pc.Material#blendType}.
 * * twoSidedLighting: the value of {@link pc.Material#twoSidedLighting}.
 * * diffuseTint: defines if {@link pc.StandardMaterial#diffuse} constant should affect diffuse color.
 * * specularTint: defines if {@link pc.StandardMaterial#specular} constant should affect specular color.
 * * metalnessTint: defines if {@link pc.StandardMaterial#metalness} constant should affect metalness value.
 * * glossTint: defines if {@link pc.StandardMaterial#shininess} constant should affect glossiness value.
 * * emissiveTint: defines if {@link pc.StandardMaterial#emissive} constant should affect emission value.
 * * opacityTint: defines if {@link pc.StandardMaterial#opacity} constant should affect opacity value.
 * * occludeSpecularFloat: defines if {@link pc.StandardMaterial#occludeSpecularIntensity} constant should affect specular occlusion.
 * * alphaTest: enable alpha testing. See {@link pc.Material#alphaTest}.
 * * alphaToCoverage: enable alpha to coverage. See {@link pc.Material#alphaToCoverage}.
 * * sphereMap: if {@link pc.StandardMaterial#sphereMap} is used.
 * * cubeMap: if {@link pc.StandardMaterial#cubeMap} is used.
 * * dpAtlas: if dual-paraboloid reflection is used. Dual paraboloid reflections replace prefiltered cubemaps on certain platform (mostly Android) for performance reasons.
 * * ambientSH: if ambient spherical harmonics are used. Ambient SH replace prefiltered cubemap ambient on certain platform (mostly Android) for performance reasons.
 * * useSpecular: if any specular or reflections are needed at all.
 * * rgbmAmbient: if ambient cubemap or spherical harmonics are RGBM-encoded.
 * * hdrAmbient: if ambient cubemap or spherical harmonics are plain float HDR data.
 * * rgbmReflection: if reflection cubemap or dual paraboloid are RGBM-encoded.
 * * hdrReflection: if reflection cubemap or dual paraboloid are plain float HDR data.
 * * fixSeams: if cubemaps require seam fixing (see {@link pc.Texture#options.fixCubemapSeams}).
 * * prefilteredCubemap: if prefiltered cubemaps are used.
 * * emissiveFormat: how emissiveMap must be sampled. This value is based on {@link pc.Texture#options.rgbm} and {@link pc.Texture#options.format}. Possible values are:
 *   * 0: sRGB texture
 *   * 1: RGBM-encoded HDR texture
 *   * 2: Simple read (no conversion from sRGB)
 * * lightMapFormat: how lightMap must be sampled. This value is based on {@link pc.Texture#options.rgbm} and {@link pc.Texture#options.format}. Possible values are:
 *   * 0: sRGB texture
 *   * 1: RGBM-encoded HDR texture
 *   * 2: Simple read (no conversion from sRGB)
 * * useRgbm: if decodeRGBM() function is needed in the shader at all.
 * * packedNormal: if normal map contains X in RGB, Y in Alpha, and Z must be reconstructed.
 * * forceFragmentPrecision: Override fragment shader numeric precision. Can be "lowp", "mediump", "highp" or null to use default.
 * * fastTbn: Use slightly cheaper normal mapping code (skip tangent space normalization). Can look buggy sometimes.
 * * refraction: if refraction is used.
 * * skyboxIntensity: if reflected skybox intensity should be modulated.
 * * useTexCubeLod: if textureCubeLodEXT function should be used to read prefiltered cubemaps. Usually true of iOS, false on other devices due to quality/performance balance.
 * * useInstancing: if hardware instancing compatible shader should be generated. Transform is read from per-instance {@link pc.VertexBuffer} instead of shader's uniforms.
 * * useMorphPosition: if morphing code should be generated to morph positions.
 * * useMorphNormal: if morphing code should be generated to morph normals.
 * @example
 * // Create a new Standard material
 * var material = new pc.StandardMaterial();
 *
 * // Update the material's diffuse and specular properties
 * material.diffuse.set(1, 0, 0);
 * material.specular.set(1, 1, 1);
 *
 * // Notify the material that it has been modified
 * material.update();
 */
function StandardMaterial() {
    Material.call(this);

    // storage for texture and cubemap asset references
    this._assetReferences = {};
    this._validator = null;

    this.shaderOptBuilder = new StandardMaterialOptionsBuilder();

    this.reset();
}
StandardMaterial.prototype = Object.create(Material.prototype);
StandardMaterial.prototype.constructor = StandardMaterial;

StandardMaterial.TEXTURE_PARAMETERS = standardMaterialTextureParameters;
StandardMaterial.CUBEMAP_PARAMETERS = standardMaterialCubemapParameters;

var _propsSerial = [];
var _propsSerialDefaultVal = [];
var _propsInternalNull = [];
var _propsInternalVec3 = [];
var _prop2Uniform = {};

var _defineTex2D = function (obj, name, uv, channels, defChannel, vertexColor, detailMode) {
    var privMap = "_" + name + "Map";
    var privMapTiling = privMap + "Tiling";
    var privMapOffset = privMap + "Offset";
    var mapTransform = privMap.substring(1) + "Transform";
    var mapTransformUniform = mapTransform + "Uniform";
    var privMapUv = privMap + "Uv";
    var privMapChannel = privMap + "Channel";
    var privMapVertexColor = "_" + name + "VertexColor";
    var privMapVertexColorChannel = "_" + name + "VertexColorChannel";
    var privMapDetailMode = "_" + name + "Mode";

    obj[privMap] = null;
    obj[privMapTiling] = new Vec2(1, 1);
    obj[privMapOffset] = new Vec2(0, 0);
    obj[mapTransform] = null;
    obj[mapTransformUniform] = null;
    obj[privMapUv] = uv;
    if (channels > 0) {
        var channel = defChannel ? defChannel : (channels > 1 ? "rgb" : "g");
        obj[privMapChannel] = channel;
        if (vertexColor) obj[privMapVertexColorChannel] = channel;
    }
    if (vertexColor) obj[privMapVertexColor] = false;
    if (detailMode) obj[privMapDetailMode] = DETAILMODE_MUL;

    _matTex2D[name] = channels;

    Object.defineProperty(StandardMaterial.prototype, privMap.substring(1), {
        get: function () {
            return this[privMap];
        },
        set: function (value) {
            var oldVal = this[privMap];
            if (!!oldVal ^ !!value) this.dirtyShader = true;
            if (oldVal && value) {
                if (oldVal.type !== value.type || oldVal.fixCubemapSeams !== value.fixCubemapSeams || oldVal.format !== value.format) {
                    this.dirtyShader = true;
                }
            }

            this[privMap] = value;
        }
    });

    var mapTiling = privMapTiling.substring(1);
    var mapOffset = privMapOffset.substring(1);

    Object.defineProperty(StandardMaterial.prototype, mapTiling, {
        get: function () {
            return this[privMapTiling];
        },
        set: function (value) {
            this.dirtyShader = true;
            this[privMapTiling] = value;
        }
    });
    _prop2Uniform[mapTiling] = function (mat, val, changeMat) {
        var tform = mat._updateMapTransform(
            changeMat ? mat[mapTransform] : null,
            val,
            mat[privMapOffset]
        );
        return { name: ("texture_" + mapTransform), value: tform.data };
    };

    Object.defineProperty(StandardMaterial.prototype, mapOffset, {
        get: function () {
            return this[privMapOffset];
        },
        set: function (value) {
            this.dirtyShader = true;
            this[privMapOffset] = value;
        }
    });
    _prop2Uniform[mapOffset] = function (mat, val, changeMat) {
        var tform = mat._updateMapTransform(
            changeMat ? mat[mapTransform] : null,
            mat[privMapTiling],
            val
        );
        return { name: ("texture_" + mapTransform), value: tform.data };
    };

    Object.defineProperty(StandardMaterial.prototype, privMapUv.substring(1), {
        get: function () {
            return this[privMapUv];
        },
        set: function (value) {
            if (this[privMapUv] !== value) this.dirtyShader = true;
            this[privMapUv] = value;
        }
    });
    Object.defineProperty(StandardMaterial.prototype, privMapChannel.substring(1), {
        get: function () {
            return this[privMapChannel];
        },
        set: function (value) {
            if (this[privMapChannel] !== value) this.dirtyShader = true;
            this[privMapChannel] = value;
        }
    });

    if (vertexColor) {
        Object.defineProperty(StandardMaterial.prototype, privMapVertexColor.substring(1), {
            get: function () {
                return this[privMapVertexColor];
            },
            set: function (value) {
                this.dirtyShader = true;
                this[privMapVertexColor] = value;
            }
        });
        Object.defineProperty(StandardMaterial.prototype, privMapVertexColorChannel.substring(1), {
            get: function () {
                return this[privMapVertexColorChannel];
            },
            set: function (value) {
                if (this[privMapVertexColorChannel] !== value) this.dirtyShader = true;
                this[privMapVertexColorChannel] = value;
            }
        });
    }

    if (detailMode) {
        Object.defineProperty(StandardMaterial.prototype, privMapDetailMode.substring(1), {
            get: function () {
                return this[privMapDetailMode];
            },
            set: function (value) {
                this.dirtyShader = true;
                this[privMapDetailMode] = value;
            }
        });
    }

    _propsSerial.push(privMap.substring(1));
    _propsSerial.push(privMapTiling.substring(1));
    _propsSerial.push(privMapOffset.substring(1));
    _propsSerial.push(privMapUv.substring(1));
    _propsSerial.push(privMapChannel.substring(1));
    if (vertexColor) {
        _propsSerial.push(privMapVertexColor.substring(1));
        _propsSerial.push(privMapVertexColorChannel.substring(1));
    }
    if (detailMode) {
        _propsSerial.push(privMapDetailMode.substring(1));
    }
    _propsInternalNull.push(mapTransform);
};

var _propsColor = [];
var _defineColor = function (obj, name, defaultValue, hasMultiplier) {
    var priv = "_" + name;
    var uform = name + "Uniform";
    var mult = name + "Intensity";
    var pmult = "_" + mult;
    obj[priv] = defaultValue;
    obj[uform] = new Float32Array(3);
    Object.defineProperty(StandardMaterial.prototype, name, {
        get: function () {
            this.dirtyColor = true;
            this.dirtyShader = true;
            return this[priv];
        },
        set: function (newValue) {
            var oldValue = this[priv];
            var wasRound = (oldValue.r === 0 && oldValue.g === 0 && oldValue.b === 0) || (oldValue.r === 1 && oldValue.g === 1 && oldValue.b === 1);
            var isRound = (newValue.r === 0 && newValue.g === 0 && newValue.b === 0) || (newValue.r === 1 && newValue.g === 1 && newValue.b === 1);
            if (wasRound ^ isRound) this.dirtyShader = true;
            this.dirtyColor = true;
            this[priv] = newValue;
        }
    });
    _propsSerial.push(name);
    _propsInternalVec3.push(uform);
    _propsColor.push(name);
    _prop2Uniform[name] = function (mat, val, changeMat) {
        var arr = changeMat ? mat[uform] : new Float32Array(3);
        var gammaCorrection = false;
        if (mat.useGammaTonemap) {
            var scene = mat._scene || Application.getApplication().scene;
            gammaCorrection = scene.gammaCorrection;
        }
        for (var c = 0; c < 3; c++) {
            if (gammaCorrection) {
                arr[c] = Math.pow(val.data[c], 2.2);
            } else {
                arr[c] = val.data[c];
            }
            if (hasMultiplier) arr[c] *= mat[pmult];
        }
        return { name: ("material_" + name), value: arr };
    };

    if (hasMultiplier) {
        obj[pmult] = 1;
        Object.defineProperty(StandardMaterial.prototype, mult, {
            get: function () {
                return this[pmult];
            },
            set: function (newValue) {
                var oldValue = this[pmult];
                var wasRound = oldValue === 0 || oldValue === 1;
                var isRound = newValue === 0 || newValue === 1;
                if (wasRound ^ isRound) this.dirtyShader = true;
                this.dirtyColor = true;
                this[pmult] = newValue;
            }
        });
        _propsSerial.push(mult);
        _prop2Uniform[mult] = function (mat, val, changeMat) {
            var arr = changeMat ? mat[uform] : new Float32Array(3);
            var gammaCorrection = false;
            if (mat.useGammaTonemap) {
                var scene = mat._scene || Application.getApplication().scene;
                gammaCorrection = scene.gammaCorrection;
            }
            for (var c = 0; c < 3; c++) {
                if (gammaCorrection) {
                    arr[c] = Math.pow(mat[priv].data[c], 2.2);
                } else {
                    arr[c] = mat[priv].data[c];
                }
                arr[c] *= mat[pmult];
            }
            return { name: ("material_" + name), value: arr };
        };
    }
};

var _defineFloat = function (obj, name, defaultValue, func) {
    var priv = "_" + name;
    obj[priv] = defaultValue;
    Object.defineProperty(StandardMaterial.prototype, name, {
        get: function () {
            return this[priv];
        },
        set: function (newValue) {
            var oldValue = this[priv];
            if (oldValue === newValue) return;
            this[priv] = newValue;

           // This is not always optimal and will sometimes trigger redundant shader
           // recompilation. However, no number property on a standard material
           // triggers a shader recompile if the previous and current values both
           // have a fractional part.
            var wasRound = oldValue === 0 || oldValue === 1;
            var isRound = newValue === 0 || newValue === 1;
            if (wasRound || isRound) this.dirtyShader = true;
        }
    });
    _propsSerial.push(name);
    _prop2Uniform[name] = func !== undefined ? func : function (mat, val, changeMat) {
        return {
            name: "material_" + name,
            value: val
        };
    };
};

var _defineObject = function (obj, name, func) {
    var priv = "_" + name;
    obj[priv] = null;
    Object.defineProperty(StandardMaterial.prototype, name, {
        get: function () {
            return this[priv];
        },
        set: function (value) {
            var oldVal = this[priv];
            if (!!oldVal ^ !!value) this.dirtyShader = true;
            this[priv] = value;
        }
    });
    _propsSerial.push(name);
    _prop2Uniform[name] = func;
};

var _defineAlias = function (obj, newName, oldName) {
    Object.defineProperty(StandardMaterial.prototype, oldName, {
        get: function () {
            return this[newName];
        },
        set: function (value) {
            this[newName] = value;
        }
    });
};

var _defineChunks = function (obj) {
    Object.defineProperty(StandardMaterial.prototype, "chunks", {
        get: function () {
            this.dirtyShader = true;
            return this._chunks;
        },
        set: function (value) {
            this.dirtyShader = true;
            this._chunks = value;
        }
    });
    _propsSerial.push("chunks");
};

var _defineFlag = function (obj, name, defaultValue) {
    var priv = "_" + name;
    obj[priv] = defaultValue;
    Object.defineProperty(StandardMaterial.prototype, name, {
        get: function () {
            return this[priv];
        },
        set: function (value) {
            if (this[priv] !== value) this.dirtyShader = true;
            this[priv] = value;
        }
    });
    _propsSerial.push(name);
};

var Chunks = function () { };
Chunks.prototype.copy = function (from) {
    for (var p in from) {
        if (from.hasOwnProperty(p) && p !== 'copy')
            this[p] = from[p];
    }
};

Object.assign(StandardMaterial.prototype, {

    reset: function () {
        var i;
        for (i = 0; i < _propsSerial.length; i++) {
            var defVal = _propsSerialDefaultVal[i];
            this[_propsSerial[i]] = defVal ? (defVal.clone ? defVal.clone() : defVal) : defVal;
        }
        for (i = 0; i < _propsInternalNull.length; i++) {
            this[_propsInternalNull[i]] = null;
        }
        for (i = 0; i < _propsInternalVec3.length; i++) {
            this[_propsInternalVec3[i]] = new Float32Array(3);
        }

        this._chunks = new Chunks();

        this.cubeMapMinUniform = new Float32Array(3);
        this.cubeMapMaxUniform = new Float32Array(3);
    },


   /**
    * @function
    * @name pc.StandardMaterial#clone
    * @description Duplicates a Standard material. All properties are duplicated except textures
    * where only the references are copied.
    * @returns {pc.StandardMaterial} A cloned Standard material.
    */
    clone: function () {
        var clone = new StandardMaterial();
        Material.prototype._cloneInternal.call(this, clone);

        var pname;
        for (var i = 0; i < _propsSerial.length; i++) {
            pname = _propsSerial[i];
            if (this[pname] !== undefined) {
                if (this[pname] && this[pname].copy) {
                    if (clone[pname]) {
                        clone[pname].copy(this[pname]);
                    } else {
                        clone[pname] = this[pname].clone();
                    }
                } else {
                    clone[pname] = this[pname];
                }
            }
        }

        return clone;
    },

    _updateMapTransform: function (transform, tiling, offset) {
        if (tiling.x === 1 && tiling.y === 1 && offset.x === 0 && offset.y === 0) {
            return null;
        }

        transform = transform || new Vec4();
        transform.set(tiling.x, tiling.y, offset.x, offset.y);
        return transform;
    },

    _setParameter: function (name, value) {
        if (!this.parameters[name])
            this._propsSet.push(name);
        this.setParameter(name, value);
    },

    _clearParameters: function () {
        var props = this._propsSet;
        for (var i = 0; i < props.length; i++) {
            delete this.parameters[props[i]];
        }
        this._propsSet = [];
    },

    _updateMap: function (p) {
        var mname = p + "Map";
        var map = this[mname];
        if (map) {
            this._setParameter("texture_" + mname, map);

            // update transform
            var tname = mname + "Transform";
            this[tname] = this._updateMapTransform(
                this[tname],
                this[mname + "Tiling"],
                this[mname + "Offset"]
            );

            // update uniform
            var transform = this[tname];
            if (transform) {
                var uname = mname + "TransformUniform";
                var uniform = this[uname];
                if (!uniform) {
                    uniform = new Float32Array(4);
                    this[uname] = uniform;
                }
                uniform[0] = transform.x;
                uniform[1] = transform.y;
                uniform[2] = transform.z;
                uniform[3] = transform.w;
                this._setParameter('texture_' + tname, uniform);
            }
        }
    },

    getUniform: function (varName, value, changeMat) {
        var func = _prop2Uniform[varName];
        if (func) {
            return func(this, value, changeMat);
        }
        return null;
    },

    updateUniforms: function () {
        var uniform;
        this._clearParameters();

        this._setParameter('material_ambient', this.ambientUniform);

        if (!this.diffuseMap || this.diffuseTint) {
            this._setParameter('material_diffuse', this.diffuseUniform);
        }

        if (!this.useMetalness) {
            if (!this.specularMap || this.specularTint) {
                this._setParameter('material_specular', this.specularUniform);
            }
        } else {
            if (!this.metalnessMap || this.metalness < 1) {
                this._setParameter('material_metalness', this.metalness);
            }

            if (this.enableGGXSpecular){
                this._setParameter('material_anisotropy', this.anisotropy);
            }
        }

        if (this.clearCoat > 0) {
            this._setParameter('material_clearCoat', this.clearCoat);
            this._setParameter('material_clearCoatGlossiness', this.clearCoatGlossiness);
            this._setParameter('material_clearCoatReflectivity', this.clearCoat); // for now don't separate this
            this._setParameter('material_clearCoatBumpiness', this.clearCoatBumpiness);
        }

        uniform = this.getUniform("shininess", this.shininess, true);
        this._setParameter(uniform.name, uniform.value);

        if (!this.emissiveMap || this.emissiveTint) {
            this._setParameter('material_emissive', this.emissiveUniform);
        }
        if (this.emissiveMap) {
            this._setParameter('material_emissiveIntensity', this.emissiveIntensity);
        }

        if (this.refraction > 0) {
            this._setParameter('material_refraction', this.refraction);
            this._setParameter('material_refractionIndex', this.refractionIndex);
        }

        this._setParameter('material_opacity', this.opacity);

        if (this.occludeSpecular) {
            this._setParameter('material_occludeSpecularIntensity', this.occludeSpecularIntensity);
        }

        if (this.cubeMapProjection === CUBEPROJ_BOX) {
            this._setParameter(this.getUniform("cubeMapProjectionBox", this.cubeMapProjectionBox, true));
        }

        for (var p in _matTex2D) {
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
            uniform = this.getUniform('heightMapFactor', this.heightMapFactor, true);
            this._setParameter(uniform.name, uniform.value);
        }

        if (this.cubeMap) {
            this._setParameter('texture_cubeMap', this.cubeMap);
        }

        if (this.prefilteredCubeMap128) {
            this._setParameter('texture_prefilteredCubeMap128', this.prefilteredCubeMap128);
        } else if (this._scene && this._scene._skyboxPrefiltered[0]) {
            this._setParameter('texture_prefilteredCubeMap128', this._scene._skyboxPrefiltered[0]);
        }

        if (this.prefilteredCubeMap64) {
            this._setParameter('texture_prefilteredCubeMap64', this.prefilteredCubeMap64);
        } else if (this._scene && this._scene._skyboxPrefiltered[1]) {
            this._setParameter('texture_prefilteredCubeMap64', this._scene._skyboxPrefiltered[1]);
        }

        if (this.prefilteredCubeMap32) {
            this._setParameter('texture_prefilteredCubeMap32', this.prefilteredCubeMap32);
        } else if (this._scene && this._scene._skyboxPrefiltered[2]) {
            this._setParameter('texture_prefilteredCubeMap32', this._scene._skyboxPrefiltered[2]);
        }

        if (this.prefilteredCubeMap16) {
            this._setParameter('texture_prefilteredCubeMap16', this.prefilteredCubeMap16);
        } else if (this._scene && this._scene._skyboxPrefiltered[3]) {
            this._setParameter('texture_prefilteredCubeMap16', this._scene._skyboxPrefiltered[3]);
        }

        if (this.prefilteredCubeMap8) {
            this._setParameter('texture_prefilteredCubeMap8', this.prefilteredCubeMap8);
        } else if (this._scene && this._scene._skyboxPrefiltered[4]) {
            this._setParameter('texture_prefilteredCubeMap8', this._scene._skyboxPrefiltered[4]);
        }

        if (this.prefilteredCubeMap4) {
            this._setParameter('texture_prefilteredCubeMap4', this.prefilteredCubeMap4);
        } else if (this._scene && this._scene._skyboxPrefiltered[5]) {
            this._setParameter('texture_prefilteredCubeMap4', this._scene._skyboxPrefiltered[5]);
        }

        if (this.sphereMap) {
            this._setParameter('texture_sphereMap', this.sphereMap);
        }
        if (this.dpAtlas) {
            this._setParameter('texture_sphereMap', this.dpAtlas);
        }
       // if (this.sphereMap || this.cubeMap || this.prefilteredCubeMap128) {
        this._setParameter('material_reflectivity', this.reflectivity);
       // }

        if (this.dirtyShader || !this._scene) {
            this.shader = null;
            this.clearVariants();
        }

        this._processColor();
    },

    _processColor: function () {
        var c, i;
        if (!this.dirtyColor) return;
        if (!this._scene && this.useGammaTonemap) return;
        var gammaCorrection = false;
        if (this.useGammaTonemap) gammaCorrection = this._scene.gammaCorrection;

       // Gamma correct colors
        for (i = 0; i < _propsColor.length; i++) {
            var clr = this["_" + _propsColor[i]];
            var arr = this[_propsColor[i] + "Uniform"];
            if (gammaCorrection) {
                arr[0] = Math.pow(clr.r, 2.2);
                arr[1] = Math.pow(clr.g, 2.2);
                arr[2] = Math.pow(clr.b, 2.2);
            } else {
                arr[0] = clr.r;
                arr[1] = clr.g;
                arr[2] = clr.b;
            }
        }
        for (c = 0; c < 3; c++) {
            this.emissiveUniform[c] *= this.emissiveIntensity;
        }
        this.dirtyColor = false;
    },

    updateShader: function (device, scene, objDefs, staticLightList, pass, sortedLights) {

        if (!this._colorProcessed && this._scene) {
            this._colorProcessed = true;
            this._processColor();
        }

        var useTexCubeLod = device.useTexCubeLod;
        var useDp = !device.extTextureLod; // no basic extension? likely slow device, force dp

        var globalSky128, globalSky64, globalSky32, globalSky16, globalSky8, globalSky4;
        if (this.useSkybox) {
            globalSky128 = scene._skyboxPrefiltered[0];
            globalSky64 = scene._skyboxPrefiltered[1];
            globalSky32 = scene._skyboxPrefiltered[2];
            globalSky16 = scene._skyboxPrefiltered[3];
            globalSky8 = scene._skyboxPrefiltered[4];
            globalSky4 = scene._skyboxPrefiltered[5];
        }

        var prefilteredCubeMap128 = this.prefilteredCubeMap128 || globalSky128;
        var prefilteredCubeMap64 = this.prefilteredCubeMap64 || globalSky64;
        var prefilteredCubeMap32 = this.prefilteredCubeMap32 || globalSky32;
        var prefilteredCubeMap16 = this.prefilteredCubeMap16 || globalSky16;
        var prefilteredCubeMap8 = this.prefilteredCubeMap8 || globalSky8;
        var prefilteredCubeMap4 = this.prefilteredCubeMap4 || globalSky4;

        if (prefilteredCubeMap128) {
            var allMips = prefilteredCubeMap128 &&
                         prefilteredCubeMap64 &&
                         prefilteredCubeMap32 &&
                         prefilteredCubeMap16 &&
                         prefilteredCubeMap8 &&
                         prefilteredCubeMap4;

            if (useDp && allMips) {
                if (!prefilteredCubeMap128.dpAtlas) {
                    var atlas = [prefilteredCubeMap128, prefilteredCubeMap64, prefilteredCubeMap32,
                        prefilteredCubeMap16, prefilteredCubeMap8, prefilteredCubeMap4];
                    prefilteredCubeMap128.dpAtlas = generateDpAtlas(device, atlas);
                    prefilteredCubeMap128.sh = shFromCubemap(prefilteredCubeMap16);
                }
                this.dpAtlas = prefilteredCubeMap128.dpAtlas;
                this.ambientSH = prefilteredCubeMap128.sh;
                this._setParameter('ambientSH[0]', this.ambientSH);
                this._setParameter('texture_sphereMap', this.dpAtlas);
            } else if (useTexCubeLod) {
                if (prefilteredCubeMap128._levels.length < 6) {
                    if (allMips) {
                       // Multiple -> single (provided cubemap per mip, but can use texCubeLod)
                        this._setParameter('texture_prefilteredCubeMap128', prefilteredCubeMap128);
                    } else {
                        console.log("Can't use prefiltered cubemap: " + allMips + ", " + useTexCubeLod + ", " + prefilteredCubeMap128._levels);
                    }
                } else {
                   // Single (able to use single cubemap with texCubeLod)
                    this._setParameter('texture_prefilteredCubeMap128', prefilteredCubeMap128);
                }
            } else if (allMips) {
               // Multiple (no texCubeLod, but able to use cubemap per mip)
                this._setParameter('texture_prefilteredCubeMap128', prefilteredCubeMap128);
                this._setParameter('texture_prefilteredCubeMap64', prefilteredCubeMap64);
                this._setParameter('texture_prefilteredCubeMap32', prefilteredCubeMap32);
                this._setParameter('texture_prefilteredCubeMap16', prefilteredCubeMap16);
                this._setParameter('texture_prefilteredCubeMap8', prefilteredCubeMap8);
                this._setParameter('texture_prefilteredCubeMap4', prefilteredCubeMap4);
            } else {
                console.log("Can't use prefiltered cubemap: " + allMips + ", " + useTexCubeLod + ", " + prefilteredCubeMap128._levels);
            }
        }

        // Minimal options for Depth and Shadow passes
        var minimalOptions = pass > SHADER_FORWARDHDR && pass <= SHADER_PICK;
        var options = minimalOptions ? standard.optionsContextMin : standard.optionsContext;

        if (minimalOptions)
            this.shaderOptBuilder.updateMinRef(options, device, scene, this, objDefs, staticLightList, pass, sortedLights, prefilteredCubeMap128);
        else
            this.shaderOptBuilder.updateRef(options, device, scene, this, objDefs, staticLightList, pass, sortedLights, prefilteredCubeMap128);

        if (this.onUpdateShader) {
            options = this.onUpdateShader(options);
        }

        var library = device.getProgramLibrary();
        this.shader = library.getProgram('standard', options);

        if (!objDefs) {
            this.clearVariants();
            this.variants[0] = this.shader;
        }

        this.dirtyShader = false;
    }
});

var _defineMaterialProps = function (obj) {

    obj.dirtyShader = true;
    obj.dirtyColor = true;
    obj._scene = null;
    obj._colorProcessed = false;

    _defineColor(obj, "ambient", new Color(0.7, 0.7, 0.7));
    _defineColor(obj, "diffuse", new Color(1, 1, 1));
    _defineColor(obj, "specular", new Color(0, 0, 0));
    _defineColor(obj, "emissive", new Color(0, 0, 0), true);

    _defineFloat(obj, "shininess", 25, function (mat, shininess) {
       // Shininess is 0-100 value
       // which is actually a 0-1 glossiness value.
       // Can be converted to specular power using exp2(shininess * 0.01 * 11)
        var value;
        if (mat.shadingModel === SPECULAR_PHONG) {
            value = Math.pow(2, shininess * 0.01 * 11); // legacy: expand back to specular power
        } else {
            value = shininess * 0.01; // correct
        }
        return { name: "material_shininess", value: value };
    });
    _defineFloat(obj, "heightMapFactor", 1, function (mat, height) {
        return { name: 'material_heightMapFactor', value: height * 0.025 };
    });
    _defineFloat(obj, "opacity", 1);
    _defineFloat(obj, "alphaTest", 0);
    _defineFloat(obj, "bumpiness", 1);
    _defineFloat(obj, "normalDetailMapBumpiness", 1);
    _defineFloat(obj, "reflectivity", 1);
    _defineFloat(obj, "occludeSpecularIntensity", 1);
    _defineFloat(obj, "refraction", 0);
    _defineFloat(obj, "refractionIndex", 1.0 / 1.5); // approx. (air ior / glass ior)
    _defineFloat(obj, "metalness", 1);
    _defineFloat(obj, "anisotropy", 0);
    _defineFloat(obj, "clearCoat", 0);
    _defineFloat(obj, "clearCoatGlossiness", 1);
    _defineFloat(obj, "clearCoatBumpiness", 1);
    _defineFloat(obj, "aoUvSet", 0, null); // legacy

    _defineObject(obj, "ambientSH", function (mat, val, changeMat) {
        return { name: "ambientSH[0]", value: val };
    });

    _defineObject(obj, "cubeMapProjectionBox", function (mat, val, changeMat) {
        var bmin = changeMat ? mat.cubeMapMinUniform : new Float32Array(3);
        var bmax = changeMat ? mat.cubeMapMaxUniform : new Float32Array(3);

        bmin[0] = val.center.x - val.halfExtents.x;
        bmin[1] = val.center.y - val.halfExtents.y;
        bmin[2] = val.center.z - val.halfExtents.z;

        bmax[0] = val.center.x + val.halfExtents.x;
        bmax[1] = val.center.y + val.halfExtents.y;
        bmax[2] = val.center.z + val.halfExtents.z;

        return [{ name: "envBoxMin", value: bmin }, { name: "envBoxMax", value: bmax }];
    });

    _defineChunks(obj);

    _defineFlag(obj, "ambientTint", false);

    _defineFlag(obj, "diffuseTint", false);
    _defineFlag(obj, "specularTint", false);
    _defineFlag(obj, "emissiveTint", false);
    _defineFlag(obj, "fastTbn", false);
    _defineFlag(obj, "specularAntialias", false);
    _defineFlag(obj, "useMetalness", false);
    _defineFlag(obj, "enableGGXSpecular", false);
    _defineFlag(obj, "occludeDirect", false);
    _defineFlag(obj, "normalizeNormalMap", true);
    _defineFlag(obj, "conserveEnergy", true);
    _defineFlag(obj, "occludeSpecular", SPECOCC_AO);
    _defineFlag(obj, "shadingModel", SPECULAR_BLINN);
    _defineFlag(obj, "fresnelModel", FRESNEL_NONE);
    _defineFlag(obj, "cubeMapProjection", CUBEPROJ_NONE);
    _defineFlag(obj, "customFragmentShader", null);
    _defineFlag(obj, "forceFragmentPrecision", null);
    _defineFlag(obj, "useFog", true);
    _defineFlag(obj, "useLighting", true);
    _defineFlag(obj, "useGammaTonemap", true);
    _defineFlag(obj, "useSkybox", true);
    _defineFlag(obj, "forceUv1", false);
    _defineFlag(obj, "pixelSnap", false);
    _defineFlag(obj, "twoSidedLighting", false);
    _defineFlag(obj, "nineSlicedMode", undefined); // NOTE: this used to be SPRITE_RENDERMODE_SLICED but was undefined pre-Rollup

    _defineTex2D(obj, "diffuse", 0, 3, "", true);
    _defineTex2D(obj, "specular", 0, 3, "", true);
    _defineTex2D(obj, "emissive", 0, 3, "", true);
    _defineTex2D(obj, "normal", 0, -1, "", false);
    _defineTex2D(obj, "metalness", 0, 1, "", true);
    _defineTex2D(obj, "gloss", 0, 1, "", true);
    _defineTex2D(obj, "opacity", 0, 1, "a", true);
    _defineTex2D(obj, "height", 0, 1, "", false);
    _defineTex2D(obj, "ao", 0, 1, "", true);
    _defineTex2D(obj, "light", 1, 3, "", true);
    _defineTex2D(obj, "msdf", 0, 3, "", false);
    _defineTex2D(obj, "diffuseDetail", 0, 3, "", false, true);
    _defineTex2D(obj, "normalDetail", 0, -1, "", false);
    _defineTex2D(obj, "clearCoat", 0, 1, "", true);
    _defineTex2D(obj, "clearCoatGloss", 0, 1, "", true);
    _defineTex2D(obj, "clearCoatNormal", 0, -1, "", false);

    _defineObject(obj, "cubeMap");
    _defineObject(obj, "sphereMap");
    _defineObject(obj, "dpAtlas");
    _defineObject(obj, "prefilteredCubeMap128");
    _defineObject(obj, "prefilteredCubeMap64");
    _defineObject(obj, "prefilteredCubeMap32");
    _defineObject(obj, "prefilteredCubeMap16");
    _defineObject(obj, "prefilteredCubeMap8");
    _defineObject(obj, "prefilteredCubeMap4");

    _defineAlias(obj, "diffuseTint", "diffuseMapTint");
    _defineAlias(obj, "specularTint", "specularMapTint");
    _defineAlias(obj, "emissiveTint", "emissiveMapTint");
    _defineAlias(obj, "aoVertexColor", "aoMapVertexColor");
    _defineAlias(obj, "diffuseVertexColor", "diffuseMapVertexColor");
    _defineAlias(obj, "specularVertexColor", "specularMapVertexColor");
    _defineAlias(obj, "emissiveVertexColor", "emissiveMapVertexColor");
    _defineAlias(obj, "metalnessVertexColor", "metalnessMapVertexColor");
    _defineAlias(obj, "glossVertexColor", "glossMapVertexColor");
    _defineAlias(obj, "opacityVertexColor", "opacityMapVertexColor");
    _defineAlias(obj, "lightVertexColor", "lightMapVertexColor");

    for (var i = 0; i < _propsSerial.length; i++) {
        _propsSerialDefaultVal[i] = obj[_propsSerial[i]];
    }

    obj._propsSet = [];
};

_defineMaterialProps(StandardMaterial.prototype);

export { StandardMaterial };
