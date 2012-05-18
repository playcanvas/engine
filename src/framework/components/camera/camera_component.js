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
        context.systems.add("camera", this);

        pc.extend(this, {
            _currentNode: null, // The current camera node
            _currentEntity: null, // The current camera entity
            _renderable: null, // gfx resources for rendering frustum in tools
            
            _clearColor: function (componentData, clearColor) {
                if (pc.isDefined(clearColor)) {
                    var color = parseInt(clearColor);
                    componentData.camera.getClearOptions().color = [
                        ((color >> 24) & 0xff) / 255.0,
                        ((color >> 16) & 0xff) / 255.0,
                        ((color >> 8) & 0xff) / 255.0,
                        ((color) & 0xff) / 255.0
                    ];
                } else {
                    return componentData.camera.getClearOptions().color;
                }
            },

            _fov: function (componentData, fov) {
                if (pc.isDefined(fov)) {
                    componentData.fov = fov;
                    componentData.camera.setFov(fov);
                } else {
                    return componentData.camera.getFov();
                }
            },

            _orthoHeight: function (componentData, oh) {
                if (pc.isDefined(oh)) {
                    componentData.orthoHeight = oh;
                    componentData.camera.setOrthoHeight(oh);
                } else {
                    return componentData.orthoHeight;
                }
            },

            _nearClip: function (componentData, nearClip) {
                if (pc.isDefined(nearClip)) {
                    componentData.nearClip = nearClip;
                    componentData.camera.setNearClip(nearClip);
                } else {
                    return componentData.camera.getNearClip();
                }
            },

            _farClip: function (componentData, farClip) {
                if (pc.isDefined(farClip)) {
                    componentData.farClip = farClip;
                    componentData.camera.setFarClip(farClip);
                } else {
                    return componentData.camera.getFarClip();
                }
            },

            _offscreen: function (componentData, offscreen) {
                if (pc.isDefined(offscreen)) {
                    var backBuffer = pc.gfx.FrameBuffer.getBackBuffer();
                    if (offscreen) {
                        componentData.offscreen = offscreen;
                        var w = backBuffer.getWidth();
                        var h = backBuffer.getHeight();
                        var offscreenBuffer = new pc.gfx.FrameBuffer(w, h, true);
                        var offscreenTexture = offscreenBuffer.getTexture();
                        offscreenTexture.setFilterMode(pc.gfx.TextureFilter.LINEAR, pc.gfx.TextureFilter.LINEAR);
                        offscreenTexture.setAddressMode(pc.gfx.TextureAddress.CLAMP_TO_EDGE, pc.gfx.TextureAddress.CLAMP_TO_EDGE);
                        componentData.camera.setRenderTarget(new pc.gfx.RenderTarget(offscreenBuffer));
                    } else {
                        componentData.camera.setRenderTarget(new pc.gfx.RenderTarget(backBuffer));
                    }
                } else {
                    return componentData.offscreen;
                }
            },

            _projection: function (componentData, projection) {
                if (pc.isDefined(projection)) {
                    componentData.projection = projection;
                    componentData.camera.setProjection(projection);
                } else {
                    return componentData.camera.getProjection();
                }
            }
        });
        
        // Bind event to update hierarchy if camera node changes
        this.bind("set_camera", this.onSetCamera.bind(this));
    };
    
    CameraComponentSystem = pc.inherits(CameraComponentSystem, pc.fw.ComponentSystem);
    
    CameraComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.CameraComponentData();

        // Add new camera node and ensure it is first in the property list
        data = data || {};
        data.camera = new pc.scene.CameraNode();

        var attribs = ['camera', 'clearColor', 'fov', 'orthoHeight', 'activate', 'nearClip', 'farClip', 'offscreen', 'projection'];
        this.initialiseComponent(entity, componentData, data, attribs);

        if (!window.pc.apps.designer && this.get(entity, "activate") && !entity.hasLabel("pc:designer")) {
            this.setCurrent(entity);
        }
        
        return componentData;
    };

    CameraComponentSystem.prototype.deleteComponent = function (entity) {
        var data = this.getComponentData(entity);

        if (data.camera) {
            entity.removeChild(data.camera);
            data.camera = null;    
        }

        this.removeComponent(entity);
    };
    
    CameraComponentSystem.prototype.toolsRender = function (fn) {
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
    };

    /**
     * @function
     * @name pc.fw.CameraComponentSystem#getCurrent
     * @description return the current camera Entity
     * @returns {pc.fw.Entity} The current camera Entity
     */
    CameraComponentSystem.prototype.getCurrent = function () {
        return this._currentEntity;
    };
    
    /**
     * @function 
     * @name pc.fw.CameraComponentSystem#setCurrent
     * @description Set the the currently active camera Entity
     * @param {pc.fw.Entity} entity An Entity with a camera Component.
     */
    CameraComponentSystem.prototype.setCurrent = function (entity) {
        if (!this.hasComponent(entity)) {
            throw Error("Entity must have camera Component")
        }
        this._currentEntity = entity;
        this._currentNode = this.getComponentData(entity).camera;
    };
    
    /**
     * Start rendering the frame for the camera on the top of the stack
     * @function
     * @name pc.fw.CameraComponentSystem#frameBegin
     */
    CameraComponentSystem.prototype.frameBegin = function (clear) {
        var camera = this._currentNode;
        if (!camera) {
            return;
        }

        var viewport = camera.getRenderTarget().getViewport();
        var aspect = viewport.width / viewport.height;
        if (aspect !== camera.getAspectRatio()) {
            camera.setAspectRatio(aspect);
        }

        camera.frameBegin(clear);
    };

    /**
     * End rendering the frame for the camera on the top of the stack
     * @function
     * @name pc.fw.CameraComponentSystem#frameEnd
     */
    CameraComponentSystem.prototype.frameEnd = function () {
        var camera = this._currentNode;
        if (!camera) {
            return;
        }

        camera.frameEnd();        
    };
    
    CameraComponentSystem.prototype.onSetCamera = function (entity, name, oldValue, newValue) {
        // remove old camera node from hierarchy and add new one
        if (oldValue) {
            entity.removeChild(oldValue);
        }        
        entity.addChild(newValue);
    };
    
    return {
        CameraComponentSystem: CameraComponentSystem
    }; 
}());
