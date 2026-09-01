import { TRACEID_RENDER_PASS_DETAIL } from '../../core/constants.js';
import { Debug } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Tracing } from '../../core/tracing.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { LayerRenderStep } from './layer-render-step.js';
import { EVENT_POSTRENDER, EVENT_POSTRENDER_LAYER, EVENT_PRERENDER, EVENT_PRERENDER_LAYER, SCENETEXTURE_DEPTH, SHADER_FORWARD, sceneTextureUniformNames } from '../constants.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { LayerComposition } from '../composition/layer-composition.js'
 * @import { Layer } from '../layer.js'
 * @import { Renderer } from './renderer.js'
 * @import { Scene } from '../scene.js'
 */

/**
 * A render pass used render a set of layers using a camera.
 *
 * @ignore
 */
class RenderPassForward extends RenderPass {
    /**
     * @type {LayerComposition}
     */
    layerComposition;

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
     * the passes which consume them, or null if it publishes none. Only the last pass rendering to the
     * render target they are attached to sets this - publishing earlier would expose an attachment of a
     * render target the remaining passes still render into, and the materials they render could then
     * sample it, which is not allowed.
     *
     * @type {CameraComponent|null}
     */
    sceneTexturesCamera = null;

    /**
     * True if this pass clears the uniforms the scene textures are published to before it renders. Only
     * the first pass rendering to the render target they are attached to sets this, and only when no
     * depth prepass has published to those uniforms already - it is what stops a material from sampling
     * a scene texture which nothing has produced yet.
     *
     * @type {boolean}
     */
    clearSceneTextures = false;

    /**
     * If true, do not clear the depth buffer before rendering, as it was already primed by a depth
     * pre-pass.
     */
    noDepthClear = false;

    constructor(device, layerComposition, scene, renderer) {
        super(device);

        this.layerComposition = layerComposition;
        this.scene = scene;
        this.renderer = renderer;
    }

    get rendersAnything() {
        return this.layerRenderSteps.length > 0;
    }

    addLayerRenderStep(layerRenderStep) {
        this.layerRenderSteps.push(layerRenderStep);
    }

    /**
     * Adds a layer to be rendered by this render pass.
     *
     * @param {CameraComponent} cameraComponent - The camera component that is used to render the
     * layers.
     * @param {Layer} layer - The layer to be added.
     * @param {boolean} transparent - True if the layer is transparent.
     * @param {boolean} autoClears - True if the render target should be cleared based on the camera
     * and layer clear flags. Defaults to true.
     */
    addLayer(cameraComponent, layer, transparent, autoClears = true) {

        Debug.assert(cameraComponent);
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
        // add directional shadow passes if needed for the cameras used in this render pass
        const { renderer, layerRenderSteps } = this;
        for (let i = 0; i < layerRenderSteps.length; i++) {
            const step = layerRenderSteps[i];
            const cameraComponent = step.cameraComponent;
            const camera = cameraComponent.camera;

            // if this camera uses directional shadow lights
            const shadowDirLights = this.renderer.culler.cameraDirShadowLights.get(camera);
            if (shadowDirLights) {

                for (let l = 0; l < shadowDirLights.length; l++) {
                    const light = shadowDirLights[l];

                    // the shadow map is not already rendered for this light
                    if (renderer.culler.dirLightShadows.get(light) !== camera) {
                        renderer.culler.dirLightShadows.set(light, camera);

                        // render the shadow before this render pass
                        const shadowPass = renderer._shadowRendererDirectional.getLightRenderPass(light, camera);
                        if (shadowPass) {
                            this.beforePasses.push(shadowPass);
                        }
                    }
                }
            }
        }
    }

    // Collect before-passes from cameras whose first render step lives in this
    // RenderPassForward. Uses the existing firstCameraUse flag (set by LayerComposition)
    // to guarantee each camera's before-passes are scheduled exactly once, even when
    // multiple RenderPassForward instances reference the same camera (e.g. CameraFrame's
    // scenePass vs afterPass). Called after updateDirectionalShadows, so camera
    // before-passes execute after the directional shadow passes and can render into the
    // freshly updated shadow maps.
    updateCameraBeforePasses() {
        for (let i = 0; i < this.layerRenderSteps.length; i++) {
            const step = this.layerRenderSteps[i];
            if (step.firstCameraUse) {
                const camera = step.cameraComponent?.camera;
                if (camera) {
                    const { beforePasses } = camera;
                    for (let j = 0; j < beforePasses.length; j++) {
                        this.beforePasses.push(beforePasses[j]);
                    }
                }
            }
        }
    }

    updateClears() {

        // based on the first render action
        const step = this.layerRenderSteps[0];
        if (step) {

            // set up clear params if the camera covers the full viewport
            const cameraComponent = step.cameraComponent;
            const camera = cameraComponent.camera;
            const fullSizeClearRect = camera.fullSizeClearRect;

            // when this pass renders the scene textures, the camera's clear color describes the scene
            // color attachment alone - the clear values of the scene texture attachments belong to
            // whoever owns them, and are left alone here
            const colorIndex = this.sceneTextures?.length ? 0 : undefined;
            this.setClearColor(fullSizeClearRect && step.clearColor ? camera.clearColor : undefined, colorIndex);
            this.setClearDepth(fullSizeClearRect && step.clearDepth && !this.noDepthClear ? camera.clearDepth : undefined);
            this.setClearStencil(fullSizeClearRect && step.clearStencil ? camera.clearStencil : undefined);
        }
    }

    frameUpdate() {
        super.frameUpdate();
        this.updateDirectionalShadows();
        this.updateCameraBeforePasses();
        this.updateClears();

        // request mesh-instance culling for the (camera, layer) pairs this pass will render, so
        // their culled lists are ready by the time the pass executes. Gated by the same isEnabled
        // check execute() uses, so a disabled sub-layer (e.g. one left in a persistent CameraFrame
        // pass) is neither culled nor rendered. The same (camera, layer) appearing as both an
        // opaque and a transparent step is de-duplicated by the request.
        const { renderer, layerComposition, layerRenderSteps } = this;
        for (let i = 0; i < layerRenderSteps.length; i++) {
            const step = layerRenderSteps[i];
            if (layerComposition.isEnabled(step.layer, step.transparent)) {
                renderer.culler.requestMeshInstanceCull(step.cameraComponent.camera, step.layer);
            }
        }
    }

    before() {
        const { layerRenderSteps } = this;

        // Clear the uniforms the scene textures are published to, so that a material sampling them
        // reports that they are not available - which is the case, as nothing has produced them for this
        // frame yet - instead of silently reading a texture this pass renders into, or one that another
        // camera published earlier in the frame. Only the first pass rendering to the render target they
        // are attached to does this, and only when no depth prepass published to those uniforms before it.
        if (this.clearSceneTextures) {
            const { scope } = this.device;
            this.sceneTextures.forEach((name) => {
                scope.resolve(sceneTextureUniformNames[name]).setValue(null);
            });
        }

        // onPreRender events
        for (let i = 0; i < layerRenderSteps.length; i++) {
            const step = layerRenderSteps[i];
            if (step.firstCameraUse) {
                this.scene.fire(EVENT_PRERENDER, step.cameraComponent);
            }
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
                const uniformName = sceneTextureUniformNames[sceneTextures[i]];
                Debug.assert(uniformName, `Scene texture '${sceneTextures[i]}' has no uniform to be published under, see sceneTextureUniformNames.`);
                const texture = renderTarget.getColorBuffer(i + 1);
                this.device.scope.resolve(uniformName).setValue(texture);

                // the uniforms are global, so the depth is recorded on the camera as well - that is what
                // anything wanting this camera's depth in particular reads, see SceneDepthReader
                if (sceneTextures[i] === SCENETEXTURE_DEPTH) {
                    this.sceneTexturesCamera.camera.publishSceneDepthMap(texture, this.device.renderVersion);
                }
            }
        }

        // onPostRender events
        for (let i = 0; i < this.layerRenderSteps.length; i++) {
            const step = this.layerRenderSteps[i];
            if (step.lastCameraUse) {
                this.scene.fire(EVENT_POSTRENDER, step.cameraComponent);
            }
        }

        // remove dynamically added before-passes (camera before-passes, shadows)
        this.beforePasses.length = 0;
    }

    /**
     * @param {LayerRenderStep} step - The layer render step.
     * @param {boolean} firstStep - True if this is the first render step in the render pass.
     */
    renderLayerRenderStep(step, firstStep) {

        const { renderer, scene } = this;
        const device = renderer.device;

        // layer
        const { layer, transparent, cameraComponent } = step;

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
            renderer.renderForwardLayer(cameraComponent.camera, renderTarget, layer, transparent,
                shaderPass, options);

            // Revert temp frame stuff
            // TODO: this should not be here, as each rendering / clearing should explicitly set up what
            // it requires (the properties are part of render pipeline on WebGPU anyways)
            device.setBlendState(BlendState.NOBLEND);
            device.setStencilState(null, null);
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

            const { layerComposition } = this;
            this.layerRenderSteps.forEach((step, index) => {

                const layer = step.layer;
                const enabled = layer.enabled && layerComposition.isEnabled(layer, step.transparent);
                const cameraComponent = step.cameraComponent;

                Debug.trace(TRACEID_RENDER_PASS_DETAIL, `    ${index}:${
                    (` Cam: ${cameraComponent ? cameraComponent.entity.name : '-'}`).padEnd(22, ' ')
                }${(` Lay: ${layer.name}`).padEnd(22, ' ')
                }${step.transparent ? ' TRANSP' : ' OPAQUE'
                }${enabled ? ' ENABLED' : ' DISABLED'
                }${(` Meshes: ${layer.meshInstances.length}`).padEnd(5, ' ')
                }${step.firstCameraUse ? ' CAM-FIRST' : ''
                }${step.lastCameraUse ? ' CAM-LAST' : ''}`
                );
            });
        }
    }
    // #endif
}

export { RenderPassForward };
