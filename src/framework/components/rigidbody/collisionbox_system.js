pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.CollisionBoxComponentSystem
     * @constructor Create a new CollisionBoxComponentSystem
     * @class Manages creation of CollisionBoxComponents
     * @param {pc.fw.ApplicationContext} context The ApplicationContext for the running application
     * @extends pc.fw.ComponentSystem
     */
    var CollisionBoxComponentSystem = function CollisionBoxComponentSystem (context) {
        this.id = "collisionbox";
        context.systems.add(this.id, this);

        this.ComponentType = pc.fw.CollisionBoxComponent;
        this.DataType = pc.fw.CollisionBoxComponentData;

        this.schema = [{
            name: "halfExtents",
            displayName: "Half Extents",
            description: "The half-extents of the box",
            type: "vector",
            options: {
                min: 0,
                step: 0.1
            },
            defaultValue: [0.5, 0.5, 0.5]
        }, {
            name: "shape",
            exposed: false
        }, {
            name: 'model',
            exposed: false
        }];

        this.exposeProperties();

        var gd = context.graphicsDevice;

        var format = new pc.gfx.VertexFormat(gd, [
            { semantic: pc.gfx.SEMANTIC_POSITION, components: 3, type: pc.gfx.ELEMENTTYPE_FLOAT32 }
        ]);

        var vertexBuffer = new pc.gfx.VertexBuffer(gd, format, 8);
        var positions = new Float32Array(vertexBuffer.lock());
        positions.set([
            -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5,
            -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5
        ]);
        vertexBuffer.unlock();

        var indexBuffer = new pc.gfx.IndexBuffer(gd, pc.gfx.INDEXFORMAT_UINT8, 24);
        var indices = new Uint8Array(indexBuffer.lock());
        indices.set([
            0,1,1,2,2,3,3,0,
            4,5,5,6,6,7,7,4,
            0,4,1,5,2,6,3,7
        ]);
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
    CollisionBoxComponentSystem = pc.inherits(CollisionBoxComponentSystem, pc.fw.ComponentSystem);
    
    CollisionBoxComponentSystem.prototype = pc.extend(CollisionBoxComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            if (typeof(Ammo) !== 'undefined') {
                data.shape = new Ammo.btBoxShape(new Ammo.btVector3(data.halfExtents[0], data.halfExtents[1], data.halfExtents[2]));
            }

            data.model = new pc.scene.Model();
            data.model.graph = new pc.scene.GraphNode();
            data.model.meshInstances = [ new pc.scene.MeshInstance(data.model.graph, this.mesh, this.material) ];
            
            properties = ['halfExtents', 'shape', 'model'];

            CollisionBoxComponentSystem._super.initializeComponentData.call(this, component, data, properties);

            if (component.entity.rigidbody) {
                component.entity.rigidbody.createBody();
            }
        },

        cloneComponent: function (entity, clone) {
            // overridden to make sure halfExtents is duplicated
            var src = this.dataStore[entity.getGuid()];
            var data = {
                halfExtents: pc.extend([], src.data.halfExtents)
            };
            return this.addComponent(clone, data);
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
        * @name pc.fw.CollisionBoxComponentSystem#setDebugRender
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

                var x = data.halfExtents[0];
                var y = data.halfExtents[1];
                var z = data.halfExtents[2];
                var model = data.model;

                if (!this.context.scene.containsModel(data.model)) {
                    this.context.scene.addModel(data.model);
                    this.context.root.addChild(data.model.graph);
                }

                var root = model.graph;
                root.setPosition(entity.getPosition());
                root.setRotation(entity.getRotation());
                root.setLocalScale(x / 0.5, y / 0.5, z / 0.5);
            }
        }
    });

    return {
        CollisionBoxComponentSystem: CollisionBoxComponentSystem
    };
}());