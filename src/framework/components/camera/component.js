pc.extend(pc, function () {
    /**
     * @component
     * @name pc.CameraComponent
     * @extends pc.Component
     * @class The Camera Component enables an Entity to render the scene. A scene requires at least one
     * enabled camera component to be rendered. Note that multiple camera components can be enabled
     * simulataneously (for split-screen or offscreen rendering, for example).
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
     *     <li>{@link pc.PROJECTION_PERSPECTIVE}: A persepctive projection. The camera frustum resembles a truncated pyramid.</li>
     *     <li>{@link pc.PROJECTION_ORTHOGRAPHIC}: An orthographic projection. The camera frustum is a cuboid.</li>
     * </ul>
     * Defaults to pc.PROJECTION_PERSPECTIVE.
     * @property {Number} nearClip The distance from the camera before which no rendering will take place.
     * @property {Number} farClip The distance from the camera after which no rendering will take place.
     * @property {Number} aspectRatio The aspect ratio of the camera. This is the ratio of width divided by height. Default to 16/9.
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
     * The order of the values is [x, y, width, height].
     * @property {pc.RenderTarget} renderTarget The render target of the camera. Defaults to null, which causes
     * the camera to render to the canvas' back buffer. Setting a valid render target effectively causes the camera
     * to render to an offscreen buffer, which can then be used to achieve certain graphics effect (normally post
     * effects).
     * @property {pc.PostEffectQueue} postEffects The post effects queue for this camera. Use this to add or remove post effects from the camera.
     * @property {Boolean} frustumCulling Controls the culling of mesh instances against the camera frustum. If true, culling is enabled.
     * If false, all mesh instances in the scene are rendered by the camera, regardless of visibility. Defaults to false.
     */
    var CameraComponent = function CameraComponent(system, entity) {
        // Bind event to update hierarchy if camera node changes
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
        this.on("set_horizontalFov", this.onSetHorizontalFov, this);
        this.on("set_frustumCulling", this.onSetFrustumCulling, this);
        this.on("set_stereo", this.onSetStereo, this);
    };
    CameraComponent = pc.inherits(CameraComponent, pc.Component);

    /**
     * @readonly
     * @name pc.CameraComponent#projectionMatrix
     * @type pc.Mat4
     * @description Queries the camera's projection matrix.
     */
    Object.defineProperty(CameraComponent.prototype, "projectionMatrix", {
        get: function() {
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
        get: function() {
            var wtm = this.data.camera._node.getWorldTransform();
            return wtm.clone().invert();
        }
    });

    /**
     * @readonly
     * @name pc.CameraComponent#frustum
     * @type pc.Frustum
     * @description Queries the camera's frustum shape.
     */
    Object.defineProperty(CameraComponent.prototype, "frustum", {
        get: function() {
            return this.data.camera.getFrustum();
        }
    });

    pc.extend(CameraComponent.prototype, {
        /**
         * @function
         * @name pc.CameraComponent#screenToWorld
         * @description Convert a point from 2D screen space to 3D world space.
         * @param {Number} screenx x coordinate on PlayCanvas' canvas element.
         * @param {Number} screeny y coordinate on PlayCanvas' canvas element.
         * @param {Number} cameraz The distance from the camera in world space to create the new point.
         * @param {pc.Vec3} [worldCoord] 3D vector to recieve world coordinate result.
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

        /**
         * @function
         * @name pc.CameraComponent#worldToScreen
         * @description Convert a point from 3D world space to 2D screen space.
         * @param {pc.Vec3} worldCoord The world space coordinate.
         * @param {pc.Vec3} [screenCoord] 3D vector to recieve screen coordinate result.
         * @returns {pc.Vec3} The screen space coordinate.
         */
        worldToScreen: function (worldCoord, screenCoord) {
            var device = this.system.app.graphicsDevice;
            return this.data.camera.worldToScreen(worldCoord, device.clientRect.width, device.clientRect.height, screenCoord);
        },

        onSetAspectRatio: function (name, oldValue, newValue) {
            this.data.camera.setAspectRatio(newValue);
        },

        onSetCamera: function (name, oldValue, newValue) {
            // remove old camera node from hierarchy and add new one
            if (oldValue) {
                oldValue._node = null;
            }
            newValue._node = this.entity;
        },

        onSetClearColor: function (name, oldValue, newValue) {
            var clearOptions = this.data.camera.getClearOptions();
            clearOptions.color[0] = newValue.data[0];
            clearOptions.color[1] = newValue.data[1];
            clearOptions.color[2] = newValue.data[2];
            clearOptions.color[3] = newValue.data[3];
        },

        onSetFov: function (name, oldValue, newValue) {
            this.data.camera.setFov(newValue);
        },

        onSetOrthoHeight: function (name, oldValue, newValue) {
            this.data.camera.setOrthoHeight(newValue);
        },

        onSetNearClip: function (name, oldValue, newValue) {
            this.data.camera.setNearClip(newValue);
        },

        onSetFarClip: function (name, oldValue, newValue) {
            this.data.camera.setFarClip(newValue);
        },

        onSetHorizontalFov: function (name, oldValue, newValue) {
            this.data.camera.setHorizontalFov(newValue);
        },

        onSetFrustumCulling: function (name, oldValue, newValue) {
            this.data.camera.frustumCulling = newValue;
        },

        onSetProjection: function (name, oldValue, newValue) {
            this.data.camera.setProjection(newValue);
        },

        onSetPriority: function (name, oldValue, newValue) {
            this.system.sortCamerasByPriority();
        },

        updateClearFlags: function () {
            var clearOptions = this.data.camera.getClearOptions();
            var flags = 0;
            if (this.clearColorBuffer) {
                flags = flags | pc.CLEARFLAG_COLOR;
            }

            if (this.clearDepthBuffer) {
                flags = flags | pc.CLEARFLAG_DEPTH;
            }

            if (this.clearStencilBuffer) {
                flags = flags | pc.CLEARFLAG_STENCIL;
            }

            clearOptions.flags = flags;
        },

        onSetRenderTarget: function (name, oldValue, newValue) {
            this.data.camera.setRenderTarget(newValue);
        },

        onSetRect: function (name, oldValue, newValue) {
            this.data.camera.setRect(newValue.data[0], newValue.data[1], newValue.data[2], newValue.data[3]);
            this._resetAspectRatio();
        },

        onSetStereo: function (name, oldValue, newValue) {
            this.data.camera.stereo = newValue;
        },

        onEnable: function () {
            CameraComponent._super.onEnable.call(this);
            this.system.addCamera(this);
            this.postEffects.enable();
        },

        onDisable: function () {
            CameraComponent._super.onDisable.call(this);
            this.postEffects.disable();
            this.system.removeCamera(this);
        },

        _resetAspectRatio: function () {
            var camera = this.camera;
            if (camera) {
                if (camera.getRenderTarget()) return;
                var device = this.system.app.graphicsDevice;
                var rect = this.rect;
                var aspect = (device.width * rect.z) / (device.height * rect.w);
                if (aspect !== camera.getAspectRatio()) {
                    camera.setAspectRatio(aspect);
                }
            }
        },

        /**
         * @function
         * @private
         * @name pc.CameraComponent#frameBegin
         * @description Start rendering the frame for this camera.
         */
        frameBegin: function () {
            this._resetAspectRatio();
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
    });

    return {
        CameraComponent: CameraComponent
    };
}());
