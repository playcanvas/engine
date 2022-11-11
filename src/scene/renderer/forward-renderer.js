import { now } from '../../core/time.js';
import { Debug, DebugHelper } from '../../core/debug.js';

import { Mat3 } from '../../core/math/mat3.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Color } from '../../core/math/color.js';

import { BoundingSphere } from '../../core/shape/bounding-sphere.js';

import {
    CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL,
    CULLFACE_BACK, CULLFACE_FRONT, CULLFACE_FRONTANDBACK, CULLFACE_NONE,
    FUNC_ALWAYS,
    SEMANTIC_ATTR,
    STENCILOP_KEEP,
    UNIFORMTYPE_MAT4,
    SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT,
    BINDGROUP_VIEW, BINDGROUP_MESH, UNIFORM_BUFFER_DEFAULT_SLOT_NAME,
    TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT
} from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { UniformBuffer } from '../../platform/graphics/uniform-buffer.js';
import { UniformFormat, UniformBufferFormat } from '../../platform/graphics/uniform-buffer-format.js';
import { BindGroupFormat, BindBufferFormat, BindTextureFormat } from '../../platform/graphics/bind-group-format.js';
import { BindGroup } from '../../platform/graphics/bind-group.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';

import {
    COMPUPDATED_INSTANCES, COMPUPDATED_LIGHTS,
    FOG_NONE, FOG_LINEAR,
    LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT,
    LIGHTSHAPE_PUNCTUAL,
    MASK_AFFECT_LIGHTMAPPED, MASK_AFFECT_DYNAMIC, MASK_BAKE,
    SHADOWUPDATE_NONE,
    SORTKEY_DEPTH, SORTKEY_FORWARD,
    VIEW_CENTER, SHADOWUPDATE_THISFRAME, LAYERID_DEPTH, PROJECTION_ORTHOGRAPHIC
} from '../constants.js';
import { Material } from '../materials/material.js';
import { LightTextureAtlas } from '../lighting/light-texture-atlas.js';

import { ShadowRenderer } from './shadow-renderer.js';
import { StaticMeshes } from './static-meshes.js';
import { CookieRenderer } from './cookie-renderer.js';
import { LightCamera } from './light-camera.js';
import { WorldClustersDebug } from '../lighting/world-clusters-debug.js';

const viewInvMat = new Mat4();
const viewMat = new Mat4();
const viewMat3 = new Mat3();
const viewProjMat = new Mat4();
let projMat;

const flipYMat = new Mat4().setScale(1, -1, 1);
const flippedViewProjMat = new Mat4();
const flippedSkyboxProjMat = new Mat4();

const worldMatX = new Vec3();
const worldMatY = new Vec3();
const worldMatZ = new Vec3();

const webgl1DepthClearColor = new Color(254.0 / 255, 254.0 / 255, 254.0 / 255, 254.0 / 255);
const tempSphere = new BoundingSphere();
const boneTextureSize = [0, 0, 0, 0];
let boneTexture, instancingData, modelMatrix;

let keyA, keyB;

let _skinUpdateIndex = 0;

const _drawCallList = {
    drawCalls: [],
    isNewMaterial: [],
    lightMaskChanged: []
};

const _tempSet = new Set();

/**
 * The forward renderer renders {@link Scene}s.
 *
 * @ignore
 */
class ForwardRenderer {
    /** @type {boolean} */
    clustersDebugRendered = false;

    /**
     * Create a new ForwardRenderer instance.
     *
     * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} graphicsDevice - The
     * graphics device used by the renderer.
     * @hideconstructor
     */
    constructor(graphicsDevice) {
        this.device = graphicsDevice;
        const device = this.device;

        /** @type {import('../scene.js').Scene|null} */
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
        this._layerCompositionUpdateTime = 0;
        this._lightClustersTime = 0;
        this._lightClusters = 0;

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
        this.flipYId = scope.resolve('projectionFlipY');
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

        this.ambientId = scope.resolve('light_globalAmbient');
        this.exposureId = scope.resolve('exposure');
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

        this.twoSidedLightingNegScaleFactorId = scope.resolve('twoSidedLightingNegScaleFactor');

        this.fogColor = new Float32Array(3);
        this.ambientColor = new Float32Array(3);

        this.cameraParams = new Float32Array(4);

        this.viewUniformFormat = null;
        this.viewBindGroupFormat = null;
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
        if (camera.xr && camera.xr.views.length) {
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

    initViewBindGroupFormat() {

        if (this.device.supportsUniformBuffers && !this.viewUniformFormat) {

            // format of the view uniform buffer
            this.viewUniformFormat = new UniformBufferFormat(this.device, [
                new UniformFormat("matrix_viewProjection", UNIFORMTYPE_MAT4)
            ]);

            // format of the view bind group - contains single uniform buffer, and some textures
            this.viewBindGroupFormat = new BindGroupFormat(this.device, [
                new BindBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT)
            ], [
                new BindTextureFormat('lightsTextureFloat', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT)
            ]);
        }
    }

    setCameraUniforms(camera, target, renderAction) {

        let transform;

        let viewCount = 1;
        if (camera.xr && camera.xr.session) {
            const parent = camera._node.parent;
            if (parent) transform = parent.getWorldTransform();

            const views = camera.xr.views;
            viewCount = views.length;
            for (let v = 0; v < viewCount; v++) {
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

            this.flipYId.setValue(target?.flipY ? -1 : 1);

            // View Position (world space)
            this.dispatchViewPos(camera._node.getPosition());

            camera.frustum.setFromMat4(viewProjMat);
        }

        this.tbnBasis.setValue(target && target.flipY ? -1 : 1);

        // Near and far clip values
        this.nearClipId.setValue(camera._nearClip);
        this.farClipId.setValue(camera._farClip);

        if (this.scene.physicalUnits) {
            this.exposureId.setValue(camera.getExposure());
        } else {
            this.exposureId.setValue(this.scene.exposure);
        }

        const n = camera._nearClip;
        const f = camera._farClip;
        this.cameraParams[0] = 1 / f;
        this.cameraParams[1] = f;
        this.cameraParams[2] = n;
        this.cameraParams[3] = camera.projection === PROJECTION_ORTHOGRAPHIC ? 1 : 0;

        this.cameraParamsId.setValue(this.cameraParams);

        if (this.device.supportsUniformBuffers) {
            this.setupViewUniformBuffers(renderAction, viewCount);
        }
    }

    // make sure colorWrite is set to true to all channels, if you want to fully clear the target
    // TODO: this function is only used from outside of forward renderer, and should be deprecated
    // when the functionality moves to the render passes.
    setCamera(camera, target, clear, renderAction = null) {

        this.setCameraUniforms(camera, target, renderAction);
        this.clearView(camera, target, clear, false);
    }

    setupViewUniformBuffers(renderAction, viewCount) {

        Debug.assert(renderAction, "RenderAction cannot be null");
        if (renderAction) {

            const device = this.device;
            Debug.assert(viewCount === 1, "This code does not handle the viewCount yet");

            while (renderAction.viewBindGroups.length < viewCount) {
                const ub = new UniformBuffer(device, this.viewUniformFormat);
                const bg = new BindGroup(device, this.viewBindGroupFormat, ub);
                DebugHelper.setName(bg, `ViewBindGroup_${bg.id}`);
                renderAction.viewBindGroups.push(bg);
            }

            // update view bind group / uniforms
            const viewBindGroup = renderAction.viewBindGroups[0];
            viewBindGroup.defaultUniformBuffer.update();
            viewBindGroup.update();

            // TODO; this needs to be moved to drawInstance functions to handle XR
            device.setBindGroup(BINDGROUP_VIEW, viewBindGroup);
        }
    }

    /**
     * Set up the viewport and the scissor for camera rendering.
     *
     * @param {import('../camera.js').Camera} camera - The camera containing the viewport
     * information.
     * @param {import('../../platform/graphics/render-target.js').RenderTarget} [renderTarget] - The
     * render target. NULL for the default one.
     */
    setupViewport(camera, renderTarget) {

        const device = this.device;
        DebugGraphics.pushGpuMarker(device, 'SETUP-VIEWPORT');

        const pixelWidth = renderTarget ? renderTarget.width : device.width;
        const pixelHeight = renderTarget ? renderTarget.height : device.height;

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

        DebugGraphics.popGpuMarker(device);
    }

    /**
     * Clear the current render target, using currently set up viewport.
     *
     * @param {import('../composition/render-action.js').RenderAction} renderAction - Render action
     * containing the clear flags.
     * @param {import('../camera.js').Camera} camera - Camera containing the clear values.
     */
    clear(renderAction, camera) {

        const device = this.device;
        DebugGraphics.pushGpuMarker(device, 'CLEAR-VIEWPORT');

        device.clear({
            color: [camera._clearColor.r, camera._clearColor.g, camera._clearColor.b, camera._clearColor.a],
            depth: camera._clearDepth,
            stencil: camera._clearStencil,
            flags: (renderAction.clearColor ? CLEARFLAG_COLOR : 0) |
                   (renderAction.clearDepth ? CLEARFLAG_DEPTH : 0) |
                   (renderAction.clearStencil ? CLEARFLAG_STENCIL : 0)
        });

        DebugGraphics.popGpuMarker(device);
    }

    // TODO: this is currently used by the lightmapper and the Editor,
    // and will be removed when those call are removed.
    clearView(camera, target, clear, forceWrite) {

        const device = this.device;
        DebugGraphics.pushGpuMarker(device, 'CLEAR-VIEW');

        device.setRenderTarget(target);
        device.updateBegin();

        if (forceWrite) {
            device.setColorWrite(true, true, true, true);
            device.setDepthWrite(true);
        }

        this.setupViewport(camera, target);

        if (clear) {
            // use camera clear options if any
            const options = camera._clearOptions;

            device.clear(options ? options : {
                color: [camera._clearColor.r, camera._clearColor.g, camera._clearColor.b, camera._clearColor.a],
                depth: camera._clearDepth,
                flags: (camera._clearColorBuffer ? CLEARFLAG_COLOR : 0) |
                       (camera._clearDepthBuffer ? CLEARFLAG_DEPTH : 0) |
                       (camera._clearStencilBuffer ? CLEARFLAG_STENCIL : 0),
                stencil: camera._clearStencil
            });
        }

        DebugGraphics.popGpuMarker(device);
    }

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

        const clusteredLightingEnabled = this.scene.clusteredLightingEnabled;
        const physicalUnits = this.scene.physicalUnits;
        for (let i = 0; i < lights.length; i++) {
            const light = lights[i];

            if (light.enabled) {
                // directional lights are marked visible at the start of the frame
                if (light._type !== LIGHTTYPE_DIRECTIONAL) {
                    light.getBoundingSphere(tempSphere);
                    if (camera.frustum.containsSphere(tempSphere)) {
                        light.visibleThisFrame = true;
                        light.usePhysicalUnits = physicalUnits;

                        // maximum screen area taken by the light
                        const screenSize = camera.getScreenSize(tempSphere);
                        light.maxScreenSize = Math.max(light.maxScreenSize, screenSize);
                    } else {
                        // if shadow casting light does not have shadow map allocated, mark it visible to allocate shadow map
                        // Note: This won't be needed when clustered shadows are used, but at the moment even culled out lights
                        // are used for rendering, and need shadow map to be allocated
                        // TODO: delete this code when clusteredLightingEnabled is being removed and is on by default.
                        if (!clusteredLightingEnabled) {
                            if (light.castShadows && !light.shadowMap) {
                                light.visibleThisFrame = true;
                            }
                        }
                    }
                } else {
                    light.usePhysicalUnits = this.scene.physicalUnits;
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
            const drawCall = drawCalls[i];
            const si = drawCall.skinInstance;
            if (si && drawCall.visibleThisFrame) {
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

        DebugGraphics.pushGpuMarker(device, meshInstance.node.name);

        instancingData = meshInstance.instancingData;
        if (instancingData) {
            if (instancingData.count > 0) {
                this._instancedDrawCalls++;
                device.setVertexBuffer(instancingData.vertexBuffer);
                device.draw(mesh.primitive[style], instancingData.count);
            }
        } else {
            modelMatrix = meshInstance.node.worldTransform;
            this.modelMatrixId.setValue(modelMatrix.data);

            if (normal) {
                this.normalMatrixId.setValue(meshInstance.node.normalMatrix.data);
            }

            device.draw(mesh.primitive[style]);
        }

        DebugGraphics.popGpuMarker(device);
    }

    // used for stereo
    drawInstance2(device, meshInstance, mesh, style) {

        DebugGraphics.pushGpuMarker(device, meshInstance.node.name);

        instancingData = meshInstance.instancingData;
        if (instancingData) {
            if (instancingData.count > 0) {
                this._instancedDrawCalls++;
                device.draw(mesh.primitive[style], instancingData.count, true);
            }
        } else {
            // matrices are already set
            device.draw(mesh.primitive[style], undefined, true);
        }

        DebugGraphics.popGpuMarker(device);
    }

    renderShadows(lights, camera) {

        const isClustered = this.scene.clusteredLightingEnabled;

        // #if _PROFILER
        const shadowMapStartTime = now();
        // #endif

        for (let i = 0; i < lights.length; i++) {
            const light = lights[i];

            if (isClustered && light._type !== LIGHTTYPE_DIRECTIONAL) {

                // skip clustered shadows with no assigned atlas slot
                if (!light.atlasViewportAllocated) {
                    continue;
                }

                // if atlas slot is reassigned, make sure shadow is updated
                if (light.atlasSlotUpdated && light.shadowUpdateMode === SHADOWUPDATE_NONE) {
                    light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
                }
            }

            this._shadowRenderer.render(light, camera);
        }

        // #if _PROFILER
        this._shadowMapTime += now() - shadowMapStartTime;
        // #endif
    }

    renderCookies(lights) {

        const cookieRenderTarget = this.lightTextureAtlas.cookieRenderTarget;
        for (let i = 0; i < lights.length; i++) {
            const light = lights[i];

            // skip clustered cookies with no assigned atlas slot
            if (!light.atlasViewportAllocated)
                continue;

            // only render cookie when the slot is reassigned (assuming the cookie texture is static)
            if (!light.atlasSlotUpdated)
                continue;

            this._cookieRenderer.render(light, cookieRenderTarget);
        }
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
                }

                Debug.assert(drawCall._shader[pass], "no shader for pass", material);

                addCall(drawCall, material !== prevMaterial, !prevMaterial || lightMask !== prevLightMask);

                prevMaterial = material;
                prevObjDefs = objDefs;
                prevLightMask = lightMask;
                prevStatic = drawCall.isStatic;
            }
        }

        return _drawCallList;
    }

    renderForwardInternal(camera, preparedCalls, sortedLights, pass, drawCallback, flipFaces) {
        const device = this.device;
        const supportsUniformBuffers = device.supportsUniformBuffers;
        const scene = this.scene;
        const passFlag = 1 << pass;

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

                    const shader = drawCall._shader[pass];
                    if (!shader.failed && !device.setShader(shader)) {
                        Debug.error(`Error compiling shader for material=${material.name} pass=${pass} objDefs=${objDefs}`, material);
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

                if (supportsUniformBuffers) {

                    // TODO: model matrix setup is part of the drawInstance call, but with uniform buffer it's needed
                    // earlier here. This needs to be refactored for multi-view anyways.
                    this.modelMatrixId.setValue(drawCall.node.worldTransform.data);
                    this.normalMatrixId.setValue(drawCall.node.normalMatrix.data);

                    // update mesh bind group / uniform buffer
                    const meshBindGroup = drawCall.getBindGroup(device, pass);
                    meshBindGroup.defaultUniformBuffer.update();
                    meshBindGroup.update();
                    device.setBindGroup(BINDGROUP_MESH, meshBindGroup);
                }

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

    /**
     * @param {import('../mesh-instance.js').MeshInstance[]} drawCalls - Mesh instances.
     * @param {boolean} onlyLitShaders - Limits the update to shaders affected by lighting.
     */
    updateShaders(drawCalls, onlyLitShaders) {
        const count = drawCalls.length;
        for (let i = 0; i < count; i++) {
            const mat = drawCalls[i].material;
            if (mat) {
                // material not processed yet
                if (!_tempSet.has(mat)) {
                    _tempSet.add(mat);

                    // skip this for materials not using variants
                    if (mat.getShaderVariant !== Material.prototype.getShaderVariant) {

                        if (onlyLitShaders) {
                            // skip materials not using lighting
                            if (!mat.useLighting || (mat.emitter && !mat.emitter.lighting))
                                continue;
                        }

                        // clear shader variants on the material and also on mesh instances that use it
                        mat.clearVariants();
                    }
                }
            }
        }

        // keep temp set empty
        _tempSet.clear();
    }

    /**
     * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
     * composition to update.
     * @param {boolean} lightsChanged - True if lights of the composition has changed.
     */
    beginFrame(comp, lightsChanged) {
        const meshInstances = comp._meshInstances;

        // Update shaders if needed
        const scene = this.scene;
        if (scene.updateShaders || lightsChanged) {
            const onlyLitShaders = !scene.updateShaders && lightsChanged;
            this.updateShaders(meshInstances, onlyLitShaders);
            scene.updateShaders = false;
            scene._shaderVersion++;
        }

        // Update all skin matrices to properly cull skinned objects (but don't update rendering data yet)
        this.updateCpuSkinMatrices(meshInstances);

        // clear mesh instance visibility
        const miCount = meshInstances.length;
        for (let i = 0; i < miCount; i++) {
            meshInstances[i].visibleThisFrame = false;
        }

        // clear light visibility
        const lights = comp._lights;
        const lightCount = lights.length;
        for (let i = 0; i < lightCount; i++) {
            lights[i].beginFrame();
        }
    }

    /**
     * Updates the layer composition for rendering.
     *
     * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
     * composition to update.
     * @param {boolean} clusteredLightingEnabled - True if clustered lighting is enabled.
     * @returns {number} - Flags of what was updated
     * @ignore
     */
    updateLayerComposition(comp, clusteredLightingEnabled) {

        // #if _PROFILER
        const layerCompositionUpdateTime = now();
        // #endif

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
            // Note: Static lighting is not used when clustered lighting is enabled
            if (layer._needsStaticPrepare && layer._staticLightHash && !this.scene.clusteredLightingEnabled) {
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

        // Update static layer data, if something's changed
        const updated = comp._update(this.device, clusteredLightingEnabled);

        // #if _PROFILER
        this._layerCompositionUpdateTime += now() - layerCompositionUpdateTime;
        // #endif

        return updated;
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
     * Shadow map culling for directional and visible local lights
     * visible meshInstances are collected into light._renderData, and are marked as visible
     * for directional lights also shadow camera matrix is set up
     *
     * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
     * composition.
     */
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

    /**
     * visibility culling of lights, meshInstances, shadows casters
     * Also applies meshInstance.visible and camera.cullingMask
     *
     * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
     * composition.
     */
    cullComposition(comp) {

        // #if _PROFILER
        const cullTime = now();
        // #endif

        const renderActions = comp._renderActions;
        for (let i = 0; i < renderActions.length; i++) {

            /** @type {import('../composition/render-action.js').RenderAction} */
            const renderAction = renderActions[i];

            // layer
            const layerIndex = renderAction.layerIndex;
            /** @type {import('../layer.js').Layer} */
            const layer = comp.layerList[layerIndex];
            if (!layer.enabled || !comp.subLayerEnabled[layerIndex]) continue;
            const transparent = comp.subLayerList[layerIndex];

            // camera
            const cameraPass = renderAction.cameraIndex;
            /** @type {import('../../framework/components/camera/component.js').CameraComponent} */
            const camera = layer.cameras[cameraPass];

            if (camera) {

                camera.frameUpdate(renderAction.renderTarget);

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
            }
        }

        // cull shadow casters for all lights
        this.cullShadowmaps(comp);

        // #if _PROFILER
        this._cullTime += now() - cullTime;
        // #endif
    }

    /**
     * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
     * composition.
     */
    updateLightTextureAtlas(comp) {
        this.lightTextureAtlas.update(comp._splitLights[LIGHTTYPE_SPOT], comp._splitLights[LIGHTTYPE_OMNI], this.scene.lighting);
    }

    /**
     * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
     * composition.
     */
    updateClusters(comp) {

        // #if _PROFILER
        const startTime = now();
        // #endif

        const emptyWorldClusters = comp.getEmptyWorldClusters(this.device);

        const renderActions = comp._renderActions;
        for (let i = 0; i < renderActions.length; i++) {
            const renderAction = renderActions[i];
            const cluster = renderAction.lightClusters;

            if (cluster && cluster !== emptyWorldClusters) {

                // update each cluster only one time
                if (!_tempSet.has(cluster)) {
                    _tempSet.add(cluster);

                    const layer = comp.layerList[renderAction.layerIndex];
                    cluster.update(layer.clusteredLightsSet, this.scene.gammaCorrection, this.scene.lighting);
                }
            }
        }

        // keep temp set empty
        _tempSet.clear();

        // #if _PROFILER
        this._lightClustersTime += now() - startTime;
        this._lightClusters = comp._worldClusters.length;
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

        frameGraph.reset();

        this.update(layerComposition);

        const clusteredLightingEnabled = this.scene.clusteredLightingEnabled;
        if (clusteredLightingEnabled) {

            // update shadow / cookie atlas allocation for the visible lights
            this.updateLightTextureAtlas(layerComposition);

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

        // local shadows
        const renderPass = new RenderPass(this.device, () => {

            // render shadows for all local visible lights - these shadow maps are shared by all cameras
            if (!clusteredLightingEnabled || (clusteredLightingEnabled && this.scene.lighting.shadowsEnabled)) {
                this.renderShadows(layerComposition._splitLights[LIGHTTYPE_SPOT]);
                this.renderShadows(layerComposition._splitLights[LIGHTTYPE_OMNI]);
            }

            // update light clusters
            if (clusteredLightingEnabled) {
                this.updateClusters(layerComposition);
            }
        });
        renderPass.requiresCubemaps = false;
        DebugHelper.setName(renderPass, 'LocalShadowMaps');
        frameGraph.addRenderPass(renderPass);

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
                const renderPass = new RenderPass(this.device, () => {
                    this.renderPassDirectionalShadows(renderAction, layerComposition);
                });
                renderPass.requiresCubemaps = false;
                DebugHelper.setName(renderPass, `DirShadowMap`);
                frameGraph.addRenderPass(renderPass);
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
        const startLayer = layerComposition.layerList[startRenderAction.layerIndex];
        const camera = startLayer.cameras[startRenderAction.cameraIndex];

        // depth grab pass on webgl1 is normal render pass (scene gets re-rendered)
        const isWebgl1DepthGrabPass = isGrabPass && !this.device.webgl2 && camera.renderSceneDepthMap;
        const isRealPass = !isGrabPass || isWebgl1DepthGrabPass;

        if (isRealPass) {

            renderPass.init(renderTarget);
            renderPass.fullSizeClearRect = camera.camera.fullSizeClearRect;

            if (isWebgl1DepthGrabPass) {

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

        const clusteredLightingEnabled = this.scene.clusteredLightingEnabled;
        this.clustersDebugRendered = false;

        this.initViewBindGroupFormat();

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

    /**
     * Render pass for directional shadow maps of the camera.
     *
     * @param {import('../composition/render-action.js').RenderAction} renderAction - The render
     * action.
     * @param {import('../composition/layer-composition.js').LayerComposition} layerComposition - The
     * layer composition.
     * @ignore
     */
    renderPassDirectionalShadows(renderAction, layerComposition) {

        Debug.assert(renderAction.directionalLights.length > 0);
        const layer = layerComposition.layerList[renderAction.layerIndex];
        const camera = layer.cameras[renderAction.cameraIndex];

        this.renderShadows(renderAction.directionalLights, camera.camera);
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

        if (camera) {
            // callback on the camera component before rendering with this camera for the first time during the frame
            if (renderAction.firstCameraUse && camera.onPreRender) {
                camera.onPreRender();
            }
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

            this.setupViewport(camera.camera, renderAction.renderTarget);

            // if this is not a first render action to the render target, or if the render target was not
            // fully cleared on pass start, we need to execute clears here
            if (!firstRenderAction || !camera.camera.fullSizeClearRect) {
                this.clear(renderAction, camera.camera);
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

            this.setCameraUniforms(camera.camera, renderAction.renderTarget, renderAction);

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
            device.setColorWrite(true, true, true, true);
            device.setStencilTest(false); // don't leak stencil state
            device.setAlphaToCoverage(false); // don't leak a2c state
            device.setDepthBias(false);

            // callback on the camera component when we're done rendering all layers with this camera
            if (renderAction.lastCameraUse && camera.onPostRender) {
                camera.onPostRender();
            }
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
