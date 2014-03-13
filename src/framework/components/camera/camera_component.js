pc.extend(pc.fw, function () {
    /**
    * @component
    * @name pc.fw.CameraComponent
    * @class The Camera Component enables an Entity to render the scene.
    * @constructor Create a new Camera Component
    * @param {pc.fw.CameraComponentSystem} system The ComponentSystem that created this Component
    * @param {pc.fw.Entity} entity The Entity that this Component is attached to.
    * @extends pc.fw.Component
    * @property {Boolean} enabled If true the {@link pc.fw.CameraComponentSystem} will set {@link pc.fw.CameraComponentSystem#current} to this camera. Otherwise if there is another enabled {@link pc.fw.CameraComponentSystem} then that will become the current camera.
    * @property {Number} aspectRatio The aspect ratio of the camera's viewport (width / height). Defaults to 16 / 9.
    * @property {pc.scene.Camera} camera The {@link pc.scene.CameraNode} used to render the scene
    * @property {pc.Color} clearColor The color used to clear the canvas to before the camera starts to render
    * @property {Number} nearClip The distance from the camera before which no rendering will take place
    * @property {Number} farClip The distance from the camera after which no rendering will take place
    * @property {Number} fov The Y-axis field of view of the camera, in degrees. Used for {@link pc.scene.Projection.PERSPECTIVE} cameras only. Defaults to 45.
    * @property {Number} orthoHeight The half-height of the orthographic view window (in the Y-axis). Used for {@link pc.scene.Projection.ORTHOGRAPHIC} cameras only. Defaults to 10.
    * @property {Number} aspectRatio The aspect ratio of the camera. This is the ratio of width divided by height. Default to 16/9.
    * @property {pc.scene.Projection} projection The type of projection used to render the camera.
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
        this.on("set_renderTarget", this.onSetRenderTarget, this);
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

        onSetRenderTarget: function (name, oldValue, newValue) {
            this.data.camera.setRenderTarget(newValue);
        },

        onEnable: function () {
            CameraComponent._super.onEnable.call(this);
            this.system.current = this.entity;
        },

        onDisable: function () {
            CameraComponent._super.onDisable.call(this);
            if (this.system.current === this.entity) {
                this.system.current = null;
                this.system.onCameraDisabled(this);
            }
        }    
    });

    return {
        CameraComponent: CameraComponent
    }; 
}());
