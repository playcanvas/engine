pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.CollisionSphereComponentSystem
     * @constructor Create a new CollisionSphereComponentSystem
     * @class Manages creation of CollisionSphereComponents
     * @param {pc.fw.ApplicationContext} context The ApplicationContext of the running application
     * @extends pc.fw.ComponentSystem
     */
    var CollisionSphereComponentSystem = function CollisionSphereComponentSystem (context) {
        this.id = "collisionsphere";
        context.systems.add(this.id, this);

        this.ComponentType = pc.fw.CollisionSphereComponent;
        this.DataType = pc.fw.CollisionSphereComponentData;

        this.schema = [{
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

        // Create the graphical resources required to render a camera frustum
        var format = new pc.gfx.VertexFormat();
        format.begin();
        format.addElement(new pc.gfx.VertexElement("vertex_position", 3, pc.gfx.VertexElementType.FLOAT32));
        format.end();

        var vertexBuffer = new pc.gfx.VertexBuffer(format, 41);
        var positions = new Float32Array(vertexBuffer.lock());

        var i;
        var r = 0.5;
        var numVerts = vertexBuffer.getNumVertices();
        for (i = 0; i < numVerts-1; i++) {
            var theta = 2 * Math.PI * (i / (numVerts-2));
            var x = r * Math.cos(theta);
            var z = r * Math.sin(theta);
            positions[(i)*3+0] = x;
            positions[(i)*3+1] = 0;
            positions[(i)*3+2] = z;
        }
        vertexBuffer.unlock();

        var indexBuffer = new pc.gfx.IndexBuffer(pc.gfx.INDEXFORMAT_UINT8, 80);
        var inds = new Uint8Array(indexBuffer.lock());
        for (i = 0; i < 40; i++) {
            inds[i * 2 + 0] = i;
            inds[i * 2 + 1] = i + 1;
        }
        indexBuffer.unlock();

        this.mesh = new pc.scene.Mesh();
        this.mesh.vertexBuffer = vertexBuffer;
        this.mesh.indexBuffer[0] = indexBuffer;
        this.mesh.primitive[0].type = pc.gfx.PRIMITIVE_LINES;
        this.mesh.primitive[0].base = 0;
        this.mesh.primitive[0].count = indexBuffer.getNumIndices();
        this.mesh.primitive[0].indexed = true;

        this.material = new pc.scene.BasicMaterial();
        this.material.color = pc.math.vec4.create(0, 0, 1, 1);
        this.material.update();
        
        this.debugRender = false;

        this.on('remove', this.onRemove, this);

        pc.fw.ComponentSystem.on('update', this.onUpdate, this);
        pc.fw.ComponentSystem.on('toolsUpdate', this.onToolsUpdate, this);
    };
    CollisionSphereComponentSystem = pc.inherits(CollisionSphereComponentSystem, pc.fw.ComponentSystem);
    
    pc.extend(CollisionSphereComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            if (typeof(Ammo) !== 'undefined') {
                data.shape = new Ammo.btSphereShape(data.radius);    
            }

            data.model = new pc.scene.Model();
            data.model.graph = new pc.scene.GraphNode();
            data.model.meshInstances = [ new pc.scene.MeshInstance(data.model.graph, this.mesh, this.material) ];

            properties = ['radius', 'shape', 'model'];

            CollisionSphereComponentSystem._super.initializeComponentData.call(this, component, data, properties);

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
        * @name pc.fw.CollisionSphereComponentSystem#setDebugRender
        * @description Display collision shape outlines
        * @param {Boolean} value Enable or disable
        */
        setDebugRender: function (value) {
            this.debugRender = value;
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

                var r = data.radius;
                var model = data.model;

                if (!this.context.scene.containsModel(data.model)) {
                    this.context.scene.addModel(data.model);
                    this.context.root.addChild(data.model.graph);
                }

                var root = model.graph;
                root.setPosition(entity.getPosition());
                root.setRotation(entity.getRotation());
                root.setLocalScale(r / 0.5, r / 0.5, r / 0.5);
            }
        }
    });

    return {
        CollisionSphereComponentSystem: CollisionSphereComponentSystem
    };
}());