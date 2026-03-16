import alphaTestPS from '../chunks/standard/frag/alphaTest.js';
import ambientPS from '../chunks/lit/frag/ambient.js';
import anisotropyPS from '../chunks/standard/frag/anisotropy.js';
import aoPS from '../chunks/standard/frag/ao.js';
import aoDiffuseOccPS from '../chunks/lit/frag/aoDiffuseOcc.js';
import aoSpecOccPS from '../chunks/lit/frag/aoSpecOcc.js';
import bakeDirLmEndPS from '../chunks/lightmapper/frag/bakeDirLmEnd.js';
import bakeLmEndPS from '../chunks/lightmapper/frag/bakeLmEnd.js';
import basePS from '../chunks/lit/frag/base.js';
import baseNineSlicedPS from '../chunks/lit/frag/baseNineSliced.js';
import baseNineSlicedTiledPS from '../chunks/lit/frag/baseNineSlicedTiled.js';
import bayerPS from '../chunks/common/frag/bayer.js';
import blurVSMPS from '../chunks/lit/frag/blurVSM.js';
import clearCoatPS from '../chunks/standard/frag/clearCoat.js';
import clearCoatGlossPS from '../chunks/standard/frag/clearCoatGloss.js';
import clearCoatNormalPS from '../chunks/standard/frag/clearCoatNormal.js';
import clusteredLightUtilsPS from '../chunks/lit/frag/clusteredLightUtils.js';
import clusteredLightCookiesPS from '../chunks/lit/frag/clusteredLightCookies.js';
import clusteredLightShadowsPS from '../chunks/lit/frag/clusteredLightShadows.js';
import clusteredLightPS from '../chunks/lit/frag/clusteredLight.js';
import combinePS from '../chunks/lit/frag/combine.js';
import cookieBlit2DPS from '../chunks/internal/frag/cookie-blit-2d.js';
import cookieBlitCubePS from '../chunks/internal/frag/cookie-blit-cube.js';
import cookieBlitVS from '../chunks/internal/vert/cookie-blit.js';
import cookiePS from '../chunks/lit/frag/cookie.js';
import cubeMapProjectPS from '../chunks/lit/frag/cubeMapProject.js';
import cubeMapRotatePS from '../chunks/lit/frag/cubeMapRotate.js';
import debugOutputPS from '../chunks/lit/frag/debug-output.js';
import debugProcessFrontendPS from '../chunks/lit/frag/debug-process-frontend.js';
import decodePS from '../chunks/common/frag/decode.js';
import detailModesPS from '../chunks/standard/frag/detailModes.js';
import diffusePS from '../chunks/standard/frag/diffuse.js';
import emissivePS from '../chunks/standard/frag/emissive.js';
import encodePS from '../chunks/common/frag/encode.js';
import endPS from '../chunks/lit/frag/end.js';
import envAtlasPS from '../chunks/common/frag/envAtlas.js';
import envProcPS from '../chunks/common/frag/envProc.js';
import falloffInvSquaredPS from '../chunks/lit/frag/falloffInvSquared.js';
import falloffLinearPS from '../chunks/lit/frag/falloffLinear.js';
import floatAsUintPS from '../chunks/common/frag/float-as-uint.js';
import fogPS from '../chunks/common/frag/fog.js';
import fresnelSchlickPS from '../chunks/lit/frag/fresnelSchlick.js';
import fullscreenQuadVS from '../chunks/common/vert/fullscreenQuad.js';
import gammaPS from '../chunks/common/frag/gamma.js';
import gles3PS from '../../../../platform/graphics/shader-chunks/frag/gles3.js';
import gles3VS from '../../../../platform/graphics/shader-chunks/vert/gles3.js';
import glossPS from '../chunks/standard/frag/gloss.js';
import quadVS from '../chunks/common/vert/quad.js';
import immediateLinePS from '../chunks/internal/frag/immediateLine.js';
import immediateLineVS from '../chunks/internal/vert/immediateLine.js';
import iridescenceDiffractionPS from '../chunks/lit/frag/iridescenceDiffraction.js';
import iridescencePS from '../chunks/standard/frag/iridescence.js';
import iridescenceThicknessPS from '../chunks/standard/frag/iridescenceThickness.js';
import iorPS from '../chunks/standard/frag/ior.js';
import lightDeclarationPS from '../chunks/lit/frag/lighting/lightDeclaration.js';
import lightDiffuseLambertPS from '../chunks/lit/frag/lightDiffuseLambert.js';
import lightDirPointPS from '../chunks/lit/frag/lightDirPoint.js';
import lightEvaluationPS from '../chunks/lit/frag/lighting/lightEvaluation.js';
import lightFunctionLightPS from '../chunks/lit/frag/lighting/lightFunctionLight.js';
import lightFunctionShadowPS from '../chunks/lit/frag/lighting/lightFunctionShadow.js';
import lightingPS from '../chunks/lit/frag/lighting/lighting.js';
import lightmapAddPS from '../chunks/lit/frag/lightmapAdd.js';
import lightmapPS from '../chunks/standard/frag/lightmap.js';
import lightSpecularAnisoGGXPS from '../chunks/lit/frag/lightSpecularAnisoGGX.js';
import lightSpecularGGXPS from '../chunks/lit/frag/lightSpecularGGX.js';
import lightSpecularBlinnPS from '../chunks/lit/frag/lightSpecularBlinn.js';
import lightSheenPS from '../chunks/lit/frag/lightSheen.js';
import linearizeDepthPS from '../chunks/common/frag/linearizeDepth.js';
import litForwardBackendPS from '../chunks/lit/frag/pass-forward/litForwardBackend.js';
import litForwardDeclarationPS from '../chunks/lit/frag/pass-forward/litForwardDeclaration.js';
import litForwardMainPS from '../chunks/lit/frag/pass-forward/litForwardMain.js';
import litForwardPostCodePS from '../chunks/lit/frag/pass-forward/litForwardPostCode.js';
import litForwardPreCodePS from '../chunks/lit/frag/pass-forward/litForwardPreCode.js';
import litMainPS from '../chunks/lit/frag/litMain.js';
import litMainVS from '../chunks/lit/vert/litMain.js';
import litOtherMainPS from '../chunks/lit/frag/pass-other/litOtherMain.js';
import litShaderArgsPS from '../chunks/standard/frag/litShaderArgs.js';
import litShaderCorePS from '../chunks/standard/frag/litShaderCore.js';
import litShadowMainPS from '../chunks/lit/frag/pass-shadow/litShadowMain.js';
import ltcPS from '../chunks/lit/frag/ltc.js';
import metalnessPS from '../chunks/standard/frag/metalness.js';
import msdfPS from '../chunks/common/frag/msdf.js';
import metalnessModulatePS from '../chunks/lit/frag/metalnessModulate.js';
import morphPS from '../chunks/internal/morph/frag/morph.js';
import morphVS from '../chunks/internal/morph/vert/morph.js';
import msdfVS from '../chunks/common/vert/msdf.js';
import normalVS from '../chunks/lit/vert/normal.js';
import normalCoreVS from '../chunks/common/vert/normalCore.js';
import normalMapPS from '../chunks/standard/frag/normalMap.js';
import opacityPS from '../chunks/standard/frag/opacity.js';
import opacityDitherPS from '../chunks/standard/frag/opacity-dither.js';
import outputPS from '../chunks/lit/frag/output.js';
import outputAlphaPS from '../chunks/lit/frag/outputAlpha.js';
import outputTex2DPS from '../chunks/common/frag/outputTex2D.js';
import sheenPS from '../chunks/standard/frag/sheen.js';
import sheenGlossPS from '../chunks/standard/frag/sheenGloss.js';
import parallaxPS from '../chunks/standard/frag/parallax.js';
import pickPS from '../chunks/common/frag/pick.js';
import reflDirPS from '../chunks/lit/frag/reflDir.js';
import reflDirAnisoPS from '../chunks/lit/frag/reflDirAniso.js';
import reflectionCCPS from '../chunks/lit/frag/reflectionCC.js';
import reflectionCubePS from '../chunks/lit/frag/reflectionCube.js';
import reflectionEnvHQPS from '../chunks/lit/frag/reflectionEnvHQ.js';
import reflectionEnvPS from '../chunks/lit/frag/reflectionEnv.js';
import reflectionSpherePS from '../chunks/lit/frag/reflectionSphere.js';
import reflectionSheenPS from '../chunks/lit/frag/reflectionSheen.js';
import refractionCubePS from '../chunks/lit/frag/refractionCube.js';
import refractionDynamicPS from '../chunks/lit/frag/refractionDynamic.js';
import reprojectPS from '../chunks/internal/frag/reproject.js';
import reprojectVS from '../chunks/internal/vert/reproject.js';
import screenDepthPS from '../chunks/common/frag/screenDepth.js';
import shadowCascadesPS from '../chunks/lit/frag/lighting/shadowCascades.js';
import shadowEVSMPS from '../chunks/lit/frag/lighting/shadowEVSM.js';
import shadowPCF1PS from '../chunks/lit/frag/lighting/shadowPCF1.js';
import shadowPCF3PS from '../chunks/lit/frag/lighting/shadowPCF3.js';
import shadowPCF5PS from '../chunks/lit/frag/lighting/shadowPCF5.js';
import shadowPCSSPS from '../chunks/lit/frag/lighting/shadowPCSS.js';
import shadowSoftPS from '../chunks/lit/frag/lighting/shadowSoft.js';
import skinBatchVS from '../chunks/common/vert/skinBatch.js';
import skinVS from '../chunks/common/vert/skin.js';
import skyboxPS from '../chunks/skybox/frag/skybox.js';
import skyboxVS from '../chunks/skybox/vert/skybox.js';
import specularPS from '../chunks/standard/frag/specular.js';
import sphericalPS from '../chunks/common/frag/spherical.js';
import specularityFactorPS from '../chunks/standard/frag/specularityFactor.js';
import spotPS from '../chunks/lit/frag/spot.js';
import startNineSlicedPS from '../chunks/lit/frag/startNineSliced.js';
import startNineSlicedTiledPS from '../chunks/lit/frag/startNineSlicedTiled.js';
import stdDeclarationPS from '../chunks/standard/frag/stdDeclaration.js';
import stdFrontEndPS from '../chunks/standard/frag/stdFrontEnd.js';
import TBNPS from '../chunks/lit/frag/TBN.js';
import thicknessPS from '../chunks/standard/frag/thickness.js';
import tonemappingPS from '../chunks/common/frag/tonemapping/tonemapping.js';
import tonemappingAcesPS from '../chunks/common/frag/tonemapping/tonemappingAces.js';
import tonemappingAces2PS from '../chunks/common/frag/tonemapping/tonemappingAces2.js';
import tonemappingFilmicPS from '../chunks/common/frag/tonemapping/tonemappingFilmic.js';
import tonemappingHejlPS from '../chunks/common/frag/tonemapping/tonemappingHejl.js';
import tonemappingLinearPS from '../chunks/common/frag/tonemapping/tonemappingLinear.js';
import tonemappingNeutralPS from '../chunks/common/frag/tonemapping/tonemappingNeutral.js';
import tonemappingNonePS from '../chunks/common/frag/tonemapping/tonemappingNone.js';
import transformVS from '../chunks/common/vert/transform.js';
import transformCoreVS from '../chunks/common/vert/transformCore.js';
import transformInstancingVS from '../chunks/common/vert/transformInstancing.js';
import transmissionPS from '../chunks/standard/frag/transmission.js';
import twoSidedLightingPS from '../chunks/lit/frag/twoSidedLighting.js';
import uv0VS from '../chunks/lit/vert/uv0.js';
import uv1VS from '../chunks/lit/vert/uv1.js';
import uvTransformVS from '../chunks/lit/vert/uvTransform.js';
import uvTransformUniformsPS from '../chunks/lit/vert/uvTransformUniforms.js';
import viewDirPS from '../chunks/lit/frag/viewDir.js';
import webgpuPS from '../../../../platform/graphics/shader-chunks/frag/webgpu.js';
import webgpuVS from '../../../../platform/graphics/shader-chunks/vert/webgpu.js';

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
    quadVS,
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
    lightSpecularGGXPS,
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
