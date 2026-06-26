import { Debug } from '../../../core/debug.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { BoundingBox } from '../../../core/shape/bounding-box.js';
import { GSplatDirector } from '../../../scene/gsplat-unified/gsplat-director.js';
import { ComponentSystem } from '../system.js';
import { GSplatComponent } from './component.js';
import { gsplatChunksGLSL } from '../../../scene/shader-lib/glsl/collections/gsplat-chunks-glsl.js';
import { gsplatChunksWGSL } from '../../../scene/shader-lib/wgsl/collections/gsplat-chunks-wgsl.js';
import { SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../../platform/graphics/constants.js';
import { ShaderChunks } from '../../../scene/shader-lib/shader-chunks.js';

// Register warning for removed customization chunk
Debug.call(() => {
    ShaderChunks.registerValidation('gsplatCustomizeVS', {
        message: 'Shader chunk gsplatCustomizeVS has been removed. Use gsplatModifyVS instead.'
    });
});

/**
 * @import { AppBase } from '../../app-base.js'
 * @import { Camera } from '../../../scene/camera.js'
 * @import { Layer } from '../../../scene/layer.js'
 * @import { ShaderMaterial } from '../../../scene/materials/shader-material.js'
 */

// order matters here
const _properties = [
    'unified',
    'lodBaseDistance',
    'lodMultiplier',
    'lodRangeMin',
    'lodRangeMax',
    'castShadows',
    'material',
    'asset',
    'resource',
    'layers'
];

/**
 * Allows an Entity to render a gsplat.
 *
 * @category Graphics
 */
class GSplatComponentSystem extends ComponentSystem {
    /**
     * Fired when a GSplat material is created for a camera and layer combination. Materials are
     * created during the first frame update when the GSplat is rendered. The handler is passed
     * the {@link ShaderMaterial}, the {@link CameraComponent}, and the {@link Layer}.
     *
     * This event is useful for setting up custom material chunks and parameters before the
     * first render.
     *
     * @event
     * @example
     * app.systems.gsplat.on('material:created', (material, camera, layer) => {
     *     console.log(`Material created for camera ${camera.entity.name} on layer ${layer.name}`);
     *     // Set custom material parameters before first render
     *     material.setParameter('myParam', value);
     * });
     */
    static EVENT_MATERIALCREATED = 'material:created';

    /**
     * Fired every frame for each camera and layer combination rendering GSplats.
     * The handler is passed the {@link CameraComponent}, the {@link Layer}, a boolean indicating
     * if the current frame has up-to-date sorting, and a number indicating how many resources are
     * loading.
     *
     * The `ready` parameter indicates whether the current frame reflects all recent changes (camera
     * movement, splat transforms, lod updates, etc.) with the latest sorting applied. The `loadingCount`
     * parameter reports the total number of octree LOD resources currently loading or queued to load.
     *
     * This event is useful for video capture or other workflows that need to wait for frames
     * to be fully ready. Only capture frames and move camera to next position when both
     * `ready === true` and `loadingCount === 0`. Note that `loadingCount` can be used as a boolean
     * in conditionals (0 is falsy, non-zero is truthy) for backward compatibility.
     *
     * @event
     * @example
     * // Wait for frame to be ready before capturing
     * app.systems.gsplat.on('frame:ready', (camera, layer, ready, loadingCount) => {
     *     if (ready && !loadingCount) {
     *         console.log(`Frame ready to capture for camera ${camera.entity.name}`);
     *         // Capture frame here
     *     }
     * });
     * @example
     * // Track loading progress (0..1)
     * let maxLoadingCount = 0;
     * app.systems.gsplat.on('frame:ready', (camera, layer, ready, loadingCount) => {
     *     maxLoadingCount = Math.max(maxLoadingCount, loadingCount);
     *     const progress = maxLoadingCount > 0 ? (maxLoadingCount - loadingCount) / maxLoadingCount : 1;
     *     console.log(`Loading progress: ${(progress * 100).toFixed(1)}%`);
     * });
     */
    static EVENT_FRAMEREADY = 'frame:ready';

    /**
     * Fired once per frame, after the component/script updates and before rendering, when GSplat
     * streaming has produced new data that a render would show (newly streamed octree LOD) or a CPU
     * sort result is ready to be applied. This drives on-demand rendering for apps that run with
     * {@link AppBase#autoRender} set to false: a typical handler sets {@link AppBase#renderNextFrame}
     * so the new data is shown.
     *
     * Streaming (LOD evaluation, file loading) runs every frame regardless of `autoRender`, so the
     * scene keeps loading in the background; this event tells you when it's worth rendering.
     *
     * Note: this event covers streaming changes only. Changes you make yourself — moving the camera,
     * modifying the scene, or adding, removing, or changing properties of gsplat components — should
     * trigger a render yourself.
     *
     * @event
     * @example
     * app.autoRender = false;
     * app.systems.gsplat.on('frame:request', () => {
     *     app.renderNextFrame = true;
     * });
     */
    static EVENT_FRAMEREQUEST = 'frame:request';

    /**
     * Create a new GSplatComponentSystem.
     *
     * @param {AppBase} app - The Application.
     * @ignore
     */
    constructor(app) {
        super(app);

        this.id = 'gsplat';

        this.ComponentType = GSplatComponent;

        app.renderer.gsplatDirector = new GSplatDirector(app.graphicsDevice, app.renderer, app.scene, this);

        // register gsplat shader chunks
        ShaderChunks.get(app.graphicsDevice, SHADERLANGUAGE_GLSL).add(gsplatChunksGLSL);
        ShaderChunks.get(app.graphicsDevice, SHADERLANGUAGE_WGSL).add(gsplatChunksWGSL);

        this.on('beforeremove', this.onBeforeRemove, this);

        // Drive gsplat streaming (LOD + file loading) every frame, independent of rendering, so it
        // keeps progressing when app.autoRender is false. 'framerender' fires after the script/anim
        // updates (current camera) and before the render gate, so a frame:request handler can render
        // the same frame.
        this.app.on('framerender', this.onFrameRender, this);
    }

    onFrameRender() {
        this.app.renderer.gsplatDirector?.updateStreaming();
    }

    initializeComponentData(component, _data, properties) {
        // duplicate layer list
        if (_data.layers && _data.layers.length) {
            _data.layers = _data.layers.slice(0);
        }

        for (let i = 0; i < _properties.length; i++) {
            if (_data.hasOwnProperty(_properties[i])) {
                component[_properties[i]] = _data[_properties[i]];
            }
        }

        if (_data.aabbCenter && _data.aabbHalfExtents) {
            component.customAabb = new BoundingBox(new Vec3(_data.aabbCenter), new Vec3(_data.aabbHalfExtents));
        }

        super.initializeComponentData(component, _data);
    }

    cloneComponent(entity, clone) {

        const gSplatComponent = entity.gsplat;

        // copy properties
        const data = {};
        _properties.forEach((prop) => {
            if (prop === 'material') {
                if (!gSplatComponent.unified) { // unified gsplat does not use material
                    const srcMaterial = gSplatComponent[prop];
                    if (srcMaterial) {
                        data[prop] = srcMaterial.clone();
                    }
                }
            } else {
                data[prop] = gSplatComponent[prop];
            }
        });
        data.enabled = gSplatComponent.enabled;

        // clone component
        const component = this.addComponent(clone, data);

        component.customAabb = gSplatComponent.customAabb?.clone() ?? null;

        return component;
    }

    onBeforeRemove(entity, component) {
        component.onBeforeRemove();
    }

    /**
     * Gets the GSplat material for the given camera and layer.
     *
     * Returns null if the material hasn't been created yet. Materials are created during the first
     * frame update when the GSplat is rendered. To be notified immediately when materials are
     * created, listen to the 'material:created' event on GSplatComponentSystem:
     *
     * @param {Camera} camera - The camera instance.
     * @param {Layer} layer - The layer instance.
     * @returns {ShaderMaterial|null} The material, or null if not created yet.
     * @example
     * app.systems.gsplat.on('material:created', (material, camera, layer) => {
     *     // Material is now available
     *     material.setParameter('myParam', value);
     * });
     */
    getMaterial(camera, layer) {
        const director = this.app.renderer.gsplatDirector;
        if (!director) return null;

        const cameraData = director.camerasMap.get(camera);
        if (!cameraData) return null;

        const layerData = cameraData.layersMap.get(layer);
        return layerData?.gsplatManager?.material ?? null;
    }

    getGSplatMaterial(camera, layer) {
        Debug.deprecated('GSplatComponentSystem#getGSplatMaterial is deprecated. Use GSplatComponentSystem#getMaterial instead.');
        return this.getMaterial(camera, layer);
    }

    destroy() {
        super.destroy();
        this.app.off('framerender', this.onFrameRender, this);
    }
}

export { GSplatComponentSystem };
