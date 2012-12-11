pc.extend(pc.fw, function () {
    // Shared math variable to avoid excessive allocation
    var transform = pc.math.mat4.create();
    var newWtm = pc.math.mat4.create();

    var position = pc.math.vec3.create();
    var rotation = pc.math.vec3.create();
    var scale = pc.math.vec3.create();

    var pos2d;

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

        pos2d = new b2Vec2();
    }


    /**
     * @private
     * @name pc.fw.Body2dComponentSystem
     * @constructor Create a new Body2dComponentSystem
     * @class 
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var Body2dComponentSystem = function Body2dComponentSystem (context) {
        // Lazily unpack Box2D variables into closure
        if (typeof(Box2D) !== 'undefined' && !b2World) {
            unpack();
        }

        this.id = 'body2d'
        context.systems.add(this.id, this);
        
        this.ComponentType = pc.fw.Body2dComponent;
        this.DataType = pc.fw.Body2dComponentData;

        this.schema = [{
            name: "static",
            displayName: "Static",
            description: "Static bodies are immovable and do not collide with other static bodies.",
            type: "boolean",
            defaultValue: true
        }, {
            name: "body",
            exposed: false,
            readOnly: true
        }, {
            name: "bodyDef",
            exposed: false,
            readOnly: true
        }];

        this.exposeProperties();

        this.debugRender = false;
        this._gfx = _createGfxResources();      // debug gfx resources
        this._rayStart = pc.math.vec3.create(); // for debugging raycasts
        this._rayEnd = pc.math.vec3.create();   // for debugging raycasts

        this.time = 0;
        this.step = 1/60;

        // Indexes for converting between 2D and 3D co-ords
        this.xi = 0; // 3D index that corresponds to 2D x-axis
        this.yi = 2; // 3D index that corresponds to 2D y-axis
        this.ri = 1; // 3D index that corresponds to the rotation axis

        // Create the Box2D physics world
        if (b2World) {
            this.b2World = new b2World(new b2Vec2(0,0), true);    
        }
        
        this.bind('remove', this.onRemove.bind(this));

        pc.fw.ComponentSystem.bind('update', this.onUpdate.bind(this));
    };
    Body2dComponentSystem = pc.inherits(Body2dComponentSystem, pc.fw.ComponentSystem);
    
    pc.extend(Body2dComponentSystem.prototype, {

        initializeComponentData: function (component, data, properties) {
            var properties = ['static'];
            Body2dComponentSystem._super.initializeComponentData.call(this, component, data, properties);

            if (typeof(Box2D) !== 'undefined') {
                // Create a static body at the current position
                this.initBodyDef(component);
                this.createBody(component);                
            }
        },

        initBodyDef: function (component) {
            var bodyDef = new b2BodyDef();

            pc.math.vec3.copy(component.entity.getPosition(), position);
            pc.math.vec3.copy(component.entity.getEulerAngles(), rotation);

            bodyDef.type = component.static ? b2Body.b2_staticBody : b2Body.b2_dynamicBody;
            bodyDef.position.Set(position[this.xi], position[this.yi]);
            
            var angle = component._eulersToAngle(rotation);

            bodyDef.angle = -angle * pc.math.DEG_TO_RAD;
            bodyDef.userData = component.entity;

            component.data.bodyDef = bodyDef;
        },

        onRemove: function (entity, data) {
            if (data.body) {
                this.removeBody(data.body);    
            }                
            data.body = null;
        },

        /*
        * Convert a pc.math.vec3 into a b2Vec2
        */
        to2d: function (vec3, vec2) {
            vec2 = vec2 || new b2Vec2();
            return vec2.Set(vec3[this.xi], vec3[this.yi]);
        },

        createBody: function (component) {
            if (component.entity.collisionrect) {
                component.data.body = this.addBody(component.bodyDef, component.entity.collisionrect.fixtureDef);
                //component.addCollision(component.entity.collisionrect);
            }
            else if (component.entity.collisioncircle) {
                component.data.body = this.addBody(component.bodyDef, component.entity.collisioncircle.fixtureDef);
            } else {
                component.data.body = null;
            }
        },

        addBody: function (bodyDef, fixtureDef) {
            var body = this.b2World.CreateBody(bodyDef);
            body.CreateFixture(fixtureDef);
            return body;            
        },

        removeBody: function(body) {
            this.b2World.DestroyBody(body)
        },

        /**
        * @private
        * @name pc.fw.Body2dComponentSystem#setGravity
        * @description Set the gravity vector for the 2D physics world
        */
        setGravity: function (x, y) {
            pos2d.Set(x,y);
            this.b2World.SetGravity(pos2d);
        },

        /**
        * @private
        * @name pc.fw.Body2dComponentSystem#raycast
        * @description Raycast the world for entities that intersect with the ray. Your callback controls whether you get the closest entity, 
        * any entity or n-entities. Entities that contain the starting point are ignored
        * @param {Function} callback Callback with signature `callback(entity, point, normal, fraction)`. The callback should return the 
        * the new length of the ray as a fraction of original length. So, returning 0, terminates; returning 1, continues with original ray,
        * returning current fraction will find the closest entity.
        */
        raycast: function (callback, start, end) {
            var s = new b2Vec2();
            var e = new b2Vec2();
            
            this.to2d(start, s);
            this.to2d(end, e);

            pc.math.vec3.copy(start, this._rayStart);
            pc.math.vec3.copy(end, this._rayEnd);

            this.b2World.RayCast(callback, s, e);
        },

        /**
        * @private
        * @name pc.fw.Body2dComponentSystem#raycastFirst
        * @description Raycast into the world (in 2D) and return the first Entity hit
        * @param {pc.math.vec3} start The ray start position
        * @param {pc.math.vec3} end The ray end position
        * @param {pc.fw.Entity} ignore An entity to ignore
        * @returns {pc.fw.Entity} The first Entity with a 2D collision shape hit by the ray.
        */
        raycastFirst: function (start, end, ignore) {
            var result;
            var fraction = 1;
            this.raycast(function (fixture, point, normal, f) {
                var e = fixture.GetUserData();
                if (e !== ignore && f < fraction) {
                    result = e;
                    fraction = f;
                }
                return 1;
            }, start, end);
            return result;
        },

        onUpdate: function (dt) {
            var velocityIterations = 6;
            var positionIterations = 2;
            var components = this.store;

            for (id in components) {
                if (components.hasOwnProperty(id)) {
                    var entity = components[id].entity;
                    var componentData = components[id].data;
                    if (componentData.body && !componentData.static) {
                        entity.body2d.updateTransform(componentData.body);
                    }
                }
            }

            this.time += dt;

            while (this.time > this.step) {
                this.b2World.Step(this.step, velocityIterations, positionIterations);
                this.time -= this.step;
            }
        },

        render: function () {
            if (this.debugRender) {
                var p1 = this._rayStart;
                var p2 = this._rayEnd;

                var positions = new Float32Array(this._gfx.vertexBuffer.lock());
                positions[0]  = p1[0];
                positions[1]  = p1[1];
                positions[2]  = p1[2];
                positions[3]  = p2[0];
                positions[4]  = p2[1];
                positions[5]  = p2[2];
                this._gfx.vertexBuffer.unlock();

                var device = pc.gfx.Device.getCurrent();
                device.setProgram(this._gfx.program);
                device.setIndexBuffer(this._gfx.indexBuffer);
                device.setVertexBuffer(this._gfx.vertexBuffer, 0);

                device.scope.resolve("matrix_model").setValue(pc.math.mat4.create());
                device.scope.resolve("uColor").setValue(this._gfx.color);
                device.draw({
                    type: pc.gfx.PrimType.LINES,
                    base: 0,
                    count: this._gfx.indexBuffer.getNumIndices(),
                    indexed: true
                });
            }
        }
    });


    var _createGfxResources = function () {
        // Create the graphical resources required to render a camera frustum
        var device = pc.gfx.Device.getCurrent();
        var library = device.getProgramLibrary();
        var program = library.getProgram("basic", { vertexColors: false, diffuseMap: false });
        var vertBufferLength = 2;
        var indexBufferLength = 2;

        var format = new pc.gfx.VertexFormat();
        format.begin();
        format.addElement(new pc.gfx.VertexElement("vertex_position", 3, pc.gfx.VertexElementType.FLOAT32));
        format.end();
        var vertexBuffer = new pc.gfx.VertexBuffer(format, vertBufferLength, pc.gfx.VertexBufferUsage.DYNAMIC);
        var indexBuffer = new pc.gfx.IndexBuffer(pc.gfx.IndexFormat.UINT8, indexBufferLength);
        var indices = new Uint8Array(indexBuffer.lock());
        indices.set([0,1]);
        indexBuffer.unlock();

        // Set the resources on the component
        return {
            program: program,
            indexBuffer: indexBuffer,
            vertexBuffer: vertexBuffer,
            color: [0,0,1,1]
        };
    };
    return {
        Body2dComponentSystem: Body2dComponentSystem
    };
}());