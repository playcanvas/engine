pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.CollisionCapsuleComponentSystem
     * @constructor Create a new CollisionCapsuleComponentSystem
     * @class Manages creation of CollisionCapsuleComponents
     * @param {pc.fw.ApplicationContext} context The ApplicationContext of the running application
     * @extends pc.fw.ComponentSystem
     */
    var CollisionCapsuleComponentSystem = function CollisionCapsuleComponentSystem(context) {
        this.id = 'collisioncapsule';
        context.systems.add(this.id, this);

        this.ComponentType = pc.fw.CollisionCapsuleComponent;
        this.DataType = pc.fw.CollisionCapsuleComponentData;

        this.schema = [{
            name: "axis",
            displayName: "Axis",
            description: "Major axis of capsule",
            type: "enumeration",
            options: {
                enumerations: [{
                    name: 'X',
                    value: 0
                }, {
                    name: 'Y',
                    value: 1
                }, {
                    name: 'Z',
                    value: 2
                }]
            },
            defaultValue: 1
        }, {
            name: "height",
            displayName: "Height",
            description: "The height of the collision capsule",
            type: "number",
            options: {
                min: 0,
                step: 0.1
            },
            defaultValue: 2
        }, {
            name: "radius",
            displayName: "Radius",
            description: "The radius of the collision sphere",
            type: "number",
            options: {
                min: 0,
                step: 0.1
            },
            defaultValue: 0.5
        }, {
            name: "shape",
            exposed: false
        }, {
            name: 'model',
            exposed: false
        }];

        this.exposeProperties();

        // Material used to render all debug capsule shapes
        this.material = new pc.scene.BasicMaterial();
        this.material.color = pc.math.vec4.create(0, 0, 1, 1);
        this.material.update();

        this.debugRender = false;

        this.on('remove', this.onRemove, this);

        pc.fw.ComponentSystem.on('update', this.onUpdate, this);
        pc.fw.ComponentSystem.on('toolsUpdate', this.onToolsUpdate, this);
    };
    CollisionCapsuleComponentSystem = pc.inherits(CollisionCapsuleComponentSystem, pc.fw.ComponentSystem);
    
    pc.extend(CollisionCapsuleComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            var axis = data.axis || 1;
            var radius = data.radius || 0.5;
            var height = Math.max((data.height || 2) - 2 * radius, 0);

            if (typeof(Ammo) !== 'undefined') {
                switch (axis) {
                    case 0:
                        data.shape = new Ammo.btCapsuleShapeX(radius, height);
                        break;
                    case 1:
                        data.shape = new Ammo.btCapsuleShape(radius, height);
                        break;
                    case 2:
                        data.shape = new Ammo.btCapsuleShapeZ(radius, height);
                        break;
                }
            }
            this.createDebugShape(component, data);

            properties = ['axis', 'height', 'radius', 'shape', 'model'];

            CollisionCapsuleComponentSystem._super.initializeComponentData.call(this, component, data, properties);

            component.updateDebugShape(axis, radius, height);

            if (component.entity.rigidbody) {
                component.entity.rigidbody.createBody();
            }
        },

        onRemove: function (entity, data) {
            if (entity.rigidbody && entity.rigidbody.body) {
                this.context.systems.rigidbody.removeBody(entity.rigidbody.body);
            }

            if (this.context.scene.containsModel(data.model)) {
                this.context.root.removeChild(data.model.graph);
                this.context.scene.removeModel(data.model);
            }
        },

        /**
        * @function
        * @name pc.fw.CollisionCapsuleComponentSystem#setDebugRender
        * @description Display collision shape outlines
        * @param {Boolean} value Enable or disable
        */
        setDebugRender: function (value) {
            this.debugRender = value;
        },

        createDebugShape: function (component, data) {
            var gd = this.context.graphicsDevice;

            // Create the graphical resources required to render a capsule shape
            var format = new pc.gfx.VertexFormat(gd, [
                { semantic: pc.gfx.SEMANTIC_POSITION, components: 3, type: pc.gfx.ELEMENTTYPE_FLOAT32 }
            ]);

            var vertexBuffer = new pc.gfx.VertexBuffer(gd, format, 328, pc.gfx.BUFFER_DYNAMIC);

            var mesh = new pc.scene.Mesh();
            mesh.vertexBuffer = vertexBuffer;
            mesh.indexBuffer[0] = this.indexBuffer;
            mesh.primitive[0].type = pc.gfx.PRIMITIVE_LINES;
            mesh.primitive[0].base = 0;
            mesh.primitive[0].count = vertexBuffer.getNumVertices();
            mesh.primitive[0].indexed = false;

            data.model = new pc.scene.Model();
            data.model.graph = new pc.scene.GraphNode();
            data.model.meshInstances = [ new pc.scene.MeshInstance(data.model.graph, mesh, this.material) ];
        },

        onUpdate: function (dt) {
            if (this.debugRender) {
                this.updateDebugShapes();
            }
        },

        onToolsUpdate: function (dt) {
            this.updateDebugShapes();
        },

        updateDebugShapes: function () {
            var components = this.store;
            for (var id in components) {
                var entity = components[id].entity;
                var data = components[id].data;

                var model = data.model;
                var root = model.graph;

                if (!this.context.scene.containsModel(model)) {
                    this.context.scene.addModel(model);
                    this.context.root.addChild(root);
                }

                root.setPosition(entity.getPosition());
                root.setRotation(entity.getRotation());
                root.setLocalScale(1, 1, 1);
            }
        }
    });

    return {
        CollisionCapsuleComponentSystem: CollisionCapsuleComponentSystem
    };
}());