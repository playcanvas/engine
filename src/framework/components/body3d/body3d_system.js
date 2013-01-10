pc.extend(pc.fw, function () {
    // Shared math variable to avoid excessive allocation
    var transform = pc.math.mat4.create();
    var newWtm = pc.math.mat4.create();

    var position = pc.math.vec3.create();
    var rotation = pc.math.vec3.create();
    var scale = pc.math.vec3.create();

    var RaycastResult = function (entity, point, normal) {
        this.entity = entity;
        this.point = point;
        this.normal = normal;
    };

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

        // this._rayStart = pc.math.vec3.create(); // for debugging raycasts
        // this._rayEnd = pc.math.vec3.create();   // for debugging raycasts

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
            
            // Only bind 'update' if Ammo is loaded
            pc.fw.ComponentSystem.on('update', this.onUpdate, this);
        }

        this.on('remove', this.onRemove, this);

        
    };
    Body3dComponentSystem = pc.inherits(Body3dComponentSystem, pc.fw.ComponentSystem);
    
    pc.extend(Body3dComponentSystem.prototype, {

        initializeComponentData: function (component, data, properties) {
            var properties = ['body', 'friction', 'mass', 'restitution', 'static'];
            Body3dComponentSystem._super.initializeComponentData.call(this, component, data, properties);

            component.entity.body3d.createBody();
            component.entity._setPosition = component.entity.setPosition;
            component.entity.setPosition = pc.fw.Body3dComponent.prototype._setPosition;
        },

        onRemove: function (entity, data) {
            if (data.body) {
                this.removeBody(data.body);    
            }                
            data.body = null;

            entity.setPosition = entity._setPosition;
            delete entity._setPosition;
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
        * @name pc.fw.Body3dComponentSystem#raycastFirst
        * @description Raycast the world and return the first entity the ray hits. Fire a ray into the world from start to end, 
        * if the ray hits an entity with a body3d component, the callback function is called along with a {@link pc.fw.RaycastResult}.
        * @param {pc.math.vec3} start The world space point where the ray starts
        * @param {pc.math.vec3} end The world space point where the ray ends
        * @param {Function} callback Function called if ray hits another body. Passed a single argument: a {@link pc.fw.RaycastResult} object
        */
        raycastFirst: function (start, end, callback) {
            var rayFrom = new Ammo.btVector3(start[0], start[1], start[2]);
            var rayTo = new Ammo.btVector3(end[0], end[1], end[2]);
            var rayCallback = new Ammo.ClosestRayResultCallback(rayFrom, rayTo);

            this.dynamicsWorld.rayTest(rayFrom, rayTo, rayCallback);
            if (rayCallback.hasHit()) {
                var body = Module.castObject(rayCallback.get_m_collisionObject(), Ammo.btRigidBody);
                var point = rayCallback.get_m_hitPointWorld();
                var normal = rayCallback.get_m_hitNormalWorld();

                if (body) {
                    callback(new RaycastResult(
                                    body.entity, 
                                    pc.math.vec3.create(point.x(), point.y(), point.z()),
                                    pc.math.vec3.create(normal.x(), normal.y(), normal.z())
                                )
                            );
                }
            }

            Ammo.destroy(rayFrom);
            Ammo.destroy(rayTo);
            Ammo.destroy(rayCallback);
        },


        /**
        * @private
        * @name pc.fw.Body3dComponentSystem#raycast
        * @description Raycast the world and return all entities the ray hits. Fire a ray into the world from start to end, 
        * if the ray hits an entity with a body3d component, the callback function is called along with a {@link pc.fw.RaycastResult}.
        * @param {pc.math.vec3} start The world space point where the ray starts
        * @param {pc.math.vec3} end The world space point where the ray ends
        * @param {Function} callback Function called if ray hits another body. Passed a single argument: a {@link pc.fw.RaycastResult} object
        */
        // raycast: function (start, end, callback) {
        //     var rayFrom = new Ammo.btVector3(start[0], start[1], start[2]);
        //     var rayTo = new Ammo.btVector3(end[0], end[1], end[2]);
        //     var rayCallback = new Ammo.AllHitsRayResultCallback(rayFrom, rayTo);

        //     this.dynamicsWorld.rayTest(rayFrom, rayTo, rayCallback);
        //     if (rayCallback.hasHit()) {
        //         var body = Module.castObject(rayCallback.get_m_collisionObject(), Ammo.btRigidBody);
        //         var point = rayCallback.get_m_hitPointWorld();
        //         var normal = rayCallback.get_m_hitNormalWorld();

        //         if (body) {
        //             callback(new RaycastResult(
        //                             body.entity, 
        //                             pc.math.vec3.create(point.x(), point.y(), point.z()),
        //                             pc.math.vec3.create(normal.x(), normal.y(), normal.z())
        //                         )
        //                     );
        //         }
        //     }

        //     Ammo.destroy(rayFrom);
        //     Ammo.destroy(rayTo);
        //     Ammo.destroy(rayCallback);
        // },

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
        }
    });

    return {
        Body3dComponentSystem: Body3dComponentSystem
    };
}());