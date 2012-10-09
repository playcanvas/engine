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
            context.systems.add("collisionrect", this);

            this.context = context;

            this._gfx = _createGfxResources();
            
            this.debugRender = false;

            this.time = 0;
            this.step = 1/60;

            // Indexes for converting between 2D and 3D co-ords
            this.xi = 0; // 3D index that corresponds to 2D x-axis
            this.yi = 2; // 3D index that corresponds to 2D y-axis
            this.ri = 1; // 3D index that corresponds to the rotation axis

            this.bind('set_density', this.onSetFixtureValue.bind(this));
            this.bind('set_friction', this.onSetFixtureValue.bind(this));
            this.bind('set_restitution', this.onSetFixtureValue.bind(this));
            this.bind('set_x', this.onSetShapeValue.bind(this));
            this.bind('set_y', this.onSetShapeValue.bind(this));
        };
        CollisionRectComponentSystem = pc.inherits(CollisionRectComponentSystem, pc.fw.ComponentSystem);
        
        CollisionRectComponentSystem.prototype = pc.extend(CollisionRectComponentSystem.prototype, {
            createComponent: function (entity, data) {
                var componentData = new pc.fw.CollisionRectComponentData();

                var attribs = ['density', 'friction', 'restitution', 'x', 'y'];
                this.initialiseComponent(entity, componentData, data, attribs);

                var fixtureDef = new b2FixtureDef();
                this.initFixtureDef(entity, fixtureDef, componentData);

                componentData['fixtureDef'] = fixtureDef;

                return componentData;
            },
            
            initFixtureDef: function(entity, fixtureDef, componentData) {
                fixtureDef.density = componentData['density'];
                fixtureDef.friction = componentData['friction'];
                fixtureDef.restitution = componentData['restitution'];                        
                fixtureDef.shape = new b2PolygonShape();
                fixtureDef.shape.SetAsBox(componentData['x'], componentData['y']);
                fixtureDef.userData = entity;
            },

            deleteComponent: function (entity) {
                this.removeComponent(entity);
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

            toolsRender: function () {
                var id;
                var entity;
                var componentData;
                var components = this.getComponents();

                for (id in components) {
                    if (components.hasOwnProperty(id)) {
                        entity = components[id].entity;
                        componentData = components[id].component;

                        var indexBuffer = this._gfx.rectIndexBuffer;
                        var vertexBuffer = this._gfx.rectVertexBuffer;

                        this.renderRect(entity, componentData, vertexBuffer, indexBuffer);
                    }
                }
            },

            render: function () {
                if (this.debugRender) {
                    this.toolsRender();
                }
            },

            renderRect: function (entity, data, vertexBuffer, indexBuffer) {
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

                pc.math.vec3.copy(entity.getEulerAngles(), rotation);
                rotation[this.xi] = 0;
                rotation[this.yi] = 0;
                pc.math.quat.setFromEulers(constrainedRotation, rotation);

                pc.math.mat4.compose(entity.getPosition(), constrainedRotation, scale, transform);

                device.scope.resolve("matrix_model").setValue(transform);
                device.scope.resolve("uColor").setValue(this._gfx.color);
                device.draw({
                    type: pc.gfx.PrimType.LINES,
                    base: 0,
                    count: indexBuffer.getNumIndices(),
                    indexed: true
                });
            },

            onSetFixtureValue: function (entity, name, oldValue, newValue) {
                var body = this.context.systems.body2d.get(entity, 'body');
                if (body) {
                    // We only support a single fixture at the moment
                    var fixture = body.GetFixtureList();
                    var accessors = {
                        density: fixture.SetDensity,
                        friction: fixture.SetFriction,
                        restitution: fixture.SetRestitution
                    };
                    accessors[name].call(fixture, newValue);
                    // Update the body with changes
                    body.ResetMassData();
                }
            },

            onSetShapeValue: function (entity, name, oldValue, newValue) {
                var body = this.context.systems.body2d.get(entity, 'body');
                if (body) {
                    // We only support a single fixture at the moment
                    var fixture = body.GetFixtureList();
                    var shape = fixture.GetShape();
                    
                    var b = {
                        x: this.get(entity, 'x'),
                        y: this.get(entity, 'y')
                    };

                    b[name] = newValue;
                    
                    shape.SetAsBox(b.x, b.y);

                    body.SetAwake(true);
                }
            }
        });

        return {
            CollisionRectComponentSystem: CollisionRectComponentSystem
        };
    }());
}