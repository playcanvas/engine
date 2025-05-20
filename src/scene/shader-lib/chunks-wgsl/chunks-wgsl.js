import alphaTestPS from './standard/frag/alphaTest.js';
import ambientPS from './lit/frag/ambient.js';
import aoPS from './standard/frag/ao.js';
import aoDiffuseOccPS from './lit/frag/aoDiffuseOcc.js';
import aoSpecOccPS from './lit/frag/aoSpecOcc.js';
import bakeDirLmEndPS from './lightmapper/frag/bakeDirLmEnd.js';
import bakeLmEndPS from './lightmapper/frag/bakeLmEnd.js';
import basePS from './lit/frag/base.js';
import baseNineSlicedPS from './lit/frag/baseNineSliced.js';
import baseNineSlicedTiledPS from './lit/frag/baseNineSlicedTiled.js';
import bayerPS from './common/frag/bayer.js';
import bilateralDeNoisePS from './lightmapper/frag/bilateralDeNoise.js';
import blurVSMPS from './lit/frag/blurVSM.js';
import clearCoatPS from './standard/frag/clearCoat.js';
import clearCoatGlossPS from './standard/frag/clearCoatGloss.js';
import clearCoatNormalPS from './standard/frag/clearCoatNormal.js';
import anisotropyPS from './standard/frag/anisotropy.js';
import clusteredLightUtilsPS from './lit/frag/clusteredLightUtils.js';
import clusteredLightCookiesPS from './lit/frag/clusteredLightCookies.js';
import clusteredLightShadowsPS from './lit/frag/clusteredLightShadows.js';
import clusteredLightPS from './lit/frag/clusteredLight.js';
import combinePS from './lit/frag/combine.js';
import cookieBlit2DPS from './internal/frag/cookie-blit-2d.js';
import cookieBlitCubePS from './internal/frag/cookie-blit-cube.js';
import cookieBlitVS from './internal/vert/cookie-blit.js';
// import cookiePS from './lit/frag/cookie.js';
import cubeMapProjectPS from './lit/frag/cubeMapProject.js';
import cubeMapRotatePS from './lit/frag/cubeMapRotate.js';
import debugOutputPS from './lit/frag/debug-output.js';
import debugProcessFrontendPS from './lit/frag/debug-process-frontend.js';
import decodePS from './common/frag/decode.js';
import detailModesPS from './standard/frag/detailModes.js';
import dilatePS from './lightmapper/frag/dilate.js';
import diffusePS from './standard/frag/diffuse.js';
import emissivePS from './standard/frag/emissive.js';
import encodePS from './common/frag/encode.js';
import endPS from './lit/frag/end.js';
import envAtlasPS from './common/frag/envAtlas.js';
import envProcPS from './common/frag/envProc.js';
import falloffInvSquaredPS from './lit/frag/falloffInvSquared.js';
import falloffLinearPS from './lit/frag/falloffLinear.js';
import floatAsUintPS from './common/frag/float-as-uint.js';
import fogPS from './common/frag/fog.js';
import fresnelSchlickPS from './lit/frag/fresnelSchlick.js';
import fullscreenQuadVS from './common/vert/fullscreenQuad.js';
import gammaPS from './common/frag/gamma.js';
import glossPS from './standard/frag/gloss.js';
import gsplatCenterVS from './gsplat/vert/gsplatCenter.js';
import gsplatColorVS from './gsplat/vert/gsplatColor.js';
import gsplatCommonVS from './gsplat/vert/gsplatCommon.js';
import gsplatCompressedDataVS from './gsplat/vert/gsplatCompressedData.js';
import gsplatCompressedSHVS from './gsplat/vert/gsplatCompressedSH.js';
import gsplatCornerVS from './gsplat/vert/gsplatCorner.js';
import gsplatDataVS from './gsplat/vert/gsplatData.js';
import gsplatOutputVS from './gsplat/vert/gsplatOutput.js';
import gsplatPS from './gsplat/frag/gsplat.js';
import gsplatSHVS from './gsplat/vert/gsplatSH.js';
import gsplatSourceVS from './gsplat/vert/gsplatSource.js';
import gsplatVS from './gsplat/vert/gsplat.js';
import immediateLinePS from './internal/frag/immediateLine.js';
import immediateLineVS from './internal/vert/immediateLine.js';
import iridescenceDiffractionPS from './lit/frag/iridescenceDiffraction.js';
import iridescencePS from './standard/frag/iridescence.js';
import iridescenceThicknessPS from './standard/frag/iridescenceThickness.js';
import iorPS from './standard/frag/ior.js';
import lightDeclarationPS from './lit/frag/lighting/lightDeclaration.js';
import lightDiffuseLambertPS from './lit/frag/lightDiffuseLambert.js';
import lightDirPointPS from './lit/frag/lightDirPoint.js';
import lightEvaluationPS from './lit/frag/lighting/lightEvaluation.js';
import lightFunctionLightPS from './lit/frag/lighting/lightFunctionLight.js';
import lightFunctionShadowPS from './lit/frag/lighting/lightFunctionShadow.js';
import lightingPS from './lit/frag/lighting/lighting.js';
import lightmapAddPS from './lit/frag/lightmapAdd.js';
import lightmapPS from './standard/frag/lightmap.js';
import lightSpecularAnisoGGXPS from './lit/frag/lightSpecularAnisoGGX.js';
import lightSpecularBlinnPS from './lit/frag/lightSpecularBlinn.js';
import lightSheenPS from './lit/frag/lightSheen.js';
import linearizeDepthPS from './common/frag/linearizeDepth.js';
import litForwardBackendPS from './lit/frag/pass-forward/litForwardBackend.js';
import litForwardDeclarationPS from './lit/frag/pass-forward/litForwardDeclaration.js';
import litForwardMainPS from './lit/frag/pass-forward/litForwardMain.js';
import litForwardPostCodePS from './lit/frag/pass-forward/litForwardPostCode.js';
import litForwardPreCodePS from './lit/frag/pass-forward/litForwardPreCode.js';
import litMainPS from './lit/frag/litMain.js';
import litMainVS from './lit/vert/litMain.js';
import litOtherMainPS from './lit/frag/pass-other/litOtherMain.js';
import litShaderArgsPS from './standard/frag/litShaderArgs.js';
import litShaderCorePS from './standard/frag/litShaderCore.js';
import litShadowMainPS from './lit/frag/pass-shadow/litShadowMain.js';
import ltcPS from './lit/frag/ltc.js';
import metalnessPS from './standard/frag/metalness.js';
import msdfPS from './common/frag/msdf.js';
import metalnessModulatePS from './lit/frag/metalnessModulate.js';
import morphPS from './internal/morph/frag/morph.js';
import morphVS from './internal/morph/vert/morph.js';
import msdfVS from './common/vert/msdf.js';
import normalVS from './lit/vert/normal.js';
import normalCoreVS from './common/vert/normalCore.js';
import normalMapPS from './standard/frag/normalMap.js';
import opacityPS from './standard/frag/opacity.js';
import opacityDitherPS from './standard/frag/opacity-dither.js';
import outputPS from './lit/frag/output.js';
import outputAlphaPS from './lit/frag/outputAlpha.js';
import outputTex2DPS from './common/frag/outputTex2D.js';
import sheenPS from './standard/frag/sheen.js';
import sheenGlossPS from './standard/frag/sheenGloss.js';
import parallaxPS from './standard/frag/parallax.js';
import particlePS from './particle/frag/particle.js';
import particleVS from './particle/vert/particle.js';
import particleAnimFrameClampVS from './particle/vert/particleAnimFrameClamp.js';
import particleAnimFrameLoopVS from './particle/vert/particleAnimFrameLoop.js';
import particleAnimTexVS from './particle/vert/particleAnimTex.js';
import particleInputFloatPS from './particle/frag/particleInputFloat.js';
import particleInputRgba8PS from './particle/frag/particleInputRgba8.js';
import particleOutputFloatPS from './particle/frag/particleOutputFloat.js';
import particleOutputRgba8PS from './particle/frag/particleOutputRgba8.js';
import particleUpdaterAABBPS from './particle/frag/particleUpdaterAABB.js';
import particleUpdaterEndPS from './particle/frag/particleUpdaterEnd.js';
import particleUpdaterInitPS from './particle/frag/particleUpdaterInit.js';
import particleUpdaterNoRespawnPS from './particle/frag/particleUpdaterNoRespawn.js';
import particleUpdaterOnStopPS from './particle/frag/particleUpdaterOnStop.js';
import particleUpdaterRespawnPS from './particle/frag/particleUpdaterRespawn.js';
import particleUpdaterSpherePS from './particle/frag/particleUpdaterSphere.js';
import particleUpdaterStartPS from './particle/frag/particleUpdaterStart.js';
import particle_billboardVS from './particle/vert/particle_billboard.js';
import particle_blendAddPS from './particle/frag/particle_blendAdd.js';
import particle_blendMultiplyPS from './particle/frag/particle_blendMultiply.js';
import particle_blendNormalPS from './particle/frag/particle_blendNormal.js';
import particle_cpuVS from './particle/vert/particle_cpu.js';
import particle_cpu_endVS from './particle/vert/particle_cpu_end.js';
import particle_customFaceVS from './particle/vert/particle_customFace.js';
import particle_endPS from './particle/frag/particle_end.js';
import particle_endVS from './particle/vert/particle_end.js';
import particle_halflambertPS from './particle/frag/particle_halflambert.js';
import particle_initVS from './particle/vert/particle_init.js';
import particle_lambertPS from './particle/frag/particle_lambert.js';
import particle_lightingPS from './particle/frag/particle_lighting.js';
import particle_localShiftVS from './particle/vert/particle_localShift.js';
import particle_meshVS from './particle/vert/particle_mesh.js';
import particle_normalVS from './particle/vert/particle_normal.js';
import particle_normalMapPS from './particle/frag/particle_normalMap.js';
import particle_pointAlongVS from './particle/vert/particle_pointAlong.js';
import particle_simulationPS from './particle/frag/particle-simulation.js';
import particle_shaderPS from './particle/frag/particle-shader.js';
import particle_shaderVS from './particle/vert/particle-shader.js';
import particle_softPS from './particle/frag/particle_soft.js';
import particle_softVS from './particle/vert/particle_soft.js';
import particle_stretchVS from './particle/vert/particle_stretch.js';
import particle_TBNVS from './particle/vert/particle_TBN.js';
import particle_wrapVS from './particle/vert/particle_wrap.js';
import pickPS from './common/frag/pick.js';
import reflDirPS from './lit/frag/reflDir.js';
import reflDirAnisoPS from './lit/frag/reflDirAniso.js';
import reflectionCCPS from './lit/frag/reflectionCC.js';
import reflectionCubePS from './lit/frag/reflectionCube.js';
import reflectionEnvHQPS from './lit/frag/reflectionEnvHQ.js';
import reflectionEnvPS from './lit/frag/reflectionEnv.js';
import reflectionSpherePS from './lit/frag/reflectionSphere.js';
import reflectionSheenPS from './lit/frag/reflectionSheen.js';
import refractionCubePS from './lit/frag/refractionCube.js';
import refractionDynamicPS from './lit/frag/refractionDynamic.js';
import reprojectPS from './internal/frag/reproject.js';
import reprojectVS from './internal/vert/reproject.js';
// import sampleCatmullRomPS from './common/frag/sampleCatmullRom.js';
import screenDepthPS from './common/frag/screenDepth.js';
import shadowCascadesPS from './lit/frag/lighting/shadowCascades.js';
import shadowEVSMPS from './lit/frag/lighting/shadowEVSM.js';
import shadowPCF1PS from './lit/frag/lighting/shadowPCF1.js';
import shadowPCF3PS from './lit/frag/lighting/shadowPCF3.js';
import shadowPCF5PS from './lit/frag/lighting/shadowPCF5.js';
// import shadowPCSSPS from './lit/frag/lighting/shadowPCSS.js';  // omni / spot PCSS is not supported on WebGPU currently, as this is only for non-clustered lights
import shadowSoftPS from './lit/frag/lighting/shadowSoft.js';
import skinBatchVS from './common/vert/skinBatch.js';
import skinVS from './common/vert/skin.js';
import skyboxPS from './skybox/frag/skybox.js';
import skyboxVS from './skybox/vert/skybox.js';
import specularPS from './standard/frag/specular.js';
import sphericalPS from './common/frag/spherical.js';
import specularityFactorPS from './standard/frag/specularityFactor.js';
import spotPS from './lit/frag/spot.js';
import startNineSlicedPS from './lit/frag/startNineSliced.js';
import startNineSlicedTiledPS from './lit/frag/startNineSlicedTiled.js';
import stdDeclarationPS from './standard/frag/stdDeclaration.js';
import stdFrontEndPS from './standard/frag/stdFrontEnd.js';
import TBNPS from './lit/frag/TBN.js';
import thicknessPS from './standard/frag/thickness.js';
import tonemappingPS from './common/frag/tonemapping/tonemapping.js';
import tonemappingAcesPS from './common/frag/tonemapping/tonemappingAces.js';
import tonemappingAces2PS from './common/frag/tonemapping/tonemappingAces2.js';
import tonemappingFilmicPS from './common/frag/tonemapping/tonemappingFilmic.js';
import tonemappingHejlPS from './common/frag/tonemapping/tonemappingHejl.js';
import tonemappingLinearPS from './common/frag/tonemapping/tonemappingLinear.js';
import tonemappingNeutralPS from './common/frag/tonemapping/tonemappingNeutral.js';
import tonemappingNonePS from './common/frag/tonemapping/tonemappingNone.js';
import transformVS from './common/vert/transform.js';
import transformCoreVS from './common/vert/transformCore.js';
import transformInstancingVS from './common/vert/transformInstancing.js';
import transmissionPS from './standard/frag/transmission.js';
import twoSidedLightingPS from './lit/frag/twoSidedLighting.js';
import uv0VS from './lit/vert/uv0.js';
import uv1VS from './lit/vert/uv1.js';
import uvTransformVS from './lit/vert/uvTransform.js';
import uvTransformUniformsPS from './lit/vert/uvTransformUniforms.js';
import viewDirPS from './lit/frag/viewDir.js';
import webgpuPS from '../../../platform/graphics/shader-chunks/frag/webgpu-wgsl.js';
import webgpuVS from '../../../platform/graphics/shader-chunks/vert/webgpu-wgsl.js';

/**
 * Object containing all default WGSL shader chunks used by shader generators.
 *
 * @type {Record<string, string>}
 * @category Graphics
 */
const shaderChunksWGSL = {
    alphaTestPS,
    ambientPS,
    aoPS,
    aoDiffuseOccPS,
    aoSpecOccPS,
    bakeDirLmEndPS,
    bakeLmEndPS,
    basePS,
    baseNineSlicedPS,
    baseNineSlicedTiledPS,
    bayerPS,
    bilateralDeNoisePS,
    blurVSMPS,
    clearCoatPS,
    clearCoatGlossPS,
    clearCoatNormalPS,
    anisotropyPS,
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
    dilatePS,
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
    lightBufferDefinesPS: '',  // this chunk gets genereated at startup
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
    particlePS,
    particleVS,
    particleAnimFrameClampVS,
    particleAnimFrameLoopVS,
    particleAnimTexVS,
    particleInputFloatPS,
    particleInputRgba8PS,
    particleOutputFloatPS,
    particleOutputRgba8PS,
    particleUpdaterAABBPS,
    particleUpdaterEndPS,
    particleUpdaterInitPS,
    particleUpdaterNoRespawnPS,
    particleUpdaterOnStopPS,
    particleUpdaterRespawnPS,
    particleUpdaterSpherePS,
    particleUpdaterStartPS,
    particle_billboardVS,
    particle_blendAddPS,
    particle_blendMultiplyPS,
    particle_blendNormalPS,
    particle_cpuVS,
    particle_cpu_endVS,
    particle_customFaceVS,
    particle_endPS,
    particle_endVS,
    particle_halflambertPS,
    particle_initVS,
    particle_lambertPS,
    particle_lightingPS,
    particle_localShiftVS,
    particle_meshVS,
    particle_normalVS,
    particle_normalMapPS,
    particle_pointAlongVS,
    particle_simulationPS,
    particle_shaderPS,
    particle_shaderVS,
    particle_softPS,
    particle_softVS,
    particle_stretchVS,
    particle_TBNVS,
    particle_wrapVS,
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
    // sampleCatmullRomPS,
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
