import { TRACEID_RENDER_PASS_DETAIL } from '../../core/constants.js';
import { Debug } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Tracing } from '../../core/tracing.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { SceneDepthMapHandle } from '../../platform/graphics/scene-depth-map-handle.js';
import { Layer } from '../layer.js';
import { LayerRenderStep } from './layer-render-step.js';
import { EVENT_POSTRENDER, EVENT_POSTRENDER_LAYER, EVENT_PRERENDER, EVENT_PRERENDER_LAYER, SCENETEXTURE_DEPTH, SHADER_FORWARD, sceneTextureUniformNames } from '../constants.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { FramePass } from '../../platform/graphics/frame-pass.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Camera } from '../camera.js'
 * @import { LayerComposition } from '../composition/layer-composition.js'
 * @import { Renderer } from './renderer.js'
 * @import { Scene } from '../scene.js'
 */

/**
 * A render pass rendering a set of layers with a single camera.
 *
 * A RenderPassForward cannot be nested under another one, which is among its before-passes or
 * after-passes, or among the before-passes of its camera, which it executes before itself. To
 * render the layers with another camera first, render the passes one after the other, for example
 * as the before-passes of a {@link FramePass}, or render them with a camera of a lower priority.
 *
 * @ignore
 */
class RenderPassForward extends RenderPass {
    /**
     * @type {LayerComposition}
     */
    layerComposition;

    /**
     * The camera component used to render the layers.
     *
     * @type {CameraComponent}
     */
    cameraComponent;

    /**
     * True if this is the first pass rendering its camera in the frame, set when the pass is
     * scheduled. The first pass collects the before-passes of the camera, and fires
     * {@link Scene.EVENT_PRERENDER}.
     *
     * @type {boolean}
     */
    firstCameraUse = false;

    /**
     * True if this is the last pass rendering its camera in the frame, set when the passes are
     * scheduled. The last pass fires {@link Scene.EVENT_POSTRENDER}.
     *
     * @type {boolean}
     */
    lastCameraUse = false;

    /**
     * @type {Scene}
     */
    scene;

    /**
     * @type {Renderer}
     */
    renderer;

    /**
     * @type {LayerRenderStep[]}
     */
    layerRenderSteps = [];

    /**
     * The gamma correction setting for the render pass. If not set, the setting from the camera
     * is used. This allows render passes to override the camera's gamma correction during the
     * render pass.
     *
     * For HDR pipelines, scene render passes typically set this to {@link GAMMA_NONE} to output
     * linear values to an HDR render target, while subsequent passes (like UI) leave it undefined
     * to use the camera's default {@link GAMMA_SRGB} for correct display output.
     *
     * Can be:
     * - {@link GAMMA_NONE}
     * - {@link GAMMA_SRGB}
     * - `undefined` (uses camera setting)
     *
     * @type {number|undefined}
     */
    gammaCorrection;

    /**
     * The tone mapping setting for the render pass. If not set, setting from the camera is used.
     *
     * @type {number|undefined}
     */
    toneMapping;

    /**
     * The names of the scene textures this pass renders alongside the scene color, in the order of
     * the color attachments they are rendered to. If not set, setting from the camera is used. Only
     * the passes rendering to a render target the scene textures are attached to set this, so that
     * the camera's other passes, for example the one rendering the UI to the output render target,
     * do not write them.
     *
     * @type {string[]|undefined}
     */
    sceneTextures;

    /**
     * The camera whose scene textures this pass publishes when it finishes, making them available to
     * the passes which consume them, or null if it publishes none. The last pass rendering to the
     * render target they are attached to sets this. An earlier pass can set it too, for passes
     * consuming them before the remaining passes render, but only when the next of those clears them
     * first, see {@link RenderPassForward#clearSceneTextures} - otherwise the materials the remaining
     * passes render could sample an attachment of the render target they render into, which is not
     * allowed.
     *
     * @type {Camera|null}
     */
    sceneTexturesCamera = null;

    /**
     * True if this pass clears the uniforms the scene textures are published to before it renders. The
     * first pass rendering to the render target they are attached to sets this, when no depth prepass
     * has published to those uniforms already - it is what stops a material from sampling a scene
     * texture which nothing has produced yet. A later pass sets it when an earlier one published them,
     * see {@link RenderPassForward#sceneTexturesCamera}, so that its materials do not sample the
     * attachments of the render target it renders into.
     *
     * @type {boolean}
     */
    clearSceneTextures = false;

    /**
     * If true, do not clear the depth buffer before rendering, as it was already primed by a depth
     * pre-pass.
     */
    noDepthClear = false;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {LayerComposition} layerComposition - The layer composition.
     * @param {Scene} scene - The scene.
     * @param {Renderer} renderer - The renderer.
     * @param {CameraComponent} cameraComponent - The camera component used to render the layers.
     */
    constructor(device, layerComposition, scene, renderer, cameraComponent) {
        super(device);

        Debug.assert(cameraComponent, 'RenderPassForward needs the camera component it renders the layers with.');

        this.layerComposition = layerComposition;
        this.scene = scene;
        this.renderer = renderer;
        this.cameraComponent = cameraComponent;
    }

    get rendersAnything() {
        return this.layerRenderSteps.length > 0;
    }

    addLayerRenderStep(layerRenderStep) {
        Debug.assert(layerRenderStep.cameraComponent === this.cameraComponent, 'The layer render step needs to use the camera of the RenderPassForward.');
        this.layerRenderSteps.push(layerRenderStep);
    }

    /**
     * Adds a layer to be rendered by this render pass.
     *
     * @param {Layer} layer - The layer to be added.
     * @param {boolean} transparent - True if the layer is transparent.
     * @param {boolean} autoClears - True if the render target should be cleared based on the camera
     * and layer clear flags. Defaults to true.
     */
    addLayer(layer, transparent, autoClears = true) {

        const { cameraComponent } = this;
        Debug.assert(layer instanceof Layer, 'RenderPassForward#addLayer takes the layer as its first argument. The camera component is passed to the RenderPassForward constructor.');
        Debug.assert(this.renderTarget !== undefined, 'Render pass needs to be initialized before adding layers');
        Debug.assert(cameraComponent.camera.layersSet.has(layer.id), `Camera ${cameraComponent.entity.name} does not render layer ${layer.name}.`);

        const step = new LayerRenderStep(cameraComponent, layer, transparent, this.renderTarget);

        // camera / layer clear flags
        if (autoClears) {
            const firstStep = this.layerRenderSteps.length === 0;
            step.setupClears(firstStep ? cameraComponent : undefined, layer);
        }

        this.addLayerRenderStep(step);
    }

    updateDirectionalShadows() {
        // add directional shadow passes if needed for the camera of this render pass
        const { renderer } = this;
        const camera = this.cameraComponent.camera;

        // if this camera uses directional shadow lights
        const shadowDirLights = renderer.culler.cameraDirShadowLights.get(camera);
        if (shadowDirLights) {

            for (let l = 0; l < shadowDirLights.length; l++) {
                const light = shadowDirLights[l];

                // a light with shadow bounds renders one shadow for all cameras, before the first
                // pass using it in the frame
                const shadowCamera = light._shadowBounds ? null : camera;

                // the shadow map is not already rendered for this light
                if (renderer.culler.dirLightShadows.get(light) !== shadowCamera) {
                    renderer.culler.dirLightShadows.set(light, shadowCamera);

                    // render the shadow before this render pass
                    const shadowPass = renderer._shadowRendererDirectional.getLightRenderPass(light, shadowCamera);
                    if (shadowPass) {
                        this.internalBeforePasses.push(shadowPass);
                    }
                }
            }
        }
    }

    // Mark this pass as the first and the last one rendering its camera in the frame, keeping the last
    // pass of each camera in the renderer. As no RenderPassForward is nested under another one, the
    // passes execute in the order they are scheduled in, so the flags are final when before() and
    // after() read them. A pass scheduled again, before the next frame, keeps its flags.
    updateCameraUse() {
        const lastPasses = this.renderer.cameraLastPasses;
        const camera = this.cameraComponent.camera;
        const prevPass = lastPasses.get(camera);
        if (prevPass !== this) {
            if (prevPass) {
                prevPass.lastCameraUse = false;
            }
            this.firstCameraUse = !prevPass;
            this.lastCameraUse = true;
            lastPasses.set(camera, this);
        }
    }

    // Collect the before-passes of the camera in the first pass rendering it, so they are scheduled
    // once, even when multiple RenderPassForward instances render the same camera (e.g. CameraFrame's
    // scenePass vs afterPass). Called after updateDirectionalShadows, so camera before-passes execute
    // after the directional shadow passes and can render into the freshly updated shadow maps.
    updateCameraBeforePasses() {
        if (this.firstCameraUse) {
            const { beforePasses } = this.cameraComponent.camera;
            for (let i = 0; i < beforePasses.length; i++) {
                this.internalBeforePasses.push(beforePasses[i]);
            }
        }
    }

    updateClears() {

        // based on the first render action
        const step = this.layerRenderSteps[0];
        if (step) {

            // set up clear params if the camera covers the full viewport
            const camera = this.cameraComponent.camera;
            const fullSizeClearRect = camera.fullSizeClearRect;

            // when this pass renders the scene textures, the camera's clear color describes the scene
            // color attachment alone - the clear values of the scene texture attachments belong to
            // whoever owns them, and are left alone here. Otherwise each color attachment of the
            // render target clears to the color the camera specifies for it.
            const clearColor = fullSizeClearRect && step.clearColor;
            if (this.sceneTextures?.length) {
                this.setClearColor(clearColor ? camera.clearColor : undefined, 0);
            } else {
                const count = this.colorArrayOps.length;
                for (let i = 0; i < count; i++) {
                    this.setClearColor(clearColor ? camera.getClearColor(i) : undefined, i);
                }
            }
            this.setClearDepth(fullSizeClearRect && step.clearDepth && !this.noDepthClear ? camera.clearDepth : undefined);
            this.setClearStencil(fullSizeClearRect && step.clearStencil ? camera.clearStencil : undefined);
        }
    }

    frameUpdate() {
        super.frameUpdate();

        // the passes this pass depends on in the frame (shadows, camera before-passes) are collected
        // again each time the pass is scheduled, so they do not accumulate when the pass does not
        // render. They go to the internal before-passes, so the before-passes set up by the user stay
        this.internalBeforePasses.length = 0;

        this.updateCameraUse();
        this.updateDirectionalShadows();
        this.updateCameraBeforePasses();
        this.updateClears();

        // the camera's directional shadow map is shared with the other cameras, and is rendered
        // before the passes nested under this one, which could render another camera into it
        Debug.call(() => {
            const findForwardPass = (passes) => {
                for (let i = 0; i < passes.length; i++) {
                    const pass = passes[i];
                    const found = pass instanceof RenderPassForward ? pass :
                        findForwardPass(pass.internalBeforePasses) ?? findForwardPass(pass.beforePasses) ?? findForwardPass(pass.afterPasses);
                    if (found) {
                        return found;
                    }
                }
                return null;
            };
            const nested = findForwardPass(this.internalBeforePasses) ?? findForwardPass(this.beforePasses) ?? findForwardPass(this.afterPasses);
            Debug.assert(!nested, `The RenderPassForward rendering camera '${this.cameraComponent.entity.name}' has a RenderPassForward nested under it, among its before-passes or after-passes, or the before-passes of its camera, which is not supported. Render the passes one after the other instead, for example as the before-passes of a FramePass.`, this);
        });

        // Per step, request the frame setup its layer needs so it is ready when the pass executes:
        // under clustered lighting, a light cluster for the layer (shared between steps with the same
        // light set); and mesh-instance culling for the (camera, layer) pairs this pass renders,
        // gated by the same isEnabled check execute() uses so a disabled sub-layer (e.g. one left in
        // a persistent CameraFrame pass) is neither culled nor rendered. The same (camera, layer) as
        // both an opaque and a transparent step is de-duplicated by each request.
        const { renderer, scene, layerComposition, layerRenderSteps } = this;
        const camera = this.cameraComponent.camera;
        const clusteredLightingEnabled = scene.clusteredLightingEnabled;
        for (let i = 0; i < layerRenderSteps.length; i++) {
            const step = layerRenderSteps[i];

            if (clusteredLightingEnabled) {
                renderer.worldClustersAllocator.request(step);
            }

            if (layerComposition.isEnabled(step.layer, step.transparent)) {
                renderer.culler.requestMeshInstanceCull(camera, step.layer);
            }
        }
    }

    before() {

        // Clear the uniforms the scene textures are published to, so that a material sampling them
        // reports that they are not available - which is the case, as nothing has produced them for this
        // frame yet - instead of silently reading a texture this pass renders into, or one that another
        // camera published earlier in the frame. Only the first pass rendering to the render target they
        // are attached to does this, and only when no depth prepass published to those uniforms before it.
        if (this.clearSceneTextures) {
            const { device } = this;
            this.sceneTextures.forEach((name) => {
                if (name === SCENETEXTURE_DEPTH) {
                    SceneDepthMapHandle.setUniform(device, null);
                } else {
                    device.scope.resolve(sceneTextureUniformNames[name]).setValue(null);
                }
            });
        }

        // onPreRender event
        if (this.firstCameraUse) {
            this.scene.fire(EVENT_PRERENDER, this.cameraComponent);
        }
    }

    execute() {
        const { layerComposition, layerRenderSteps } = this;
        for (let i = 0; i < layerRenderSteps.length; i++) {
            const step = layerRenderSteps[i];
            const layer = step.layer;

            Debug.call(() => {
                const compLayer = layerComposition.getLayerByName(layer.name);
                if (!compLayer) {
                    Debug.warnOnce(`Layer ${layer.name} is not found in the scene and will not be rendered. Your render pass setup might need to be updated.`);
                }
            });

            if (layerComposition.isEnabled(layer, step.transparent)) {
                this.renderLayerRenderStep(step, i === 0);
            }
        }
    }

    after() {

        // Publish the scene textures this pass rendered, making them available to the passes which
        // consume them. This happens before the events below, so that a handler reading them sees the
        // ones from this frame. Note that the depth prepass publishes its own depth to the same
        // uniform, from its own after - the two are producers of the same thing, and this pass runs
        // later, so the scene texture depth, which additionally covers the blended geometry, is what
        // the consumers sample.
        const sceneTextures = this.sceneTextures;
        if (this.sceneTexturesCamera && sceneTextures?.length) {
            const { renderTarget } = this;
            Debug.assert(renderTarget.colorBufferCount > sceneTextures.length,
                'The render target of a pass rendering the scene textures needs an attachment for each of them, in addition to the one holding the scene color.');

            for (let i = 0; i < sceneTextures.length; i++) {
                const name = sceneTextures[i];
                const texture = renderTarget.getColorBuffer(i + 1);

                if (name === SCENETEXTURE_DEPTH) {
                    // the depth is published for the camera, as well as to the global uniform. The
                    // sceneTexturesPS chunk always writes the reciprocal of the linear depth
                    this.sceneTexturesCamera.publishSceneDepthMap(texture, this.device.renderVersion, true, false, true, renderTarget.flipY);
                } else {
                    const uniformName = sceneTextureUniformNames[name];
                    Debug.assert(uniformName, `Scene texture '${name}' has no uniform to be published under, see sceneTextureUniformNames.`);
                    this.device.scope.resolve(uniformName).setValue(texture);
                }
            }
        }

        // onPostRender event
        if (this.lastCameraUse) {
            this.scene.fire(EVENT_POSTRENDER, this.cameraComponent);
        }
    }

    /**
     * @param {LayerRenderStep} step - The layer render step.
     * @param {boolean} firstStep - True if this is the first render step in the render pass.
     */
    renderLayerRenderStep(step, firstStep) {

        const { renderer, scene } = this;
        const device = renderer.device;

        // layer
        const { layer, transparent } = step;
        const { cameraComponent } = this;

        DebugGraphics.pushGpuMarker(this.device, `Camera: ${cameraComponent ? cameraComponent.entity.name : 'Unnamed'}, Layer: ${layer.name}(${transparent ? 'TRANSP' : 'OPAQUE'})`);

        // #if _PROFILER
        const drawTime = now();
        // #endif

        if (cameraComponent) {

            // override gamma correction, tone mapping and scene texture settings
            const originalGammaCorrection = cameraComponent.gammaCorrection;
            const originalToneMapping = cameraComponent.toneMapping;
            const originalSceneTextures = cameraComponent.shaderParams.sceneTextures;
            if (this.sceneTextures !== undefined) cameraComponent.shaderParams.sceneTextures = this.sceneTextures;
            if (this.gammaCorrection !== undefined) cameraComponent.gammaCorrection = this.gammaCorrection;
            if (this.toneMapping !== undefined) cameraComponent.toneMapping = this.toneMapping;

            // layer pre render event
            scene.fire(EVENT_PRERENDER_LAYER, cameraComponent, layer, transparent);

            const options = {
                lightClusters: step.lightClusters
            };

            // shader pass - use setting from camera if available, otherwise forward
            const shaderPass = cameraComponent.camera.shaderPassInfo?.index ?? SHADER_FORWARD;

            // if this is not a first render action to the render target, or if the render target was not
            // fully cleared on pass start, we need to execute clears here
            if (!firstStep || !cameraComponent.camera.fullSizeClearRect) {
                options.clearColor = step.clearColor;
                options.clearDepth = step.clearDepth;
                options.clearStencil = step.clearStencil;

                // unlike the clear of the render pass itself, this clear is not attachment aware - it
                // clears all the color attachments of the render target, and so would also clear the
                // scene textures, which this pass does not own the content of
                Debug.assert(!(options.clearColor && this.sceneTextures?.length),
                    'Clearing the color inside a render pass which renders the scene textures is not supported, as the clear would also clear those. This happens when the camera does not clear the whole render target, or when it is not the first one rendering to it.', this);
            }

            const renderTarget = step.renderTarget ?? device.backBuffer;

            // splats are blended into every sample of a multisampled target, which makes them several
            // times more expensive to render
            Debug.call(() => {
                if (renderTarget?.samples > 1 && layer.gsplatPlacements.length > 0) {
                    Debug.warnOnce(`Gaussian splats on layer '${layer.name}' are rendered into the multisampled render target '${renderTarget.name}' (${renderTarget.samples} samples), which makes them several times more expensive to render. Render them into a single-sampled target: create the graphics device with antialias set to false, or use a CameraFrame with rendering.samples set to 1.`);
                }
            });

            renderer.renderForwardLayer(cameraComponent.camera, renderTarget, layer, transparent,
                shaderPass, options);

            // Revert temp frame stuff
            // TODO: this should not be here, as each rendering / clearing should explicitly set up what
            // it requires (the properties are part of render pipeline on WebGPU anyway)
            device.setDrawStates();
            device.setAlphaToCoverage(false);

            // layer post render event
            scene.fire(EVENT_POSTRENDER_LAYER, cameraComponent, layer, transparent);

            // restore gamma correction, tone mapping and scene texture settings
            if (this.gammaCorrection !== undefined) cameraComponent.gammaCorrection = originalGammaCorrection;
            if (this.toneMapping !== undefined) cameraComponent.toneMapping = originalToneMapping;
            if (this.sceneTextures !== undefined) cameraComponent.shaderParams.sceneTextures = originalSceneTextures;
        }

        DebugGraphics.popGpuMarker(this.device);

        // #if _PROFILER
        layer._renderTime += now() - drawTime;
        // #endif
    }

    // #if _DEBUG
    log(device, index) {
        super.log(device, index);

        if (Tracing.get(TRACEID_RENDER_PASS_DETAIL)) {

            const { layerComposition, cameraComponent, layerRenderSteps } = this;
            layerRenderSteps.forEach((step, index) => {

                const layer = step.layer;
                const enabled = layer.enabled && layerComposition.isEnabled(layer, step.transparent);

                Debug.trace(TRACEID_RENDER_PASS_DETAIL, `    ${index}:${
                    (` Cam: ${cameraComponent.entity.name}`).padEnd(22, ' ')
                }${(` Lay: ${layer.name}`).padEnd(22, ' ')
                }${step.transparent ? ' TRANSP' : ' OPAQUE'
                }${enabled ? ' ENABLED' : ' DISABLED'
                }${(` Meshes: ${layer.meshInstances.length}`).padEnd(5, ' ')
                }${index === 0 && this.firstCameraUse ? ' CAM-FIRST' : ''
                }${index === layerRenderSteps.length - 1 && this.lastCameraUse ? ' CAM-LAST' : ''}`
                );
            });
        }
    }
    // #endif
}

export { RenderPassForward };
