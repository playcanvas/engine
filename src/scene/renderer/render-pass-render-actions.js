import { TRACEID_RENDER_PASS_DETAIL } from "../../core/constants.js";
import { Debug } from "../../core/debug.js";
import { now } from "../../core/time.js";
import { Tracing } from "../../core/tracing.js";

import { BlendState } from "../../platform/graphics/blend-state.js";
import { DebugGraphics } from "../../platform/graphics/debug-graphics.js";
import { RenderPass } from "../../platform/graphics/render-pass.js";
import { RenderAction } from "../composition/render-action.js";

import { WorldClustersDebug } from "../lighting/world-clusters-debug.js";

/**
 * A render pass used to render Render Actions (layers).
 *
 * @ignore
 */
class RenderPassRenderActions extends RenderPass {
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

    constructor(device, layerComposition, scene, renderer) {
        super(device);

        this.layerComposition = layerComposition;
        this.scene = scene;
        this.renderer = renderer;
    }

    addRenderAction(renderAction) {
        this.renderActions.push(renderAction);

        // first render action sets up clear params
        if (this.renderActions.length === 1) {

            const camera = renderAction.camera;
            this.fullSizeClearRect = camera.camera.fullSizeClearRect;

            // only if camera rendering covers the full viewport
            if (this.fullSizeClearRect) {

                if (renderAction.clearColor) {
                    this.setClearColor(camera.camera.clearColor);
                }
                if (renderAction.clearDepth) {
                    this.setClearDepth(camera.camera.clearDepth);
                }
                if (renderAction.clearStencil) {
                    this.setClearStencil(camera.camera.clearStencil);
                }
            }
        }
    }

    addLayer(camera, layer, transparent) {

        Debug.assert(camera);
        Debug.assert(this.renderTarget !== undefined, `Render pass needs to be initialized before adding layers`);
        Debug.assert(camera.camera.layersSet.has(layer.id), `Camera ${camera.entity.name} does not render layer ${layer.name}.`);

        const ra = new RenderAction();
        ra.renderTarget = this.renderTarget;
        ra.camera = camera;
        ra.layer = layer;
        ra.transparent = transparent;

        // camera / layer clear flags
        const firstRa = this.renderActions.length === 0;
        ra.setupClears(firstRa ? camera : undefined, layer);

        this.addRenderAction(ra);
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
    }

    /**
     * @param {import('../composition/render-action.js').RenderAction} renderAction - The render
     * action.
     * @param {boolean} firstRenderAction - True if this is the first render action in the render pass.
     */
    renderRenderAction(renderAction, firstRenderAction) {

        const { scene, renderer, layerComposition } = this;
        const clusteredLightingEnabled = scene.clusteredLightingEnabled;
        const device = renderer.device;

        // layer
        const { layer, transparent, camera } = renderAction;
        const cameraPass = layerComposition.camerasMap.get(camera);

        DebugGraphics.pushGpuMarker(this.device, camera ? camera.entity.name : 'noname');
        DebugGraphics.pushGpuMarker(this.device, layer.name);

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

            renderer.setupViewport(camera.camera, renderAction.renderTarget);

            // if this is not a first render action to the render target, or if the render target was not
            // fully cleared on pass start, we need to execute clears here
            if (!firstRenderAction || !camera.camera.fullSizeClearRect) {
                renderer.clear(camera.camera, renderAction.clearColor, renderAction.clearDepth, renderAction.clearStencil);
            }

            // #if _PROFILER
            const sortTime = now();
            // #endif

            layer.sortVisible(camera.camera, transparent);

            // #if _PROFILER
            renderer._sortTime += now() - sortTime;
            // #endif

            const culledInstances = layer.getCulledInstances(camera.camera);
            const visible = transparent ? culledInstances.transparent : culledInstances.opaque;

            // add debug mesh instances to visible list
            scene.immediate.onPreRenderLayer(layer, visible, transparent);

            // set up layer uniforms
            if (layer.requiresLightCube) {
                renderer.lightCube.update(scene.ambientLight, layer._lights);
                renderer.constantLightCube.setValue(renderer.lightCube.colors);
            }

            // upload clustered lights uniforms
            if (clusteredLightingEnabled && renderAction.lightClusters) {
                renderAction.lightClusters.activate();

                // debug rendering of clusters
                if (!renderer.clustersDebugRendered && scene.lighting.debugLayer === layer.id) {
                    renderer.clustersDebugRendered = true;
                    WorldClustersDebug.render(renderAction.lightClusters, this.scene);
                }
            }

            // Set the not very clever global variable which is only useful when there's just one camera
            scene._activeCamera = camera.camera;

            const viewCount = renderer.setCameraUniforms(camera.camera, renderAction.renderTarget);
            if (device.supportsUniformBuffers) {
                renderer.setupViewUniformBuffers(renderAction.viewBindGroups, renderer.viewUniformFormat, renderer.viewBindGroupFormat, viewCount);
            }

            // enable flip faces if either the camera has _flipFaces enabled or the render target has flipY enabled
            const flipFaces = !!(camera.camera._flipFaces ^ renderAction?.renderTarget?.flipY);

            // shader pass - use setting from camera if available, otherwise use layer setting
            const shaderPass = camera.camera.shaderPassInfo?.index ?? layer.shaderPass;

            const draws = renderer._forwardDrawCalls;
            renderer.renderForward(camera.camera,
                                   visible,
                                   layer.splitLights,
                                   shaderPass,
                                   layer.onDrawCall,
                                   layer,
                                   flipFaces);
            layer._forwardDrawCalls += renderer._forwardDrawCalls - draws;

            // Revert temp frame stuff
            // TODO: this should not be here, as each rendering / clearing should explicitly set up what
            // it requires (the properties are part of render pipeline on WebGPU anyways)
            device.setBlendState(BlendState.NOBLEND);
            device.setStencilState(null, null);
            device.setAlphaToCoverage(false);
            device.setDepthBias(false);
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

export { RenderPassRenderActions };
