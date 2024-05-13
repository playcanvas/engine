import { Debug, DebugHelper } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { Mat3 } from '../../core/math/mat3.js';
import { Mat4 } from '../../core/math/mat4.js';
import { BoundingSphere } from '../../core/shape/bounding-sphere.js';

import {
    SORTKEY_DEPTH, SORTKEY_FORWARD,
    VIEW_CENTER, PROJECTION_ORTHOGRAPHIC,
    LIGHTTYPE_DIRECTIONAL, MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED, MASK_BAKE,
    SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME
} from '../constants.js';
import { LightTextureAtlas } from '../lighting/light-texture-atlas.js';
import { Material } from '../materials/material.js';
import { LightCube } from '../graphics/light-cube.js';

import {
    CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL,
    BINDGROUP_MESH, BINDGROUP_VIEW, UNIFORM_BUFFER_DEFAULT_SLOT_NAME,
    UNIFORMTYPE_MAT4, UNIFORMTYPE_MAT3, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC2, UNIFORMTYPE_FLOAT, UNIFORMTYPE_INT,
    SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT,
    SEMANTIC_ATTR,
    CULLFACE_BACK, CULLFACE_FRONT, CULLFACE_NONE,
    TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT, SAMPLETYPE_FLOAT, SAMPLETYPE_DEPTH,
    BINDGROUP_MESH_UB
} from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { UniformBuffer } from '../../platform/graphics/uniform-buffer.js';
import { BindGroup, DynamicBindGroup } from '../../platform/graphics/bind-group.js';
import { UniformFormat, UniformBufferFormat } from '../../platform/graphics/uniform-buffer-format.js';
import { BindGroupFormat, BindUniformBufferFormat, BindTextureFormat } from '../../platform/graphics/bind-group-format.js';

import { ShadowMapCache } from './shadow-map-cache.js';
import { ShadowRendererLocal } from './shadow-renderer-local.js';
import { ShadowRendererDirectional } from './shadow-renderer-directional.js';
import { ShadowRenderer } from './shadow-renderer.js';
import { WorldClustersAllocator } from './world-clusters-allocator.js';
import { RenderPassUpdateClustered } from './render-pass-update-clustered.js';
import { getBlueNoiseTexture } from '../graphics/noise-textures.js';
import { BlueNoise } from '../../core/math/blue-noise.js';

let _skinUpdateIndex = 0;
const viewProjMat = new Mat4();
const viewInvMat = new Mat4();
const viewMat = new Mat4();
const viewMat3 = new Mat3();
const tempSphere = new BoundingSphere();
const _flipYMat = new Mat4().setScale(1, -1, 1);
const _tempLightSet = new Set();
const _tempLayerSet = new Set();
const _dynamicBindGroup = new DynamicBindGroup();

// Converts a projection matrix in OpenGL style (depth range of -1..1) to a DirectX style (depth range of 0..1).
const _fixProjRangeMat = new Mat4().set([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 0.5, 0,
    0, 0, 0.5, 1
]);

// helton sequence of 2d offsets for jittering
const _haltonSequence = [
    new Vec2(0.5, 0.333333),
    new Vec2(0.25, 0.666667),
    new Vec2(0.75, 0.111111),
    new Vec2(0.125, 0.444444),
    new Vec2(0.625, 0.777778),
    new Vec2(0.375, 0.222222),
    new Vec2(0.875, 0.555556),
    new Vec2(0.0625, 0.888889),
    new Vec2(0.5625, 0.037037),
    new Vec2(0.3125, 0.370370),
    new Vec2(0.8125, 0.703704),
    new Vec2(0.1875, 0.148148),
    new Vec2(0.6875, 0.481481),
    new Vec2(0.4375, 0.814815),
    new Vec2(0.9375, 0.259259),
    new Vec2(0.03125, 0.592593)
];

const _tempProjMat0 = new Mat4();
const _tempProjMat1 = new Mat4();
const _tempProjMat2 = new Mat4();
const _tempProjMat3 = new Mat4();
const _tempProjMat4 = new Mat4();
const _tempProjMat5 = new Mat4();
const _tempSet = new Set();

const _tempMeshInstances = [];
const _tempMeshInstancesSkinned = [];

/**
 * The base renderer functionality to allow implementation of specialized renderers.
 *
 * @ignore
 */
class Renderer {
    /** @type {boolean} */
    clustersDebugRendered = false;

    /**
     * A set of visible mesh instances which need further processing before being rendered, e.g.
     * skinning or morphing. Extracted during culling.
     *
     * @type {Set<import('../mesh-instance.js').MeshInstance>}
     * @private
     */
    processingMeshInstances = new Set();

    /**
     * @type {WorldClustersAllocator}
     * @ignore
     */
    worldClustersAllocator;

    /**
     * A list of all unique lights in the layer composition.
     *
     * @type {import('../light.js').Light[]}
     */
    lights = [];

    /**
     * A list of all unique local lights (spot & omni) in the layer composition.
     *
     * @type {import('../light.js').Light[]}
     */
    localLights = [];

    /**
     * A list of unique directional shadow casting lights for each enabled camera. This is generated
     * each frame during light culling.
     *
     * @type {Map<import('../camera.js').Camera, Array<import('../light.js').Light>>}
     */
    cameraDirShadowLights = new Map();

    /**
     * A mapping of a directional light to a camera, for which the shadow is currently valid. This
     * is cleared each frame, and updated each time a directional light shadow is rendered for a
     * camera, and allows us to manually schedule shadow passes when a new camera needs a shadow.
     *
     * @type {Map<import('../light.js').Light, import('../camera.js').Camera>}
     */
    dirLightShadows = new Map();

    blueNoise = new BlueNoise(123);

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

        // TODO: allocate only when the scene has clustered lighting enabled
        this.worldClustersAllocator = new WorldClustersAllocator(graphicsDevice);

        // texture atlas managing shadow map / cookie texture atlassing for omni and spot lights
        this.lightTextureAtlas = new LightTextureAtlas(graphicsDevice);

        // shadows
        this.shadowMapCache = new ShadowMapCache();
        this.shadowRenderer = new ShadowRenderer(this, this.lightTextureAtlas);
        this._shadowRendererLocal = new ShadowRendererLocal(this, this.shadowRenderer);
        this._shadowRendererDirectional = new ShadowRendererDirectional(this, this.shadowRenderer);

        // clustered passes
        this._renderPassUpdateClustered = new RenderPassUpdateClustered(this.device, this, this.shadowRenderer,
                                                                        this._shadowRendererLocal, this.lightTextureAtlas);

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
        this.viewIndexId = scope.resolve('view_index');

        this.blueNoiseJitterVersion = 0;
        this.blueNoiseJitterVec = new Vec4();
        this.blueNoiseJitterData = new Float32Array(4);
        this.blueNoiseJitterId = scope.resolve('blueNoiseJitter');
        this.blueNoiseTextureId = scope.resolve('blueNoiseTex32');

        this.alphaTestId = scope.resolve('alpha_ref');
        this.opacityMapId = scope.resolve('texture_opacityMap');

        this.exposureId = scope.resolve('exposure');
        this.twoSidedLightingNegScaleFactorId = scope.resolve('twoSidedLightingNegScaleFactor');
        this.twoSidedLightingNegScaleFactorId.setValue(0);

        this.morphWeightsA = scope.resolve('morph_weights_a');
        this.morphWeightsB = scope.resolve('morph_weights_b');
        this.morphPositionTex = scope.resolve('morphPositionTex');
        this.morphNormalTex = scope.resolve('morphNormalTex');
        this.morphTexParams = scope.resolve('morph_tex_params');

        // a single instance of light cube
        this.lightCube = new LightCube();
        this.constantLightCube = scope.resolve('lightCube[0]');
    }

    destroy() {
        this.shadowRenderer = null;
        this._shadowRendererLocal = null;
        this._shadowRendererDirectional = null;

        this.shadowMapCache.destroy();
        this.shadowMapCache = null;

        this._renderPassUpdateClustered.destroy();
        this._renderPassUpdateClustered = null;

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
    }

    setCameraUniforms(camera, target) {

        // flipping proj matrix
        const flipY = target?.flipY;

        let viewCount = 1;
        if (camera.xr && camera.xr.session) {
            const transform = camera._node?.parent?.getWorldTransform() || null;
            const views = camera.xr.views;
            viewCount = views.list.length;
            for (let v = 0; v < viewCount; v++) {
                const view = views.list[v];
                view.updateTransforms(transform);
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

            // camera jitter
            const { jitter } = camera;
            let jitterX = 0;
            let jitterY = 0;
            if (jitter > 0) {

                // render target size
                const targetWidth = target ? target.width : this.device.width;
                const targetHeight = target ? target.height : this.device.height;

                // offsets
                const offset = _haltonSequence[this.device.renderVersion % _haltonSequence.length];
                jitterX = jitter * (offset.x * 2 - 1) / targetWidth;
                jitterY = jitter * (offset.y * 2 - 1) / targetHeight;

                // apply offset to projection matrix
                projMat = _tempProjMat4.copy(projMat);
                projMat.data[8] = jitterX;
                projMat.data[9] = jitterY;

                // apply offset to skybox projection matrix
                projMatSkybox = _tempProjMat5.copy(projMatSkybox);
                projMatSkybox.data[8] = jitterX;
                projMatSkybox.data[9] = jitterY;

                // blue noise vec4 - only use when jitter is enabled
                if (this.blueNoiseJitterVersion !== this.device.renderVersion) {
                    this.blueNoiseJitterVersion = this.device.renderVersion;
                    this.blueNoise.vec4(this.blueNoiseJitterVec);
                }
            }

            const jitterVec = jitter > 0 ? this.blueNoiseJitterVec : Vec4.ZERO;
            this.blueNoiseJitterData[0] = jitterVec.x;
            this.blueNoiseJitterData[1] = jitterVec.y;
            this.blueNoiseJitterData[2] = jitterVec.z;
            this.blueNoiseJitterData[3] = jitterVec.w;
            this.blueNoiseJitterId.setValue(this.blueNoiseJitterData);

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

            // store matrices needed by TAA
            camera._storeShaderMatrices(viewProjMat, jitterX, jitterY, this.device.renderVersion);

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
     * from the camera if not supplied.
     * @param {boolean} [clearDepth] - True if the depth buffer should be cleared. Uses the value
     * from the camera if not supplied.
     * @param {boolean} [clearStencil] - True if the stencil buffer should be cleared. Uses the
     * value from the camera if not supplied.
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

    setupCullMode(cullFaces, flipFactor, drawCall) {
        const material = drawCall.material;
        let mode = CULLFACE_NONE;
        if (cullFaces) {
            let flipFaces = 1;

            if (material.cull === CULLFACE_FRONT || material.cull === CULLFACE_BACK) {
                flipFaces = flipFactor * drawCall.flipFacesFactor * drawCall.node.worldScaleSign;
            }

            if (flipFaces < 0) {
                mode = material.cull === CULLFACE_FRONT ? CULLFACE_BACK : CULLFACE_FRONT;
            } else {
                mode = material.cull;
            }
        }
        this.device.setCullMode(mode);

        if (mode === CULLFACE_NONE && material.cull === CULLFACE_NONE) {
            this.twoSidedLightingNegScaleFactorId.setValue(drawCall.node.worldScaleSign);
        }
    }

    updateCameraFrustum(camera) {

        if (camera.xr && camera.xr.views.list.length) {
            // calculate frustum based on XR view
            const view = camera.xr.views.list[0];
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

    /**
     * Update skin matrices ahead of rendering.
     *
     * @param {import('../mesh-instance.js').MeshInstance[]|Set<import('../mesh-instance.js').MeshInstance>} drawCalls - MeshInstances
     * containing skinInstance.
     * @ignore
     */
    updateGpuSkinMatrices(drawCalls) {
        // #if _PROFILER
        const skinTime = now();
        // #endif

        for (const drawCall of drawCalls) {
            const skin = drawCall.skinInstance;

            if (skin && skin._dirty) {
                skin.updateMatrixPalette(drawCall.node, _skinUpdateIndex);
                skin._dirty = false;
            }
        }

        // #if _PROFILER
        this._skinTime += now() - skinTime;
        // #endif
    }

    /**
     * Update morphing ahead of rendering.
     *
     * @param {import('../mesh-instance.js').MeshInstance[]|Set<import('../mesh-instance.js').MeshInstance>} drawCalls - MeshInstances
     * containing morphInstance.
     * @ignore
     */
    updateMorphing(drawCalls) {
        // #if _PROFILER
        const morphTime = now();
        // #endif

        for (const drawCall of drawCalls) {
            const morphInst = drawCall.morphInstance;
            if (morphInst && morphInst._dirty) {
                morphInst.update();
            }
        }

        // #if _PROFILER
        this._morphTime += now() - morphTime;
        // #endif
    }

    /**
     * Update gsplats ahead of rendering.
     *
     * @param {import('../mesh-instance.js').MeshInstance[]|Set<import('../mesh-instance.js').MeshInstance>} drawCalls - MeshInstances
     * containing gsplatInstances.
     * @ignore
     */
    updateGSplats(drawCalls) {
        for (const drawCall of drawCalls) {
            drawCall.gsplatInstance?.update();
        }
    }

    /**
     * Update draw calls ahead of rendering.
     *
     * @param {import('../mesh-instance.js').MeshInstance[]|Set<import('../mesh-instance.js').MeshInstance>} drawCalls - MeshInstances
     * requiring updates.
     * @ignore
     */
    gpuUpdate(drawCalls) {
        // Note that drawCalls can be either a Set or an Array and contains mesh instances
        // that are visible in this frame
        this.updateGpuSkinMatrices(drawCalls);
        this.updateMorphing(drawCalls);
        this.updateGSplats(drawCalls);
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
        const skinInstance = meshInstance.skinInstance;
        if (skinInstance) {
            this._skinDrawCalls++;

            const boneTexture = skinInstance.boneTexture;
            this.boneTextureId.setValue(boneTexture);
            this.boneTextureSizeId.setValue(skinInstance.boneTextureSize);
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

    initViewBindGroupFormat(isClustered) {

        if (this.device.supportsUniformBuffers && !this.viewUniformFormat) {

            // format of the view uniform buffer
            const uniforms = [
                new UniformFormat("matrix_viewProjection", UNIFORMTYPE_MAT4),
                new UniformFormat("cubeMapRotationMatrix", UNIFORMTYPE_MAT3),
                new UniformFormat("view_position", UNIFORMTYPE_VEC3),
                new UniformFormat("skyboxIntensity", UNIFORMTYPE_FLOAT),
                new UniformFormat("exposure", UNIFORMTYPE_FLOAT),
                new UniformFormat("textureBias", UNIFORMTYPE_FLOAT)
            ];

            if (isClustered) {
                uniforms.push(...[
                    new UniformFormat("clusterCellsCountByBoundsSize", UNIFORMTYPE_VEC3),
                    new UniformFormat("clusterTextureSize", UNIFORMTYPE_VEC3),
                    new UniformFormat("clusterBoundsMin", UNIFORMTYPE_VEC3),
                    new UniformFormat("clusterBoundsDelta", UNIFORMTYPE_VEC3),
                    new UniformFormat("clusterCellsDot", UNIFORMTYPE_VEC3),
                    new UniformFormat("clusterCellsMax", UNIFORMTYPE_VEC3),
                    new UniformFormat("clusterCompressionLimit0", UNIFORMTYPE_VEC2),
                    new UniformFormat("shadowAtlasParams", UNIFORMTYPE_VEC2),
                    new UniformFormat("clusterMaxCells", UNIFORMTYPE_INT),
                    new UniformFormat("clusterSkip", UNIFORMTYPE_FLOAT)
                ]);
            }

            this.viewUniformFormat = new UniformBufferFormat(this.device, uniforms);

            // format of the view bind group - contains single uniform buffer, and some textures
            const formats = [

                // uniform buffer needs to be first, as the shader processor assumes slot 0 for it
                new BindUniformBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT),

                new BindTextureFormat('lightsTextureFloat', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT),
                new BindTextureFormat('lightsTexture8', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT),
                new BindTextureFormat('shadowAtlasTexture', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_DEPTH),
                new BindTextureFormat('cookieAtlasTexture', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_FLOAT),

                new BindTextureFormat('areaLightsLutTex1', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_FLOAT),
                new BindTextureFormat('areaLightsLutTex2', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_FLOAT)
            ];

            if (isClustered) {
                formats.push(...[
                    new BindTextureFormat('clusterWorldTexture', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT)
                ]);
            }

            this.viewBindGroupFormat = new BindGroupFormat(this.device, formats);
        }
    }

    setupViewUniformBuffers(viewBindGroups, viewUniformFormat, viewBindGroupFormat, viewCount) {

        Debug.assert(Array.isArray(viewBindGroups), "viewBindGroups must be an array");

        const device = this.device;
        Debug.assert(viewCount === 1, "This code does not handle the viewCount yet");

        while (viewBindGroups.length < viewCount) {
            const ub = new UniformBuffer(device, viewUniformFormat, false);
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

    setupMeshUniformBuffers(shaderInstance, meshInstance) {

        const device = this.device;
        if (device.supportsUniformBuffers) {

            // TODO: model matrix setup is part of the drawInstance call, but with uniform buffer it's needed
            // earlier here. This needs to be refactored for multi-view anyways.
            this.modelMatrixId.setValue(meshInstance.node.worldTransform.data);
            this.normalMatrixId.setValue(meshInstance.node.normalMatrix.data);

            // update mesh bind group / uniform buffer
            const meshBindGroup = shaderInstance.getBindGroup(device);
            meshBindGroup.update();
            device.setBindGroup(BINDGROUP_MESH, meshBindGroup);

            const meshUniformBuffer = shaderInstance.getUniformBuffer(device);
            meshUniformBuffer.update(_dynamicBindGroup);
            device.setBindGroup(BINDGROUP_MESH_UB, _dynamicBindGroup.bindGroup, _dynamicBindGroup.offsets);
        }
    }

    drawInstance(device, meshInstance, mesh, style, normal) {

        const modelMatrix = meshInstance.node.worldTransform;
        this.modelMatrixId.setValue(modelMatrix.data);
        if (normal) {
            this.normalMatrixId.setValue(meshInstance.node.normalMatrix.data);
        }

        const instancingData = meshInstance.instancingData;
        if (instancingData) {
            if (instancingData.count > 0) {
                this._instancedDrawCalls++;
                device.setVertexBuffer(instancingData.vertexBuffer);
                device.draw(mesh.primitive[style], instancingData.count);
            } else {
                device.clearVertexBuffer();
            }
        } else {
            device.draw(mesh.primitive[style]);
        }
    }

    // used for stereo
    drawInstance2(device, meshInstance, mesh, style) {

        const instancingData = meshInstance.instancingData;
        if (instancingData) {
            if (instancingData.count > 0) {
                this._instancedDrawCalls++;
                device.draw(mesh.primitive[style], instancingData.count, true);
            } else {
                device.clearVertexBuffer();
            }
        } else {
            // matrices are already set
            device.draw(mesh.primitive[style], undefined, true);
        }
    }

    /**
     * @param {import('../camera.js').Camera} camera - The camera used for culling.
     * @param {import('../mesh-instance.js').MeshInstance[]} drawCalls - Draw calls to cull.
     * @param {import('../layer.js').CulledInstances} culledInstances - Stores culled instances.
     */
    cull(camera, drawCalls, culledInstances) {
        // #if _PROFILER
        const cullTime = now();
        // #endif

        const opaque = culledInstances.opaque;
        opaque.length = 0;
        const transparent = culledInstances.transparent;
        transparent.length = 0;

        const doCull = camera.frustumCulling;
        const count = drawCalls.length;

        for (let i = 0; i < count; i++) {
            const drawCall = drawCalls[i];
            if (drawCall.visible) {

                const visible = !doCull || !drawCall.cull || drawCall._isVisible(camera);
                if (visible) {
                    drawCall.visibleThisFrame = true;

                    // sort mesh instance into the right bucket based on its transparency
                    const bucket = drawCall.transparent ? transparent : opaque;
                    bucket.push(drawCall);

                    if (drawCall.skinInstance || drawCall.morphInstance || drawCall.gsplatInstance) {
                        this.processingMeshInstances.add(drawCall);

                        // register visible cameras
                        if (drawCall.gsplatInstance) {
                            drawCall.gsplatInstance.cameras.push(camera);
                        }
                    }
                }
            }
        }

        // #if _PROFILER
        this._cullTime += now() - cullTime;
        this._numDrawCallsCulled += doCull ? count : 0;
        // #endif
    }

    collectLights(comp) {

        // build a list and of all unique lights from all layers
        this.lights.length = 0;
        this.localLights.length = 0;

        // stats
        const stats = this.scene._stats;

        // #if _PROFILER

        stats.dynamicLights = 0;
        stats.bakedLights = 0;

        // #endif

        const count = comp.layerList.length;
        for (let i = 0; i < count; i++) {
            const layer = comp.layerList[i];

            // layer can be in the list two times (opaque, transp), process it only one time
            if (!_tempLayerSet.has(layer)) {
                _tempLayerSet.add(layer);

                const lights = layer._lights;
                for (let j = 0; j < lights.length; j++) {
                    const light = lights[j];

                    // add new light
                    if (!_tempLightSet.has(light)) {
                        _tempLightSet.add(light);

                        this.lights.push(light);

                        if (light._type !== LIGHTTYPE_DIRECTIONAL) {
                            this.localLights.push(light);
                        }

                        // #if _PROFILER

                        // if affects dynamic or baked objects in real-time
                        if ((light.mask & MASK_AFFECT_DYNAMIC) || (light.mask & MASK_AFFECT_LIGHTMAPPED)) {
                            stats.dynamicLights++;
                        }

                        // bake lights
                        if (light.mask & MASK_BAKE) {
                            stats.bakedLights++;
                        }

                        // #endif
                    }
                }
            }
        }

        stats.lights = this.lights.length;

        _tempLightSet.clear();
        _tempLayerSet.clear();
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
        for (let i = 0; i < this.localLights.length; i++) {
            const light = this.localLights[i];
            if (light._type !== LIGHTTYPE_DIRECTIONAL) {

                if (isClustered) {
                    // if atlas slot is reassigned, make sure to update the shadow map, including the culling
                    if (light.atlasSlotUpdated && light.shadowUpdateMode === SHADOWUPDATE_NONE) {
                        light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
                    }
                } else {

                    // force rendering shadow at least once to allocate the shadow map needed by the shaders
                    if (light.shadowUpdateMode === SHADOWUPDATE_NONE && light.castShadows) {
                        if (!light.getRenderData(null, 0).shadowCamera.renderTarget) {
                            light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
                        }
                    }
                }

                if (light.visibleThisFrame && light.castShadows && light.shadowUpdateMode !== SHADOWUPDATE_NONE) {
                    this._shadowRendererLocal.cull(light, comp);
                }
            }
        }

        // shadow casters culling for directional lights - start with none and collect lights for cameras
        this.cameraDirShadowLights.clear();
        const cameras = comp.cameras;
        for (let i = 0; i < cameras.length; i++) {
            const cameraComponent = cameras[i];
            if (cameraComponent.enabled) {
                const camera = cameraComponent.camera;

                // get directional lights from all layers of the camera
                let lightList;
                const cameraLayers = camera.layers;
                for (let l = 0; l < cameraLayers.length; l++) {
                    const cameraLayer = comp.getLayerById(cameraLayers[l]);
                    if (cameraLayer) {
                        const layerDirLights = cameraLayer.splitLights[LIGHTTYPE_DIRECTIONAL];

                        for (let j = 0; j < layerDirLights.length; j++) {
                            const light = layerDirLights[j];

                            // unique shadow casting lights
                            if (light.castShadows && !_tempSet.has(light)) {
                                _tempSet.add(light);

                                lightList = lightList ?? [];
                                lightList.push(light);

                                // frustum culling for the directional shadow when rendering the camera
                                this._shadowRendererDirectional.cull(light, comp, camera);
                            }
                        }
                    }
                }

                if (lightList) {
                    this.cameraDirShadowLights.set(camera, lightList);
                }

                _tempSet.clear();
            }
        }
    }

    /**
     * visibility culling of lights, meshInstances, shadows casters
     * Also applies meshInstance.visible
     *
     * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
     * composition.
     */
    cullComposition(comp) {

        // #if _PROFILER
        const cullTime = now();
        // #endif

        this.processingMeshInstances.clear();

        // for all cameras
        const numCameras = comp.cameras.length;
        for (let i = 0; i < numCameras; i++) {
            const camera = comp.cameras[i];

            let currentRenderTarget;
            let cameraChanged = true;
            this._camerasRendered++;

            // for all of its enabled layers
            const layerIds = camera.layers;
            for (let j = 0; j < layerIds.length; j++) {
                const layer = comp.getLayerById(layerIds[j]);
                if (layer && layer.enabled) {

                    // update camera and frustum when the render target changes
                    // TODO: This is done here to handle the backwards compatibility with the deprecated Layer.renderTarget,
                    // when this is no longer needed, this code can be moved up to execute once per camera.
                    const renderTarget = camera.renderTarget ?? layer.renderTarget;
                    if (cameraChanged || renderTarget !== currentRenderTarget) {
                        cameraChanged = false;
                        currentRenderTarget = renderTarget;
                        camera.frameUpdate(renderTarget);
                        this.updateCameraFrustum(camera.camera);
                    }

                    // cull each layer's non-directional lights once with each camera
                    // lights aren't collected anywhere, but marked as visible
                    this.cullLights(camera.camera, layer._lights);

                    // cull mesh instances
                    layer.onPreCull?.(comp.camerasMap.get(camera));

                    const culledInstances = layer.getCulledInstances(camera.camera);
                    this.cull(camera.camera, layer.meshInstances, culledInstances);

                    layer.onPostCull?.(comp.camerasMap.get(camera));
                }
            }
        }

        // update shadow / cookie atlas allocation for the visible lights. Update it after the ligthts were culled,
        // but before shadow maps were culling, as it might force some 'update once' shadows to cull.
        if (this.scene.clusteredLightingEnabled) {
            this.updateLightTextureAtlas();
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

    updateFrameUniforms() {
        // blue noise texture
        this.blueNoiseTextureId.setValue(getBlueNoiseTexture(this.device));
    }

    /**
     * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
     * composition to update.
     */
    beginFrame(comp) {

        const scene = this.scene;
        const updateShaders = scene.updateShaders;

        let totalMeshInstances = 0;
        const layers = comp.layerList;
        const layerCount = layers.length;
        for (let i = 0; i < layerCount; i++) {
            const layer = layers[i];

            const meshInstances = layer.meshInstances;
            const count = meshInstances.length;
            totalMeshInstances += count;

            for (let j = 0; j < count; j++) {
                const meshInst = meshInstances[j];

                // clear visibility
                meshInst.visibleThisFrame = false;

                // collect all mesh instances if we need to update their shaders. Note that there could
                // be duplicates, which is not a problem for the shader updates, so we do not filter them out.
                if (updateShaders) {
                    _tempMeshInstances.push(meshInst);
                }

                // collect skinned mesh instances
                if (meshInst.skinInstance) {
                    _tempMeshInstancesSkinned.push(meshInst);
                }
            }
        }

        // #if _PROFILER
        scene._stats.meshInstances = totalMeshInstances;
        // #endif

        // update shaders if needed
        if (updateShaders) {
            const onlyLitShaders = !scene.updateShaders;
            this.updateShaders(_tempMeshInstances, onlyLitShaders);
            scene.updateShaders = false;
            scene._shaderVersion++;
        }

        this.updateFrameUniforms();

        // Update all skin matrices to properly cull skinned objects (but don't update rendering data yet)
        this.updateCpuSkinMatrices(_tempMeshInstancesSkinned);

        // clear light arrays
        _tempMeshInstances.length = 0;
        _tempMeshInstancesSkinned.length = 0;

        // clear light visibility
        const lights = this.lights;
        const lightCount = lights.length;
        for (let i = 0; i < lightCount; i++) {
            lights[i].beginFrame();
        }
    }

    updateLightTextureAtlas() {
        this.lightTextureAtlas.update(this.localLights, this.scene.lighting);
    }

    /**
     * Updates the layer composition for rendering.
     *
     * @param {import('../composition/layer-composition.js').LayerComposition} comp - The layer
     * composition to update.
     */
    updateLayerComposition(comp) {

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
        }

        // update composition
        comp._update();

        // #if _PROFILER
        this._layerCompositionUpdateTime += now() - layerCompositionUpdateTime;
        // #endif
    }

    frameUpdate() {

        this.clustersDebugRendered = false;

        this.initViewBindGroupFormat(this.scene.clusteredLightingEnabled);

        // no valid shadows at the start of the frame
        this.dirLightShadows.clear();
    }
}

export { Renderer };
