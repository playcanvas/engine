import { now } from '../../core/time.js';
import { Debug, DebugHelper } from '../../core/debug.js';

import { Vec3 } from '../../core/math/vec3.js';
import { Color } from '../../core/math/color.js';

import {
    FUNC_ALWAYS,
    STENCILOP_KEEP
} from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';

import {
    COMPUPDATED_INSTANCES, COMPUPDATED_LIGHTS,
    FOG_NONE, FOG_LINEAR,
    LIGHTTYPE_OMNI, LIGHTTYPE_SPOT, LIGHTTYPE_DIRECTIONAL,
    LIGHTSHAPE_PUNCTUAL,
    MASK_AFFECT_LIGHTMAPPED, MASK_AFFECT_DYNAMIC, MASK_BAKE,
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
    isNewMaterial: [],
    lightMaskChanged: []
};

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

        // shadow cascades
        this.shadowMatrixPaletteId = [];
        this.shadowCascadeDistancesId = [];
        this.shadowCascadeCountId = [];

        this.screenSizeId = scope.resolve('uScreenSize');
        this._screenSize = new Float32Array(4);

        this.fogColor = new Float32Array(3);
        this.ambientColor = new Float32Array(3);
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

                const params = directional._shadowRenderParams;
                params.length = 3;
                params[0] = directional._shadowResolution;  // Note: this needs to change for non-square shadow maps (2 cascades). Currently square is used
                params[1] = biases.normalBias;
                params[2] = biases.bias;
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

    dispatchLocalLights(sortedLights, scene, mask, usedDirLights, staticLightList) {

        let cnt = usedDirLights;
        const scope = this.device.scope;

        const omnis = sortedLights[LIGHTTYPE_OMNI];
        const numOmnis = omnis.length;
        for (let i = 0; i < numOmnis; i++) {
            const omni = omnis[i];
            if (!(omni.mask & mask)) continue;
            if (omni.isStatic) continue;
            this.dispatchOmniLight(scene, scope, omni, cnt);
            cnt++;
        }

        let staticId = 0;
        if (staticLightList) {
            let omni = staticLightList[staticId];
            while (omni && omni._type === LIGHTTYPE_OMNI) {
                this.dispatchOmniLight(scene, scope, omni, cnt);
                cnt++;
                staticId++;
                omni = staticLightList[staticId];
            }
        }

        const spts = sortedLights[LIGHTTYPE_SPOT];
        const numSpts = spts.length;
        for (let i = 0; i < numSpts; i++) {
            const spot = spts[i];
            if (!(spot.mask & mask)) continue;
            if (spot.isStatic) continue;
            this.dispatchSpotLight(scene, scope, spot, cnt);
            cnt++;
        }

        if (staticLightList) {
            let spot = staticLightList[staticId];
            while (spot && spot._type === LIGHTTYPE_SPOT) {
                this.dispatchSpotLight(scene, scope, spot, cnt);
                cnt++;
                staticId++;
                spot = staticLightList[staticId];
            }
        }
    }

    // execute first pass over draw calls, in order to update materials / shaders
    // TODO: implement this: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#compile_shaders_and_link_programs_in_parallel
    // where instead of compiling and linking shaders, which is serial operation, we compile all of them and then link them, allowing the work to
    // take place in parallel
    renderForwardPrepareMaterials(camera, drawCalls, drawCallsCount, sortedLights, cullingMask, layer, pass) {

        const addCall = (drawCall, isNewMaterial, lightMaskChanged) => {
            _drawCallList.drawCalls.push(drawCall);
            _drawCallList.isNewMaterial.push(isNewMaterial);
            _drawCallList.lightMaskChanged.push(lightMaskChanged);
        };

        // start with empty arrays
        _drawCallList.drawCalls.length = 0;
        _drawCallList.isNewMaterial.length = 0;
        _drawCallList.lightMaskChanged.length = 0;

        const device = this.device;
        const scene = this.scene;
        const lightHash = layer ? layer._lightHash : 0;
        let prevMaterial = null, prevObjDefs, prevStatic, prevLightMask;

        for (let i = 0; i < drawCallsCount; i++) {

            /** @type {import('../mesh-instance.js').MeshInstance} */
            const drawCall = drawCalls[i];

            // apply visibility override
            if (cullingMask && drawCall.mask && !(cullingMask & drawCall.mask))
                continue;

            if (drawCall.command) {

                addCall(drawCall, false, false);

            } else {

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

                if (drawCall.isStatic || prevStatic) {
                    prevMaterial = null;
                }

                if (material !== prevMaterial) {
                    this._materialSwitches++;
                    material._scene = scene;

                    if (material.dirty) {
                        material.updateUniforms(device, scene);
                        material.dirty = false;
                    }

                    // if material has dirtyBlend set, notify scene here
                    if (material._dirtyBlend) {
                        scene.layers._dirtyBlend = true;
                    }
                }

                if (!drawCall._shader[pass] || drawCall._shaderDefs !== objDefs || drawCall._lightHash !== lightHash) {

                    // marker to allow us to see the source node for shader alloc
                    DebugGraphics.pushGpuMarker(device, `Node: ${drawCall.node.name}`);

                    // draw calls not using static lights use variants cache on material to quickly find the shader, as they are all
                    // the same for the same pass, using all lights of the scene
                    if (!drawCall.isStatic) {
                        const variantKey = pass + '_' + objDefs + '_' + lightHash;
                        drawCall._shader[pass] = material.variants[variantKey];
                        if (!drawCall._shader[pass]) {
                            drawCall.updatePassShader(scene, pass, null, sortedLights, this.viewUniformFormat, this.viewBindGroupFormat);
                            material.variants[variantKey] = drawCall._shader[pass];
                        }
                    } else {

                        // static lights generate unique shader per draw call, as static lights are unique per draw call,
                        // and so variants cache is not used
                        drawCall.updatePassShader(scene, pass, drawCall._staticLightList, sortedLights, this.viewUniformFormat, this.viewBindGroupFormat);
                    }
                    drawCall._lightHash = lightHash;

                    DebugGraphics.popGpuMarker(device);
                }

                Debug.assert(drawCall._shader[pass], "no shader for pass", material);

                addCall(drawCall, material !== prevMaterial, !prevMaterial || lightMask !== prevLightMask);

                prevMaterial = material;
                prevObjDefs = objDefs;
                prevLightMask = lightMask;
                prevStatic = drawCall.isStatic;
            }
        }

        // process the batch of shaders created here
        device.endShaderBatch?.();

        return _drawCallList;
    }

    renderForwardInternal(camera, preparedCalls, sortedLights, pass, drawCallback, flipFaces) {
        const device = this.device;
        const scene = this.scene;
        const passFlag = 1 << pass;

        // Render the scene
        let skipMaterial = false;
        const preparedCallsCount = preparedCalls.drawCalls.length;
        for (let i = 0; i < preparedCallsCount; i++) {

            const drawCall = preparedCalls.drawCalls[i];

            if (drawCall.command) {

                // We have a command
                drawCall.command();

            } else {

                // We have a mesh instance
                const newMaterial = preparedCalls.isNewMaterial[i];
                const lightMaskChanged = preparedCalls.lightMaskChanged[i];
                const material = drawCall.material;
                const objDefs = drawCall._shaderDefs;
                const lightMask = drawCall.mask;

                if (newMaterial) {

                    const shader = drawCall._shader[pass];
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
                        this.dispatchLocalLights(sortedLights, scene, lightMask, usedDirLights, drawCall._staticLightList);
                    }

                    this.alphaTestId.setValue(material.alphaTest);

                    device.setBlendState(material.blendState);
                    device.setDepthWrite(material.depthWrite);

                    // this fixes the case where the user wishes to turn off depth testing but wants to write depth
                    if (material.depthWrite && !material.depthTest) {
                        device.setDepthFunc(FUNC_ALWAYS);
                        device.setDepthTest(true);
                    } else {
                        device.setDepthFunc(material.depthFunc);
                        device.setDepthTest(material.depthTest);
                    }

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

                this.setCullMode(camera._cullFaces, flipFaces, drawCall);

                const stencilFront = drawCall.stencilFront || material.stencilFront;
                const stencilBack = drawCall.stencilBack || material.stencilBack;

                if (stencilFront || stencilBack) {
                    device.setStencilTest(true);
                    if (stencilFront === stencilBack) {
                        // identical front/back stencil
                        device.setStencilFunc(stencilFront.func, stencilFront.ref, stencilFront.readMask);
                        device.setStencilOperation(stencilFront.fail, stencilFront.zfail, stencilFront.zpass, stencilFront.writeMask);
                    } else {
                        // separate
                        if (stencilFront) {
                            // set front
                            device.setStencilFuncFront(stencilFront.func, stencilFront.ref, stencilFront.readMask);
                            device.setStencilOperationFront(stencilFront.fail, stencilFront.zfail, stencilFront.zpass, stencilFront.writeMask);
                        } else {
                            // default front
                            device.setStencilFuncFront(FUNC_ALWAYS, 0, 0xFF);
                            device.setStencilOperationFront(STENCILOP_KEEP, STENCILOP_KEEP, STENCILOP_KEEP, 0xFF);
                        }
                        if (stencilBack) {
                            // set back
                            device.setStencilFuncBack(stencilBack.func, stencilBack.ref, stencilBack.readMask);
                            device.setStencilOperationBack(stencilBack.fail, stencilBack.zfail, stencilBack.zpass, stencilBack.writeMask);
                        } else {
                            // default back
                            device.setStencilFuncBack(FUNC_ALWAYS, 0, 0xFF);
                            device.setStencilOperationBack(STENCILOP_KEEP, STENCILOP_KEEP, STENCILOP_KEEP, 0xFF);
                        }
                    }
                } else {
                    device.setStencilTest(false);
                }

                const mesh = drawCall.mesh;

                // Uniforms II: meshInstance overrides
                drawCall.setParameters(device, passFlag);

                this.setVertexBuffers(device, mesh);
                this.setMorphing(device, drawCall.morphInstance);
                this.setSkinning(device, drawCall);

                this.setupMeshUniformBuffers(drawCall, pass);

                const style = drawCall.renderStyle;
                device.setIndexBuffer(mesh.indexBuffer[style]);

                if (drawCallback) {
                    drawCallback(drawCall, i);
                }

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
    }

    renderForward(camera, allDrawCalls, allDrawCallsCount, sortedLights, pass, cullingMask, drawCallback, layer, flipFaces) {

        // #if _PROFILER
        const forwardStartTime = now();
        // #endif

        // run first pass over draw calls and handle material / shader updates
        const preparedCalls = this.renderForwardPrepareMaterials(camera, allDrawCalls, allDrawCallsCount, sortedLights, cullingMask, layer, pass);

        // render mesh instances
        this.renderForwardInternal(camera, preparedCalls, sortedLights, pass, drawCallback, flipFaces);

        _drawCallList.length = 0;

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
    }

    /**
     * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
     * composition.
     * @param {number} compUpdatedFlags - Flags of what was updated.
     */
    updateLightStats(comp, compUpdatedFlags) {

        // #if _PROFILER
        const scene = this.scene;
        if (compUpdatedFlags & COMPUPDATED_LIGHTS || !scene._statsUpdated) {
            const stats = scene._stats;
            stats.lights = comp._lights.length;
            stats.dynamicLights = 0;
            stats.bakedLights = 0;

            for (let i = 0; i < stats.lights; i++) {
                const l = comp._lights[i];
                if (l.enabled) {
                    if ((l.mask & MASK_AFFECT_DYNAMIC) || (l.mask & MASK_AFFECT_LIGHTMAPPED)) { // if affects dynamic or baked objects in real-time
                        stats.dynamicLights++;
                    }
                    if (l.mask & MASK_BAKE) { // if baked into lightmaps
                        stats.bakedLights++;
                    }
                }
            }
        }

        if (compUpdatedFlags & COMPUPDATED_INSTANCES || !scene._statsUpdated) {
            scene._stats.meshInstances = comp._meshInstances.length;
        }

        scene._statsUpdated = true;
        // #endif
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
                        this.renderCookies(layerComposition._splitLights[LIGHTTYPE_SPOT]);
                        this.renderCookies(layerComposition._splitLights[LIGHTTYPE_OMNI]);
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
                    const splitLights = layerComposition._splitLights;
                    this._shadowRendererLocal.prepareClusteredRenderPass(renderPass, splitLights[LIGHTTYPE_SPOT], splitLights[LIGHTTYPE_OMNI]);
                }

                // update clusters all the time
                renderPass.after = () => {
                    this.updateClusters(layerComposition);
                };
            }

        } else {

            // non-clustered local shadows - these are shared by all cameras (not entirely correctly)
            const splitLights = layerComposition._splitLights;
            this._shadowRendererLocal.buildNonClusteredRenderPasses(frameGraph, splitLights[LIGHTTYPE_SPOT], splitLights[LIGHTTYPE_OMNI]);
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
                this._shadowRendererDirectional.buildFrameGraph(frameGraph, renderAction, camera);
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
                renderPass.before = () => {
                    camera.onPreRender();
                };
            }

            // callback on the camera component when we're done rendering with this camera
            if (endRenderAction.lastCameraUse && camera.onPostRender) {
                renderPass.after = () => {
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

        // update layer composition if something has been invalidated
        const updated = this.updateLayerComposition(comp, clusteredLightingEnabled);
        const lightsChanged = (updated & COMPUPDATED_LIGHTS) !== 0;

        this.updateLightStats(comp, updated);

        // Single per-frame calculations
        this.beginFrame(comp, lightsChanged);
        this.setSceneConstants();

        // visibility culling of lights, meshInstances, shadows casters
        // after this the scene culling is done and script callbacks can be called to report which objects are visible
        this.cullComposition(comp);

        // GPU update for all visible objects
        this.gpuUpdate(comp._meshInstances);
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

            layer._sortVisible(transparent, camera.camera.node, cameraPass);

            // #if _PROFILER
            this._sortTime += now() - sortTime;
            // #endif

            const objects = layer.instances;
            const visible = transparent ? objects.visibleTransparent[cameraPass] : objects.visibleOpaque[cameraPass];

            // add debug mesh instances to visible list
            this.scene.immediate.onPreRenderLayer(layer, visible, transparent);

            // upload clustered lights uniforms
            if (clusteredLightingEnabled && renderAction.lightClusters) {
                renderAction.lightClusters.activate(this.lightTextureAtlas);

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

            const draws = this._forwardDrawCalls;
            this.renderForward(camera.camera,
                               visible.list,
                               visible.length,
                               layer._splitLights,
                               layer.shaderPass,
                               layer.cullingMask,
                               layer.onDrawCall,
                               layer,
                               flipFaces);
            layer._forwardDrawCalls += this._forwardDrawCalls - draws;

            // Revert temp frame stuff
            // TODO: this should not be here, as each rendering / clearing should explicitly set up what
            // it requires (the properties are part of render pipeline on WebGPU anyways)
            device.setBlendState(BlendState.DEFAULT);
            device.setStencilTest(false); // don't leak stencil state
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
