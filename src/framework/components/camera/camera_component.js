pc.extend(pc, function () {
    /**
    * @component
    * @name pc.CameraComponent
    * @class The Camera Component enables an Entity to render the scene.
    * @constructor Create a new Camera Component
    * @param {pc.CameraComponentSystem} system The ComponentSystem that created this Component
    * @param {pc.Entity} entity The Entity that this Component is attached to.
    * @extends pc.Component
    * @property {Boolean} enabled If true the camera will be render the active scene. Note that multiple cameras
    * can be enabled simulataneously.
    * @property {Number} aspectRatio The aspect ratio of the camera's viewport (width / height). Defaults to 16 / 9.
    * @property {pc.Color} clearColor The color used to clear the canvas to before the camera starts to render
    * @property {Number} nearClip The distance from the camera before which no rendering will take place
    * @property {Number} farClip The distance from the camera after which no rendering will take place
    * @property {Number} fov The field of view of the camera, in degrees. Usually this is the Y-axis field of view, see {@link pc.CameraComponent#horizontalFov}. Used for {@link pc.PROJECTION_PERSPECTIVE} cameras only. Defaults to 45.
    * @property {Number} orthoHeight The half-height of the orthographic view window (in the Y-axis). Used for {@link pc.PROJECTION_ORTHOGRAPHIC} cameras only. Defaults to 10.
    * @property {Number} aspectRatio The aspect ratio of the camera. This is the ratio of width divided by height. Default to 16/9.
    * @property {Boolean} horizontalFov Set which axis to use for the Field of View calculation. Defaults to false (use Y-axis).
    * @property {pc.Projection} projection The type of projection used to render the camera.
    * @property {Number} priority Controls which camera will be rendered first. Smaller numbers are rendered first.
    * @property {Boolean} clearColorBuffer If true the camera will clear the color buffer to the color set in clearColor.
    * @property {Boolean} clearDepthBuffer If true the camera will clear the depth buffer.
    * @property {pc.Vec4} rect Controls where on the screen the camera will be rendered in normalized screen coordinates. The order of the values is [x, y, width, height]
    * @property {pc.RenderTarget} renderTarget The render target of the camera. Defaults to null, which causes
    * @property {pc.PostEffectQueue} postEffects The post effects queue for this camera. Use this to add / remove post effects from the camera.
    * the camera to render to the canvas' back buffer. Setting a valid render target effectively causes the camera
    * to render to an offscreen buffer, which can then be used to achieve certain graphics effect (normally post
    * effects).
    * @property {pc.Mat4} projectionMatrix [Read only] The camera's projection matrix.
    * @property {pc.Mat4} viewMatrix [Read only] The camera's view matrix.
    * @property {pc.Frustum} frustum [Read only] The camera's frustum shape.
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
        this.on("set_renderTarget", this.onSetRenderTarget, this);
        this.on("set_rect", this.onSetRect, this);
        this.on("set_horizontalFov", this.onSetHorizontalFov, this);
        this.on("set_frustumCulling", this.onSetFrustumCulling, this);
    };
    CameraComponent = pc.inherits(CameraComponent, pc.Component);

    Object.defineProperty(CameraComponent.prototype, "activate", {
        get: function() {
            console.warn("WARNING: activate: Property is deprecated. Query enabled property instead.");
            return this.enabled;
        },
        set: function(value) {
            console.warn("WARNING: activate: Property is deprecated. Set enabled property instead.");
            this.enabled = value;
        },
    });

    Object.defineProperty(CameraComponent.prototype, "projectionMatrix", {
        get: function() {
            return this.data.camera.getProjectionMatrix();
        }
    });

    Object.defineProperty(CameraComponent.prototype, "viewMatrix", {
        get: function() {
            var wtm = this.data.camera._node.getWorldTransform();
            return wtm.clone().invert();
        }
    });

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
         * @returns {pc.Vec3} The world space coordinate.
         */
        screenToWorld: function (screenx, screeny, cameraz, worldCoord) {
            var device = this.system.app.graphicsDevice;
            var width = parseInt(device.canvas.clientWidth);
            var height = parseInt(device.canvas.clientHeight);
            return this.data.camera.screenToWorld(screenx, screeny, cameraz, width, height, worldCoord);
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
            var width = parseInt(device.canvas.clientWidth);
            var height = parseInt(device.canvas.clientHeight);
            return this.data.camera.worldToScreen(worldCoord, width, height, screenCoord);
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
            clearOptions.color[0] = newValue.r;
            clearOptions.color[1] = newValue.g;
            clearOptions.color[2] = newValue.b;
            clearOptions.color[3] = newValue.a;
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

            clearOptions.flags = flags;
        },

        onSetRenderTarget: function (name, oldValue, newValue) {
            this.data.camera.setRenderTarget(newValue);
        },

        onSetRect: function (name, oldValue, newValue) {
            this.data.camera.setRect(newValue.data[0], newValue.data[1], newValue.data[2], newValue.data[3]);
            this._resetAspectRatio();
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
                var device = this.system.app.graphicsDevice;
                var rect = this.rect;
                var aspect = (device.width * rect.z) / (device.height * rect.w);
                if (aspect !== camera.getAspectRatio()) {
                    camera.setAspectRatio(aspect);
                }
            }
        },

        /**
         * Start rendering the frame for this camera
         * @function
         * @private
         * @name pc.CameraComponent#frameBegin
         */
        frameBegin: function () {
            this._resetAspectRatio();
            this.data.isRendering = true;
        },

        /**
         * End rendering the frame for this camera
         * @function
         * @private
         * @name pc.CameraComponent#frameEnd
         */
        frameEnd: function () {
            this.data.isRendering = false;
        },
    });

    return {
        CameraComponent: CameraComponent
    };
}());
