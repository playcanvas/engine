import alphaTestPS from '../chunks-glsl/standard/frag/alphaTest.js';
import ambientPS from '../chunks-glsl/lit/frag/ambient.js';
import aoPS from '../chunks-glsl/standard/frag/ao.js';
import aoDiffuseOccPS from '../chunks-glsl/lit/frag/aoDiffuseOcc.js';
import aoSpecOccPS from '../chunks-glsl/lit/frag/aoSpecOcc.js';
import bakeDirLmEndPS from '../chunks-glsl/lightmapper/frag/bakeDirLmEnd.js';
import bakeLmEndPS from '../chunks-glsl/lightmapper/frag/bakeLmEnd.js';
import basePS from '../chunks-glsl/lit/frag/base.js';
import baseNineSlicedPS from '../chunks-glsl/lit/frag/baseNineSliced.js';
import baseNineSlicedTiledPS from '../chunks-glsl/lit/frag/baseNineSlicedTiled.js';
import bayerPS from '../chunks-glsl/common/frag/bayer.js';
import blurVSMPS from '../chunks-glsl/lit/frag/blurVSM.js';
import clearCoatPS from '../chunks-glsl/standard/frag/clearCoat.js';
import clearCoatGlossPS from '../chunks-glsl/standard/frag/clearCoatGloss.js';
import clearCoatNormalPS from '../chunks-glsl/standard/frag/clearCoatNormal.js';
import clusteredLightUtilsPS from '../chunks-glsl/lit/frag/clusteredLightUtils.js';
import clusteredLightCookiesPS from '../chunks-glsl/lit/frag/clusteredLightCookies.js';
import clusteredLightShadowsPS from '../chunks-glsl/lit/frag/clusteredLightShadows.js';
import clusteredLightPS from '../chunks-glsl/lit/frag/clusteredLight.js';
import combinePS from '../chunks-glsl/lit/frag/combine.js';
import cookieBlit2DPS from '../chunks-glsl/internal/frag/cookie-blit-2d.js';
import cookieBlitCubePS from '../chunks-glsl/internal/frag/cookie-blit-cube.js';
import cookieBlitVS from '../chunks-glsl/internal/vert/cookie-blit.js';
import cookiePS from '../chunks-glsl/lit/frag/cookie.js';
import cubeMapProjectPS from '../chunks-glsl/lit/frag/cubeMapProject.js';
import cubeMapRotatePS from '../chunks-glsl/lit/frag/cubeMapRotate.js';
import debugOutputPS from '../chunks-glsl/lit/frag/debug-output.js';
import debugProcessFrontendPS from '../chunks-glsl/lit/frag/debug-process-frontend.js';
import decodePS from '../chunks-glsl/common/frag/decode.js';
import detailModesPS from '../chunks-glsl/standard/frag/detailModes.js';
import diffusePS from '../chunks-glsl/standard/frag/diffuse.js';
import emissivePS from '../chunks-glsl/standard/frag/emissive.js';
import encodePS from '../chunks-glsl/common/frag/encode.js';
import endPS from '../chunks-glsl/lit/frag/end.js';
import envAtlasPS from '../chunks-glsl/common/frag/envAtlas.js';
import envProcPS from '../chunks-glsl/common/frag/envProc.js';
import falloffInvSquaredPS from '../chunks-glsl/lit/frag/falloffInvSquared.js';
import falloffLinearPS from '../chunks-glsl/lit/frag/falloffLinear.js';
import floatAsUintPS from '../chunks-glsl/common/frag/float-as-uint.js';
import fogPS from '../chunks-glsl/common/frag/fog.js';
import fresnelSchlickPS from '../chunks-glsl/lit/frag/fresnelSchlick.js';
import fullscreenQuadVS from '../chunks-glsl/common/vert/fullscreenQuad.js';
import gammaPS from '../chunks-glsl/common/frag/gamma.js';
import gles3PS from '../../../platform/graphics/shader-chunks/frag/gles3.js';
import gles3VS from '../../../platform/graphics/shader-chunks/vert/gles3.js';
import glossPS from '../chunks-glsl/standard/frag/gloss.js';
import gsplatCenterVS from '../chunks-glsl/gsplat/vert/gsplatCenter.js';
import gsplatColorVS from '../chunks-glsl/gsplat/vert/gsplatColor.js';
import gsplatCommonVS from '../chunks-glsl/gsplat/vert/gsplatCommon.js';
import gsplatCompressedDataVS from '../chunks-glsl/gsplat/vert/gsplatCompressedData.js';
import gsplatCompressedSHVS from '../chunks-glsl/gsplat/vert/gsplatCompressedSH.js';
import gsplatSogsColorVS from '../chunks-glsl/gsplat/vert/gsplatSogsColor.js';
import gsplatSogsDataVS from '../chunks-glsl/gsplat/vert/gsplatSogsData.js';
import gsplatSogsSHVS from '../chunks-glsl/gsplat/vert/gsplatSogsSH.js';
import gsplatCornerVS from '../chunks-glsl/gsplat/vert/gsplatCorner.js';
import gsplatDataVS from '../chunks-glsl/gsplat/vert/gsplatData.js';
import gsplatOutputVS from '../chunks-glsl/gsplat/vert/gsplatOutput.js';
import gsplatPS from '../chunks-glsl/gsplat/frag/gsplat.js';
import gsplatSHVS from '../chunks-glsl/gsplat/vert/gsplatSH.js';
import gsplatSourceVS from '../chunks-glsl/gsplat/vert/gsplatSource.js';
import gsplatVS from '../chunks-glsl/gsplat/vert/gsplat.js';
import immediateLinePS from '../chunks-glsl/internal/frag/immediateLine.js';
import immediateLineVS from '../chunks-glsl/internal/vert/immediateLine.js';
import iridescenceDiffractionPS from '../chunks-glsl/lit/frag/iridescenceDiffraction.js';
import iridescencePS from '../chunks-glsl/standard/frag/iridescence.js';
import iridescenceThicknessPS from '../chunks-glsl/standard/frag/iridescenceThickness.js';
import iorPS from '../chunks-glsl/standard/frag/ior.js';
import lightDeclarationPS from '../chunks-glsl/lit/frag/lighting/lightDeclaration.js';
import lightDiffuseLambertPS from '../chunks-glsl/lit/frag/lightDiffuseLambert.js';
import lightDirPointPS from '../chunks-glsl/lit/frag/lightDirPoint.js';
import lightEvaluationPS from '../chunks-glsl/lit/frag/lighting/lightEvaluation.js';
import lightFunctionLightPS from '../chunks-glsl/lit/frag/lighting/lightFunctionLight.js';
import lightFunctionShadowPS from '../chunks-glsl/lit/frag/lighting/lightFunctionShadow.js';
import lightingPS from '../chunks-glsl/lit/frag/lighting/lighting.js';
import lightmapAddPS from '../chunks-glsl/lit/frag/lightmapAdd.js';
import lightmapPS from '../chunks-glsl/standard/frag/lightmap.js';
import lightSpecularAnisoGGXPS from '../chunks-glsl/lit/frag/lightSpecularAnisoGGX.js';
import lightSpecularBlinnPS from '../chunks-glsl/lit/frag/lightSpecularBlinn.js';
import lightSheenPS from '../chunks-glsl/lit/frag/lightSheen.js';
import linearizeDepthPS from '../chunks-glsl/common/frag/linearizeDepth.js';
import litForwardBackendPS from '../chunks-glsl/lit/frag/pass-forward/litForwardBackend.js';
import litForwardDeclarationPS from '../chunks-glsl/lit/frag/pass-forward/litForwardDeclaration.js';
import litForwardMainPS from '../chunks-glsl/lit/frag/pass-forward/litForwardMain.js';
import litForwardPostCodePS from '../chunks-glsl/lit/frag/pass-forward/litForwardPostCode.js';
import litForwardPreCodePS from '../chunks-glsl/lit/frag/pass-forward/litForwardPreCode.js';
import litMainPS from '../chunks-glsl/lit/frag/litMain.js';
import litMainVS from '../chunks-glsl/lit/vert/litMain.js';
import litOtherMainPS from '../chunks-glsl/lit/frag/pass-other/litOtherMain.js';
import litShaderArgsPS from '../chunks-glsl/standard/frag/litShaderArgs.js';
import litShaderCorePS from '../chunks-glsl/standard/frag/litShaderCore.js';
import litShadowMainPS from '../chunks-glsl/lit/frag/pass-shadow/litShadowMain.js';
import ltcPS from '../chunks-glsl/lit/frag/ltc.js';
import metalnessPS from '../chunks-glsl/standard/frag/metalness.js';
import msdfPS from '../chunks-glsl/common/frag/msdf.js';
import metalnessModulatePS from '../chunks-glsl/lit/frag/metalnessModulate.js';
import morphPS from '../chunks-glsl/internal/morph/frag/morph.js';
import morphVS from '../chunks-glsl/internal/morph/vert/morph.js';
import msdfVS from '../chunks-glsl/common/vert/msdf.js';
import normalVS from '../chunks-glsl/lit/vert/normal.js';
import normalCoreVS from '../chunks-glsl/common/vert/normalCore.js';
import normalMapPS from '../chunks-glsl/standard/frag/normalMap.js';
import opacityPS from '../chunks-glsl/standard/frag/opacity.js';
import opacityDitherPS from '../chunks-glsl/standard/frag/opacity-dither.js';
import outputPS from '../chunks-glsl/lit/frag/output.js';
import outputAlphaPS from '../chunks-glsl/lit/frag/outputAlpha.js';
import outputTex2DPS from '../chunks-glsl/common/frag/outputTex2D.js';
import sheenPS from '../chunks-glsl/standard/frag/sheen.js';
import sheenGlossPS from '../chunks-glsl/standard/frag/sheenGloss.js';
import parallaxPS from '../chunks-glsl/standard/frag/parallax.js';
import pickPS from '../chunks-glsl/common/frag/pick.js';
import reflDirPS from '../chunks-glsl/lit/frag/reflDir.js';
import reflDirAnisoPS from '../chunks-glsl/lit/frag/reflDirAniso.js';
import reflectionCCPS from '../chunks-glsl/lit/frag/reflectionCC.js';
import reflectionCubePS from '../chunks-glsl/lit/frag/reflectionCube.js';
import reflectionEnvHQPS from '../chunks-glsl/lit/frag/reflectionEnvHQ.js';
import reflectionEnvPS from '../chunks-glsl/lit/frag/reflectionEnv.js';
import reflectionSpherePS from '../chunks-glsl/lit/frag/reflectionSphere.js';
import reflectionSheenPS from '../chunks-glsl/lit/frag/reflectionSheen.js';
import refractionCubePS from '../chunks-glsl/lit/frag/refractionCube.js';
import refractionDynamicPS from '../chunks-glsl/lit/frag/refractionDynamic.js';
import reprojectPS from '../chunks-glsl/internal/frag/reproject.js';
import reprojectVS from '../chunks-glsl/internal/vert/reproject.js';
import screenDepthPS from '../chunks-glsl/common/frag/screenDepth.js';
import shadowCascadesPS from '../chunks-glsl/lit/frag/lighting/shadowCascades.js';
import shadowEVSMPS from '../chunks-glsl/lit/frag/lighting/shadowEVSM.js';
import shadowPCF1PS from '../chunks-glsl/lit/frag/lighting/shadowPCF1.js';
import shadowPCF3PS from '../chunks-glsl/lit/frag/lighting/shadowPCF3.js';
import shadowPCF5PS from '../chunks-glsl/lit/frag/lighting/shadowPCF5.js';
import shadowPCSSPS from '../chunks-glsl/lit/frag/lighting/shadowPCSS.js';
import shadowSoftPS from '../chunks-glsl/lit/frag/lighting/shadowSoft.js';
import skinBatchVS from '../chunks-glsl/common/vert/skinBatch.js';
import skinVS from '../chunks-glsl/common/vert/skin.js';
import skyboxPS from '../chunks-glsl/skybox/frag/skybox.js';
import skyboxVS from '../chunks-glsl/skybox/vert/skybox.js';
import specularPS from '../chunks-glsl/standard/frag/specular.js';
import sphericalPS from '../chunks-glsl/common/frag/spherical.js';
import specularityFactorPS from '../chunks-glsl/standard/frag/specularityFactor.js';
import spotPS from '../chunks-glsl/lit/frag/spot.js';
import startNineSlicedPS from '../chunks-glsl/lit/frag/startNineSliced.js';
import startNineSlicedTiledPS from '../chunks-glsl/lit/frag/startNineSlicedTiled.js';
import stdDeclarationPS from '../chunks-glsl/standard/frag/stdDeclaration.js';
import stdFrontEndPS from '../chunks-glsl/standard/frag/stdFrontEnd.js';
import TBNPS from '../chunks-glsl/lit/frag/TBN.js';
import thicknessPS from '../chunks-glsl/standard/frag/thickness.js';
import tonemappingPS from '../chunks-glsl/common/frag/tonemapping/tonemapping.js';
import tonemappingAcesPS from '../chunks-glsl/common/frag/tonemapping/tonemappingAces.js';
import tonemappingAces2PS from '../chunks-glsl/common/frag/tonemapping/tonemappingAces2.js';
import tonemappingFilmicPS from '../chunks-glsl/common/frag/tonemapping/tonemappingFilmic.js';
import tonemappingHejlPS from '../chunks-glsl/common/frag/tonemapping/tonemappingHejl.js';
import tonemappingLinearPS from '../chunks-glsl/common/frag/tonemapping/tonemappingLinear.js';
import tonemappingNeutralPS from '../chunks-glsl/common/frag/tonemapping/tonemappingNeutral.js';
import tonemappingNonePS from '../chunks-glsl/common/frag/tonemapping/tonemappingNone.js';
import transformVS from '../chunks-glsl/common/vert/transform.js';
import transformCoreVS from '../chunks-glsl/common/vert/transformCore.js';
import transformInstancingVS from '../chunks-glsl/common/vert/transformInstancing.js';
import transmissionPS from '../chunks-glsl/standard/frag/transmission.js';
import twoSidedLightingPS from '../chunks-glsl/lit/frag/twoSidedLighting.js';
import uv0VS from '../chunks-glsl/lit/vert/uv0.js';
import uv1VS from '../chunks-glsl/lit/vert/uv1.js';
import uvTransformVS from '../chunks-glsl/lit/vert/uvTransform.js';
import uvTransformUniformsPS from '../chunks-glsl/lit/vert/uvTransformUniforms.js';
import viewDirPS from '../chunks-glsl/lit/frag/viewDir.js';
import webgpuPS from '../../../platform/graphics/shader-chunks/frag/webgpu.js';
import webgpuVS from '../../../platform/graphics/shader-chunks/vert/webgpu.js';

/**
 * Object containing all default shader chunks used by shader generators.
 *
 * @type {Record<string, string>}
 * @category Graphics
 * @ignore
 */
const shaderChunksGLSL = {
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
    cookiePS,
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
    gles3PS,
    gles3VS,
    glossPS,
    gsplatCenterVS,
    gsplatCornerVS,
    gsplatColorVS,
    gsplatCommonVS,
    gsplatCompressedDataVS,
    gsplatCompressedSHVS,
    gsplatSogsColorVS,
    gsplatSogsDataVS,
    gsplatSogsSHVS,
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
    shadowPCSSPS,
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

export { shaderChunksGLSL };
