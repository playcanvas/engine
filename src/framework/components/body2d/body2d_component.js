pc.extend(pc.fw, function () {
    // Shared math variable to avoid excessive allocation
    var transform = pc.math.mat4.create();
    var newWtm = pc.math.mat4.create();

    var position = pc.math.vec3.create();
    var rotation = pc.math.vec3.create();
    var scale = pc.math.vec3.create();

    // Unpack common Box2D code
    var b2World, b2Vec2, b2Body, b2BodyDef, b2FixtureDef, b2PolygonShape, b2CircleShape;
    function unpack() {
        var b2World = Box2D.Dynamics.b2World;
        var b2Vec2 = Box2D.Common.Math.b2Vec2;
        var b2Body = Box2D.Dynamics.b2Body;
        var b2BodyDef = Box2D.Dynamics.b2BodyDef;
        var b2FixtureDef = Box2D.Dynamics.b2FixtureDef;
        var b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape;
        var b2CircleShape = Box2D.Collision.Shapes.b2CircleShape;
    }

    /**
     * @private
     * @name pc.fw.Body2dComponent
     * @constructor Create a new Body2dComponent
     * @class 
     * @param {pc.fw.ComponentSystem} system
     * @param {pc.fw.Entity} entity
     * @extends pc.fw.Component
     */
    var Body2dComponent = function Body2dComponent (system, entity) {
        if (typeof(Box2D) !== 'undefined' && !b2World) {
            // Lazily unpack common Box2D variables into closure
            unpack();
        }

        this.on('set_static', this.onSetStatic, this);

        entity.on('livelink:updatetransform', this.onLiveLinkUpdateTransform, this);
    };
    Body2dComponent = pc.inherits(Body2dComponent, pc.fw.Component);

    pc.extend(Body2dComponent.prototype, {
        /**
        * @private
        * @name pc.fw.Body2dComponentSystem#applyForce
        * @description Apply an force to the body
        * @param {pc.math.vec3} force The force to apply. A 3D world space vector, extra component is ignored
        * @param {pc.math.vec3} point The point at which to apply the force. A 3D world space vector, extra component is ignored
        */
        applyForce: function (force, point) {
            var body = this.entity.body2d.body;
            if (body) {
                if (!point) {
                    point = position;
                    point[this.system.xi] = body.GetPosition().x;
                    point[this.system.yi] = body.GetPosition().y;
                }
                body.ApplyForce({
                    x: force[this.system.xi],
                    y: force[this.system.yi]
                }, {
                    x: point[this.system.xi],
                    y: point[this.system.yi]
                });
            }
        },

        /**
        * @private
        * @name pc.fw.Body2dComponentSystem#applyImpulse
        * @description Apply an impulse (instantaneous change of velocity) to the body
        * @param {pc.math.vec3} impulse The impulse to apply. A 3D world space vector, extra component is ignored
        * @param {pc.math.vec3} point The point at which to apply the impulse. A 3D world space vector, extra component is ignored
        */
        applyImpulse: function (impulse, point) {
            var body = this.entity.body2d.body; 
            if (body) {
                if (!point) {
                    point = position;
                    point[this.system.xi] = body.GetPosition().x;
                    point[this.system.yi] = body.GetPosition().y;
                }

                body.ApplyImpulse({
                    x: impulse[this.system.xi],
                    y: impulse[this.system.yi]
                }, {
                    x: point[this.system.xi],
                    y: point[this.system.yi]
                });
            }
        },

        /**
        * @private
        * @name pc.fw.Body2dComponentSystem#setLinearVelocity
        * @description Set the linear velocity of the body
        * @param {Number} x The x value of the velocity
        * @param {Number} y The y value of the velocity
        */
        setLinearVelocity: function (x, y) {
            var body = this.entity.body2d.body;
            if (body) {
                var vel = body.GetLinearVelocity();
                vel.x = x;
                vel.y = y;
                body.SetLinearVelocity(vel);
            }
        },

        /**
        * @private
        * @name pc.fw.Body2dComponentSystem#setAngularVelocity
        * @description Set the angular  velocity of the body
        * @param {Number} a The a value of the angular velocity
        */
        setAngularVelocity: function (a) {
            var body = this.entity.body2d.body;
            if (body) {
                body.SetAngularVelocity(a);
            }
        },

        setTransform: function (transform) {
            pc.math.mat4.getTranslation(transform, position);
            pc.math.mat4.toEulerXYZ(transform, rotation);

            var angle = this._eulersToAngle(rotation);

            this.setPositionAndAngle(position[this.system.xi], position[this.system.yi], -angle);
        },

        /**
        * @private
        * @name pc.fw.Body2dComponentSystem#setPosition
        * @description Set the position of the body
        * @param {Number} x The x value of the position
        * @param {Number} y The y value of the position
        */
        setPosition: function (x, y) {
            var body = this.entity.body2d.body;
            if (body) {
                body.SetAwake(true);
                var pos = body.GetPosition();
                pos.x = x;
                pos.y = y;
                body.SetPosition(pos);

                this.updateTransform(body);
            }
        },

        /**
        * @private
        * @name pc.fw.Body2dComponentSystem#setAngle
        * @description Set the angle of the body
        * @param {Number} a The new angle, in degrees
        */
        setAngle: function (a) {
            var body = this.entity.body2d.body;
            if(body) {
                body.SetAwake(true);
                body.SetAngle(a * pc.math.DEG_TO_RAD);

                this.updateTransform(body);
            }
        },

        /**
        * angle in degrees
        */
        setPositionAndAngle: function (x, y, a) {
            var body = this.entity.body2d.body;
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
            return this.entity.body2d.body.GetAngle() * pc.math.RAD_TO_DEG;
        },

        /**
        * @private
        * @name pc.fw.Body2dComponentSystem#setLinearDamping
        * @description Set the linear damping value of the body. 
        * Damping parameters should be between 0 and infinity, with 0 meaning no damping, and infinity 
        * meaning full damping. Normally you will use a damping value between 0 and 0.1
        * @param {Number} damping The damping value
        */
        setLinearDamping: function (entity, damping) {
            var body = this.entity.body2d.body;
            if(body) {
                body.SetLinearDamping(damping);
            }
        },

        updateTransform: function (body) {
            var entityPos = this.entity.getPosition();
            var angles = this.entity.getLocalEulerAngles();

            var position2d = body.GetPosition();

            position[this.system.xi] = position2d.x;
            position[this.system.ri] = entityPos[1];
            position[this.system.yi] = position2d.y;

            rotation[this.system.xi] = 0;
            rotation[this.system.ri] = -body.GetAngle() * pc.math.RAD_TO_DEG;
            rotation[this.system.yi] = 0;

            this.entity.setPosition(position);
            this.entity.setEulerAngles(rotation);
        },

        onSetStatic: function (name, oldValue, newValue) {
            var body = this.entity.body2d.body;
            if (body) {
                if (newValue) {
                    body.SetType(b2Body.b2_staticBody);
                } else {
                    body.SetType(b2Body.b2_dynamicBody);
                }
            }
        },

        onLiveLinkUpdateTransform: function (position, rotation, scale) {
            this.setTransform(this.entity.getWorldTransform());
            this.setLinearVelocity(0,0);
            this.setAngularVelocity(0);
        },

        _eulersToAngle: function (rotation) {
            var angle = rotation[this.system.ri];
            if (rotation[this.system.xi] > 179.9 && rotation[this.system.yi] > 179.9) {
                angle = 180 - rotation[this.system.ri];
            }

            return angle;
        }
    });

    return {
        Body2dComponent: Body2dComponent
    };
}());