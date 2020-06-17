import {
    SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TANGENT, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2,
    SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7,
    SEMANTIC_COLOR, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT
} from './graphics.js';
import { programlib } from './program-lib/program-lib.js';
import { Shader } from './shader.js';

import alphaTestPS from './program-lib/chunks/alphaTest.frag';
import ambientConstantPS from './program-lib/chunks/ambientConstant.frag';
import ambientPrefilteredCubePS from './program-lib/chunks/ambientPrefilteredCube.frag';
import ambientPrefilteredCubeLodPS from './program-lib/chunks/ambientPrefilteredCubeLod.frag';
import ambientSHPS from './program-lib/chunks/ambientSH.frag';
import aoPS from './program-lib/chunks/ao.frag';
import aoSpecOccPS from './program-lib/chunks/aoSpecOcc.frag';
import aoSpecOccConstPS from './program-lib/chunks/aoSpecOccConst.frag';
import aoSpecOccConstSimplePS from './program-lib/chunks/aoSpecOccConstSimple.frag';
import aoSpecOccSimplePS from './program-lib/chunks/aoSpecOccSimple.frag';
import bakeDirLmEndPS from './program-lib/chunks/bakeDirLmEnd.frag';
import bakeLmEndPS from './program-lib/chunks/bakeLmEnd.frag';
import basePS from './program-lib/chunks/base.frag';
import baseVS from './program-lib/chunks/base.vert';
import baseNineSlicedPS from './program-lib/chunks/baseNineSliced.frag';
import baseNineSlicedVS from './program-lib/chunks/baseNineSliced.vert';
import baseNineSlicedTiledPS from './program-lib/chunks/baseNineSlicedTiled.frag';
import biasConstPS from './program-lib/chunks/biasConst.frag';
import blurVSMPS from './program-lib/chunks/blurVSM.frag';
import combineClearCoatPS from './program-lib/chunks/combineClearCoat.frag';
import combineDiffusePS from './program-lib/chunks/combineDiffuse.frag';
import combineDiffuseSpecularPS from './program-lib/chunks/combineDiffuseSpecular.frag';
import combineDiffuseSpecularNoConservePS from './program-lib/chunks/combineDiffuseSpecularNoConserve.frag';
import combineDiffuseSpecularNoReflPS from './program-lib/chunks/combineDiffuseSpecularNoRefl.frag';
import combineDiffuseSpecularNoReflSeparateAmbientPS from './program-lib/chunks/combineDiffuseSpecularNoReflSeparateAmbient.frag';
import combineDiffuseSpecularOldPS from './program-lib/chunks/combineDiffuseSpecularOld.frag';
import cookiePS from './program-lib/chunks/cookie.frag';
import cubeMapProjectBoxPS from './program-lib/chunks/cubeMapProjectBox.frag';
import cubeMapProjectNonePS from './program-lib/chunks/cubeMapProjectNone.frag';
import detailModesPS from './program-lib/chunks/detailModes.frag';
import diffusePS from './program-lib/chunks/diffuse.frag';
import diffuseDetailMapPS from './program-lib/chunks/diffuseDetailMap.frag';
import dilatePS from './program-lib/chunks/dilate.frag';
import dpAtlasQuadPS from './program-lib/chunks/dpAtlasQuad.frag';
import emissivePS from './program-lib/chunks/emissive.frag';
import endPS from './program-lib/chunks/end.frag';
import envConstPS from './program-lib/chunks/envConst.frag';
import envMultiplyPS from './program-lib/chunks/envMultiply.frag';
import extensionPS from './program-lib/chunks/extension.frag';
import extensionVS from './program-lib/chunks/extension.vert';
import falloffInvSquaredPS from './program-lib/chunks/falloffInvSquared.frag';
import falloffLinearPS from './program-lib/chunks/falloffLinear.frag';
import fixCubemapSeamsNonePS from './program-lib/chunks/fixCubemapSeamsNone.frag';
import fixCubemapSeamsStretchPS from './program-lib/chunks/fixCubemapSeamsStretch.frag';
import fogExpPS from './program-lib/chunks/fogExp.frag';
import fogExp2PS from './program-lib/chunks/fogExp2.frag';
import fogLinearPS from './program-lib/chunks/fogLinear.frag';
import fogNonePS from './program-lib/chunks/fogNone.frag';
import fresnelSchlickPS from './program-lib/chunks/fresnelSchlick.frag';
import fullscreenQuadPS from './program-lib/chunks/fullscreenQuad.frag';
import fullscreenQuadVS from './program-lib/chunks/fullscreenQuad.vert';
import gamma1_0PS from './program-lib/chunks/gamma1_0.frag';
import gamma2_2PS from './program-lib/chunks/gamma2_2.frag';
import genParaboloidPS from './program-lib/chunks/genParaboloid.frag';
import gles3PS from './program-lib/chunks/gles3.frag';
import gles3VS from './program-lib/chunks/gles3.vert';
import glossPS from './program-lib/chunks/gloss.frag';
import instancingVS from './program-lib/chunks/instancing.vert';
import lightDiffuseLambertPS from './program-lib/chunks/lightDiffuseLambert.frag';
import lightDirPointPS from './program-lib/chunks/lightDirPoint.frag';
import lightmapDirPS from './program-lib/chunks/lightmapDir.frag';
import lightmapSinglePS from './program-lib/chunks/lightmapSingle.frag';
import lightmapSingleVertPS from './program-lib/chunks/lightmapSingleVert.frag';
import lightSpecularAnisoGGXPS from './program-lib/chunks/lightSpecularAnisoGGX.frag';
import lightSpecularBlinnPS from './program-lib/chunks/lightSpecularBlinn.frag';
import lightSpecularPhongPS from './program-lib/chunks/lightSpecularPhong.frag';
import metalnessPS from './program-lib/chunks/metalness.frag';
import msdfPS from './program-lib/chunks/msdf.frag';
import normalVS from './program-lib/chunks/normal.vert';
import normalDetailMapPS from './program-lib/chunks/normalDetailMap.frag';
import normalInstancedVS from './program-lib/chunks/normalInstanced.vert';
import normalMapPS from './program-lib/chunks/normalMap.frag';
import normalMapFastPS from './program-lib/chunks/normalMapFast.frag';
import normalSkinnedVS from './program-lib/chunks/normalSkinned.vert';
import normalVertexPS from './program-lib/chunks/normalVertex.frag';
import normalXYPS from './program-lib/chunks/normalXY.frag';
import normalXYZPS from './program-lib/chunks/normalXYZ.frag';
import opacityPS from './program-lib/chunks/opacity.frag';
import outputAlphaPS from './program-lib/chunks/outputAlpha.frag';
import outputAlphaOpaquePS from './program-lib/chunks/outputAlphaOpaque.frag';
import outputAlphaPremulPS from './program-lib/chunks/outputAlphaPremul.frag';
import outputCubemapPS from './program-lib/chunks/outputCubemap.frag';
import outputTex2DPS from './program-lib/chunks/outputTex2D.frag';
import packDepthPS from './program-lib/chunks/packDepth.frag';
import packDepthMaskPS from './program-lib/chunks/packDepthMask.frag';
import parallaxPS from './program-lib/chunks/parallax.frag';
import particlePS from './program-lib/chunks/particle.frag';
import particleVS from './program-lib/chunks/particle.vert';
import particleAnimFrameClampVS from './program-lib/chunks/particleAnimFrameClamp.vert';
import particleAnimFrameLoopVS from './program-lib/chunks/particleAnimFrameLoop.vert';
import particleAnimTexVS from './program-lib/chunks/particleAnimTex.vert';
import particleInputFloatPS from './program-lib/chunks/particleInputFloat.frag';
import particleInputRgba8PS from './program-lib/chunks/particleInputRgba8.frag';
import particleOutputFloatPS from './program-lib/chunks/particleOutputFloat.frag';
import particleOutputRgba8PS from './program-lib/chunks/particleOutputRgba8.frag';
import particleUpdaterAABBPS from './program-lib/chunks/particleUpdaterAABB.frag';
import particleUpdaterEndPS from './program-lib/chunks/particleUpdaterEnd.frag';
import particleUpdaterInitPS from './program-lib/chunks/particleUpdaterInit.frag';
import particleUpdaterNoRespawnPS from './program-lib/chunks/particleUpdaterNoRespawn.frag';
import particleUpdaterOnStopPS from './program-lib/chunks/particleUpdaterOnStop.frag';
import particleUpdaterRespawnPS from './program-lib/chunks/particleUpdaterRespawn.frag';
import particleUpdaterSpherePS from './program-lib/chunks/particleUpdaterSphere.frag';
import particleUpdaterStartPS from './program-lib/chunks/particleUpdaterStart.frag';
import particle_billboardVS from './program-lib/chunks/particle_billboard.vert';
import particle_blendAddPS from './program-lib/chunks/particle_blendAdd.frag';
import particle_blendMultiplyPS from './program-lib/chunks/particle_blendMultiply.frag';
import particle_blendNormalPS from './program-lib/chunks/particle_blendNormal.frag';
import particle_cpuVS from './program-lib/chunks/particle_cpu.vert';
import particle_cpu_endVS from './program-lib/chunks/particle_cpu_end.vert';
import particle_customFaceVS from './program-lib/chunks/particle_customFace.vert';
import particle_endPS from './program-lib/chunks/particle_end.frag';
import particle_endVS from './program-lib/chunks/particle_end.vert';
import particle_halflambertPS from './program-lib/chunks/particle_halflambert.frag';
import particle_initVS from './program-lib/chunks/particle_init.vert';
import particle_lambertPS from './program-lib/chunks/particle_lambert.frag';
import particle_lightingPS from './program-lib/chunks/particle_lighting.frag';
import particle_localShiftVS from './program-lib/chunks/particle_localShift.vert';
import particle_meshVS from './program-lib/chunks/particle_mesh.vert';
import particle_normalVS from './program-lib/chunks/particle_normal.vert';
import particle_normalMapPS from './program-lib/chunks/particle_normalMap.frag';
import particle_pointAlongVS from './program-lib/chunks/particle_pointAlong.vert';
import particle_softPS from './program-lib/chunks/particle_soft.frag';
import particle_softVS from './program-lib/chunks/particle_soft.vert';
import particle_stretchVS from './program-lib/chunks/particle_stretch.vert';
import particle_TBNVS from './program-lib/chunks/particle_TBN.vert';
import particle_wrapVS from './program-lib/chunks/particle_wrap.vert';
import precisionTestPS from './program-lib/chunks/precisionTest.frag';
import precisionTest2PS from './program-lib/chunks/precisionTest2.frag';
import prefilterCubemapPS from './program-lib/chunks/prefilterCubemap.frag';
import reflDirPS from './program-lib/chunks/reflDir.frag';
import reflDirAnisoPS from './program-lib/chunks/reflDirAniso.frag';
import reflectionCCPS from './program-lib/chunks/reflectionCC.frag';
import reflectionCubePS from './program-lib/chunks/reflectionCube.frag';
import reflectionDpAtlasPS from './program-lib/chunks/reflectionDpAtlas.frag';
import reflectionPrefilteredCubePS from './program-lib/chunks/reflectionPrefilteredCube.frag';
import reflectionPrefilteredCubeLodPS from './program-lib/chunks/reflectionPrefilteredCubeLod.frag';
import reflectionSpherePS from './program-lib/chunks/reflectionSphere.frag';
import reflectionSphereLowPS from './program-lib/chunks/reflectionSphereLow.frag';
import refractionPS from './program-lib/chunks/refraction.frag';
import rgbmPS from './program-lib/chunks/rgbm.frag';
import screenDepthPS from './program-lib/chunks/screenDepth.frag';
import shadowCommonPS from './program-lib/chunks/shadowCommon.frag';
import shadowCoordPS from './program-lib/chunks/shadowCoord.frag';
import shadowCoordVS from './program-lib/chunks/shadowCoord.vert';
import shadowCoordPerspZbufferPS from './program-lib/chunks/shadowCoordPerspZbuffer.frag';
import shadowEVSMPS from './program-lib/chunks/shadowEVSM.frag';
import shadowEVSMnPS from './program-lib/chunks/shadowEVSMn.frag';
import shadowStandardPS from './program-lib/chunks/shadowStandard.frag';
import shadowStandardGL2PS from './program-lib/chunks/shadowStandardGL2.frag';
import shadowStandardGL2VSPS from './program-lib/chunks/shadowStandardGL2VS.frag';
import shadowStandardVSPS from './program-lib/chunks/shadowStandardVS.frag';
import shadowVSM8PS from './program-lib/chunks/shadowVSM8.frag';
import shadowVSMVSPS from './program-lib/chunks/shadowVSMVS.frag';
import shadowVSM_commonPS from './program-lib/chunks/shadowVSM_common.frag';
import skinBatchConstVS from './program-lib/chunks/skinBatchConst.vert';
import skinBatchTexVS from './program-lib/chunks/skinBatchTex.vert';
import skinConstVS from './program-lib/chunks/skinConst.vert';
import skinTexVS from './program-lib/chunks/skinTex.vert';
import skyboxPS from './program-lib/chunks/skybox.frag';
import skyboxVS from './program-lib/chunks/skybox.vert';
import skyboxHDRPS from './program-lib/chunks/skyboxHDR.frag';
import skyboxPrefilteredCubePS from './program-lib/chunks/skyboxPrefilteredCube.frag';
import specularPS from './program-lib/chunks/specular.frag';
import specularAaNonePS from './program-lib/chunks/specularAaNone.frag';
import specularAaToksvigPS from './program-lib/chunks/specularAaToksvig.frag';
import specularAaToksvigFastPS from './program-lib/chunks/specularAaToksvigFast.frag';
import spotPS from './program-lib/chunks/spot.frag';
import startPS from './program-lib/chunks/start.frag';
import startVS from './program-lib/chunks/start.vert';
import startNineSlicedPS from './program-lib/chunks/startNineSliced.frag';
import startNineSlicedTiledPS from './program-lib/chunks/startNineSlicedTiled.frag';
import storeEVSMPS from './program-lib/chunks/storeEVSM.frag';
import tangentBinormalVS from './program-lib/chunks/tangentBinormal.vert';
import TBNPS from './program-lib/chunks/TBN.frag';
import TBNderivativePS from './program-lib/chunks/TBNderivative.frag';
import TBNfastPS from './program-lib/chunks/TBNfast.frag';
import TBNObjectSpacePS from './program-lib/chunks/TBNObjectSpace.frag';
import tonemappingAcesPS from './program-lib/chunks/tonemappingAces.frag';
import tonemappingAces2PS from './program-lib/chunks/tonemappingAces2.frag';
import tonemappingFilmicPS from './program-lib/chunks/tonemappingFilmic.frag';
import tonemappingHejlPS from './program-lib/chunks/tonemappingHejl.frag';
import tonemappingLinearPS from './program-lib/chunks/tonemappingLinear.frag';
import tonemappingNonePS from './program-lib/chunks/tonemappingNone.frag';
import transformVS from './program-lib/chunks/transform.vert';
import transformDeclVS from './program-lib/chunks/transformDecl.vert';
import uv0VS from './program-lib/chunks/uv0.vert';
import uv1VS from './program-lib/chunks/uv1.vert';
import viewDirPS from './program-lib/chunks/viewDir.frag';
import viewNormalVS from './program-lib/chunks/viewNormal.vert';

/**
 * @static
 * @readonly
 * @type {object}
 * @name pc.shaderChunks
 * @description Object containing all default shader chunks used by shader generators.
 */
var shaderChunks = {
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
    detailModesPS: detailModesPS,
    diffusePS: diffusePS,
    diffuseDetailMapPS: diffuseDetailMapPS,
    dilatePS: dilatePS,
    dpAtlasQuadPS: dpAtlasQuadPS,
    emissivePS: emissivePS,
    endPS: endPS,
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
    rgbmPS: rgbmPS,
    screenDepthPS: screenDepthPS,
    shadowCommonPS: shadowCommonPS,
    shadowCoordPS: shadowCoordPS,
    shadowCoordVS: shadowCoordVS,
    shadowCoordPerspZbufferPS: shadowCoordPerspZbufferPS,
    shadowEVSMPS: shadowEVSMPS,
    shadowEVSMnPS: shadowEVSMnPS,
    shadowStandardPS: shadowStandardPS,
    shadowStandardGL2PS: shadowStandardGL2PS,
    shadowStandardGL2VSPS: shadowStandardGL2VSPS,
    shadowStandardVSPS: shadowStandardVSPS,
    shadowVSM8PS: shadowVSM8PS,
    shadowVSMVSPS: shadowVSMVSPS,
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

var attrib2Semantic = {
    vertex_position: SEMANTIC_POSITION,
    vertex_normal: SEMANTIC_NORMAL,
    vertex_tangent: SEMANTIC_TANGENT,
    vertex_texCoord0: SEMANTIC_TEXCOORD0,
    vertex_texCoord1: SEMANTIC_TEXCOORD1,
    vertex_texCoord2: SEMANTIC_TEXCOORD2,
    vertex_texCoord3: SEMANTIC_TEXCOORD3,
    vertex_texCoord4: SEMANTIC_TEXCOORD4,
    vertex_texCoord5: SEMANTIC_TEXCOORD5,
    vertex_texCoord6: SEMANTIC_TEXCOORD6,
    vertex_texCoord7: SEMANTIC_TEXCOORD7,
    vertex_color: SEMANTIC_COLOR,
    vertex_boneIndices: SEMANTIC_BLENDINDICES,
    vertex_boneWeights: SEMANTIC_BLENDWEIGHT
};

shaderChunks.collectAttribs = function (vsCode) {
    var attribs = {};
    var attrs = 0;

    var found = vsCode.indexOf("attribute");
    while (found >= 0) {
        if (found > 0 && vsCode[found - 1] === "/") break;
        var endOfLine = vsCode.indexOf(';', found);
        var startOfAttribName = vsCode.lastIndexOf(' ', endOfLine);
        var attribName = vsCode.substr(startOfAttribName + 1, endOfLine - (startOfAttribName + 1));

        var semantic = attrib2Semantic[attribName];
        if (semantic !== undefined) {
            attribs[attribName] = semantic;
        } else {
            attribs[attribName] = "ATTR" + attrs;
            attrs++;
        }

        found = vsCode.indexOf("attribute", found + 1);
    }
    return attribs;
};


shaderChunks.createShader = function (device, vsName, psName, useTransformFeedback) {
    var vsCode = shaderChunks[vsName];
    var psCode = programlib.precisionCode(device) + "\n" + shaderChunks[psName];
    var attribs = this.collectAttribs(vsCode);

    if (device.webgl2) {
        vsCode = programlib.versionCode(device) + this.gles3VS + vsCode;
        psCode = programlib.versionCode(device) + this.gles3PS + psCode;
    }

    return new Shader(device, {
        attributes: attribs,
        vshader: vsCode,
        fshader: psCode,
        useTransformFeedback: useTransformFeedback
    });
};

shaderChunks.createShaderFromCode = function (device, vsCode, psCode, uName, useTransformFeedback) {
    var shaderCache = device.programLib._cache;
    var cached = shaderCache[uName];
    if (cached !== undefined) return cached;

    psCode = programlib.precisionCode(device) + "\n" + (psCode || programlib.dummyFragmentCode());
    var attribs = this.collectAttribs(vsCode);

    if (device.webgl2) {
        vsCode = programlib.versionCode(device) + this.gles3VS + vsCode;
        psCode = programlib.versionCode(device) + this.gles3PS + psCode;
    }

    shaderCache[uName] = new Shader(device, {
        attributes: attribs,
        vshader: vsCode,
        fshader: psCode,
        useTransformFeedback: useTransformFeedback
    });
    return shaderCache[uName];
};

export { shaderChunks };