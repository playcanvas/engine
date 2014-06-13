pc.extend(pc.fw, function () {
    var REMOTE_CAMERA_NEAR_CLIP = 0.5;
    var REMOTE_CAMERA_FAR_CLIP = 2;

    /**
     * @name pc.fw.CameraComponentSystem
     * @class Used to add and remove {@link pc.fw.CameraComponent}s from Entities. It also holds an
     * array of all active cameras.
     * @constructor Create a new CameraComponentSystem
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var CameraComponentSystem = function (context) {
        this.id = 'camera';
        this.description = "Renders the scene from the location of the Entity.";
        context.systems.add(this.id, this);

        this.ComponentType = pc.fw.CameraComponent;
        this.DataType = pc.fw.CameraComponentData;

        this.schema = [{
            name: "enabled",
            displayName: "Enabled",
            description: "Disabled cameras do not render anything",
            type: "boolean",
            defaultValue: true
        }, {
            name: "clearColorBuffer",
            displayName: "Clear Color Buffer",
            description: "Clear color buffer",
            type: "boolean",
            defaultValue: true
        }, {
            name: "clearColor",
            displayName: "Clear Color",
            description: "Clear Color",
            type: "rgba",
            defaultValue: [0.7294117647058823, 0.7294117647058823, 0.6941176470588235, 1.0],
            filter: {
                clearColorBuffer: true
            }
        }, {
            name: 'clearDepthBuffer',
            displayName: "Clear Depth Buffer",
            description: "Clear depth buffer",
            type: "boolean",
            defaultValue: true
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
            },
            filter: {
                projection: 0
            }
        }, {
            name: "orthoHeight",
            displayName: "Ortho Height",
            description: "View window half extent of camera in Y axis",
            type: "number",
            defaultValue: 100,
            filter: {
                projection: 1
            }
        }, {
            name: "nearClip",
            displayName: "Near Clip",
            description: "Near clipping distance",
            type: "number",
            defaultValue: 0.3,
            options: {
                min: 0.0001,
                decimalPrecision: 3
            }
        }, {
            name: "farClip",
            displayName: "Far Clip",
            description: "Far clipping distance",
            type: "number",
            defaultValue: 1000,
            options: {
                min: 0.0001,
                decimalPrecision: 3
            }
        }, {
            name: "priority",
            displayName: "Priority",
            description: "Controls which camera will be rendered first. Smaller numbers are rendered first.",
            type: "number",
            defaultValue: 0
        }, {
            name: "rect",
            displayName: "Viewport",
            description: "Controls where on the screen the camera will be rendered in normalized coordinates.",
            type: "vector",
            defaultValue: [0,0,1,1]
        },{
            name: "camera",
            exposed: false
        }, {
            name: "aspectRatio",
            exposed: false
        }, {
            name: "model",
            exposed: false
        }, {
            name: "renderTarget",
            exposed: false
        }];

        this.exposeProperties();

        // holds all the active camera components
        this.cameras = [];

        this.on('remove', this.onRemove, this);
        pc.fw.ComponentSystem.on('toolsUpdate', this.toolsUpdate, this);

    };
    CameraComponentSystem = pc.inherits(CameraComponentSystem, pc.fw.ComponentSystem);

    pc.extend(CameraComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            data = data || {};

            if (data.clearColor && pc.type(data.clearColor) === 'array') {
                var c = data.clearColor;
                data.clearColor = new pc.Color(c[0], c[1], c[2], c[3]);
            }

            if (data.rect && pc.type(data.rect) === 'array') {
                var rect = data.rect;
                data.rect = new pc.Vec4(rect[0], rect[1], rect[2], rect[3]);
            }

            if (data.activate) {
                console.warn("WARNING: activate: Property is deprecated. Set enabled property instead.");
                data.enabled = data.activate;
            }

            data.camera = new pc.scene.CameraNode();

            data.postEffects = new pc.posteffect.PostEffectQueue(this.context, component);

            if (this.context.designer && this.displayInTools(component.entity)) {
                var material = new pc.scene.BasicMaterial();
                material.color = new pc.Color(1, 1, 0, 1);
                material.update();

                var indexBuffer = new pc.gfx.IndexBuffer(this.context.graphicsDevice, pc.gfx.INDEXFORMAT_UINT8, 24);
                var indices = new Uint8Array(indexBuffer.lock());
                indices.set([0,1,1,2,2,3,3,0, // Near plane
                             4,5,5,6,6,7,7,4, // Far plane
                             0,4,1,5,2,6,3,7]); // Near to far edges
                indexBuffer.unlock();

                var format = new pc.gfx.VertexFormat(this.context.graphicsDevice, [
                    { semantic: pc.gfx.SEMANTIC_POSITION, components: 3, type: pc.gfx.ELEMENTTYPE_FLOAT32 }
                ]);

                var vertexBuffer = new pc.gfx.VertexBuffer(this.context.graphicsDevice, format, 8, pc.gfx.BUFFER_DYNAMIC);

                var mesh = new pc.scene.Mesh();
                mesh.vertexBuffer = vertexBuffer;
                mesh.indexBuffer[0] = indexBuffer;
                mesh.primitive[0].type = pc.gfx.PRIMITIVE_LINES;
                mesh.primitive[0].base = 0;
                mesh.primitive[0].count = indexBuffer.getNumIndices();
                mesh.primitive[0].indexed = true;

                var model = new pc.scene.Model();
                model.graph = data.camera;
                model.meshInstances = [ new pc.scene.MeshInstance(model.graph, mesh, material) ];

                this.context.scene.addModel(model);

                data.model = model;
            }

            properties = [
                'postEffects',
                'enabled',
                'model',
                'camera',
                'aspectRatio',
                'renderTarget',
                'clearColor',
                'fov',
                'orthoHeight',
                'nearClip',
                'farClip',
                'projection',
                'priority',
                'clearColorBuffer',
                'clearDepthBuffer',
                'rect'
            ];

            CameraComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },


        onRemove: function (entity, data) {
            if (this.context.designer && this.displayInTools(entity)) {
                if (this.context.scene.containsModel(data.model)) {
                    this.context.scene.removeModel(data.model);
                }
            }

            entity.removeChild(data.camera);
            data.camera = null;
        },

        toolsUpdate: function (fn) {
            var components = this.store;
            for (var id in components) {
                if (components.hasOwnProperty(id)) {
                    var entity = components[id].entity;
                    var data = components[id].data;

                    if (this.displayInTools(entity)) {
                        this._updateGfx(entity.camera);
                    }
                }
            }
        },

        _updateGfx: function (component) {
            if (component.model && component.model.meshInstances.length) {
                var vertexBuffer = component.model.meshInstances[0].mesh.vertexBuffer;

                // Retrieve the characteristics of the camera frustum
                var aspectRatio = component.camera.getAspectRatio();
                var nearClip    = this.isToolsCamera(component.entity) ? REMOTE_CAMERA_NEAR_CLIP : component.nearClip; // Remote User cameras don't display full extents
                var farClip     = this.isToolsCamera(component.entity) ? REMOTE_CAMERA_FAR_CLIP : component.farClip; // Remote User cameras don't display full extents
                var fov         = component.fov * Math.PI / 180.0;
                var projection  = component.projection;

                var x, y;
                if (projection === pc.scene.Projection.PERSPECTIVE) {
                    y = Math.tan(fov / 2.0) * nearClip;
                } else {
                    y = component.camera.getOrthoHeight();
                }
                x = y * aspectRatio;

                var positions = new Float32Array(vertexBuffer.lock());
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

                if (projection === pc.scene.Projection.PERSPECTIVE) {
                    y = Math.tan(fov / 2.0) * farClip;
                    x = y * aspectRatio;
                }
                positions[12] = x;
                positions[13] = -y;
                positions[14] = -farClip;
                positions[15] = x;
                positions[16] = y;
                positions[17] = -farClip;
                positions[18] = -x;
                positions[19] = y;
                positions[20] = -farClip;
                positions[21] = -x;
                positions[22] = -y;
                positions[23] = -farClip;
                vertexBuffer.unlock();
            }
        },

        addCamera: function (camera) {
            this.cameras.push(camera);
            this.sortCamerasByPriority();
        },

        removeCamera: function (camera) {
            var index = this.cameras.indexOf(camera);
            if (index >= 0) {
                this.cameras.splice(index, 1);
                this.sortCamerasByPriority();
            }
        },

        sortCamerasByPriority: function () {
            this.cameras.sort(function (a, b) {
                return a.priority - b.priority;
            });
        },

        isToolsCamera: function (entity) {
            return entity.hasLabel("pc:designer");
        },

        displayInTools: function (entity) {
            return (!this.isToolsCamera(entity) || (entity.getName() === "Perspective"));
        }
    });

    return {
        CameraComponentSystem: CameraComponentSystem
    };
}());
