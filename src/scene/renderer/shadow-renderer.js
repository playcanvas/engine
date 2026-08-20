import { Debug } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Color } from '../../core/math/color.js';
import { math } from '../../core/math/math.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import {
    SEMANTIC_POSITION,
    UNIFORMTYPE_MAT4
} from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { drawQuadWithShader } from '../graphics/quad-render-utils.js';
import {
    BLUR_GAUSSIAN,
    EVENT_POSTCULL,
    EVENT_PRECULL,
    LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI,
    SHADOWCAMERA_NAME,
    SHADOWUPDATE_NONE,
    shadowTypeInfo
} from '../constants.js';
import { ShaderPass } from '../shader-pass.js';
import { ShaderUtils } from '../shader-lib/shader-utils.js';
import { LightCamera } from './light-camera.js';
import { UniformBufferFormat, UniformFormat } from '../../platform/graphics/uniform-buffer-format.js';
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

// per-face scratch state for the omni cull - the visible caster list and the shadow camera of each
// of the six cube map faces of the light currently being culled
const _faceLists = [];
const _faceCameras = [];

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
     * Reusable list of shadow caster arrays, see {@link ShadowRenderer#_collectCasterLists}.
     *
     * @type {MeshInstance[][]}
     * @private
     */
    _casterLists = [];

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

        // format of the view uniform buffer
        this.viewUniformFormat = null;

        // blend states
        this.blendStateWrite = new BlendState();
        this.blendStateNoWrite = new BlendState();
        this.blendStateNoWrite.setColorWrite(false, false, false, false);
    }

    // creates shadow camera for a light and sets up its constant properties
    static createShadowCamera(device, shadowType, type, face) {

        const shadowCam = LightCamera.create(device, SHADOWCAMERA_NAME, type, face);

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

        // event before culling - the camera is null as this is internal (shadow) culling rather
        // than culling for a user camera
        this.renderer.scene?.fire(EVENT_PRECULL, null);

        visible.length = 0;

        const casterLists = this._collectCasterLists(comp, light, casters);
        for (let i = 0; i < casterLists.length; i++) {
            this._cullShadowCastersInternal(casterLists[i], visible, camera);
        }

        // this sorts the shadow casters by the shader id
        visible.sort(this.sortCompareShader);

        // event after culling - the camera is null as this is internal (shadow) culling rather
        // than culling for a user camera
        this.renderer.scene?.fire(EVENT_POSTCULL, null);
    }

    /**
     * Collects the lists of shadow casters used by the light: either the supplied array of casters,
     * or the shadow casters of each layer the light is part of.
     *
     * @param {LayerComposition} comp - The layer composition used as a source of shadow casters,
     * if those are not provided directly.
     * @param {Light} light - The light.
     * @param {MeshInstance[]} [casters] - Optional array of mesh instances to use as casters.
     * @returns {MeshInstance[][]} The lists of shadow casters. This is reused between calls, and so
     * is only valid until the next call.
     * @private
     */
    _collectCasterLists(comp, light, casters) {

        const lists = this._casterLists;
        lists.length = 0;

        // if the casters are supplied, use them
        if (casters) {

            lists.push(casters);

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

                        lists.push(layer.shadowCasters);
                    }
                }
            }

            tempSet.clear();
        }

        return lists;
    }

    /**
     * Culls the shadow casters used by an omni light against all six of its cube map faces in a
     * single pass over the casters, storing the visible mesh instances in the per-face light render
     * data. This replaces one full pass over the casters per face.
     *
     * The six shadow cameras of an omni light are axis aligned in world space - see
     * {@link LightCamera.pointLightRotations}, and note that {@link ShadowRendererLocal#cull} only
     * sets the position of an omni light's shadow cameras, never their rotation. Light space is
     * therefore world space translated by the light position, and each face's frustum is bounded by
     * a near and a far plane perpendicular to the face axis, plus four side planes through the
     * light position with the slope of the face's field of view. Testing a caster's bounding sphere
     * against those planes in light space is a handful of comparisons per face, and uses the same
     * planes {@link Frustum#containsAabb} would, so the result is the same set of casters (up to
     * the slab rejection below, which is tighter than a plane test near the frustum corners).
     *
     * @param {LayerComposition} comp - The layer composition used as a source of shadow casters,
     * if those are not provided directly.
     * @param {Light} light - The omni light.
     * @param {MeshInstance[]} [casters] - Optional array of mesh instances to use as casters.
     */
    cullShadowCastersOmni(comp, light, casters) {

        Debug.assert(light._type === LIGHTTYPE_OMNI);

        // event before culling - the camera is null as this is internal (shadow) culling rather
        // than culling for a user camera
        this.renderer.scene?.fire(EVENT_PRECULL, null);

        // per-face visible caster lists and shadow cameras
        for (let face = 0; face < 6; face++) {
            const lightRenderData = light.getRenderData(null, face);
            const visible = lightRenderData.visibleCasters;
            visible.length = 0;
            _faceLists[face] = visible;
            _faceCameras[face] = lightRenderData.shadowCamera;
        }

        // light space is world space translated by the light position
        const lightPos = light._node.getPosition();
        const lightX = lightPos.x;
        const lightY = lightPos.y;
        const lightZ = lightPos.z;

        // face frustum planes, shared by all six faces: the near and far planes are perpendicular to
        // the face axis, and the four side planes have the slope of the face's field of view - which
        // is slightly wider than 90 degrees when rendering to the shadow atlas
        const shadowCam = _faceCameras[0];
        const near = shadowCam.nearClip;
        const far = shadowCam.farClip;
        const slope = Math.tan(shadowCam.fov * 0.5 * math.DEG_TO_RAD);

        // The union of the six face frusta is bounded by the axis aligned cube of this half side.
        // Note that this is larger than the light's range: each face's far plane is perpendicular to
        // the face axis, so the corners of the frusta stick out past the range sphere, and rejecting
        // against a sphere here would wrongly drop casters in those corners.
        const bounds = far * slope;

        Debug.call(() => {
            // the face order the light space classification below relies on
            const axes = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
            for (let face = 0; face < 6; face++) {
                const forward = _faceCameras[face]._node.forward;
                const axis = axes[face];
                Debug.assert(Math.abs(forward.x - axis[0]) < 1e-4 &&
                    Math.abs(forward.y - axis[1]) < 1e-4 &&
                    Math.abs(forward.z - axis[2]) < 1e-4,
                `Omni shadow face ${face} is not aligned to the expected world axis ${axis}, the culling in cullShadowCastersOmni does not apply.`);
            }
        });

        const casterLists = this._collectCasterLists(comp, light, casters);
        for (let listIndex = 0; listIndex < casterLists.length; listIndex++) {

            const meshInstances = casterLists[listIndex];
            const numInstances = meshInstances.length;
            for (let i = 0; i < numInstances; i++) {

                const meshInstance = meshInstances[i];
                if (!meshInstance.castShadow) {
                    continue;
                }

                // mesh instances with culling disabled are visible in all faces, and those with a
                // custom visibility function need to evaluate it for each face's shadow camera
                if (!meshInstance.cull || meshInstance.isVisibleFunc) {
                    for (let face = 0; face < 6; face++) {
                        if (!meshInstance.cull || meshInstance._isVisible(_faceCameras[face])) {
                            meshInstance.visibleThisFrame = true;
                            _faceLists[face].push(meshInstance);
                        }
                    }
                    continue;
                }

                if (!meshInstance.visible) {
                    continue;
                }

                // caster's bounding box in light space
                const center = meshInstance.aabb.center;    // this line evaluates aabb
                const halfExtents = meshInstance._aabb.halfExtents;
                const ex = halfExtents.x;
                const ey = halfExtents.y;
                const ez = halfExtents.z;
                const x = center.x - lightX;
                const y = center.y - lightY;
                const z = center.z - lightZ;

                // reject casters outside the bounds of all six faces
                if (x > bounds + ex || x < -bounds - ex ||
                    y > bounds + ey || y < -bounds - ey ||
                    z > bounds + ez || z < -bounds - ez) {
                    continue;
                }

                // A box is outside a plane when its signed distance is no greater than minus its
                // extent along the plane normal. For a face with axial extent ea and lateral extents
                // eu and ev that gives: axial + ea > near, axial - ea < far, and
                // (slope * axial -+ lateral) > -(slope * ea + e_lateral). The 1 / sqrt(1 + slope^2)
                // that normalizes the side plane normals cancels on both sides, so it is dropped.
                const slopeX = slope * x;
                const slopeY = slope * y;
                const slopeZ = slope * z;

                // side plane limits, shared by the two faces of each axis
                const limXY = -(slope * ex + ey);
                const limXZ = -(slope * ex + ez);
                const limYX = -(slope * ey + ex);
                const limYZ = -(slope * ey + ez);
                const limZX = -(slope * ez + ex);
                const limZY = -(slope * ez + ey);
                let visible = false;

                // +X
                if (x + ex > near && x - ex < far &&
                    slopeX - y > limXY && slopeX + y > limXY &&
                    slopeX - z > limXZ && slopeX + z > limXZ) {
                    _faceLists[0].push(meshInstance);
                    visible = true;
                }

                // -X
                if (-x + ex > near && -x - ex < far &&
                    -slopeX - y > limXY && -slopeX + y > limXY &&
                    -slopeX - z > limXZ && -slopeX + z > limXZ) {
                    _faceLists[1].push(meshInstance);
                    visible = true;
                }

                // +Y
                if (y + ey > near && y - ey < far &&
                    slopeY - x > limYX && slopeY + x > limYX &&
                    slopeY - z > limYZ && slopeY + z > limYZ) {
                    _faceLists[2].push(meshInstance);
                    visible = true;
                }

                // -Y
                if (-y + ey > near && -y - ey < far &&
                    -slopeY - x > limYX && -slopeY + x > limYX &&
                    -slopeY - z > limYZ && -slopeY + z > limYZ) {
                    _faceLists[3].push(meshInstance);
                    visible = true;
                }

                // +Z
                if (z + ez > near && z - ez < far &&
                    slopeZ - x > limZX && slopeZ + x > limZX &&
                    slopeZ - y > limZY && slopeZ + y > limZY) {
                    _faceLists[4].push(meshInstance);
                    visible = true;
                }

                // -Z
                if (-z + ez > near && -z - ez < far &&
                    -slopeZ - x > limZX && -slopeZ + x > limZX &&
                    -slopeZ - y > limZY && -slopeZ + y > limZY) {
                    _faceLists[5].push(meshInstance);
                    visible = true;
                }

                if (visible) {
                    meshInstance.visibleThisFrame = true;
                }
            }
        }

        // this sorts the shadow casters by the shader id
        for (let face = 0; face < 6; face++) {
            _faceLists[face].sort(this.sortCompareShader);
            _faceLists[face] = null;
            _faceCameras[face] = null;
        }

        // event after culling - the camera is null as this is internal (shadow) culling rather
        // than culling for a user camera
        this.renderer.scene?.fire(EVENT_POSTCULL, null);
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
        const shadowPass = this.getShadowPass(light);
        const cameraShaderParams = camera.shaderParams;

        // reverse face culling when shadow map has flipY set to true which cases reversed winding order
        const flipFactor = camera.renderTarget.flipY ? -1 : 1;

        // Render
        const count = visibleCasters.length;
        for (let i = 0; i < count; i++) {
            const meshInstance = visibleCasters[i];
            const mesh = meshInstance.mesh;

            // Skip hardware-instanced rendering with 0 instances. When draw commands (indirect /
            // multi-draw) are bound, they are the source of truth for the number of draws and
            // per-draw instance counts, so instancingData.count must not gate the draw.
            const instancingData = meshInstance.instancingData;
            if (instancingData && instancingData.count <= 0 && !meshInstance.getDrawCommands(camera)) {
                continue;
            }

            meshInstance.ensureMaterial(device);
            const material = meshInstance.material;

            DebugGraphics.pushGpuMarker(device, `Node: ${meshInstance.node.name}, Material: ${material.name}`);

            // set basic material states/parameters
            renderer.setBaseConstants(device, material);
            renderer.setSkinning(device, meshInstance);

            material.prepareForRender(device, scene);

            renderer.setupCullModeAndFrontFace(true, flipFactor, meshInstance);

            // Uniforms I (shadow): material
            material.setParameters(device);

            // Uniforms II (shadow): meshInstance overrides
            meshInstance.setParameters(device);

            const shaderInstance = meshInstance.getShaderInstance(shadowPass, 0, scene, cameraShaderParams, this.viewUniformFormat);
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

    // Pure predicate - whether the light needs its shadow rendered this frame. Has no side effects:
    // the SHADOWUPDATE_THISFRAME -> SHADOWUPDATE_NONE consume and the shadow-map-update stat are
    // applied once per frame in Renderer#consumeOneShotShadows, after the frame graph is built and
    // shadow casters are culled (so build and cull can both read shadowUpdateMode before it changes).
    needsShadowRendering(light) {
        return light.enabled && light.castShadows && light.shadowUpdateMode !== SHADOWUPDATE_NONE && light.visibleThisFrame;
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

    renderFace(light, camera, face, clear) {

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

        // view uniforms always go through a uniform buffer (on all backends)
        renderer.setupViewUniformBuffers(this.viewUniformFormat, null);

        renderer.setupViewport(shadowCam, rt);

        // clear here is used to clear a viewport inside render target.
        if (clear) {
            renderer.clear(shadowCam);
        }

        this.setupRenderState(device, light);

        // render mesh instances
        this.submitCasters(lightRenderData.visibleCasters, light, shadowCam);

        DebugGraphics.popGpuMarker(device);

        // #if _PROFILER
        renderer._shadowMapTime += now() - shadowMapStartTime;
        // #endif
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

    initViewUniformFormat() {

        // view uniforms always go through a uniform buffer (on all backends)
        if (!this.viewUniformFormat) {

            // format of the view uniform buffer
            this.viewUniformFormat = new UniformBufferFormat(this.device, [
                new UniformFormat('matrix_viewProjection', UNIFORMTYPE_MAT4)
            ]);
        }
    }

    frameUpdate() {
        this.initViewUniformFormat();
    }
}

export { ShadowRenderer };
