import alphaTestPS from './standard/alphaTest.frag.js';
import ambientConstantPS from './lit/ambientConstant.frag.js';
import ambientEnvPS from './lit/ambientEnv.frag.js';
import ambientSHPS from './lit/ambientSH.frag.js';
import aoPS from './standard/ao.frag.js';
import aoDiffuseOccPS from './lit/aoDiffuseOcc.frag.js';
import aoSpecOccPS from './lit/aoSpecOcc.frag.js';
import aoSpecOccConstPS from './lit/aoSpecOccConst.frag.js';
import aoSpecOccConstSimplePS from './lit/aoSpecOccConstSimple.frag.js';
import aoSpecOccSimplePS from './lit/aoSpecOccSimple.frag.js';
import bakeDirLmEndPS from './lightmapper/bakeDirLmEnd.frag.js';
import bakeLmEndPS from './lightmapper/bakeLmEnd.frag.js';
import basePS from './lit/base.frag.js';
import baseVS from './lit/base.vert.js';
import baseNineSlicedPS from './lit/baseNineSliced.frag.js';
import baseNineSlicedVS from './lit/baseNineSliced.vert.js';
import baseNineSlicedTiledPS from './lit/baseNineSlicedTiled.frag.js';
import biasConstPS from './lit/biasConst.frag.js';
import blurVSMPS from './lit/blurVSM.frag.js';
import clearCoatPS from './standard/clearCoat.frag.js';
import clearCoatGlossPS from './standard/clearCoatGloss.frag.js';
import clearCoatNormalPS from './standard/clearCoatNormal.frag.js';
import clusteredLightUtilsPS from './lit/clusteredLightUtils.frag.js';
import clusteredLightCookiesPS from './lit/clusteredLightCookies.frag.js';
import clusteredLightShadowsPS from './lit/clusteredLightShadows.frag.js';
import clusteredLightPS from './lit/clusteredLight.frag.js';
import combineClearCoatPS from './lit/combineClearCoat.frag.js';
import combineDiffusePS from './lit/combineDiffuse.frag.js';
import combineDiffuseSpecularPS from './lit/combineDiffuseSpecular.frag.js';
import combineDiffuseSpecularNoConservePS from './lit/combineDiffuseSpecularNoConserve.frag.js';
import combineDiffuseSpecularNoReflPS from './lit/combineDiffuseSpecularNoRefl.frag.js';
import combineDiffuseSpecularNoReflSeparateAmbientPS from './lit/combineDiffuseSpecularNoReflSeparateAmbient.frag.js';
import combineDiffuseSpecularOldPS from './lit/combineDiffuseSpecularOld.frag.js';
import cookiePS from './lit/cookie.frag.js';
import cubeMapProjectBoxPS from './lit/cubeMapProjectBox.frag.js';
import cubeMapProjectNonePS from './lit/cubeMapProjectNone.frag.js';
import cubeMapRotatePS from './lit/cubeMapRotate.frag.js';
import decodePS from './decode.frag.js';
import detailModesPS from './standard/detailModes.frag.js';
import diffusePS from './standard/diffuse.frag.js';
import diffuseDetailMapPS from './standard/diffuseDetailMap.frag.js';
import dilatePS from './lightmapper/dilate.frag.js';
import bilateralDeNoisePS from './lightmapper/bilateralDeNoise.frag.js';
import emissivePS from './standard/emissive.frag.js';
import endPS from './lit/end.frag.js';
import endVS from './lit/end.vert.js';
import envConstPS from './envConst.frag.js';
import envMultiplyPS from './envMultiply.frag.js';
import extensionPS from './lit/extension.frag.js';
import extensionVS from './lit/extension.vert.js';
import falloffInvSquaredPS from './lit/falloffInvSquared.frag.js';
import falloffLinearPS from './lit/falloffLinear.frag.js';
import fixCubemapSeamsNonePS from './fixCubemapSeamsNone.frag.js';
import fixCubemapSeamsStretchPS from './fixCubemapSeamsStretch.frag.js';
import floatUnpackingPS from './lit/float-unpacking.frag.js';
import fogExpPS from './lit/fogExp.frag.js';
import fogExp2PS from './lit/fogExp2.frag.js';
import fogLinearPS from './lit/fogLinear.frag.js';
import fogNonePS from './lit/fogNone.frag.js';
import fresnelSchlickPS from './lit/fresnelSchlick.frag.js';
import fullscreenQuadPS from './fullscreenQuad.frag.js';
import fullscreenQuadVS from './fullscreenQuad.vert.js';
import gamma1_0PS from './gamma1_0.frag.js';
import gamma2_2PS from './gamma2_2.frag.js';
import gles3PS from './gles3.frag.js';
import gles3VS from './gles3.vert.js';
import glossPS from './standard/gloss.frag.js';
import instancingVS from './lit/instancing.vert.js';
import lightDiffuseLambertPS from './lit/lightDiffuseLambert.frag.js';
import lightDirPointPS from './lit/lightDirPoint.frag.js';
import lightmapDirPS from './lit/lightmapDir.frag.js';
import lightmapSinglePS from './lit/lightmapSingle.frag.js';
import lightmapSingleVertPS from './lit/lightmapSingleVert.frag.js';
import lightSpecularAnisoGGXPS from './lit/lightSpecularAnisoGGX.frag.js';
import lightSpecularBlinnPS from './lit/lightSpecularBlinn.frag.js';
import lightSpecularPhongPS from './lit/lightSpecularPhong.frag.js';
import ltc from './lit/ltc.frag.js';
import metalnessPS from './standard/metalness.frag.js';
import msdfPS from './msdf.frag.js';
import normalVS from './lit/normal.vert.js';
import normalDetailMapPS from './standard/normalDetailMap.frag.js';
import normalInstancedVS from './lit/normalInstanced.vert.js';
import normalMapPS from './standard/normalMap.frag.js';
import normalMapFastPS from './standard/normalMapFast.frag.js';
import normalSkinnedVS from './lit/normalSkinned.vert.js';
import normalVertexPS from './lit/normalVertex.frag.js';
import normalXYPS from './standard/normalXY.frag.js';
import normalXYZPS from './standard/normalXYZ.frag.js';
import opacityPS from './standard/opacity.frag.js';
import outputAlphaPS from './lit/outputAlpha.frag.js';
import outputAlphaOpaquePS from './lit/outputAlphaOpaque.frag.js';
import outputAlphaPremulPS from './lit/outputAlphaPremul.frag.js';
import outputTex2DPS from './outputTex2D.frag.js';
import packDepthPS from './packDepth.frag.js';
import parallaxPS from './standard/parallax.frag.js';
import particlePS from './particle/particle.frag.js';
import particleVS from './particle/particle.vert.js';
import particleAnimFrameClampVS from './particle/particleAnimFrameClamp.vert.js';
import particleAnimFrameLoopVS from './particle/particleAnimFrameLoop.vert.js';
import particleAnimTexVS from './particle/particleAnimTex.vert.js';
import particleInputFloatPS from './particle/particleInputFloat.frag.js';
import particleInputRgba8PS from './particle/particleInputRgba8.frag.js';
import particleOutputFloatPS from './particle/particleOutputFloat.frag.js';
import particleOutputRgba8PS from './particle/particleOutputRgba8.frag.js';
import particleUpdaterAABBPS from './particle/particleUpdaterAABB.frag.js';
import particleUpdaterEndPS from './particle/particleUpdaterEnd.frag.js';
import particleUpdaterInitPS from './particle/particleUpdaterInit.frag.js';
import particleUpdaterNoRespawnPS from './particle/particleUpdaterNoRespawn.frag.js';
import particleUpdaterOnStopPS from './particle/particleUpdaterOnStop.frag.js';
import particleUpdaterRespawnPS from './particle/particleUpdaterRespawn.frag.js';
import particleUpdaterSpherePS from './particle/particleUpdaterSphere.frag.js';
import particleUpdaterStartPS from './particle/particleUpdaterStart.frag.js';
import particle_billboardVS from './particle/particle_billboard.vert.js';
import particle_blendAddPS from './particle/particle_blendAdd.frag.js';
import particle_blendMultiplyPS from './particle/particle_blendMultiply.frag.js';
import particle_blendNormalPS from './particle/particle_blendNormal.frag.js';
import particle_cpuVS from './particle/particle_cpu.vert.js';
import particle_cpu_endVS from './particle/particle_cpu_end.vert.js';
import particle_customFaceVS from './particle/particle_customFace.vert.js';
import particle_endPS from './particle/particle_end.frag.js';
import particle_endVS from './particle/particle_end.vert.js';
import particle_halflambertPS from './particle/particle_halflambert.frag.js';
import particle_initVS from './particle/particle_init.vert.js';
import particle_lambertPS from './particle/particle_lambert.frag.js';
import particle_lightingPS from './particle/particle_lighting.frag.js';
import particle_localShiftVS from './particle/particle_localShift.vert.js';
import particle_meshVS from './particle/particle_mesh.vert.js';
import particle_normalVS from './particle/particle_normal.vert.js';
import particle_normalMapPS from './particle/particle_normalMap.frag.js';
import particle_pointAlongVS from './particle/particle_pointAlong.vert.js';
import particle_softPS from './particle/particle_soft.frag.js';
import particle_softVS from './particle/particle_soft.vert.js';
import particle_stretchVS from './particle/particle_stretch.vert.js';
import particle_TBNVS from './particle/particle_TBN.vert.js';
import particle_wrapVS from './particle/particle_wrap.vert.js';
import precisionTestPS from './precisionTest.frag.js';
import precisionTest2PS from './precisionTest2.frag.js';
import reflDirPS from './lit/reflDir.frag.js';
import reflDirAnisoPS from './lit/reflDirAniso.frag.js';
import reflectionCCPS from './lit/reflectionCC.frag.js';
import reflectionCubePS from './lit/reflectionCube.frag.js';
import reflectionEnvPS from './lit/reflectionEnv.frag.js';
import reflectionSpherePS from './lit/reflectionSphere.frag.js';
import reflectionSphereLowPS from './lit/reflectionSphereLow.frag.js';
import refractionPS from './lit/refraction.frag.js';
import reprojectPS from './reproject.frag.js';
import rgbmPS from './rgbm.frag.js';
import screenDepthPS from './screenDepth.frag.js';
import shadowCascadesPS from './lit/shadowCascades.frag.js';
import shadowCommonPS from './lit/shadowCommon.frag.js';
import shadowCoordPS from './lit/shadowCoord.frag.js';
import shadowCoordPerspZbufferPS from './lit/shadowCoordPerspZbuffer.frag.js';
import shadowEVSMPS from './lit/shadowEVSM.frag.js';
import shadowEVSMnPS from './lit/shadowEVSMn.frag.js';
import shadowStandardPS from './lit/shadowStandard.frag.js';
import shadowStandardGL2PS from './lit/shadowStandardGL2.frag.js';
import shadowVSM8PS from './lit/shadowVSM8.frag.js';
import shadowVSM_commonPS from './lit/shadowVSM_common.frag.js';
import skinBatchConstVS from './skinBatchConst.vert.js';
import skinBatchTexVS from './skinBatchTex.vert.js';
import skinConstVS from './skinConst.vert.js';
import skinTexVS from './skinTex.vert.js';
import skyboxEnvPS from './skybox/skyboxEnv.frag.js';
import skyboxHDRPS from './skybox/skyboxHDR.frag.js';
import skyboxVS from './skybox/skybox.vert.js';
import specularPS from './standard/specular.frag.js';
import specularAaNonePS from './lit/specularAaNone.frag.js';
import specularAaToksvigPS from './lit/specularAaToksvig.frag.js';
import specularAaToksvigFastPS from './lit/specularAaToksvigFast.frag.js';
import spotPS from './lit/spot.frag.js';
import startPS from './lit/start.frag.js';
import startVS from './lit/start.vert.js';
import startNineSlicedPS from './lit/startNineSliced.frag.js';
import startNineSlicedTiledPS from './lit/startNineSlicedTiled.frag.js';
import storeEVSMPS from './lit/storeEVSM.frag.js';
import tangentBinormalVS from './lit/tangentBinormal.vert.js';
import TBNPS from './lit/TBN.frag.js';
import TBNderivativePS from './lit/TBNderivative.frag.js';
import TBNfastPS from './lit/TBNfast.frag.js';
import TBNObjectSpacePS from './lit/TBNObjectSpace.frag.js';
import tonemappingAcesPS from './tonemappingAces.frag.js';
import tonemappingAces2PS from './tonemappingAces2.frag.js';
import tonemappingFilmicPS from './tonemappingFilmic.frag.js';
import tonemappingHejlPS from './tonemappingHejl.frag.js';
import tonemappingLinearPS from './tonemappingLinear.frag.js';
import tonemappingNonePS from './tonemappingNone.frag.js';
import transformVS from './transform.vert.js';
import transformDeclVS from './transformDecl.vert.js';
import uv0VS from './lit/uv0.vert.js';
import uv1VS from './lit/uv1.vert.js';
import viewDirPS from './lit/viewDir.frag.js';
import viewNormalVS from './lit/viewNormal.vert.js';

/**
 * @static
 * @readonly
 * @type {object}
 * @name shaderChunks
 * @description Object containing all default shader chunks used by shader generators.
 */
const shaderChunks = {
    alphaTestPS,
    ambientConstantPS,
    ambientEnvPS,
    ambientSHPS,
    aoPS,
    aoDiffuseOccPS,
    aoSpecOccPS,
    aoSpecOccConstPS,
    aoSpecOccConstSimplePS,
    aoSpecOccSimplePS,
    bakeDirLmEndPS,
    bakeLmEndPS,
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
    combineClearCoatPS,
    combineDiffusePS,
    combineDiffuseSpecularPS,
    combineDiffuseSpecularNoConservePS,
    combineDiffuseSpecularNoReflPS,
    combineDiffuseSpecularNoReflSeparateAmbientPS,
    combineDiffuseSpecularOldPS,
    cookiePS,
    cubeMapProjectBoxPS,
    cubeMapProjectNonePS,
    cubeMapRotatePS,
    detailModesPS,
    diffusePS,
    diffuseDetailMapPS,
    dilatePS,
    bilateralDeNoisePS,
    decodePS,
    emissivePS,
    endPS,
    endVS,
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
    gles3PS,
    gles3VS,
    glossPS,
    instancingVS,
    lightDiffuseLambertPS,
    lightDirPointPS,
    lightmapDirPS,
    lightmapSinglePS,
    lightmapSingleVertPS,
    lightSpecularAnisoGGXPS,
    lightSpecularBlinnPS,
    lightSpecularPhongPS,
    ltc,
    metalnessPS,
    msdfPS,
    normalVS,
    normalDetailMapPS,
    normalInstancedVS,
    normalMapPS,
    normalMapFastPS,
    normalSkinnedVS,
    normalVertexPS,
    normalXYPS,
    normalXYZPS,
    opacityPS,
    outputAlphaPS,
    outputAlphaOpaquePS,
    outputAlphaPremulPS,
    outputTex2DPS,
    packDepthPS,
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
    precisionTestPS,
    precisionTest2PS,
    reflDirPS,
    reflDirAnisoPS,
    reflectionCCPS,
    reflectionCubePS,
    reflectionEnvPS,
    reflectionSpherePS,
    reflectionSphereLowPS,
    refractionPS,
    reprojectPS,
    rgbmPS,
    screenDepthPS,
    shadowCascadesPS,
    shadowCommonPS,
    shadowCoordPS,
    shadowCoordPerspZbufferPS,
    shadowEVSMPS,
    shadowEVSMnPS,
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
    specularAaNonePS,
    specularAaToksvigPS,
    specularAaToksvigFastPS,
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
    tonemappingAcesPS,
    tonemappingAces2PS,
    tonemappingFilmicPS,
    tonemappingHejlPS,
    tonemappingLinearPS,
    tonemappingNonePS,
    transformVS,
    transformDeclVS,
    uv0VS,
    uv1VS,
    viewDirPS,
    viewNormalVS
};

export { shaderChunks };
