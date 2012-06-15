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
        var scale = pc.math.vec3.create();

        var pos2d = new b2Vec2();
        /**
         * @name pc.fw.Body2dComponentSystem
         * @constructor Create a new Body2dComponentSystem
         * @class 
         * @param {Object} context
         * @extends pc.fw.ComponentSystem
         */
        var Body2dComponentSystem = function Body2dComponentSystem (context) {
            context.systems.add("body2d", this);

            this.context = context;

            this._gfx = _createGfxResources();
            
            this.debugRender = false;

            this.time = 0;
            this.step = 1/60;

            // Indexes for converting between 2D and 3D co-ords
            this.xi = 0; // 3D index that corresponds to 2D x-axis
            this.yi = 2; // 3D index that corresponds to 2D y-axis
            this.ri = 1; // 3D index that corresponds to the rotation axis

            // Create the Box2D physics world
            this.b2world = new b2World(new b2Vec2(0,0), true);

            this.bind('set_density', this.onSetFixtureValue.bind(this));
            this.bind('set_friction', this.onSetFixtureValue.bind(this));
            this.bind('set_restitution', this.onSetFixtureValue.bind(this));
            this.bind('set_static', this.onSetStatic.bind(this));
            this.bind('set_shape', this.onSetShape.bind(this));
        };
        Body2dComponentSystem = pc.inherits(Body2dComponentSystem, pc.fw.ComponentSystem);
        
        Body2dComponentSystem.prototype = pc.extend(Body2dComponentSystem.prototype, {
            createComponent: function (entity, data) {
                var componentData = new pc.fw.Body2dComponentData();

                var attribs = ['density', 'friction', 'restitution', 'static', 'shape'];
                this.initialiseComponent(entity, componentData, data, attribs);

                entity.getLocalPosition(position);
                pc.math.mat4.toEulerXYZ(entity.getLocalTransform(), rotation);
                pc.math.mat4.getScale(entity.getLocalTransform(), scale);

                var fixtureDef = new b2FixtureDef();
                this.initFixtureDef(fixtureDef, componentData);
                fixtureDef.userData = this.entity;

                // Create a static body at the current position
                var bodyDef = new b2BodyDef();
                this.initBodyDef(bodyDef, componentData);

                componentData.fixtureDef = fixtureDef;
                componentData.bodyDef = bodyDef;

                componentData.body = this.addBody(bodyDef, fixtureDef);

                return componentData;
            },

            initBodyDef: function (bodyDef, componentData) {
                bodyDef.type = componentData['static'] ? b2Body.b2_staticBody : b2Body.b2_dynamicBody;
                bodyDef.position.Set(position[this.xi], position[this.yi]);
                bodyDef.angle = rotation[this.ri];
            },
            
            initFixtureDef: function(fixtureDef, componentData) {
                fixtureDef.density = componentData['density'];
                fixtureDef.friction = componentData['friction'];
                fixtureDef.restitution = componentData['restitution'];                        
                switch (componentData['shape']) {
                    case pc.shape.Type.RECT:
                        fixtureDef.shape = new b2PolygonShape();
                        fixtureDef.shape.SetAsBox(scale[this.xi]/2, scale[this.yi]/2);
                        break;
                    case pc.shape.Type.CIRCLE:
                        fixtureDef.shape = new b2CircleShape();
                        fixtureDef.shape.SetRadius(scale[this.xi]/2);
                        break;
                }
            },

            deleteComponent: function (entity) {
                this.removeComponent(entity);
            },

            addBody: function (bodyDef, fixtureDef) {
                var body = this.b2world.CreateBody(bodyDef);
                body.CreateFixture(fixtureDef);
                return body;            
            },

            removeBody: function(body) {
                this.b2world.DestroyBody(body)
            },

            /**
            * @name pc.fw.Body2dComponentSystem#setDebugRender
            * @description Display collision shape outlines
            * @param {Boolean} value Enable or disable
            */
            setDebugRender: function (value) {
                this.debugRender = value;
            },

            /**
            * @name pc.fw.Body2dComponentSystem#setGravity
            * @description Set the gravity vector for the 2D physics world
            */
            setGravity: function (x, y) {
                pos2d.Set(x,y);
                this.b2world.SetGravity(pos2d);
            },

            /**
            * @name pc.fw.Body2dComponentSystem#applyForce
            * @description Apply an force to the body
            * @param {pc.fw.Entity} entity The Entity to apply the force to
            * @param {pc.math.vec3} force The force to apply. A 3D world space vector, extra component is ignored
            * @param {pc.math.vec3} point The point at which to apply the force. A 3D world space vector, extra component is ignored
            */
            applyForce: function (entity, force, point) {
                var body = this.get(entity, 'body');
                if (body) {
                    if (!point) {
                        point = position;
                        point[this.xi] = body.GetPosition().x;
                        point[this.yi] = body.GetPosition().y;
                    }
                    body.ApplyForce({
                        x: force[this.xi],
                        y: force[this.yi]
                    }, {
                        x: point[this.xi],
                        y: point[this.yi]
                    });
                }
            },

            /**
            * @name pc.fw.Body2dComponentSystem#applyImpulse
            * @description Apply an impulse (instantaneous change of velocity) to the body
            * @param {pc.fw.Entity} entity The Entity to apply the impulse to
            * @param {pc.math.vec3} impulse The impulse to apply. A 3D world space vector, extra component is ignored
            * @param {pc.math.vec3} point The point at which to apply the impulse. A 3D world space vector, extra component is ignored
            */
            applyImpulse: function (entity, impulse, point) {
                var body = this.get(entity, 'body');
                if (body) {
                    if (!point) {
                        point = position;
                        point[this.xi] = body.GetPosition().x;
                        point[this.yi] = body.GetPosition().y;
                    }

                    body.ApplyImpulse({
                        x: impulse[this.xi],
                        y: impulse[this.yi]
                    }, {
                        x: point[this.xi],
                        y: point[this.yi]
                    });
                }
            },

            /**
            * @name pc.fw.Body2dComponentSystem#setLinearVelocity
            * @description Set the linear velocity of the body
            * @param {pc.fw.Entity} entity The Entity to change
            * @param {Number} x The x value of the velocity
            * @param {Number} y The y value of the velocity
            */
            setLinearVelocity: function (entity, x, y) {
                var body = this.get(entity, 'body');
                if (body) {
                    var vel = body.GetLinearVelocity();
                    vel.x = x;
                    vel.y = y;
                    body.SetLinearVelocity(vel);
                }
            },

            /**
            * @name pc.fw.Body2dComponentSystem#setPosition
            * @description Set the position of the body
            * @param {pc.fw.Entity} entity The Entity to change
            * @param {Number} x The x value of the position
            * @param {Number} y The y value of the position
            */
            setPosition: function (entity, x, y) {
                var body = this.get(entity, 'body');
                if (body) {
                    var pos = body.GetPosition();
                    pos.x = x;
                    pos.y = y;
                    body.SetPosition(pos);
                }
            },

            /**
            * @name pc.fw.Body2dComponentSystem#setLinearDamping
            * @description Set the linear damping value of the body. Damping parameters should be between 0 and infinity, with 0 meaning no damping, and infinity 
    meaning full damping. Normally you will use a damping value between 0 and 0.1
            * @param {pc.fw.Entity} entity The Entity to change
            * @param {Number} damping The damping value
            */
            setLinearDamping: function (entity, damping) {
                var body = this.get(entity, 'body');
                if(body) {
                    body.SetLinearDamping(damping);
                }
            },

            update: function (dt) {
                var velocityIterations = 6;
                var positionIterations = 2;
                var components = this.getComponents();

                for (id in components) {
                    if (components.hasOwnProperty(id)) {
                        entity = components[id].entity;
                        componentData = components[id].component;
                        if (componentData.body) {
                            var position2d = componentData.body.GetPosition();

                            position[this.xi] = position2d.x;
                            position[this.yi] = position2d.y;
                            position[this.ri] = 0;

                            rotation[this.xi] = 0;
                            rotation[this.zi] = 0;
                            rotation[this.ri] = -componentData.body.GetAngle();

                            ltm = entity.getLocalTransform();
                            pc.math.mat4.getScale(ltm, scale);

                            pc.math.mat4.compose(position,rotation,scale, ltm);
                        }
                    }
                }

                this.time += dt;

                while (this.time > this.step) {
                    this.b2world.Step(this.step, velocityIterations, positionIterations);
                    this.time -= this.step;
                }
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

                        switch(componentData['shape']) {
                            case pc.shape.Type.RECT:
                                var indexBuffer = this._gfx.rectIndexBuffer;
                                var vertexBuffer = this._gfx.rectVertexBuffer;

                                this.renderRect(entity, vertexBuffer, indexBuffer);
                                break;
                            case pc.shape.Type.CIRCLE:
                                var indexBuffer = this._gfx.circleIndexBuffer;
                                var vertexBuffer = this._gfx.circleVertexBuffer;

                                this.renderCircle(entity, vertexBuffer, indexBuffer);
                                break;
                        }
                    }
                }
            },

            render: function () {
                if (this.debugRender) {
                    this.toolsRender();
                }
            },

            renderRect: function (entity, vertexBuffer, indexBuffer) {
                var positions = new Float32Array(vertexBuffer.lock());

                positions[0]  = -0.5;
                positions[1]  = 0;
                positions[2]  = -0.5
                positions[3]  = 0.5;
                positions[4]  = 0;
                positions[5]  = -0.5;
                positions[6]  = 0.5;
                positions[7]  = 0;
                positions[8]  = 0.5;
                positions[9]  = -0.5;
                positions[10] = 0;
                positions[11] = 0.5;
                vertexBuffer.unlock();

                var device = pc.gfx.Device.getCurrent();
                device.setProgram(this._gfx.program);
                device.setIndexBuffer(indexBuffer);
                device.setVertexBuffer(vertexBuffer, 0);

                var transform = entity.getWorldTransform();
                device.scope.resolve("matrix_model").setValue(transform);
                device.scope.resolve("constant_color").setValue(this._gfx.color);
                device.draw({
                    type: pc.gfx.PrimType.LINES,
                    base: 0,
                    count: indexBuffer.getNumIndices(),
                    indexed: true
                });            
            },

            renderCircle: function (entity, vertexBuffer, indexBuffer) {
                var positions = new Float32Array(vertexBuffer.lock());
                    positions[0] = 0;
                    positions[1] = 0;
                    positions[2] = 0;

                    var r = 0.5;
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

                    transform = entity.getWorldTransform();
                    device.scope.resolve("matrix_model").setValue(transform);
                    device.scope.resolve("constant_color").setValue(this._gfx.color);
                    device.draw({
                        type: pc.gfx.PrimType.LINES,
                        base: 0,
                        count: indexBuffer.getNumIndices(),
                        indexed: true
                    });
            },

            onSetFixtureValue: function (entity, name, oldValue, newValue) {
                var body = this.get(entity, 'body');
                if (body) {
                    // We only support a single fixture at the moment
                    var fixture = body.GetFixtureList();
                    var accessors = {
                        density: fixture.SetDensity,
                        friction: fixture.SetFriction,
                        restitution: fixture.SetRestitution
                    };
                    accessors[name].call(body, newValue);
                    // Update the body with changes
                    body.ResetMassData();
                }
            },

            onSetStatic: function (entity, name, oldValue, newValue) {
                var body = this.get(entity, 'body');
                if (body) {
                    if (newValue) {
                        body.SetType(b2Body.b2_staticBody);
                    } else {
                        body.SetType(b2Body.b2_dynamicBody);
                    }
                }
            },

            onSetShape: function (entity, name, oldValue, newValue) {
                var componentData = this.getComponentData(entity);

                if (componentData['shape'] !== newValue) {
                    // Shape change, delete and add new body
                    this.removeBody(componentData.body);

                    componentData['shape'] = newValue;
                    this.initFixtureDef(componentData['fixtureDef'], componentData);

                    componentData.body = this.addBody(bodyDef, fixtureDef);
                }

            }

        });

        return {
            Body2dComponentSystem: Body2dComponentSystem
        };
    }());
}