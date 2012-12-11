pc.extend(pc.fw, function () {
    // Shared math variable to avoid excessive allocation
    var transform = pc.math.mat4.create();
    var newWtm = pc.math.mat4.create();

    var position = pc.math.vec3.create();
    var rotation = pc.math.vec3.create();
    var scale = pc.math.vec3.create();

    /**
     * @private
     * @name pc.fw.Body3dComponentSystem
     * @constructor Create a new Body3dComponentSystem
     * @class 
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var Body3dComponentSystem = function Body3dComponentSystem (context) {
        this.id = 'body3d'
        context.systems.add(this.id, this);
        
        this.ComponentType = pc.fw.Body3dComponent;
        this.DataType = pc.fw.Body3dComponentData;

        this.schema = [{
            name: "mass",
            displayName: "Mass",
            description: "The mass of the body",
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
            name: "static",
            displayName: "Static",
            description: "Static bodies are immovable and do not collide with other static bodies.",
            type: "boolean",
            defaultValue: true
        }, {
            name: "body",
            exposed: false
        }];

        this.exposeProperties();

        this.debugRender = false;
        this._gfx = _createGfxResources();      // debug gfx resources
        this._rayStart = pc.math.vec3.create(); // for debugging raycasts
        this._rayEnd = pc.math.vec3.create();   // for debugging raycasts

        this.maxSubSteps = 10;
        this.fixedTimeStep = 1/60;
        this.gravityX = 0;
        this.gravityY = -9.82;
        this.gravityZ = 0;

        // Create the Ammo physics world
        if (typeof(Ammo) !== 'undefined') {
            var collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
            var dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
            var overlappingPairCache = new Ammo.btDbvtBroadphase();
            var solver = new Ammo.btSequentialImpulseConstraintSolver();
            this.dynamicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, overlappingPairCache, solver, collisionConfiguration);
            this.dynamicsWorld.setGravity(new Ammo.btVector3(this.gravityX, this.gravityY, this.gravityZ));
        }

        this.bind('remove', this.onRemove.bind(this));

        pc.fw.ComponentSystem.bind('update', this.onUpdate.bind(this));
    };
    Body3dComponentSystem = pc.inherits(Body3dComponentSystem, pc.fw.ComponentSystem);
    
    pc.extend(Body3dComponentSystem.prototype, {

        initializeComponentData: function (component, data, properties) {
            var properties = ['body', 'friction', 'mass', 'restitution', 'static'];
            Body3dComponentSystem._super.initializeComponentData.call(this, component, data, properties);

            component.entity.body3d.createBody();
        },

        onRemove: function (entity, data) {
            if (data.body) {
                this.removeBody(data.body);    
            }                
            data.body = null;
        },

        addBody: function (body) {
            this.dynamicsWorld.addRigidBody(body);
            return body;
        },

        removeBody: function (body) {
            this.dynamicsWorld.removeRigidBody(body);
        },

        /**
        * @private
        * @name pc.fw.Body3dComponentSystem#setGravity
        * @description Set the gravity vector for the 3D physics world
        */
        setGravity: function (x, y, z) {
            this.gravityX = x;
            this.gravityY = y;
            this.gravityZ = z;
            this.dynamicsWorld.setGravity(new Ammo.btVector3(this.gravityX, this.gravityY, this.gravityZ));
        },

        /**
        * @private
        * @name pc.fw.Body3dComponentSystem#raycast
        * @description Raycast the world for entities that intersect with the ray. Your callback controls whether you get the closest entity, 
        * any entity or n-entities. Entities that contain the starting point are ignored
        * @param {Function} callback Callback with signature `callback(entity, point, normal, fraction)`. The callback should return the 
        * the new length of the ray as a fraction of original length. So, returning 0, terminates; returning 1, continues with original ray,
        * returning current fraction will find the closest entity.
        */
        raycast: function (callback, start, end) {
            var rayFrom = new Ammo.btVector3(start[0], start[1], start[2]);
            var rayTo = new Ammo.btVector3(end[0], end[1], end[2]);

            var rayCallback = new Ammo.ClosestRayResultCallback(rayFrom, rayTo);
            this.dynamicsWorld.rayTest(rayFrom, rayTo, rayCallback);
            if (rayCallback.hasHit()) {
                var body = rayCallback.get_m_collisionObject();
                if (body) {
                    callback();
                }
            }
        },

        /**
        * @private
        * @name pc.fw.Body3dComponentSystem#raycastFirst
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
            // Update the transforms of all bodies
            this.dynamicsWorld.stepSimulation(dt, this.maxSubSteps, this.fixedTimeStep);

            // Update the transforms of all entities referencing a body
            var components = this.store;
            for (id in components) {
                if (components.hasOwnProperty(id)) {
                    var entity = components[id].entity;
                    var componentData = components[id].data;
                    if (componentData.body && !componentData.static) {
                        entity.body3d.updateTransform(componentData.body);
                    }
                }
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
        return {};
    };

    return {
        Body3dComponentSystem: Body3dComponentSystem
    };
}());