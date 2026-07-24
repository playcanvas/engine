import { TRACEID_RENDER_PASS_DETAIL } from '../../core/constants.js';
import { Debug } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Tracing } from '../../core/tracing.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { LayerRenderStep } from './layer-render-step.js';
import { EVENT_POSTRENDER, EVENT_POSTRENDER_LAYER, EVENT_PRERENDER, EVENT_PRERENDER_LAYER, SHADER_FORWARD } from '../constants.js';

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
     * The tone mapping setting for the render pass. In not set, setting from the camera is used.
     *
     * @type {number|undefined}
     */
    toneMapping;

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

            // when clearColorTonemapped is enabled, the clear color goes through the same color
            // pipeline as shaded pixels, using this pass's gamma / tone mapping overrides if set
            const clearColor = camera.getRenderPassClearColor(this.scene, this.toneMapping, this.gammaCorrection);
            this.setClearColor(fullSizeClearRect && step.clearColor ? clearColor : undefined);
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

            // override gamma correction and tone mapping settings
            const originalGammaCorrection = cameraComponent.gammaCorrection;
            const originalToneMapping = cameraComponent.toneMapping;
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

            // restore gamma correction and tone mapping settings
            if (this.gammaCorrection !== undefined) cameraComponent.gammaCorrection = originalGammaCorrection;
            if (this.toneMapping !== undefined) cameraComponent.toneMapping = originalToneMapping;
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
