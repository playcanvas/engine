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
        var scale = pc.math.vec3.create(1, 1, 1);
        var transform = pc.math.mat4.create();

        var pos2d = new b2Vec2();

        /**
         * @private
         * @name pc.fw.CollisionCircleComponentSystem
         * @constructor Create a new CollisionCircleComponentSystem
         * @class 
         * @param {Object} context
         * @extends pc.fw.ComponentSystem
         */
        var CollisionCircleComponentSystem = function CollisionCircleComponentSystem (context) {
            this.id = "collisioncircle";
            context.systems.add(this.id, this);

            this.ComponentType = pc.fw.CollisionCircleComponent;
            this.DataType = pc.fw.CollisionCircleComponentData;

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
                name: "radius",
                displayName: "Radius",
                description: "The size of the Rect in the x-axis",
                type: "number",
                options: {
                    min: 0,
                    step: 0.1,
                },
                defaultValue: 1
            }];

            this.exposeProperties();

            this._gfx = _createGfxResources();
            
            this.debugRender = false;

            // Indexes for converting between 2D and 3D co-ords
            this.xi = 0; // 3D index that corresponds to 2D x-axis
            this.yi = 2; // 3D index that corresponds to 2D y-axis
            this.ri = 1; // 3D index that corresponds to the rotation axis

            pc.fw.ComponentSystem.bind('update', this.onUpdate.bind(this));
        };
        CollisionCircleComponentSystem = pc.inherits(CollisionCircleComponentSystem, pc.fw.ComponentSystem);
        
        pc.extend(CollisionCircleComponentSystem.prototype, {
            initializeComponentData: function (component, data, properties) {
                properties = ['density', 'friction', 'restitution', 'radius'];
                CollisionCircleComponentSystem._super.initializeComponentData.call(this, component, data, properties);

                var fixtureDef = new b2FixtureDef();
                this.initFixtureDef(component.entity, fixtureDef, component);

                component.fixtureDef = fixtureDef;
            },
            
            initFixtureDef: function(entity, fixtureDef, component) {
                fixtureDef.density = component.density;
                fixtureDef.friction = component.friction;
                fixtureDef.restitution = component.restitution;                        
                fixtureDef.shape = new b2CircleShape();
                fixtureDef.shape.SetRadius(component.radius);
                fixtureDef.userData = entity;
            },

            /**
            * @private
            * @name pc.fw.CollisionCircleComponentSystem#setDebugRender
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
                        this.renderCircle(components[id].entity, components[id].data, this._gfx.vertexBuffer, this._gfx.indexBuffer);
                    }                    
                }
            },

            renderCircle: function (entity, data, vertexBuffer, indexBuffer) {
                this.context.scene.enqueue('overlay', function () {
                    var positions = new Float32Array(vertexBuffer.lock());
                    positions[0] = 0;
                    positions[1] = 0;
                    positions[2] = 0;

                    var r = data['radius'];
                    var numVerts = vertexBuffer.getNumVertices();
                    for (var i = 0; i < numVerts-1; i++) {
                        var theta = 2 * Math.PI * (i / (numVerts-2));
                        var x = r * Math.cos(theta);
                        var z = r * Math.sin(theta);
                        positions[(i+1)*3+0] = x;
                        positions[(i+1)*3+1] = 0;
                        positions[(i+1)*3+2] = z;
                    }
                    vertexBuffer.unlock();

                    // Render a representation of the light
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

            // var format = new pc.gfx.VertexFormat();
            // format.begin();
            // format.addElement(new pc.gfx.VertexElement("vertex_position", 3, pc.gfx.VertexElementType.FLOAT32));
            // format.end();
            // var rectVertexBuffer = new pc.gfx.VertexBuffer(format, vertBufferLength, pc.gfx.VertexBufferUsage.DYNAMIC);
            // var rectIndexBuffer = new pc.gfx.IndexBuffer(pc.gfx.IndexFormat.UINT8, indexBufferLength);
            // var indices = new Uint8Array(rectIndexBuffer.lock());
            // indices.set([0,1,1,2,2,3,3,0]);
            // rectIndexBuffer.unlock();

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
                indexBuffer: circleIndexBuffer,
                vertexBuffer: circleVertexBuffer,
                color: [0,0,1,1]
            };
        };

        return {
            CollisionCircleComponentSystem: CollisionCircleComponentSystem
        };
    }());
}