pc.extend(pc.fw, function () {
    // Shared math variable to avoid excessive allocation
    var transform = pc.math.mat4.create();
    var newWtm = pc.math.mat4.create();

    var position = pc.math.vec3.create();
    var rotation = pc.math.vec3.create();
    var scale = pc.math.vec3.create();

    var ammoRayStart, ammoRayEnd;

    /**
    * @name pc.fw.RaycastResult
    * @class Object holding the result of a successful raycast hit
    * @constructor Create a new RaycastResult
    * @property {pc.fw.Entity} entity The entity that was hit
    * @property {pc.math.vec3} point The point at which the ray hit the entity in world space
    * @property {pc.math.vec3} normal The normal vector of the surface where the ray hit in world space.
    */
    var RaycastResult = function (entity, point, normal) {
        this.entity = entity;
        this.point = point;
        this.normal = normal;
    };

    /**
    * @name pc.fw.ContactResult
    * @class Object holding the result of a contact between two rigid bodies
    * @constructor Create a new ContactResult
    * @property {pc.fw.Entity} a The first entity involved in the contact
    * @property {pc.fw.Entity} b The second entity involved in the contact
    * @property {pc.math.vec3} localPointA The point on Entity A where the contact occured, relative to A
    * @property {pc.math.vec3} localPointB The point on Entity B where the contact occured, relative to B
    * @property {pc.math.vec3} pointA The point on Entity A where the contact occured, in world space
    * @property {pc.math.vec3} pointB The point on Entity B where the contact occured, in world space
    * @property {pc.math.vec3} normal The normal vector of the contact on Entity B, in world space
    */
    var ContactResult = function (a, b, contactPoint) {
        this.a = a;
        this.b = b;
        this.localPointA = new pc.math.vec3.create(contactPoint.get_m_localPointA().x(), contactPoint.get_m_localPointA().y(), contactPoint.get_m_localPointA().z());
        this.localPointB = new pc.math.vec3.create(contactPoint.get_m_localPointB().x(), contactPoint.get_m_localPointB().y(), contactPoint.get_m_localPointB().z());
        this.pointA = new pc.math.vec3.create(contactPoint.getPositionWorldOnA().x(), contactPoint.getPositionWorldOnA().y(), contactPoint.getPositionWorldOnA().z());
        this.pointB = new pc.math.vec3.create(contactPoint.getPositionWorldOnB().x(), contactPoint.getPositionWorldOnB().y(), contactPoint.getPositionWorldOnB().z());
        this.normal = new pc.math.vec3.create(contactPoint.get_m_normalWorldOnB().x(), contactPoint.get_m_normalWorldOnB().y(), contactPoint.get_m_normalWorldOnB().z());
    };

    // Events Documentation   
    /**
    * @event
    * @name pc.fw.RigidBodyComponentSystem#contact
    * @description Fired when a contact occurs between two rigid bodies
    * @param {pc.fw.ContactResult} result Details of the contact between the two bodies
    */

    /**
     * @name pc.fw.RigidBodyComponentSystem
     * @constructor Create a new RigidBodyComponentSystem
     * @class The RigidBodyComponentSystem maintains the dynamics world for simulating rigid bodies, it also controls global values for the world such as gravity.
     * Note: The RigidBodyComponentSystem is only valid if 3D Physics is enabled in your application. You can enable this in the application settings for your Depot.
     * @param {pc.fw.ApplicationContext} context The ApplicationContext
     * @extends pc.fw.ComponentSystem
     */
    var RigidBodyComponentSystem = function RigidBodyComponentSystem (context) {
        this.id = 'rigidbody';
        context.systems.add(this.id, this);
        
        this.ComponentType = pc.fw.RigidBodyComponent;
        this.DataType = pc.fw.RigidBodyComponentData;

        this.schema = [{
            name: "mass",
            displayName: "Mass",
            description: "The mass of the body",
            type: "number",
            options: {
                min: 0,
                step: 1
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
            name: "bodyType",
            displayName: "Body Type",
            description: "The type of body determines how it moves and collides with other bodies. Dynamic is a normal body. Static will never move. Kinematic can be moved in code, but will not respond to collisions.",
            type: "enumeration",
            options: {
                enumerations: [{
                    name: 'Static',
                    value: pc.fw.RIGIDBODY_TYPE_STATIC
                }, {
                    name: 'Dynamic',
                    value: pc.fw.RIGIDBODY_TYPE_DYNAMIC
                }, {
                    name: 'Kinematic',
                    value: pc.fw.RIGIDBODY_TYPE_KINEMATIC
                }]
            },
            defaultValue: pc.fw.RIGIDBODY_TYPE_STATIC
        }, {
            name: "body",
            exposed: false
        }];

        this.exposeProperties();

        this.maxSubSteps = 10;
        this.fixedTimeStep = 1/60;
        
        // Create the Ammo physics world
        if (typeof(Ammo) !== 'undefined') {
            var collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
            var dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
            var overlappingPairCache = new Ammo.btDbvtBroadphase();
            var solver = new Ammo.btSequentialImpulseConstraintSolver();
            this.dynamicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, overlappingPairCache, solver, collisionConfiguration);

            this._ammoGravity = new Ammo.btVector3(0, -9.82, 0);
            this.dynamicsWorld.setGravity(this._ammoGravity);
            
            // Only bind 'update' if Ammo is loaded
            pc.fw.ComponentSystem.on('update', this.onUpdate, this);

            // Lazily create temp vars
            ammoRayStart = new Ammo.btVector3();
            ammoRayEnd = new Ammo.btVector3();
        }

        this.on('remove', this.onRemove, this);

        
    };
    RigidBodyComponentSystem = pc.inherits(RigidBodyComponentSystem, pc.fw.ComponentSystem);
    
    pc.extend(RigidBodyComponentSystem.prototype, {

        initializeComponentData: function (component, data, properties) {
            properties = ['friction', 'mass', 'restitution', 'bodyType'];
            RigidBodyComponentSystem._super.initializeComponentData.call(this, component, data, properties);

            component.createBody();
        },

        onRemove: function (entity, data) {
            if (data.body) {
                this.removeBody(data.body);    
                Ammo.destroy(data.body);
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

        addConstraint: function (constraint) {
            this.dynamicsWorld.addConstraint(constraint);
            return constraint;
        },

        removeConstraint: function (constraint) {
            this.dynamicsWorld.removeConstraint(constraint);
        },

        /**
        * @function
        * @name pc.fw.RigidBodyComponentSystem#setGravity
        * @description Set the gravity vector for the 3D physics world
        * @param {Number} x The x-component of the gravity vector
        * @param {Number} y The y-component of the gravity vector
        * @param {Number} z The z-component of the gravity vector
        */
        setGravity: function (x, y, z) {
            this._ammoGravity.setValue(x, y, z);
            this.dynamicsWorld.setGravity(this._ammoGravity);
        },

        /**
        * @function
        * @name pc.fw.RigidBodyComponentSystem#raycastFirst
        * @description Raycast the world and return the first entity the ray hits. Fire a ray into the world from start to end, 
        * if the ray hits an entity with a rigidbody component, the callback function is called along with a {@link pc.fw.RaycastResult}.
        * @param {pc.math.vec3} start The world space point where the ray starts
        * @param {pc.math.vec3} end The world space point where the ray ends
        * @param {Function} callback Function called if ray hits another body. Passed a single argument: a {@link pc.fw.RaycastResult} object
        */
        raycastFirst: function (start, end, callback) {
            ammoRayStart.setValue(start[0], start[1], start[2]);
            ammoRayEnd.setValue(end[0], end[1], end[2]);
            var rayCallback = new Ammo.ClosestRayResultCallback(ammoRayStart, ammoRayEnd);

            this.dynamicsWorld.rayTest(ammoRayStart, ammoRayEnd, rayCallback);
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

            Ammo.destroy(rayCallback);
        },


        /**
        * @private
        * @name pc.fw.RigidBodyComponentSystem#raycast
        * @description Raycast the world and return all entities the ray hits. Fire a ray into the world from start to end, 
        * if the ray hits an entity with a rigidbody component, the callback function is called along with a {@link pc.fw.RaycastResult}.
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
            for (var id in components) {
                if (components.hasOwnProperty(id)) {
                    var entity = components[id].entity;
                    var componentData = components[id].data;
                    if (componentData.body && componentData.body.isActive()) {
                        if (componentData.bodyType === pc.fw.RIGIDBODY_TYPE_DYNAMIC) {
                            entity.rigidbody.syncBodyToEntity();
                        } else if (componentData.bodyType === pc.fw.RIGIDBODY_TYPE_KINEMATIC) {
                            entity.rigidbody.updateKinematic(dt);
                        }
                    }

                }
            }

            // Check for collisions and fire callbacks
            if (this.hasEvent('contact')) {
                var dispatcher = this.dynamicsWorld.getDispatcher();
                var manifold;
                var e0, e1; // Entities in collision
                var contactPoint;
                var numManifolds = dispatcher.getNumManifolds();
                var numContacts;
                var i, j;
                for (i = 0; i < numManifolds; i++) {
                    manifold = dispatcher.getManifoldByIndexInternal(i);
                    e0 = Ammo.wrapPointer(manifold.getBody0(), Ammo.btRigidBody).entity;
                    e1 = Ammo.wrapPointer(manifold.getBody1(), Ammo.btRigidBody).entity;

                    numContacts = manifold.getNumContacts();
                    for (j = 0; j < numContacts; j++) {
                        contactPoint = manifold.getContactPoint(j);
                        this.fire('contact', new ContactResult(e0, e1, contactPoint));
                    }
                }                
            }
        }
    });

    return {
        /** 
        * @enum pc.fw.RIGIDBODY_TYPE
        * @name pc.fw.RIGIDBODY_TYPE_STATIC
        * @description Static rigid bodies have infinite mass and can never move. You cannot apply forces or impulses to them or set their velocity.
        */
        RIGIDBODY_TYPE_STATIC: 'static',
        /** 
        * @enum pc.fw.RIGIDBODY_TYPE
        * @name pc.fw.RIGIDBODY_TYPE_DYNAMIC
        * @description Dynamic rigid bodies are simulated according to the forces acted on them. They have a positive, non-zero mass.
        */
        RIGIDBODY_TYPE_DYNAMIC: 'dynamic',
        /** 
        * @enum pc.fw.RIGIDBODY_TYPE
        * @name pc.fw.RIGIDBODY_TYPE_KINEMATIC
        * @description Kinematic rigid bodies are objects with infinite mass but can be moved by directly setting their velocity. You cannot apply forces or impulses to them.
        */
        RIGIDBODY_TYPE_KINEMATIC: 'kinematic',

        // Collision flags from AmmoJS
        RIGIDBODY_CF_STATIC_OBJECT: 1,
        RIGIDBODY_CF_KINEMATIC_OBJECT: 2,

        // Activation states from AmmoJS
        RIGIDBODY_ACTIVE_TAG: 1,
        RIGIDBODY_ISLAND_SLEEPING: 2,
        RIGIDBODY_WANTS_DEACTIVATION: 3,
        RIGIDBODY_DISABLE_DEACTIVATION: 4,
        RIGIDBODY_DISABLE_SIMULATION: 5,

        RigidBodyComponentSystem: RigidBodyComponentSystem
    };
}());