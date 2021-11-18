import { now } from '../../core/time.js';

import { Mat3 } from '../../math/mat3.js';
import { Mat4 } from '../../math/mat4.js';
import { Vec3 } from '../../math/vec3.js';

import { BoundingSphere } from '../../shape/bounding-sphere.js';

import {
    BUFFER_DYNAMIC,
    CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL,
    CULLFACE_BACK, CULLFACE_FRONT, CULLFACE_FRONTANDBACK, CULLFACE_NONE,
    FUNC_ALWAYS, FUNC_LESSEQUAL,
    SEMANTIC_ATTR,
    STENCILOP_KEEP
} from '../../graphics/constants.js';
import { VertexBuffer } from '../../graphics/vertex-buffer.js';
import { VertexFormat } from '../../graphics/vertex-format.js';

import {
    COMPUPDATED_INSTANCES, COMPUPDATED_LIGHTS,
    FOG_NONE, FOG_LINEAR,
    LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT,
    LIGHTSHAPE_PUNCTUAL,
    MASK_BAKED, MASK_DYNAMIC, MASK_LIGHTMAP,
    SHADOWUPDATE_NONE,
    SORTKEY_DEPTH, SORTKEY_FORWARD,
    VIEW_CENTER, VIEW_LEFT, VIEW_RIGHT
} from '../constants.js';
import { Material } from '../materials/material.js';
import { LayerComposition } from '../composition/layer-composition.js';
import { LightTextureAtlas } from '../lighting/light-texture-atlas.js';
import { DefaultMaterial } from '../materials/default-material.js';

import { ShadowRenderer } from './shadow-renderer.js';
import { StaticMeshes } from './static-meshes.js';
import { CookieRenderer } from './cookie-renderer.js';
import { LightCamera } from './light-camera.js';

const viewInvMat = new Mat4();
const viewMat = new Mat4();
const viewMat3 = new Mat3();
const viewProjMat = new Mat4();
let projMat;

const flipYMat = new Mat4().setScale(1, -1, 1);
const flippedViewProjMat = new Mat4();
const flippedSkyboxProjMat = new Mat4();

const viewInvL = new Mat4();
const viewInvR = new Mat4();
const viewL = new Mat4();
const viewR = new Mat4();
const viewPosL = new Vec3();
const viewPosR = new Vec3();
let projL, projR;
const viewMat3L = new Mat3();
const viewMat3R = new Mat3();
const viewProjMatL = new Mat4();
const viewProjMatR = new Mat4();

const worldMatX = new Vec3();
const worldMatY = new Vec3();
const worldMatZ = new Vec3();

const tempSphere = new BoundingSphere();
const boneTextureSize = [0, 0, 0, 0];
let boneTexture, instancingData, modelMatrix, normalMatrix;

let keyA, keyB;

let _autoInstanceBuffer = null;

let _skinUpdateIndex = 0;

const _drawCallList = {
    drawCalls: [],
    isNewMaterial: [],
    lightMaskChanged: []
};

const _tempMaterialSet = new Set();

/**
 * @class
 * @name ForwardRenderer
 * @classdesc The forward renderer render scene objects.
 * @hideconstructor
 * @description Creates a new forward renderer object.
 * @hideconstructor
 * @param {GraphicsDevice} graphicsDevice - The graphics device used by the renderer.
 * @param {Scene} A - scene for the rendering.
 */
class ForwardRenderer {
    constructor(graphicsDevice) {
        this.device = graphicsDevice;
        this.scene = null;

        this._shadowDrawCalls = 0;
        this._forwardDrawCalls = 0;
        this._skinDrawCalls = 0;
        this._numDrawCallsCulled = 0;
        this._instancedDrawCalls = 0;
        this._camerasRendered = 0;
        this._materialSwitches = 0;
        this._shadowMapUpdates = 0;
        this._shadowMapTime = 0;
        this._depthMapTime = 0;
        this._forwardTime = 0;
        this._cullTime = 0;
        this._sortTime = 0;
        this._skinTime = 0;
        this._morphTime = 0;
        this._instancingTime = 0;
        this._removedByInstancing = 0;
        this._layerCompositionUpdateTime = 0;
        this._lightClustersTime = 0;
        this._lightClusters = 0;

        // Shaders
        const device = this.device;
        const library = device.getProgramLibrary();
        this.library = library;

        // texture atlas managing shadow map / cookie texture atlassing for omni and spot lights
        this.lightTextureAtlas = new LightTextureAtlas(device);

        // shadows
        this._shadowRenderer = new ShadowRenderer(this, this.lightTextureAtlas);

        // cookies
        this._cookieRenderer = new CookieRenderer(device, this.lightTextureAtlas);

        // Uniforms
        const scope = device.scope;
        this.projId = scope.resolve('matrix_projection');
        this.projSkyboxId = scope.resolve('matrix_projectionSkybox');
        this.viewId = scope.resolve('matrix_view');
        this.viewId3 = scope.resolve('matrix_view3');
        this.viewInvId = scope.resolve('matrix_viewInverse');
        this.viewProjId = scope.resolve('matrix_viewProjection');
        this.viewPos = new Float32Array(3);
        this.viewPosId = scope.resolve('view_position');
        this.nearClipId = scope.resolve('camera_near');
        this.farClipId = scope.resolve('camera_far');
        this.cameraParamsId = scope.resolve('camera_params');
        this.tbnBasis = scope.resolve('tbnBasis');

        this.fogColorId = scope.resolve('fog_color');
        this.fogStartId = scope.resolve('fog_start');
        this.fogEndId = scope.resolve('fog_end');
        this.fogDensityId = scope.resolve('fog_density');

        this.modelMatrixId = scope.resolve('matrix_model');
        this.normalMatrixId = scope.resolve('matrix_normal');
        this.poseMatrixId = scope.resolve('matrix_pose[0]');
        this.boneTextureId = scope.resolve('texture_poseMap');
        this.boneTextureSizeId = scope.resolve('texture_poseMapSize');

        this.morphWeightsA = scope.resolve('morph_weights_a');
        this.morphWeightsB = scope.resolve('morph_weights_b');
        this.morphPositionTex = scope.resolve('morphPositionTex');
        this.morphNormalTex = scope.resolve('morphNormalTex');
        this.morphTexParams = scope.resolve('morph_tex_params');

        this.alphaTestId = scope.resolve('alpha_ref');
        this.opacityMapId = scope.resolve('texture_opacityMap');

        this.ambientId = scope.resolve("light_globalAmbient");
        this.exposureId = scope.resolve("exposure");
        this.skyboxIntensityId = scope.resolve("skyboxIntensity");
        this.lightColorId = [];
        this.lightDir = [];
        this.lightDirId = [];
        this.lightShadowMapId = [];
        this.lightShadowMatrixId = [];
        this.lightShadowParamsId = [];
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

        this.depthMapId = scope.resolve('uDepthMap');
        this.screenSizeId = scope.resolve('uScreenSize');
        this._screenSize = new Float32Array(4);

        this.twoSidedLightingNegScaleFactorId = scope.resolve("twoSidedLightingNegScaleFactor");

        this.fogColor = new Float32Array(3);
        this.ambientColor = new Float32Array(3);

        this.cameraParams = new Float32Array(4);
    }

    destroy() {
        this._shadowRenderer.destroy();
        this._shadowRenderer = null;

        this._cookieRenderer.destroy();
        this._cookieRenderer = null;

        this.lightTextureAtlas.destroy();
        this.lightTextureAtlas = null;
    }

    // #if _PROFILER
    // Static properties used by the Profiler in the Editor's Launch Page
    static skipRenderCamera = null;

    static _skipRenderCounter = 0;

    static skipRenderAfter = 0;
    // #endif

    sortCompare(drawCallA, drawCallB) {
        if (drawCallA.layer === drawCallB.layer) {
            if (drawCallA.drawOrder && drawCallB.drawOrder) {
                return drawCallA.drawOrder - drawCallB.drawOrder;
            } else if (drawCallA.zdist && drawCallB.zdist) {
                return drawCallB.zdist - drawCallA.zdist; // back to front
            } else if (drawCallA.zdist2 && drawCallB.zdist2) {
                return drawCallA.zdist2 - drawCallB.zdist2; // front to back
            }
        }

        return drawCallB._key[SORTKEY_FORWARD] - drawCallA._key[SORTKEY_FORWARD];
    }

    sortCompareMesh(drawCallA, drawCallB) {
        if (drawCallA.layer === drawCallB.layer) {
            if (drawCallA.drawOrder && drawCallB.drawOrder) {
                return drawCallA.drawOrder - drawCallB.drawOrder;
            } else if (drawCallA.zdist && drawCallB.zdist) {
                return drawCallB.zdist - drawCallA.zdist; // back to front
            }
        }

        keyA = drawCallA._key[SORTKEY_FORWARD];
        keyB = drawCallB._key[SORTKEY_FORWARD];

        if (keyA === keyB && drawCallA.mesh && drawCallB.mesh) {
            return drawCallB.mesh.id - drawCallA.mesh.id;
        }

        return keyB - keyA;
    }

    depthSortCompare(drawCallA, drawCallB) {
        keyA = drawCallA._key[SORTKEY_DEPTH];
        keyB = drawCallB._key[SORTKEY_DEPTH];

        if (keyA === keyB && drawCallA.mesh && drawCallB.mesh) {
            return drawCallB.mesh.id - drawCallA.mesh.id;
        }

        return keyB - keyA;
    }

    updateCameraFrustum(camera) {
        if (camera.vrDisplay && camera.vrDisplay.presenting) {
            projMat = camera.vrDisplay.combinedProj;
            const parent = camera._node.parent;
            if (parent) {
                viewMat.copy(parent.getWorldTransform()).mul(camera.vrDisplay.combinedViewInv).invert();
            } else {
                viewMat.copy(camera.vrDisplay.combinedView);
            }
            viewInvMat.copy(viewMat).invert();
            this.viewInvId.setValue(viewInvMat.data);
            viewProjMat.mul2(projMat, viewMat);
            camera.frustum.setFromMat4(viewProjMat);
        } else if (camera.xr && camera.xr.views.length) {
            // calculate frustum based on XR view
            const view = camera.xr.views[0];
            viewProjMat.mul2(view.projMat, view.viewOffMat);
            camera.frustum.setFromMat4(viewProjMat);
            return;
        }

        projMat = camera.projectionMatrix;
        if (camera.calculateProjection) {
            camera.calculateProjection(projMat, VIEW_CENTER);
        }

        if (camera.calculateTransform) {
            camera.calculateTransform(viewInvMat, VIEW_CENTER);
        } else {
            const pos = camera._node.getPosition();
            const rot = camera._node.getRotation();
            viewInvMat.setTRS(pos, rot, Vec3.ONE);
            this.viewInvId.setValue(viewInvMat.data);
        }
        viewMat.copy(viewInvMat).invert();

        viewProjMat.mul2(projMat, viewMat);
        camera.frustum.setFromMat4(viewProjMat);
    }

    // make sure colorWrite is set to true to all channels, if you want to fully clear the target
    setCamera(camera, target, clear) {
        const vrDisplay = camera.vrDisplay;
        let transform;

        if (vrDisplay && vrDisplay.presenting) {
            // Projection LR
            projL = vrDisplay.leftProj;
            projR = vrDisplay.rightProj;
            projMat = vrDisplay.combinedProj;
            if (camera.calculateProjection) {
                camera.calculateProjection(projL, VIEW_LEFT);
                camera.calculateProjection(projR, VIEW_RIGHT);
                camera.calculateProjection(projMat, VIEW_CENTER);
            }

            if (camera.calculateTransform) {
                camera.calculateTransform(viewInvL, VIEW_LEFT);
                camera.calculateTransform(viewInvR, VIEW_RIGHT);
                camera.calculateTransform(viewInvMat, VIEW_CENTER);
                viewL.copy(viewInvL).invert();
                viewR.copy(viewInvR).invert();
                viewMat.copy(viewInvMat).invert();
            } else {
                const parent = camera._node.parent;
                if (parent) {
                    transform = parent.getWorldTransform();

                    // ViewInverse LR (parent)
                    viewInvL.mul2(transform, vrDisplay.leftViewInv);
                    viewInvR.mul2(transform, vrDisplay.rightViewInv);

                    // View LR (parent)
                    viewL.copy(viewInvL).invert();
                    viewR.copy(viewInvR).invert();

                    // Combined view (parent)
                    viewMat.copy(parent.getWorldTransform()).mul(vrDisplay.combinedViewInv).invert();
                } else {
                    // ViewInverse LR
                    viewInvL.copy(vrDisplay.leftViewInv);
                    viewInvR.copy(vrDisplay.rightViewInv);

                    // View LR
                    viewL.copy(vrDisplay.leftView);
                    viewR.copy(vrDisplay.rightView);

                    // Combined view
                    viewMat.copy(vrDisplay.combinedView);
                }
            }

            // View 3x3 LR
            viewMat3L.setFromMat4(viewL);
            viewMat3R.setFromMat4(viewR);

            // ViewProjection LR
            viewProjMatL.mul2(projL, viewL);
            viewProjMatR.mul2(projR, viewR);

            // View Position LR
            viewPosL.x = viewInvL.data[12];
            viewPosL.y = viewInvL.data[13];
            viewPosL.z = viewInvL.data[14];

            viewPosR.x = viewInvR.data[12];
            viewPosR.y = viewInvR.data[13];
            viewPosR.z = viewInvR.data[14];

            viewProjMat.mul2(projMat, viewMat);
            camera.frustum.setFromMat4(viewProjMat);
        } else if (camera.xr && camera.xr.session) {
            const parent = camera._node.parent;
            if (parent) transform = parent.getWorldTransform();

            const views = camera.xr.views;
            for (let v = 0; v < views.length; v++) {
                const view = views[v];

                if (parent) {
                    view.viewInvOffMat.mul2(transform, view.viewInvMat);
                    view.viewOffMat.copy(view.viewInvOffMat).invert();
                } else {
                    view.viewInvOffMat.copy(view.viewInvMat);
                    view.viewOffMat.copy(view.viewMat);
                }

                view.viewMat3.setFromMat4(view.viewOffMat);
                view.projViewOffMat.mul2(view.projMat, view.viewOffMat);

                view.position[0] = view.viewInvOffMat.data[12];
                view.position[1] = view.viewInvOffMat.data[13];
                view.position[2] = view.viewInvOffMat.data[14];

                camera.frustum.setFromMat4(view.projViewOffMat);
            }
        } else {
            // Projection Matrix
            projMat = camera.projectionMatrix;
            if (camera.calculateProjection) {
                camera.calculateProjection(projMat, VIEW_CENTER);
            }
            this.projId.setValue(projMat.data);

            // Skybox Projection Matrix
            this.projSkyboxId.setValue(camera.getProjectionMatrixSkybox().data);

            // ViewInverse Matrix
            if (camera.calculateTransform) {
                camera.calculateTransform(viewInvMat, VIEW_CENTER);
            } else {
                const pos = camera._node.getPosition();
                const rot = camera._node.getRotation();
                viewInvMat.setTRS(pos, rot, Vec3.ONE);
            }
            this.viewInvId.setValue(viewInvMat.data);

            // View Matrix
            viewMat.copy(viewInvMat).invert();
            this.viewId.setValue(viewMat.data);

            // View 3x3
            viewMat3.setFromMat4(viewMat);
            this.viewId3.setValue(viewMat3.data);

            // ViewProjection Matrix
            viewProjMat.mul2(projMat, viewMat);

            if (target && target.flipY) {
                flippedViewProjMat.mul2(flipYMat, viewProjMat);
                flippedSkyboxProjMat.mul2(flipYMat, camera.getProjectionMatrixSkybox());

                this.viewProjId.setValue(flippedViewProjMat.data);
                this.projSkyboxId.setValue(flippedSkyboxProjMat.data);
            } else {
                this.viewProjId.setValue(viewProjMat.data);
                this.projSkyboxId.setValue(camera.getProjectionMatrixSkybox().data);
            }

            // View Position (world space)
            this.dispatchViewPos(camera._node.getPosition());

            camera.frustum.setFromMat4(viewProjMat);
        }

        this.tbnBasis.setValue(target && target.flipY ? -1 : 1);

        // Near and far clip values
        this.nearClipId.setValue(camera._nearClip);
        this.farClipId.setValue(camera._farClip);

        const n = camera._nearClip;
        const f = camera._farClip;
        this.cameraParams[0] = 1 / f;
        this.cameraParams[1] = f;
        this.cameraParams[2] = (1 - f / n) * 0.5;
        this.cameraParams[3] = (1 + f / n) * 0.5;
        this.cameraParamsId.setValue(this.cameraParams);

        this.clearView(camera, target, clear, false);
    }

    clearView(camera, target, clear, forceWrite, options) {
        const device = this.device;
        device.setRenderTarget(target);
        device.updateBegin();

        if (forceWrite) {
            device.setColorWrite(true, true, true, true);
            device.setDepthWrite(true);
        }

        const pixelWidth = target ? target.width : device.width;
        const pixelHeight = target ? target.height : device.height;

        const rect = camera.rect;
        let x = Math.floor(rect.x * pixelWidth);
        let y = Math.floor(rect.y * pixelHeight);
        let w = Math.floor(rect.z * pixelWidth);
        let h = Math.floor(rect.w * pixelHeight);
        device.setViewport(x, y, w, h);

        // by default clear is using viewport rectangle. Use scissor rectangle when required.
        if (camera._scissorRectClear) {
            const scissorRect = camera.scissorRect;
            x = Math.floor(scissorRect.x * pixelWidth);
            y = Math.floor(scissorRect.y * pixelHeight);
            w = Math.floor(scissorRect.z * pixelWidth);
            h = Math.floor(scissorRect.w * pixelHeight);
        }
        device.setScissor(x, y, w, h);

        if (clear) {
            // use camera clear options if any
            if (!options)
                options = camera._clearOptions;

            device.clear(options ? options : {
                color: [camera._clearColor.r, camera._clearColor.g, camera._clearColor.b, camera._clearColor.a],
                depth: camera._clearDepth,
                flags: (camera._clearColorBuffer ? CLEARFLAG_COLOR : 0) |
                       (camera._clearDepthBuffer ? CLEARFLAG_DEPTH : 0) |
                       (camera._clearStencilBuffer ? CLEARFLAG_STENCIL : 0),
                stencil: camera._clearStencil
            });
        }
    }

    dispatchGlobalLights(scene) {
        this.ambientColor[0] = scene.ambientLight.r;
        this.ambientColor[1] = scene.ambientLight.g;
        this.ambientColor[2] = scene.ambientLight.b;
        if (scene.gammaCorrection) {
            for (let i = 0; i < 3; i++) {
                this.ambientColor[i] = Math.pow(this.ambientColor[i], 2.2);
            }
        }
        this.ambientId.setValue(this.ambientColor);
        this.exposureId.setValue(scene.exposure);
        if (scene.skyboxModel) this.skyboxIntensityId.setValue(scene.skyboxIntensity);
    }

    _resolveLight(scope, i) {
        const light = "light" + i;
        this.lightColorId[i] = scope.resolve(light + "_color");
        this.lightDir[i] = new Float32Array(3);
        this.lightDirId[i] = scope.resolve(light + "_direction");
        this.lightShadowMapId[i] = scope.resolve(light + "_shadowMap");
        this.lightShadowMatrixId[i] = scope.resolve(light + "_shadowMatrix");
        this.lightShadowParamsId[i] = scope.resolve(light + "_shadowParams");
        this.lightRadiusId[i] = scope.resolve(light + "_radius");
        this.lightPos[i] = new Float32Array(3);
        this.lightPosId[i] = scope.resolve(light + "_position");
        this.lightWidth[i] = new Float32Array(3);
        this.lightWidthId[i] = scope.resolve(light + "_halfWidth");
        this.lightHeight[i] = new Float32Array(3);
        this.lightHeightId[i] = scope.resolve(light + "_halfHeight");
        this.lightInAngleId[i] = scope.resolve(light + "_innerConeAngle");
        this.lightOutAngleId[i] = scope.resolve(light + "_outerConeAngle");
        this.lightCookieId[i] = scope.resolve(light + "_cookie");
        this.lightCookieIntId[i] = scope.resolve(light + "_cookieIntensity");
        this.lightCookieMatrixId[i] = scope.resolve(light + "_cookieMatrix");
        this.lightCookieOffsetId[i] = scope.resolve(light + "_cookieOffset");

        // shadow cascades
        this.shadowMatrixPaletteId[i] = scope.resolve(light + "_shadowMatrixPalette[0]");
        this.shadowCascadeDistancesId[i] = scope.resolve(light + "_shadowCascadeDistances[0]");
        this.shadowCascadeCountId[i] = scope.resolve(light + "_shadowCascadeCount");
    }

    setLTCDirectionallLight(wtm, cnt, dir, campos, far) {
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

            // Directionals shine down the negative Y axis
            wtm.getY(directional._direction).mulScalar(-1);
            directional._direction.normalize();
            this.lightDir[cnt][0] = directional._direction.x;
            this.lightDir[cnt][1] = directional._direction.y;
            this.lightDir[cnt][2] = directional._direction.z;
            this.lightDirId[cnt].setValue(this.lightDir[cnt]);

            if (directional.shape !== LIGHTSHAPE_PUNCTUAL) {
                // non-punctual shape - NB directional area light specular is approximated by putting the area light at the far clip
                this.setLTCDirectionallLight(wtm, cnt, directional._direction, camera._node.getPosition(), camera.farClip);
            }

            if (directional.castShadows) {

                const lightRenderData = directional.getRenderData(camera, 0);
                const biases = directional._getUniformBiasValues(lightRenderData);

                this.lightShadowMapId[cnt].setValue(lightRenderData.shadowBuffer);
                this.lightShadowMatrixId[cnt].setValue(lightRenderData.shadowMatrix.data);

                this.shadowMatrixPaletteId[cnt].setValue(directional._shadowMatrixPalette);
                this.shadowCascadeDistancesId[cnt].setValue(directional._shadowCascadeDistances);
                this.shadowCascadeCountId[cnt].setValue(directional.numCascades);

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

    cull(camera, drawCalls, visibleList) {
        // #if _PROFILER
        const cullTime = now();
        let numDrawCallsCulled = 0;
        // #endif

        let visibleLength = 0;
        const drawCallsCount = drawCalls.length;

        const cullingMask = camera.cullingMask || 0xFFFFFFFF; // if missing assume camera's default value

        if (!camera.frustumCulling) {
            for (let i = 0; i < drawCallsCount; i++) {
                // need to copy array anyway because sorting will happen and it'll break original draw call order assumption
                const drawCall = drawCalls[i];
                if (!drawCall.visible && !drawCall.command) continue;

                // if the object's mask AND the camera's cullingMask is zero then the game object will be invisible from the camera
                if (drawCall.mask && (drawCall.mask & cullingMask) === 0) continue;

                visibleList[visibleLength] = drawCall;
                visibleLength++;
                drawCall.visibleThisFrame = true;
            }
            return visibleLength;
        }

        for (let i = 0; i < drawCallsCount; i++) {
            const drawCall = drawCalls[i];
            if (!drawCall.command) {
                if (!drawCall.visible) continue; // use visible property to quickly hide/show meshInstances
                let visible = true;

                // if the object's mask AND the camera's cullingMask is zero then the game object will be invisible from the camera
                if (drawCall.mask && (drawCall.mask & cullingMask) === 0) continue;

                if (drawCall.cull) {
                    visible = drawCall._isVisible(camera);
                    // #if _PROFILER
                    numDrawCallsCulled++;
                    // #endif
                }

                if (visible) {
                    visibleList[visibleLength] = drawCall;
                    visibleLength++;
                    drawCall.visibleThisFrame = true;
                }
            } else {
                visibleList[visibleLength] = drawCall;
                visibleLength++;
                drawCall.visibleThisFrame = true;
            }
        }

        // #if _PROFILER
        this._cullTime += now() - cullTime;
        this._numDrawCallsCulled += numDrawCallsCulled;
        // #endif

        return visibleLength;
    }

    cullLights(camera, lights) {
        for (let i = 0; i < lights.length; i++) {
            const light = lights[i];

            // if enabled light is not already marked as visible
            if (!light.visibleThisFrame && light.enabled) {

                if (light._type === LIGHTTYPE_DIRECTIONAL) {
                    light.visibleThisFrame = true;
                } else {
                    light.getBoundingSphere(tempSphere);
                    if (camera.frustum.containsSphere(tempSphere)) {
                        light.visibleThisFrame = true;
                    } else {
                        // if shadow casting light does not have shadow map allocated, mark it visible to allocate shadow map
                        // Note: This won't be needed when clustered shadows are used, but at the moment even culled out lights
                        // are used for rendering, and need shadow map to be allocated
                        // TODO: delete this code when clusteredLightingEnabled is being removed and is on by default.
                        if (light.castShadows && !light.shadowMap) {
                            light.visibleThisFrame = true;
                        }
                    }
                }
            }
        }
    }

    updateCpuSkinMatrices(drawCalls) {

        _skinUpdateIndex++;

        const drawCallsCount = drawCalls.length;
        if (drawCallsCount === 0) return;

        // #if _PROFILER
        const skinTime = now();
        // #endif

        for (let i = 0; i < drawCallsCount; i++) {
            const si = drawCalls[i].skinInstance;
            if (si) {
                si.updateMatrices(drawCalls[i].node, _skinUpdateIndex);
                si._dirty = true;
            }
        }

        // #if _PROFILER
        this._skinTime += now() - skinTime;
        // #endif
    }

    updateGpuSkinMatrices(drawCalls) {
        // #if _PROFILER
        const skinTime = now();
        // #endif

        const drawCallsCount = drawCalls.length;
        for (let i = 0; i < drawCallsCount; i++) {
            if (!drawCalls[i].visibleThisFrame) continue;
            const skin = drawCalls[i].skinInstance;
            if (skin) {
                if (skin._dirty) {
                    skin.updateMatrixPalette(drawCalls[i].node, _skinUpdateIndex);
                    skin._dirty = false;
                }
            }
        }

        // #if _PROFILER
        this._skinTime += now() - skinTime;
        // #endif
    }

    updateMorphing(drawCalls) {
        // #if _PROFILER
        const morphTime = now();
        // #endif

        const drawCallsCount = drawCalls.length;
        for (let i = 0; i < drawCallsCount; i++) {
            const morphInst = drawCalls[i].morphInstance;
            if (morphInst && morphInst._dirty && drawCalls[i].visibleThisFrame) {
                morphInst.update();
            }
        }
        // #if _PROFILER
        this._morphTime += now() - morphTime;
        // #endif
    }

    setBaseConstants(device, material) {
        // Cull mode
        device.setCullMode(material.cull);
        // Alpha test
        if (material.opacityMap) {
            this.opacityMapId.setValue(material.opacityMap);
            this.alphaTestId.setValue(material.alphaTest);
        }
    }

    setSkinning(device, meshInstance, material) {
        if (meshInstance.skinInstance) {
            this._skinDrawCalls++;
            if (device.supportsBoneTextures) {
                boneTexture = meshInstance.skinInstance.boneTexture;
                this.boneTextureId.setValue(boneTexture);
                boneTextureSize[0] = boneTexture.width;
                boneTextureSize[1] = boneTexture.height;
                boneTextureSize[2] = 1.0 / boneTexture.width;
                boneTextureSize[3] = 1.0 / boneTexture.height;
                this.boneTextureSizeId.setValue(boneTextureSize);
            } else {
                this.poseMatrixId.setValue(meshInstance.skinInstance.matrixPalette);
            }
        }
    }

    // returns number of extra draw calls to skip - used to skip auto instanced meshes draw calls. by default return 0 to not skip any additional draw calls
    drawInstance(device, meshInstance, mesh, style, normal) {

        // #if _DEBUG
        device.pushMarker(meshInstance.node.name);
        // #endif

        instancingData = meshInstance.instancingData;
        if (instancingData) {
            if (instancingData.count > 0) {
                this._instancedDrawCalls++;
                device.setVertexBuffer(instancingData.vertexBuffer);
                device.draw(mesh.primitive[style], instancingData.count);
                if (instancingData.vertexBuffer === _autoInstanceBuffer) {
                    this._removedByInstancing += instancingData.count;
                    meshInstance.instancingData = null;
                    return instancingData.count - 1;
                }
            }
        } else {
            modelMatrix = meshInstance.node.worldTransform;
            this.modelMatrixId.setValue(modelMatrix.data);

            if (normal) {
                normalMatrix = meshInstance.node.normalMatrix;
                if (meshInstance.node._dirtyNormal) {
                    modelMatrix.invertTo3x3(normalMatrix);
                    normalMatrix.transpose();
                    meshInstance.node._dirtyNormal = false;
                }
                this.normalMatrixId.setValue(normalMatrix.data);
            }

            device.draw(mesh.primitive[style]);
        }

        // #if _DEBUG
        device.popMarker();
        // #endif

        return 0;
    }

    // used for stereo
    drawInstance2(device, meshInstance, mesh, style) {

        // #if _DEBUG
        device.pushMarker(meshInstance.node.name);
        // #endif

        instancingData = meshInstance.instancingData;
        if (instancingData) {
            if (instancingData.count > 0) {
                this._instancedDrawCalls++;
                device.draw(mesh.primitive[style], instancingData.count, true);
                if (instancingData.vertexBuffer === _autoInstanceBuffer) {
                    this._removedByInstancing += instancingData.count;
                    meshInstance.instancingData = null;
                    return instancingData.count - 1;
                }
            }
        } else {
            // matrices are already set
            device.draw(mesh.primitive[style], undefined, true);
        }

        // #if _DEBUG
        device.popMarker();
        // #endif

        return 0;
    }

    renderShadows(lights, camera) {

        const device = this.device;
        device.grabPassAvailable = false;

        // #if _PROFILER
        const shadowMapStartTime = now();
        // #endif

        for (let i = 0; i < lights.length; i++) {
            this._shadowRenderer.render(lights[i], camera);
        }

        device.grabPassAvailable = true;

        // #if _PROFILER
        this._shadowMapTime += now() - shadowMapStartTime;
        // #endif
    }

    renderCookies(lights) {

        const cookieRenderTarget = this.lightTextureAtlas.cookieRenderTarget;
        for (let i = 0; i < lights.length; i++) {
            this._cookieRenderer.render(lights[i], cookieRenderTarget);
        }
    }

    updateShader(meshInstance, objDefs, staticLightList, pass, sortedLights) {
        meshInstance.material._scene = this.scene;

        // if material has dirtyBlend set, notify scene here
        if (meshInstance.material._dirtyBlend) {
            this.scene.layers._dirtyBlend = true;
        }

        meshInstance.material.updateShader(this.device, this.scene, objDefs, staticLightList, pass, sortedLights);
        meshInstance._shader[pass] = meshInstance.material.shader;
    }

    setCullMode(cullFaces, flip, drawCall) {
        const material = drawCall.material;
        let mode = CULLFACE_NONE;
        if (cullFaces) {
            let flipFaces = 1;

            if (material.cull > CULLFACE_NONE && material.cull < CULLFACE_FRONTANDBACK) {
                if (drawCall.flipFaces)
                    flipFaces *= -1;

                if (flip)
                    flipFaces *= -1;

                const wt = drawCall.node.worldTransform;
                wt.getX(worldMatX);
                wt.getY(worldMatY);
                wt.getZ(worldMatZ);
                worldMatX.cross(worldMatX, worldMatY);
                if (worldMatX.dot(worldMatZ) < 0) {
                    flipFaces *= -1;
                }
            }

            if (flipFaces < 0) {
                mode = material.cull === CULLFACE_FRONT ? CULLFACE_BACK : CULLFACE_FRONT;
            } else {
                mode = material.cull;
            }
        }
        this.device.setCullMode(mode);

        if (mode === CULLFACE_NONE && material.cull === CULLFACE_NONE) {
            const wt2 = drawCall.node.worldTransform;
            wt2.getX(worldMatX);
            wt2.getY(worldMatY);
            wt2.getZ(worldMatZ);
            worldMatX.cross(worldMatX, worldMatY);
            if (worldMatX.dot(worldMatZ) < 0) {
                this.twoSidedLightingNegScaleFactorId.setValue(-1.0);
            } else {
                this.twoSidedLightingNegScaleFactorId.setValue(1.0);
            }
        }
    }

    setVertexBuffers(device, mesh) {

        // main vertex buffer
        device.setVertexBuffer(mesh.vertexBuffer);
    }

    setMorphing(device, morphInstance) {

        if (morphInstance) {

            if (morphInstance.morph.useTextureMorph) {

                // vertex buffer with vertex ids
                device.setVertexBuffer(morphInstance.morph.vertexBufferIds);

                // textures
                this.morphPositionTex.setValue(morphInstance.texturePositions);
                this.morphNormalTex.setValue(morphInstance.textureNormals);

                // texture params
                this.morphTexParams.setValue(morphInstance._textureParams);

            } else {    // vertex attributes based morphing

                for (let t = 0; t < morphInstance._activeVertexBuffers.length; t++) {

                    const vb = morphInstance._activeVertexBuffers[t];
                    if (vb) {

                        // patch semantic for the buffer to current ATTR slot (using ATTR8 - ATTR15 range)
                        const semantic = SEMANTIC_ATTR + (t + 8);
                        vb.format.elements[0].name = semantic;
                        vb.format.elements[0].scopeId = device.scope.resolve(semantic);
                        vb.format.update();

                        device.setVertexBuffer(vb);
                    }
                }

                // set all 8 weights
                this.morphWeightsA.setValue(morphInstance._shaderMorphWeightsA);
                this.morphWeightsB.setValue(morphInstance._shaderMorphWeightsB);
            }
        }
    }

    // sets Vec3 camera position uniform
    dispatchViewPos(position) {
        const vp = this.viewPos;
        vp[0] = position.x;
        vp[1] = position.y;
        vp[2] = position.z;
        this.viewPosId.setValue(vp);
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

                if (!drawCall.material)
                    drawCall.material = DefaultMaterial.get(device);

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

                    if (material.dirty) {
                        material.updateUniforms(device, scene);
                        material.dirty = false;
                    }

                    if (!drawCall._shader[pass] || drawCall._shaderDefs !== objDefs || drawCall._lightHash !== lightHash) {
                        if (!drawCall.isStatic) {
                            const variantKey = pass + "_" + objDefs + "_" + lightHash;
                            drawCall._shader[pass] = material.variants[variantKey];
                            if (!drawCall._shader[pass]) {
                                this.updateShader(drawCall, objDefs, null, pass, sortedLights);
                                material.variants[variantKey] = drawCall._shader[pass];
                            }
                        } else {
                            this.updateShader(drawCall, objDefs, drawCall._staticLightList, pass, sortedLights);
                        }
                        drawCall._shaderDefs = objDefs;
                        drawCall._lightHash = lightHash;
                    }
                }

                addCall(drawCall, material !== prevMaterial, !prevMaterial || lightMask !== prevLightMask);

                prevMaterial = material;
                prevObjDefs = objDefs;
                prevLightMask = lightMask;
                prevStatic = drawCall.isStatic;

            }
        }

        return _drawCallList;
    }

    renderForward(camera, allDrawCalls, allDrawCallsCount, sortedLights, pass, cullingMask, drawCallback, layer, flipFaces) {
        const device = this.device;
        const scene = this.scene;
        const vrDisplay = camera.vrDisplay;
        const passFlag = 1 << pass;
        const halfWidth = device.width * 0.5;

        // #if _PROFILER
        const forwardStartTime = now();
        // #endif

        // run first pass over draw calls and handle material / shader updates
        const preparedCalls = this.renderForwardPrepareMaterials(camera, allDrawCalls, allDrawCallsCount, sortedLights, cullingMask, layer, pass);

        // Render the scene
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

                    if (!drawCall._shader[pass].failed && !device.setShader(drawCall._shader[pass])) {
                        // #if _DEBUG
                        console.error(`Error in material "${material.name}" with flags ${objDefs}`);
                        // #endif
                        drawCall._shader[pass].failed = true;
                    }

                    // Uniforms I: material
                    material.setParameters(device);

                    if (lightMaskChanged) {
                        const usedDirLights = this.dispatchDirectLights(sortedLights[LIGHTTYPE_DIRECTIONAL], scene, lightMask, camera);
                        this.dispatchLocalLights(sortedLights, scene, lightMask, usedDirLights, drawCall._staticLightList);
                    }

                    this.alphaTestId.setValue(material.alphaTest);

                    device.setBlending(material.blend);
                    if (material.blend) {
                        if (material.separateAlphaBlend) {
                            device.setBlendFunctionSeparate(material.blendSrc, material.blendDst, material.blendSrcAlpha, material.blendDstAlpha);
                            device.setBlendEquationSeparate(material.blendEquation, material.blendAlphaEquation);
                        } else {
                            device.setBlendFunction(material.blendSrc, material.blendDst);
                            device.setBlendEquation(material.blendEquation);
                        }
                    }
                    device.setColorWrite(material.redWrite, material.greenWrite, material.blueWrite, material.alphaWrite);
                    device.setDepthWrite(material.depthWrite);

                    // this fixes the case where the user wishes to turn off depth testing but wants to write depth
                    if (material.depthWrite && !material.depthTest) {
                        device.setDepthFunc(FUNC_ALWAYS);
                        device.setDepthTest(true);
                    } else {
                        device.setDepthFunc(FUNC_LESSEQUAL);
                        device.setDepthTest(material.depthTest);
                    }

                    device.setAlphaToCoverage(material.alphaToCoverage);

                    if (material.depthBias || material.slopeDepthBias) {
                        device.setDepthBias(true);
                        device.setDepthBiasValues(material.depthBias, material.slopeDepthBias);
                    } else {
                        device.setDepthBias(false);
                    }
                }

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
                this.setSkinning(device, drawCall, material);

                const style = drawCall.renderStyle;
                device.setIndexBuffer(mesh.indexBuffer[style]);

                if (drawCallback) {
                    drawCallback(drawCall, i);
                }

                if (vrDisplay && vrDisplay.presenting) {
                    // Left
                    device.setViewport(0, 0, halfWidth, device.height);
                    this.projId.setValue(projL.data);
                    this.projSkyboxId.setValue(projL.data);
                    this.viewInvId.setValue(viewInvL.data);
                    this.viewId.setValue(viewL.data);
                    this.viewId3.setValue(viewMat3L.data);
                    this.viewProjId.setValue(viewProjMatL.data);
                    this.dispatchViewPos(viewPosL);

                    i += this.drawInstance(device, drawCall, mesh, style, true);
                    this._forwardDrawCalls++;

                    // Right
                    device.setViewport(halfWidth, 0, halfWidth, device.height);
                    this.projId.setValue(projR.data);
                    this.projSkyboxId.setValue(projR.data);
                    this.viewInvId.setValue(viewInvR.data);
                    this.viewId.setValue(viewR.data);
                    this.viewId3.setValue(viewMat3R.data);
                    this.viewProjId.setValue(viewProjMatR.data);
                    this.dispatchViewPos(viewPosR);

                    i += this.drawInstance2(device, drawCall, mesh, style);
                    this._forwardDrawCalls++;
                } else if (camera.xr && camera.xr.session && camera.xr.views.length) {
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
                            i += this.drawInstance(device, drawCall, mesh, style, true);
                        } else {
                            i += this.drawInstance2(device, drawCall, mesh, style);
                        }

                        this._forwardDrawCalls++;
                    }
                } else {
                    i += this.drawInstance(device, drawCall, mesh, style, true);
                    this._forwardDrawCalls++;
                }

                // Unset meshInstance overrides back to material values if next draw call will use the same material
                if (i < preparedCallsCount - 1 && !preparedCalls.isNewMaterial[i + 1]) {
                    material.setParameters(device, drawCall.parameters);
                }
            }
        }
        device.updateEnd();
        _drawCallList.length = 0;

        // #if _PROFILER
        this._forwardTime += now() - forwardStartTime;
        // #endif
    }

    setupInstancing(device) {
        if (device.enableAutoInstancing) {
            if (!_autoInstanceBuffer) {
                _autoInstanceBuffer = new VertexBuffer(device, VertexFormat.defaultInstancingFormat, device.autoInstancingMaxObjects, BUFFER_DYNAMIC);
            }
        }
    }

    updateShaders(drawCalls) {
        const count = drawCalls.length;
        for (let i = 0; i < count; i++) {
            const mat = drawCalls[i].material;
            if (mat) {
                // material not processed yet
                if (!_tempMaterialSet.has(mat)) {
                    _tempMaterialSet.add(mat);

                    if (mat.updateShader !== Material.prototype.updateShader) {
                        mat.clearVariants();
                        mat.shader = null;
                    }
                }
            }
        }

        // keep temp set empty
        _tempMaterialSet.clear();
    }

    updateLitShaders(drawCalls) {
        const count = drawCalls.length;
        for (let i = 0; i < count; i++) {
            const mat = drawCalls[i].material;
            if (mat) {
                // material not processed yet
                if (!_tempMaterialSet.has(mat)) {
                    _tempMaterialSet.add(mat);

                    if (mat.updateShader !== Material.prototype.updateShader) {

                        // only process lit materials
                        if (mat.useLighting && (!mat.emitter || mat.emitter.lighting)) {
                            mat.clearVariants();
                            mat.shader = null;
                        }
                    }
                }
            }
        }

        // keep temp set empty
        _tempMaterialSet.clear();
    }

    beginFrame(comp) {
        const scene = this.scene;
        const meshInstances = comp._meshInstances;
        const lights = comp._lights;

        // Update shaders if needed
        // all mesh instances (TODO: ideally can update less if only lighting changed)
        if (scene.updateShaders) {
            this.updateShaders(meshInstances);
            scene.updateShaders = false;
            scene.updateLitShaders = false;
            scene._shaderVersion++;
        } else if (scene.updateLitShaders) {
            this.updateLitShaders(meshInstances);
            scene.updateLitShaders = false;
            scene._shaderVersion++;
        }

        // Update all skin matrices to properly cull skinned objects (but don't update rendering data yet)
        this.updateCpuSkinMatrices(meshInstances);

        const miCount = meshInstances.length;
        for (let i = 0; i < miCount; i++) {
            meshInstances[i].visibleThisFrame = false;
        }

        // clear light visibility
        const lightCount = lights.length;
        for (let i = 0; i < lightCount; i++) {
            lights[i].visibleThisFrame = lights[i]._type === LIGHTTYPE_DIRECTIONAL;
        }
    }

    beginLayers(comp) {

        const len = comp.layerList.length;
        for (let i = 0; i < len; i++) {
            comp.layerList[i]._postRenderCounter = 0;
        }

        const scene = this.scene;
        const shaderVersion = scene._shaderVersion;
        for (let i = 0; i < len; i++) {
            const layer = comp.layerList[i];
            layer._shaderVersion = shaderVersion;
            // #if _PROFILER
            layer._skipRenderCounter = 0;
            layer._forwardDrawCalls = 0;
            layer._shadowDrawCalls = 0;
            layer._renderTime = 0;
            // #endif

            layer._preRenderCalledForCameras = 0;
            layer._postRenderCalledForCameras = 0;
            const transparent = comp.subLayerList[i];
            if (transparent) {
                layer._postRenderCounter |= 2;
            } else {
                layer._postRenderCounter |= 1;
            }
            layer._postRenderCounterMax = layer._postRenderCounter;

            // prepare layer for culling with the camera
            for (let j = 0; j < layer.cameras.length; j++) {
                layer.instances.prepare(j);
            }

            // Generate static lighting for meshes in this layer if needed
            if (layer._needsStaticPrepare && layer._staticLightHash) {
                // TODO: reuse with the same staticLightHash
                if (layer._staticPrepareDone) {
                    StaticMeshes.revert(layer.opaqueMeshInstances);
                    StaticMeshes.revert(layer.transparentMeshInstances);
                }
                StaticMeshes.prepare(this.device, scene, layer.opaqueMeshInstances, layer._lights);
                StaticMeshes.prepare(this.device, scene, layer.transparentMeshInstances, layer._lights);
                comp._dirty = true;
                scene.updateShaders = true;
                layer._needsStaticPrepare = false;
                layer._staticPrepareDone = true;
            }
        }
    }

    gpuUpdate(drawCalls) {
        // skip everything with visibleThisFrame === false
        this.updateGpuSkinMatrices(drawCalls);
        this.updateMorphing(drawCalls);
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
                    if ((l.mask & MASK_DYNAMIC) || (l.mask & MASK_BAKED)) { // if affects dynamic or baked objects in real-time
                        stats.dynamicLights++;
                    }
                    if (l.mask & MASK_LIGHTMAP) { // if baked into lightmaps
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

    // Shadow map culling for directional and visible local lights
    // visible meshInstances are collected into light._renderData, and are marked as visible
    // for directional lights also shadow camera matrix is set up
    cullShadowmaps(comp) {

        // shadow casters culling for local (point and spot) lights
        for (let i = 0; i < comp._lights.length; i++) {
            const light = comp._lights[i];
            if (light._type !== LIGHTTYPE_DIRECTIONAL) {
                if (light.visibleThisFrame && light.castShadows && light.shadowUpdateMode !== SHADOWUPDATE_NONE) {
                    const casters = comp._lightCompositionData[i].shadowCastersList;
                    this._shadowRenderer.cullLocal(light, casters);
                }
            }
        }

        // shadow casters culling for global (directional) lights
        // render actions store which directional lights are needed for each camera, so these are getting culled
        const renderActions = comp._renderActions;
        for (let i = 0; i < renderActions.length; i++) {
            const renderAction = renderActions[i];
            const count = renderAction.directionalLightsIndices.length;
            for (let j = 0; j < count; j++) {
                const lightIndex = renderAction.directionalLightsIndices[j];
                const light = comp._lights[lightIndex];
                const casters = comp._lightCompositionData[lightIndex].shadowCastersList;
                this._shadowRenderer.cullDirectional(light, casters, renderAction.camera.camera);
            }
        }
    }

    // visibility culling of lights, meshInstances, shadows casters
    // Also applies meshInstance.visible and camera.cullingMask
    cullComposition(comp) {

        // #if _PROFILER
        const cullTime = now();
        // #endif

        const renderActions = comp._renderActions;
        for (let i = 0; i < renderActions.length; i++) {
            const renderAction = renderActions[i];

            // layer
            const layerIndex = renderAction.layerIndex;
            const layer = comp.layerList[layerIndex];
            if (!layer.enabled || !comp.subLayerEnabled[layerIndex]) continue;
            const transparent = comp.subLayerList[layerIndex];

            // camera
            const cameraPass = renderAction.cameraIndex;
            const camera = layer.cameras[cameraPass];

            if (camera) {

                camera.frameBegin(renderAction.renderTarget);

                // update camera and frustum once
                if (renderAction.firstCameraUse) {
                    this.updateCameraFrustum(camera.camera);
                    this._camerasRendered++;
                }

                // cull each layer's non-directional lights once with each camera
                // lights aren't collected anywhere, but marked as visible
                this.cullLights(camera.camera, layer._lights);

                // cull mesh instances
                const objects = layer.instances;

                // collect them into layer arrays
                const visible = transparent ? objects.visibleTransparent[cameraPass] : objects.visibleOpaque[cameraPass];

                // shared objects are only culled once
                if (!visible.done) {

                    if (layer.onPreCull) {
                        layer.onPreCull(cameraPass);
                    }

                    const drawCalls = transparent ? layer.transparentMeshInstances : layer.opaqueMeshInstances;
                    visible.length = this.cull(camera.camera, drawCalls, visible.list);
                    visible.done = true;

                    if (layer.onPostCull) {
                        layer.onPostCull(cameraPass);
                    }
                }

                camera.frameEnd();
            }
        }

        // cull shadow casters for all lights
        this.cullShadowmaps(comp);

        // #if _PROFILER
        this._cullTime += now() - cullTime;
        // #endif
    }

    updateLightTextureAtlas(comp) {
        this.lightTextureAtlas.update(comp._splitLights[LIGHTTYPE_SPOT], comp._splitLights[LIGHTTYPE_OMNI],
                                      comp.clusteredLightingCookiesEnabled, comp.clusteredLightingShadowsEnabled);
    }

    updateClusters(comp) {

        // #if _PROFILER
        const startTime = now();
        // #endif

        for (let i = 0; i < comp._worldClusters.length; i++) {
            const cluster = comp._worldClusters[i];
            cluster.update(comp._lights, this.scene.gammaCorrection);
        }

        // #if _PROFILER
        this._lightClustersTime += now() - startTime;
        this._lightClusters = comp._worldClusters.length;
        // #endif
    }

    renderComposition(comp) {
        const device = this.device;

        // update the skybox, since this might change _meshInstances
        this.scene._updateSkybox(device);

        this.beginLayers(comp);

        // #if _PROFILER
        const layerCompositionUpdateTime = now();
        // #endif

        // Update static layer data, if something's changed
        const updated = comp._update();
        if (updated & COMPUPDATED_LIGHTS) {
            this.scene.updateLitShaders = true;
        }

        // #if _PROFILER
        this._layerCompositionUpdateTime += now() - layerCompositionUpdateTime;
        // #endif

        this.updateLightStats(comp, updated);

        // Single per-frame calculations
        this.beginFrame(comp);
        this.setSceneConstants();

        // visibility culling of lights, meshInstances, shadows casters
        // after this the scene culling is done and script callbacks can be called to report which objects are visible
        this.cullComposition(comp);

        // GPU update for all visible objects
        this.gpuUpdate(comp._meshInstances);

        if (LayerComposition.clusteredLightingEnabled) {

            // update shadow / cookie atlas allocation for the visible lights
            this.updateLightTextureAtlas(comp);

            // render cookies for all local visible lights
            if (comp.clusteredLightingCookiesEnabled) {
                this.renderCookies(comp._splitLights[LIGHTTYPE_SPOT]);
                this.renderCookies(comp._splitLights[LIGHTTYPE_OMNI]);
            }
        }

        // render shadows for all local visible lights - these shadow maps are shared by all cameras
        if (!LayerComposition.clusteredLightingEnabled || (LayerComposition.clusteredLightingEnabled && comp.clusteredLightingShadowsEnabled)) {
            this.renderShadows(comp._splitLights[LIGHTTYPE_SPOT]);
            this.renderShadows(comp._splitLights[LIGHTTYPE_OMNI]);
        }

        // update light clusters
        if (LayerComposition.clusteredLightingEnabled) {
            this.updateClusters(comp);
        }

        // Rendering
        let sortTime, drawTime;
        const renderActions = comp._renderActions;
        for (let i = 0; i < renderActions.length; i++) {
            const renderAction = renderActions[i];

            // layer
            const layerIndex = renderAction.layerIndex;
            const layer = comp.layerList[layerIndex];
            const transparent = comp.subLayerList[layerIndex];

            const cameraPass = renderAction.cameraIndex;
            const camera = layer.cameras[cameraPass];

            // render directional shadow maps for this camera - these get re-rendered for each camera
            if (renderAction.directionalLights.length > 0) {
                this.renderShadows(renderAction.directionalLights, camera.camera);
            }

            if (!layer.enabled || !comp.subLayerEnabled[layerIndex]) {
                continue;
            }

            // #if _DEBUG
            this.device.pushMarker(camera ? camera.entity.name : "noname");
            this.device.pushMarker(layer.name);
            // #endif

            // #if _PROFILER
            drawTime = now();
            // #endif

            if (camera) {
                camera.frameBegin(renderAction.renderTarget);
            }

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

                // clear buffers
                if (renderAction.clearColor || renderAction.clearDepth || renderAction.clearStencil) {

                    // TODO: refactor clearView to accept flags from renderAction directly as well
                    const backupColor = camera.camera._clearColorBuffer;
                    const backupDepth = camera.camera._clearDepthBuffer;
                    const backupStencil = camera.camera._clearStencilBuffer;

                    camera.camera._clearColorBuffer = renderAction.clearColor;
                    camera.camera._clearDepthBuffer = renderAction.clearDepth;
                    camera.camera._clearStencilBuffer = renderAction.clearStencil;

                    this.clearView(camera.camera, renderAction.renderTarget, true, true);

                    camera.camera._clearColorBuffer = backupColor;
                    camera.camera._clearDepthBuffer = backupDepth;
                    camera.camera._clearStencilBuffer = backupStencil;
                }

                // #if _PROFILER
                sortTime = now();
                // #endif

                layer._sortVisible(transparent, camera.camera.node, cameraPass);

                 // #if _PROFILER
                this._sortTime += now() - sortTime;
                 // #endif

                const objects = layer.instances;
                const visible = transparent ? objects.visibleTransparent[cameraPass] : objects.visibleOpaque[cameraPass];

                // Set the not very clever global variable which is only useful when there's just one camera
                this.scene._activeCamera = camera.camera;

                // Set camera shader constants, viewport, scissor, render target
                this.setCamera(camera.camera, renderAction.renderTarget);

                // upload clustered lights uniforms
                if (LayerComposition.clusteredLightingEnabled && renderAction.lightClusters) {
                    renderAction.lightClusters.activate(this.lightTextureAtlas);
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
                device.setColorWrite(true, true, true, true);
                device.setStencilTest(false); // don't leak stencil state
                device.setAlphaToCoverage(false); // don't leak a2c state
                device.setDepthBias(false);

                camera.frameEnd();

                // trigger postprocessing for camera
                if (renderAction.triggerPostprocess && camera.onPostprocessing) {
                    camera.onPostprocessing(camera);
                }
            }

            // Call postrender callback if there's one
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

            // #if _DEBUG
            this.device.popMarker();
            this.device.popMarker();
            // #endif

            // #if _PROFILER
            layer._renderTime += now() - drawTime;
            // #endif
        }
    }
}

export { ForwardRenderer };
