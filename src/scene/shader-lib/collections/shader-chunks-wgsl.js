import alphaTestPS from '../chunks-wgsl/standard/frag/alphaTest.js';
import ambientPS from '../chunks-wgsl/lit/frag/ambient.js';
import anisotropyPS from '../chunks-wgsl/standard/frag/anisotropy.js';
import aoPS from '../chunks-wgsl/standard/frag/ao.js';
import aoDiffuseOccPS from '../chunks-wgsl/lit/frag/aoDiffuseOcc.js';
import aoSpecOccPS from '../chunks-wgsl/lit/frag/aoSpecOcc.js';
import bakeDirLmEndPS from '../chunks-wgsl/lightmapper/frag/bakeDirLmEnd.js';
import bakeLmEndPS from '../chunks-wgsl/lightmapper/frag/bakeLmEnd.js';
import basePS from '../chunks-wgsl/lit/frag/base.js';
import baseNineSlicedPS from '../chunks-wgsl/lit/frag/baseNineSliced.js';
import baseNineSlicedTiledPS from '../chunks-wgsl/lit/frag/baseNineSlicedTiled.js';
import bayerPS from '../chunks-wgsl/common/frag/bayer.js';
import blurVSMPS from '../chunks-wgsl/lit/frag/blurVSM.js';
import clearCoatPS from '../chunks-wgsl/standard/frag/clearCoat.js';
import clearCoatGlossPS from '../chunks-wgsl/standard/frag/clearCoatGloss.js';
import clearCoatNormalPS from '../chunks-wgsl/standard/frag/clearCoatNormal.js';
import clusteredLightUtilsPS from '../chunks-wgsl/lit/frag/clusteredLightUtils.js';
import clusteredLightCookiesPS from '../chunks-wgsl/lit/frag/clusteredLightCookies.js';
import clusteredLightShadowsPS from '../chunks-wgsl/lit/frag/clusteredLightShadows.js';
import clusteredLightPS from '../chunks-wgsl/lit/frag/clusteredLight.js';
import combinePS from '../chunks-wgsl/lit/frag/combine.js';
import cookieBlit2DPS from '../chunks-wgsl/internal/frag/cookie-blit-2d.js';
import cookieBlitCubePS from '../chunks-wgsl/internal/frag/cookie-blit-cube.js';
import cookieBlitVS from '../chunks-wgsl/internal/vert/cookie-blit.js';
// import cookiePS from './lit/frag/cookie.js';
import cubeMapProjectPS from '../chunks-wgsl/lit/frag/cubeMapProject.js';
import cubeMapRotatePS from '../chunks-wgsl/lit/frag/cubeMapRotate.js';
import debugOutputPS from '../chunks-wgsl/lit/frag/debug-output.js';
import debugProcessFrontendPS from '../chunks-wgsl/lit/frag/debug-process-frontend.js';
import decodePS from '../chunks-wgsl/common/frag/decode.js';
import detailModesPS from '../chunks-wgsl/standard/frag/detailModes.js';
import diffusePS from '../chunks-wgsl/standard/frag/diffuse.js';
import emissivePS from '../chunks-wgsl/standard/frag/emissive.js';
import encodePS from '../chunks-wgsl/common/frag/encode.js';
import endPS from '../chunks-wgsl/lit/frag/end.js';
import envAtlasPS from '../chunks-wgsl/common/frag/envAtlas.js';
import envProcPS from '../chunks-wgsl/common/frag/envProc.js';
import falloffInvSquaredPS from '../chunks-wgsl/lit/frag/falloffInvSquared.js';
import falloffLinearPS from '../chunks-wgsl/lit/frag/falloffLinear.js';
import floatAsUintPS from '../chunks-wgsl/common/frag/float-as-uint.js';
import fogPS from '../chunks-wgsl/common/frag/fog.js';
import fresnelSchlickPS from '../chunks-wgsl/lit/frag/fresnelSchlick.js';
import fullscreenQuadVS from '../chunks-wgsl/common/vert/fullscreenQuad.js';
import gammaPS from '../chunks-wgsl/common/frag/gamma.js';
import glossPS from '../chunks-wgsl/standard/frag/gloss.js';
import gsplatCenterVS from '../chunks-wgsl/gsplat/vert/gsplatCenter.js';
import gsplatColorVS from '../chunks-wgsl/gsplat/vert/gsplatColor.js';
import gsplatCommonVS from '../chunks-wgsl/gsplat/vert/gsplatCommon.js';
import gsplatCompressedDataVS from '../chunks-wgsl/gsplat/vert/gsplatCompressedData.js';
import gsplatCompressedSHVS from '../chunks-wgsl/gsplat/vert/gsplatCompressedSH.js';
import gsplatCornerVS from '../chunks-wgsl/gsplat/vert/gsplatCorner.js';
import gsplatDataVS from '../chunks-wgsl/gsplat/vert/gsplatData.js';
import gsplatOutputVS from '../chunks-wgsl/gsplat/vert/gsplatOutput.js';
import gsplatPS from '../chunks-wgsl/gsplat/frag/gsplat.js';
import gsplatSHVS from '../chunks-wgsl/gsplat/vert/gsplatSH.js';
import gsplatSourceVS from '../chunks-wgsl/gsplat/vert/gsplatSource.js';
import gsplatVS from '../chunks-wgsl/gsplat/vert/gsplat.js';
import immediateLinePS from '../chunks-wgsl/internal/frag/immediateLine.js';
import immediateLineVS from '../chunks-wgsl/internal/vert/immediateLine.js';
import iridescenceDiffractionPS from '../chunks-wgsl/lit/frag/iridescenceDiffraction.js';
import iridescencePS from '../chunks-wgsl/standard/frag/iridescence.js';
import iridescenceThicknessPS from '../chunks-wgsl/standard/frag/iridescenceThickness.js';
import iorPS from '../chunks-wgsl/standard/frag/ior.js';
import lightDeclarationPS from '../chunks-wgsl/lit/frag/lighting/lightDeclaration.js';
import lightDiffuseLambertPS from '../chunks-wgsl/lit/frag/lightDiffuseLambert.js';
import lightDirPointPS from '../chunks-wgsl/lit/frag/lightDirPoint.js';
import lightEvaluationPS from '../chunks-wgsl/lit/frag/lighting/lightEvaluation.js';
import lightFunctionLightPS from '../chunks-wgsl/lit/frag/lighting/lightFunctionLight.js';
import lightFunctionShadowPS from '../chunks-wgsl/lit/frag/lighting/lightFunctionShadow.js';
import lightingPS from '../chunks-wgsl/lit/frag/lighting/lighting.js';
import lightmapAddPS from '../chunks-wgsl/lit/frag/lightmapAdd.js';
import lightmapPS from '../chunks-wgsl/standard/frag/lightmap.js';
import lightSpecularAnisoGGXPS from '../chunks-wgsl/lit/frag/lightSpecularAnisoGGX.js';
import lightSpecularBlinnPS from '../chunks-wgsl/lit/frag/lightSpecularBlinn.js';
import lightSheenPS from '../chunks-wgsl/lit/frag/lightSheen.js';
import linearizeDepthPS from '../chunks-wgsl/common/frag/linearizeDepth.js';
import litForwardBackendPS from '../chunks-wgsl/lit/frag/pass-forward/litForwardBackend.js';
import litForwardDeclarationPS from '../chunks-wgsl/lit/frag/pass-forward/litForwardDeclaration.js';
import litForwardMainPS from '../chunks-wgsl/lit/frag/pass-forward/litForwardMain.js';
import litForwardPostCodePS from '../chunks-wgsl/lit/frag/pass-forward/litForwardPostCode.js';
import litForwardPreCodePS from '../chunks-wgsl/lit/frag/pass-forward/litForwardPreCode.js';
import litMainPS from '../chunks-wgsl/lit/frag/litMain.js';
import litMainVS from '../chunks-wgsl/lit/vert/litMain.js';
import litOtherMainPS from '../chunks-wgsl/lit/frag/pass-other/litOtherMain.js';
import litShaderArgsPS from '../chunks-wgsl/standard/frag/litShaderArgs.js';
import litShaderCorePS from '../chunks-wgsl/standard/frag/litShaderCore.js';
import litShadowMainPS from '../chunks-wgsl/lit/frag/pass-shadow/litShadowMain.js';
import ltcPS from '../chunks-wgsl/lit/frag/ltc.js';
import metalnessPS from '../chunks-wgsl/standard/frag/metalness.js';
import msdfPS from '../chunks-wgsl/common/frag/msdf.js';
import metalnessModulatePS from '../chunks-wgsl/lit/frag/metalnessModulate.js';
import morphPS from '../chunks-wgsl/internal/morph/frag/morph.js';
import morphVS from '../chunks-wgsl/internal/morph/vert/morph.js';
import msdfVS from '../chunks-wgsl/common/vert/msdf.js';
import normalVS from '../chunks-wgsl/lit/vert/normal.js';
import normalCoreVS from '../chunks-wgsl/common/vert/normalCore.js';
import normalMapPS from '../chunks-wgsl/standard/frag/normalMap.js';
import opacityPS from '../chunks-wgsl/standard/frag/opacity.js';
import opacityDitherPS from '../chunks-wgsl/standard/frag/opacity-dither.js';
import outputPS from '../chunks-wgsl/lit/frag/output.js';
import outputAlphaPS from '../chunks-wgsl/lit/frag/outputAlpha.js';
import outputTex2DPS from '../chunks-wgsl/common/frag/outputTex2D.js';
import sheenPS from '../chunks-wgsl/standard/frag/sheen.js';
import sheenGlossPS from '../chunks-wgsl/standard/frag/sheenGloss.js';
import parallaxPS from '../chunks-wgsl/standard/frag/parallax.js';
import pickPS from '../chunks-wgsl/common/frag/pick.js';
import reflDirPS from '../chunks-wgsl/lit/frag/reflDir.js';
import reflDirAnisoPS from '../chunks-wgsl/lit/frag/reflDirAniso.js';
import reflectionCCPS from '../chunks-wgsl/lit/frag/reflectionCC.js';
import reflectionCubePS from '../chunks-wgsl/lit/frag/reflectionCube.js';
import reflectionEnvHQPS from '../chunks-wgsl/lit/frag/reflectionEnvHQ.js';
import reflectionEnvPS from '../chunks-wgsl/lit/frag/reflectionEnv.js';
import reflectionSpherePS from '../chunks-wgsl/lit/frag/reflectionSphere.js';
import reflectionSheenPS from '../chunks-wgsl/lit/frag/reflectionSheen.js';
import refractionCubePS from '../chunks-wgsl/lit/frag/refractionCube.js';
import refractionDynamicPS from '../chunks-wgsl/lit/frag/refractionDynamic.js';
import reprojectPS from '../chunks-wgsl/internal/frag/reproject.js';
import reprojectVS from '../chunks-wgsl/internal/vert/reproject.js';
import screenDepthPS from '../chunks-wgsl/common/frag/screenDepth.js';
import shadowCascadesPS from '../chunks-wgsl/lit/frag/lighting/shadowCascades.js';
import shadowEVSMPS from '../chunks-wgsl/lit/frag/lighting/shadowEVSM.js';
import shadowPCF1PS from '../chunks-wgsl/lit/frag/lighting/shadowPCF1.js';
import shadowPCF3PS from '../chunks-wgsl/lit/frag/lighting/shadowPCF3.js';
import shadowPCF5PS from '../chunks-wgsl/lit/frag/lighting/shadowPCF5.js';
// import shadowPCSSPS from './lit/frag/lighting/shadowPCSS.js';  // omni / spot PCSS is not supported on WebGPU currently, as this is only for non-clustered lights
import shadowSoftPS from '../chunks-wgsl/lit/frag/lighting/shadowSoft.js';
import skinBatchVS from '../chunks-wgsl/common/vert/skinBatch.js';
import skinVS from '../chunks-wgsl/common/vert/skin.js';
import skyboxPS from '../chunks-wgsl/skybox/frag/skybox.js';
import skyboxVS from '../chunks-wgsl/skybox/vert/skybox.js';
import specularPS from '../chunks-wgsl/standard/frag/specular.js';
import sphericalPS from '../chunks-wgsl/common/frag/spherical.js';
import specularityFactorPS from '../chunks-wgsl/standard/frag/specularityFactor.js';
import spotPS from '../chunks-wgsl/lit/frag/spot.js';
import startNineSlicedPS from '../chunks-wgsl/lit/frag/startNineSliced.js';
import startNineSlicedTiledPS from '../chunks-wgsl/lit/frag/startNineSlicedTiled.js';
import stdDeclarationPS from '../chunks-wgsl/standard/frag/stdDeclaration.js';
import stdFrontEndPS from '../chunks-wgsl/standard/frag/stdFrontEnd.js';
import TBNPS from '../chunks-wgsl/lit/frag/TBN.js';
import thicknessPS from '../chunks-wgsl/standard/frag/thickness.js';
import tonemappingPS from '../chunks-wgsl/common/frag/tonemapping/tonemapping.js';
import tonemappingAcesPS from '../chunks-wgsl/common/frag/tonemapping/tonemappingAces.js';
import tonemappingAces2PS from '../chunks-wgsl/common/frag/tonemapping/tonemappingAces2.js';
import tonemappingFilmicPS from '../chunks-wgsl/common/frag/tonemapping/tonemappingFilmic.js';
import tonemappingHejlPS from '../chunks-wgsl/common/frag/tonemapping/tonemappingHejl.js';
import tonemappingLinearPS from '../chunks-wgsl/common/frag/tonemapping/tonemappingLinear.js';
import tonemappingNeutralPS from '../chunks-wgsl/common/frag/tonemapping/tonemappingNeutral.js';
import tonemappingNonePS from '../chunks-wgsl/common/frag/tonemapping/tonemappingNone.js';
import transformVS from '../chunks-wgsl/common/vert/transform.js';
import transformCoreVS from '../chunks-wgsl/common/vert/transformCore.js';
import transformInstancingVS from '../chunks-wgsl/common/vert/transformInstancing.js';
import transmissionPS from '../chunks-wgsl/standard/frag/transmission.js';
import twoSidedLightingPS from '../chunks-wgsl/lit/frag/twoSidedLighting.js';
import uv0VS from '../chunks-wgsl/lit/vert/uv0.js';
import uv1VS from '../chunks-wgsl/lit/vert/uv1.js';
import uvTransformVS from '../chunks-wgsl/lit/vert/uvTransform.js';
import uvTransformUniformsPS from '../chunks-wgsl/lit/vert/uvTransformUniforms.js';
import viewDirPS from '../chunks-wgsl/lit/frag/viewDir.js';
import webgpuPS from '../../../platform/graphics/shader-chunks/frag/webgpu-wgsl.js';
import webgpuVS from '../../../platform/graphics/shader-chunks/vert/webgpu-wgsl.js';

/**
 * Object containing all default WGSL shader chunks used by shader generators.
 *
 * @type {Record<string, string>}
 * @category Graphics
 * @ignore
 */
const shaderChunksWGSL = {
    alphaTestPS,
    ambientPS,
    anisotropyPS,
    aoPS,
    aoDiffuseOccPS,
    aoSpecOccPS,
    bakeDirLmEndPS,
    bakeLmEndPS,
    basePS,
    baseNineSlicedPS,
    baseNineSlicedTiledPS,
    bayerPS,
    blurVSMPS,
    clearCoatPS,
    clearCoatGlossPS,
    clearCoatNormalPS,
    clusteredLightCookiesPS,
    clusteredLightShadowsPS,
    clusteredLightUtilsPS,
    clusteredLightPS,
    combinePS,
    cookieBlit2DPS,
    cookieBlitCubePS,
    cookieBlitVS,
    // cookiePS,
    cubeMapProjectPS,
    cubeMapRotatePS,
    debugOutputPS,
    debugProcessFrontendPS,
    detailModesPS,
    diffusePS,
    decodePS,
    emissivePS,
    encodePS,
    endPS,
    envAtlasPS,
    envProcPS,
    falloffInvSquaredPS,
    falloffLinearPS,
    floatAsUintPS,
    fogPS,
    fresnelSchlickPS,
    frontendCodePS: '',  // empty chunk, supplied by the shader generator
    frontendDeclPS: '',  // empty chunk, supplied by the shader generator
    fullscreenQuadVS,
    gammaPS,
    glossPS,
    gsplatCenterVS,
    gsplatCornerVS,
    gsplatColorVS,
    gsplatCommonVS,
    gsplatCompressedDataVS,
    gsplatCompressedSHVS,
    gsplatDataVS,
    gsplatOutputVS,
    gsplatPS,
    gsplatSHVS,
    gsplatSourceVS,
    gsplatVS,
    immediateLinePS,
    immediateLineVS,
    iridescenceDiffractionPS,
    iridescencePS,
    iridescenceThicknessPS,
    iorPS,
    lightDeclarationPS,
    lightDiffuseLambertPS,
    lightDirPointPS,
    lightEvaluationPS,
    lightFunctionLightPS,
    lightFunctionShadowPS,
    lightingPS,
    lightmapAddPS,
    lightmapPS,
    lightSpecularAnisoGGXPS,
    lightSpecularBlinnPS,
    lightSheenPS,
    linearizeDepthPS,
    litForwardBackendPS,
    litForwardDeclarationPS,
    litForwardMainPS,
    litForwardPostCodePS,
    litForwardPreCodePS,
    litMainPS,
    litMainVS,
    litOtherMainPS,
    litShaderArgsPS,
    litShaderCorePS,
    litShadowMainPS,
    litUserDeclarationPS: '',  // empty chunk allowing user to add custom code
    litUserDeclarationVS: '',  // empty chunk allowing user to add custom code
    litUserCodePS: '',  // empty chunk allowing user to add custom code
    litUserCodeVS: '',  // empty chunk allowing user to add custom code
    litUserMainStartPS: '',  // empty chunk allowing user to add custom code
    litUserMainStartVS: '',  // empty chunk allowing user to add custom code
    litUserMainEndPS: '',  // empty chunk allowing user to add custom code
    litUserMainEndVS: '',  // empty chunk allowing user to add custom code
    ltcPS,
    metalnessPS,
    metalnessModulatePS,
    morphPS,
    morphVS,
    msdfPS,
    msdfVS,
    normalVS,
    normalCoreVS,
    normalMapPS,
    opacityPS,
    opacityDitherPS,
    outputPS,
    outputAlphaPS,
    outputTex2DPS,
    sheenPS,
    sheenGlossPS,
    parallaxPS,
    pickPS,
    reflDirPS,
    reflDirAnisoPS,
    reflectionCCPS,
    reflectionCubePS,
    reflectionEnvHQPS,
    reflectionEnvPS,
    reflectionSpherePS,
    reflectionSheenPS,
    refractionCubePS,
    refractionDynamicPS,
    reprojectPS,
    reprojectVS,
    screenDepthPS,
    shadowCascadesPS,
    shadowEVSMPS,
    shadowPCF1PS,
    shadowPCF3PS,
    shadowPCF5PS,
    // shadowPCSSPS,
    shadowSoftPS,
    skinBatchVS,
    skinVS,
    skyboxPS,
    skyboxVS,
    specularPS,
    sphericalPS,
    specularityFactorPS,
    spotPS,
    startNineSlicedPS,
    startNineSlicedTiledPS,
    stdDeclarationPS,
    stdFrontEndPS,
    TBNPS,
    thicknessPS,
    tonemappingPS,
    tonemappingAcesPS,
    tonemappingAces2PS,
    tonemappingFilmicPS,
    tonemappingHejlPS,
    tonemappingLinearPS,
    tonemappingNeutralPS,
    tonemappingNonePS,
    transformVS,
    transformCoreVS,
    transformInstancingVS,
    transmissionPS,
    twoSidedLightingPS,
    uv0VS,
    uv1VS,
    uvTransformVS,
    uvTransformUniformsPS,
    viewDirPS,
    webgpuPS,
    webgpuVS
};

export { shaderChunksWGSL };
