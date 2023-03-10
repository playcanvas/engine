import { Debug } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Color } from '../../core/math/color.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';

import { FUNC_LESSEQUAL, SHADERSTAGE_FRAGMENT, SHADERSTAGE_VERTEX, UNIFORMTYPE_MAT4, UNIFORM_BUFFER_DEFAULT_SLOT_NAME } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { drawQuadWithShader } from '../graphics/quad-render-utils.js';

import {
    BLUR_GAUSSIAN,
    LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI,
    SHADER_SHADOW,
    SHADOW_PCF3, SHADOW_PCF5, SHADOW_VSM8, SHADOW_VSM32,
    SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME,
    SORTKEY_DEPTH
} from '../constants.js';
import { ShaderPass } from '../shader-pass.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { createShaderFromCode } from '../shader-lib/utils.js';
import { LightCamera } from './light-camera.js';
import { UniformBufferFormat, UniformFormat } from '../../platform/graphics/uniform-buffer-format.js';
import { BindBufferFormat, BindGroupFormat } from '../../platform/graphics/bind-group-format.js';
import { BlendState } from '../../platform/graphics/blend-state.js';

function gauss(x, sigma) {
    return Math.exp(-(x * x) / (2.0 * sigma * sigma));
}

const maxBlurSize = 25;
function gaussWeights(kernelSize) {
    if (kernelSize > maxBlurSize) {
        kernelSize = maxBlurSize;
    }
    const sigma = (kernelSize - 1) / (2 * 3);

    const halfWidth = (kernelSize - 1) * 0.5;
    const values = new Array(kernelSize);
    let sum = 0.0;
    for (let i = 0; i < kernelSize; ++i) {
        values[i] = gauss(i - halfWidth, sigma);
        sum += values[i];
    }

    for (let i = 0; i < kernelSize; ++i) {
        values[i] /= sum;
    }
    return values;
}

const shadowCamView = new Mat4();
const shadowCamViewProj = new Mat4();
const pixelOffset = new Float32Array(2);
const blurScissorRect = new Vec4(1, 1, 0, 0);
const opChanId = { r: 1, g: 2, b: 3, a: 4 };
const viewportMatrix = new Mat4();

function getDepthKey(meshInstance) {
    const material = meshInstance.material;
    const x = meshInstance.skinInstance ? 10 : 0;
    let y = 0;
    if (material.opacityMap) {
        const opChan = material.opacityMapChannel;
        if (opChan) {
            y = opChanId[opChan];
        }
    }
    return x + y;
}

/**
 * @ignore
 */
class ShadowRenderer {
    /**
     * @param {import('./renderer.js').Renderer} renderer - The renderer.
     * @param {import('../lighting/light-texture-atlas.js').LightTextureAtlas} lightTextureAtlas - The
     * shadow map atlas.
     */
    constructor(renderer, lightTextureAtlas) {
        this.device = renderer.device;

        /** @type {import('./renderer.js').Renderer} */
        this.renderer = renderer;

        /** @type {import('../lighting/light-texture-atlas.js').LightTextureAtlas} */
        this.lightTextureAtlas = lightTextureAtlas;

        const scope = this.device.scope;

        this.polygonOffsetId = scope.resolve('polygonOffset');
        this.polygonOffset = new Float32Array(2);

        // VSM
        this.sourceId = scope.resolve('source');
        this.pixelOffsetId = scope.resolve('pixelOffset');
        this.weightId = scope.resolve('weight[0]');
        this.blurVsmShaderCode = [shaderChunks.blurVSMPS, '#define GAUSS\n' + shaderChunks.blurVSMPS];
        const packed = '#define PACKED\n';
        this.blurPackedVsmShaderCode = [packed + this.blurVsmShaderCode[0], packed + this.blurVsmShaderCode[1]];

        // cache for vsm blur shaders
        this.blurVsmShader = [{}, {}];
        this.blurPackedVsmShader = [{}, {}];

        this.blurVsmWeights = {};

        // uniforms
        this.shadowMapLightRadiusId = scope.resolve('light_radius');

        // view bind group format with its uniform buffer format
        this.viewUniformFormat = null;
        this.viewBindGroupFormat = null;

        // blend states
        this.blendStateWrite = new BlendState();
        this.blendStateNoWrite = new BlendState();
        this.blendStateNoWrite.setColorWrite(false, false, false, false);
    }

    // creates shadow camera for a light and sets up its constant properties
    static createShadowCamera(device, shadowType, type, face) {

        const shadowCam = LightCamera.create('ShadowCamera', type, face);

        // don't clear the color buffer if rendering a depth map
        if (shadowType >= SHADOW_VSM8 && shadowType <= SHADOW_VSM32) {
            shadowCam.clearColor = new Color(0, 0, 0, 0);
        } else {
            shadowCam.clearColor = new Color(1, 1, 1, 1);
        }

        shadowCam.clearDepthBuffer = true;
        shadowCam.clearStencilBuffer = false;

        return shadowCam;
    }

    static setShadowCameraSettings(shadowCam, device, shadowType, type, isClustered) {

        // normal omni shadows on webgl2 encode depth in RGBA8 and do manual PCF sampling
        // clustered omni shadows on webgl2 use depth format and hardware PCF sampling
        let hwPcf = shadowType === SHADOW_PCF5 || (shadowType === SHADOW_PCF3 && device.supportsDepthShadow);
        if (type === LIGHTTYPE_OMNI && !isClustered) {
            hwPcf = false;
        }

        shadowCam.clearColorBuffer = !hwPcf;
    }

    // culls the list of meshes instances by the camera, storing visible mesh instances in the specified array
    cullShadowCasters(meshInstances, visible, camera) {

        let count = 0;
        const numInstances = meshInstances.length;
        for (let i = 0; i < numInstances; i++) {
            const meshInstance = meshInstances[i];

            if (meshInstance.castShadow) {
                if (!meshInstance.cull || meshInstance._isVisible(camera)) {
                    meshInstance.visibleThisFrame = true;
                    visible[count] = meshInstance;
                    count++;
                }
            }
        }

        visible.length = count;

        // TODO: we should probably sort shadow meshes by shader and not depth
        visible.sort(this.renderer.sortCompareDepth);
    }

    setupRenderState(device, light) {

        const isClustered = this.renderer.scene.clusteredLightingEnabled;

        // depth bias
        if (device.webgl2 || device.isWebGPU) {
            if (light._type === LIGHTTYPE_OMNI && !isClustered) {
                device.setDepthBias(false);
            } else {
                device.setDepthBias(true);
                device.setDepthBiasValues(light.shadowBias * -1000.0, light.shadowBias * -1000.0);
            }
        } else if (device.extStandardDerivatives) {
            if (light._type === LIGHTTYPE_OMNI) {
                this.polygonOffset[0] = 0;
                this.polygonOffset[1] = 0;
                this.polygonOffsetId.setValue(this.polygonOffset);
            } else {
                this.polygonOffset[0] = light.shadowBias * -1000.0;
                this.polygonOffset[1] = light.shadowBias * -1000.0;
                this.polygonOffsetId.setValue(this.polygonOffset);
            }
        }

        // Set standard shadowmap states
        device.setDepthWrite(true);
        device.setDepthTest(true);
        device.setDepthFunc(FUNC_LESSEQUAL);

        const useShadowSampler = isClustered ?
            light._isPcf && device.webgl2 :     // both spot and omni light are using shadow sampler on webgl2 when clustered
            light._isPcf && device.webgl2 && light._type !== LIGHTTYPE_OMNI;    // for non-clustered, point light is using depth encoded in color buffer (should change to shadow sampler)

        device.setBlendState(useShadowSampler ? this.blendStateNoWrite : this.blendStateWrite);
    }

    restoreRenderState(device) {

        if (device.webgl2) {
            device.setDepthBias(false);
        } else if (device.extStandardDerivatives) {
            this.polygonOffset[0] = 0;
            this.polygonOffset[1] = 0;
            this.polygonOffsetId.setValue(this.polygonOffset);
        }
    }

    dispatchUniforms(light, shadowCam, lightRenderData, face) {

        const shadowCamNode = shadowCam._node;

        // position / range
        if (light._type !== LIGHTTYPE_DIRECTIONAL) {
            this.renderer.dispatchViewPos(shadowCamNode.getPosition());
            this.shadowMapLightRadiusId.setValue(light.attenuationEnd);
        }

        // view-projection shadow matrix
        shadowCamView.setTRS(shadowCamNode.getPosition(), shadowCamNode.getRotation(), Vec3.ONE).invert();
        shadowCamViewProj.mul2(shadowCam.projectionMatrix, shadowCamView);

        // viewport handling
        const rectViewport = lightRenderData.shadowViewport;
        shadowCam.rect = rectViewport;
        shadowCam.scissorRect = lightRenderData.shadowScissor;

        viewportMatrix.setViewport(rectViewport.x, rectViewport.y, rectViewport.z, rectViewport.w);
        lightRenderData.shadowMatrix.mul2(viewportMatrix, shadowCamViewProj);

        if (light._type === LIGHTTYPE_DIRECTIONAL) {
            // copy matrix to shadow cascade palette
            light._shadowMatrixPalette.set(lightRenderData.shadowMatrix.data, face * 16);
        }
    }

    /**
     * @param {import('../mesh-instance.js').MeshInstance[]} visibleCasters - Visible mesh
     * instances.
     * @param {import('../light.js').Light} light - The light.
     */
    submitCasters(visibleCasters, light) {

        const device = this.device;
        const renderer = this.renderer;
        const scene = renderer.scene;
        const passFlags = 1 << SHADER_SHADOW;

        // Sort shadow casters
        const shadowPass = ShaderPass.getShadow(light._type, light._shadowType);

        // TODO: Similarly to forward renderer, a shader creation part of this loop should be split into a separate loop,
        // and endShaderBatch should be called at its end

        // Render
        const count = visibleCasters.length;
        for (let i = 0; i < count; i++) {
            const meshInstance = visibleCasters[i];
            const mesh = meshInstance.mesh;

            meshInstance.ensureMaterial(device);
            const material = meshInstance.material;

            // set basic material states/parameters
            renderer.setBaseConstants(device, material);
            renderer.setSkinning(device, meshInstance);

            if (material.dirty) {
                material.updateUniforms(device, scene);
                material.dirty = false;
            }

            if (material.chunks) {

                renderer.setCullMode(true, false, meshInstance);

                // Uniforms I (shadow): material
                material.setParameters(device);

                // Uniforms II (shadow): meshInstance overrides
                meshInstance.setParameters(device, passFlags);
            }

            // set shader
            let shadowShader = meshInstance._shader[shadowPass];
            if (!shadowShader) {
                meshInstance.updatePassShader(scene, shadowPass, null, null, this.viewUniformFormat, this.viewBindGroupFormat);
                shadowShader = meshInstance._shader[shadowPass];
                meshInstance._key[SORTKEY_DEPTH] = getDepthKey(meshInstance);
            }
            if (!shadowShader.failed && !device.setShader(shadowShader)) {
                Debug.error(`Error compiling shadow shader for material=${material.name} pass=${shadowPass}`, material);
            }

            // set buffers
            renderer.setVertexBuffers(device, mesh);
            renderer.setMorphing(device, meshInstance.morphInstance);

            this.renderer.setupMeshUniformBuffers(meshInstance, shadowPass);

            const style = meshInstance.renderStyle;
            device.setIndexBuffer(mesh.indexBuffer[style]);

            // draw
            renderer.drawInstance(device, meshInstance, mesh, style);
            renderer._shadowDrawCalls++;
        }
    }

    needsShadowRendering(light) {

        const needs = light.enabled && light.castShadows && light.shadowUpdateMode !== SHADOWUPDATE_NONE && light.visibleThisFrame;

        if (light.shadowUpdateMode === SHADOWUPDATE_THISFRAME) {
            light.shadowUpdateMode = SHADOWUPDATE_NONE;
        }

        if (needs) {
            this.renderer._shadowMapUpdates += light.numShadowFaces;
        }

        return needs;
    }

    getLightRenderData(light, camera, face) {
        // directional shadows are per camera, so get appropriate render data
        return light.getRenderData(light._type === LIGHTTYPE_DIRECTIONAL ? camera : null, face);
    }

    setupRenderPass(renderPass, shadowCamera, clearRenderTarget) {

        const rt = shadowCamera.renderTarget;
        renderPass.init(rt);

        renderPass.depthStencilOps.clearDepthValue = 1;
        renderPass.depthStencilOps.clearDepth = clearRenderTarget;

        // if rendering to depth buffer
        if (rt.depthBuffer) {

            renderPass.depthStencilOps.storeDepth = true;

        } else { // rendering to color buffer

            renderPass.colorOps.clearValue.copy(shadowCamera.clearColor);
            renderPass.colorOps.clear = clearRenderTarget;
            renderPass.depthStencilOps.storeDepth = false;
        }

        // not sampling dynamically generated cubemaps
        renderPass.requiresCubemaps = false;
    }

    // prepares render target / render target settings to allow render pass to be set up
    prepareFace(light, camera, face) {

        const type = light._type;
        const shadowType = light._shadowType;
        const isClustered = this.renderer.scene.clusteredLightingEnabled;

        const lightRenderData = this.getLightRenderData(light, camera, face);
        const shadowCam = lightRenderData.shadowCamera;

        // camera clear setting
        // Note: when clustered lighting is the only lighting type, this code can be moved to createShadowCamera function
        ShadowRenderer.setShadowCameraSettings(shadowCam, this.device, shadowType, type, isClustered);

        // assign render target for the face
        const renderTargetIndex = type === LIGHTTYPE_DIRECTIONAL ? 0 : face;
        shadowCam.renderTarget = light._shadowMap.renderTargets[renderTargetIndex];

        return shadowCam;
    }

    renderFace(light, camera, face, clear, insideRenderPass = true) {

        const device = this.device;

        // #if _PROFILER
        const shadowMapStartTime = now();
        // #endif

        DebugGraphics.pushGpuMarker(device, `SHADOW ${light._node.name} FACE ${face}`);

        const lightRenderData = this.getLightRenderData(light, camera, face);
        const shadowCam = lightRenderData.shadowCamera;

        this.dispatchUniforms(light, shadowCam, lightRenderData, face);

        const rt = shadowCam.renderTarget;
        const renderer = this.renderer;
        renderer.setCameraUniforms(shadowCam, rt);
        if (device.supportsUniformBuffers) {
            renderer.setupViewUniformBuffers(lightRenderData.viewBindGroups, this.viewUniformFormat, this.viewBindGroupFormat, 1);
        }

        if (insideRenderPass) {
            renderer.setupViewport(shadowCam, rt);

            // clear here is used to clear a viewport inside render target.
            if (clear) {
                renderer.clear(shadowCam);
            }
        } else {

            // this is only used by lightmapper, till it's converted to render passes
            renderer.clearView(shadowCam, rt, true, false);
        }

        this.setupRenderState(device, light);

        // render mesh instances
        this.submitCasters(lightRenderData.visibleCasters, light);

        this.restoreRenderState(device);

        DebugGraphics.popGpuMarker(device);

        // #if _PROFILER
        renderer._shadowMapTime += now() - shadowMapStartTime;
        // #endif
    }

    render(light, camera, insideRenderPass = true) {

        if (this.needsShadowRendering(light)) {
            const faceCount = light.numShadowFaces;

            // render faces
            for (let face = 0; face < faceCount; face++) {
                this.prepareFace(light, camera, face);
                this.renderFace(light, camera, face, true, insideRenderPass);
            }

            // apply vsm
            this.renderVms(light, camera);
        }
    }

    renderVms(light, camera) {

        // VSM blur if light supports vsm (directional and spot in general)
        if (light._isVsm && light._vsmBlurSize > 1) {

            // in clustered mode, only directional light can be vms
            const isClustered = this.renderer.scene.clusteredLightingEnabled;
            if (!isClustered || light._type === LIGHTTYPE_DIRECTIONAL) {
                this.applyVsmBlur(light, camera);
            }
        }
    }

    getVsmBlurShader(isVsm8, blurMode, filterSize) {

        let blurShader = (isVsm8 ? this.blurPackedVsmShader : this.blurVsmShader)[blurMode][filterSize];
        if (!blurShader) {
            this.blurVsmWeights[filterSize] = gaussWeights(filterSize);

            const blurVS = shaderChunks.fullscreenQuadVS;
            let blurFS = '#define SAMPLES ' + filterSize + '\n';
            if (isVsm8) {
                blurFS += this.blurPackedVsmShaderCode[blurMode];
            } else {
                blurFS += this.blurVsmShaderCode[blurMode];
            }
            const blurShaderName = 'blurVsm' + blurMode + '' + filterSize + '' + isVsm8;
            blurShader = createShaderFromCode(this.device, blurVS, blurFS, blurShaderName);

            if (isVsm8) {
                this.blurPackedVsmShader[blurMode][filterSize] = blurShader;
            } else {
                this.blurVsmShader[blurMode][filterSize] = blurShader;
            }
        }

        return blurShader;
    }

    applyVsmBlur(light, camera) {

        const device = this.device;

        DebugGraphics.pushGpuMarker(device, `VSM ${light._node.name}`);

        // render state
        device.setBlendState(BlendState.DEFAULT);

        const lightRenderData = light.getRenderData(light._type === LIGHTTYPE_DIRECTIONAL ? camera : null, 0);
        const shadowCam = lightRenderData.shadowCamera;
        const origShadowMap = shadowCam.renderTarget;

        // temporary render target for blurring
        // TODO: this is probably not optimal and shadow map could have depth buffer on in addition to color buffer,
        // and for blurring only one buffer is needed.
        const tempShadowMap = this.renderer.shadowMapCache.get(device, light);
        const tempRt = tempShadowMap.renderTargets[0];

        const isVsm8 = light._shadowType === SHADOW_VSM8;
        const blurMode = light.vsmBlurMode;
        const filterSize = light._vsmBlurSize;
        const blurShader = this.getVsmBlurShader(isVsm8, blurMode, filterSize);

        blurScissorRect.z = light._shadowResolution - 2;
        blurScissorRect.w = blurScissorRect.z;

        // Blur horizontal
        this.sourceId.setValue(origShadowMap.colorBuffer);
        pixelOffset[0] = 1 / light._shadowResolution;
        pixelOffset[1] = 0;
        this.pixelOffsetId.setValue(pixelOffset);
        if (blurMode === BLUR_GAUSSIAN) this.weightId.setValue(this.blurVsmWeights[filterSize]);
        drawQuadWithShader(device, tempRt, blurShader, null, blurScissorRect);

        // Blur vertical
        this.sourceId.setValue(tempRt.colorBuffer);
        pixelOffset[1] = pixelOffset[0];
        pixelOffset[0] = 0;
        this.pixelOffsetId.setValue(pixelOffset);
        drawQuadWithShader(device, origShadowMap, blurShader, null, blurScissorRect);

        // return the temporary shadow map back to the cache
        this.renderer.shadowMapCache.add(light, tempShadowMap);

        DebugGraphics.popGpuMarker(device);
    }

    initViewBindGroupFormat() {

        if (this.device.supportsUniformBuffers && !this.viewUniformFormat) {

            // format of the view uniform buffer
            this.viewUniformFormat = new UniformBufferFormat(this.device, [
                new UniformFormat("matrix_viewProjection", UNIFORMTYPE_MAT4)
            ]);

            // format of the view bind group - contains single uniform buffer, and no textures
            this.viewBindGroupFormat = new BindGroupFormat(this.device, [
                new BindBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT)
            ], [
            ]);
        }
    }

    frameUpdate() {
        this.initViewBindGroupFormat();
    }
}

export { ShadowRenderer };
