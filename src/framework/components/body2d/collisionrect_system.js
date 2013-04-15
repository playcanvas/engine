pc.extend(pc.fw, function () {
    // Unpack common Box2D code
    var b2World, b2Vec2, b2Body, b2BodyDef, b2FixtureDef, b2PolygonShape, b2CircleShape;
    function unpack() {
        b2World = Box2D.Dynamics.b2World;
        b2Vec2 = Box2D.Common.Math.b2Vec2;
        b2Body = Box2D.Dynamics.b2Body;
        b2BodyDef = Box2D.Dynamics.b2BodyDef;
        b2FixtureDef = Box2D.Dynamics.b2FixtureDef;
        b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape;
        b2CircleShape = Box2D.Collision.Shapes.b2CircleShape;
    }

    // Shared vectors to avoid excessive allocation
    var position = pc.math.vec3.create();
    var rotation = pc.math.vec3.create();
    var scale = pc.math.vec3.create(1, 1, 1);
    var transform = pc.math.mat4.create();

    /**
     * @private
     * @name pc.fw.CollisionRectComponentSystem
     * @constructor Create a new CollisionRectComponentSystem
     * @class 
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var CollisionRectComponentSystem = function CollisionRectComponentSystem (context) {
        if (typeof(Box2D) !== 'undefined' && !b2World) {
            unpack();
        }

        this.id = "collisionrect";
        context.systems.add(this.id, this);

        this.ComponentType = pc.fw.CollisionRectComponent;
        this.DataType = pc.fw.CollisionRectComponentData;

        this.schema = [{
            name: "density",
            displayName: "Density",
            description: "The density of the body, this determine the mass",
            type: "number",
            options: {
                min: 0,
                step: 0.01
            },
            defaultValue: 1
        }, {
            name: "friction",
            displayName: "Friction",
            description: "The friction when the body slides along another body",
            type: "number",
            options: {
                min: 0,
                step: 0.01
            },
            defaultValue: 0.5
        }, {
            name: "restitution",
            displayName: "Restitution",
            description: "The restitution determines the elasticity of collisions. 0 means an object doesn't bounce at all, a value of 1 will be a perfect reflection",
            type: "number",
            options: {
                min: 0,
                step: 0.01
            },
            defaultValue: 0
        }, {
            name: "x",
            displayName: "Size: X",
            description: "The size of the Rect in the x-axis",
            type: "number",
            options: {
                min: 0,
                step: 0.1
            },
            defaultValue: 0.5
        }, {
            name: "y",
            displayName: "Size: Y",
            description: "The size of the Rect in the y-axis",
            type: "number",
            options: {
                min: 0,
                step: 0.1
            },
            defaultValue: 0.5
        }, {
            name: 'model',
            expose: false
        }];

        this.exposeProperties();


        var format = new pc.gfx.VertexFormat();
        format.begin();
        format.addElement(new pc.gfx.VertexElement("vertex_position", 3, pc.gfx.VertexElementType.FLOAT32));
        format.end();

        var vertexBuffer = new pc.gfx.VertexBuffer(format, 4);
        var positions = new Float32Array(vertexBuffer.lock());
        positions.set([
            -0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 0, -0.5
        ]);
        vertexBuffer.unlock();

        var indexBuffer = new pc.gfx.IndexBuffer(pc.gfx.INDEXFORMAT_UINT8, 8);
        var indices = new Uint8Array(indexBuffer.lock());
        indices.set([
            0,1,1,2,2,3,3,0
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
    CollisionRectComponentSystem = pc.inherits(CollisionRectComponentSystem, pc.fw.ComponentSystem);
    
    CollisionRectComponentSystem.prototype = pc.extend(CollisionRectComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {

            data.model = new pc.scene.Model();
            data.model.graph = new pc.scene.GraphNode();
            data.model.meshInstances = [ new pc.scene.MeshInstance(data.model.graph, this.mesh, this.material) ];

            properties = ['density', 'friction', 'restitution', 'x', 'y', 'model'];
            CollisionRectComponentSystem._super.initializeComponentData.call(this, component, data, properties);

            if (typeof(Box2D) !== 'undefined') {
                component.fixtureDef = this.createFixtureDef(component.entity, component);
                
                if (component.entity.body2d) {
                    this.context.systems.body2d.createBody(component.entity.body2d);
                }
            }
        },
        
        createFixtureDef: function(entity, componentData) {
            var fixtureDef = new b2FixtureDef();
                
            fixtureDef.density = componentData.density;
            fixtureDef.friction = componentData.friction;
            fixtureDef.restitution = componentData.restitution;
            fixtureDef.shape = new b2PolygonShape();
            fixtureDef.shape.SetAsBox(componentData.x, componentData.y);
            fixtureDef.userData = entity;

            return fixtureDef;
        },

        onRemove: function (entity, data) {
            if (entity.body2d && entity.body2d.body) {
                this.context.systems.body2d.removeBody(entity, entity.body2d.body);
            }

            if (this.context.scene.containsModel(data.model)) {
                this.context.scene.removeModel(data.model);
                this.context.root.removeChild(data.model.graph);
            }
        },

        /**
        * @private
        * @name pc.fw.CollisionRectComponentSystem#setDebugRender
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
            var xi = this.context.systems.body2d.xi;
            var yi = this.context.systems.body2d.yi;
            var ri = this.context.systems.body2d.ri;

            for (var id in components) {
                var entity = components[id].entity;
                var data = components[id].data;
            
                if (!this.context.scene.containsModel(data.model)) {
                    this.context.scene.addModel(data.model);
                    this.context.root.addChild(data.model.graph);
                }
            
                var s = [];
                s[xi] = data.x * 2;
                s[yi] = data.y * 2;
                s[ri] = 0.5 * 2;

                var model = data.model;

                var root = model.graph;
                root.setPosition(entity.getPosition());
                root.setRotation(entity.getRotation());
                root.setLocalScale(s[0], s[1], s[2]);
            }
        }
    });

    return {
        CollisionRectComponentSystem: CollisionRectComponentSystem
    };
}());