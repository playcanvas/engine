import { now } from '../../core/time.js';
import { BoundingSphere } from '../../core/shape/bounding-sphere.js';
import {
    LIGHTTYPE_DIRECTIONAL,
    SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME,
    EVENT_PRECULL, EVENT_POSTCULL, EVENT_CULL_END
} from '../constants.js';

/**
 * @import { Camera } from '../camera.js'
 * @import { CulledInstances } from '../layer.js'
 * @import { Layer } from '../layer.js'
 * @import { LayerComposition } from '../composition/layer-composition.js'
 * @import { Light } from '../light.js'
 * @import { MeshInstance } from '../mesh-instance.js'
 * @import { Renderer } from './renderer.js'
 */

const tempSphere = new BoundingSphere();
const _tempSet = new Set();

/**
 * Performs the visibility culling for a {@link Renderer}: per-camera light visibility,
 * mesh-instance culling (request/execute) and shadow-caster culling. It holds the per-frame
 * culling state and operates on the renderer's shared state (lights, shadow renderers, light
 * atlas, stats) through a back-reference to the renderer.
 *
 * @ignore
 */
class Culler {
    /**
     * A set of visible mesh instances which need further processing before being rendered, e.g.
     * skinning or morphing. Extracted during culling.
     *
     * @type {Set<MeshInstance>}
     */
    processingMeshInstances = new Set();

    /**
     * The distinct cameras with mesh-instance cull requests registered for the current frame, in
     * registration order. Populated by {@link Culler#requestMeshInstanceCull} and drained by
     * {@link Culler#executeMeshInstanceCull}. Reused across frames to avoid per-frame allocation.
     *
     * @type {Camera[]}
     * @private
     */
    _cullCameras = [];

    /**
     * A list of unique directional shadow casting lights for each enabled camera. This is generated
     * each frame during light culling.
     *
     * @type {Map<Camera, Array<Light>>}
     */
    cameraDirShadowLights = new Map();

    /**
     * A mapping of a directional light to a camera, for which the shadow is currently valid. This
     * is cleared each frame, and updated each time a directional light shadow is rendered for a
     * camera, and allows us to manually schedule shadow passes when a new camera needs a shadow.
     *
     * @type {Map<Light, Camera>}
     */
    dirLightShadows = new Map();

    /**
     * @param {Renderer} renderer - The renderer that owns this culler.
     */
    constructor(renderer) {
        /** @type {Renderer} */
        this.renderer = renderer;
    }

    /**
     * @param {Camera} camera - The camera used for culling.
     * @param {MeshInstance[]} drawCalls - Draw calls to cull.
     * @param {CulledInstances} culledInstances - Stores culled instances.
     */
    cullMeshInstances(camera, drawCalls, culledInstances) {
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
        this.renderer._cullTime += now() - cullTime;
        this.renderer._numDrawCallsCulled += doCull ? count : 0;
        // #endif
    }

    /**
     * Culls a set of lights against a camera's frustum, marking the visible ones (and updating their
     * max screen size and physical-units flag). Directional lights are marked visible at the start
     * of the frame and are skipped here, so only local (omni / spot) lights are frustum tested. In
     * non-clustered lighting, a shadow-casting light with no shadow map allocated yet is also marked
     * visible so its shadow map gets allocated.
     *
     * @param {Camera} camera - The camera whose frustum the lights are culled against.
     * @param {Light[]} lights - The lights to cull (typically a layer's lights).
     */
    cullLights(camera, lights) {

        const { scene } = this.renderer;
        const clusteredLightingEnabled = scene.clusteredLightingEnabled;
        const physicalUnits = scene.physicalUnits;
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
                    light.usePhysicalUnits = scene.physicalUnits;
                }
            }
        }
    }

    /**
     * Shadow map culling for directional and visible local lights visible meshInstances are
     * collected into light._renderData, and are marked as visible for directional lights also
     * shadow camera matrix is set up.
     *
     * @param {LayerComposition} comp - The layer composition.
     */
    cullShadowmaps(comp) {

        const { renderer } = this;

        // shadow casters culling for local (point and spot) lights. The shadow-update-mode forcing
        // (atlas slot reassigned / shadow map not yet allocated) was applied earlier, in
        // updateLightVisibility, so the update mode is already final here.
        const localLights = renderer.localLights;
        for (let i = 0; i < localLights.length; i++) {
            const light = localLights[i];
            if (light._type !== LIGHTTYPE_DIRECTIONAL) {
                if (light.visibleThisFrame && light.castShadows && light.shadowUpdateMode !== SHADOWUPDATE_NONE) {
                    renderer._shadowRendererLocal.cull(light, comp);
                }
            }
        }

        // cull shadow casters / fit cascades for the directional lights collected (earlier, in
        // updateLightVisibility) into cameraDirShadowLights (mesh-dependent)
        this.cameraDirShadowLights.forEach((lightList, camera) => {
            for (let i = 0; i < lightList.length; i++) {
                renderer._shadowRendererDirectional.cull(lightList[i], comp, camera);
            }
        });
    }

    /**
     * After the frame graph is built and shadow casters are culled, account for shadow-map updates
     * and consume one-shot ({@link SHADOWUPDATE_THISFRAME}) requests for lights whose shadow
     * actually rendered this frame, reverting them to {@link SHADOWUPDATE_NONE}. A light that did
     * not render this frame (for example an off-screen local light) keeps its request, so the
     * shadow updates the next frame the light is rendered. Must run after both the frame graph build
     * and shadow-caster culling, so that `needsShadowRendering` (a pure predicate) reports the same
     * result to both before the update mode is changed here.
     */
    consumeOneShotShadows() {

        const { renderer } = this;
        const clustered = renderer.scene.clusteredLightingEnabled;
        const shadowRenderer = renderer.shadowRenderer;

        // local lights: the shadow renders if shadow rendering is needed and, in clustered lighting,
        // an atlas slot has been allocated for it
        const localLights = renderer.localLights;
        for (let i = 0; i < localLights.length; i++) {
            const light = localLights[i];
            if (shadowRenderer.needsShadowRendering(light) && (!clustered || light.atlasViewportAllocated)) {
                renderer._shadowMapUpdates += light.numShadowFaces;
                if (light.shadowUpdateMode === SHADOWUPDATE_THISFRAME) {
                    light.shadowUpdateMode = SHADOWUPDATE_NONE;
                }
            }
        }

        // directional lights: a separate shadow is rendered for each camera that uses the light, as
        // the shadow frustum is fit to that camera
        this.cameraDirShadowLights.forEach((lightList) => {
            for (let i = 0; i < lightList.length; i++) {
                const light = lightList[i];
                if (shadowRenderer.needsShadowRendering(light)) {
                    renderer._shadowMapUpdates += light.numShadowFaces;
                    if (light.shadowUpdateMode === SHADOWUPDATE_THISFRAME) {
                        light.shadowUpdateMode = SHADOWUPDATE_NONE;
                    }
                }
            }
        });
    }

    /**
     * Collects the set of shadow-casting directional lights for each camera into
     * {@link Culler#cameraDirShadowLights}, and ensures each such light has a shadow map allocated.
     * This is independent of mesh culling and camera frusta (it uses only the composition's cameras
     * and the layers' directional lights), so it can run before the frame graph is built. The
     * actual shadow-caster culling is done separately.
     *
     * @param {LayerComposition} comp - The layer composition.
     */
    collectDirectionalShadowLights(comp) {

        const { renderer } = this;

        // start with none and collect lights for cameras
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

                                renderer._shadowRendererDirectional.prepareShadowMap(light);
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
     * Per-camera light visibility culling, light-atlas allocation and directional-shadow-light
     * collection. This is independent of mesh culling and the frame graph, so it runs before the
     * frame graph is built. The mesh and shadow-caster culling that depends on it is done later in
     * {@link Culler#cullComposition}.
     *
     * @param {LayerComposition} comp - The layer composition.
     */
    updateLightVisibility(comp) {

        const { renderer } = this;
        const { scene } = renderer;

        // reset per-frame light visibility: directional lights start visible, local lights start
        // hidden (and are marked visible below by cullLights if they intersect a camera frustum)
        const lights = renderer.lights;
        for (let i = 0; i < lights.length; i++) {
            lights[i].beginFrame();
        }

        // for all cameras: update the frustum and cull each layer's lights for visibility
        const numCameras = comp.cameras.length;
        for (let i = 0; i < numCameras; i++) {
            const camera = comp.cameras[i];

            // update the camera frustum for culling (aspect ratio auto-refreshes on read)
            renderer.updateCameraFrustum(camera.camera);

            // for all of its enabled layers cull the non-directional lights once with each camera
            // lights aren't collected anywhere, but marked as visible
            const layerIds = camera.layers;
            for (let j = 0; j < layerIds.length; j++) {
                const layer = comp.getLayerById(layerIds[j]);
                if (layer && layer.enabled) {
                    this.cullLights(camera.camera, layer._lights);
                }
            }
        }

        // update shadow / cookie atlas allocation for the visible lights. Update it after the lights
        // were culled, but before shadow maps are culled, as it might force some 'update once'
        // shadows to cull.
        const isClustered = scene.clusteredLightingEnabled;
        if (isClustered) {
            renderer.updateLightTextureAtlas();
        }

        // force a shadow re-render for local lights whose atlas slot was reassigned (clustered) or
        // whose shadow map has not yet been allocated (non-clustered). Done here - before the frame
        // graph is built and shadow casters are culled - so both of those steps see the final
        // shadow update mode.
        const localLights = renderer.localLights;
        for (let i = 0; i < localLights.length; i++) {
            const light = localLights[i];
            if (light._type !== LIGHTTYPE_DIRECTIONAL) {
                if (isClustered) {
                    // if the atlas slot is reassigned, make sure to update the shadow map (incl. culling)
                    if (light.atlasSlotUpdated && light.shadowUpdateMode === SHADOWUPDATE_NONE) {
                        light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
                    }
                } else {
                    // allocate the shadow map early (before the frame graph is built and before the
                    // forward pass reads it), mirroring directional lights. Force a one-shot update
                    // when the map was (re)created (first use, or destroyed by a property change such
                    // as shadowType) so the new map actually gets rendered.
                    if (light.castShadows && light.visibleThisFrame && !light._shadowMap) {
                        renderer._shadowRendererLocal.prepareShadowMap(light);
                        if (light.shadowUpdateMode === SHADOWUPDATE_NONE) {
                            light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
                        }
                    }
                }
            }
        }

        // collect shadow-casting directional lights per camera + allocate their shadow maps
        this.collectDirectionalShadowLights(comp);
    }

    /**
     * Registers a request to cull a layer's mesh instances for a camera in the current frame. The
     * culling itself is performed later, in a single batch, by
     * {@link Culler#executeMeshInstanceCull}. Requests are de-duplicated per (camera, layer), so
     * requesting the same pair more than once (e.g. for its opaque and transparent sub-layers) is
     * harmless.
     *
     * This lets the frame graph drive culling - each pass requests the (camera, layer) pairs it
     * will actually render - instead of culling every camera/layer combination in the composition.
     *
     * @param {Camera} camera - The camera to cull for.
     * @param {Layer} layer - The layer whose mesh instances should be culled.
     */
    requestMeshInstanceCull(camera, layer) {
        // track each requested camera once, when its first layer this frame is registered
        if (camera.addCullLayer(layer)) {
            this._cullCameras.push(camera);
        }
    }

    /**
     * Performs all mesh-instance culling requested via {@link Culler#requestMeshInstanceCull} this
     * frame, then clears the request list. For each requested camera the precull event is fired
     * (before the frustum is refreshed, so a listener may still adjust the camera), the camera
     * frustum is updated, each requested layer is culled, and the postcull event is fired.
     *
     * The events are passed the owning camera component for a framework camera, or null for an
     * internal camera (shadow / reflection / picker), matching the documented precull/postcull
     * contract.
     */
    executeMeshInstanceCull() {

        const { renderer } = this;
        const { scene } = renderer;
        const cameras = this._cullCameras;

        for (let i = 0; i < cameras.length; i++) {
            const camera = cameras[i];

            // recover the owning camera component (framework camera) or null (internal camera),
            // without the scene layer taking a dependency on the framework
            const cameraComponent = camera.node?.camera ?? null;

            // precull is fired before the frustum is refreshed, so a listener may adjust the camera
            scene?.fire(EVENT_PRECULL, cameraComponent);

            renderer.updateCameraFrustum(camera);

            for (const layer of camera.cullLayers) {
                this.cullMeshInstances(camera, layer.meshInstances, layer.getCulledInstances(camera));
            }

            scene?.fire(EVENT_POSTCULL, cameraComponent);

            // reset the camera's per-frame cull layer set
            camera.clearCullLayers();
        }

        // requests consumed - reset for the next frame
        cameras.length = 0;
    }

    /**
     * Visibility culling of meshInstances and shadow casters. Light visibility, the light atlas and
     * the directional-shadow-light collection are done earlier in
     * {@link Culler#updateLightVisibility}.
     *
     * @param {LayerComposition} comp - The layer composition.
     */
    cullComposition(comp) {

        // #if _PROFILER
        const cullTime = now();
        // #endif

        const { renderer } = this;
        const { scene } = renderer;

        this.processingMeshInstances.clear();

        renderer._camerasRendered += comp.cameras.length;

        // cull mesh instances for the (camera, layer) pairs the frame graph's passes requested
        // (this also fires the per-camera precull / postcull events)
        this.executeMeshInstanceCull();

        // cull shadow casters for all lights
        this.cullShadowmaps(comp);

        // event after the engine has finished culling all cameras
        scene?.fire(EVENT_CULL_END);

        // #if _PROFILER
        renderer._cullTime += now() - cullTime;
        // #endif
    }
}

export { Culler };
