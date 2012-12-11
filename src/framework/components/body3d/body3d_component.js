pc.extend(pc.fw, function () {
    // Shared math variable to avoid excessive allocation
    var quat = pc.math.quat.create();
    var ammoTransform;

    /**
     * @private
     * @name pc.fw.Body3dComponent
     * @constructor Create a new Body3dComponent
     * @class 
     * @param {Object} context
     * @extends pc.fw.Component
     */
    var Body3dComponent = function Body3dComponent (context) {
        // Lazily create shared variable
        if (typeof(Ammo) !== 'undefined' && !ammoTransform) {
            ammoTransform = new Ammo.btTransform();    
        }

        this.bind('set_mass', this.onSetMass.bind(this));
        this.bind('set_friction', this.onSetFriction.bind(this));
        this.bind('set_restitution', this.onSetRestitution.bind(this));
        this.bind('set_static', this.onSetStatic.bind(this));
    };
    Body3dComponent = pc.inherits(Body3dComponent, pc.fw.Component);

    pc.extend(Body3dComponent.prototype, {
        /**
        * @private
        * @name pc.fw.Body3dComponent#applyForce
        * @description Apply an force to the body
        * @param {pc.math.vec3} force The force to apply. A 3D world space vector, extra component is ignored
        * @param {pc.math.vec3} point The point at which to apply the force. A 3D world space vector, extra component is ignored
        */
        applyForce: function (force, point) {
            var body = this.entity.body3d.body;
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
        * @private
        * @name pc.fw.Body3dComponent#applyImpulse
        * @description Apply an impulse (instantaneous change of velocity) to the body
        * @param {pc.math.vec3} impulse The impulse to apply. A 3D world space vector, extra component is ignored
        * @param {pc.math.vec3} point The point at which to apply the impulse. A 3D world space vector, extra component is ignored
        */
        applyImpulse: function (impulse, point) {
            var body = this.entity.body3d.body; 
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
        * @private
        * @name pc.fw.Body3dComponentSystem#setLinearVelocity
        * @description Set the linear velocity of the body
        * @param {Number} x The x value of the velocity
        * @param {Number} y The y value of the velocity
        * @param {Number} y The z value of the velocity
        */
        setLinearVelocity: function (x, y, z) {
            var body = this.entity.body3d.body;
            if (body) {
                body.setLinearVelocity(new Ammo.btVector3(x, y, z));
            }
        },

        /**
        * @private
        * @name pc.fw.Body3dComponent#setAngularVelocity
        * @description Set the angular  velocity of the body
        * @param {Number} x The x value of the angular velocity
        * @param {Number} y The y value of the angular velocity
        * @param {Number} z The z value of the angular velocity
        */
        setAngularVelocity: function (x, y, z) {
            var body = this.entity.body3d.body;
            if (body) {
                body.setAngularVelocity(new Ammo.btVector3(x, y, z));
            }
        },

        setTransform: function (transform) {
            var body = this.entity.body3d.body;
            if (body) {
                var position = pc.math.mat4.getTranslation(transform);
                var rotation = pc.math.mat4.toQuat(transform);

                var transform = body.getWorldTransform();
                transform.setOrigin(new Ammo.btVector3(position[0], position[1], position[2]));
                transform.setRotation(new Ammo.btQuaternion(rotation[0], rotation[1], rotation[2], rotation[3]));
                body.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
                body.setAngularVelocity(new Ammo.btVector3(0, 0, 0));
                body.activate();
            }
        },

        createBody: function () {
            var entity = this.entity;
            var shape;

            if (entity.collisionbox) {
                shape = entity.collisionbox.shape;
            }
            else if (entity.collisionsphere) {
                shape = entity.collisionsphere.shape;
            }

            if (shape) {
                if (entity.body3d.body) {
                    this.system.removeBody(entity.body3d.body);
                }

                var isStatic = entity.body3d.static;
                var mass = isStatic ? 0 : entity.body3d.mass;

                var localInertia = new Ammo.btVector3(0, 0, 0);
                if (!isStatic) {
                    shape.calculateLocalInertia(mass, localInertia);
                }

                var pos = entity.getPosition();
                var rot = entity.getRotation();

                var startTransform = new Ammo.btTransform();
                startTransform.setIdentity();
                startTransform.setOrigin(new Ammo.btVector3(pos[0], pos[1], pos[2]));
                startTransform.setRotation(new Ammo.btQuaternion(rot[0], rot[1], rot[2], rot[3]));

                var motionState = new Ammo.btDefaultMotionState(startTransform);
                var bodyInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);

                var body = new Ammo.btRigidBody(bodyInfo);
                body.setRestitution(isStatic ? 1 : entity.body3d.restitution);
                body.setFriction(entity.body3d.friction);

                this.system.addBody(body);

                entity.body3d.body = body;
                entity.body3d.body.activate();
            }
        },

        /**
        * @private
        * @name pc.fw.Body3dComponent#setPosition
        * @description Set the position of the body
        * @param {Number} x The x value of the position
        * @param {Number} y The y value of the position
        * @param {Number} z The z value of the position
        */
        setPosition: function (x, y, z) {
            var body = this.entity.body3d.body;
            if (body) {
                var transform = body.getWorldTransform();
                transform.setOrigin(new Ammo.btVector3(x, y, z));

                body.activate();

                this.entity.setPosition(x, y, z);
            }
        },

        /**
        * @private
        * @name pc.fw.Body3dComponent#setAngle
        * @description Set the angle of the body
        * @param {Number} a The new angle, in degrees
        */
        setRotation: function (x, y, z) {
            var body = this.entity.body3d.body;
            if (body) {
                pc.math.quat.setFromEulers(quat, x, y, z);

                var transform = body.getWorldTransform();
                transform.setRotation(new Ammo.btQuaternion(quat[0], quat[1], quat[2], quat[3]));

                body.activate();

                this.entity.setEulerAngles(x, y, z);
            }
        },

        /**
        * angle in degrees
        */
        setPositionAndAngle: function (x, y, a) {
            var body = this.entity.body3d.body;
            if (body) {
                body.SetAwake(true);
                var pos = body.GetPosition();
                pos.x = x;
                pos.y = y;

                body.SetPositionAndAngle(pos, a * pc.math.DEG_TO_RAD);

                this.updateTransform(body);
            }
        },

        /**
        * Return angle in degrees
        */
        getAngle: function () {
            return this.entity.body3d.body.GetAngle() * pc.math.RAD_TO_DEG;
        },

        /**
        * @private
        * @name pc.fw.Body3dComponent#setLinearDamping
        * @description Set the linear damping value of the body. 
        * Damping parameters should be between 0 and infinity, with 0 meaning no damping, and infinity 
        * meaning full damping. Normally you will use a damping value between 0 and 0.1
        * @param {Number} damping The damping value
        */
        setLinearDamping: function (entity, damping) {
            var body = this.entity.body3d.body;
            if(body) {
                body.SetLinearDamping(damping);
            }
        },

        updateTransform: function (body) {
            if (body.isActive() && body.getMotionState()) {
                body.getMotionState().getWorldTransform(ammoTransform);

                var p = ammoTransform.getOrigin();
                var q = ammoTransform.getRotation();
                this.entity.setPosition(p.x(), p.y(), p.z());
                quat[0] = q.x();
                quat[1] = q.y();
                quat[2] = q.z();
                quat[3] = q.w();
                this.entity.setRotation(quat);
            }
        },

        onSetMass: function (name, oldValue, newValue) {
            var body = this.data.body;
            if (body) {
                this.system.removeBody(body);

                var mass = newValue;
                var localInertia = new Ammo.btVector3(0, 0, 0);
                body.getCollisionShape().calculateLocalInertia(mass, localInertia);
                body.setMassProps(mass, localInertia);
                body.updateInertiaTensor();

                this.system.addBody(body);
            }                
        },

        onSetFriction: function (name, oldValue, newValue) {
            var body = this.data.body;
            if (body) {
                body.setFriction(newValue);
            }                
        },

        onSetRestitution: function (name, oldValue, newValue) {
            var body = this.data.body;
            if (body) {
                if (this.data.static) {
                    body.setRestitution(1);
                } else {
                    body.setRestitution(newValue);
                }
            }                
        },

        onSetStatic: function (name, oldValue, newValue) {
            var body = this.data.body;
            if (body) {
            }
        }
    });

    return {
        Body3dComponent: Body3dComponent
    };
}());