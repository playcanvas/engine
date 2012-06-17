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

        var position = pc.math.vec3.create();
        var rotation = pc.math.vec3.create();
        var scale = pc.math.vec3.create();

        var pos2d = new b2Vec2();
        /**
         * @private
         * @name pc.fw.Body2dComponentSystem
         * @constructor Create a new Body2dComponentSystem
         * @class 
         * @param {Object} context
         * @extends pc.fw.ComponentSystem
         */
        var Body2dComponentSystem = function Body2dComponentSystem (context) {
            context.systems.add("body2d", this);

            this.context = context;
            
            this.debugRender = false;

            this.time = 0;
            this.step = 1/60;

            // Indexes for converting between 2D and 3D co-ords
            this.xi = 0; // 3D index that corresponds to 2D x-axis
            this.yi = 2; // 3D index that corresponds to 2D y-axis
            this.ri = 1; // 3D index that corresponds to the rotation axis

            // Create the Box2D physics world
            this.b2World = new b2World(new b2Vec2(0,0), true);
            this.bind('set_static', this.onSetStatic.bind(this));
        };
        Body2dComponentSystem = pc.inherits(Body2dComponentSystem, pc.fw.ComponentSystem);
        
        Body2dComponentSystem.prototype = pc.extend(Body2dComponentSystem.prototype, {

            createComponent: function (entity, data) {
                var componentData = new pc.fw.Body2dComponentData();

                var attribs = ['static'];
                this.initialiseComponent(entity, componentData, data, attribs);

                // Create a static body at the current position
                var bodyDef = new b2BodyDef();
                this.initBodyDef(entity, bodyDef, componentData);

                // componentData.fixtureDef = fixtureDef;
                componentData['bodyDef'] = bodyDef;

                var collisionRect = this.context.systems.collisionrect.getComponentData(entity);
                if (collisionRect) {
                    this.addCollision(entity, collisionRect);
                }
                else {
                    var collisioncircle = this.context.systems.collisioncircle.getComponentData(entity);
                    if (collisioncircle) {
                        this.addCollision(entity, collisioncircle);
                    }
                }

                return componentData;
            },

            initBodyDef: function (entity, bodyDef, componentData) {
                entity.syncHierarchy();
                entity.getWorldPosition(position);
                pc.math.mat4.toEulerXYZ(entity.getWorldTransform(), rotation);

                bodyDef.type = componentData['static'] ? b2Body.b2_staticBody : b2Body.b2_dynamicBody;
                bodyDef.position.Set(position[this.xi], position[this.yi]);
                bodyDef.angle = -rotation[this.ri];
                bodyDef.userData = entity;
            },

            /*
            * Convert a pc.math.vec3 into a b2Vec2
            */
            to2d: function (vec3, vec2) {
                vec2 = vec2 || new b2Vec2();
                return vec2.Set(vec3[this.xi], vec3[this.yi]);
            },

            deleteComponent: function (entity) {
                this.removeComponent(entity);
            },

            addCollision: function (entity, collision) {
                // Create body from fixturedef and bodydef
                var bodyDef = this.get(entity, 'bodyDef');
                this.set(entity, 'body', this.addBody(bodyDef, collision.fixtureDef));
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
            * @private
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

                this.b2World.RayCast(callback, s, e);
            },

            /**
            * @private
            * @name pc.fw.Body2dComponentSystem#raycastFirst
            * @description Raycast into the world (in 2D) and return the first Entity hit
            * @param {pc.math.vec3} start The ray start position
            * @param {pc.math.vec3} end The ray end position
            * @returns {pc.fw.Entity} The first Entity with a 2D collision shape hit by the ray.
            */
            raycastFirst: function (start, end) {
                var e;
                this.raycast(function (fixture, point, normal, fraction) {
                    e = fixture.GetUserData();
                    return fraction;
                }, start, end);

                return e;
            },

            /**
            * @private
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
            * @private
            * @name pc.fw.Body2dComponentSystem#setAngularVelocity
            * @description Set the angular  velocity of the body
            * @param {pc.fw.Entity} entity The Entity to change
            * @param {Number} a The a value of the angular velocity
            */
            setAngularVelocity: function (entity, a) {
                var body = this.get(entity, 'body');
                if (body) {
                    body.SetAngularVelocity(a);
                }
            },

            /**
            * @private
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
            * @private
            * @name pc.fw.Body2dComponentSystem#setAngle
            * @description Set the angle of the body
            * @param {pc.fw.Entity} entity The Entity to change
            * @param {Number} a The new angle
            */
            setAngle: function (entity, a) {
                var body = this.get(entity, 'body');
                if(body) {
                    body.SetAngle(a);    
                }
            },

            /**
            * @private
            * @name pc.fw.Body2dComponentSystem#setLinearDamping
            * @description Set the linear damping value of the body. 
            * Damping parameters should be between 0 and infinity, with 0 meaning no damping, and infinity 
            * meaning full damping. Normally you will use a damping value between 0 and 0.1
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

                var setWorldTransform = function (e, w) {
                    var p = e.getParent();
                    var pw = p.getWorldTransform();
                    pc.math.mat4.invert(pw, transform);
                    pc.math.mat4.multiply(transform, w, e.getLocalTransform());
                };

                for (id in components) {
                    if (components.hasOwnProperty(id)) {
                        entity = components[id].entity;
                        componentData = components[id].component;
                        if (componentData.body) {
                            var wtm = entity.getWorldTransform();
                            var position2d = componentData.body.GetPosition();

                            position[this.xi] = position2d.x;
                            position[this.ri] = wtm[13];
                            position[this.yi] = position2d.y;

                            rotation[this.xi] = 0;
                            rotation[this.ri] = -componentData.body.GetAngle();
                            rotation[this.zi] = 0;

                            var m = pc.math.mat4.create();
                            //var ltm = entity.getLocalTransform();
                            pc.math.mat4.getScale(wtm, scale);
                            pc.math.mat4.compose(position, rotation, scale, m);
                            setWorldTransform(entity, m);
                        }
                    }
                }

                this.time += dt;

                while (this.time > this.step) {
                    this.b2World.Step(this.step, velocityIterations, positionIterations);
                    this.time -= this.step;
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

        });

        return {
            Body2dComponentSystem: Body2dComponentSystem
        };
    }());
}