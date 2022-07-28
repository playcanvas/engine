import alphaTestPS from './standard/frag/alphaTest.js';
import ambientConstantPS from './lit/frag/ambientConstant.js';
import ambientEnvPS from './lit/frag/ambientEnv.js';
import ambientSHPS from './lit/frag/ambientSH.js';
import aoPS from './standard/frag/ao.js';
import aoDiffuseOccPS from './lit/frag/aoDiffuseOcc.js';
import aoSpecOccPS from './lit/frag/aoSpecOcc.js';
import aoSpecOccConstPS from './lit/frag/aoSpecOccConst.js';
import aoSpecOccConstSimplePS from './lit/frag/aoSpecOccConstSimple.js';
import aoSpecOccSimplePS from './lit/frag/aoSpecOccSimple.js';
import bakeDirLmEndPS from './lightmapper/frag/bakeDirLmEnd.js';
import bakeLmEndPS from './lightmapper/frag/bakeLmEnd.js';
import basePS from './lit/frag/base.js';
import baseVS from './lit/vert/base.js';
import baseNineSlicedPS from './lit/frag/baseNineSliced.js';
import baseNineSlicedVS from './lit/vert/baseNineSliced.js';
import baseNineSlicedTiledPS from './lit/frag/baseNineSlicedTiled.js';
import biasConstPS from './lit/frag/biasConst.js';
import blurVSMPS from './lit/frag/blurVSM.js';
import clearCoatPS from './standard/frag/clearCoat.js';
import clearCoatGlossPS from './standard/frag/clearCoatGloss.js';
import clearCoatNormalPS from './standard/frag/clearCoatNormal.js';
import clusteredLightUtilsPS from './lit/frag/clusteredLightUtils.js';
import clusteredLightCookiesPS from './lit/frag/clusteredLightCookies.js';
import clusteredLightShadowsPS from './lit/frag/clusteredLightShadows.js';
import clusteredLightPS from './lit/frag/clusteredLight.js';
import combinePS from './lit/frag/combine.js';
import cookiePS from './lit/frag/cookie.js';
import cubeMapProjectBoxPS from './lit/frag/cubeMapProjectBox.js';
import cubeMapProjectNonePS from './lit/frag/cubeMapProjectNone.js';
import cubeMapRotatePS from './lit/frag/cubeMapRotate.js';
import decodePS from './common/frag/decode.js';
import detailModesPS from './standard/frag/detailModes.js';
import diffusePS from './standard/frag/diffuse.js';
import diffuseDetailMapPS from './standard/frag/diffuseDetailMap.js';
import dilatePS from './lightmapper/frag/dilate.js';
import bilateralDeNoisePS from './lightmapper/frag/bilateralDeNoise.js';
import emissivePS from './standard/frag/emissive.js';
import encodePS from './common/frag/encode.js';
import endPS from './lit/frag/end.js';
import endVS from './lit/vert/end.js';
import envAtlasPS from './common/frag/envAtlas.js';
import envConstPS from './common/frag/envConst.js';
import envMultiplyPS from './common/frag/envMultiply.js';
import extensionPS from './lit/frag/extension.js';
import extensionVS from './lit/vert/extension.js';
import falloffInvSquaredPS from './lit/frag/falloffInvSquared.js';
import falloffLinearPS from './lit/frag/falloffLinear.js';
import fixCubemapSeamsNonePS from './common/frag/fixCubemapSeamsNone.js';
import fixCubemapSeamsStretchPS from './common/frag/fixCubemapSeamsStretch.js';
import floatUnpackingPS from './lit/frag/float-unpacking.js';
import fogExpPS from './lit/frag/fogExp.js';
import fogExp2PS from './lit/frag/fogExp2.js';
import fogLinearPS from './lit/frag/fogLinear.js';
import fogNonePS from './lit/frag/fogNone.js';
import fresnelSchlickPS from './lit/frag/fresnelSchlick.js';
import fullscreenQuadPS from './common/frag/fullscreenQuad.js';
import fullscreenQuadVS from './common/vert/fullscreenQuad.js';
import gamma1_0PS from './common/frag/gamma1_0.js';
import gamma2_2PS from './common/frag/gamma2_2.js';
import gles3PS from './common/frag/gles3.js';
import gles3VS from './common/vert/gles3.js';
import glossPS from './standard/frag/gloss.js';
import instancingVS from './lit/vert/instancing.js';
import lightDiffuseLambertPS from './lit/frag/lightDiffuseLambert.js';
import lightDirPointPS from './lit/frag/lightDirPoint.js';
import lightmapAddPS from './lit/frag/lightmapAdd.js';
import lightmapDirAddPS from './lit/frag/lightmapDirAdd.js';
import lightmapDirPS from './standard/frag/lightmapDir.js';
import lightmapSinglePS from './standard/frag/lightmapSingle.js';
import lightSpecularAnisoGGXPS from './lit/frag/lightSpecularAnisoGGX.js';
import lightSpecularBlinnPS from './lit/frag/lightSpecularBlinn.js';
import lightSpecularPhongPS from './lit/frag/lightSpecularPhong.js';
import ltc from './lit/frag/ltc.js';
import metalnessPS from './standard/frag/metalness.js';
import msdfPS from './common/frag/msdf.js';
import metalnessModulatePS from './lit/frag/metalnessModulate.js';
import msdfVS from './common/vert/msdf.js';
import normalVS from './lit/vert/normal.js';
import normalDetailMapPS from './standard/frag/normalDetailMap.js';
import normalInstancedVS from './lit/vert/normalInstanced.js';
import normalMapPS from './standard/frag/normalMap.js';
import normalSkinnedVS from './lit/vert/normalSkinned.js';
import normalXYPS from './standard/frag/normalXY.js';
import normalXYZPS from './standard/frag/normalXYZ.js';
import opacityPS from './standard/frag/opacity.js';
import outputAlphaPS from './lit/frag/outputAlpha.js';
import outputAlphaOpaquePS from './lit/frag/outputAlphaOpaque.js';
import outputAlphaPremulPS from './lit/frag/outputAlphaPremul.js';
import outputTex2DPS from './common/frag/outputTex2D.js';
import packDepthPS from './common/frag/packDepth.js';
import sheenPS from './standard/frag/sheen.js';
import sheenGlossPS from './standard/frag/sheenGloss.js';
import sheenCharliePS from './lit/frag/sheenCharlie.js';
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
import particle_softPS from './particle/frag/particle_soft.js';
import particle_softVS from './particle/vert/particle_soft.js';
import particle_stretchVS from './particle/vert/particle_stretch.js';
import particle_TBNVS from './particle/vert/particle_TBN.js';
import particle_wrapVS from './particle/vert/particle_wrap.js';
import precisionTestPS from './common/frag/precisionTest.js';
import precisionTest2PS from './common/frag/precisionTest2.js';
import reflDirPS from './lit/frag/reflDir.js';
import reflDirAnisoPS from './lit/frag/reflDirAniso.js';
import reflectionCCPS from './lit/frag/reflectionCC.js';
import reflectionCubePS from './lit/frag/reflectionCube.js';
import reflectionEnvPS from './lit/frag/reflectionEnv.js';
import reflectionSpherePS from './lit/frag/reflectionSphere.js';
import reflectionSphereLowPS from './lit/frag/reflectionSphereLow.js';
import refractionPS from './lit/frag/refraction.js';
import reprojectPS from './common/frag/reproject.js';
import screenDepthPS from './common/frag/screenDepth.js';
import shadowCascadesPS from './lit/frag/shadowCascades.js';
import shadowCommonPS from './lit/frag/shadowCommon.js';
import shadowCoordPS from './lit/frag/shadowCoord.js';
import shadowCoordPerspZbufferPS from './lit/frag/shadowCoordPerspZbuffer.js';
import shadowEVSMPS from './lit/frag/shadowEVSM.js';
import shadowEVSMnPS from './lit/frag/shadowEVSMn.js';
import shadowStandardPS from './lit/frag/shadowStandard.js';
import shadowStandardGL2PS from './lit/frag/shadowStandardGL2.js';
import shadowVSM8PS from './lit/frag/shadowVSM8.js';
import shadowVSM_commonPS from './lit/frag/shadowVSM_common.js';
import skinBatchConstVS from './common/vert/skinBatchConst.js';
import skinBatchTexVS from './common/vert/skinBatchTex.js';
import skinConstVS from './common/vert/skinConst.js';
import skinTexVS from './common/vert/skinTex.js';
import skyboxEnvPS from './skybox/frag/skyboxEnv.js';
import skyboxHDRPS from './skybox/frag/skyboxHDR.js';
import skyboxVS from './skybox/vert/skybox.js';
import specularPS from './standard/frag/specular.js';
import sphericalPS from './common/frag/spherical.js';
import specularityFactorPS from './standard/frag/specularityFactor.js';
import spotPS from './lit/frag/spot.js';
import startPS from './lit/frag/start.js';
import startVS from './lit/vert/start.js';
import startNineSlicedPS from './lit/frag/startNineSliced.js';
import startNineSlicedTiledPS from './lit/frag/startNineSlicedTiled.js';
import storeEVSMPS from './lit/frag/storeEVSM.js';
import tangentBinormalVS from './lit/vert/tangentBinormal.js';
import TBNPS from './lit/frag/TBN.js';
import TBNderivativePS from './lit/frag/TBNderivative.js';
import TBNfastPS from './lit/frag/TBNfast.js';
import TBNObjectSpacePS from './lit/frag/TBNObjectSpace.js';
import textureSamplePS from './standard/frag/textureSample.js';
import tonemappingAcesPS from './common/frag/tonemappingAces.js';
import tonemappingAces2PS from './common/frag/tonemappingAces2.js';
import tonemappingFilmicPS from './common/frag/tonemappingFilmic.js';
import tonemappingHejlPS from './common/frag/tonemappingHejl.js';
import tonemappingLinearPS from './common/frag/tonemappingLinear.js';
import tonemappingNonePS from './common/frag/tonemappingNone.js';
import transformVS from './common/vert/transform.js';
import transformDeclVS from './common/vert/transformDecl.js';
import transmissionPS from './standard/frag/transmission.js';
import uv0VS from './lit/vert/uv0.js';
import uv1VS from './lit/vert/uv1.js';
import viewDirPS from './lit/frag/viewDir.js';
import viewNormalVS from './lit/vert/viewNormal.js';

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
    combinePS,
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
    gles3PS,
    gles3VS,
    glossPS,
    instancingVS,
    lightDiffuseLambertPS,
    lightDirPointPS,
    lightmapAddPS,
    lightmapDirAddPS,
    lightmapDirPS,
    lightmapSinglePS,
    lightSpecularAnisoGGXPS,
    lightSpecularBlinnPS,
    lightSpecularPhongPS,
    ltc,
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
    outputAlphaPS,
    outputAlphaOpaquePS,
    outputAlphaPremulPS,
    outputTex2DPS,
    packDepthPS,
    sheenPS,
    sheenGlossPS,
    sheenCharliePS,
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
    viewNormalVS
};

export { shaderChunks };
