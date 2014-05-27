pc.extend(pc.fw, function () {
    /**
    * @component
    * @name pc.fw.CameraComponent
    * @class The Camera Component enables an Entity to render the scene.
    * @constructor Create a new Camera Component
    * @param {pc.fw.CameraComponentSystem} system The ComponentSystem that created this Component
    * @param {pc.fw.Entity} entity The Entity that this Component is attached to.
    * @extends pc.fw.Component
    * @property {Boolean} enabled If true the camera will be added to the active cameras of the {@link pc.fw.CameraComponentSystem} and rendered with all the other active cameras.
    * @property {Number} aspectRatio The aspect ratio of the camera's viewport (width / height). Defaults to 16 / 9.
    * @property {pc.scene.Camera} camera The {@link pc.scene.CameraNode} used to render the scene
    * @property {pc.Color} clearColor The color used to clear the canvas to before the camera starts to render
    * @property {Number} nearClip The distance from the camera before which no rendering will take place
    * @property {Number} farClip The distance from the camera after which no rendering will take place
    * @property {Number} fov The Y-axis field of view of the camera, in degrees. Used for {@link pc.scene.Projection.PERSPECTIVE} cameras only. Defaults to 45.
    * @property {Number} orthoHeight The half-height of the orthographic view window (in the Y-axis). Used for {@link pc.scene.Projection.ORTHOGRAPHIC} cameras only. Defaults to 10.
    * @property {Number} aspectRatio The aspect ratio of the camera. This is the ratio of width divided by height. Default to 16/9.
    * @property {pc.scene.Projection} projection The type of projection used to render the camera.
    * @property {Number} priority Controls which camera will be rendered first. Smaller numbers are rendered first.
    * @property {Boolean} clearColorBuffer If true the camera will clear the color buffer to the color set in clearColor.
    * @property {Boolean} clearDepthBuffer If true the camera will clear the depth buffer.
    * @property {pc.Vec4} rect Controls where on the screen the camera will be rendered in normalized screen coordinates. The order of the values is [x, y, width, height]
    * @property {pc.gfx.RenderTarget} renderTarget The render target of the camera. Defaults to null, which causes
    * the camera to render to the canvas' back buffer. Setting a valid render target effectively causes the camera
    * to render to an offscreen buffer, which can then be used to achieve certain graphics effect (normally post
    * effects).
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
    };
    CameraComponent = pc.inherits(CameraComponent, pc.fw.Component);

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

    pc.extend(CameraComponent.prototype, {
        /**
         * @function
         * @name pc.fw.CameraComponent#screenToWorld
         * @description Convert a point from 2D screen space to 3D world space.
         * @param {Number} x x coordinate on PlayCanvas' canvas element.
         * @param {Number} y y coordinate on PlayCanvas' canvas element.
         * @param {Number} z The distance from the camera in world space to create the new point.
         * @param {pc.Vec3} [worldCoord] 3D vector to recieve world coordinate result.
         * @returns {pc.Vec3} The world space coordinate.
         */
        screenToWorld: function (x, y, z, worldCoord) {
            var device = this.system.context.graphicsDevice;
            var width = parseInt(device.canvas.style.width);
            var height = parseInt(device.canvas.style.height);
            return this.data.camera.screenToWorld(x, y, z, width, height, worldCoord);
        },

        onSetAspectRatio: function (name, oldValue, newValue) {
            this.data.camera.setAspectRatio(newValue);
        },

        onSetCamera: function (name, oldValue, newValue) {
            // remove old camera node from hierarchy and add new one
            if (oldValue) {
                this.entity.removeChild(oldValue);
            }
            this.entity.addChild(newValue);
        },

        onSetClearColor: function (name, oldValue, newValue) {
            var clearOptions = this.data.camera.getClearOptions();
            clearOptions.color[0] = newValue.r;
            clearOptions.color[1] = newValue.g;
            clearOptions.color[2] = newValue.b;
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
                flags = flags | pc.gfx.CLEARFLAG_COLOR;
            }

            if (this.clearDepthBuffer) {
                flags = flags | pc.gfx.CLEARFLAG_DEPTH;
            }

            clearOptions.flags = flags;
        },

        onSetRenderTarget: function (name, oldValue, newValue) {
            this.data.camera.setRenderTarget(newValue);
        },

        onSetRect: function (name, oldValue, newValue) {
            this.data.camera.setRect(newValue.data[0], newValue.data[1], newValue.data[2], newValue.data[3]);
        },

        onEnable: function () {
            CameraComponent._super.onEnable.call(this);
            this.system.addCamera(this);
        },

        onDisable: function () {
            CameraComponent._super.onDisable.call(this);
            this.system.removeCamera(this);
        },

        /**
         * Start rendering the frame for this camera
         * @function
         * @private
         * @name pc.fw.CameraComponent#frameBegin
         */
        frameBegin: function () {
            var camera = this.camera;
            if (camera) {
                var device = this.system.context.graphicsDevice;
                var aspect = device.width / device.height;
                if (aspect !== camera.getAspectRatio()) {
                    camera.setAspectRatio(aspect);
                }
            }
        },

        /**
         * End rendering the frame for this camera
         * @function
         * @private
         * @name pc.fw.CameraComponent#frameEnd
         */
        frameEnd: function () {
        },
    });

    return {
        CameraComponent: CameraComponent
    };
}());
