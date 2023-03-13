import { Debug, DebugHelper } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Mat3 } from '../../core/math/mat3.js';
import { Mat4 } from '../../core/math/mat4.js';
import { BoundingSphere } from '../../core/shape/bounding-sphere.js';

import {
    SORTKEY_DEPTH, SORTKEY_FORWARD,
    VIEW_CENTER, PROJECTION_ORTHOGRAPHIC,
    LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT,
    SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME
} from '../constants.js';
import { LightTextureAtlas } from '../lighting/light-texture-atlas.js';
import { Material } from '../materials/material.js';

import {
    CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL,
    BINDGROUP_MESH, BINDGROUP_VIEW, UNIFORM_BUFFER_DEFAULT_SLOT_NAME,
    UNIFORMTYPE_MAT4,
    SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT,
    SEMANTIC_ATTR,
    CULLFACE_BACK, CULLFACE_FRONT, CULLFACE_FRONTANDBACK, CULLFACE_NONE,
    TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT
} from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { UniformBuffer } from '../../platform/graphics/uniform-buffer.js';
import { BindGroup } from '../../platform/graphics/bind-group.js';
import { UniformFormat, UniformBufferFormat } from '../../platform/graphics/uniform-buffer-format.js';
import { BindGroupFormat, BindBufferFormat, BindTextureFormat } from '../../platform/graphics/bind-group-format.js';

import { ShadowMapCache } from './shadow-map-cache.js';
import { ShadowRendererLocal } from './shadow-renderer-local.js';
import { ShadowRendererDirectional } from './shadow-renderer-directional.js';
import { CookieRenderer } from './cookie-renderer.js';
import { StaticMeshes } from './static-meshes.js';
import { ShadowRenderer } from './shadow-renderer.js';

let _skinUpdateIndex = 0;
const boneTextureSize = [0, 0, 0, 0];
const viewProjMat = new Mat4();
const viewInvMat = new Mat4();
const viewMat = new Mat4();
const worldMatX = new Vec3();
const worldMatY = new Vec3();
const worldMatZ = new Vec3();
const viewMat3 = new Mat3();
const tempSphere = new BoundingSphere();
const _flipYMat = new Mat4().setScale(1, -1, 1);

// Converts a projection matrix in OpenGL style (depth range of -1..1) to a DirectX style (depth range of 0..1).
const _fixProjRangeMat = new Mat4().set([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 0.5, 0,
    0, 0, 0.5, 1
]);

const _tempProjMat0 = new Mat4();
const _tempProjMat1 = new Mat4();
const _tempProjMat2 = new Mat4();
const _tempProjMat3 = new Mat4();
const _tempSet = new Set();

/**
 * The base renderer functionality to allow implementation of specialized renderers.
 *
 * @ignore
 */
class Renderer {
    /** @type {boolean} */
    clustersDebugRendered = false;

    /**
     * Create a new instance.
     *
     * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} graphicsDevice - The
     * graphics device used by the renderer.
     */
    constructor(graphicsDevice) {
        this.device = graphicsDevice;

        /** @type {import('../scene.js').Scene|null} */
        this.scene = null;

        // texture atlas managing shadow map / cookie texture atlassing for omni and spot lights
        this.lightTextureAtlas = new LightTextureAtlas(graphicsDevice);

        // shadows
        this.shadowMapCache = new ShadowMapCache();
        this.shadowRenderer = new ShadowRenderer(this, this.lightTextureAtlas);
        this._shadowRendererLocal = new ShadowRendererLocal(this, this.shadowRenderer);
        this._shadowRendererDirectional = new ShadowRendererDirectional(this, this.shadowRenderer);

        // cookies
        this._cookieRenderer = new CookieRenderer(graphicsDevice, this.lightTextureAtlas);

        // view bind group format with its uniform buffer format
        this.viewUniformFormat = null;
        this.viewBindGroupFormat = null;

        // timing
        this._skinTime = 0;
        this._morphTime = 0;
        this._cullTime = 0;
        this._shadowMapTime = 0;
        this._lightClustersTime = 0;
        this._layerCompositionUpdateTime = 0;

        // stats
        this._shadowDrawCalls = 0;
        this._skinDrawCalls = 0;
        this._instancedDrawCalls = 0;
        this._shadowMapUpdates = 0;
        this._numDrawCallsCulled = 0;
        this._camerasRendered = 0;
        this._lightClusters = 0;

        // Uniforms
        const scope = graphicsDevice.scope;
        this.boneTextureId = scope.resolve('texture_poseMap');
        this.boneTextureSizeId = scope.resolve('texture_poseMapSize');
        this.poseMatrixId = scope.resolve('matrix_pose[0]');

        this.modelMatrixId = scope.resolve('matrix_model');
        this.normalMatrixId = scope.resolve('matrix_normal');
        this.viewInvId = scope.resolve('matrix_viewInverse');
        this.viewPos = new Float32Array(3);
        this.viewPosId = scope.resolve('view_position');
        this.projId = scope.resolve('matrix_projection');
        this.projSkyboxId = scope.resolve('matrix_projectionSkybox');
        this.viewId = scope.resolve('matrix_view');
        this.viewId3 = scope.resolve('matrix_view3');
        this.viewProjId = scope.resolve('matrix_viewProjection');
        this.flipYId = scope.resolve('projectionFlipY');
        this.tbnBasis = scope.resolve('tbnBasis');
        this.nearClipId = scope.resolve('camera_near');
        this.farClipId = scope.resolve('camera_far');
        this.cameraParams = new Float32Array(4);
        this.cameraParamsId = scope.resolve('camera_params');

        this.alphaTestId = scope.resolve('alpha_ref');
        this.opacityMapId = scope.resolve('texture_opacityMap');

        this.exposureId = scope.resolve('exposure');
        this.twoSidedLightingNegScaleFactorId = scope.resolve('twoSidedLightingNegScaleFactor');

        this.morphWeightsA = scope.resolve('morph_weights_a');
        this.morphWeightsB = scope.resolve('morph_weights_b');
        this.morphPositionTex = scope.resolve('morphPositionTex');
        this.morphNormalTex = scope.resolve('morphNormalTex');
        this.morphTexParams = scope.resolve('morph_tex_params');
    }

    destroy() {
        this.shadowRenderer = null;
        this._shadowRendererLocal = null;
        this._shadowRendererDirectional = null;

        this.shadowMapCache.destroy();
        this.shadowMapCache = null;

        this._cookieRenderer.destroy();
        this._cookieRenderer = null;

        this.lightTextureAtlas.destroy();
        this.lightTextureAtlas = null;
    }

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

        const keyA = drawCallA._key[SORTKEY_FORWARD];
        const keyB = drawCallB._key[SORTKEY_FORWARD];

        if (keyA === keyB && drawCallA.mesh && drawCallB.mesh) {
            return drawCallB.mesh.id - drawCallA.mesh.id;
        }

        return keyB - keyA;
    }

    sortCompareDepth(drawCallA, drawCallB) {
        const keyA = drawCallA._key[SORTKEY_DEPTH];
        const keyB = drawCallB._key[SORTKEY_DEPTH];

        if (keyA === keyB && drawCallA.mesh && drawCallB.mesh) {
            return drawCallB.mesh.id - drawCallA.mesh.id;
        }

        return keyB - keyA;
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

        // use viewport rectangle by default. Use scissor rectangle when required.
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

    setCameraUniforms(camera, target) {

        // flipping proj matrix
        const flipY = target?.flipY;

        let viewCount = 1;
        if (camera.xr && camera.xr.session) {
            let transform;
            const parent = camera._node.parent;
            if (parent)
                transform = parent.getWorldTransform();

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
            let projMat = camera.projectionMatrix;
            if (camera.calculateProjection) {
                camera.calculateProjection(projMat, VIEW_CENTER);
            }
            let projMatSkybox = camera.getProjectionMatrixSkybox();

            // flip projection matrices
            if (flipY) {
                projMat = _tempProjMat0.mul2(_flipYMat, projMat);
                projMatSkybox = _tempProjMat1.mul2(_flipYMat, projMatSkybox);
            }

            // update depth range of projection matrices (-1..1 to 0..1)
            if (this.device.isWebGPU) {
                projMat = _tempProjMat2.mul2(_fixProjRangeMat, projMat);
                projMatSkybox = _tempProjMat3.mul2(_fixProjRangeMat, projMatSkybox);
            }

            this.projId.setValue(projMat.data);
            this.projSkyboxId.setValue(projMatSkybox.data);

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
            this.viewProjId.setValue(viewProjMat.data);

            this.flipYId.setValue(flipY ? -1 : 1);

            // View Position (world space)
            this.dispatchViewPos(camera._node.getPosition());

            camera.frustum.setFromMat4(viewProjMat);
        }

        this.tbnBasis.setValue(flipY ? -1 : 1);

        // Near and far clip values
        const n = camera._nearClip;
        const f = camera._farClip;
        this.nearClipId.setValue(n);
        this.farClipId.setValue(f);

        // camera params
        this.cameraParams[0] = 1 / f;
        this.cameraParams[1] = f;
        this.cameraParams[2] = n;
        this.cameraParams[3] = camera.projection === PROJECTION_ORTHOGRAPHIC ? 1 : 0;
        this.cameraParamsId.setValue(this.cameraParams);

        // exposure
        this.exposureId.setValue(this.scene.physicalUnits ? camera.getExposure() : this.scene.exposure);

        return viewCount;
    }

    /**
     * Clears the active render target. If the viewport is already set up, only its area is cleared.
     *
     * @param {import('../camera.js').Camera} camera - The camera supplying the value to clear to.
     * @param {boolean} [clearColor] - True if the color buffer should be cleared. Uses the value
     * from the camra if not supplied.
     * @param {boolean} [clearDepth] - True if the depth buffer should be cleared. Uses the value
     * from the camra if not supplied.
     * @param {boolean} [clearStencil] - True if the stencil buffer should be cleared. Uses the
     * value from the camra if not supplied.
     */
    clear(camera, clearColor, clearDepth, clearStencil) {

        const flags = ((clearColor ?? camera._clearColorBuffer) ? CLEARFLAG_COLOR : 0) |
                      ((clearDepth ?? camera._clearDepthBuffer) ? CLEARFLAG_DEPTH : 0) |
                      ((clearStencil ?? camera._clearStencilBuffer) ? CLEARFLAG_STENCIL : 0);

        if (flags) {
            const device = this.device;
            DebugGraphics.pushGpuMarker(device, 'CLEAR');

            device.clear({
                color: [camera._clearColor.r, camera._clearColor.g, camera._clearColor.b, camera._clearColor.a],
                depth: camera._clearDepth,
                stencil: camera._clearStencil,
                flags: flags
            });

            DebugGraphics.popGpuMarker(device);
        }
    }

    // make sure colorWrite is set to true to all channels, if you want to fully clear the target
    // TODO: this function is only used from outside of forward renderer, and should be deprecated
    // when the functionality moves to the render passes. Note that Editor uses it as well.
    setCamera(camera, target, clear, renderAction = null) {

        this.setCameraUniforms(camera, target);
        this.clearView(camera, target, clear, false);
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
            this.twoSidedLightingNegScaleFactorId.setValue(worldMatX.dot(worldMatZ) < 0 ? -1.0 : 1.0);
        }
    }

    updateCameraFrustum(camera) {

        if (camera.xr && camera.xr.views.length) {
            // calculate frustum based on XR view
            const view = camera.xr.views[0];
            viewProjMat.mul2(view.projMat, view.viewOffMat);
            camera.frustum.setFromMat4(viewProjMat);
            return;
        }

        const projMat = camera.projectionMatrix;
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

    setBaseConstants(device, material) {

        // Cull mode
        device.setCullMode(material.cull);

        // Alpha test
        if (material.opacityMap) {
            this.opacityMapId.setValue(material.opacityMap);
        }
        if (material.opacityMap || material.alphaTest > 0) {
            this.alphaTestId.setValue(material.alphaTest);
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

        const count = drawCalls.length;
        for (let i = 0; i < count; i++) {
            const drawCall = drawCalls[i];
            if (drawCall.visibleThisFrame) {
                const skin = drawCall.skinInstance;
                if (skin && skin._dirty) {
                    skin.updateMatrixPalette(drawCall.node, _skinUpdateIndex);
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
            const drawCall = drawCalls[i];
            const morphInst = drawCall.morphInstance;
            if (morphInst && morphInst._dirty && drawCall.visibleThisFrame) {
                morphInst.update();
            }
        }
        // #if _PROFILER
        this._morphTime += now() - morphTime;
        // #endif
    }

    gpuUpdate(drawCalls) {
        // skip everything with visibleThisFrame === false
        this.updateGpuSkinMatrices(drawCalls);
        this.updateMorphing(drawCalls);
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

    setSkinning(device, meshInstance) {
        if (meshInstance.skinInstance) {
            this._skinDrawCalls++;
            if (device.supportsBoneTextures) {
                const boneTexture = meshInstance.skinInstance.boneTexture;
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

    // sets Vec3 camera position uniform
    dispatchViewPos(position) {
        const vp = this.viewPos;    // note that this reuses an array
        vp[0] = position.x;
        vp[1] = position.y;
        vp[2] = position.z;
        this.viewPosId.setValue(vp);
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
                new BindTextureFormat('lightsTextureFloat', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT),
                new BindTextureFormat('lightsTexture8', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT)
            ]);
        }
    }

    setupViewUniformBuffers(viewBindGroups, viewUniformFormat, viewBindGroupFormat, viewCount) {

        Debug.assert(Array.isArray(viewBindGroups), "viewBindGroups must be an array");

        const device = this.device;
        Debug.assert(viewCount === 1, "This code does not handle the viewCount yet");

        while (viewBindGroups.length < viewCount) {
            const ub = new UniformBuffer(device, viewUniformFormat);
            const bg = new BindGroup(device, viewBindGroupFormat, ub);
            DebugHelper.setName(bg, `ViewBindGroup_${bg.id}`);
            viewBindGroups.push(bg);
        }

        // update view bind group / uniforms
        const viewBindGroup = viewBindGroups[0];
        viewBindGroup.defaultUniformBuffer.update();
        viewBindGroup.update();

        // TODO; this needs to be moved to drawInstance functions to handle XR
        device.setBindGroup(BINDGROUP_VIEW, viewBindGroup);
    }

    setupMeshUniformBuffers(meshInstance, pass) {

        const device = this.device;
        if (device.supportsUniformBuffers) {

            // TODO: model matrix setup is part of the drawInstance call, but with uniform buffer it's needed
            // earlier here. This needs to be refactored for multi-view anyways.
            this.modelMatrixId.setValue(meshInstance.node.worldTransform.data);
            this.normalMatrixId.setValue(meshInstance.node.normalMatrix.data);

            // update mesh bind group / uniform buffer
            const meshBindGroup = meshInstance.getBindGroup(device, pass);
            meshBindGroup.defaultUniformBuffer.update();
            meshBindGroup.update();
            device.setBindGroup(BINDGROUP_MESH, meshBindGroup);
        }
    }

    drawInstance(device, meshInstance, mesh, style, normal) {

        DebugGraphics.pushGpuMarker(device, meshInstance.node.name);

        const instancingData = meshInstance.instancingData;
        if (instancingData) {
            if (instancingData.count > 0) {
                this._instancedDrawCalls++;
                device.setVertexBuffer(instancingData.vertexBuffer);
                device.draw(mesh.primitive[style], instancingData.count);
            }
        } else {
            const modelMatrix = meshInstance.node.worldTransform;
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

        const instancingData = meshInstance.instancingData;
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

    /**
     * Shadow map culling for directional and visible local lights
     * visible meshInstances are collected into light._renderData, and are marked as visible
     * for directional lights also shadow camera matrix is set up
     *
     * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
     * composition.
     */
    cullShadowmaps(comp) {

        const isClustered = this.scene.clusteredLightingEnabled;

        // shadow casters culling for local (point and spot) lights
        for (let i = 0; i < comp._lights.length; i++) {
            const light = comp._lights[i];
            if (light._type !== LIGHTTYPE_DIRECTIONAL) {

                if (isClustered) {
                    // if atlas slot is reassigned, make sure to update the shadow map, including the culling
                    if (light.atlasSlotUpdated && light.shadowUpdateMode === SHADOWUPDATE_NONE) {
                        light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
                    }
                }

                if (light.visibleThisFrame && light.castShadows && light.shadowUpdateMode !== SHADOWUPDATE_NONE) {
                    const casters = comp._lightCompositionData[i].shadowCastersList;
                    this._shadowRendererLocal.cull(light, casters);
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
                this._shadowRendererDirectional.cull(light, casters, renderAction.camera.camera);
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

        // update shadow / cookie atlas allocation for the visible lights. Update it after the ligthts were culled,
        // but before shadow maps were culling, as it might force some 'update once' shadows to cull.
        if (this.scene.clusteredLightingEnabled) {
            this.updateLightTextureAtlas(comp);
        }

        // cull shadow casters for all lights
        this.cullShadowmaps(comp);

        // #if _PROFILER
        this._cullTime += now() - cullTime;
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

    frameUpdate() {

        this.clustersDebugRendered = false;

        this.initViewBindGroupFormat();
    }
}

export { Renderer };
