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


        // Shared math variable to avoid excessive allocation
        var transform = pc.math.mat4.create();
        var newWtm = pc.math.mat4.create();

        var position = pc.math.vec3.create();
        var rotation = pc.math.vec3.create();
        var scale = pc.math.vec3.create();

        var pos2d = new b2Vec2();

        /**
         * @private
         * @name pc.fw.Body2dComponent
         * @constructor Create a new Body2dComponent
         * @class 
         * @param {Object} context
         * @extends pc.fw.Component
         */
        var Body2dComponent = function Body2dComponent (context) {
            // Indexes for converting between 2D and 3D co-ords
            this.xi = 0; // 3D index that corresponds to 2D x-axis
            this.yi = 2; // 3D index that corresponds to 2D y-axis
            this.ri = 1; // 3D index that corresponds to the rotation axis

            this.bind('set_static', this.onSetStatic.bind(this));
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

                this.setPositionAndAngle(position[this.xi], position[this.yi], -rotation[this.ri]);
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
                var position2d = body.GetPosition();

                position[this.xi] = position2d.x;
                position[this.ri] = entityPos[1];
                position[this.yi] = position2d.y;

                rotation[this.xi] = 0;
                rotation[this.ri] = -body.GetAngle() * pc.math.RAD_TO_DEG;
                rotation[this.yi] = 0;

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

        });
        
        return {
            Body2dComponent: Body2dComponent
        };
    }());
}