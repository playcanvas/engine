import { now } from '../../core/time.js';
import { Debug, DebugHelper } from '../../core/debug.js';

import { Vec3 } from '../../core/math/vec3.js';
import { Color } from '../../core/math/color.js';

import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';

import {
    FOG_NONE, FOG_LINEAR,
    LIGHTTYPE_OMNI, LIGHTTYPE_SPOT, LIGHTTYPE_DIRECTIONAL,
    LIGHTSHAPE_PUNCTUAL,
    LAYERID_DEPTH
} from '../constants.js';

import { Renderer } from './renderer.js';
import { LightCamera } from './light-camera.js';
import { WorldClustersDebug } from '../lighting/world-clusters-debug.js';
import { SceneGrab } from '../graphics/scene-grab.js';
import { BlendState } from '../../platform/graphics/blend-state.js';

const webgl1DepthClearColor = new Color(254.0 / 255, 254.0 / 255, 254.0 / 255, 254.0 / 255);

const _drawCallList = {
    drawCalls: [],
    shaderInstances: [],
    isNewMaterial: [],
    lightMaskChanged: [],

    clear: function () {
        this.drawCalls.length = 0;
        this.shaderInstances.length = 0;
        this.isNewMaterial.length = 0;
        this.lightMaskChanged.length = 0;
    }
};

function vogelDiskPrecalculationSamples(numSamples) {
    const samples = [];
    for (let i = 0; i < numSamples; ++i) {
        const r = Math.sqrt(i + 0.5) / Math.sqrt(numSamples);
        samples.push(r);
    }
    return samples;
}

function vogelSpherePrecalculationSamples(numSamples) {
    const samples = [];
    for (let i = 0; i < numSamples; i++) {
        const weight = i / numSamples;
        const radius = Math.sqrt(1.0 - weight * weight);
        samples.push(radius);
    }
    return samples;
}

/**
 * The forward renderer renders {@link Scene}s.
 *
 * @ignore
 */
class ForwardRenderer extends Renderer {
    /**
     * Create a new ForwardRenderer instance.
     *
     * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} graphicsDevice - The
     * graphics device used by the renderer.
     */
    constructor(graphicsDevice) {
        super(graphicsDevice);

        const device = this.device;

        this._forwardDrawCalls = 0;
        this._materialSwitches = 0;
        this._depthMapTime = 0;
        this._forwardTime = 0;
        this._sortTime = 0;

        // Uniforms
        const scope = device.scope;

        this.fogColorId = scope.resolve('fog_color');
        this.fogStartId = scope.resolve('fog_start');
        this.fogEndId = scope.resolve('fog_end');
        this.fogDensityId = scope.resolve('fog_density');

        this.ambientId = scope.resolve('light_globalAmbient');
        this.skyboxIntensityId = scope.resolve('skyboxIntensity');
        this.cubeMapRotationMatrixId = scope.resolve('cubeMapRotationMatrix');
        this.pcssDiskSamplesId = scope.resolve('pcssDiskSamples[0]');
        this.pcssSphereSamplesId = scope.resolve('pcssSphereSamples[0]');
        this.lightColorId = [];
        this.lightDir = [];
        this.lightDirId = [];
        this.lightShadowMapId = [];
        this.lightShadowMatrixId = [];
        this.lightShadowParamsId = [];
        this.lightShadowIntensity = [];
        this.lightRadiusId = [];
        this.lightPos = [];
        this.lightPosId = [];
        this.lightWidth = [];
        this.lightWidthId = [];
        this.lightHeight = [];
        this.lightHeightId = [];
        this.lightInAngleId = [];
        this.lightOutAngleId = [];
        this.lightCookieId = [];
        this.lightCookieIntId = [];
        this.lightCookieMatrixId = [];
        this.lightCookieOffsetId = [];
        this.lightShadowSearchAreaId = [];
        this.lightCameraParamsId = [];

        // shadow cascades
        this.shadowMatrixPaletteId = [];
        this.shadowCascadeDistancesId = [];
        this.shadowCascadeCountId = [];

        this.screenSizeId = scope.resolve('uScreenSize');
        this._screenSize = new Float32Array(4);

        this.fogColor = new Float32Array(3);
        this.ambientColor = new Float32Array(3);

        this.pcssDiskSamples = vogelDiskPrecalculationSamples(16);
        this.pcssSphereSamples = vogelSpherePrecalculationSamples(16);
    }

    destroy() {
        super.destroy();
    }

    // #if _PROFILER
    // Static properties used by the Profiler in the Editor's Launch Page
    static skipRenderCamera = null;

    static _skipRenderCounter = 0;

    static skipRenderAfter = 0;
    // #endif

    /**
     * @param {import('../scene.js').Scene} scene - The scene.
     */
    dispatchGlobalLights(scene) {
        this.ambientColor[0] = scene.ambientLight.r;
        this.ambientColor[1] = scene.ambientLight.g;
        this.ambientColor[2] = scene.ambientLight.b;
        if (scene.gammaCorrection) {
            for (let i = 0; i < 3; i++) {
                this.ambientColor[i] = Math.pow(this.ambientColor[i], 2.2);
            }
        }
        if (scene.physicalUnits) {
            for (let i = 0; i < 3; i++) {
                this.ambientColor[i] *= scene.ambientLuminance;
            }
        }
        this.ambientId.setValue(this.ambientColor);

        this.skyboxIntensityId.setValue(scene.physicalUnits ? scene.skyboxLuminance : scene.skyboxIntensity);
        this.cubeMapRotationMatrixId.setValue(scene._skyboxRotationMat3.data);
    }

    _resolveLight(scope, i) {
        const light = 'light' + i;
        this.lightColorId[i] = scope.resolve(light + '_color');
        this.lightDir[i] = new Float32Array(3);
        this.lightDirId[i] = scope.resolve(light + '_direction');
        this.lightShadowMapId[i] = scope.resolve(light + '_shadowMap');
        this.lightShadowMatrixId[i] = scope.resolve(light + '_shadowMatrix');
        this.lightShadowParamsId[i] = scope.resolve(light + '_shadowParams');
        this.lightShadowIntensity[i] = scope.resolve(light + '_shadowIntensity');
        this.lightShadowSearchAreaId[i] = scope.resolve(light + '_shadowSearchArea');
        this.lightRadiusId[i] = scope.resolve(light + '_radius');
        this.lightPos[i] = new Float32Array(3);
        this.lightPosId[i] = scope.resolve(light + '_position');
        this.lightWidth[i] = new Float32Array(3);
        this.lightWidthId[i] = scope.resolve(light + '_halfWidth');
        this.lightHeight[i] = new Float32Array(3);
        this.lightHeightId[i] = scope.resolve(light + '_halfHeight');
        this.lightInAngleId[i] = scope.resolve(light + '_innerConeAngle');
        this.lightOutAngleId[i] = scope.resolve(light + '_outerConeAngle');
        this.lightCookieId[i] = scope.resolve(light + '_cookie');
        this.lightCookieIntId[i] = scope.resolve(light + '_cookieIntensity');
        this.lightCookieMatrixId[i] = scope.resolve(light + '_cookieMatrix');
        this.lightCookieOffsetId[i] = scope.resolve(light + '_cookieOffset');
        this.lightCameraParamsId[i] = scope.resolve(light + '_cameraParams');

        // shadow cascades
        this.shadowMatrixPaletteId[i] = scope.resolve(light + '_shadowMatrixPalette[0]');
        this.shadowCascadeDistancesId[i] = scope.resolve(light + '_shadowCascadeDistances[0]');
        this.shadowCascadeCountId[i] = scope.resolve(light + '_shadowCascadeCount');
    }

    setLTCDirectionalLight(wtm, cnt, dir, campos, far) {
        this.lightPos[cnt][0] = campos.x - dir.x * far;
        this.lightPos[cnt][1] = campos.y - dir.y * far;
        this.lightPos[cnt][2] = campos.z - dir.z * far;
        this.lightPosId[cnt].setValue(this.lightPos[cnt]);

        const hWidth = wtm.transformVector(new Vec3(-0.5, 0, 0));
        this.lightWidth[cnt][0] = hWidth.x * far;
        this.lightWidth[cnt][1] = hWidth.y * far;
        this.lightWidth[cnt][2] = hWidth.z * far;
        this.lightWidthId[cnt].setValue(this.lightWidth[cnt]);

        const hHeight = wtm.transformVector(new Vec3(0, 0, 0.5));
        this.lightHeight[cnt][0] = hHeight.x * far;
        this.lightHeight[cnt][1] = hHeight.y * far;
        this.lightHeight[cnt][2] = hHeight.z * far;
        this.lightHeightId[cnt].setValue(this.lightHeight[cnt]);
    }

    dispatchDirectLights(dirs, scene, mask, camera) {
        let cnt = 0;

        const scope = this.device.scope;

        for (let i = 0; i < dirs.length; i++) {
            if (!(dirs[i].mask & mask)) continue;

            const directional = dirs[i];
            const wtm = directional._node.getWorldTransform();

            if (!this.lightColorId[cnt]) {
                this._resolveLight(scope, cnt);
            }

            this.lightColorId[cnt].setValue(scene.gammaCorrection ? directional._linearFinalColor : directional._finalColor);

            // Directional lights shine down the negative Y axis
            wtm.getY(directional._direction).mulScalar(-1);
            directional._direction.normalize();
            this.lightDir[cnt][0] = directional._direction.x;
            this.lightDir[cnt][1] = directional._direction.y;
            this.lightDir[cnt][2] = directional._direction.z;
            this.lightDirId[cnt].setValue(this.lightDir[cnt]);

            if (directional.shape !== LIGHTSHAPE_PUNCTUAL) {
                // non-punctual shape - NB directional area light specular is approximated by putting the area light at the far clip
                this.setLTCDirectionalLight(wtm, cnt, directional._direction, camera._node.getPosition(), camera.farClip);
            }

            if (directional.castShadows) {

                const lightRenderData = directional.getRenderData(camera, 0);
                const biases = directional._getUniformBiasValues(lightRenderData);

                this.lightShadowMapId[cnt].setValue(lightRenderData.shadowBuffer);
                this.lightShadowMatrixId[cnt].setValue(lightRenderData.shadowMatrix.data);

                this.shadowMatrixPaletteId[cnt].setValue(directional._shadowMatrixPalette);
                this.shadowCascadeDistancesId[cnt].setValue(directional._shadowCascadeDistances);
                this.shadowCascadeCountId[cnt].setValue(directional.numCascades);
                this.lightShadowIntensity[cnt].setValue(directional.shadowIntensity);

                const projectionCompensation = (50.0 / lightRenderData.projectionCompensation);
                const pixelsPerMeter = directional.penumbraSize / lightRenderData.shadowCamera.renderTarget.width;
                this.lightShadowSearchAreaId[cnt].setValue(pixelsPerMeter * projectionCompensation);

                const cameraParams = directional._shadowCameraParams;
                cameraParams.length = 4;
                cameraParams[0] = lightRenderData.depthRangeCompensation;
                cameraParams[1] = lightRenderData.shadowCamera._farClip;
                cameraParams[2] = lightRenderData.shadowCamera._nearClip;
                cameraParams[3] = 1;
                this.lightCameraParamsId[cnt].setValue(cameraParams);

                const params = directional._shadowRenderParams;
                params.length = 4;
                params[0] = directional._shadowResolution;  // Note: this needs to change for non-square shadow maps (2 cascades). Currently square is used
                params[1] = biases.normalBias;
                params[2] = biases.bias;
                params[3] = 0;
                this.lightShadowParamsId[cnt].setValue(params);
            }
            cnt++;
        }
        return cnt;
    }

    setLTCPositionalLight(wtm, cnt) {
        const hWidth = wtm.transformVector(new Vec3(-0.5, 0, 0));
        this.lightWidth[cnt][0] = hWidth.x;
        this.lightWidth[cnt][1] = hWidth.y;
        this.lightWidth[cnt][2] = hWidth.z;
        this.lightWidthId[cnt].setValue(this.lightWidth[cnt]);

        const hHeight = wtm.transformVector(new Vec3(0, 0, 0.5));
        this.lightHeight[cnt][0] = hHeight.x;
        this.lightHeight[cnt][1] = hHeight.y;
        this.lightHeight[cnt][2] = hHeight.z;
        this.lightHeightId[cnt].setValue(this.lightHeight[cnt]);
    }

    dispatchOmniLight(scene, scope, omni, cnt) {
        const wtm = omni._node.getWorldTransform();

        if (!this.lightColorId[cnt]) {
            this._resolveLight(scope, cnt);
        }

        this.lightRadiusId[cnt].setValue(omni.attenuationEnd);
        this.lightColorId[cnt].setValue(scene.gammaCorrection ? omni._linearFinalColor : omni._finalColor);
        wtm.getTranslation(omni._position);
        this.lightPos[cnt][0] = omni._position.x;
        this.lightPos[cnt][1] = omni._position.y;
        this.lightPos[cnt][2] = omni._position.z;
        this.lightPosId[cnt].setValue(this.lightPos[cnt]);

        if (omni.shape !== LIGHTSHAPE_PUNCTUAL) {
            // non-punctual shape
            this.setLTCPositionalLight(wtm, cnt);
        }

        if (omni.castShadows) {

            // shadow map
            const lightRenderData = omni.getRenderData(null, 0);
            this.lightShadowMapId[cnt].setValue(lightRenderData.shadowBuffer);

            const biases = omni._getUniformBiasValues(lightRenderData);
            const params = omni._shadowRenderParams;
            params.length = 4;
            params[0] = omni._shadowResolution;
            params[1] = biases.normalBias;
            params[2] = biases.bias;
            params[3] = 1.0 / omni.attenuationEnd;
            this.lightShadowParamsId[cnt].setValue(params);
            this.lightShadowIntensity[cnt].setValue(omni.shadowIntensity);

            const pixelsPerMeter = omni.penumbraSize / lightRenderData.shadowCamera.renderTarget.width;
            this.lightShadowSearchAreaId[cnt].setValue(pixelsPerMeter);
            const cameraParams = omni._shadowCameraParams;

            cameraParams.length = 4;
            cameraParams[0] = lightRenderData.depthRangeCompensation;
            cameraParams[1] = lightRenderData.shadowCamera._farClip;
            cameraParams[2] = lightRenderData.shadowCamera._nearClip;
            cameraParams[3] = 0;
            this.lightCameraParamsId[cnt].setValue(cameraParams);
        }
        if (omni._cookie) {
            this.lightCookieId[cnt].setValue(omni._cookie);
            this.lightShadowMatrixId[cnt].setValue(wtm.data);
            this.lightCookieIntId[cnt].setValue(omni.cookieIntensity);
        }
    }

    dispatchSpotLight(scene, scope, spot, cnt) {
        const wtm = spot._node.getWorldTransform();

        if (!this.lightColorId[cnt]) {
            this._resolveLight(scope, cnt);
        }

        this.lightInAngleId[cnt].setValue(spot._innerConeAngleCos);
        this.lightOutAngleId[cnt].setValue(spot._outerConeAngleCos);
        this.lightRadiusId[cnt].setValue(spot.attenuationEnd);
        this.lightColorId[cnt].setValue(scene.gammaCorrection ? spot._linearFinalColor : spot._finalColor);
        wtm.getTranslation(spot._position);
        this.lightPos[cnt][0] = spot._position.x;
        this.lightPos[cnt][1] = spot._position.y;
        this.lightPos[cnt][2] = spot._position.z;
        this.lightPosId[cnt].setValue(this.lightPos[cnt]);

        if (spot.shape !== LIGHTSHAPE_PUNCTUAL) {
            // non-punctual shape
            this.setLTCPositionalLight(wtm, cnt);
        }

        // Spots shine down the negative Y axis
        wtm.getY(spot._direction).mulScalar(-1);
        spot._direction.normalize();
        this.lightDir[cnt][0] = spot._direction.x;
        this.lightDir[cnt][1] = spot._direction.y;
        this.lightDir[cnt][2] = spot._direction.z;
        this.lightDirId[cnt].setValue(this.lightDir[cnt]);

        if (spot.castShadows) {

            // shadow map
            const lightRenderData = spot.getRenderData(null, 0);
            this.lightShadowMapId[cnt].setValue(lightRenderData.shadowBuffer);

            this.lightShadowMatrixId[cnt].setValue(lightRenderData.shadowMatrix.data);

            const biases = spot._getUniformBiasValues(lightRenderData);
            const params = spot._shadowRenderParams;
            params.length = 4;
            params[0] = spot._shadowResolution;
            params[1] = biases.normalBias;
            params[2] = biases.bias;
            params[3] = 1.0 / spot.attenuationEnd;
            this.lightShadowParamsId[cnt].setValue(params);
            this.lightShadowIntensity[cnt].setValue(spot.shadowIntensity);

            const pixelsPerMeter = spot.penumbraSize / lightRenderData.shadowCamera.renderTarget.width;
            const fov = lightRenderData.shadowCamera._fov * Math.PI / 180.0;
            const fovRatio = 1.0 / Math.tan(fov / 2.0);
            this.lightShadowSearchAreaId[cnt].setValue(pixelsPerMeter * fovRatio);

            const cameraParams = spot._shadowCameraParams;
            cameraParams.length = 4;
            cameraParams[0] = lightRenderData.depthRangeCompensation;
            cameraParams[1] = lightRenderData.shadowCamera._farClip;
            cameraParams[2] = lightRenderData.shadowCamera._nearClip;
            cameraParams[3] = 0;
            this.lightCameraParamsId[cnt].setValue(cameraParams);
        }

        if (spot._cookie) {

            // if shadow is not rendered, we need to evaluate light projection matrix
            if (!spot.castShadows) {
                const cookieMatrix = LightCamera.evalSpotCookieMatrix(spot);
                this.lightShadowMatrixId[cnt].setValue(cookieMatrix.data);
            }

            this.lightCookieId[cnt].setValue(spot._cookie);
            this.lightCookieIntId[cnt].setValue(spot.cookieIntensity);
            if (spot._cookieTransform) {
                spot._cookieTransformUniform[0] = spot._cookieTransform.x;
                spot._cookieTransformUniform[1] = spot._cookieTransform.y;
                spot._cookieTransformUniform[2] = spot._cookieTransform.z;
                spot._cookieTransformUniform[3] = spot._cookieTransform.w;
                this.lightCookieMatrixId[cnt].setValue(spot._cookieTransformUniform);
                spot._cookieOffsetUniform[0] = spot._cookieOffset.x;
                spot._cookieOffsetUniform[1] = spot._cookieOffset.y;
                this.lightCookieOffsetId[cnt].setValue(spot._cookieOffsetUniform);
            }
        }
    }

    dispatchLocalLights(sortedLights, scene, mask, usedDirLights) {

        let cnt = usedDirLights;
        const scope = this.device.scope;

        const omnis = sortedLights[LIGHTTYPE_OMNI];
        const numOmnis = omnis.length;
        for (let i = 0; i < numOmnis; i++) {
            const omni = omnis[i];
            if (!(omni.mask & mask)) continue;
            this.dispatchOmniLight(scene, scope, omni, cnt);
            cnt++;
        }

        const spts = sortedLights[LIGHTTYPE_SPOT];
        const numSpts = spts.length;
        for (let i = 0; i < numSpts; i++) {
            const spot = spts[i];
            if (!(spot.mask & mask)) continue;
            this.dispatchSpotLight(scene, scope, spot, cnt);
            cnt++;
        }
    }

    // execute first pass over draw calls, in order to update materials / shaders
    renderForwardPrepareMaterials(camera, drawCalls, sortedLights, layer, pass) {

        const addCall = (drawCall, shaderInstance, isNewMaterial, lightMaskChanged) => {
            _drawCallList.drawCalls.push(drawCall);
            _drawCallList.shaderInstances.push(shaderInstance);
            _drawCallList.isNewMaterial.push(isNewMaterial);
            _drawCallList.lightMaskChanged.push(lightMaskChanged);
        };

        // start with empty arrays
        _drawCallList.clear();

        const device = this.device;
        const scene = this.scene;
        const clusteredLightingEnabled = scene.clusteredLightingEnabled;
        const lightHash = layer?.getLightHash(clusteredLightingEnabled) ?? 0;
        let prevMaterial = null, prevObjDefs, prevLightMask;

        const drawCallsCount = drawCalls.length;
        for (let i = 0; i < drawCallsCount; i++) {

            /** @type {import('../mesh-instance.js').MeshInstance} */
            const drawCall = drawCalls[i];

            // #if _PROFILER
            if (camera === ForwardRenderer.skipRenderCamera) {
                if (ForwardRenderer._skipRenderCounter >= ForwardRenderer.skipRenderAfter)
                    continue;
                ForwardRenderer._skipRenderCounter++;
            }
            if (layer) {
                if (layer._skipRenderCounter >= layer.skipRenderAfter)
                    continue;
                layer._skipRenderCounter++;
            }
            // #endif

            drawCall.ensureMaterial(device);
            const material = drawCall.material;

            const objDefs = drawCall._shaderDefs;
            const lightMask = drawCall.mask;

            if (material && material === prevMaterial && objDefs !== prevObjDefs) {
                prevMaterial = null; // force change shader if the object uses a different variant of the same material
            }

            if (material !== prevMaterial) {
                this._materialSwitches++;
                material._scene = scene;

                if (material.dirty) {
                    material.updateUniforms(device, scene);
                    material.dirty = false;
                }
            }

            // marker to allow us to see the source node for shader alloc
            DebugGraphics.pushGpuMarker(device, `Node: ${drawCall.node.name}`);

            const shaderInstance = drawCall.getShaderInstance(pass, lightHash, scene, this.viewUniformFormat, this.viewBindGroupFormat, sortedLights);

            DebugGraphics.popGpuMarker(device);

            addCall(drawCall, shaderInstance, material !== prevMaterial, !prevMaterial || lightMask !== prevLightMask);

            prevMaterial = material;
            prevObjDefs = objDefs;
            prevLightMask = lightMask;
        }

        // process the batch of shaders created here
        device.endShaderBatch?.();

        return _drawCallList;
    }

    renderForwardInternal(camera, preparedCalls, sortedLights, pass, drawCallback, flipFaces) {
        const device = this.device;
        const scene = this.scene;
        const passFlag = 1 << pass;
        const flipFactor = flipFaces ? -1 : 1;
        const clusteredLightingEnabled = this.scene.clusteredLightingEnabled;

        // Render the scene
        let skipMaterial = false;
        const preparedCallsCount = preparedCalls.drawCalls.length;
        for (let i = 0; i < preparedCallsCount; i++) {

            const drawCall = preparedCalls.drawCalls[i];

            // We have a mesh instance
            const newMaterial = preparedCalls.isNewMaterial[i];
            const lightMaskChanged = preparedCalls.lightMaskChanged[i];
            const shaderInstance = preparedCalls.shaderInstances[i];
            const material = drawCall.material;
            const objDefs = drawCall._shaderDefs;
            const lightMask = drawCall.mask;

            if (newMaterial) {

                const shader = shaderInstance.shader;
                if (!shader.failed && !device.setShader(shader)) {
                    Debug.error(`Error compiling shader [${shader.label}] for material=${material.name} pass=${pass} objDefs=${objDefs}`, material);
                }

                // skip rendering with the material if shader failed
                skipMaterial = shader.failed;
                if (skipMaterial)
                    break;

                DebugGraphics.pushGpuMarker(device, `Material: ${material.name}`);

                // Uniforms I: material
                material.setParameters(device);

                if (lightMaskChanged) {
                    const usedDirLights = this.dispatchDirectLights(sortedLights[LIGHTTYPE_DIRECTIONAL], scene, lightMask, camera);

                    if (!clusteredLightingEnabled) {
                        this.dispatchLocalLights(sortedLights, scene, lightMask, usedDirLights);
                    }
                }

                this.alphaTestId.setValue(material.alphaTest);

                device.setBlendState(material.blendState);
                device.setDepthState(material.depthState);

                device.setAlphaToCoverage(material.alphaToCoverage);

                if (material.depthBias || material.slopeDepthBias) {
                    device.setDepthBias(true);
                    device.setDepthBiasValues(material.depthBias, material.slopeDepthBias);
                } else {
                    device.setDepthBias(false);
                }

                DebugGraphics.popGpuMarker(device);
            }

            DebugGraphics.pushGpuMarker(device, `Node: ${drawCall.node.name}`);

            this.setupCullMode(camera._cullFaces, flipFactor, drawCall);

            const stencilFront = drawCall.stencilFront ?? material.stencilFront;
            const stencilBack = drawCall.stencilBack ?? material.stencilBack;
            device.setStencilState(stencilFront, stencilBack);

            const mesh = drawCall.mesh;

            // Uniforms II: meshInstance overrides
            drawCall.setParameters(device, passFlag);

            this.setVertexBuffers(device, mesh);
            this.setMorphing(device, drawCall.morphInstance);
            this.setSkinning(device, drawCall);

            this.setupMeshUniformBuffers(shaderInstance, drawCall);

            const style = drawCall.renderStyle;
            device.setIndexBuffer(mesh.indexBuffer[style]);

            drawCallback?.(drawCall, i);

            if (camera.xr && camera.xr.session && camera.xr.views.length) {
                const views = camera.xr.views;

                for (let v = 0; v < views.length; v++) {
                    const view = views[v];

                    device.setViewport(view.viewport.x, view.viewport.y, view.viewport.z, view.viewport.w);

                    this.projId.setValue(view.projMat.data);
                    this.projSkyboxId.setValue(view.projMat.data);
                    this.viewId.setValue(view.viewOffMat.data);
                    this.viewInvId.setValue(view.viewInvOffMat.data);
                    this.viewId3.setValue(view.viewMat3.data);
                    this.viewProjId.setValue(view.projViewOffMat.data);
                    this.viewPosId.setValue(view.position);

                    if (v === 0) {
                        this.drawInstance(device, drawCall, mesh, style, true);
                    } else {
                        this.drawInstance2(device, drawCall, mesh, style);
                    }

                    this._forwardDrawCalls++;
                }
            } else {
                this.drawInstance(device, drawCall, mesh, style, true);
                this._forwardDrawCalls++;
            }

            // Unset meshInstance overrides back to material values if next draw call will use the same material
            if (i < preparedCallsCount - 1 && !preparedCalls.isNewMaterial[i + 1]) {
                material.setParameters(device, drawCall.parameters);
            }

            DebugGraphics.popGpuMarker(device);
        }
    }

    renderForward(camera, allDrawCalls, sortedLights, pass, drawCallback, layer, flipFaces) {

        // #if _PROFILER
        const forwardStartTime = now();
        // #endif

        // run first pass over draw calls and handle material / shader updates
        const preparedCalls = this.renderForwardPrepareMaterials(camera, allDrawCalls, sortedLights, layer, pass);

        // render mesh instances
        this.renderForwardInternal(camera, preparedCalls, sortedLights, pass, drawCallback, flipFaces);

        _drawCallList.clear();

        // #if _PROFILER
        this._forwardTime += now() - forwardStartTime;
        // #endif
    }

    setSceneConstants() {
        const scene = this.scene;

        // Set up ambient/exposure
        this.dispatchGlobalLights(scene);

        // Set up the fog
        if (scene.fog !== FOG_NONE) {
            this.fogColor[0] = scene.fogColor.r;
            this.fogColor[1] = scene.fogColor.g;
            this.fogColor[2] = scene.fogColor.b;
            if (scene.gammaCorrection) {
                for (let i = 0; i < 3; i++) {
                    this.fogColor[i] = Math.pow(this.fogColor[i], 2.2);
                }
            }
            this.fogColorId.setValue(this.fogColor);
            if (scene.fog === FOG_LINEAR) {
                this.fogStartId.setValue(scene.fogStart);
                this.fogEndId.setValue(scene.fogEnd);
            } else {
                this.fogDensityId.setValue(scene.fogDensity);
            }
        }

        // Set up screen size // should be RT size?
        const device = this.device;
        this._screenSize[0] = device.width;
        this._screenSize[1] = device.height;
        this._screenSize[2] = 1 / device.width;
        this._screenSize[3] = 1 / device.height;
        this.screenSizeId.setValue(this._screenSize);

        this.pcssDiskSamplesId.setValue(this.pcssDiskSamples);
        this.pcssSphereSamplesId.setValue(this.pcssSphereSamples);
    }

    /**
     * Builds a frame graph for the rendering of the whole frame.
     *
     * @param {import('../frame-graph.js').FrameGraph} frameGraph - The frame-graph that is built.
     * @param {import('../composition/layer-composition.js').LayerComposition} layerComposition - The
     * layer composition used to build the frame graph.
     * @ignore
     */
    buildFrameGraph(frameGraph, layerComposition) {

        const clusteredLightingEnabled = this.scene.clusteredLightingEnabled;
        frameGraph.reset();

        this.update(layerComposition);

        // clustered lighting render passes
        if (clusteredLightingEnabled) {

            // cookies
            {
                const renderPass = new RenderPass(this.device, () => {
                    // render cookies for all local visible lights
                    if (this.scene.lighting.cookiesEnabled) {
                        this.renderCookies(this.lights);
                    }
                });
                renderPass.requiresCubemaps = false;
                DebugHelper.setName(renderPass, 'ClusteredCookies');
                frameGraph.addRenderPass(renderPass);
            }

            // local shadows - these are shared by all cameras (not entirely correctly)
            {
                const renderPass = new RenderPass(this.device);
                DebugHelper.setName(renderPass, 'ClusteredLocalShadows');
                renderPass.requiresCubemaps = false;
                frameGraph.addRenderPass(renderPass);

                // render shadows only when needed
                if (this.scene.lighting.shadowsEnabled) {
                    this._shadowRendererLocal.prepareClusteredRenderPass(renderPass, this.localLights);
                }

                // update clusters all the time
                renderPass._after = () => {
                    this.updateClusters(layerComposition);
                };
            }

        } else {

            // non-clustered local shadows - these are shared by all cameras (not entirely correctly)
            this._shadowRendererLocal.buildNonClusteredRenderPasses(frameGraph, this.localLights);
        }

        // main passes
        let startIndex = 0;
        let newStart = true;
        let renderTarget = null;
        const renderActions = layerComposition._renderActions;

        for (let i = startIndex; i < renderActions.length; i++) {

            const renderAction = renderActions[i];
            const layer = layerComposition.layerList[renderAction.layerIndex];
            const camera = layer.cameras[renderAction.cameraIndex];

            // skip disabled layers
            if (!renderAction.isLayerEnabled(layerComposition)) {
                continue;
            }

            const isDepthLayer = layer.id === LAYERID_DEPTH;
            const isGrabPass = isDepthLayer && (camera.renderSceneColorMap || camera.renderSceneDepthMap);

            // directional shadows get re-rendered for each camera
            if (renderAction.hasDirectionalShadowLights && camera) {
                this._shadowRendererDirectional.buildFrameGraph(frameGraph, renderAction.directionalLights, camera);
            }

            // start of block of render actions rendering to the same render target
            if (newStart) {
                newStart = false;
                startIndex = i;
                renderTarget = renderAction.renderTarget;
            }

            // find the next enabled render action
            let nextIndex = i + 1;
            while (renderActions[nextIndex] && !renderActions[nextIndex].isLayerEnabled(layerComposition)) {
                nextIndex++;
            }

            // info about the next render action
            const nextRenderAction = renderActions[nextIndex];
            const isNextLayerDepth = nextRenderAction ? layerComposition.layerList[nextRenderAction.layerIndex].id === LAYERID_DEPTH : false;
            const isNextLayerGrabPass = isNextLayerDepth && (camera.renderSceneColorMap || camera.renderSceneDepthMap);

            // end of the block using the same render target
            if (!nextRenderAction || nextRenderAction.renderTarget !== renderTarget ||
                nextRenderAction.hasDirectionalShadowLights || isNextLayerGrabPass || isGrabPass) {

                // render the render actions in the range
                this.addMainRenderPass(frameGraph, layerComposition, renderTarget, startIndex, i, isGrabPass);

                // postprocessing
                if (renderAction.triggerPostprocess && camera?.onPostprocessing) {
                    const renderPass = new RenderPass(this.device, () => {
                        this.renderPassPostprocessing(renderAction, layerComposition);
                    });
                    renderPass.requiresCubemaps = false;
                    DebugHelper.setName(renderPass, `Postprocess`);
                    frameGraph.addRenderPass(renderPass);
                }

                newStart = true;
            }
        }
    }

    /**
     * @param {import('../frame-graph.js').FrameGraph} frameGraph - The frame graph.
     * @param {import('../composition/layer-composition.js').LayerComposition} layerComposition - The
     * layer composition.
     */
    addMainRenderPass(frameGraph, layerComposition, renderTarget, startIndex, endIndex, isGrabPass) {

        // render the render actions in the range
        const range = { start: startIndex, end: endIndex };
        const renderPass = new RenderPass(this.device, () => {
            this.renderPassRenderActions(layerComposition, range);
        });

        const renderActions = layerComposition._renderActions;
        const startRenderAction = renderActions[startIndex];
        const endRenderAction = renderActions[endIndex];
        const startLayer = layerComposition.layerList[startRenderAction.layerIndex];
        const camera = startLayer.cameras[startRenderAction.cameraIndex];

        if (camera) {

            // callback on the camera component before rendering with this camera for the first time
            if (startRenderAction.firstCameraUse && camera.onPreRender) {
                renderPass._before = () => {
                    camera.onPreRender();
                };
            }

            // callback on the camera component when we're done rendering with this camera
            if (endRenderAction.lastCameraUse && camera.onPostRender) {
                renderPass._after = () => {
                    camera.onPostRender();
                };
            }
        }

        // depth grab pass on webgl1 is normal render pass (scene gets re-rendered)
        const grabPassRequired = isGrabPass && SceneGrab.requiresRenderPass(this.device, camera);
        const isRealPass = !isGrabPass || grabPassRequired;

        if (isRealPass) {

            renderPass.init(renderTarget);
            renderPass.fullSizeClearRect = camera.camera.fullSizeClearRect;

            if (grabPassRequired) {

                // webgl1 depth rendering clear values
                renderPass.setClearColor(webgl1DepthClearColor);
                renderPass.setClearDepth(1.0);

            } else if (renderPass.fullSizeClearRect) { // if camera rendering covers the full viewport

                if (startRenderAction.clearColor) {
                    renderPass.setClearColor(camera.camera.clearColor);
                }
                if (startRenderAction.clearDepth) {
                    renderPass.setClearDepth(camera.camera.clearDepth);
                }
                if (startRenderAction.clearStencil) {
                    renderPass.setClearStencil(camera.camera.clearStencil);
                }
            }
        }

        DebugHelper.setName(renderPass, `${isGrabPass ? 'SceneGrab' : 'RenderAction'} ${startIndex}-${endIndex} ` +
                            `Cam: ${camera ? camera.entity.name : '-'}`);
        frameGraph.addRenderPass(renderPass);
    }

    /**
     * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
     * composition.
     */
    update(comp) {

        this.frameUpdate();
        this.shadowRenderer.frameUpdate();

        const clusteredLightingEnabled = this.scene.clusteredLightingEnabled;

        // update the skybox, since this might change _meshInstances
        this.scene._updateSky(this.device);

        // update layer composition
        this.updateLayerComposition(comp, clusteredLightingEnabled);

        this.collectLights(comp);

        // Single per-frame calculations
        this.beginFrame(comp);
        this.setSceneConstants();

        // visibility culling of lights, meshInstances, shadows casters
        // after this the scene culling is done and script callbacks can be called to report which objects are visible
        this.cullComposition(comp);

        // GPU update for all visible objects
        this.gpuUpdate(this.processingMeshInstances);
    }

    renderPassPostprocessing(renderAction, layerComposition) {

        const layer = layerComposition.layerList[renderAction.layerIndex];
        const camera = layer.cameras[renderAction.cameraIndex];
        Debug.assert(renderAction.triggerPostprocess && camera.onPostprocessing);

        // trigger postprocessing for camera
        camera.onPostprocessing();
    }

    /**
     * Render pass representing the layer composition's render actions in the specified range.
     *
     * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
     * composition to render.
     * @ignore
     */
    renderPassRenderActions(comp, range) {

        const renderActions = comp._renderActions;
        for (let i = range.start; i <= range.end; i++) {
            this.renderRenderAction(comp, renderActions[i], i === range.start);
        }
    }

    /**
     * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
     * composition.
     * @param {import('../composition/render-action.js').RenderAction} renderAction - The render
     * action.
     * @param {boolean} firstRenderAction - True if this is the first render action in the render pass.
     */
    renderRenderAction(comp, renderAction, firstRenderAction) {

        const clusteredLightingEnabled = this.scene.clusteredLightingEnabled;
        const device = this.device;

        // layer
        const layerIndex = renderAction.layerIndex;
        const layer = comp.layerList[layerIndex];
        const transparent = comp.subLayerList[layerIndex];

        const cameraPass = renderAction.cameraIndex;
        const camera = layer.cameras[cameraPass];

        if (!renderAction.isLayerEnabled(comp)) {
            return;
        }

        DebugGraphics.pushGpuMarker(this.device, camera ? camera.entity.name : 'noname');
        DebugGraphics.pushGpuMarker(this.device, layer.name);

        // #if _PROFILER
        const drawTime = now();
        // #endif

        // Call prerender callback if there's one
        if (!transparent && layer.onPreRenderOpaque) {
            layer.onPreRenderOpaque(cameraPass);
        } else if (transparent && layer.onPreRenderTransparent) {
            layer.onPreRenderTransparent(cameraPass);
        }

        // Called for the first sublayer and for every camera
        if (!(layer._preRenderCalledForCameras & (1 << cameraPass))) {
            if (layer.onPreRender) {
                layer.onPreRender(cameraPass);
            }
            layer._preRenderCalledForCameras |= 1 << cameraPass;
        }

        if (camera) {

            this.setupViewport(camera.camera, renderAction.renderTarget);

            // if this is not a first render action to the render target, or if the render target was not
            // fully cleared on pass start, we need to execute clears here
            if (!firstRenderAction || !camera.camera.fullSizeClearRect) {
                this.clear(camera.camera, renderAction.clearColor, renderAction.clearDepth, renderAction.clearStencil);
            }

            // #if _PROFILER
            const sortTime = now();
            // #endif

            layer.sortVisible(camera.camera, transparent);

            // #if _PROFILER
            this._sortTime += now() - sortTime;
            // #endif

            const culledInstances = layer.getCulledInstances(camera.camera);
            const visible = transparent ? culledInstances.transparent : culledInstances.opaque;

            // add debug mesh instances to visible list
            this.scene.immediate.onPreRenderLayer(layer, visible, transparent);

            // set up layer uniforms
            if (layer.requiresLightCube) {
                this.lightCube.update(this.scene.ambientLight, layer._lights);
                this.constantLightCube.setValue(this.lightCube.colors);
            }

            // upload clustered lights uniforms
            if (clusteredLightingEnabled && renderAction.lightClusters) {
                renderAction.lightClusters.activate();

                // debug rendering of clusters
                if (!this.clustersDebugRendered && this.scene.lighting.debugLayer === layer.id) {
                    this.clustersDebugRendered = true;
                    WorldClustersDebug.render(renderAction.lightClusters, this.scene);
                }
            }

            // Set the not very clever global variable which is only useful when there's just one camera
            this.scene._activeCamera = camera.camera;

            const viewCount = this.setCameraUniforms(camera.camera, renderAction.renderTarget);
            if (device.supportsUniformBuffers) {
                this.setupViewUniformBuffers(renderAction.viewBindGroups, this.viewUniformFormat, this.viewBindGroupFormat, viewCount);
            }

            // enable flip faces if either the camera has _flipFaces enabled or the render target
            // has flipY enabled
            const flipFaces = !!(camera.camera._flipFaces ^ renderAction?.renderTarget?.flipY);

            // shader pass - use setting from camera if available, otherwise use layer setting
            const shaderPass = camera.camera.shaderPassInfo?.index ?? layer.shaderPass;

            const draws = this._forwardDrawCalls;
            this.renderForward(camera.camera,
                               visible,
                               layer.splitLights,
                               shaderPass,
                               layer.onDrawCall,
                               layer,
                               flipFaces);
            layer._forwardDrawCalls += this._forwardDrawCalls - draws;

            // Revert temp frame stuff
            // TODO: this should not be here, as each rendering / clearing should explicitly set up what
            // it requires (the properties are part of render pipeline on WebGPU anyways)
            device.setBlendState(BlendState.NOBLEND);
            device.setStencilState(null, null);
            device.setAlphaToCoverage(false); // don't leak a2c state
            device.setDepthBias(false);
        }

        // Call layer's postrender callback if there's one
        if (!transparent && layer.onPostRenderOpaque) {
            layer.onPostRenderOpaque(cameraPass);
        } else if (transparent && layer.onPostRenderTransparent) {
            layer.onPostRenderTransparent(cameraPass);
        }
        if (layer.onPostRender && !(layer._postRenderCalledForCameras & (1 << cameraPass))) {
            layer._postRenderCounter &= ~(transparent ? 2 : 1);
            if (layer._postRenderCounter === 0) {
                layer.onPostRender(cameraPass);
                layer._postRenderCalledForCameras |= 1 << cameraPass;
                layer._postRenderCounter = layer._postRenderCounterMax;
            }
        }

        DebugGraphics.popGpuMarker(this.device);
        DebugGraphics.popGpuMarker(this.device);

        // #if _PROFILER
        layer._renderTime += now() - drawTime;
        // #endif
    }
}

export { ForwardRenderer };
