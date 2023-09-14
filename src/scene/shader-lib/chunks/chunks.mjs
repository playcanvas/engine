import alphaTestPS from './standard/frag/alphaTest.mjs';
import ambientConstantPS from './lit/frag/ambientConstant.mjs';
import ambientEnvPS from './lit/frag/ambientEnv.mjs';
import ambientSHPS from './lit/frag/ambientSH.mjs';
import aoPS from './standard/frag/ao.mjs';
import aoDetailMapPS from './standard/frag/aoDetailMap.mjs';
import aoDiffuseOccPS from './lit/frag/aoDiffuseOcc.mjs';
import aoSpecOccPS from './lit/frag/aoSpecOcc.mjs';
import aoSpecOccConstPS from './lit/frag/aoSpecOccConst.mjs';
import aoSpecOccConstSimplePS from './lit/frag/aoSpecOccConstSimple.mjs';
import aoSpecOccSimplePS from './lit/frag/aoSpecOccSimple.mjs';
import basePS from './lit/frag/base.mjs';
import baseVS from './lit/vert/base.mjs';
import baseNineSlicedPS from './lit/frag/baseNineSliced.mjs';
import baseNineSlicedVS from './lit/vert/baseNineSliced.mjs';
import baseNineSlicedTiledPS from './lit/frag/baseNineSlicedTiled.mjs';
import biasConstPS from './lit/frag/biasConst.mjs';
import blurVSMPS from './lit/frag/blurVSM.mjs';
import clearCoatPS from './standard/frag/clearCoat.mjs';
import clearCoatGlossPS from './standard/frag/clearCoatGloss.mjs';
import clearCoatNormalPS from './standard/frag/clearCoatNormal.mjs';
import clusteredLightUtilsPS from './lit/frag/clusteredLightUtils.mjs';
import clusteredLightCookiesPS from './lit/frag/clusteredLightCookies.mjs';
import clusteredLightShadowsPS from './lit/frag/clusteredLightShadows.mjs';
import clusteredLightPS from './lit/frag/clusteredLight.mjs';
import combinePS from './lit/frag/combine.mjs';
import cookiePS from './lit/frag/cookie.mjs';
import cubeMapProjectBoxPS from './lit/frag/cubeMapProjectBox.mjs';
import cubeMapProjectNonePS from './lit/frag/cubeMapProjectNone.mjs';
import cubeMapRotatePS from './lit/frag/cubeMapRotate.mjs';
import debugOutputPS from './lit/frag/debug-output.mjs';
import debugProcessFrontendPS from './lit/frag/debug-process-frontend.mjs';
import decodePS from './common/frag/decode.mjs';
import detailModesPS from './standard/frag/detailModes.mjs';
import diffusePS from './standard/frag/diffuse.mjs';
import diffuseDetailMapPS from './standard/frag/diffuseDetailMap.mjs';
import emissivePS from './standard/frag/emissive.mjs';
import encodePS from './common/frag/encode.mjs';
import endPS from './lit/frag/end.mjs';
import endVS from './lit/vert/end.mjs';
import envAtlasPS from './common/frag/envAtlas.mjs';
import envConstPS from './common/frag/envConst.mjs';
import envMultiplyPS from './common/frag/envMultiply.mjs';
import extensionPS from './lit/frag/extension.mjs';
import extensionVS from './lit/vert/extension.mjs';
import falloffInvSquaredPS from './lit/frag/falloffInvSquared.mjs';
import falloffLinearPS from './lit/frag/falloffLinear.mjs';
import fixCubemapSeamsNonePS from './common/frag/fixCubemapSeamsNone.mjs';
import fixCubemapSeamsStretchPS from './common/frag/fixCubemapSeamsStretch.mjs';
import floatUnpackingPS from './lit/frag/float-unpacking.mjs';
import fogExpPS from './lit/frag/fogExp.mjs';
import fogExp2PS from './lit/frag/fogExp2.mjs';
import fogLinearPS from './lit/frag/fogLinear.mjs';
import fogNonePS from './lit/frag/fogNone.mjs';
import fresnelSchlickPS from './lit/frag/fresnelSchlick.mjs';
import fullscreenQuadPS from './common/frag/fullscreenQuad.mjs';
import fullscreenQuadVS from './common/vert/fullscreenQuad.mjs';
import gamma1_0PS from './common/frag/gamma1_0.mjs';
import gamma2_2PS from './common/frag/gamma2_2.mjs';
import gles2PS from '../../../platform/graphics/shader-chunks/frag/gles2.mjs';
import gles3PS from '../../../platform/graphics/shader-chunks/frag/gles3.mjs';
import gles3VS from '../../../platform/graphics/shader-chunks/vert/gles3.mjs';
import glossPS from './standard/frag/gloss.mjs';
import iridescenceDiffractionPS from './lit/frag/iridescenceDiffraction.mjs';
import iridescencePS from './standard/frag/iridescence.mjs';
import iridescenceThicknessPS from './standard/frag/iridescenceThickness.mjs';
import instancingVS from './lit/vert/instancing.mjs';
import iorPS from './standard/frag/ior.mjs';
import lightDiffuseLambertPS from './lit/frag/lightDiffuseLambert.mjs';
import lightDirPointPS from './lit/frag/lightDirPoint.mjs';
import lightmapAddPS from './lit/frag/lightmapAdd.mjs';
import lightmapDirAddPS from './lit/frag/lightmapDirAdd.mjs';
import lightmapDirPS from './standard/frag/lightmapDir.mjs';
import lightmapSinglePS from './standard/frag/lightmapSingle.mjs';
import lightSpecularAnisoGGXPS from './lit/frag/lightSpecularAnisoGGX.mjs';
import lightSpecularBlinnPS from './lit/frag/lightSpecularBlinn.mjs';
import lightSpecularPhongPS from './lit/frag/lightSpecularPhong.mjs';
import lightSheenPS from './lit/frag/lightSheen.mjs';
import linearizeDepthPS from './common/frag/linearizeDepth.mjs';
import litShaderArgsPS from './standard/frag/litShaderArgs.mjs';
import ltcPS from './lit/frag/ltc.mjs';
import metalnessPS from './standard/frag/metalness.mjs';
import msdfPS from './common/frag/msdf.mjs';
import metalnessModulatePS from './lit/frag/metalnessModulate.mjs';
import msdfVS from './common/vert/msdf.mjs';
import normalVS from './lit/vert/normal.mjs';
import normalDetailMapPS from './standard/frag/normalDetailMap.mjs';
import normalInstancedVS from './lit/vert/normalInstanced.mjs';
import normalMapPS from './standard/frag/normalMap.mjs';
import normalSkinnedVS from './lit/vert/normalSkinned.mjs';
import normalXYPS from './standard/frag/normalXY.mjs';
import normalXYZPS from './standard/frag/normalXYZ.mjs';
import opacityPS from './standard/frag/opacity.mjs';
import outputPS from './lit/frag/output.mjs';
import outputAlphaPS from './lit/frag/outputAlpha.mjs';
import outputAlphaOpaquePS from './lit/frag/outputAlphaOpaque.mjs';
import outputAlphaPremulPS from './lit/frag/outputAlphaPremul.mjs';
import outputTex2DPS from './common/frag/outputTex2D.mjs';
import packDepthPS from './common/frag/packDepth.mjs';
import sheenPS from './standard/frag/sheen.mjs';
import sheenGlossPS from './standard/frag/sheenGloss.mjs';
import parallaxPS from './standard/frag/parallax.mjs';
import particlePS from './particle/frag/particle.mjs';
import particleVS from './particle/vert/particle.mjs';
import particleAnimFrameClampVS from './particle/vert/particleAnimFrameClamp.mjs';
import particleAnimFrameLoopVS from './particle/vert/particleAnimFrameLoop.mjs';
import particleAnimTexVS from './particle/vert/particleAnimTex.mjs';
import particleInputFloatPS from './particle/frag/particleInputFloat.mjs';
import particleInputRgba8PS from './particle/frag/particleInputRgba8.mjs';
import particleOutputFloatPS from './particle/frag/particleOutputFloat.mjs';
import particleOutputRgba8PS from './particle/frag/particleOutputRgba8.mjs';
import particleUpdaterAABBPS from './particle/frag/particleUpdaterAABB.mjs';
import particleUpdaterEndPS from './particle/frag/particleUpdaterEnd.mjs';
import particleUpdaterInitPS from './particle/frag/particleUpdaterInit.mjs';
import particleUpdaterNoRespawnPS from './particle/frag/particleUpdaterNoRespawn.mjs';
import particleUpdaterOnStopPS from './particle/frag/particleUpdaterOnStop.mjs';
import particleUpdaterRespawnPS from './particle/frag/particleUpdaterRespawn.mjs';
import particleUpdaterSpherePS from './particle/frag/particleUpdaterSphere.mjs';
import particleUpdaterStartPS from './particle/frag/particleUpdaterStart.mjs';
import particle_billboardVS from './particle/vert/particle_billboard.mjs';
import particle_blendAddPS from './particle/frag/particle_blendAdd.mjs';
import particle_blendMultiplyPS from './particle/frag/particle_blendMultiply.mjs';
import particle_blendNormalPS from './particle/frag/particle_blendNormal.mjs';
import particle_cpuVS from './particle/vert/particle_cpu.mjs';
import particle_cpu_endVS from './particle/vert/particle_cpu_end.mjs';
import particle_customFaceVS from './particle/vert/particle_customFace.mjs';
import particle_endPS from './particle/frag/particle_end.mjs';
import particle_endVS from './particle/vert/particle_end.mjs';
import particle_halflambertPS from './particle/frag/particle_halflambert.mjs';
import particle_initVS from './particle/vert/particle_init.mjs';
import particle_lambertPS from './particle/frag/particle_lambert.mjs';
import particle_lightingPS from './particle/frag/particle_lighting.mjs';
import particle_localShiftVS from './particle/vert/particle_localShift.mjs';
import particle_meshVS from './particle/vert/particle_mesh.mjs';
import particle_normalVS from './particle/vert/particle_normal.mjs';
import particle_normalMapPS from './particle/frag/particle_normalMap.mjs';
import particle_pointAlongVS from './particle/vert/particle_pointAlong.mjs';
import particle_softPS from './particle/frag/particle_soft.mjs';
import particle_softVS from './particle/vert/particle_soft.mjs';
import particle_stretchVS from './particle/vert/particle_stretch.mjs';
import particle_TBNVS from './particle/vert/particle_TBN.mjs';
import particle_wrapVS from './particle/vert/particle_wrap.mjs';
import reflDirPS from './lit/frag/reflDir.mjs';
import reflDirAnisoPS from './lit/frag/reflDirAniso.mjs';
import reflectionCCPS from './lit/frag/reflectionCC.mjs';
import reflectionCubePS from './lit/frag/reflectionCube.mjs';
import reflectionEnvHQPS from './lit/frag/reflectionEnvHQ.mjs';
import reflectionEnvPS from './lit/frag/reflectionEnv.mjs';
import reflectionSpherePS from './lit/frag/reflectionSphere.mjs';
import reflectionSphereLowPS from './lit/frag/reflectionSphereLow.mjs';
import reflectionSheenPS from './lit/frag/reflectionSheen.mjs';
import refractionCubePS from './lit/frag/refractionCube.mjs';
import refractionDynamicPS from './lit/frag/refractionDynamic.mjs';
import reprojectPS from './common/frag/reproject.mjs';
import screenDepthPS from './common/frag/screenDepth.mjs';
import shadowCascadesPS from './lit/frag/shadowCascades.mjs';
import shadowEVSMPS from './lit/frag/shadowEVSM.mjs';
import shadowEVSMnPS from './lit/frag/shadowEVSMn.mjs';
import shadowPCSSPS from './lit/frag/shadowPCSS.mjs';
import shadowSampleCoordPS from './lit/frag/shadowSampleCoord.mjs';
import shadowStandardPS from './lit/frag/shadowStandard.mjs';
import shadowStandardGL2PS from './lit/frag/shadowStandardGL2.mjs';
import shadowVSM8PS from './lit/frag/shadowVSM8.mjs';
import shadowVSM_commonPS from './lit/frag/shadowVSM_common.mjs';
import skinBatchConstVS from './common/vert/skinBatchConst.mjs';
import skinBatchTexVS from './common/vert/skinBatchTex.mjs';
import skinConstVS from './common/vert/skinConst.mjs';
import skinTexVS from './common/vert/skinTex.mjs';
import skyboxEnvPS from './skybox/frag/skyboxEnv.mjs';
import skyboxHDRPS from './skybox/frag/skyboxHDR.mjs';
import skyboxVS from './skybox/vert/skybox.mjs';
import specularPS from './standard/frag/specular.mjs';
import sphericalPS from './common/frag/spherical.mjs';
import specularityFactorPS from './standard/frag/specularityFactor.mjs';
import spotPS from './lit/frag/spot.mjs';
import startPS from './lit/frag/start.mjs';
import startVS from './lit/vert/start.mjs';
import startNineSlicedPS from './lit/frag/startNineSliced.mjs';
import startNineSlicedTiledPS from './lit/frag/startNineSlicedTiled.mjs';
import storeEVSMPS from './lit/frag/storeEVSM.mjs';
import tangentBinormalVS from './lit/vert/tangentBinormal.mjs';
import TBNPS from './lit/frag/TBN.mjs';
import TBNderivativePS from './lit/frag/TBNderivative.mjs';
import TBNfastPS from './lit/frag/TBNfast.mjs';
import TBNObjectSpacePS from './lit/frag/TBNObjectSpace.mjs';
import textureSamplePS from './standard/frag/textureSample.mjs';
import thicknessPS from './standard/frag/thickness.mjs';
import tonemappingAcesPS from './common/frag/tonemappingAces.mjs';
import tonemappingAces2PS from './common/frag/tonemappingAces2.mjs';
import tonemappingFilmicPS from './common/frag/tonemappingFilmic.mjs';
import tonemappingHejlPS from './common/frag/tonemappingHejl.mjs';
import tonemappingLinearPS from './common/frag/tonemappingLinear.mjs';
import tonemappingNonePS from './common/frag/tonemappingNone.mjs';
import transformVS from './common/vert/transform.mjs';
import transformDeclVS from './common/vert/transformDecl.mjs';
import transmissionPS from './standard/frag/transmission.mjs';
import uv0VS from './lit/vert/uv0.mjs';
import uv1VS from './lit/vert/uv1.mjs';
import viewDirPS from './lit/frag/viewDir.mjs';
import viewNormalVS from './lit/vert/viewNormal.mjs';
import webgpuPS from '../../../platform/graphics/shader-chunks/frag/webgpu.mjs';
import webgpuVS from '../../../platform/graphics/shader-chunks/vert/webgpu.mjs';

/**
 * Object containing all default shader chunks used by shader generators.
 *
 * @type {object}
 */
const shaderChunks = {
    alphaTestPS,
    ambientConstantPS,
    ambientEnvPS,
    ambientSHPS,
    aoPS,
    aoDetailMapPS,
    aoDiffuseOccPS,
    aoSpecOccPS,
    aoSpecOccConstPS,
    aoSpecOccConstSimplePS,
    aoSpecOccSimplePS,
    basePS,
    baseVS,
    baseNineSlicedPS,
    baseNineSlicedVS,
    baseNineSlicedTiledPS,
    biasConstPS,
    blurVSMPS,
    clearCoatPS,
    clearCoatGlossPS,
    clearCoatNormalPS,
    clusteredLightCookiesPS,
    clusteredLightShadowsPS,
    clusteredLightUtilsPS,
    clusteredLightPS,
    combinePS,
    cookiePS,
    cubeMapProjectBoxPS,
    cubeMapProjectNonePS,
    cubeMapRotatePS,
    debugOutputPS,
    debugProcessFrontendPS,
    detailModesPS,
    diffusePS,
    diffuseDetailMapPS,
    decodePS,
    emissivePS,
    encodePS,
    endPS,
    endVS,
    envAtlasPS,
    envConstPS,
    envMultiplyPS,
    extensionPS,
    extensionVS,
    falloffInvSquaredPS,
    falloffLinearPS,
    fixCubemapSeamsNonePS,
    fixCubemapSeamsStretchPS,
    floatUnpackingPS,
    fogExpPS,
    fogExp2PS,
    fogLinearPS,
    fogNonePS,
    fresnelSchlickPS,
    fullscreenQuadPS,
    fullscreenQuadVS,
    gamma1_0PS,
    gamma2_2PS,
    gles2PS,
    gles3PS,
    gles3VS,
    glossPS,
    iridescenceDiffractionPS,
    iridescencePS,
    iridescenceThicknessPS,
    instancingVS,
    iorPS,
    lightDiffuseLambertPS,
    lightDirPointPS,
    lightmapAddPS,
    lightmapDirAddPS,
    lightmapDirPS,
    lightmapSinglePS,
    lightSpecularAnisoGGXPS,
    lightSpecularBlinnPS,
    lightSpecularPhongPS,
    lightSheenPS,
    linearizeDepthPS,
    litShaderArgsPS,
    ltcPS,
    metalnessPS,
    metalnessModulatePS,
    msdfPS,
    msdfVS,
    normalVS,
    normalDetailMapPS,
    normalInstancedVS,
    normalMapPS,
    normalSkinnedVS,
    normalXYPS,
    normalXYZPS,
    opacityPS,
    outputPS,
    outputAlphaPS,
    outputAlphaOpaquePS,
    outputAlphaPremulPS,
    outputTex2DPS,
    packDepthPS,
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
    particle_softPS,
    particle_softVS,
    particle_stretchVS,
    particle_TBNVS,
    particle_wrapVS,
    reflDirPS,
    reflDirAnisoPS,
    reflectionCCPS,
    reflectionCubePS,
    reflectionEnvHQPS,
    reflectionEnvPS,
    reflectionSpherePS,
    reflectionSphereLowPS,
    reflectionSheenPS,
    refractionCubePS,
    refractionDynamicPS,
    reprojectPS,
    screenDepthPS,
    shadowCascadesPS,
    shadowEVSMPS,
    shadowEVSMnPS,
    shadowPCSSPS,
    shadowSampleCoordPS,
    shadowStandardPS,
    shadowStandardGL2PS,
    shadowVSM8PS,
    shadowVSM_commonPS,
    skinBatchConstVS,
    skinBatchTexVS,
    skinConstVS,
    skinTexVS,
    skyboxEnvPS,
    skyboxHDRPS,
    skyboxVS,
    specularPS,
    sphericalPS,
    specularityFactorPS,
    spotPS,
    startPS,
    startVS,
    startNineSlicedPS,
    startNineSlicedTiledPS,
    storeEVSMPS,
    tangentBinormalVS,
    TBNPS,
    TBNderivativePS,
    TBNfastPS,
    TBNObjectSpacePS,
    textureSamplePS,
    thicknessPS,
    tonemappingAcesPS,
    tonemappingAces2PS,
    tonemappingFilmicPS,
    tonemappingHejlPS,
    tonemappingLinearPS,
    tonemappingNonePS,
    transformVS,
    transformDeclVS,
    transmissionPS,
    uv0VS,
    uv1VS,
    viewDirPS,
    viewNormalVS,
    webgpuPS,
    webgpuVS
};

export { shaderChunks };
