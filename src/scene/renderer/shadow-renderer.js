import { Debug } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Color } from '../../core/math/color.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import {
    SEMANTIC_POSITION, SHADERSTAGE_FRAGMENT, SHADERSTAGE_VERTEX,
    UNIFORMTYPE_MAT4, UNIFORM_BUFFER_DEFAULT_SLOT_NAME
} from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { drawQuadWithShader } from '../graphics/quad-render-utils.js';
import {
    BLUR_GAUSSIAN,
    EVENT_POSTCULL,
    EVENT_PRECULL,
    LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI,
    SHADER_SHADOW,
    SHADOWCAMERA_NAME,
    SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME,
    shadowTypeInfo
} from '../constants.js';
import { ShaderPass } from '../shader-pass.js';
import { ShaderUtils } from '../shader-lib/shader-utils.js';
import { LightCamera } from './light-camera.js';
import { UniformBufferFormat, UniformFormat } from '../../platform/graphics/uniform-buffer-format.js';
import { BindUniformBufferFormat, BindGroupFormat } from '../../platform/graphics/bind-group-format.js';
import { BlendState } from '../../platform/graphics/blend-state.js';

/**
 * @import { Camera } from '../camera.js'
 * @import { LayerComposition } from '../composition/layer-composition.js'
 * @import { LightTextureAtlas } from '../lighting/light-texture-atlas.js'
 * @import { Light } from '../light.js'
 * @import { MeshInstance } from '../mesh-instance.js'
 * @import { Renderer } from './renderer.js'
 * @import { ShaderPassInfo } from '../shader-pass.js'
 */

const tempSet = new Set();
const shadowCamView = new Mat4();
const shadowCamViewProj = new Mat4();
const pixelOffset = new Float32Array(2);
const blurScissorRect = new Vec4(1, 1, 0, 0);
const viewportMatrix = new Mat4();

function gauss(x, sigma) {
    return Math.exp(-(x * x) / (2.0 * sigma * sigma));
}

function gaussWeights(kernelSize) {
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

class ShadowRenderer {
    /**
     * A cache of shadow passes. First index is looked up by light type, second by shadow type.
     *
     * @type {ShaderPassInfo[][]}
     * @private
     */
    shadowPassCache = [];

    /**
     * @param {Renderer} renderer - The renderer.
     * @param {LightTextureAtlas} lightTextureAtlas - The shadow map atlas.
     */
    constructor(renderer, lightTextureAtlas) {
        this.device = renderer.device;

        /** @type {Renderer} */
        this.renderer = renderer;

        /** @type {LightTextureAtlas} */
        this.lightTextureAtlas = lightTextureAtlas;

        const scope = this.device.scope;

        // VSM
        this.sourceId = scope.resolve('source');
        this.pixelOffsetId = scope.resolve('pixelOffset');
        this.weightId = scope.resolve('weight[0]');

        // cache for vsm blur shaders
        this.blurVsmShader = [{}, {}];

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
    static createShadowCamera(shadowType, type, face) {

        const shadowCam = LightCamera.create(SHADOWCAMERA_NAME, type, face);

        const shadowInfo = shadowTypeInfo.get(shadowType);
        Debug.assert(shadowInfo);
        const isVsm = shadowInfo?.vsm ?? false;
        const isPcf = shadowInfo?.pcf ?? false;

        // don't clear the color buffer if rendering a depth map
        if (isVsm) {
            shadowCam.clearColor = new Color(0, 0, 0, 0);
        } else {
            shadowCam.clearColor = new Color(1, 1, 1, 1);
        }

        shadowCam.clearDepthBuffer = true;
        shadowCam.clearStencilBuffer = false;

        // clear color buffer only when using it
        shadowCam.clearColorBuffer = !isPcf;

        return shadowCam;
    }

    _cullShadowCastersInternal(meshInstances, visible, camera) {

        const numInstances = meshInstances.length;
        for (let i = 0; i < numInstances; i++) {
            const meshInstance = meshInstances[i];

            if (meshInstance.castShadow) {
                if (!meshInstance.cull || meshInstance._isVisible(camera)) {
                    meshInstance.visibleThisFrame = true;
                    visible.push(meshInstance);
                }
            }
        }
    }

    /**
     * Culls the list of shadow casters used by the light by the camera, storing visible mesh
     * instances in the specified array.
     *
     * @param {LayerComposition} comp - The layer composition used as a source of shadow casters,
     * if those are not provided directly.
     * @param {Light} light - The light.
     * @param {MeshInstance[]} visible - The array to store visible mesh instances in.
     * @param {Camera} camera - The camera.
     * @param {MeshInstance[]} [casters] - Optional array of mesh instances to use as casters.
     */
    cullShadowCasters(comp, light, visible, camera, casters) {

        // event before the camera is culling
        this.renderer.scene?.fire(EVENT_PRECULL, camera);

        visible.length = 0;

        // if the casters are supplied, use them
        if (casters) {

            this._cullShadowCastersInternal(casters, visible, camera);

        } else {    // otherwise, get them from the layer composition

            // for each layer
            const layers = comp.layerList;
            const len = layers.length;
            for (let i = 0; i < len; i++) {
                const layer = layers[i];
                if (layer._lightsSet.has(light)) {

                    // layer can be in the list two times (opaque, transp), add casters only one time
                    if (!tempSet.has(layer)) {
                        tempSet.add(layer);

                        this._cullShadowCastersInternal(layer.shadowCasters, visible, camera);
                    }
                }
            }

            tempSet.clear();
        }

        // this sorts the shadow casters by the shader id
        visible.sort(this.sortCompareShader);

        // event after the camera is done with culling
        this.renderer.scene?.fire(EVENT_POSTCULL, camera);
    }

    sortCompareShader(drawCallA, drawCallB) {
        const keyA = drawCallA._sortKeyShadow;
        const keyB = drawCallB._sortKeyShadow;

        if (keyA === keyB) {
            return drawCallB.mesh.id - drawCallA.mesh.id;
        }

        return keyB - keyA;
    }

    setupRenderState(device, light) {

        // Set standard shadowmap states
        const isClustered = this.renderer.scene.clusteredLightingEnabled;
        const useShadowSampler = isClustered ?
            light._isPcf :     // both spot and omni light are using shadow sampler when clustered
            light._isPcf && light._type !== LIGHTTYPE_OMNI;    // for non-clustered, point light is using depth encoded in color buffer (should change to shadow sampler)

        device.setBlendState(useShadowSampler ? this.blendStateNoWrite : this.blendStateWrite);
        device.setDepthState(light.shadowDepthState);
        device.setStencilState(null, null);
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
     * @param {Light} light - The light.
     * @returns {number} Index of shadow pass info.
     */
    getShadowPass(light) {

        // get shader pass from cache for this light type and shadow type
        const lightType = light._type;
        const shadowType = light._shadowType;
        let shadowPassInfo = this.shadowPassCache[lightType]?.[shadowType];
        if (!shadowPassInfo) {

            // new shader pass if not in cache
            const shadowPassName = `ShadowPass_${lightType}_${shadowType}`;
            shadowPassInfo = ShaderPass.get(this.device).allocate(shadowPassName, {
                isShadow: true,
                lightType: lightType,
                shadowType: shadowType
            });

            // add it to the cache
            if (!this.shadowPassCache[lightType]) {
                this.shadowPassCache[lightType] = [];
            }
            this.shadowPassCache[lightType][shadowType] = shadowPassInfo;
        }

        return shadowPassInfo.index;
    }

    /**
     * @param {MeshInstance[]} visibleCasters - Visible mesh instances.
     * @param {Light} light - The light.
     * @param {Camera} camera - The camera.
     */
    submitCasters(visibleCasters, light, camera) {

        const device = this.device;
        const renderer = this.renderer;
        const scene = renderer.scene;
        const passFlags = 1 << SHADER_SHADOW;
        const shadowPass = this.getShadowPass(light);
        const cameraShaderParams = camera.shaderParams;

        // reverse face culling when shadow map has flipY set to true which cases reversed winding order
        const flipFactor = camera.renderTarget.flipY ? -1 : 1;

        // Render
        const count = visibleCasters.length;
        for (let i = 0; i < count; i++) {
            const meshInstance = visibleCasters[i];
            const mesh = meshInstance.mesh;

            // skip instanced rendering with 0 instances
            const instancingData = meshInstance.instancingData;
            if (instancingData && instancingData.count <= 0) {
                continue;
            }

            meshInstance.ensureMaterial(device);
            const material = meshInstance.material;

            DebugGraphics.pushGpuMarker(device, `Node: ${meshInstance.node.name}, Material: ${material.name}`);

            // set basic material states/parameters
            renderer.setBaseConstants(device, material);
            renderer.setSkinning(device, meshInstance);

            if (material.dirty) {
                material.updateUniforms(device, scene);
                material.dirty = false;
            }

            renderer.setupCullMode(true, flipFactor, meshInstance);

            // Uniforms I (shadow): material
            material.setParameters(device);

            // Uniforms II (shadow): meshInstance overrides
            meshInstance.setParameters(device, passFlags);

            const shaderInstance = meshInstance.getShaderInstance(shadowPass, 0, scene, cameraShaderParams, this.viewUniformFormat, this.viewBindGroupFormat);
            const shadowShader = shaderInstance.shader;
            Debug.assert(shadowShader, `no shader for pass ${shadowPass}`, material);

            if (shadowShader.failed) continue;

            // sort shadow casters by shader
            meshInstance._sortKeyShadow = shadowShader.id;

            device.setShader(shadowShader);

            // set buffers
            renderer.setVertexBuffers(device, mesh);
            renderer.setMorphing(device, meshInstance.morphInstance);

            if (instancingData) {
                device.setVertexBuffer(instancingData.vertexBuffer);
            }

            // mesh / mesh normal matrix
            renderer.setMeshInstanceMatrices(meshInstance);

            renderer.setupMeshUniformBuffers(shaderInstance);

            // draw
            const style = meshInstance.renderStyle;
            const indirectData = meshInstance.getDrawCommands(camera);
            device.draw(mesh.primitive[style], mesh.indexBuffer[style], instancingData?.count, indirectData);

            renderer._shadowDrawCalls++;
            if (instancingData) {
                renderer._instancedDrawCalls++;
            }

            DebugGraphics.popGpuMarker(device);
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
        const lightRenderData = this.getLightRenderData(light, camera, face);
        const shadowCam = lightRenderData.shadowCamera;

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
            renderer.setupViewUniformBuffers(lightRenderData.viewBindGroups, this.viewUniformFormat, this.viewBindGroupFormat, null);
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
        this.submitCasters(lightRenderData.visibleCasters, light, shadowCam);

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
            this.renderVsm(light, camera);
        }
    }

    renderVsm(light, camera) {

        // VSM blur if light supports vsm (directional and spot in general)
        if (light._isVsm && light._vsmBlurSize > 1) {

            // in clustered mode, only directional light can be vms
            const isClustered = this.renderer.scene.clusteredLightingEnabled;
            if (!isClustered || light._type === LIGHTTYPE_DIRECTIONAL) {
                this.applyVsmBlur(light, camera);
            }
        }
    }

    getVsmBlurShader(blurMode, filterSize) {

        const cache = this.blurVsmShader;
        let blurShader = cache[blurMode][filterSize];
        if (!blurShader) {
            this.blurVsmWeights[filterSize] = gaussWeights(filterSize);

            const defines = new Map();
            defines.set('{SAMPLES}', filterSize);
            if (blurMode === 1) defines.set('GAUSS', '');

            blurShader = ShaderUtils.createShader(this.device, {
                uniqueName: `blurVsm${blurMode}${filterSize}`,
                attributes: { vertex_position: SEMANTIC_POSITION },
                vertexChunk: 'fullscreenQuadVS',
                fragmentChunk: 'blurVSMPS',
                fragmentDefines: defines
            });

            cache[blurMode][filterSize] = blurShader;
        }

        return blurShader;
    }

    applyVsmBlur(light, camera) {

        const device = this.device;

        DebugGraphics.pushGpuMarker(device, `VSM ${light._node.name}`);

        // render state
        device.setBlendState(BlendState.NOBLEND);

        const lightRenderData = light.getRenderData(light._type === LIGHTTYPE_DIRECTIONAL ? camera : null, 0);
        const shadowCam = lightRenderData.shadowCamera;
        const origShadowMap = shadowCam.renderTarget;

        // temporary render target for blurring
        // TODO: this is probably not optimal and shadow map could have depth buffer on in addition to color buffer,
        // and for blurring only one buffer is needed.
        const tempShadowMap = this.renderer.shadowMapCache.get(device, light);
        const tempRt = tempShadowMap.renderTargets[0];

        const blurMode = light.vsmBlurMode;
        const filterSize = light._vsmBlurSize;
        const blurShader = this.getVsmBlurShader(blurMode, filterSize);

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
                new UniformFormat('matrix_viewProjection', UNIFORMTYPE_MAT4)
            ]);

            // format of the view bind group - contains single uniform buffer, and no textures
            this.viewBindGroupFormat = new BindGroupFormat(this.device, [
                new BindUniformBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT)
            ]);
        }
    }

    frameUpdate() {
        this.initViewBindGroupFormat();
    }
}

export { ShadowRenderer };
