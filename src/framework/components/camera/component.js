import { ASPECT_AUTO, LAYERID_UI } from '../../../scene/constants.js';
import { Camera } from '../../../scene/camera.js';

import { Component } from '../component.js';

import { PostEffectQueue } from './post-effect-queue.js';

/**
 * @component
 * @class
 * @name pc.CameraComponent
 * @augments pc.Component
 * @classdesc The Camera Component enables an Entity to render the scene. A scene
 * requires at least one enabled camera component to be rendered. Note that multiple
 * camera components can be enabled simultaneously (for split-screen or offscreen
 * rendering, for example).
 * @description Create a new Camera Component.
 * @param {pc.CameraComponentSystem} system - The ComponentSystem that created this
 * Component.
 * @param {pc.Entity} entity - The Entity that this Component is attached to.
 * @example
 * // Add a pc.CameraComponent to an entity
 * var entity = new pc.Entity();
 * entity.addComponent('camera', {
 *     nearClip: 1,
 *     farClip: 100,
 *     fov: 55
 * });
 * @example
 * // Get the pc.CameraComponent on an entity
 * var cameraComponent = entity.camera;
 * @example
 * // Update a property on a camera component
 * entity.camera.nearClip = 2;
 * @property {number} projection The type of projection used to render the camera.
 * Can be:
 *
 * * {@link pc.PROJECTION_PERSPECTIVE}: A perspective projection. The camera frustum
 * resembles a truncated pyramid.
 * * {@link pc.PROJECTION_ORTHOGRAPHIC}: An orthographic projection. The camera
 * frustum is a cuboid.
 *
 * Defaults to pc.PROJECTION_PERSPECTIVE.
 * @property {number} aspectRatio The aspect ratio (width divided by height) of the
 * camera. If aspectRatioMode is pc.ASPECT_AUTO, then this value will be automatically
 * calculated every frame, and you can only read it. If it's ASPECT_MANUAL, you can set
 * the value.
 * @property {number} aspectRatioMode The aspect ratio mode of the camera. Can be:
 *
 * * {@link pc.ASPECT_AUTO}: aspect ratio will be calculated from the current render
 * target's width divided by height.
 * * {@link pc.ASPECT_MANUAL}: use the aspectRatio value.
 *
 * Defaults to pc.ASPECT_AUTO.
 * @property {pc.Color} clearColor The color used to clear the canvas to before the
 * camera starts to render. Defaults to [0.75, 0.75, 0.75, 1].
 * @property {boolean} clearColorBuffer If true the camera will clear the color buffer
 * to the color set in clearColor. Defaults to true.
 * @property {boolean} clearDepthBuffer If true the camera will clear the depth buffer.
 * Defaults to true.
 * @property {boolean} clearStencilBuffer If true the camera will clear the stencil
 * buffer. Defaults to true.
 * @property {number} farClip The distance from the camera after which no rendering
 * will take place. Defaults to 1000.
 * @property {number} fov The field of view of the camera in degrees. Usually this is
 * the Y-axis field of view, see {@link pc.CameraComponent#horizontalFov}. Used for
 * {@link pc.PROJECTION_PERSPECTIVE} cameras only. Defaults to 45.
 * @property {boolean} horizontalFov Set which axis to use for the Field of View
 * calculation. Defaults to false.
 * @property {number} nearClip The distance from the camera before which no rendering
 * will take place. Defaults to 0.1.
 * @property {number} orthoHeight The half-height of the orthographic view window (in
 * the Y-axis). Used for {@link pc.PROJECTION_ORTHOGRAPHIC} cameras only. Defaults to 10.
 * @property {number} priority Controls the order in which cameras are rendered. Cameras
 * with smaller values for priority are rendered first. Defaults to 0.
 * @property {pc.RenderTarget} renderTarget Render target to which rendering of the cameras
 * is performed. If not set, it will render simply to the screen.
 * @property {pc.Vec4} rect Controls where on the screen the camera will be rendered in
 * normalized screen coordinates. Defaults to [0, 0, 1, 1].
 * @property {pc.Vec4} scissorRect Clips all pixels which are not in the rectangle.
 * The order of the values is [x, y, width, height]. Defaults to [0, 0, 1, 1].
 * @property {pc.PostEffectQueue} postEffects The post effects queue for this camera.
 * Use this to add or remove post effects from the camera.
 * @property {boolean} frustumCulling Controls the culling of mesh instances against
 * the camera frustum, i.e. if objects outside of camera should be omitted from rendering.
 * If false, all mesh instances in the scene are rendered by the camera, regardless of
 * visibility. Defaults to false.
 * @property {pc.callbacks.CalculateMatrix} calculateTransform Custom function you can
 * provide to calculate the camera transformation matrix manually. Can be used for complex
 * effects like reflections. Function is called using component's scope.
 * Arguments:
 * * {pc.Mat4} transformMatrix: output of the function.
 * * {number} view: Type of view. Can be pc.VIEW_CENTER, pc.VIEW_LEFT or pc.VIEW_RIGHT.
 * Left and right are only used in stereo rendering.
 * @property {pc.callbacks.CalculateMatrix} calculateProjection Custom function you can
 * provide to calculate the camera projection matrix manually. Can be used for complex
 * effects like doing oblique projection. Function is called using component's scope.
 * Arguments:
 * * {pc.Mat4} transformMatrix: output of the function
 * * {number} view: Type of view. Can be pc.VIEW_CENTER, pc.VIEW_LEFT or pc.VIEW_RIGHT.
 * Left and right are only used in stereo rendering.
 * @property {boolean} cullFaces If true the camera will take material.cull into account.
 * Otherwise both front and back faces will be rendered. Defaults to true.
 * @property {boolean} flipFaces If true the camera will invert front and back faces.
 * Can be useful for reflection rendering. Defaults to false.
 * @property {number[]} layers An array of layer IDs ({@link pc.Layer#id}) to which this
 * camera should belong. Don't push/pop/splice or modify this array, if you want to
 * change it, set a new one instead. Defaults to [LAYERID_WORLD, LAYERID_DEPTH,
 * LAYERID_SKYBOX, LAYERID_UI, LAYERID_IMMEDIATE].
 * @property {number} stopPostprocessingLayer Layer ID of layer which stops postprocessing of the camera.
 * Defaults to LAYERID_UI, which causes post processing to not be applied to UI layer and
 * any following layers for the camera.
 */
class CameraComponent extends Component {
    constructor(system, entity) {
        super(system, entity);

        this._camera = new Camera();
        this._camera.node = entity;

        this._priority = 0;
        
        // event called when postprocessing should execute
        this.onPostprocessing = null;

        // layer id at which the postprocessing stops for the camera
        this._stopPostprocessingLayer = LAYERID_UI;

        // postprocessing management
        this._postEffects = new PostEffectQueue(system.app, this);
    }

    /**
     * @readonly
     * @name pc.CameraComponent#frustum
     * @type {pc.Frustum}
     * @description Queries the camera's frustum shape.
     */
    /**
     * @readonly
     * @name pc.CameraComponent#projectionMatrix
     * @type {pc.Mat4}
     * @description Queries the camera's projection matrix.
     */
    /**
     * @readonly
     * @name pc.CameraComponent#viewMatrix
     * @type {pc.Mat4}
     * @description Queries the camera's view matrix.
     */

    get camera() {
        return this._camera;
    }

    dirtyLayerCompositionCameras() {
        // layer composition needs to update order
        let layerComp = this.system.app.scene.layers;
        layerComp._dirtyCameras = true;
    }

    get stopPostprocessingLayer() {
        return this._stopPostprocessingLayer;
    }

    set stopPostprocessingLayer(layer) {
        this._stopPostprocessingLayer = layer;
        this.dirtyLayerCompositionCameras();
    }

    get postEffectsEnabled() {
        return this._postEffects.enabled;
    }

    get layers() {
        return this._camera.layers;
    }

    set layers(newValue) {
        var i, layer;
        var layers = this._camera.layers;
        for (i = 0; i < layers.length; i++) {
            layer = this.system.app.scene.layers.getLayerById(layers[i]);
            if (!layer) continue;
            layer.removeCamera(this);
        }

        this._camera.layers = newValue;

        if (!this.enabled || !this.entity.enabled) return;

        for (i = 0; i < newValue.length; i++) {
            layer = this.system.app.scene.layers.getLayerById(newValue[i]);
            if (!layer) continue;
            layer.addCamera(this);
        }
    }

    get postEffects() {
        return this._postEffects;
    }

    get priority() {
        return this._priority;
    }

    set priority(newValue) {
        this._priority = newValue;
        this.dirtyLayerCompositionCameras();
    }


    get clearColorBuffer() {
        return this._camera.clearColorBuffer;
    }

    set clearColorBuffer(value) {
        this._camera.clearColorBuffer = value;
        this.dirtyLayerCompositionCameras();
    }

    get clearDepthBuffer() {
        return this._camera.clearDepthBuffer;
    }

    set clearDepthBuffer(value) {
        this._camera.clearDepthBuffer = value;
        this.dirtyLayerCompositionCameras();
    }

    get clearStencilBuffer() {
        return this._camera.clearStencilBuffer;
    }

    set clearStencilBuffer(value) {
        this._camera.clearStencilBuffer = value;
        this.dirtyLayerCompositionCameras();
    }

    get renderTarget() {
        return this._camera.renderTarget;
    }

    set renderTarget(value) {
        this._camera.renderTarget = value;
        this.dirtyLayerCompositionCameras();
    }

    /**
     * @function
     * @name pc.CameraComponent#screenToWorld
     * @description Convert a point from 2D screen space to 3D world space.
     * @param {number} screenx - X coordinate on PlayCanvas' canvas element.
     * @param {number} screeny - Y coordinate on PlayCanvas' canvas element.
     * @param {number} cameraz - The distance from the camera in world space to create
     * the new point.
     * @param {pc.Vec3} [worldCoord] - 3D vector to receive world coordinate result.
     * @example
     * // Get the start and end points of a 3D ray fired from a screen click position
     * var start = entity.camera.screenToWorld(clickX, clickY, entity.camera.nearClip);
     * var end = entity.camera.screenToWorld(clickX, clickY, entity.camera.farClip);
     *
     * // Use the ray coordinates to perform a raycast
     * app.systems.rigidbody.raycastFirst(start, end, function (result) {
     *     console.log("Entity " + result.entity.name + " was selected");
     * });
     * @returns {pc.Vec3} The world space coordinate.
     */
    screenToWorld(screenx, screeny, cameraz, worldCoord) {
        var device = this.system.app.graphicsDevice;
        var w = device.clientRect.width;
        var h = device.clientRect.height;
        return this._camera.screenToWorld(screenx, screeny, cameraz, w, h, worldCoord);
    }

    /**
     * @function
     * @name pc.CameraComponent#worldToScreen
     * @description Convert a point from 3D world space to 2D screen space.
     * @param {pc.Vec3} worldCoord - The world space coordinate.
     * @param {pc.Vec3} [screenCoord] - 3D vector to receive screen coordinate result.
     * @returns {pc.Vec3} The screen space coordinate.
     */
    worldToScreen(worldCoord, screenCoord) {
        var device = this.system.app.graphicsDevice;
        var w = device.clientRect.width;
        var h = device.clientRect.height;
        return this._camera.worldToScreen(worldCoord, w, h, screenCoord);
    }

    // called before application renders the scene
    onAppPrerender() {
        this._camera._viewMatDirty = true;
        this._camera._viewProjMatDirty = true;
    }

    addCameraToLayers() {
        var layers = this.layers;
        for (var i = 0; i < layers.length; i++) {
            var layer = this.system.app.scene.layers.getLayerById(layers[i]);
            if (layer) {
                layer.addCamera(this);
            }
        }
    }

    removeCameraFromLayers() {
        var layers = this.layers;
        for (var i = 0; i < layers.length; i++) {
            var layer = this.system.app.scene.layers.getLayerById(layers[i]);
            if (layer) {
                layer.removeCamera(this);
            }
        }
    }

    onLayersChanged(oldComp, newComp) {
        this.addCameraToLayers();
        oldComp.off("add", this.onLayerAdded, this);
        oldComp.off("remove", this.onLayerRemoved, this);
        newComp.on("add", this.onLayerAdded, this);
        newComp.on("remove", this.onLayerRemoved, this);
    }

    onLayerAdded(layer) {
        var index = this.layers.indexOf(layer.id);
        if (index < 0) return;
        layer.addCamera(this);
    }

    onLayerRemoved(layer) {
        var index = this.layers.indexOf(layer.id);
        if (index < 0) return;
        layer.removeCamera(this);
    }

    onEnable() {
        var system = this.system;
        var scene = system.app.scene;
        var layers = scene.layers;

        system.addCamera(this);

        scene.on("set:layers", this.onLayersChanged, this);
        if (layers) {
            layers.on("add", this.onLayerAdded, this);
            layers.on("remove", this.onLayerRemoved, this);
        }

        if (this.enabled && this.entity.enabled) {
            this.addCameraToLayers();
        }

        this.postEffects.enable();
    }

    onDisable() {
        var system = this.system;
        var scene = system.app.scene;
        var layers = scene.layers;

        this.postEffects.disable();

        this.removeCameraFromLayers();

        scene.off("set:layers", this.onLayersChanged, this);
        if (layers) {
            layers.off("add", this.onLayerAdded, this);
            layers.off("remove", this.onLayerRemoved, this);
        }

        system.removeCamera(this);
    }

    onRemove() {
        this.onDisable();
        this.off();
    }

    /**
     * @function
     * @name pc.CameraComponent#calculateAspectRatio
     * @description Calculates aspect ratio value for a given render target.
     * @param {pc.RenderTarget} [rt] - Optional render target. If unspecified, the
     * backbuffer is assumed.
     * @returns {number} The aspect ratio of the render target (or backbuffer).
     */
    calculateAspectRatio(rt) {
        var src = rt ? rt : this.system.app.graphicsDevice;
        var rect = this.rect;
        return (src.width * rect.z) / (src.height * rect.w);
    }

    /**
     * @function
     * @private
     * @name pc.CameraComponent#frameBegin
     * @description Start rendering the frame for this camera.
     * @param {pc.RenderTarget} rt - Render target to which rendering will be performed.
     * Will affect camera's aspect ratio, if aspectRatioMode is pc.ASPECT_AUTO.
     */
    frameBegin(rt) {
        if (this.aspectRatioMode === ASPECT_AUTO) {
            this.aspectRatio = this.calculateAspectRatio(rt);
        }
    }

    /**
     * @private
     * @function
     * @name pc.CameraComponent#frameEnd
     * @description End rendering the frame for this camera.
     */
    frameEnd() {}

    /**
     * @private
     * @deprecated
     * @function
     * @name pc.CameraComponent#enterVr
     * @description Attempt to start presenting this camera to a {@link pc.VrDisplay}.
     * @param {pc.callbacks.VrCamera} callback - Function called once to indicate success
     * of failure. The callback takes one argument (err).
     * On success it returns null on failure it returns the error message.
     * @example
     * // On an entity with a camera component
     * this.entity.camera.enterVr(function (err) {
     *     if (err) {
     *         console.error(err);
     *     } else {
     *         // in VR!
     *     }
     * });
     */
    /**
     * @private
     * @deprecated
     * @function
     * @name pc.CameraComponent#enterVr
     * @variation 2
     * @description Attempt to start presenting this camera to a {@link pc.VrDisplay}.
     * @param {pc.VrDisplay} display - The VrDisplay to present. If not supplied this uses
     * {@link pc.VrManager#display} as the default.
     * @param {pc.callbacks.VrCamera} callback - Function called once to indicate success
     * of failure. The callback takes one argument (err). On success it returns null on
     * failure it returns the error message.
     * @example
     * // On an entity with a camera component
     * this.entity.camera.enterVr(function (err) {
     *     if (err) {
     *         console.error(err);
     *     } else {
     *         // in VR!
     *     }
     * });
     */
    enterVr(display, callback) {
        if ((display instanceof Function) && !callback) {
            callback = display;
            display = null;
        }

        if (!this.system.app.vr) {
            callback("VrManager not created. Enable VR in project settings.");
            return;
        }

        if (!display) {
            display = this.system.app.vr.display;
        }

        if (display) {
            var self = this;
            if (display.capabilities.canPresent) {
                // try and present
                display.requestPresent(function (err) {
                    if (!err) {
                        self.vrDisplay = display;
                        // camera component uses internal 'before' event
                        // this means display nulled before anyone other
                        // code gets to update
                        self.vrDisplay.once('beforepresentchange', function (display) {
                            if (!display.presenting) {
                                self.vrDisplay = null;
                            }
                        });
                    }
                    callback(err);
                });
            } else {
                // mono rendering
                self.vrDisplay = display;
                callback();
            }
        } else {
            callback("No pc.VrDisplay to present");
        }
    }

    /**
     * @private
     * @deprecated
     * @function
     * @name pc.CameraComponent#exitVr
     * @description Attempt to stop presenting this camera.
     * @param {pc.callbacks.VrCamera} callback - Function called once to indicate
     * success of failure. The callback takes one argument (err).
     * On success it returns null on failure it returns the error message.
     * @example
     * this.entity.camera.exitVr(function (err) {
     *     if (err) {
     *         console.error(err);
     *     } else {
     *         // exited successfully
     *     }
     * });
     */
    exitVr(callback) {
        if (this.vrDisplay) {
            if (this.vrDisplay.capabilities.canPresent) {
                var display = this.vrDisplay;
                this.vrDisplay = null;
                display.exitPresent(callback);
            } else {
                this.vrDisplay = null;
                callback();
            }
        } else {
            callback("Not presenting VR");
        }
    }

    /**
     * @function
     * @name pc.CameraComponent#startXr
     * @description Attempt to start XR session with this camera
     * @param {string} type - The type of session. Can be one of the following:
     *
     * * {@link pc.XRTYPE_INLINE}: Inline - always available type of session. It has
     * limited feature availability and is rendered into HTML element.
     * * {@link pc.XRTYPE_VR}: Immersive VR - session that provides exclusive access
     * to the VR device with the best available tracking features.
     * * {@link pc.XRTYPE_AR}: Immersive AR - session that provides exclusive access
     * to the VR/AR device that is intended to be blended with the real-world environment.
     *
     * @param {string} spaceType - reference space type. Can be one of the following:
     *
     * * {@link pc.XRSPACE_VIEWER}: Viewer - always supported space with some basic
     * tracking capabilities.
     * * {@link pc.XRSPACE_LOCAL}: Local - represents a tracking space with a native
     * origin near the viewer at the time of creation. It is meant for seated or basic
     * local XR sessions.
     * * {@link pc.XRSPACE_LOCALFLOOR}: Local Floor - represents a tracking space with
     * a native origin at the floor in a safe position for the user to stand. The y-axis
     * equals 0 at floor level. Floor level value might be estimated by the underlying
     * platform. It is meant for seated or basic local XR sessions.
     * * {@link pc.XRSPACE_BOUNDEDFLOOR}: Bounded Floor - represents a tracking space
     * with its native origin at the floor, where the user is expected to move within a
     * pre-established boundary.
     * * {@link pc.XRSPACE_UNBOUNDED}: Unbounded - represents a tracking space where the
     * user is expected to move freely around their environment, potentially long
     * distances from their starting point.
     *
     * @param {object} [options] - object with options for XR session initialization.
     * @param {string[]} [options.optionalFeatures] - Optional features for XRSession start. It is used for getting access to additional WebXR spec extensions.
     * @param {pc.callbacks.XrError} [options.callback] - Optional callback function called once
     * the session is started. The callback has one argument Error - it is null if the XR
     * session started successfully.
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
     * @function
     * @name pc.CameraComponent#endXr
     * @description Attempt to end XR session of this camera
     * @param {pc.callbacks.XrError} [callback] - Optional callback function called once
     * session is ended. The callback has one argument Error - it is null if successfully
     * ended XR session.
     * @example
     * // On an entity with a camera component
     * this.entity.camera.endXr(function (err) {
     *     // not anymore in XR
     * });
     */
    endXr(callback) {
        if (!this._camera.xr) {
            if (callback) callback(new Error("Camera is not in XR"));
            return;
        }

        this._camera.xr.end(callback);
    }
}

// for common properties, create getters and setters which use this._camera as a storage for their values
[
    { name: 'aspectRatio', readonly: false },
    { name: 'aspectRatioMode', readonly: false },
    { name: 'calculateProjection', readonly: false },
    { name: 'calculateTransform', readonly: false },
    { name: 'clearColor', readonly: false },
    { name: 'cullFaces', readonly: false },
    { name: 'farClip', readonly: false },
    { name: 'flipFaces', readonly: false },
    { name: 'fov', readonly: false },
    { name: 'frustum', readonly: true },
    { name: 'frustumCulling', readonly: false },
    { name: 'horizontalFov', readonly: false },
    { name: 'nearClip', readonly: false },
    { name: 'orthoHeight', readonly: false },
    { name: 'projection', readonly: false },
    { name: 'projectionMatrix', readonly: true },
    { name: 'rect', readonly: false },
    { name: 'scissorRect', readonly: false },
    { name: 'viewMatrix', readonly: true },
    { name: 'vrDisplay', readonly: false }
].forEach(function (property) {
    var name = property.name;
    var options = {};

    // getter
    options.get = function () {
        return this._camera[name];
    };

    // setter
    if (!property.readonly) {
        options.set = function (newValue) {
            this._camera[name] = newValue;
        };
    }

    Object.defineProperty(CameraComponent.prototype, name, options);
});

export { CameraComponent };
