pc.extend(pc.fw, function () {
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

        this.schema = [{
            name: "clearColor",
            displayName: "Clear Color",
            description: "Clear Color",
            type: "rgba",
            defaultValue: "0xbabab1ff"
        }, {
            name: "projection",
            displayName: "Projection",
            description: "Projection type of camera",
            type: "enumeration",
            options: {
                enumerations: [{
                    name: 'Perspective',
                    value: 0
                }, {
                    name: 'Orthographic',
                    value: 1
                }]
            },
            defaultValue: 0
        }, {
            name: "fov",
            displayName: "Field of View",
            description: "Field of view in Y axis",
            type: "number",
            defaultValue: 45,
            options: {
                min: 0,
                max: 90
            }            
        }, {
            name: "orthoHeight",
            displayName: "Ortho Height",
            description: "View window half extent of camera in Y axis",
            type: "number",
            defaultValue: 100
        }, {
            name: "nearClip",
            displayName: "Near Clip",
            description: "Near clipping distance",
            type: "number",
            defaultValue: 0.1,
            options: {
                min: 0
            }
        }, {
            name: "farClip",
            displayName: "Far Clip",
            description: "Far clipping distance",
            type: "number",
            defaultValue: 1000,
            options: {
                min: 0
            }
        }, {
            name: "activate",
            displayName: "Activate",
            description: "Activate camera when scene loads",
            type: "boolean",
            defaultValue: true            
        }, {
            name: "offscreen",
            displayName: "Offscreen",
            description: "Render to an offscreen buffer",
            type: "boolean",
            defaultValue: false
        }, {
            name: "camera",
            exposed: false
        }];

        this.exposeProperties();

        this._currentEntity = null;
        this._currentNode = null;
        this._renderable = null;

        this.bind('remove', this.onRemove.bind(this));

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

            if (!window.pc.apps.designer && component.activate && !component.entity.hasLabel("pc:designer")) {
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
        CameraComponentSystem: CameraComponentSystem
    };
}());