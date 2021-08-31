import alphaTestPS from './alphaTest.frag';
import ambientConstantPS from './ambientConstant.frag';
import ambientPrefilteredCubePS from './ambientPrefilteredCube.frag';
import ambientPrefilteredCubeLodPS from './ambientPrefilteredCubeLod.frag';
import ambientSHPS from './ambientSH.frag';
import aoPS from './ao.frag';
import aoSpecOccPS from './aoSpecOcc.frag';
import aoSpecOccConstPS from './aoSpecOccConst.frag';
import aoSpecOccConstSimplePS from './aoSpecOccConstSimple.frag';
import aoSpecOccSimplePS from './aoSpecOccSimple.frag';
import bakeDirLmEndPS from './bakeDirLmEnd.frag';
import bakeLmEndPS from './bakeLmEnd.frag';
import basePS from './base.frag';
import baseVS from './base.vert';
import baseNineSlicedPS from './baseNineSliced.frag';
import baseNineSlicedVS from './baseNineSliced.vert';
import baseNineSlicedTiledPS from './baseNineSlicedTiled.frag';
import biasConstPS from './biasConst.frag';
import blurVSMPS from './blurVSM.frag';
import clearCoatPS from './clearCoat.frag';
import clearCoatGlossPS from './clearCoatGloss.frag';
import clearCoatNormalPS from './clearCoatNormal.frag';
import clusteredLightLoopPS from './clusteredLightLoop.frag';
import clusteredLightPS from './clusteredLight.frag';
import combineClearCoatPS from './combineClearCoat.frag';
import combineDiffusePS from './combineDiffuse.frag';
import combineDiffuseSpecularPS from './combineDiffuseSpecular.frag';
import combineDiffuseSpecularNoConservePS from './combineDiffuseSpecularNoConserve.frag';
import combineDiffuseSpecularNoReflPS from './combineDiffuseSpecularNoRefl.frag';
import combineDiffuseSpecularNoReflSeparateAmbientPS from './combineDiffuseSpecularNoReflSeparateAmbient.frag';
import combineDiffuseSpecularOldPS from './combineDiffuseSpecularOld.frag';
import cookiePS from './cookie.frag';
import cubeMapProjectBoxPS from './cubeMapProjectBox.frag';
import cubeMapProjectNonePS from './cubeMapProjectNone.frag';
import cubeMapRotatePS from './cubeMapRotate.frag';
import detailModesPS from './detailModes.frag';
import diffusePS from './diffuse.frag';
import diffuseDetailMapPS from './diffuseDetailMap.frag';
import dilatePS from './dilate.frag';
import dpAtlasQuadPS from './dpAtlasQuad.frag';
import emissivePS from './emissive.frag';
import endPS from './end.frag';
import endVS from './end.vert';
import envConstPS from './envConst.frag';
import envMultiplyPS from './envMultiply.frag';
import extensionPS from './extension.frag';
import extensionVS from './extension.vert';
import falloffInvSquaredPS from './falloffInvSquared.frag';
import falloffLinearPS from './falloffLinear.frag';
import fixCubemapSeamsNonePS from './fixCubemapSeamsNone.frag';
import fixCubemapSeamsStretchPS from './fixCubemapSeamsStretch.frag';
import fogExpPS from './fogExp.frag';
import fogExp2PS from './fogExp2.frag';
import fogLinearPS from './fogLinear.frag';
import fogNonePS from './fogNone.frag';
import fresnelSchlickPS from './fresnelSchlick.frag';
import fullscreenQuadPS from './fullscreenQuad.frag';
import fullscreenQuadVS from './fullscreenQuad.vert';
import gamma1_0PS from './gamma1_0.frag';
import gamma2_2PS from './gamma2_2.frag';
import genParaboloidPS from './genParaboloid.frag';
import gles3PS from './gles3.frag';
import gles3VS from './gles3.vert';
import glossPS from './gloss.frag';
import instancingVS from './instancing.vert';
import lightDiffuseLambertPS from './lightDiffuseLambert.frag';
import lightDirPointPS from './lightDirPoint.frag';
import lightmapDirPS from './lightmapDir.frag';
import lightmapSinglePS from './lightmapSingle.frag';
import lightmapSingleVertPS from './lightmapSingleVert.frag';
import lightSpecularAnisoGGXPS from './lightSpecularAnisoGGX.frag';
import lightSpecularBlinnPS from './lightSpecularBlinn.frag';
import lightSpecularPhongPS from './lightSpecularPhong.frag';
import ltc from './ltc.frag';
import metalnessPS from './metalness.frag';
import msdfPS from './msdf.frag';
import normalVS from './normal.vert';
import normalDetailMapPS from './normalDetailMap.frag';
import normalInstancedVS from './normalInstanced.vert';
import normalMapPS from './normalMap.frag';
import normalMapFastPS from './normalMapFast.frag';
import normalSkinnedVS from './normalSkinned.vert';
import normalVertexPS from './normalVertex.frag';
import normalXYPS from './normalXY.frag';
import normalXYZPS from './normalXYZ.frag';
import opacityPS from './opacity.frag';
import outputAlphaPS from './outputAlpha.frag';
import outputAlphaOpaquePS from './outputAlphaOpaque.frag';
import outputAlphaPremulPS from './outputAlphaPremul.frag';
import outputCubemapPS from './outputCubemap.frag';
import outputTex2DPS from './outputTex2D.frag';
import packDepthPS from './packDepth.frag';
import packDepthMaskPS from './packDepthMask.frag';
import parallaxPS from './parallax.frag';
import particlePS from './particle.frag';
import particleVS from './particle.vert';
import particleAnimFrameClampVS from './particleAnimFrameClamp.vert';
import particleAnimFrameLoopVS from './particleAnimFrameLoop.vert';
import particleAnimTexVS from './particleAnimTex.vert';
import particleInputFloatPS from './particleInputFloat.frag';
import particleInputRgba8PS from './particleInputRgba8.frag';
import particleOutputFloatPS from './particleOutputFloat.frag';
import particleOutputRgba8PS from './particleOutputRgba8.frag';
import particleUpdaterAABBPS from './particleUpdaterAABB.frag';
import particleUpdaterEndPS from './particleUpdaterEnd.frag';
import particleUpdaterInitPS from './particleUpdaterInit.frag';
import particleUpdaterNoRespawnPS from './particleUpdaterNoRespawn.frag';
import particleUpdaterOnStopPS from './particleUpdaterOnStop.frag';
import particleUpdaterRespawnPS from './particleUpdaterRespawn.frag';
import particleUpdaterSpherePS from './particleUpdaterSphere.frag';
import particleUpdaterStartPS from './particleUpdaterStart.frag';
import particle_billboardVS from './particle_billboard.vert';
import particle_blendAddPS from './particle_blendAdd.frag';
import particle_blendMultiplyPS from './particle_blendMultiply.frag';
import particle_blendNormalPS from './particle_blendNormal.frag';
import particle_cpuVS from './particle_cpu.vert';
import particle_cpu_endVS from './particle_cpu_end.vert';
import particle_customFaceVS from './particle_customFace.vert';
import particle_endPS from './particle_end.frag';
import particle_endVS from './particle_end.vert';
import particle_halflambertPS from './particle_halflambert.frag';
import particle_initVS from './particle_init.vert';
import particle_lambertPS from './particle_lambert.frag';
import particle_lightingPS from './particle_lighting.frag';
import particle_localShiftVS from './particle_localShift.vert';
import particle_meshVS from './particle_mesh.vert';
import particle_normalVS from './particle_normal.vert';
import particle_normalMapPS from './particle_normalMap.frag';
import particle_pointAlongVS from './particle_pointAlong.vert';
import particle_softPS from './particle_soft.frag';
import particle_softVS from './particle_soft.vert';
import particle_stretchVS from './particle_stretch.vert';
import particle_TBNVS from './particle_TBN.vert';
import particle_wrapVS from './particle_wrap.vert';
import precisionTestPS from './precisionTest.frag';
import precisionTest2PS from './precisionTest2.frag';
import prefilterCubemapPS from './prefilterCubemap.frag';
import reflDirPS from './reflDir.frag';
import reflDirAnisoPS from './reflDirAniso.frag';
import reflectionCCPS from './reflectionCC.frag';
import reflectionCubePS from './reflectionCube.frag';
import reflectionDpAtlasPS from './reflectionDpAtlas.frag';
import reflectionPrefilteredCubePS from './reflectionPrefilteredCube.frag';
import reflectionPrefilteredCubeLodPS from './reflectionPrefilteredCubeLod.frag';
import reflectionSpherePS from './reflectionSphere.frag';
import reflectionSphereLowPS from './reflectionSphereLow.frag';
import refractionPS from './refraction.frag';
import reprojectPS from './reproject.frag';
import rgbmPS from './rgbm.frag';
import screenDepthPS from './screenDepth.frag';
import shadowCascadesPS from './shadowCascades.frag';
import shadowCommonPS from './shadowCommon.frag';
import shadowCoordPS from './shadowCoord.frag';
import shadowCoordPerspZbufferPS from './shadowCoordPerspZbuffer.frag';
import shadowEVSMPS from './shadowEVSM.frag';
import shadowEVSMnPS from './shadowEVSMn.frag';
import shadowStandardPS from './shadowStandard.frag';
import shadowStandardGL2PS from './shadowStandardGL2.frag';
import shadowVSM8PS from './shadowVSM8.frag';
import shadowVSM_commonPS from './shadowVSM_common.frag';
import skinBatchConstVS from './skinBatchConst.vert';
import skinBatchTexVS from './skinBatchTex.vert';
import skinConstVS from './skinConst.vert';
import skinTexVS from './skinTex.vert';
import skyboxPS from './skybox.frag';
import skyboxVS from './skybox.vert';
import skyboxHDRPS from './skyboxHDR.frag';
import skyboxPrefilteredCubePS from './skyboxPrefilteredCube.frag';
import specularPS from './specular.frag';
import specularAaNonePS from './specularAaNone.frag';
import specularAaToksvigPS from './specularAaToksvig.frag';
import specularAaToksvigFastPS from './specularAaToksvigFast.frag';
import spotPS from './spot.frag';
import startPS from './start.frag';
import startVS from './start.vert';
import startNineSlicedPS from './startNineSliced.frag';
import startNineSlicedTiledPS from './startNineSlicedTiled.frag';
import storeEVSMPS from './storeEVSM.frag';
import tangentBinormalVS from './tangentBinormal.vert';
import TBNPS from './TBN.frag';
import TBNderivativePS from './TBNderivative.frag';
import TBNfastPS from './TBNfast.frag';
import TBNObjectSpacePS from './TBNObjectSpace.frag';
import tonemappingAcesPS from './tonemappingAces.frag';
import tonemappingAces2PS from './tonemappingAces2.frag';
import tonemappingFilmicPS from './tonemappingFilmic.frag';
import tonemappingHejlPS from './tonemappingHejl.frag';
import tonemappingLinearPS from './tonemappingLinear.frag';
import tonemappingNonePS from './tonemappingNone.frag';
import transformVS from './transform.vert';
import transformDeclVS from './transformDecl.vert';
import uv0VS from './uv0.vert';
import uv1VS from './uv1.vert';
import viewDirPS from './viewDir.frag';
import viewNormalVS from './viewNormal.vert';

/**
 * @static
 * @readonly
 * @type {object}
 * @name shaderChunks
 * @description Object containing all default shader chunks used by shader generators.
 */
const shaderChunks = {
    alphaTestPS: alphaTestPS,
    ambientConstantPS: ambientConstantPS,
    ambientPrefilteredCubePS: ambientPrefilteredCubePS,
    ambientPrefilteredCubeLodPS: ambientPrefilteredCubeLodPS,
    ambientSHPS: ambientSHPS,
    aoPS: aoPS,
    aoSpecOccPS: aoSpecOccPS,
    aoSpecOccConstPS: aoSpecOccConstPS,
    aoSpecOccConstSimplePS: aoSpecOccConstSimplePS,
    aoSpecOccSimplePS: aoSpecOccSimplePS,
    bakeDirLmEndPS: bakeDirLmEndPS,
    bakeLmEndPS: bakeLmEndPS,
    basePS: basePS,
    baseVS: baseVS,
    baseNineSlicedPS: baseNineSlicedPS,
    baseNineSlicedVS: baseNineSlicedVS,
    baseNineSlicedTiledPS: baseNineSlicedTiledPS,
    biasConstPS: biasConstPS,
    blurVSMPS: blurVSMPS,
    clearCoatPS: clearCoatPS,
    clearCoatGlossPS: clearCoatGlossPS,
    clearCoatNormalPS: clearCoatNormalPS,
    clusteredLightLoopPS: clusteredLightLoopPS,
    clusteredLightPS: clusteredLightPS,
    combineClearCoatPS: combineClearCoatPS,
    combineDiffusePS: combineDiffusePS,
    combineDiffuseSpecularPS: combineDiffuseSpecularPS,
    combineDiffuseSpecularNoConservePS: combineDiffuseSpecularNoConservePS,
    combineDiffuseSpecularNoReflPS: combineDiffuseSpecularNoReflPS,
    combineDiffuseSpecularNoReflSeparateAmbientPS: combineDiffuseSpecularNoReflSeparateAmbientPS,
    combineDiffuseSpecularOldPS: combineDiffuseSpecularOldPS,
    cookiePS: cookiePS,
    cubeMapProjectBoxPS: cubeMapProjectBoxPS,
    cubeMapProjectNonePS: cubeMapProjectNonePS,
    cubeMapRotatePS: cubeMapRotatePS,
    detailModesPS: detailModesPS,
    diffusePS: diffusePS,
    diffuseDetailMapPS: diffuseDetailMapPS,
    dilatePS: dilatePS,
    dpAtlasQuadPS: dpAtlasQuadPS,
    emissivePS: emissivePS,
    endPS: endPS,
    endVS: endVS,
    envConstPS: envConstPS,
    envMultiplyPS: envMultiplyPS,
    extensionPS: extensionPS,
    extensionVS: extensionVS,
    falloffInvSquaredPS: falloffInvSquaredPS,
    falloffLinearPS: falloffLinearPS,
    fixCubemapSeamsNonePS: fixCubemapSeamsNonePS,
    fixCubemapSeamsStretchPS: fixCubemapSeamsStretchPS,
    fogExpPS: fogExpPS,
    fogExp2PS: fogExp2PS,
    fogLinearPS: fogLinearPS,
    fogNonePS: fogNonePS,
    fresnelSchlickPS: fresnelSchlickPS,
    fullscreenQuadPS: fullscreenQuadPS,
    fullscreenQuadVS: fullscreenQuadVS,
    gamma1_0PS: gamma1_0PS,
    gamma2_2PS: gamma2_2PS,
    genParaboloidPS: genParaboloidPS,
    gles3PS: gles3PS,
    gles3VS: gles3VS,
    glossPS: glossPS,
    instancingVS: instancingVS,
    lightDiffuseLambertPS: lightDiffuseLambertPS,
    lightDirPointPS: lightDirPointPS,
    lightmapDirPS: lightmapDirPS,
    lightmapSinglePS: lightmapSinglePS,
    lightmapSingleVertPS: lightmapSingleVertPS,
    lightSpecularAnisoGGXPS: lightSpecularAnisoGGXPS,
    lightSpecularBlinnPS: lightSpecularBlinnPS,
    lightSpecularPhongPS: lightSpecularPhongPS,
    ltc: ltc,
    metalnessPS: metalnessPS,
    msdfPS: msdfPS,
    normalVS: normalVS,
    normalDetailMapPS: normalDetailMapPS,
    normalInstancedVS: normalInstancedVS,
    normalMapPS: normalMapPS,
    normalMapFastPS: normalMapFastPS,
    normalSkinnedVS: normalSkinnedVS,
    normalVertexPS: normalVertexPS,
    normalXYPS: normalXYPS,
    normalXYZPS: normalXYZPS,
    opacityPS: opacityPS,
    outputAlphaPS: outputAlphaPS,
    outputAlphaOpaquePS: outputAlphaOpaquePS,
    outputAlphaPremulPS: outputAlphaPremulPS,
    outputCubemapPS: outputCubemapPS,
    outputTex2DPS: outputTex2DPS,
    packDepthPS: packDepthPS,
    packDepthMaskPS: packDepthMaskPS,
    parallaxPS: parallaxPS,
    particlePS: particlePS,
    particleVS: particleVS,
    particleAnimFrameClampVS: particleAnimFrameClampVS,
    particleAnimFrameLoopVS: particleAnimFrameLoopVS,
    particleAnimTexVS: particleAnimTexVS,
    particleInputFloatPS: particleInputFloatPS,
    particleInputRgba8PS: particleInputRgba8PS,
    particleOutputFloatPS: particleOutputFloatPS,
    particleOutputRgba8PS: particleOutputRgba8PS,
    particleUpdaterAABBPS: particleUpdaterAABBPS,
    particleUpdaterEndPS: particleUpdaterEndPS,
    particleUpdaterInitPS: particleUpdaterInitPS,
    particleUpdaterNoRespawnPS: particleUpdaterNoRespawnPS,
    particleUpdaterOnStopPS: particleUpdaterOnStopPS,
    particleUpdaterRespawnPS: particleUpdaterRespawnPS,
    particleUpdaterSpherePS: particleUpdaterSpherePS,
    particleUpdaterStartPS: particleUpdaterStartPS,
    particle_billboardVS: particle_billboardVS,
    particle_blendAddPS: particle_blendAddPS,
    particle_blendMultiplyPS: particle_blendMultiplyPS,
    particle_blendNormalPS: particle_blendNormalPS,
    particle_cpuVS: particle_cpuVS,
    particle_cpu_endVS: particle_cpu_endVS,
    particle_customFaceVS: particle_customFaceVS,
    particle_endPS: particle_endPS,
    particle_endVS: particle_endVS,
    particle_halflambertPS: particle_halflambertPS,
    particle_initVS: particle_initVS,
    particle_lambertPS: particle_lambertPS,
    particle_lightingPS: particle_lightingPS,
    particle_localShiftVS: particle_localShiftVS,
    particle_meshVS: particle_meshVS,
    particle_normalVS: particle_normalVS,
    particle_normalMapPS: particle_normalMapPS,
    particle_pointAlongVS: particle_pointAlongVS,
    particle_softPS: particle_softPS,
    particle_softVS: particle_softVS,
    particle_stretchVS: particle_stretchVS,
    particle_TBNVS: particle_TBNVS,
    particle_wrapVS: particle_wrapVS,
    precisionTestPS: precisionTestPS,
    precisionTest2PS: precisionTest2PS,
    prefilterCubemapPS: prefilterCubemapPS,
    reflDirPS: reflDirPS,
    reflDirAnisoPS: reflDirAnisoPS,
    reflectionCCPS: reflectionCCPS,
    reflectionCubePS: reflectionCubePS,
    reflectionDpAtlasPS: reflectionDpAtlasPS,
    reflectionPrefilteredCubePS: reflectionPrefilteredCubePS,
    reflectionPrefilteredCubeLodPS: reflectionPrefilteredCubeLodPS,
    reflectionSpherePS: reflectionSpherePS,
    reflectionSphereLowPS: reflectionSphereLowPS,
    refractionPS: refractionPS,
    reprojectPS: reprojectPS,
    rgbmPS: rgbmPS,
    screenDepthPS: screenDepthPS,
    shadowCascadesPS: shadowCascadesPS,
    shadowCommonPS: shadowCommonPS,
    shadowCoordPS: shadowCoordPS,
    shadowCoordPerspZbufferPS: shadowCoordPerspZbufferPS,
    shadowEVSMPS: shadowEVSMPS,
    shadowEVSMnPS: shadowEVSMnPS,
    shadowStandardPS: shadowStandardPS,
    shadowStandardGL2PS: shadowStandardGL2PS,
    shadowVSM8PS: shadowVSM8PS,
    shadowVSM_commonPS: shadowVSM_commonPS,
    skinBatchConstVS: skinBatchConstVS,
    skinBatchTexVS: skinBatchTexVS,
    skinConstVS: skinConstVS,
    skinTexVS: skinTexVS,
    skyboxPS: skyboxPS,
    skyboxVS: skyboxVS,
    skyboxHDRPS: skyboxHDRPS,
    skyboxPrefilteredCubePS: skyboxPrefilteredCubePS,
    specularPS: specularPS,
    specularAaNonePS: specularAaNonePS,
    specularAaToksvigPS: specularAaToksvigPS,
    specularAaToksvigFastPS: specularAaToksvigFastPS,
    spotPS: spotPS,
    startPS: startPS,
    startVS: startVS,
    startNineSlicedPS: startNineSlicedPS,
    startNineSlicedTiledPS: startNineSlicedTiledPS,
    storeEVSMPS: storeEVSMPS,
    tangentBinormalVS: tangentBinormalVS,
    TBNPS: TBNPS,
    TBNderivativePS: TBNderivativePS,
    TBNfastPS: TBNfastPS,
    TBNObjectSpacePS: TBNObjectSpacePS,
    tonemappingAcesPS: tonemappingAcesPS,
    tonemappingAces2PS: tonemappingAces2PS,
    tonemappingFilmicPS: tonemappingFilmicPS,
    tonemappingHejlPS: tonemappingHejlPS,
    tonemappingLinearPS: tonemappingLinearPS,
    tonemappingNonePS: tonemappingNonePS,
    transformVS: transformVS,
    transformDeclVS: transformDeclVS,
    uv0VS: uv0VS,
    uv1VS: uv1VS,
    viewDirPS: viewDirPS,
    viewNormalVS: viewNormalVS
};

export { shaderChunks };
