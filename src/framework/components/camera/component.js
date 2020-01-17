Object.assign(pc, function () {
    /**
     * @component
     * @class
     * @name pc.CameraComponent
     * @augments pc.Component
     * @classdesc The Camera Component enables an Entity to render the scene. A scene requires at least one
     * enabled camera component to be rendered. Note that multiple camera components can be enabled
     * simultaneously (for split-screen or offscreen rendering, for example).
     * @description Create a new Camera Component.
     * @param {pc.CameraComponentSystem} system The ComponentSystem that created this Component.
     * @param {pc.Entity} entity The Entity that this Component is attached to.
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
     * @property {Number} projection The type of projection used to render the camera. Can be:
     * <ul>
     *     <li>{@link pc.PROJECTION_PERSPECTIVE}: A perspective projection. The camera frustum resembles a truncated pyramid.</li>
     *     <li>{@link pc.PROJECTION_ORTHOGRAPHIC}: An orthographic projection. The camera frustum is a cuboid.</li>
     * </ul>
     * Defaults to pc.PROJECTION_PERSPECTIVE.
     * @property {Number} nearClip The distance from the camera before which no rendering will take place.
     * @property {Number} farClip The distance from the camera after which no rendering will take place.
     * @property {Number} aspectRatioMode The aspect ratio mode of the camera. Can be pc.ASPECT_AUTO (default) or pc.ASPECT_MANUAL. ASPECT_AUTO will always be current render target's width divided by height. ASPECT_MANUAL will use the aspectRatio value instead.
     * @property {Number} aspectRatio The aspect ratio (width divided by height) of the camera. If aspectRatioMode is ASPECT_AUTO, then this value will be automatically calculated every frame, and you can only read it. If it's ASPECT_MANUAL, you can set the value.
     * @property {Boolean} horizontalFov Set which axis to use for the Field of View calculation. Defaults to false (use Y-axis).
     * @property {Number} fov The field of view of the camera in degrees. Usually this is the Y-axis field of
     * view, see {@link pc.CameraComponent#horizontalFov}. Used for {@link pc.PROJECTION_PERSPECTIVE} cameras only. Defaults to 45.
     * @property {Number} orthoHeight The half-height of the orthographic view window (in the Y-axis). Used for
     * {@link pc.PROJECTION_ORTHOGRAPHIC} cameras only. Defaults to 10.
     * @property {Number} priority Controls the order in which cameras are rendered. Cameras with smaller values for priority are rendered first.
     * @property {pc.Color} clearColor The color used to clear the canvas to before the camera starts to render.
     * @property {Boolean} clearColorBuffer If true the camera will clear the color buffer to the color set in clearColor.
     * @property {Boolean} clearDepthBuffer If true the camera will clear the depth buffer.
     * @property {Boolean} clearStencilBuffer If true the camera will clear the stencil buffer.
     * @property {pc.Vec4} rect Controls where on the screen the camera will be rendered in normalized screen coordinates.
     * @property {pc.Vec4} scissorRect Clips all pixels which are not in the rectangle.
     * The order of the values is [x, y, width, height].
     * @property {pc.PostEffectQueue} postEffects The post effects queue for this camera. Use this to add or remove post effects from the camera.
     * @property {Boolean} frustumCulling Controls the culling of mesh instances against the camera frustum, i.e. if objects outside of camera should be omitted from rendering.
     * If true, culling is enabled.
     * If false, all mesh instances in the scene are rendered by the camera, regardless of visibility. Defaults to false.
     * @property {pc.callbacks.CalculateMatrix} calculateTransform Custom function you can provide to calculate the camera transformation matrix manually. Can be used for complex effects like reflections. Function is called using component's scope.
     * Arguments:
     *     <li>{pc.Mat4} transformMatrix: output of the function</li>
     *     <li>{Number} view: Type of view. Can be pc.VIEW_CENTER, pc.VIEW_LEFT or pc.VIEW_RIGHT. Left and right are only used in stereo rendering.</li>
     * @property {pc.callbacks.CalculateMatrix} calculateProjection Custom function you can provide to calculate the camera projection matrix manually. Can be used for complex effects like doing oblique projection. Function is called using component's scope.
     * Arguments:
     *     <li>{pc.Mat4} transformMatrix: output of the function</li>
     *     <li>{Number} view: Type of view. Can be pc.VIEW_CENTER, pc.VIEW_LEFT or pc.VIEW_RIGHT. Left and right are only used in stereo rendering.</li>
     * @property {Boolean} cullFaces If true the camera will take material.cull into account. Otherwise both front and back faces will be rendered.
     * @property {Boolean} flipFaces If true the camera will invert front and back faces. Can be useful for reflection rendering.
     * @property {Number[]} layers An array of layer IDs ({@link pc.Layer#id}) to which this camera should belong.
     * Don't push/pop/splice or modify this array, if you want to change it - set a new one instead.
     */
    var CameraComponent = function CameraComponent(system, entity) {
        pc.Component.call(this, system, entity);

        // Bind event to update hierarchy if camera node changes
        this.on("set_aspectRatioMode", this.onSetAspectRatioMode, this);
        this.on("set_aspectRatio", this.onSetAspectRatio, this);
        this.on("set_camera", this.onSetCamera, this);
        this.on("set_clearColor", this.onSetClearColor, this);
        this.on("set_fov", this.onSetFov, this);
        this.on("set_orthoHeight", this.onSetOrthoHeight, this);
        this.on("set_nearClip", this.onSetNearClip, this);
        this.on("set_farClip", this.onSetFarClip, this);
        this.on("set_projection", this.onSetProjection, this);
        this.on("set_priority", this.onSetPriority, this);
        this.on("set_clearColorBuffer", this.updateClearFlags, this);
        this.on("set_clearDepthBuffer", this.updateClearFlags, this);
        this.on("set_clearStencilBuffer", this.updateClearFlags, this);
        this.on("set_renderTarget", this.onSetRenderTarget, this);
        this.on("set_rect", this.onSetRect, this);
        this.on("set_scissorRect", this.onSetScissorRect, this);
        this.on("set_horizontalFov", this.onSetHorizontalFov, this);
        this.on("set_frustumCulling", this.onSetFrustumCulling, this);
        this.on("set_calculateTransform", this.onSetCalculateTransform, this);
        this.on("set_calculateProjection", this.onSetCalculateProjection, this);
        this.on("set_cullFaces", this.onSetCullFaces, this);
        this.on("set_flipFaces", this.onSetFlipFaces, this);
        this.on("set_layers", this.onSetLayers, this);
    };
    CameraComponent.prototype = Object.create(pc.Component.prototype);
    CameraComponent.prototype.constructor = CameraComponent;

    /**
     * @readonly
     * @name pc.CameraComponent#projectionMatrix
     * @type pc.Mat4
     * @description Queries the camera's projection matrix.
     */
    Object.defineProperty(CameraComponent.prototype, "projectionMatrix", {
        get: function () {
            return this.data.camera.getProjectionMatrix();
        }
    });

    /**
     * @readonly
     * @name pc.CameraComponent#viewMatrix
     * @type pc.Mat4
     * @description Queries the camera's view matrix.
     */
    Object.defineProperty(CameraComponent.prototype, "viewMatrix", {
        get: function () {
            return this.data.camera.getViewMatrix();
        }
    });

    /**
     * @readonly
     * @name pc.CameraComponent#frustum
     * @type pc.Frustum
     * @description Queries the camera's frustum shape.
     */
    Object.defineProperty(CameraComponent.prototype, "frustum", {
        get: function () {
            return this.data.camera.frustum;
        }
    });

    /**
     * @name pc.CameraComponent#vrDisplay
     * @type pc.VrDisplay
     * @description The {@link pc.VrDisplay} that the camera is current displaying to. This is set automatically by calls to {@link pc.CameraComponent#enterVr}
     * or {@link pc.CameraComponent#exitVr}. Setting this property to a display directly enables the camera to use the transformation information
     * from a display without rendering stereo to it, e.g. for "magic window" style experiences.
     * @example
     * // enable magic window style interface
     * var display = this.app.vr.display;
     * if (display) {
     *     this.entity.camera.vrDisplay = display;
     * }
     *
     * var camera = this.entity.camera;
     * camera.enterVr(function (err) {
     *     if (err) return;
     *     var display = camera.vrDisplay; // access presenting pc.VrDisplay
     * });
     */
    Object.defineProperty(CameraComponent.prototype, "vrDisplay", {
        get: function () {
            return this.data.camera.vrDisplay;
        },
        set: function (value) {
            this.data.camera.vrDisplay = value;
            if (value) {
                value._camera = this.data.camera;
            }
        }
    });

    /**
     * @readonly
     * @name pc.CameraComponent#node
     * @type pc.GraphNode
     * @description Queries the camera's GraphNode. Can be used to get position and rotation.
     */
    Object.defineProperty(CameraComponent.prototype, "node", {
        get: function () {
            return this.data.camera._node;
        }
    });

    Object.assign(CameraComponent.prototype, {
        /**
         * @function
         * @name pc.CameraComponent#screenToWorld
         * @description Convert a point from 2D screen space to 3D world space.
         * @param {Number} screenx x coordinate on PlayCanvas' canvas element.
         * @param {Number} screeny y coordinate on PlayCanvas' canvas element.
         * @param {Number} cameraz The distance from the camera in world space to create the new point.
         * @param {pc.Vec3} [worldCoord] 3D vector to receive world coordinate result.
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
        screenToWorld: function (screenx, screeny, cameraz, worldCoord) {
            var device = this.system.app.graphicsDevice;
            return this.data.camera.screenToWorld(screenx, screeny, cameraz, device.clientRect.width, device.clientRect.height, worldCoord);
        },

        onPrerender: function () {
            this.data.camera._viewMatDirty = true;
            this.data.camera._viewProjMatDirty = true;
        },

        /**
         * @function
         * @name pc.CameraComponent#worldToScreen
         * @description Convert a point from 3D world space to 2D screen space.
         * @param {pc.Vec3} worldCoord The world space coordinate.
         * @param {pc.Vec3} [screenCoord] 3D vector to receive screen coordinate result.
         * @returns {pc.Vec3} The screen space coordinate.
         */
        worldToScreen: function (worldCoord, screenCoord) {
            var device = this.system.app.graphicsDevice;
            return this.data.camera.worldToScreen(worldCoord, device.clientRect.width, device.clientRect.height, screenCoord);
        },

        onSetAspectRatioMode: function (name, oldValue, newValue) {
            this.data.camera.aspectRatioMode = newValue;
        },

        onSetAspectRatio: function (name, oldValue, newValue) {
            this.data.camera.aspectRatio = newValue;
        },

        onSetCamera: function (name, oldValue, newValue) {
            // remove old camera node from hierarchy and add new one
            if (oldValue) {
                oldValue._node = null;
            }
            newValue._node = this.entity;
        },

        onSetClearColor: function (name, oldValue, newValue) {
            var clearColor = this.data.camera.clearColor;
            clearColor[0] = newValue.r;
            clearColor[1] = newValue.g;
            clearColor[2] = newValue.b;
            clearColor[3] = newValue.a;
        },

        onSetFov: function (name, oldValue, newValue) {
            this.data.camera.fov = newValue;
        },

        onSetOrthoHeight: function (name, oldValue, newValue) {
            this.data.camera.orthoHeight = newValue;
        },

        onSetNearClip: function (name, oldValue, newValue) {
            this.data.camera.nearClip = newValue;
        },

        onSetFarClip: function (name, oldValue, newValue) {
            this.data.camera.farClip = newValue;
        },

        onSetHorizontalFov: function (name, oldValue, newValue) {
            this.data.camera.horizontalFov = newValue;
        },

        onSetFrustumCulling: function (name, oldValue, newValue) {
            this.data.camera.frustumCulling = newValue;
        },

        onSetCalculateTransform: function (name, oldValue, newValue) {
            this._calculateTransform = newValue;
            this.camera.overrideCalculateTransform = !!newValue;
        },

        onSetCalculateProjection: function (name, oldValue, newValue) {
            this._calculateProjection = newValue;
            this.camera._projMatDirty = true;
            this.camera.overrideCalculateProjection = !!newValue;
        },

        onSetCullFaces: function (name, oldValue, newValue) {
            this.camera._cullFaces = newValue;
        },

        onSetFlipFaces: function (name, oldValue, newValue) {
            this.camera._flipFaces = newValue;
        },

        onSetProjection: function (name, oldValue, newValue) {
            this.data.camera.projection = newValue;
        },

        onSetPriority: function (name, oldValue, newValue) {
            var layer;
            for (var i = 0; i < this.layers.length; i++) {
                layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
                if (!layer) continue;
                layer._sortCameras();
            }
        },

        onSetLayers: function (name, oldValue, newValue) {
            var i, layer;
            for (i = 0; i < oldValue.length; i++) {
                layer = this.system.app.scene.layers.getLayerById(oldValue[i]);
                if (!layer) continue;
                layer.removeCamera(this);
            }
            if (!this.enabled || !this.entity.enabled) return;
            for (i = 0; i < newValue.length; i++) {
                layer = this.system.app.scene.layers.getLayerById(newValue[i]);
                if (!layer) continue;
                layer.addCamera(this);
            }
        },

        addCameraToLayers: function () {
            var layer;
            for (var i = 0; i < this.layers.length; i++) {
                layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
                if (!layer) continue;
                layer.addCamera(this);
            }
        },

        removeCameraFromLayers: function () {
            var layer;
            for (var i = 0; i < this.layers.length; i++) {
                layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
                if (!layer) continue;
                layer.removeCamera(this);
            }
        },

        onLayersChanged: function (oldComp, newComp) {
            this.addCameraToLayers();
            oldComp.off("add", this.onLayerAdded, this);
            oldComp.off("remove", this.onLayerRemoved, this);
            newComp.on("add", this.onLayerAdded, this);
            newComp.on("remove", this.onLayerRemoved, this);
        },

        onLayerAdded: function (layer) {
            var index = this.layers.indexOf(layer.id);
            if (index < 0) return;
            layer.addCamera(this);
        },

        onLayerRemoved: function (layer) {
            var index = this.layers.indexOf(layer.id);
            if (index < 0) return;
            layer.removeCamera(this);
        },

        updateClearFlags: function () {
            var flags = 0;

            if (this.clearColorBuffer)
                flags |= pc.CLEARFLAG_COLOR;

            if (this.clearDepthBuffer)
                flags |= pc.CLEARFLAG_DEPTH;

            if (this.clearStencilBuffer)
                flags |= pc.CLEARFLAG_STENCIL;

            this.data.camera.clearFlags = flags;
        },

        onSetRenderTarget: function (name, oldValue, newValue) {
            this.data.camera.renderTarget = newValue;
        },

        onSetRect: function (name, oldValue, newValue) {
            this.data.camera.setRect(newValue.x, newValue.y, newValue.z, newValue.w);
        },

        onSetScissorRect: function (name, oldValue, newValue) {
            this.data.camera.setScissorRect(newValue.x, newValue.y, newValue.z, newValue.w);
        },

        onEnable: function () {
            this.system.addCamera(this);

            this.system.app.scene.on("set:layers", this.onLayersChanged, this);
            if (this.system.app.scene.layers) {
                this.system.app.scene.layers.on("add", this.onLayerAdded, this);
                this.system.app.scene.layers.on("remove", this.onLayerRemoved, this);
            }

            if (this.enabled && this.entity.enabled) {
                this.addCameraToLayers();
            }

            this.postEffects.enable();
        },

        onDisable: function () {
            this.postEffects.disable();

            this.removeCameraFromLayers();

            this.system.app.scene.off("set:layers", this.onLayersChanged, this);
            if (this.system.app.scene.layers) {
                this.system.app.scene.layers.off("add", this.onLayerAdded, this);
                this.system.app.scene.layers.off("remove", this.onLayerRemoved, this);
            }

            this.system.removeCamera(this);
        },

        onRemove: function () {
            this.onDisable();
            this.off();
        },

        /**
         * @function
         * @name pc.CameraComponent#calculateAspectRatio
         * @description Calculates aspect ratio value for a given render target.
         * @param {pc.RenderTarget} [rt] Optional render target. If unspecified, the backbuffer is assumed.
         * @returns {Number} The aspect ratio of the render target (or backbuffer).
         */
        calculateAspectRatio: function (rt) {
            var src = rt ? rt : this.system.app.graphicsDevice;
            var rect = this.rect;
            return (src.width * rect.z) / (src.height * rect.w);
        },

        /**
         * @function
         * @private
         * @name pc.CameraComponent#frameBegin
         * @description Start rendering the frame for this camera.
         * @param {pc.RenderTarget} rt Render target to which rendering will be performed. Will affect camera's aspect ratio, if aspectRatioMode is pc.ASPECT_AUTO.
         */
        frameBegin: function (rt) {
            if (this.aspectRatioMode === pc.ASPECT_AUTO) {
                this.aspectRatio = this.calculateAspectRatio(rt);
            }
            this.data.isRendering = true;
        },

        /**
         * @private
         * @function
         * @name pc.CameraComponent#frameEnd
         * @description End rendering the frame for this camera
         */
        frameEnd: function () {
            this.data.isRendering = false;
        },

        /**
         * @function
         * @name pc.CameraComponent#enterVr
         * @description Attempt to start presenting this camera to a {@link pc.VrDisplay}.
         * @param {pc.callbacks.VrCamera} callback Function called once to indicate success of failure. The callback takes one argument (err).
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
         * @function
         * @name pc.CameraComponent#enterVr
         * @variation 2
         * @description Attempt to start presenting this camera to a {@link pc.VrDisplay}.
         * @param {pc.VrDisplay} display The VrDisplay to present. If not supplied this uses {@link pc.VrManager#display} as the default
         * @param {pc.callbacks.VrCamera} callback Function called once to indicate success of failure. The callback takes one argument (err).
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
        enterVr: function (display, callback) {
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
        },

        /**
         * @function
         * @name pc.CameraComponent#exitVr
         * @description Attempt to stop presenting this camera.
         * @param {pc.callbacks.VrCamera} callback Function called once to indicate success of failure. The callback takes one argument (err).
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
        exitVr: function (callback) {
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
    });

    return {
        CameraComponent: CameraComponent
    };
}());
