import { TRACEID_RENDER_PASS_DETAIL } from "../../core/constants.js";
import { Debug } from "../../core/debug.js";
import { now } from "../../core/time.js";
import { Tracing } from "../../core/tracing.js";

import { BlendState } from "../../platform/graphics/blend-state.js";
import { DebugGraphics } from "../../platform/graphics/debug-graphics.js";
import { RenderPass } from "../../platform/graphics/render-pass.js";
import { RenderAction } from "../composition/render-action.js";
import { SHADER_FORWARD } from "../constants.js";

/**
 * A render pass used render a set of layers using a camera.
 *
 * @ignore
 */
class RenderPassForward extends RenderPass {
    /**
     * @type {import('../composition/layer-composition.js').LayerComposition}
     */
    layerComposition;

    /**
     * @type {import('../scene.js').Scene}
     */
    scene;

    /**
     * @type {import('./renderer.js').Renderer}
     */
    renderer;

    /**
     * @type {import('../composition/render-action.js').RenderAction[]}
     */
    renderActions = [];

    /**
     * If true, do not clear the depth buffer before rendering, as it was already primed by a depth
     * pre-pass.
     *
     * @type {boolean}
     */
    noDepthClear = false;

    constructor(device, layerComposition, scene, renderer) {
        super(device);

        this.layerComposition = layerComposition;
        this.scene = scene;
        this.renderer = renderer;
    }

    addRenderAction(renderAction) {
        this.renderActions.push(renderAction);
    }

    /**
     * Adds a layer to be rendered by this render pass.
     *
     * @param {import('../../framework/components/camera/component.js').CameraComponent} cameraComponent -
     * The camera component that is used to render the layers.
     * @param {import('../layer.js').Layer} layer - The layer to be added.
     * @param {boolean} transparent - True if the layer is transparent.
     * @param {boolean} autoClears - True if the render target should be cleared based on the camera
     * and layer clear flags. Defaults to true.
     */
    addLayer(cameraComponent, layer, transparent, autoClears = true) {

        Debug.assert(cameraComponent);
        Debug.assert(this.renderTarget !== undefined, `Render pass needs to be initialized before adding layers`);
        Debug.assert(cameraComponent.camera.layersSet.has(layer.id), `Camera ${cameraComponent.entity.name} does not render layer ${layer.name}.`);

        const ra = new RenderAction();
        ra.renderTarget = this.renderTarget;
        ra.camera = cameraComponent;
        ra.layer = layer;
        ra.transparent = transparent;

        // camera / layer clear flags
        if (autoClears) {
            const firstRa = this.renderActions.length === 0;
            ra.setupClears(firstRa ? cameraComponent : undefined, layer);
        }

        this.addRenderAction(ra);
    }

    /**
     * Adds layers to be rendered by this render pass, starting from the given index of the layer
     * in the layer composition, till the end of the layer list, or till the last layer with the
     * given id and transparency is reached (inclusive). Note that only layers that are enabled
     * and are rendered by the specified camera are added.
     *
     * @param {import('../composition/layer-composition.js').LayerComposition} composition - The
     * layer composition containing the layers to be added, typically the scene layer composition.
     * @param {import('../../framework/components/camera/component.js').CameraComponent} cameraComponent -
     * The camera component that is used to render the layers.
     * @param {number} startIndex - The index of the first layer to be considered for adding.
     * @param {boolean} firstLayerClears - True if the first layer added should clear the render
     * target.
     * @param {number} [lastLayerId] - The id of the last layer to be added. If not specified, all
     * layers till the end of the layer list are added.
     * @param {boolean} [lastLayerIsTransparent] - True if the last layer to be added is transparent.
     * Defaults to true.
     * @returns {number} Returns the index of last layer added.
     */
    addLayers(composition, cameraComponent, startIndex, firstLayerClears, lastLayerId, lastLayerIsTransparent = true) {

        const { layerList, subLayerEnabled, subLayerList } = composition;
        let clearRenderTarget = firstLayerClears;

        let index = startIndex;
        while (index < layerList.length) {

            const layer = layerList[index];
            const isTransparent = subLayerList[index];
            const enabled = layer.enabled && subLayerEnabled[index];
            const renderedbyCamera = cameraComponent.camera.layersSet.has(layer.id);

            // add it for rendering
            if (enabled && renderedbyCamera) {
                this.addLayer(cameraComponent, layer, isTransparent, clearRenderTarget);
                clearRenderTarget = false;
            }

            index++;

            // stop at last requested layer
            if (layer.id === lastLayerId && isTransparent === lastLayerIsTransparent) {
                break;
            }
        }

        return index;
    }

    updateDirectionalShadows() {
        // add directional shadow passes if needed for the cameras used in this render pass
        const { renderer, renderActions } = this;
        for (let i = 0; i < renderActions.length; i++) {
            const renderAction = renderActions[i];
            const cameraComp = renderAction.camera;
            const camera = cameraComp.camera;

            // if this camera uses directional shadow lights
            const shadowDirLights = this.renderer.cameraDirShadowLights.get(camera);
            if (shadowDirLights) {

                for (let l = 0; l < shadowDirLights.length; l++) {
                    const light = shadowDirLights[l];

                    // the the shadow map is not already rendered for this light
                    if (renderer.dirLightShadows.get(light) !== camera) {
                        renderer.dirLightShadows.set(light, camera);

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

    updateClears() {

        // based on the first render action
        const renderAction = this.renderActions[0];
        if (renderAction) {

            // set up clear params if the camera covers the full viewport
            const cameraComponent = renderAction.camera;
            const camera = cameraComponent.camera;
            const fullSizeClearRect = camera.fullSizeClearRect;

            this.setClearColor(fullSizeClearRect && renderAction.clearColor ? camera.clearColor : undefined);
            this.setClearDepth(fullSizeClearRect && renderAction.clearDepth && !this.noDepthClear ? camera.clearDepth : undefined);
            this.setClearStencil(fullSizeClearRect && renderAction.clearStencil ? camera.clearStencil : undefined);
        }
    }

    frameUpdate() {
        super.frameUpdate();
        this.updateDirectionalShadows();
        this.updateClears();
    }

    before() {
        const { renderActions } = this;
        if (renderActions.length) {

            // callback on the camera component before rendering with this camera for the first time
            const ra = renderActions[0];
            if (ra.camera.onPreRender && ra.firstCameraUse) {
                ra.camera.onPreRender();
            }
        }
    }

    execute() {
        const { layerComposition, renderActions } = this;
        for (let i = 0; i < renderActions.length; i++) {
            const ra = renderActions[i];
            if (layerComposition.isEnabled(ra.layer, ra.transparent)) {
                this.renderRenderAction(ra, i === 0);
            }
        }
    }

    after() {
        const { renderActions } = this;
        if (renderActions.length) {
            // callback on the camera component when we're done rendering with this camera
            const ra = renderActions[renderActions.length - 1];
            if (ra.camera.onPostRender && ra.lastCameraUse) {
                ra.camera.onPostRender();
            }
        }

        // remove shadow before-passes
        this.beforePasses.length = 0;
    }

    /**
     * @param {import('../composition/render-action.js').RenderAction} renderAction - The render
     * action.
     * @param {boolean} firstRenderAction - True if this is the first render action in the render pass.
     */
    renderRenderAction(renderAction, firstRenderAction) {

        const { renderer, layerComposition } = this;
        const device = renderer.device;

        // layer
        const { layer, transparent, camera } = renderAction;
        const cameraPass = layerComposition.camerasMap.get(camera);

        DebugGraphics.pushGpuMarker(this.device, `Camera: ${camera ? camera.entity.name : 'Unnamed'}, Layer: ${layer.name}(${transparent ? 'TRANSP' : 'OPAQUE'})`);

        // #if _PROFILER
        const drawTime = now();
        // #endif

        // Call pre-render callback if there's one
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

            const options = {
                lightClusters: renderAction.lightClusters
            };

            // shader pass - use setting from camera if available, otherwise forward
            const shaderPass = camera.camera.shaderPassInfo?.index ?? SHADER_FORWARD;

            // if this is not a first render action to the render target, or if the render target was not
            // fully cleared on pass start, we need to execute clears here
            if (!firstRenderAction || !camera.camera.fullSizeClearRect) {
                options.clearColor = renderAction.clearColor;
                options.clearDepth = renderAction.clearDepth;
                options.clearStencil = renderAction.clearStencil;
            }

            renderer.renderForwardLayer(camera.camera, renderAction.renderTarget, layer, transparent,
                                        shaderPass, renderAction.viewBindGroups, options);

            // Revert temp frame stuff
            // TODO: this should not be here, as each rendering / clearing should explicitly set up what
            // it requires (the properties are part of render pipeline on WebGPU anyways)
            device.setBlendState(BlendState.NOBLEND);
            device.setStencilState(null, null);
            device.setAlphaToCoverage(false);
        }

        // Call layer's post-render callback if there's one
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

        // #if _PROFILER
        layer._renderTime += now() - drawTime;
        // #endif
    }

    // #if _DEBUG
    log(device, index) {
        super.log(device, index);

        if (Tracing.get(TRACEID_RENDER_PASS_DETAIL)) {

            const { layerComposition } = this;
            this.renderActions.forEach((ra, index) => {

                const layer = ra.layer;
                const enabled = layer.enabled && layerComposition.isEnabled(layer, ra.transparent);
                const camera = ra.camera;

                Debug.trace(TRACEID_RENDER_PASS_DETAIL, `    ${index}:` +
                    (' Cam: ' + (camera ? camera.entity.name : '-')).padEnd(22, ' ') +
                    (' Lay: ' + layer.name).padEnd(22, ' ') +
                    (ra.transparent ? ' TRANSP' : ' OPAQUE') +
                    (enabled ? ' ENABLED' : ' DISABLED') +
                    (' Meshes: ' + layer.meshInstances.length).padEnd(5, ' ')
                );
            });
        }
    }
    // #endif
}

export { RenderPassForward };
