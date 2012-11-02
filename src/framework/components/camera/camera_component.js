pc.extend(pc.fw, function () {
    var CameraComponent = function CameraComponent(entity) {
        // Bind event to update hierarchy if camera node changes
        this.bind("set_camera", this.onSetCamera.bind(this));
        this.bind("set_clearColor", this.onSetClearColor.bind(this));
        this.bind("set_fov", this.onSetFov.bind(this));
        this.bind("set_orthoHeight", this.onSetOrthoHeight.bind(this));
        this.bind("set_nearClip", this.onSetNearClip.bind(this));
        this.bind("set_farClip", this.onSetFarClip.bind(this));
        this.bind("set_projection", this.onSetProjection.bind(this));
    };
    CameraComponent = pc.inherits(CameraComponent, pc.fw.Component);

    pc.extend(CameraComponent.prototype, {
        onSetCamera: function (oldValue, newValue) {
            // remove old camera node from hierarchy and add new one
            if (oldValue) {
                this.entity.removeChild(oldValue);
            }        
            this.entity.addChild(newValue);
        },
        onSetClearColor: function (oldValue, newValue) {
            var color = parseInt(newValue);
            this.data.camera.getClearOptions().color = [
                ((color >> 24) & 0xff) / 255.0,
                ((color >> 16) & 0xff) / 255.0,
                ((color >> 8) & 0xff) / 255.0,
                ((color) & 0xff) / 255.0
            ];
        },
        onSetFov: function (oldValue, newValue) {
            this.data.camera.setFov(newValue);
        },
        onSetOrthoHeight: function (oldValue, newValue) {
            this.data.camera.setOrthoHeight(newValue);
        },
        onSetNearClip: function (oldValue, newValue) {
            this.data.camera.setNearClip(newValue);
        },
        onSetFarClip: function (oldValue, newValue) {
            this.data.camera.setFarClip(newValue);
        },
        onSetProjection: function (oldValue, newValue) {
            this.data.camera.setProjection(newValue);
        }
    });

    /**
     * @name pc.fw.CameraComponentSystem
     * @class A Camera Component is used to render the scene.
     * The CameraComponentSystem allows access to all individual Camera Components. 
     * It also manages the currently active Camera, using setCurrent() and getCurrent() and controls the rendering part of the frame 
     * with beginFrame()/endFrame().
     * See {@link pc.fw.CameraComponentData} for properties of the Camera Component
     * @constructor Create a new CameraComponentSystem
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var CameraComponentSystem = function (context) {
        this.id = 'camera'
        context.systems.add(this.id, this);
        this.ComponentType = pc.fw.CameraComponent;
        this.DataType = pc.fw.CameraComponentData;

        this.bind('remove', this.onRemove.bind(this));

        this._currentEntity = null;
        this._currentNode = null;
        this._renderable = null;
    };
    CameraComponentSystem = pc.inherits(CameraComponentSystem, pc.fw.ComponentSystem);
    
    Object.defineProperty(CameraComponentSystem.prototype, 'current', {
        get: function () {
            return this._currentEntity;
        },
        set: function (entity) {
            if (entity === null) {
                this._currentEntity = null;
                this._currentNode = null;
                return;
            }

            if (!entity.camera) {
                throw Error("Entity must have camera Component")
            }
            
            this._currentEntity = entity;
            this._currentNode = entity.camera.data.camera;
        }
    });

    pc.extend(CameraComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            data = data || {};
            data.camera = new pc.scene.CameraNode();
    
            properties = ['camera', 'clearColor', 'fov', 'orthoHeight', 'activate', 'nearClip', 'farClip', 'offscreen', 'projection'];
    
            CameraComponentSystem._super.initializeComponentData.call(this, component, data, properties);

            if (!window.pc.apps.designer && component.get("activate") && !component.entity.hasLabel("pc:designer")) {
                this.current = component.entity;
            }
        },
        
        /**
         * Start rendering the frame for the camera on the top of the stack
         * @function
         * @name pc.fw.CameraComponentSystem#frameBegin
         */
        frameBegin: function (clear) {
            var camera = this._currentNode;
            if (!camera) {
                return;
            }

            var device = pc.gfx.Device.getCurrent();
            var w = device.canvas.width;
            var h = device.canvas.height;
            var target = camera.getRenderTarget();
            var viewport = target.getViewport();
            var texture = target.getFrameBuffer().getTexture();
            var offscreen = this._currentEntity.camera.data.offscreen;
            if (offscreen) {
                if (!texture || (viewport.width !== w) || (viewport.height !== h)) {
                    var offscreenBuffer = new pc.gfx.FrameBuffer(w, h, true);
                    var offscreenTexture = offscreenBuffer.getTexture();
                    offscreenTexture.setFilterMode(pc.gfx.TextureFilter.LINEAR, pc.gfx.TextureFilter.LINEAR);
                    offscreenTexture.setAddressMode(pc.gfx.TextureAddress.CLAMP_TO_EDGE, pc.gfx.TextureAddress.CLAMP_TO_EDGE);
                    camera.setRenderTarget(new pc.gfx.RenderTarget(offscreenBuffer));
                }
            } else {
                if (texture) {
                    var backBuffer = pc.gfx.FrameBuffer.getBackBuffer();
                    camera.setRenderTarget(new pc.gfx.RenderTarget(backBuffer));
                }
            }

            var viewport = camera.getRenderTarget().getViewport();
            var aspect = viewport.width / viewport.height;
            if (aspect !== camera.getAspectRatio()) {
                camera.setAspectRatio(aspect);
            }

            camera.frameBegin(clear);
        },

        /**
         * End rendering the frame for the camera on the top of the stack
         * @function
         * @name pc.fw.CameraComponentSystem#frameEnd
         */
        frameEnd: function () {
            var camera = this._currentNode;
            if (!camera) {
                return;
            }

            camera.frameEnd();        
        },

        onRemove: function (entity, data) {
            // If this is the current camera then clear it
            if (this._currentEntity === entity) {
                this.current = null;
            }

            entity.removeChild(data.camera);
            data.camera = null;
        },
    
        toolsRender: function (fn) {
            var components = this.getComponents();
            for (var id in components) {
                if (components.hasOwnProperty(id)) {
                    var entity = components[id].entity;

                    if (!entity.hasLabel("pc:designer")) {
                        var componentData = components[id].component;
                        componentData.camera.drawFrustum();
                    }
                }
            }
        }
    });

    return {
        CameraComponent: CameraComponent,
        CameraComponentSystem: CameraComponentSystem
    }; 
}());
