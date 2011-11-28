pc.extend(pc.fw, function () {
    var _createGfxResources = function () {
        // Create the graphical resources required to render a camera frustum
        var device = pc.gfx.Device.getCurrent();
        var library = device.getProgramLibrary();
        var program = library.getProgram("basic", { vertexColors: false, diffuseMapping: false });
        var format = new pc.gfx.VertexFormat();
        format.begin();
        format.addElement(new pc.gfx.VertexElement("vertex_position", 3, pc.gfx.VertexElementType.FLOAT32));
        format.end();
        var vertexBuffer = new pc.gfx.VertexBuffer(format, 8, pc.gfx.VertexBufferUsage.DYNAMIC);
        var indexBuffer = new pc.gfx.IndexBuffer(pc.gfx.IndexFormat.UINT16, 24);
        var indices = new Uint16Array(indexBuffer.lock());
        indices.set([0,1,1,2,2,3,3,0, // Near plane
                     4,5,5,6,6,7,7,4, // Far plane
                     0,4,1,5,2,6,3,7]); // Near to far edges
        indexBuffer.unlock();
        
        // Set the resources on the component
        return {
            program: program,
            indexBuffer: indexBuffer,
            vertexBuffer: vertexBuffer
        };
    };
    
    var _createOffscreenBuffer = function () {
        var backBuffer = pc.gfx.FrameBuffer.getBackBuffer();
        var w = backBuffer.getWidth();
        var h = backBuffer.getHeight();
        var offscreenBuffer = new pc.gfx.FrameBuffer(w, h, true);
        var offscreenTexture = offscreenBuffer.getTexture();
        offscreenTexture.setFilterMode(pc.gfx.TextureFilter.LINEAR, pc.gfx.TextureFilter.LINEAR);
        offscreenTexture.setAddressMode(pc.gfx.TextureAddress.CLAMP_TO_EDGE, pc.gfx.TextureAddress.CLAMP_TO_EDGE);
        return offscreenBuffer;
    };
    
    /**
     * @name pc.fw.CameraComponentSystem
     * @class A Camera Component is used to render the scene.
     * The CameraComponentSystem allows access to all individual Camera Components. 
     * It also manages the currently active Camera, using setCurrent() and getCurrent() and controls the rendering part of the frame 
     * with beginFrame()/endFrame().
     * @see {pc.fw.CameraComponentData} for properties of the Camera Component
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
                if (clearColor) {
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
                if (fov) {
                    componentData.fov = fov;
                    componentData.camera.setFov(fov);
                } else {
                    return componentData.camera.getFov();
                }
            },

            _viewWindowX: function (componentData, vwx) {
                if (vwx) {
                    componentData.viewWindowX = vwx;
                    var vw = componentData.camera.getViewWindow();
                    componentData.camera.setViewWindow(pc.math.vec2.create(vwx, vw[1]));
                } else {
                    return componentData.viewWindowX;
                }
            },

            _viewWindowY: function (componentData, vwy) {
                if (vwy) {
                    componentData.viewWindowY = vwy;
                    var vw = componentData.camera.getViewWindow();
                    componentData.camera.setViewWindow(pc.math.vec2.create(vw[0], vwy));
                } else {
                    return componentData.viewWindowY;
                }
            },

            _nearClip: function (componentData, nearClip) {
                if (nearClip) {
                    componentData.nearClip = nearClip;
                    componentData.camera.setNearClip(nearClip);
                } else {
                    return componentData.camera.getNearClip();
                }
            },

            _farClip: function (componentData, farClip) {
                if (farClip) {
                    componentData.farClip = farClip;
                    componentData.camera.setFarClip(farClip);
                } else {
                    return componentData.camera.getFarClip();
                }
            },

            _offscreen: function (componentData, offscreen) {
                if (offscreen !== undefined) {
                    if (offscreen) {
                        componentData.offscreen = offscreen;
                        var offscreenBuffer = _createOffscreenBuffer();
                        componentData.camera.setRenderTarget(new pc.gfx.RenderTarget(offscreenBuffer));
                    } else {
                        var backBuffer = pc.gfx.FrameBuffer.getBackBuffer();
                        componentData.camera.setRenderTarget(new pc.gfx.RenderTarget(backBuffer));
                    }
                } else {
                    return componentData.offscreen;
                }
            },

            _projection: function (componentData, projection) {
                if (projection) {
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
    
    CameraComponentSystem = CameraComponentSystem.extendsFrom(pc.fw.ComponentSystem);
    
    CameraComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.CameraComponentData();

        // Add new camera node and ensure it is first in the property list
        data = data || {};
        data['camera'] = new pc.scene.CameraNode();
        this.initialiseComponent(entity, componentData, data, ['camera', 'clearColor', 'fov', 'viewWindowX', 'viewWindowY', 'activate', 'nearClip', 'farClip', 'offscreen', 'projection']);
        
        
        if (!window.pc.apps.designer && this.get(entity, "activate") && !entity.hasLabel("pc:designer")) {
            this.setCurrent(entity);
        }
        
        return componentData;
    };
    
    CameraComponentSystem.prototype.deleteComponent = function (entity) {
        var data = this._getComponentData(entity);
        
        if(data.camera) {
            entity.removeChild(data.camera);
            data.camera = null;    
        }
        
        this.removeComponent(entity);
    };
    
    CameraComponentSystem.prototype.toolsRender = function (fn) {
        if (!this._renderable) {
            this._renderable = _createGfxResources();            
        }

        var id;
        var entity;
        var componentData;
        var components = this._getComponents();
        var transform;
        var device;
        var program = this._renderable.program;
        var vertexBuffer = this._renderable.vertexBuffer;
        var indexBuffer = this._renderable.indexBuffer;
        
        for (id in components) {
            if (components.hasOwnProperty(id)) {
                entity = components[id].entity;
                if (!entity.hasLabel("pc:designer")) {
                    componentData = components[id].component;

                    // Retrieve the characteristics of the camera frustum
                    var cam = componentData.camera;
                    var nearClip = cam.getNearClip();
                    var farClip  = cam.getFarClip();
                    var fov      = cam.getFov() * Math.PI / 180.0;
                    var viewport = cam.getRenderTarget().getViewport();

                    // Write the frustum corners into a dynamic vertex buffer
                    var positions = new Float32Array(vertexBuffer.lock());
                    var y = Math.tan(fov / 2.0) * nearClip;
                    var x = y * viewport.width / viewport.height;
                    positions[0]  = x;
                    positions[1]  = -y;
                    positions[2]  = -nearClip;
                    positions[3]  = x;
                    positions[4]  = y;
                    positions[5]  = -nearClip;
                    positions[6]  = -x;
                    positions[7]  = y;
                    positions[8]  = -nearClip;
                    positions[9]  = -x;
                    positions[10] = -y;
                    positions[11] = -nearClip;

                    y = Math.tan(fov / 2.0) * farClip;
                    x = y * viewport.width / viewport.height;
                    positions[12]  = x;
                    positions[13]  = -y;
                    positions[14]  = -farClip;
                    positions[15]  = x;
                    positions[16]  = y;
                    positions[17]  = -farClip;
                    positions[18]  = -x;
                    positions[19]  = y;
                    positions[20]  = -farClip;
                    positions[21]  = -x;
                    positions[22] = -y;
                    positions[23] = -farClip;                
                    vertexBuffer.unlock();

                    // Render the camera frustum
                    device = pc.gfx.Device.getCurrent();
                    device.setProgram(program);
                    device.setIndexBuffer(indexBuffer);
                    device.setVertexBuffer(vertexBuffer, 0);
                    
                    transform = entity.getWorldTransform();
                    device.scope.resolve("matrix_model").setValue(transform);
                    device.scope.resolve("constant_color").setValue([1,1,0,1]);
                    device.draw({
                        primitiveType: pc.gfx.PrimType.LINES,
                        numVertices: indexBuffer.getNumIndices(),
                        useIndexBuffer: true
                    });
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
        if (!this._currentNode) {
            return;
        }

        this._currentNode.frameBegin(clear);
    };
    
    /**
     * End rendering the frame for the camera on the top of the stack
     * @function
     * @name pc.fw.CameraComponentSystem#frameEnd
     */
    CameraComponentSystem.prototype.frameEnd = function () {
        if(!this._currentNode) {
            return;
        }
        this._currentNode.frameEnd();        
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
