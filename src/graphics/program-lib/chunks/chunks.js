import alphaTestPS from './alphaTest.frag.js';
import ambientConstantPS from './ambientConstant.frag.js';
import ambientEnvPS from './ambientEnv.frag.js';
import ambientSHPS from './ambientSH.frag.js';
import aoPS from './ao.frag.js';
import aoSpecOccPS from './aoSpecOcc.frag.js';
import aoSpecOccConstPS from './aoSpecOccConst.frag.js';
import aoSpecOccConstSimplePS from './aoSpecOccConstSimple.frag.js';
import aoSpecOccSimplePS from './aoSpecOccSimple.frag.js';
import bakeDirLmEndPS from './bakeDirLmEnd.frag.js';
import bakeLmEndPS from './bakeLmEnd.frag.js';
import basePS from './base.frag.js';
import baseVS from './base.vert.js';
import baseNineSlicedPS from './baseNineSliced.frag.js';
import baseNineSlicedVS from './baseNineSliced.vert.js';
import baseNineSlicedTiledPS from './baseNineSlicedTiled.frag.js';
import biasConstPS from './biasConst.frag.js';
import blurVSMPS from './blurVSM.frag.js';
import clearCoatPS from './clearCoat.frag.js';
import clearCoatGlossPS from './clearCoatGloss.frag.js';
import clearCoatNormalPS from './clearCoatNormal.frag.js';
import clusteredLightUtilsPS from './clusteredLightUtils.frag.js';
import clusteredLightCookiesPS from './clusteredLightCookies.frag.js';
import clusteredLightShadowsPS from './clusteredLightShadows.frag.js';
import clusteredLightPS from './clusteredLight.frag.js';
import combineClearCoatPS from './combineClearCoat.frag.js';
import combineDiffusePS from './combineDiffuse.frag.js';
import combineDiffuseSpecularPS from './combineDiffuseSpecular.frag.js';
import combineDiffuseSpecularNoConservePS from './combineDiffuseSpecularNoConserve.frag.js';
import combineDiffuseSpecularNoReflPS from './combineDiffuseSpecularNoRefl.frag.js';
import combineDiffuseSpecularNoReflSeparateAmbientPS from './combineDiffuseSpecularNoReflSeparateAmbient.frag.js';
import combineDiffuseSpecularOldPS from './combineDiffuseSpecularOld.frag.js';
import cookiePS from './cookie.frag.js';
import cubeMapProjectBoxPS from './cubeMapProjectBox.frag.js';
import cubeMapProjectNonePS from './cubeMapProjectNone.frag.js';
import cubeMapRotatePS from './cubeMapRotate.frag.js';
import decodePS from './decode.frag.js';
import detailModesPS from './detailModes.frag.js';
import diffusePS from './diffuse.frag.js';
import diffuseDetailMapPS from './diffuseDetailMap.frag.js';
import dilatePS from './dilate.frag.js';
import bilateralDeNoisePS from './bilateralDeNoise.frag.js';
import emissivePS from './emissive.frag.js';
import endPS from './end.frag.js';
import endVS from './end.vert.js';
import envConstPS from './envConst.frag.js';
import envMultiplyPS from './envMultiply.frag.js';
import extensionPS from './extension.frag.js';
import extensionVS from './extension.vert.js';
import falloffInvSquaredPS from './falloffInvSquared.frag.js';
import falloffLinearPS from './falloffLinear.frag.js';
import fixCubemapSeamsNonePS from './fixCubemapSeamsNone.frag.js';
import fixCubemapSeamsStretchPS from './fixCubemapSeamsStretch.frag.js';
import floatUnpackingPS from './float-unpacking.frag.js';
import fogExpPS from './fogExp.frag.js';
import fogExp2PS from './fogExp2.frag.js';
import fogLinearPS from './fogLinear.frag.js';
import fogNonePS from './fogNone.frag.js';
import fresnelSchlickPS from './fresnelSchlick.frag.js';
import fullscreenQuadPS from './fullscreenQuad.frag.js';
import fullscreenQuadVS from './fullscreenQuad.vert.js';
import gamma1_0PS from './gamma1_0.frag.js';
import gamma2_2PS from './gamma2_2.frag.js';
import gles3PS from './gles3.frag.js';
import gles3VS from './gles3.vert.js';
import glossPS from './gloss.frag.js';
import instancingVS from './instancing.vert.js';
import lightDiffuseLambertPS from './lightDiffuseLambert.frag.js';
import lightDirPointPS from './lightDirPoint.frag.js';
import lightmapDirPS from './lightmapDir.frag.js';
import lightmapSinglePS from './lightmapSingle.frag.js';
import lightmapSingleVertPS from './lightmapSingleVert.frag.js';
import lightSpecularAnisoGGXPS from './lightSpecularAnisoGGX.frag.js';
import lightSpecularBlinnPS from './lightSpecularBlinn.frag.js';
import lightSpecularPhongPS from './lightSpecularPhong.frag.js';
import ltc from './ltc.frag.js';
import metalnessPS from './metalness.frag.js';
import msdfPS from './msdf.frag.js';
import normalVS from './normal.vert.js';
import normalDetailMapPS from './normalDetailMap.frag.js';
import normalInstancedVS from './normalInstanced.vert.js';
import normalMapPS from './normalMap.frag.js';
import normalMapFastPS from './normalMapFast.frag.js';
import normalSkinnedVS from './normalSkinned.vert.js';
import normalVertexPS from './normalVertex.frag.js';
import normalXYPS from './normalXY.frag.js';
import normalXYZPS from './normalXYZ.frag.js';
import opacityPS from './opacity.frag.js';
import outputAlphaPS from './outputAlpha.frag.js';
import outputAlphaOpaquePS from './outputAlphaOpaque.frag.js';
import outputAlphaPremulPS from './outputAlphaPremul.frag.js';
import outputCubemapPS from './outputCubemap.frag.js';
import outputTex2DPS from './outputTex2D.frag.js';
import packDepthPS from './packDepth.frag.js';
import packDepthMaskPS from './packDepthMask.frag.js';
import parallaxPS from './parallax.frag.js';
import particlePS from './particle.frag.js';
import particleVS from './particle.vert.js';
import particleAnimFrameClampVS from './particleAnimFrameClamp.vert.js';
import particleAnimFrameLoopVS from './particleAnimFrameLoop.vert.js';
import particleAnimTexVS from './particleAnimTex.vert.js';
import particleInputFloatPS from './particleInputFloat.frag.js';
import particleInputRgba8PS from './particleInputRgba8.frag.js';
import particleOutputFloatPS from './particleOutputFloat.frag.js';
import particleOutputRgba8PS from './particleOutputRgba8.frag.js';
import particleUpdaterAABBPS from './particleUpdaterAABB.frag.js';
import particleUpdaterEndPS from './particleUpdaterEnd.frag.js';
import particleUpdaterInitPS from './particleUpdaterInit.frag.js';
import particleUpdaterNoRespawnPS from './particleUpdaterNoRespawn.frag.js';
import particleUpdaterOnStopPS from './particleUpdaterOnStop.frag.js';
import particleUpdaterRespawnPS from './particleUpdaterRespawn.frag.js';
import particleUpdaterSpherePS from './particleUpdaterSphere.frag.js';
import particleUpdaterStartPS from './particleUpdaterStart.frag.js';
import particle_billboardVS from './particle_billboard.vert.js';
import particle_blendAddPS from './particle_blendAdd.frag.js';
import particle_blendMultiplyPS from './particle_blendMultiply.frag.js';
import particle_blendNormalPS from './particle_blendNormal.frag.js';
import particle_cpuVS from './particle_cpu.vert.js';
import particle_cpu_endVS from './particle_cpu_end.vert.js';
import particle_customFaceVS from './particle_customFace.vert.js';
import particle_endPS from './particle_end.frag.js';
import particle_endVS from './particle_end.vert.js';
import particle_halflambertPS from './particle_halflambert.frag.js';
import particle_initVS from './particle_init.vert.js';
import particle_lambertPS from './particle_lambert.frag.js';
import particle_lightingPS from './particle_lighting.frag.js';
import particle_localShiftVS from './particle_localShift.vert.js';
import particle_meshVS from './particle_mesh.vert.js';
import particle_normalVS from './particle_normal.vert.js';
import particle_normalMapPS from './particle_normalMap.frag.js';
import particle_pointAlongVS from './particle_pointAlong.vert.js';
import particle_softPS from './particle_soft.frag.js';
import particle_softVS from './particle_soft.vert.js';
import particle_stretchVS from './particle_stretch.vert.js';
import particle_TBNVS from './particle_TBN.vert.js';
import particle_wrapVS from './particle_wrap.vert.js';
import precisionTestPS from './precisionTest.frag.js';
import precisionTest2PS from './precisionTest2.frag.js';
import reflDirPS from './reflDir.frag.js';
import reflDirAnisoPS from './reflDirAniso.frag.js';
import reflectionCCPS from './reflectionCC.frag.js';
import reflectionCubePS from './reflectionCube.frag.js';
import reflectionEnvPS from './reflectionEnv.frag.js';
import reflectionSpherePS from './reflectionSphere.frag.js';
import reflectionSphereLowPS from './reflectionSphereLow.frag.js';
import refractionPS from './refraction.frag.js';
import reprojectPS from './reproject.frag.js';
import rgbmPS from './rgbm.frag.js';
import screenDepthPS from './screenDepth.frag.js';
import shadowCascadesPS from './shadowCascades.frag.js';
import shadowCommonPS from './shadowCommon.frag.js';
import shadowCoordPS from './shadowCoord.frag.js';
import shadowCoordPerspZbufferPS from './shadowCoordPerspZbuffer.frag.js';
import shadowEVSMPS from './shadowEVSM.frag.js';
import shadowEVSMnPS from './shadowEVSMn.frag.js';
import shadowStandardPS from './shadowStandard.frag.js';
import shadowStandardGL2PS from './shadowStandardGL2.frag.js';
import shadowVSM8PS from './shadowVSM8.frag.js';
import shadowVSM_commonPS from './shadowVSM_common.frag.js';
import skinBatchConstVS from './skinBatchConst.vert.js';
import skinBatchTexVS from './skinBatchTex.vert.js';
import skinConstVS from './skinConst.vert.js';
import skinTexVS from './skinTex.vert.js';
import skyboxEnvPS from './skyboxEnv.frag.js';
import skyboxHDRPS from './skyboxHDR.frag.js';
import skyboxVS from './skybox.vert.js';
import specularPS from './specular.frag.js';
import specularAaNonePS from './specularAaNone.frag.js';
import specularAaToksvigPS from './specularAaToksvig.frag.js';
import specularAaToksvigFastPS from './specularAaToksvigFast.frag.js';
import spotPS from './spot.frag.js';
import startPS from './start.frag.js';
import startVS from './start.vert.js';
import startNineSlicedPS from './startNineSliced.frag.js';
import startNineSlicedTiledPS from './startNineSlicedTiled.frag.js';
import storeEVSMPS from './storeEVSM.frag.js';
import tangentBinormalVS from './tangentBinormal.vert.js';
import TBNPS from './TBN.frag.js';
import TBNderivativePS from './TBNderivative.frag.js';
import TBNfastPS from './TBNfast.frag.js';
import TBNObjectSpacePS from './TBNObjectSpace.frag.js';
import tonemappingAcesPS from './tonemappingAces.frag.js';
import tonemappingAces2PS from './tonemappingAces2.frag.js';
import tonemappingFilmicPS from './tonemappingFilmic.frag.js';
import tonemappingHejlPS from './tonemappingHejl.frag.js';
import tonemappingLinearPS from './tonemappingLinear.frag.js';
import tonemappingNonePS from './tonemappingNone.frag.js';
import transformVS from './transform.vert.js';
import transformDeclVS from './transformDecl.vert.js';
import uv0VS from './uv0.vert.js';
import uv1VS from './uv1.vert.js';
import viewDirPS from './viewDir.frag.js';
import viewNormalVS from './viewNormal.vert.js';

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
    outputCubemapPS,
    outputTex2DPS,
    packDepthPS,
    packDepthMaskPS,
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
