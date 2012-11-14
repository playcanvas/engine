if (typeof(Box2D) !== 'undefined') {
    pc.extend(pc.fw, function () {
        // Unpack common Box2D code
        var b2World = Box2D.Dynamics.b2World;
        var b2Vec2 = Box2D.Common.Math.b2Vec2;
        var b2Body = Box2D.Dynamics.b2Body;
        var b2BodyDef = Box2D.Dynamics.b2BodyDef;
        var b2FixtureDef = Box2D.Dynamics.b2FixtureDef;
        var b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape;
        var b2CircleShape = Box2D.Collision.Shapes.b2CircleShape;

        // Shared vectors to avoid excessive allocation
        var position = pc.math.vec3.create();
        var rotation = pc.math.vec3.create();
        var constrainedRotation = pc.math.quat.create();
        var scale = pc.math.vec3.create(1, 1, 1);
        var transform = pc.math.mat4.create();

        var pos2d = new b2Vec2();

        /**
         * @private
         * @name pc.fw.CollisionRectComponentSystem
         * @constructor Create a new CollisionRectComponentSystem
         * @class 
         * @param {Object} context
         * @extends pc.fw.ComponentSystem
         */
        var CollisionRectComponentSystem = function CollisionRectComponentSystem (context) {
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
                    step: 0.1,
                },
                defaultValue: 0.5
            }, {
                name: "y",
                displayName: "Size: Y",
                description: "The size of the Rect in the y-axis",
                type: "number",
                options: {
                    min: 0,
                    step: 0.1,
                },
                defaultValue: 0.5
            }];

            this.exposeProperties();

            this._gfx = _createGfxResources();
            
            this.debugRender = false;

            this.time = 0;
            this.step = 1/60;

            // Indexes for converting between 2D and 3D co-ords
            this.xi = 0; // 3D index that corresponds to 2D x-axis
            this.yi = 2; // 3D index that corresponds to 2D y-axis
            this.ri = 1; // 3D index that corresponds to the rotation axis

            this.bind('remove', this.onRemove.bind(this));

            pc.fw.ComponentSystem.bind('update', this.onUpdate.bind(this));
            pc.fw.ComponentSystem.bind('toolsUpdate', this.onToolsUpdate.bind(this));
              
        };
        CollisionRectComponentSystem = pc.inherits(CollisionRectComponentSystem, pc.fw.ComponentSystem);
        
        CollisionRectComponentSystem.prototype = pc.extend(CollisionRectComponentSystem.prototype, {
            initializeComponentData: function (component, data, properties) {
                properties = ['density', 'friction', 'restitution', 'x', 'y'];
                CollisionRectComponentSystem._super.initializeComponentData.call(this, component, data, properties);

                var fixtureDef = new b2FixtureDef();
                this.initFixtureDef(component.entity, fixtureDef, component);

                component.fixtureDef = fixtureDef;
            },
            
            initFixtureDef: function(entity, fixtureDef, componentData) {
                fixtureDef.density = componentData['density'];
                fixtureDef.friction = componentData['friction'];
                fixtureDef.restitution = componentData['restitution'];                        
                fixtureDef.shape = new b2PolygonShape();
                fixtureDef.shape.SetAsBox(componentData['x'], componentData['y']);
                fixtureDef.userData = entity;
            },

            onRemove: function (entity, data) {
                this.context.systems.body2d.removeBody(entity.body2d.body);
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
                    var components = this.store;
                    for (id in components) {
                        this.renderRect(components[id].entity, components[id].data, this._gfx.rectVertexBuffer, this._gfx.rectIndexBuffer);
                    }
                }
            },

            onToolsUpdate: function (dt) {
                var components = this.store;
                for (id in components) {
                    this.renderRect(components[id].entity, components[id].data, this._gfx.rectVertexBuffer, this._gfx.rectIndexBuffer);
                }
            },

            renderRect: function (entity, data, vertexBuffer, indexBuffer) {
                this.context.scene.enqueue("opaque", function () {
                    var positions = new Float32Array(vertexBuffer.lock());

                    positions[0]  = -data['x'];
                    positions[1]  = 0;
                    positions[2]  = -data['y'];
                    positions[3]  = data['x'];
                    positions[4]  = 0;
                    positions[5]  = -data['y'];
                    positions[6]  = data['x'];
                    positions[7]  = 0;
                    positions[8]  = data['y'];
                    positions[9]  = -data['x'];
                    positions[10] = 0;
                    positions[11] = data['y'];
                    vertexBuffer.unlock();

                    var device = pc.gfx.Device.getCurrent();
                    device.setProgram(this._gfx.program);
                    device.setIndexBuffer(indexBuffer);
                    device.setVertexBuffer(vertexBuffer, 0);

                    pc.math.mat4.compose(entity.getPosition(), entity.getRotation(), scale, transform);

                    device.scope.resolve("matrix_model").setValue(transform);
                    device.scope.resolve("uColor").setValue(this._gfx.color);
                    device.draw({
                        type: pc.gfx.PrimType.LINES,
                        base: 0,
                        count: indexBuffer.getNumIndices(),
                        indexed: true
                    });
                }.bind(this));
            }
        });


        var _createGfxResources = function () {
            // Create the graphical resources required to render a camera frustum
            var device = pc.gfx.Device.getCurrent();
            var library = device.getProgramLibrary();
            var program = library.getProgram("basic", { vertexColors: false, diffuseMap: false });
            var vertBufferLength = 4;
            var indexBufferLength = 8;

            var format = new pc.gfx.VertexFormat();
            format.begin();
            format.addElement(new pc.gfx.VertexElement("vertex_position", 3, pc.gfx.VertexElementType.FLOAT32));
            format.end();
            var rectVertexBuffer = new pc.gfx.VertexBuffer(format, vertBufferLength, pc.gfx.VertexBufferUsage.DYNAMIC);
            var rectIndexBuffer = new pc.gfx.IndexBuffer(pc.gfx.IndexFormat.UINT8, indexBufferLength);
            var indices = new Uint8Array(rectIndexBuffer.lock());
            indices.set([0,1,1,2,2,3,3,0]);
            rectIndexBuffer.unlock();

            var format = new pc.gfx.VertexFormat();
            format.begin();
            format.addElement(new pc.gfx.VertexElement("vertex_position", 3, pc.gfx.VertexElementType.FLOAT32));
            format.end();
            var circleVertexBuffer = new pc.gfx.VertexBuffer(format, 42, pc.gfx.VertexBufferUsage.DYNAMIC);
            var circleIndexBuffer = new pc.gfx.IndexBuffer(pc.gfx.IndexFormat.UINT8, 80);
            var inds = new Uint8Array(circleIndexBuffer.lock());
            
            // Spot cone circle - 40 segments
            for (var i = 0; i < 40; i++) {
                inds[i * 2 + 0] = i + 1;
                inds[i * 2 + 1] = i + 2;
            }
            circleIndexBuffer.unlock();

            // Set the resources on the component
            return {
                program: program,
                rectIndexBuffer: rectIndexBuffer,
                rectVertexBuffer: rectVertexBuffer,
                circleIndexBuffer: circleIndexBuffer,
                circleVertexBuffer: circleVertexBuffer,
                color: [0,0,1,1]
            };
        };

        return {
            CollisionRectComponentSystem: CollisionRectComponentSystem
        };
    }());
}