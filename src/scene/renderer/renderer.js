import { Debug, DebugHelper } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Mat3 } from '../../core/math/mat3.js';
import { Mat4 } from '../../core/math/mat4.js';

import {
    SORTKEY_DEPTH, SORTKEY_FORWARD,
    VIEW_CENTER, PROJECTION_ORTHOGRAPHIC
} from '../constants.js';
import { LightTextureAtlas } from '../lighting/light-texture-atlas.js';

import {
    CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL,
    BINDGROUP_VIEW, UNIFORM_BUFFER_DEFAULT_SLOT_NAME,
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

import { ShadowRenderer } from './shadow-renderer.js';
import { CookieRenderer } from './cookie-renderer.js';

let _skinUpdateIndex = 0;
const boneTextureSize = [0, 0, 0, 0];
const viewProjMat = new Mat4();
const viewInvMat = new Mat4();
const viewMat = new Mat4();
const worldMatX = new Vec3();
const worldMatY = new Vec3();
const worldMatZ = new Vec3();
const viewMat3 = new Mat3();
let projMat;

const flipYMat = new Mat4().setScale(1, -1, 1);
const flippedViewProjMat = new Mat4();
const flippedSkyboxProjMat = new Mat4();

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
        this._shadowRenderer = new ShadowRenderer(this, this.lightTextureAtlas);

        // cookies
        this._cookieRenderer = new CookieRenderer(graphicsDevice, this.lightTextureAtlas);

        this.viewUniformFormat = null;
        this.viewBindGroupFormat = null;

        // timing and stats
        this._skinTime = 0;
        this._morphTime = 0;
        this._shadowDrawCalls = 0;
        this._skinDrawCalls = 0;
        this._instancedDrawCalls = 0;
        this._shadowMapUpdates = 0;

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
        this._shadowRenderer.destroy();
        this._shadowRenderer = null;

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

    setCameraUniforms(camera, target, renderAction) {

        let transform;

        let viewCount = 1;
        if (camera.xr && camera.xr.session) {
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
                new BindTextureFormat('lightsTextureFloat', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT)
            ]);
        }
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

    baseUpdate() {

        this.clustersDebugRendered = false;

        this.initViewBindGroupFormat();
    }
}

export { Renderer };
