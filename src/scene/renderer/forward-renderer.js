import { now } from '../../core/time.js';
import { Debug } from '../../core/debug.js';
import { Color } from '../../core/math/color.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import {
    FOG_NONE, FOG_LINEAR,
    LAYERID_DEPTH
} from '../constants.js';
import { LightList } from '../lighting/light-list.js';
import { WorldClustersDebug } from '../lighting/world-clusters-debug.js';
import { Renderer } from './renderer.js';
import { RenderPassForward } from './render-pass-forward.js';
import { LayerRenderStep } from './layer-render-step.js';
import { FramePassPostprocessing } from './frame-pass-postprocessing.js';
import { BINDGROUP_VIEW } from '../../platform/graphics/constants.js';
import { getSingleAttachmentBlendState } from '../../platform/graphics/blend-state-utils.js';

/**
 * @import { Camera } from '../camera.js'
 * @import { FrameGraph } from '../frame-graph.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { LayerComposition } from '../composition/layer-composition.js'
 * @import { RenderAction } from '../composition/render-action.js'
 * @import { Layer } from '../layer.js'
 * @import { MeshInstance } from '../mesh-instance.js'
 * @import { RenderTarget } from '../../platform/graphics/render-target.js'
 * @import { Scene } from '../scene.js'
 * @import { UniformBufferFormat } from '../../platform/graphics/uniform-buffer-format.js'
 * @import { WorldClusters } from '../lighting/world-clusters.js'
 */

const _noLights = new LightList();
const tmpColor = new Color();

const _drawCallList = {
    drawCalls: [],
    shaderInstances: [],
    isNewMaterial: [],

    clear: function () {
        this.drawCalls.length = 0;
        this.shaderInstances.length = 0;
        this.isNewMaterial.length = 0;
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
        const radius = Math.sqrt(weight * weight);
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
    /** @type {WorldClustersDebug|null} */
    _worldClustersDebug = null;

    /**
     * Limits how much of one render pass is drawn, for stepping through its draw calls with a
     * debugging tool. Matched by the camera and render target the pass renders with; for each layer
     * of the pass, an entry per sub-layer (opaque, transparent) gives either how many of its sorted
     * instances to draw, or `{ instance, index }` to draw up to and including that instance, found
     * by identity and falling back to the index when it was culled. Layers without an entry draw in
     * full. Only honored by the debug engine; other builds ignore it.
     *
     * @type {{ camera: Camera, renderTarget: RenderTarget|null, layers: Map<Layer, Array<number|{ instance: MeshInstance, index: number }|undefined>> }|null}
     * @ignore
     */
    debugDrawLimit = null;

    /**
     * Whether this build honors {@link debugDrawLimit}, which only the debug engine does.
     *
     * @type {boolean}
     * @ignore
     */
    debugDrawLimitSupported = false;

    /**
     * Create a new ForwardRenderer instance.
     *
     * @param {GraphicsDevice} graphicsDevice - The graphics device used by the renderer.
     * @param {Scene} scene - The scene.
     */
    constructor(graphicsDevice, scene) {
        super(graphicsDevice, scene);

        const device = this.device;

        Debug.call(() => {
            this.debugDrawLimitSupported = true;
        });

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
        this.sceneEnvAtlasId = scope.resolve('scene_envAtlas');
        this.sceneSkyboxId = scope.resolve('scene_skybox');
        this.pcssDiskSamplesId = scope.resolve('pcssDiskSamples[0]');
        this.pcssSphereSamplesId = scope.resolve('pcssSphereSamples[0]');
        this.screenSizeId = scope.resolve('screen_size');
        this.screenSizeLegacyId = scope.resolve('uScreenSize');
        this._screenSize = new Float32Array(4);

        this.fogColor = new Float32Array(3);
        this.ambientColor = new Float32Array(3);

        this.pcssDiskSamples = vogelDiskPrecalculationSamples(16);
        this.pcssSphereSamples = vogelSpherePrecalculationSamples(16);
    }

    destroy() {
        this._worldClustersDebug?.destroy();
        this._worldClustersDebug = null;
        super.destroy();
    }

    // #if _PROFILER
    // Static properties used by the Profiler in the Editor's Launch Page
    static skipRenderCamera = null;

    static _skipRenderCounter = 0;

    static skipRenderAfter = 0;
    // #endif

    /**
     * @param {Scene} scene - The scene.
     */
    dispatchGlobalLights(scene) {
        const ambientUniform = this.ambientColor;

        // color in linear space
        tmpColor.linear(scene.ambientLight);
        ambientUniform[0] = tmpColor.r;
        ambientUniform[1] = tmpColor.g;
        ambientUniform[2] = tmpColor.b;

        if (scene.physicalUnits) {
            for (let i = 0; i < 3; i++) {
                ambientUniform[i] *= scene.ambientLuminance;
            }
        }
        this.ambientId.setValue(ambientUniform);

        this.skyboxIntensityId.setValue(scene.physicalUnits ? scene.skyboxLuminance : scene.skyboxIntensity);
        this.cubeMapRotationMatrixId.setValue(scene._skyboxRotationMat3.data);

        // the scene environment textures, sampled by materials without an environment of their own
        this.sceneEnvAtlasId.setValue(scene.envAtlas);
        this.sceneSkyboxId.setValue(scene.skybox);
    }

    /**
     * Sets the uniforms of the lights of a pass, each at its light slot. The slot order is the
     * same for every mesh instance in the pass whatever its light mask selects, so this runs once
     * per pass, before the view uniform buffer is filled - the light uniforms are part of it, see
     * {@link Renderer#getViewUniformFormat} - and each shader reads its own slots. The shader
     * generator reads the same list, so the two cannot disagree about which light a slot holds.
     *
     * @param {LightList} lightList - The lights of the pass.
     * @param {Camera} camera - The camera, for the shadow data rendered for it.
     */
    dispatchLights(lightList, camera) {
        const slots = lightList.slots;
        for (let i = 0; i < slots.length; i++) {
            this.getLightSlotUniforms(i).dispatch(slots[i], camera);
        }
    }

    // execute first pass over draw calls, in order to update materials / shaders
    renderForwardPrepareMaterials(camera, renderTarget, drawCalls, lightList, layer, pass, viewUniformFormat) {

        // fog params from the scene, or overridden by the camera
        const fogParams = camera.fogParams ?? this.scene.fog;

        // camera shader params
        const shaderParams = camera.shaderParams;
        shaderParams.fog = fogParams.type;
        shaderParams.srgbRenderTarget = renderTarget?.isColorBufferSrgb(0) ?? false;    // output gamma correction is determined by the render target

        const addCall = (drawCall, shaderInstance, isNewMaterial) => {
            _drawCallList.drawCalls.push(drawCall);
            _drawCallList.shaderInstances.push(shaderInstance);
            _drawCallList.isNewMaterial.push(isNewMaterial);
        };

        // start with empty arrays
        _drawCallList.clear();

        const device = this.device;
        const scene = this.scene;
        let prevMaterial = null, prevObjDefs;

        const drawCallsCount = drawCalls.length;
        for (let i = 0; i < drawCallsCount; i++) {

            /** @type {MeshInstance} */
            const drawCall = drawCalls[i];

            // skip mesh instances that are not rendered in this shader pass (inlined bit test to
            // avoid a function call in this hot loop)
            if ((drawCall.shaderPassMask & (1 << pass)) === 0) {
                continue;
            }

            // #if _PROFILER
            if (camera === ForwardRenderer.skipRenderCamera) {
                if (ForwardRenderer._skipRenderCounter >= ForwardRenderer.skipRenderAfter) {
                    continue;
                }
                ForwardRenderer._skipRenderCounter++;
            }
            // #endif

            // Skip hardware-instanced rendering with 0 instances. When draw commands (indirect /
            // multi-draw) are bound, they are the source of truth for the number of draws and
            // per-draw instance counts, so instancingData.count must not gate the draw.
            const instancingData = drawCall.instancingData;
            if (instancingData && instancingData.count <= 0 && !drawCall.getDrawCommands(camera)) {
                continue;
            }

            drawCall.ensureMaterial(device);
            const material = drawCall.material;

            const objDefs = drawCall._shaderDefs;

            if (material && material === prevMaterial && objDefs !== prevObjDefs) {
                prevMaterial = null; // force change shader if the object uses a different variant of the same material
            }

            if (material !== prevMaterial) {
                this._materialSwitches++;
                material._scene = scene;
                material.prepareForRender(device, scene);
            }

            const shaderInstance = drawCall.getShaderInstance(pass, lightList, scene, shaderParams, viewUniformFormat);

            addCall(drawCall, shaderInstance, material !== prevMaterial);

            prevMaterial = material;
            prevObjDefs = objDefs;
        }

        return _drawCallList;
    }

    renderForwardInternal(camera, preparedCalls, pass, drawCallback, flipFaces) {
        // nothing to draw - a pass that only clears gets here
        const preparedCallsCount = preparedCalls.drawCalls.length;
        if (preparedCallsCount === 0) {
            return;
        }

        const device = this.device;
        const flipFactor = flipFaces ? -1 : 1;

        // when this pass renders the scene textures, the additional attachments of the materials whose
        // shader does not generate them need masking off
        const sceneTextures = camera.shaderParams.sceneTextures.length > 0;
        const attachmentCount = sceneTextures ? (device.renderTarget?.colorBufferCount ?? 1) : 1;

        // the masking requires independent blending - without it the blend state of the attachment 0
        // applies to all attachments, and so the materials which do not generate the scene textures
        // would write undefined values to them. Whoever sets up the scene textures has to test for
        // this capability.
        Debug.assert(attachmentCount <= 1 || device.supportsIndependentBlending,
            'Rendering the scene textures requires GraphicsDevice#supportsIndependentBlending, as the attachments of the materials which do not generate them cannot be masked off without it.');

        // multiview xr rendering
        const viewList = camera.xrActive && camera.xrViews.length ? camera.xrViews : null;

        // when the FramePassMultiView wrapper is iterating XR views, render only the active one
        // (xrCurrentViewIndex === -1 means "no wrapper active": fall back to the default behaviour
        // of rendering all views or the single non-XR view)
        const activeView = device.xrCurrentViewIndex ?? -1;
        const viewListStart = (viewList && activeView >= 0) ? activeView : 0;
        const viewListEnd = (viewList && activeView >= 0) ? activeView + 1 : (viewList ? viewList.length : 0);

        // Render the scene
        for (let i = 0; i < preparedCallsCount; i++) {

            /** @type {MeshInstance} */
            const drawCall = preparedCalls.drawCalls[i];

            // We have a mesh instance
            const newMaterial = preparedCalls.isNewMaterial[i];
            const shaderInstance = preparedCalls.shaderInstances[i];
            const material = drawCall.material;

            if (shaderInstance.shader.failed) continue;

            if (newMaterial) {

                const asyncCompile = false;
                device.setShader(shaderInstance.shader, asyncCompile);
                this.setupViewBindGroup(shaderInstance.shader);

                // Uniforms II: material - on the scope, and through the material bind group
                material.setParameters(device);
                this.setupMaterialBindGroup(material);

                this.alphaTestId.setValue(material.alphaTest);

                const blendState = (attachmentCount > 1 && !material.sceneTexturesWrite) ?
                    getSingleAttachmentBlendState(material.blendState, attachmentCount) : material.blendState;
                device.setBlendState(blendState);
                device.setDepthState(material.depthState);
                device.setAlphaToCoverage(material.alphaToCoverage);
            }

            DebugGraphics.pushGpuMarker(device, `Node: ${drawCall.node.name}, Material: ${material.name}`);

            this.setupCullModeAndFrontFace(camera._cullFaces, flipFactor, drawCall);

            const stencilFront = drawCall.stencilFront ?? material.stencilFront;
            const stencilBack = drawCall.stencilBack ?? material.stencilBack;
            device.setStencilState(stencilFront, stencilBack);

            // Uniforms II: meshInstance overrides - on the scope, and for a mesh instance that
            // overrides uniforms of the material uniform buffer, through its copy of it
            if (this.needsMaterialOverrideBindGroup(drawCall, material)) {
                this.setupMaterialOverrideBindGroup(drawCall);
            }
            drawCall.setParameters(device);

            // mesh ID - used by the picker
            device.scope.resolve('meshInstanceId').setValue(drawCall.id);

            const mesh = drawCall.mesh;
            this.setVertexBuffers(device, mesh);
            this.setMorphing(device, drawCall.morphInstance);
            this.setSkinning(device, drawCall);

            const instancingData = drawCall.instancingData;
            if (instancingData) {
                device.setVertexBuffer(instancingData.vertexBuffer);
            }

            // mesh / mesh normal matrix
            this.setMeshInstanceMatrices(drawCall, true);

            this.setupMeshUniformBuffers(shaderInstance);

            const style = drawCall.renderStyle;
            const indexBuffer = mesh.indexBuffer[style];

            drawCallback?.(drawCall, i);

            const indirectData = drawCall.getDrawCommands(camera);

            if (viewList) {
                for (let v = viewListStart; v < viewListEnd; v++) {
                    const view = viewList[v];

                    device.setViewport(view.viewport.x, view.viewport.y, view.viewport.z, view.viewport.w);

                    // per-view bind group + offset of the shader's view bind group, captured by
                    // setupViewBindGroup (the per-view scope values were set by
                    // setupViewUniformBuffers)
                    this._viewOffsetScratch[0] = this._viewBindGroupOffsets[v];
                    device.setBindGroup(BINDGROUP_VIEW, this._viewBindGroups[v], this._viewOffsetScratch);

                    const first = v === viewListStart;
                    const last = v === viewListEnd - 1;
                    device.draw(mesh.primitive[style], indexBuffer, instancingData?.count, indirectData, first, last);

                    this._forwardDrawCalls++;
                    if (drawCall.instancingData) {
                        this._instancedDrawCalls++;
                    }
                }
            } else {
                device.draw(mesh.primitive[style], indexBuffer, instancingData?.count, indirectData);

                this._forwardDrawCalls++;
                if (drawCall.instancingData) {
                    this._instancedDrawCalls++;
                }
            }

            // Unset meshInstance overrides back to material values if next draw call will use the
            // same material. The same question as the one which bound the copy of the material bind
            // group - a mesh instance whose parameters only needed splitting against a changed
            // layout has no copy to restore from, as it overrides nothing
            if (i < preparedCallsCount - 1 && !preparedCalls.isNewMaterial[i + 1]) {
                this.restoreMaterialOverrides(drawCall, material);
            }

            DebugGraphics.popGpuMarker(device);
        }
    }

    renderForward(camera, renderTarget, allDrawCalls, lightList, pass, drawCallback, layer, flipFaces, viewUniformFormat) {

        // #if _PROFILER
        const forwardStartTime = now();
        // #endif

        // run first pass over draw calls and handle material / shader updates
        const preparedCalls = this.renderForwardPrepareMaterials(camera, renderTarget, allDrawCalls, lightList, layer, pass, viewUniformFormat);

        // render mesh instances
        this.renderForwardInternal(camera, preparedCalls, pass, drawCallback, flipFaces);

        _drawCallList.clear();

        // #if _PROFILER
        this._forwardTime += now() - forwardStartTime;
        // #endif
    }

    /**
     * Forward render mesh instances on a specified layer, using a camera and a render target.
     * Shaders used are based on the shaderPass provided, with optional clustered lighting support.
     *
     * @param {Camera} camera - The camera.
     * @param {RenderTarget|undefined} renderTarget - The render target.
     * @param {Layer} layer - The layer.
     * @param {boolean} transparent - True if transparent sublayer should be rendered, opaque
     * otherwise.
     * @param {number} shaderPass - A type of shader to use during rendering.
     * @param {object} [options] - Object for passing optional arguments.
     * @param {boolean} [options.clearColor] - True if the color buffer should be cleared.
     * @param {boolean} [options.clearDepth] - True if the depth buffer should be cleared.
     * @param {boolean} [options.clearStencil] - True if the stencil buffer should be cleared.
     * @param {WorldClusters} [options.lightClusters] - The world clusters object to be used for
     * clustered lighting.
     * @param {MeshInstance[]} [options.meshInstances] - The mesh instances to be rendered. Use
     * when layer is not provided.
     * @param {LightList} [options.lightList] - The lights to render with. Use when layer is not
     * provided; none by default.
     * @param {Function} [options.drawCallback] - Function called before each mesh instance is
     * rendered, with the mesh instance as the argument.
     * @param {UniformBufferFormat} [options.viewUniformFormat] - A custom view uniform buffer
     * format to use for this layer. When not provided, the renderer's format for the lights of the
     * pass is used, see {@link Renderer#getViewUniformFormat}. The shaders are processed and the
     * view uniform buffer is set up using the same format, so they always match.
     */
    renderForwardLayer(camera, renderTarget, layer, transparent, shaderPass, options = {}) {

        const { scene } = this;
        const clusteredLightingEnabled = scene.clusteredLightingEnabled;

        this.setupViewport(camera, renderTarget);

        let visible, lightList;
        if (layer) {
            // #if _PROFILER
            const sortTime = now();
            // #endif

            layer.sortVisible(camera, transparent);

            // #if _PROFILER
            this._sortTime += now() - sortTime;
            // #endif

            const culledInstances = layer.getCulledInstances(camera);
            visible = transparent ? culledInstances.transparent : culledInstances.opaque;

            // add debug lines to visible list
            scene.immediate.onPreRenderLayer(layer, visible, transparent);

            this._worldClustersDebug?.onPreRenderLayer(layer, visible);

            // cut the list short when a debugging tool steps through this pass, after the debug
            // lines were added so the indices match what the tool saw. A copy, as the layer's own
            // list is left as culled for the tool to read
            Debug.call(() => {
                const limit = this.debugDrawLimit;
                if (limit && limit.camera === camera && limit.renderTarget === renderTarget) {
                    const entry = limit.layers.get(layer)?.[transparent ? 1 : 0];
                    if (entry !== undefined) {
                        let count = entry;
                        if (typeof entry === 'object') {
                            const found = visible.indexOf(entry.instance);
                            count = (found >= 0 ? found : entry.index) + 1;
                        }
                        visible = visible.slice(0, Math.max(0, count));
                    }
                }
            });

            // set up layer uniforms
            if (layer.requiresLightCube) {
                this.lightCube.update(scene.ambientLight, layer._lights);
                this.constantLightCube.setValue(this.lightCube.colors);
            }

            lightList = layer.getLightList(clusteredLightingEnabled);

        } else {
            visible = options.meshInstances;
            lightList = options.lightList ?? _noLights;
        }

        Debug.assert(visible, 'Either layer or options.meshInstances must be provided');

        // upload clustered lights uniforms
        if (clusteredLightingEnabled) {
            const lightClusters = options.lightClusters ?? this.worldClustersAllocator.empty;
            lightClusters.activate();

            // debug rendering of clusters
            if (layer) {
                if (!this.clustersDebugRendered && scene.lighting.debugLayer === layer.id) {
                    this.clustersDebugRendered = true;
                    this._worldClustersDebug ??= new WorldClustersDebug();
                    this._worldClustersDebug.render(lightClusters, scene);
                }
            }
        }

        // Set the not very clever global variable which is only useful when there's just one camera
        scene._activeCamera = camera;

        const fogParams = camera.fogParams ?? this.scene.fog;
        this.setFogConstants(fogParams);

        const viewList = this.setCameraUniforms(camera, renderTarget);

        // Nothing to draw and nothing to clear: leave before the per-pass work below. An empty
        // layer step is common - a layer's opaque and transparent sublayers are both enabled and
        // neither is filtered out when empty.
        const clearColor = options.clearColor ?? false;
        const clearDepth = options.clearDepth ?? false;
        const clearStencil = options.clearStencil ?? false;
        const clearing = clearColor || clearDepth || clearStencil;
        if (visible.length === 0 && !clearing) {
            return;
        }

        // Uniforms I: the lights of the pass, dispatched once - the slot order is the same for every
        // mesh instance drawn, whatever its light mask selects. They go before the view uniform
        // buffer is filled, as the light uniforms are part of it.
        this.dispatchLights(lightList, camera);

        // callers may supply a custom view uniform format, otherwise the one matching the lights of
        // the pass is used - the same format the shaders of the pass are processed against
        const viewUniformFormat = options.viewUniformFormat ?? this.getViewUniformFormat(clusteredLightingEnabled, lightList);

        // view uniforms always go through a uniform buffer (on all backends)
        this.setupViewUniformBuffers(viewUniformFormat, viewList);

        // clearing - do it after the view bind groups are set up, to avoid overriding those
        if (clearing) {
            this.clear(camera, clearColor, clearDepth, clearStencil);
        }

        // enable flip faces if either the camera has _flipFaces enabled or the render target has flipY enabled
        const flipFaces = !!(camera._flipFaces ^ renderTarget?.flipY);

        const forwardDrawCalls = this._forwardDrawCalls;
        this.renderForward(camera,
            renderTarget,
            visible,
            lightList,
            shaderPass,
            options.drawCallback ?? null,
            layer,
            flipFaces,
            viewUniformFormat);

        if (layer) {
            layer._forwardDrawCalls += this._forwardDrawCalls - forwardDrawCalls;
        }
    }

    setFogConstants(fogParams) {

        if (fogParams.type !== FOG_NONE) {

            // color in linear space
            tmpColor.linear(fogParams.color);
            const fogUniform = this.fogColor;
            fogUniform[0] = tmpColor.r;
            fogUniform[1] = tmpColor.g;
            fogUniform[2] = tmpColor.b;
            this.fogColorId.setValue(fogUniform);

            if (fogParams.type === FOG_LINEAR) {
                this.fogStartId.setValue(fogParams.start);
                this.fogEndId.setValue(fogParams.end);
            } else {
                this.fogDensityId.setValue(fogParams.density);
            }
        }
    }

    setSceneConstants() {
        const scene = this.scene;

        // Set up ambient/exposure
        this.dispatchGlobalLights(scene);

        // Set up screen size // should be RT size?
        const device = this.device;
        this._screenSize[0] = device.width;
        this._screenSize[1] = device.height;
        this._screenSize[2] = 1 / device.width;
        this._screenSize[3] = 1 / device.height;
        this.screenSizeId.setValue(this._screenSize);
        // Keep legacy shader declarations working through the non-view uniform path.
        this.screenSizeLegacyId.setValue(this._screenSize);

        this.pcssDiskSamplesId.setValue(this.pcssDiskSamples);
        this.pcssSphereSamplesId.setValue(this.pcssSphereSamples);
    }

    /**
     * Builds a frame graph for the rendering of the whole frame.
     *
     * @param {FrameGraph} frameGraph - The frame-graph that is built.
     * @param {LayerComposition} layerComposition - The layer composition used to build the frame
     * graph.
     * @ignore
     */
    buildFrameGraph(frameGraph, layerComposition) {

        const scene = this.scene;
        frameGraph.reset();

        if (scene.clusteredLightingEnabled) {

            // clustered lighting passes
            const { shadowsEnabled, cookiesEnabled } = scene.lighting;
            this._renderPassUpdateClustered.update(shadowsEnabled, cookiesEnabled, this.lights, this.localLights);
            frameGraph.addRenderPass(this._renderPassUpdateClustered);

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
            const { layer, camera } = renderAction;
            const mv = this._isMultiview(camera);

            if (renderAction.useCameraPasses)  {

                Debug.call(() => {
                    if (camera.postEffects.effects.length > 0) {
                        Debug.warnOnce(`Camera '${camera.entity.name}' uses frame passes, which are not compatible with post-effects scripts. Rendering of the post-effects is ignored, but they should not be attached to the camera.`);
                    }
                });

                // schedule frame passes from the camera, capturing them into a FramePassMultiView
                // wrapper if the camera needs per-view replication
                if (mv) frameGraph.beginMultiView(this.device);
                camera.camera.framePasses.forEach((renderPass) => {
                    frameGraph.addRenderPass(renderPass);
                });
                if (mv) frameGraph.endMultiView();

            } else {

                const isDepthLayer = layer.id === LAYERID_DEPTH;
                const isGrabPass = isDepthLayer && (camera.renderSceneColorMap || camera.renderSceneDepthMap);

                // start of block of render actions rendering to the same render target
                if (newStart) {
                    newStart = false;
                    startIndex = i;
                    renderTarget = renderAction.renderTarget;
                }

                // info about the next render action
                const nextRenderAction = renderActions[i + 1];
                const isNextLayerDepth = nextRenderAction ? (!nextRenderAction.useCameraPasses && nextRenderAction.layer.id === LAYERID_DEPTH) : false;
                const isNextLayerGrabPass = isNextLayerDepth && (camera.renderSceneColorMap || camera.renderSceneDepthMap);
                const nextNeedDirShadows = nextRenderAction ? (nextRenderAction.firstCameraUse && this.culler.cameraDirShadowLights.has(nextRenderAction.camera.camera)) : false;

                // end of the block using the same render target if the next render action uses a different render target,
                // a different camera, or needs directional shadows rendered before it or similar.
                if (!nextRenderAction || nextRenderAction.renderTarget !== renderTarget ||
                    nextRenderAction.camera !== camera ||
                    nextNeedDirShadows || isNextLayerGrabPass || isGrabPass) {

                    // render the render actions in the range
                    const isDepthOnly = isDepthLayer && startIndex === i;

                    if (mv && (camera.renderSceneColorMap || camera.renderSceneDepthMap || (renderAction.triggerPostprocess && camera?.onPostprocessing))) {
                        Debug.errorOnce('FramePassMultiView: depth/color grab passes and per-camera postprocessing are not yet supported with WebGPU stereo XR; rendering may be incorrect.');
                    }

                    if (mv) frameGraph.beginMultiView(this.device);

                    if (!isDepthOnly) {
                        this.addMainRenderPass(frameGraph, layerComposition, renderTarget, startIndex, i);
                    }

                    // depth layer triggers grab passes if enabled
                    if (isDepthLayer) {

                        if (camera.renderSceneColorMap) {
                            const colorGrabPass = camera.camera.renderPassColorGrab;
                            colorGrabPass.source = camera.renderTarget;
                            frameGraph.addRenderPass(colorGrabPass);
                        }

                        if (camera.renderSceneDepthMap) {
                            frameGraph.addRenderPass(camera.camera.renderPassDepthGrab);
                        }
                    }

                    // postprocessing
                    if (renderAction.triggerPostprocess && camera?.onPostprocessing) {
                        const renderPass = new FramePassPostprocessing(this.device, this, renderAction);
                        frameGraph.addRenderPass(renderPass);
                    }

                    if (mv) frameGraph.endMultiView();

                    newStart = true;
                }
            }
        }
    }

    /**
     * @param {any} camera - The camera component for the current render action. The XR data lives on
     * the underlying `Camera` (`CameraComponent.camera`), as `xrActive` / `xrViews`, not on the
     * component itself, so we dereference it before checking.
     * @returns {boolean} True if the camera should have its passes replicated per XR view (currently
     * gated to the WebGPU backend; other backends keep the existing single-pass multi-viewport flow).
     * @private
     */
    _isMultiview(camera) {
        const sceneCamera = camera.camera;
        return this.device.isWebGPU &&
            !!sceneCamera?.xrActive &&
            sceneCamera.xrViews.length >= 2;
    }

    /**
     * @param {FrameGraph} frameGraph - The frame graph.
     * @param {LayerComposition} layerComposition - The layer composition.
     */
    addMainRenderPass(frameGraph, layerComposition, renderTarget, startIndex, endIndex) {

        const renderPass = new RenderPassForward(this.device, layerComposition, this.scene, this);
        renderPass.init(renderTarget);

        const renderActions = layerComposition._renderActions;
        for (let i = startIndex; i <= endIndex; i++) {
            renderPass.addLayerRenderStep(this._layerRenderStepFromRenderAction(renderActions[i]));
        }

        frameGraph.addRenderPass(renderPass);
    }

    /**
     * Build a {@link LayerRenderStep} from a composition {@link RenderAction}. This is the only
     * place that bridges the internal RenderAction scheduling type to the render pass's own
     * LayerRenderStep, so neither RenderPassForward nor LayerRenderStep reference RenderAction.
     *
     * @param {RenderAction} renderAction - The composition render action.
     * @returns {LayerRenderStep} The layer render step.
     * @private
     */
    _layerRenderStepFromRenderAction(renderAction) {
        const step = new LayerRenderStep(renderAction.camera, renderAction.layer, renderAction.transparent, renderAction.renderTarget);
        step.clearColor = renderAction.clearColor;
        step.clearDepth = renderAction.clearDepth;
        step.clearStencil = renderAction.clearStencil;
        step.firstCameraUse = renderAction.firstCameraUse;
        step.lastCameraUse = renderAction.lastCameraUse;
        return step;
    }

    /**
     * @param {LayerComposition} comp - The layer composition.
     */
    update(comp) {

        this._worldClustersDebug?.frameUpdate();
        this.frameUpdate();
        this.shadowRenderer.frameUpdate();

        // update the skybox, since this might change _meshInstances
        this.scene._updateSkyMesh();

        // update layer composition
        this.updateLayerComposition(comp);

        this.collectLights(comp);

        // Single per-frame calculations
        this.beginFrame(comp);
        this.setSceneConstants();

        // update gsplat director
        this.gsplatDirector?.update(comp);

        // light visibility culling, light atlas allocation and directional shadow light collection
        // (mesh-independent, so it can run before the frame graph is built in a later refactor)
        this.culler.updateLightVisibility(comp);
    }

    /**
     * Visibility culling of mesh instances and shadow casters, followed by GPU data updates for the
     * resulting visible objects, and consuming one-shot shadow updates. Runs after the frame graph
     * has been built (which is itself after {@link ForwardRenderer#update}), so shadow-pass building
     * and shadow-caster culling have both read the shadow update mode before it is consumed here.
     *
     * @param {LayerComposition} comp - The layer composition.
     */
    cull(comp) {

        // visibility culling of meshInstances and shadow casters
        // after this the scene culling is done and script callbacks can be called to report which objects are visible
        this.culler.cullComposition(comp);

        // Dispatch gsplat directional shadow culls. Runs after cullComposition so each directional
        // light's shadow-camera frustum has been fitted, and before the frame graph renders the
        // shadow maps. Only the GPU-sort (hybrid) gsplat path uses this; the CPU-sort path self-casts.
        this.gsplatDirector?.updateShadows();

        // GPU update for visible objects requiring one
        this.gpuUpdate(this.culler.processingMeshInstances);

        // consume one-shot (THISFRAME) shadow updates - the frame graph has been built and shadow
        // casters culled, so both have read the shadow update mode before it is changed here
        this.culler.consumeOneShotShadows();
    }
}

export { ForwardRenderer };
