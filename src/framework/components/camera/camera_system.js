pc.extend(pc, function () {
    /**
     * @name pc.CameraComponentSystem
     * @class Used to add and remove {@link pc.CameraComponent}s from Entities. It also holds an
     * array of all active cameras.
     * @constructor Create a new CameraComponentSystem
     * @param {pc.Application} app The Application
     * @extends pc.ComponentSystem
     */
    var CameraComponentSystem = function (app) {
        this.id = 'camera';
        this.description = "Renders the scene from the location of the Entity.";
        app.systems.add(this.id, this);

        this.ComponentType = pc.CameraComponent;
        this.DataType = pc.CameraComponentData;

        this.schema = [
            'enabled',
            'clearColorBuffer',
            'clearColor',
            'clearDepthBuffer',
            'frustumCulling',
            'projection',
            'fov',
            'orthoHeight',
            'nearClip',
            'farClip',
            'priority',
            'rect',
            'camera',
            'aspectRatio',
            'model',
            'renderTarget'
        ];

        // holds all the active camera components
        this.cameras = [];

        this.on('beforeremove', this.onBeforeRemove, this);
        this.on('remove', this.onRemove, this);
        pc.ComponentSystem.on('toolsUpdate', this.toolsUpdate, this);

    };
    CameraComponentSystem = pc.inherits(CameraComponentSystem, pc.ComponentSystem);

    pc.extend(CameraComponentSystem.prototype, {
        initializeComponentData: function (component, _data, properties) {
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
                'frustumCulling',
                'rect'
            ];

            // duplicate data because we're modifying the data
            var data = {};
            properties.forEach(function (prop) {
                data[prop] = _data[prop];
            })

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

            data.camera = new pc.Camera();
            data._node = component.entity;

            data.postEffects = new pc.PostEffectQueue(this.app, component);

            if (this._inTools) {
                var material = new pc.BasicMaterial();
                material.color = new pc.Color(1, 1, 0, 1);
                material.update();

                var indexBuffer = new pc.IndexBuffer(this.app.graphicsDevice, pc.INDEXFORMAT_UINT8, 24);
                var indices = new Uint8Array(indexBuffer.lock());
                indices.set([0,1,1,2,2,3,3,0, // Near plane
                             4,5,5,6,6,7,7,4, // Far plane
                             0,4,1,5,2,6,3,7]); // Near to far edges
                indexBuffer.unlock();

                var format = new pc.VertexFormat(this.app.graphicsDevice, [
                    { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.ELEMENTTYPE_FLOAT32 }
                ]);

                var vertexBuffer = new pc.VertexBuffer(this.app.graphicsDevice, format, 8, pc.BUFFER_DYNAMIC);

                var mesh = new pc.Mesh();
                mesh.vertexBuffer = vertexBuffer;
                mesh.indexBuffer[0] = indexBuffer;
                mesh.primitive[0].type = pc.PRIMITIVE_LINES;
                mesh.primitive[0].base = 0;
                mesh.primitive[0].count = indexBuffer.getNumIndices();
                mesh.primitive[0].indexed = true;

                var model = new pc.Model();
                model.graph = component.entity;
                model.meshInstances = [ new pc.MeshInstance(model.graph, mesh, material) ];

                this.app.scene.addModel(model);

                data.model = model;
            }

            CameraComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        onBeforeRemove: function (entity, component) {
            this.removeCamera(component);
        },

        onRemove: function (entity, data) {
            if (this._inTools) {
                if (this.app.scene.containsModel(data.model)) {
                    this.app.scene.removeModel(data.model);
                }
            }

            data.camera = null;
        },

        toolsUpdate: function (fn) {
            var components = this.store;
            for (var id in components) {
                if (components.hasOwnProperty(id)) {
                    var entity = components[id].entity;
                    var data = components[id].data;

                    if (this._inTools) {
                        this._updateGfx(entity.camera);
                    }
                }
            }
        },

        _updateGfx: function (component) {
            if (component.model && component.model.meshInstances.length) {
                var vertexBuffer = component.model.meshInstances[0].mesh.vertexBuffer;

                // Retrieve the characteristics of the camera frustum
                var nearClip    = component.nearClip;
                var farClip     = component.farClip;
                var fov         = component.fov * Math.PI / 180.0;
                var projection  = component.projection;

                // calculate aspect ratio based on the current width / height of the
                // graphics device
                var device = this.app.graphicsDevice;
                var rect = component.rect;
                var aspectRatio = (device.width * rect.z) / (device.height * rect.w);

                var x, y;
                if (projection === pc.PROJECTION_PERSPECTIVE) {
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

                if (projection === pc.PROJECTION_PERSPECTIVE) {
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

            // add debug shape to tools
            if (this._inTools) {
                var model = camera.data.model;

                if (model) {
                    var scene = this.app.scene;
                    if (!scene.containsModel(model)) {
                        scene.addModel(model);
                    }
                }
            }
        },

        removeCamera: function (camera) {
            var index = this.cameras.indexOf(camera);
            if (index >= 0) {
                this.cameras.splice(index, 1);
                this.sortCamerasByPriority();

                // remove debug shape from tools
                if (this._inTools) {
                    var model = camera.data.model;
                    if (model) {
                        this.app.scene.removeModel(model);
                    }
                }
            }
        },

        sortCamerasByPriority: function () {
            this.cameras.sort(function (a, b) {
                return a.priority - b.priority;
            });
        }
    });

    return {
        CameraComponentSystem: CameraComponentSystem
    };
}());
