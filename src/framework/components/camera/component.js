import { Debug } from '../../../core/debug.js';

import { ASPECT_AUTO, LAYERID_UI, LAYERID_DEPTH } from '../../../scene/constants.js';
import { Camera } from '../../../scene/camera.js';
import { ShaderPass } from '../../../scene/shader-pass.js';

import { Component } from '../component.js';

import { PostEffectQueue } from './post-effect-queue.js';

/**
 * Callback used by {@link CameraComponent#calculateTransform} and {@link CameraComponent#calculateProjection}.
 *
 * @callback CalculateMatrixCallback
 * @param {import('../../../core/math/mat4.js').Mat4} transformMatrix - Output of the function.
 * @param {number} view - Type of view. Can be {@link VIEW_CENTER}, {@link VIEW_LEFT} or {@link VIEW_RIGHT}. Left and right are only used in stereo rendering.
 */

/**
 * The Camera Component enables an Entity to render the scene. A scene requires at least one
 * enabled camera component to be rendered. Note that multiple camera components can be enabled
 * simultaneously (for split-screen or offscreen rendering, for example).
 *
 * ```javascript
 * // Add a pc.CameraComponent to an entity
 * const entity = new pc.Entity();
 * entity.addComponent('camera', {
 *     nearClip: 1,
 *     farClip: 100,
 *     fov: 55
 * });
 *
 * // Get the pc.CameraComponent on an entity
 * const cameraComponent = entity.camera;
 *
 * // Update a property on a camera component
 * entity.camera.nearClip = 2;
 * ```
 *
 * @category Graphics
 */
class CameraComponent extends Component {
    /**
     * Custom function that is called when postprocessing should execute.
     *
     * @type {Function}
     * @ignore
     */
    onPostprocessing = null;

    /**
     * Custom function that is called before the camera renders the scene.
     *
     * @type {Function}
     */
    onPreRender = null;

    /**
     * Custom function that is called after the camera renders the scene.
     *
     * @type {Function}
     */
    onPostRender = null;

    /**
     * A counter of requests of depth map rendering.
     *
     * @type {number}
     * @private
     */
    _renderSceneDepthMap = 0;

    /**
     * A counter of requests of color map rendering.
     *
     * @type {number}
     * @private
     */
    _renderSceneColorMap = 0;

    /** @private */
    _sceneDepthMapRequested = false;

    /** @private */
    _sceneColorMapRequested = false;

    /** @private */
    _priority = 0;

    /**
     * Layer id at which the postprocessing stops for the camera.
     *
     * @type {number}
     * @private
     */
    _disablePostEffectsLayer = LAYERID_UI;

    /** @private */
    _camera = new Camera();

    /**
     * Create a new CameraComponent instance.
     *
     * @param {import('./system.js').CameraComponentSystem} system - The ComponentSystem that
     * created this Component.
     * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
     * attached to.
     */
    constructor(system, entity) {
        super(system, entity);

        this._camera.node = entity;

        // postprocessing management
        this._postEffects = new PostEffectQueue(system.app, this);
    }

    /**
     * Sets the name of the shader pass the camera will use when rendering.
     *
     * In addition to existing names (see the parameter description), a new name can be specified,
     * which creates a new shader pass with the given name. The name provided can only use
     * alphanumeric characters and underscores. When a shader is compiled for the new pass, a define
     * is added to the shader. For example, if the name is 'custom_rendering', the define
     * 'CUSTOM_RENDERING_PASS' is added to the shader, allowing the shader code to conditionally
     * execute code only when that shader pass is active.
     *
     * Another instance where this approach may prove useful is when a camera needs to render a more
     * cost-effective version of shaders, such as when creating a reflection texture. To accomplish
     * this, a callback on the material that triggers during shader compilation can be used. This
     * callback can modify the shader generation options specifically for this shader pass.
     *
     * ```javascript
     * const shaderPassId = camera.setShaderPass('custom_rendering');
     *
     * material.onUpdateShader = function (options) {
     *     if (options.pass === shaderPassId) {
     *         options.litOptions.normalMapEnabled = false;
     *         options.litOptions.useSpecular = false;
     *     }
     *     return options;
     * };
     * ```
     *
     * @param {string} name - The name of the shader pass. Defaults to undefined, which is
     * equivalent to {@link SHADERPASS_FORWARD}. Can be:
     *
     * - {@link SHADERPASS_FORWARD}
     * - {@link SHADERPASS_ALBEDO}
     * - {@link SHADERPASS_OPACITY}
     * - {@link SHADERPASS_WORLDNORMAL}
     * - {@link SHADERPASS_SPECULARITY}
     * - {@link SHADERPASS_GLOSS}
     * - {@link SHADERPASS_METALNESS}
     * - {@link SHADERPASS_AO}
     * - {@link SHADERPASS_EMISSION}
     * - {@link SHADERPASS_LIGHTING}
     * - {@link SHADERPASS_UV0}
     *
     * @returns {number} The id of the shader pass.
     */
    setShaderPass(name) {
        const shaderPass =  ShaderPass.get(this.system.app.graphicsDevice);
        const shaderPassInfo = name ? shaderPass.allocate(name, {
            isForward: true
        }) : null;
        this._camera.shaderPassInfo = shaderPassInfo;

        return shaderPassInfo.index;
    }

    /**
     * Shader pass name.
     *
     * @returns {string} The name of the shader pass, or undefined if no shader pass is set.
     */
    getShaderPass() {
        return this._camera.shaderPassInfo?.name;
    }

    /**
     * Sets the render passes the camera uses for rendering, instead of its default rendering.
     * Set this to an empty array to return to the default behavior.
     *
     * @type {import('../../../platform/graphics/render-pass.js').RenderPass[]}
     * @ignore
     */
    set renderPasses(passes) {
        this._camera.renderPasses = passes;
    }

    /**
     * Gets the render passes the camera uses for rendering, instead of its default rendering.
     *
     * @type {import('../../../platform/graphics/render-pass.js').RenderPass[]}
     * @ignore
     */
    get renderPasses() {
        return this._camera.renderPasses;
    }

    /**
     * Sets the rendering parameters. If this is not null, the camera will use these rendering
     * parameters instead of those specified in the scene's rendering parameters
     * {@link Scene#rendering}.
     */
    set rendering(value) {
        this._camera.renderingParams = value;
    }

    /**
     * Gets a {@link RenderingParams} that defines rendering parameters, or null if those are not
     * set.
     *
     * @type {import('../../../scene/renderer/rendering-params.js').RenderingParams|null}
     */
    get rendering() {
        return this._camera.renderingParams;
    }

    /**
     * Sets the camera aperture in f-stops. Default is 16. Higher value means less exposure.
     *
     * @type {number}
     */
    set aperture(value) {
        this._camera.aperture = value;
    }

    /**
     * Gets the camera aperture in f-stops.
     *
     * @type {number}
     */
    get aperture() {
        return this._camera.aperture;
    }

    /**
     * Sets the aspect ratio (width divided by height) of the camera. If `aspectRatioMode` is
     * {@link ASPECT_AUTO}, then this value will be automatically calculated every frame, and you
     * can only read it. If it's ASPECT_MANUAL, you can set the value.
     *
     * @type {number}
     */
    set aspectRatio(value) {
        this._camera.aspectRatio = value;
    }

    /**
     * Gets the aspect ratio (width divided by height) of the camera.
     *
     * @type {number}
     */
    get aspectRatio() {
        return this._camera.aspectRatio;
    }

    /**
     * Sets the aspect ratio mode of the camera. Can be:
     *
     * - {@link ASPECT_AUTO}: aspect ratio will be calculated from the current render
     * target's width divided by height.
     * - {@link ASPECT_MANUAL}: use the aspectRatio value.
     *
     * Defaults to {@link ASPECT_AUTO}.
     *
     * @type {number}
     */
    set aspectRatioMode(value) {
        this._camera.aspectRatioMode = value;
    }

    /**
     * Gets the aspect ratio mode of the camera.
     *
     * @type {number}
     */
    get aspectRatioMode() {
        return this._camera.aspectRatioMode;
    }

    /**
     * Sets the custom function to calculate the camera projection matrix manually. Can be used for
     * complex effects like doing oblique projection. Function is called using component's scope.
     *
     * Arguments:
     *
     * - {@link Mat4} transformMatrix: output of the function
     * - view: Type of view. Can be {@link VIEW_CENTER}, {@link VIEW_LEFT} or {@link VIEW_RIGHT}.
     *
     * Left and right are only used in stereo rendering.
     *
     * @type {CalculateMatrixCallback}
     */
    set calculateProjection(value) {
        this._camera.calculateProjection = value;
    }

    /**
     * Gets the custom function to calculate the camera projection matrix manually.
     *
     * @type {CalculateMatrixCallback}
     */
    get calculateProjection() {
        return this._camera.calculateProjection;
    }

    /**
     * Sets the custom function to calculate the camera transformation matrix manually. Can be used
     * for complex effects like reflections. Function is called using component's scope. Arguments:
     *
     * - {@link Mat4} transformMatrix: output of the function.
     * - view: Type of view. Can be {@link VIEW_CENTER}, {@link VIEW_LEFT} or {@link VIEW_RIGHT}.
     *
     * Left and right are only used in stereo rendering.
     *
     * @type {CalculateMatrixCallback}
     */
    set calculateTransform(value) {
        this._camera.calculateTransform = value;
    }

    /**
     * Gets the custom function to calculate the camera transformation matrix manually.
     *
     * @type {CalculateMatrixCallback}
     */
    get calculateTransform() {
        return this._camera.calculateTransform;
    }

    /**
     * Gets the camera component's underlying Camera instance.
     *
     * @type {Camera}
     * @ignore
     */
    get camera() {
        return this._camera;
    }

    /**
     * Sets the camera component's clear color. Defaults to `[0.75, 0.75, 0.75, 1]`.
     *
     * @type {import('../../../core/math/color.js').Color}
     */
    set clearColor(value) {
        this._camera.clearColor = value;
    }

    /**
     * Gets the camera component's clear color.
     *
     * @type {import('../../../core/math/color.js').Color}
     */
    get clearColor() {
        return this._camera.clearColor;
    }

    /**
     * Sets whether the camera will automatically clear the color buffer before rendering. Defaults to true.
     *
     * @type {boolean}
     */
    set clearColorBuffer(value) {
        this._camera.clearColorBuffer = value;
        this.dirtyLayerCompositionCameras();
    }

    /**
     * Gets whether the camera will automatically clear the color buffer before rendering.
     *
     * @type {boolean}
     */
    get clearColorBuffer() {
        return this._camera.clearColorBuffer;
    }

    /**
     * Sets whether the camera will automatically clear the depth buffer before rendering. Defaults to true.
     *
     * @type {boolean}
     */
    set clearDepthBuffer(value) {
        this._camera.clearDepthBuffer = value;
        this.dirtyLayerCompositionCameras();
    }

    /**
     * Gets whether the camera will automatically clear the depth buffer before rendering.
     *
     * @type {boolean}
     */
    get clearDepthBuffer() {
        return this._camera.clearDepthBuffer;
    }

    /**
     * Sets whether the camera will automatically clear the stencil buffer before rendering. Defaults to true.
     *
     * @type {boolean}
     */
    set clearStencilBuffer(value) {
        this._camera.clearStencilBuffer = value;
        this.dirtyLayerCompositionCameras();
    }

    /**
     * Gets whether the camera will automatically clear the stencil buffer before rendering.
     *
     * @type {boolean}
     */
    get clearStencilBuffer() {
        return this._camera.clearStencilBuffer;
    }

    /**
     * Sets whether the camera will cull triangle faces. If true, the camera will take
     * `material.cull` into account. Otherwise both front and back faces will be rendered. Defaults
     * to true.
     *
     * @type {boolean}
     */
    set cullFaces(value) {
        this._camera.cullFaces = value;
    }

    /**
     * Gets whether the camera will cull triangle faces.
     *
     * @type {boolean}
     */
    get cullFaces() {
        return this._camera.cullFaces;
    }

    /**
     * Sets the layer id of the layer on which the post-processing of the camera stops being applied
     * to. Defaults to {@link LAYERID_UI}, which causes post-processing to not be applied to UI
     * layer and any following layers for the camera. Set to `undefined` for post-processing to be
     * applied to all layers of the camera.
     *
     * @type {number}
     */
    set disablePostEffectsLayer(layer) {
        this._disablePostEffectsLayer = layer;
        this.dirtyLayerCompositionCameras();
    }

    /**
     * Gets the layer id of the layer on which the post-processing of the camera stops being applied
     * to.
     *
     * @type {number}
     */
    get disablePostEffectsLayer() {
        return this._disablePostEffectsLayer;
    }

    /**
     * Sets the distance from the camera after which no rendering will take place. Defaults to 1000.
     *
     * @type {number}
     */
    set farClip(value) {
        this._camera.farClip = value;
    }

    /**
     * Gets the distance from the camera after which no rendering will take place.
     *
     * @type {number}
     */
    get farClip() {
        return this._camera.farClip;
    }

    /**
     * Sets whether the camera will flip the face direction of triangles. If set to true, the
     * camera will invert front and back faces. Can be useful for reflection rendering. Defaults to
     * false.
     *
     * @type {boolean}
     */
    set flipFaces(value) {
        this._camera.flipFaces = value;
    }

    /**
     * Gets whether the camera will flip the face direction of triangles.
     *
     * @type {boolean}
     */
    get flipFaces() {
        return this._camera.flipFaces;
    }

    /**
     * Sets the field of view of the camera in degrees. Usually this is the Y-axis field of view,
     * see {@link CameraComponent#horizontalFov}. Used for {@link PROJECTION_PERSPECTIVE} cameras
     * only. Defaults to 45.
     *
     * @type {number}
     */
    set fov(value) {
        this._camera.fov = value;
    }

    /**
     * Gets the field of view of the camera in degrees.
     *
     * @type {number}
     */
    get fov() {
        return this._camera.fov;
    }

    /**
     * Gets the camera's frustum shape.
     *
     * @type {import('../../../core/shape/frustum.js').Frustum}
     */
    get frustum() {
        return this._camera.frustum;
    }

    /**
     * Sets whether frustum culling is enabled. This controls the culling of mesh instances against
     * the camera frustum, i.e. if objects outside of the camera's frustum should be omitted from
     * rendering. If false, all mesh instances in the scene are rendered by the camera, regardless
     * of visibility. Defaults to false.
     *
     * @type {boolean}
     */
    set frustumCulling(value) {
        this._camera.frustumCulling = value;
    }

    /**
     * Gets whether frustum culling is enabled.
     *
     * @type {boolean}
     */
    get frustumCulling() {
        return this._camera.frustumCulling;
    }

    /**
     * Sets whether the camera's field of view (`fov`) is horizontal or vertical. Defaults to
     * false (meaning it is vertical be default).
     *
     * @type {boolean}
     */
    set horizontalFov(value) {
        this._camera.horizontalFov = value;
    }

    /**
     * Gets whether the camera's field of view (`fov`) is horizontal or vertical.
     *
     * @type {boolean}
     */
    get horizontalFov() {
        return this._camera.horizontalFov;
    }

    /**
     * Sets the array of layer IDs ({@link Layer#id}) to which this camera should belong. Don't
     * push, pop, splice or modify this array, if you want to change it, set a new one instead.
     * Defaults to `[LAYERID_WORLD, LAYERID_DEPTH, LAYERID_SKYBOX, LAYERID_UI, LAYERID_IMMEDIATE]`.
     *
     * @type {number[]}
     */
    set layers(newValue) {
        const layers = this._camera.layers;
        for (let i = 0; i < layers.length; i++) {
            const layer = this.system.app.scene.layers.getLayerById(layers[i]);
            if (!layer) continue;
            layer.removeCamera(this);
        }

        this._camera.layers = newValue;

        if (!this.enabled || !this.entity.enabled) return;

        for (let i = 0; i < newValue.length; i++) {
            const layer = this.system.app.scene.layers.getLayerById(newValue[i]);
            if (!layer) continue;
            layer.addCamera(this);
        }
    }

    /**
     * Gets the array of layer IDs ({@link Layer#id}) to which this camera belongs.
     *
     * @type {number[]}
     */
    get layers() {
        return this._camera.layers;
    }

    get layersSet() {
        return this._camera.layersSet;
    }

    /**
     * Sets the jitter intensity applied in the projection matrix. Used for jittered sampling by TAA.
     * A value of 1 represents a jitter in the range of `[-1, 1]` of a pixel. Smaller values result
     * in a crisper yet more aliased outcome, whereas increased values produce a smoother but blurred
     * result. Defaults to 0, representing no jitter.
     *
     * @type {number}
     */
    set jitter(value) {
        this._camera.jitter = value;
    }

    /**
     * Gets the jitter intensity applied in the projection matrix.
     *
     * @type {number}
     */
    get jitter() {
        return this._camera.jitter;
    }

    /**
     * Sets the distance from the camera before which no rendering will take place. Defaults to 0.1.
     *
     * @type {number}
     */
    set nearClip(value) {
        this._camera.nearClip = value;
    }

    /**
     * Gets the distance from the camera before which no rendering will take place.
     *
     * @type {number}
     */
    get nearClip() {
        return this._camera.nearClip;
    }

    /**
     * Sets the half-height of the orthographic view window (in the Y-axis). Used for
     * {@link PROJECTION_ORTHOGRAPHIC} cameras only. Defaults to 10.
     *
     * @type {number}
     */
    set orthoHeight(value) {
        this._camera.orthoHeight = value;
    }

    /**
     * Gets the half-height of the orthographic view window (in the Y-axis).
     *
     * @type {number}
     */
    get orthoHeight() {
        return this._camera.orthoHeight;
    }

    /**
     * Gets the post effects queue for this camera. Use this to add or remove post effects from the
     * camera.
     *
     * @type {PostEffectQueue}
     */
    get postEffects() {
        return this._postEffects;
    }

    get postEffectsEnabled() {
        return this._postEffects.enabled;
    }

    /**
     * Sets the priority to control the render order of this camera. Cameras with a smaller
     * priority value are rendered first. Defaults to 0.
     *
     * @type {number}
     */
    set priority(newValue) {
        this._priority = newValue;
        this.dirtyLayerCompositionCameras();
    }

    /**
     * Gets the priority to control the render order of this camera.
     *
     * @type {number}
     */
    get priority() {
        return this._priority;
    }

    /**
     * Sets the type of projection used to render the camera. Can be:
     *
     * - {@link PROJECTION_PERSPECTIVE}: A perspective projection. The camera frustum
     * resembles a truncated pyramid.
     * - {@link PROJECTION_ORTHOGRAPHIC}: An orthographic projection. The camera
     * frustum is a cuboid.
     *
     * Defaults to {@link PROJECTION_PERSPECTIVE}.
     *
     * @type {number}
     */
    set projection(value) {
        this._camera.projection = value;
    }

    /**
     * Gets the type of projection used to render the camera.
     *
     * @type {number}
     */
    get projection() {
        return this._camera.projection;
    }

    /**
     * Gets the camera's projection matrix.
     *
     * @type {import('../../../core/math/mat4.js').Mat4}
     */
    get projectionMatrix() {
        return this._camera.projectionMatrix;
    }

    /**
     * Sets the rendering rectangle for the camera. This controls where on the screen the camera
     * will render in normalized screen coordinates. Defaults to `[0, 0, 1, 1]`.
     *
     * @type {import('../../../core/math/vec4.js').Vec4}
     */
    set rect(value) {
        this._camera.rect = value;
        this.fire('set:rect', this._camera.rect);
    }

    /**
     * Gets the rendering rectangle for the camera.
     *
     * @type {import('../../../core/math/vec4.js').Vec4}
     */
    get rect() {
        return this._camera.rect;
    }

    set renderSceneColorMap(value) {
        if (value && !this._sceneColorMapRequested) {
            this.requestSceneColorMap(true);
            this._sceneColorMapRequested = true;
        } else if (this._sceneColorMapRequested) {
            this.requestSceneColorMap(false);
            this._sceneColorMapRequested = false;
        }
    }

    get renderSceneColorMap() {
        return this._renderSceneColorMap > 0;
    }

    set renderSceneDepthMap(value) {
        if (value && !this._sceneDepthMapRequested) {
            this.requestSceneDepthMap(true);
            this._sceneDepthMapRequested = true;
        } else if (this._sceneDepthMapRequested) {
            this.requestSceneDepthMap(false);
            this._sceneDepthMapRequested = false;
        }
    }

    get renderSceneDepthMap() {
        return this._renderSceneDepthMap > 0;
    }

    /**
     * Sets the render target to which rendering of the camera is performed. If not set, it will
     * render simply to the screen.
     *
     * @type {import('../../../platform/graphics/render-target.js').RenderTarget}
     */
    set renderTarget(value) {
        this._camera.renderTarget = value;
        this.dirtyLayerCompositionCameras();
    }

    /**
     * Gets the render target to which rendering of the camera is performed.
     *
     * @type {import('../../../platform/graphics/render-target.js').RenderTarget}
     */
    get renderTarget() {
        return this._camera.renderTarget;
    }

    /**
     * Sets the scissor rectangle for the camera. This clips all pixels which are not in the
     * rectangle. The order of the values is `[x, y, width, height]`. Defaults to `[0, 0, 1, 1]`.
     *
     * @type {import('../../../core/math/vec4.js').Vec4}
     */
    set scissorRect(value) {
        this._camera.scissorRect = value;
    }

    /**
     * Gets the scissor rectangle for the camera.
     *
     * @type {import('../../../core/math/vec4.js').Vec4}
     */
    get scissorRect() {
        return this._camera.scissorRect;
    }

    /**
     * Sets the camera sensitivity in ISO. Defaults to 1000. Higher value means more exposure.
     *
     * @type {number}
     */
    set sensitivity(value) {
        this._camera.sensitivity = value;
    }

    /**
     * Gets the camera sensitivity in ISO.
     *
     * @type {number}
     */
    get sensitivity() {
        return this._camera.sensitivity;
    }

    /**
     * Sets the camera shutter speed in seconds. Defaults to 1/1000s. Longer shutter means more exposure.
     *
     * @type {number}
     */
    set shutter(value) {
        this._camera.shutter = value;
    }

    /**
     * Gets the camera shutter speed in seconds.
     *
     * @type {number}
     */
    get shutter() {
        return this._camera.shutter;
    }

    /**
     * Gets the camera's view matrix.
     *
     * @type {import('../../../core/math/mat4.js').Mat4}
     */
    get viewMatrix() {
        return this._camera.viewMatrix;
    }

    /**
     * Based on the value, the depth layer's enable counter is incremented or decremented.
     *
     * @param {boolean} value - True to increment the counter, false to decrement it.
     * @returns {boolean} True if the counter was incremented or decremented, false if the depth
     * layer is not present.
     * @private
     */
    _enableDepthLayer(value) {
        const hasDepthLayer = this.layers.find(layerId => layerId === LAYERID_DEPTH);
        if (hasDepthLayer) {

            /** @type {import('../../../scene/layer.js').Layer} */
            const depthLayer = this.system.app.scene.layers.getLayerById(LAYERID_DEPTH);

            if (value) {
                depthLayer?.incrementCounter();
            } else {
                depthLayer?.decrementCounter();
            }
        } else if (value) {
            return false;
        }

        return true;
    }

    /**
     * Request the scene to generate a texture containing the scene color map. Note that this call
     * is accumulative, and for each enable request, a disable request need to be called.
     *
     * @param {boolean} enabled - True to request the generation, false to disable it.
     */
    requestSceneColorMap(enabled) {
        this._renderSceneColorMap += enabled ? 1 : -1;
        Debug.assert(this._renderSceneColorMap >= 0);
        const ok = this._enableDepthLayer(enabled);
        if (!ok) {
            Debug.warnOnce('CameraComponent.requestSceneColorMap was called, but the camera does not have a Depth layer, ignoring.');
        }

        this.camera._enableRenderPassColorGrab(this.system.app.graphicsDevice, this.renderSceneColorMap);
    }

    /**
     * Request the scene to generate a texture containing the scene depth map. Note that this call
     * is accumulative, and for each enable request, a disable request need to be called.
     *
     * @param {boolean} enabled - True to request the generation, false to disable it.
     */
    requestSceneDepthMap(enabled) {
        this._renderSceneDepthMap += enabled ? 1 : -1;
        Debug.assert(this._renderSceneDepthMap >= 0);
        const ok = this._enableDepthLayer(enabled);
        if (!ok) {
            Debug.warnOnce('CameraComponent.requestSceneDepthMap was called, but the camera does not have a Depth layer, ignoring.');
        }

        this.camera._enableRenderPassDepthGrab(this.system.app.graphicsDevice, this.system.app.renderer, this.renderSceneDepthMap);
    }

    dirtyLayerCompositionCameras() {
        // layer composition needs to update order
        const layerComp = this.system.app.scene.layers;
        layerComp._dirty = true;
    }

    /**
     * Convert a point from 2D screen space to 3D world space.
     *
     * @param {number} screenx - X coordinate on PlayCanvas' canvas element. Should be in the range
     * 0 to `canvas.offsetWidth` of the application's canvas element.
     * @param {number} screeny - Y coordinate on PlayCanvas' canvas element. Should be in the range
     * 0 to `canvas.offsetHeight` of the application's canvas element.
     * @param {number} cameraz - The distance from the camera in world space to create the new
     * point.
     * @param {import('../../../core/math/vec3.js').Vec3} [worldCoord] - 3D vector to receive world
     * coordinate result.
     * @example
     * // Get the start and end points of a 3D ray fired from a screen click position
     * const start = entity.camera.screenToWorld(clickX, clickY, entity.camera.nearClip);
     * const end = entity.camera.screenToWorld(clickX, clickY, entity.camera.farClip);
     *
     * // Use the ray coordinates to perform a raycast
     * app.systems.rigidbody.raycastFirst(start, end, function (result) {
     *     console.log("Entity " + result.entity.name + " was selected");
     * });
     * @returns {import('../../../core/math/vec3.js').Vec3} The world space coordinate.
     */
    screenToWorld(screenx, screeny, cameraz, worldCoord) {
        const device = this.system.app.graphicsDevice;
        const w = device.clientRect.width;
        const h = device.clientRect.height;
        return this._camera.screenToWorld(screenx, screeny, cameraz, w, h, worldCoord);
    }

    /**
     * Convert a point from 3D world space to 2D screen space.
     *
     * @param {import('../../../core/math/vec3.js').Vec3} worldCoord - The world space coordinate.
     * @param {import('../../../core/math/vec3.js').Vec3} [screenCoord] - 3D vector to receive
     * screen coordinate result.
     * @returns {import('../../../core/math/vec3.js').Vec3} The screen space coordinate.
     */
    worldToScreen(worldCoord, screenCoord) {
        const device = this.system.app.graphicsDevice;
        const w = device.clientRect.width;
        const h = device.clientRect.height;
        return this._camera.worldToScreen(worldCoord, w, h, screenCoord);
    }

    /**
     * Called before application renders the scene.
     *
     * @ignore
     */
    onAppPrerender() {
        this._camera._viewMatDirty = true;
        this._camera._viewProjMatDirty = true;
    }

    /** @private */
    addCameraToLayers() {
        const layers = this.layers;
        for (let i = 0; i < layers.length; i++) {
            const layer = this.system.app.scene.layers.getLayerById(layers[i]);
            if (layer) {
                layer.addCamera(this);
            }
        }
    }

    /** @private */
    removeCameraFromLayers() {
        const layers = this.layers;
        for (let i = 0; i < layers.length; i++) {
            const layer = this.system.app.scene.layers.getLayerById(layers[i]);
            if (layer) {
                layer.removeCamera(this);
            }
        }
    }

    /**
     * @param {import('../../../scene/composition/layer-composition.js').LayerComposition} oldComp - Old layer composition.
     * @param {import('../../../scene/composition/layer-composition.js').LayerComposition} newComp - New layer composition.
     * @private
     */
    onLayersChanged(oldComp, newComp) {
        this.addCameraToLayers();
        oldComp.off('add', this.onLayerAdded, this);
        oldComp.off('remove', this.onLayerRemoved, this);
        newComp.on('add', this.onLayerAdded, this);
        newComp.on('remove', this.onLayerRemoved, this);
    }

    /**
     * @param {import('../../../scene/layer.js').Layer} layer - The layer to add the camera to.
     * @private
     */
    onLayerAdded(layer) {
        const index = this.layers.indexOf(layer.id);
        if (index < 0) return;
        layer.addCamera(this);
    }

    /**
     * @param {import('../../../scene/layer.js').Layer} layer - The layer to remove the camera from.
     * @private
     */
    onLayerRemoved(layer) {
        const index = this.layers.indexOf(layer.id);
        if (index < 0) return;
        layer.removeCamera(this);
    }

    onEnable() {
        const system = this.system;
        const scene = system.app.scene;
        const layers = scene.layers;

        system.addCamera(this);

        scene.on('set:layers', this.onLayersChanged, this);
        if (layers) {
            layers.on('add', this.onLayerAdded, this);
            layers.on('remove', this.onLayerRemoved, this);
        }

        if (this.enabled && this.entity.enabled) {
            this.addCameraToLayers();
        }

        this.postEffects.enable();
    }

    onDisable() {
        const system = this.system;
        const scene = system.app.scene;
        const layers = scene.layers;

        this.postEffects.disable();

        this.removeCameraFromLayers();

        scene.off('set:layers', this.onLayersChanged, this);
        if (layers) {
            layers.off('add', this.onLayerAdded, this);
            layers.off('remove', this.onLayerRemoved, this);
        }

        system.removeCamera(this);
    }

    onRemove() {
        this.onDisable();
        this.off();

        this.camera.destroy();
    }

    /**
     * Calculates aspect ratio value for a given render target.
     *
     * @param {import('../../../platform/graphics/render-target.js').RenderTarget|null} [rt] - Optional
     * render target. If unspecified, the backbuffer is used.
     * @returns {number} The aspect ratio of the render target (or backbuffer).
     */
    calculateAspectRatio(rt) {
        const device = this.system.app.graphicsDevice;
        const width = rt ? rt.width : device.width;
        const height = rt ? rt.height : device.height;
        return (width * this.rect.z) / (height * this.rect.w);
    }

    /**
     * Prepare the camera for frame rendering.
     *
     * @param {import('../../../platform/graphics/render-target.js').RenderTarget|null} [rt] - Render
     * target to which rendering will be performed. Will affect camera's aspect ratio, if
     * aspectRatioMode is {@link ASPECT_AUTO}.
     * @ignore
     */
    frameUpdate(rt) {
        if (this.aspectRatioMode === ASPECT_AUTO) {
            this.aspectRatio = this.calculateAspectRatio(rt);
        }
    }

    /**
     * Attempt to start XR session with this camera.
     *
     * @param {string} type - The type of session. Can be one of the following:
     *
     * - {@link XRTYPE_INLINE}: Inline - always available type of session. It has limited feature
     * availability and is rendered into HTML element.
     * - {@link XRTYPE_VR}: Immersive VR - session that provides exclusive access to the VR device
     * with the best available tracking features.
     * - {@link XRTYPE_AR}: Immersive AR - session that provides exclusive access to the VR/AR
     * device that is intended to be blended with the real-world environment.
     *
     * @param {string} spaceType - Reference space type. Can be one of the following:
     *
     * - {@link XRSPACE_VIEWER}: Viewer - always supported space with some basic tracking
     * capabilities.
     * - {@link XRSPACE_LOCAL}: Local - represents a tracking space with a native origin near the
     * viewer at the time of creation. It is meant for seated or basic local XR sessions.
     * - {@link XRSPACE_LOCALFLOOR}: Local Floor - represents a tracking space with a native origin
     * at the floor in a safe position for the user to stand. The y-axis equals 0 at floor level.
     * Floor level value might be estimated by the underlying platform. It is meant for seated or
     * basic local XR sessions.
     * - {@link XRSPACE_BOUNDEDFLOOR}: Bounded Floor - represents a tracking space with its native
     * origin at the floor, where the user is expected to move within a pre-established boundary.
     * - {@link XRSPACE_UNBOUNDED}: Unbounded - represents a tracking space where the user is
     * expected to move freely around their environment, potentially long distances from their
     * starting point.
     *
     * @param {object} [options] - Object with options for XR session initialization.
     * @param {string[]} [options.optionalFeatures] - Optional features for XRSession start. It is
     * used for getting access to additional WebXR spec extensions.
     * @param {boolean} [options.imageTracking] - Set to true to attempt to enable {@link XrImageTracking}.
     * @param {boolean} [options.planeDetection] - Set to true to attempt to enable {@link XrPlaneDetection}.
     * @param {import('../../xr/xr-manager.js').XrErrorCallback} [options.callback] - Optional
     * callback function called once the session is started. The callback has one argument Error -
     * it is null if the XR session started successfully.
     * @param {boolean} [options.anchors] - Optional boolean to attempt to enable {@link XrAnchors}.
     * @param {object} [options.depthSensing] - Optional object with depth sensing parameters to
     * attempt to enable {@link XrDepthSensing}.
     * @param {string} [options.depthSensing.usagePreference] - Optional usage preference for depth
     * sensing, can be 'cpu-optimized' or 'gpu-optimized' (XRDEPTHSENSINGUSAGE_*), defaults to
     * 'cpu-optimized'. Most preferred and supported will be chosen by the underlying depth sensing
     * system.
     * @param {string} [options.depthSensing.dataFormatPreference] - Optional data format
     * preference for depth sensing. Can be 'luminance-alpha' or 'float32' (XRDEPTHSENSINGFORMAT_*),
     * defaults to 'luminance-alpha'. Most preferred and supported will be chosen by the underlying
     * depth sensing system.
     * @example
     * // On an entity with a camera component
     * this.entity.camera.startXr(pc.XRTYPE_VR, pc.XRSPACE_LOCAL, {
     *     callback: function (err) {
     *         if (err) {
     *             // failed to start XR session
     *         } else {
     *             // in XR
     *         }
     *     }
     * });
     */
    startXr(type, spaceType, options) {
        this.system.app.xr.start(this, type, spaceType, options);
    }

    /**
     * Attempt to end XR session of this camera.
     *
     * @param {import('../../xr/xr-manager.js').XrErrorCallback} [callback] - Optional callback
     * function called once session is ended. The callback has one argument Error - it is null if
     * successfully ended XR session.
     * @example
     * // On an entity with a camera component
     * this.entity.camera.endXr(function (err) {
     *     // not anymore in XR
     * });
     */
    endXr(callback) {
        if (!this._camera.xr) {
            if (callback) callback(new Error('Camera is not in XR'));
            return;
        }

        this._camera.xr.end(callback);
    }

    /**
     * Function to copy properties from the source CameraComponent.
     * Properties not copied: postEffects.
     * Inherited properties not copied (all): system, entity, enabled.
     *
     * @param {CameraComponent} source - The source component.
     * @ignore
     */
    copy(source) {
        this.aperture = source.aperture;
        this.aspectRatio = source.aspectRatio;
        this.aspectRatioMode = source.aspectRatioMode;
        this.calculateProjection = source.calculateProjection;
        this.calculateTransform = source.calculateTransform;
        this.clearColor = source.clearColor;
        this.clearColorBuffer = source.clearColorBuffer;
        this.clearDepthBuffer = source.clearDepthBuffer;
        this.clearStencilBuffer = source.clearStencilBuffer;
        this.cullFaces = source.cullFaces;
        this.disablePostEffectsLayer = source.disablePostEffectsLayer;
        this.farClip = source.farClip;
        this.flipFaces = source.flipFaces;
        this.fov = source.fov;
        this.frustumCulling = source.frustumCulling;
        this.horizontalFov = source.horizontalFov;
        this.layers = source.layers;
        this.nearClip = source.nearClip;
        this.orthoHeight = source.orthoHeight;
        this.priority = source.priority;
        this.projection = source.projection;
        this.rect = source.rect;
        this.renderTarget = source.renderTarget;
        this.scissorRect = source.scissorRect;
        this.sensitivity = source.sensitivity;
        this.shutter = source.shutter;
    }
}

export { CameraComponent };
