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
         * @constructor Create a new CollisionRectComponent
         * @class 
         * @extends pc.fw.Component
         */
        var CollisionRectComponent = function CollisionRectComponent () {
            var schema = [{
                name: "density",
                displayName: "Density",
                description: "The density of the body, this determine the mass",
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
                name: "x",
                displayName: "Size: X",
                description: "The size of the Rect in the x-axis",
                type: "number",
                options: {
                    min: 0,
                    step: 0.1,
                },
                defaultValue: 0.5
            }, {
                name: "y",
                displayName: "Size: Y",
                description: "The size of the Rect in the y-axis",
                type: "number",
                options: {
                    min: 0,
                    step: 0.1,
                },
                defaultValue: 0.5
            }];

            this.assignSchema(schema);

            // Indexes for converting between 2D and 3D co-ords
            this.xi = 0; // 3D index that corresponds to 2D x-axis
            this.yi = 2; // 3D index that corresponds to 2D y-axis
            this.ri = 1; // 3D index that corresponds to the rotation axis

            this.bind('set_density', this.onSetDensity.bind(this));
            this.bind('set_friction', this.onSetFriction.bind(this));
            this.bind('set_restitution', this.onSetRestitution.bind(this));
            this.bind('set_x', this.onSetX.bind(this));
            this.bind('set_y', this.onSetY.bind(this));
        };
        CollisionRectComponent = pc.inherits(CollisionRectComponent, pc.fw.Component);
        
        pc.extend(CollisionRectComponent.prototype, {

            onSetDensity: function (name, oldValue, newValue) {
                if (!this.entity.body2d) {
                    return;
                }

                if (this.entity.body2d.body) {
                    var fixture = this.entity.body2d.body.GetFixtureList();
                    fixture.SetDensity(newValue);
                    this.entity.body2d.body.ResetMassData();
                }
            },

            onSetFriction: function (name, oldValue, newValue) {
                if (!this.entity.body2d) {
                    return;
                }

                if (this.entity.body2d.body) {
                    var fixture = this.entity.body2d.body.GetFixtureList();
                    fixture.SetFriction(newValue);
                    this.entity.body2d.body.ResetMassData();
                }
            },

            onSetRestitution: function (name, oldValue, newValue) {
                if (!this.entity.body2d) {
                    return;
                }

                if (this.entity.body2d.body) {
                    var fixture = this.entity.body2d.body.GetFixtureList();
                    fixture.SetRestitution(newValue);
                    this.entity.body2d.body.ResetMassData();
                }
            },

            onSetX: function (name, oldValue, newValue) {
                if (!this.entity.body2d) {
                    return;
                }

                var body = this.entity.body2d.body;
                if (body) {
                    var fixture = body.GetFixtureList();
                    var shape = fixture.GetShape();
                    
                    shape.SetAsBox(newValue, this.y);

                    body.SetAwake(true);
                }
            },

            onSetY: function (name, oldValue, newValue) {
                if (!this.entity.body2d) {
                    return;
                }
                
                var body = this.entity.body2d.body;

                if (body) {
                    var fixture = body.GetFixtureList();
                    var shape = fixture.GetShape();
                    
                    shape.SetAsBox(this.x, newValue);

                    body.SetAwake(true);
                }
            },

            // TODO: Perhaps pass the name of the variable into the set_* events?
            // onSetFixtureValue: function (oldValue, newValue) {
            //     if (!this.entity.body2d) {
            //         return;
            //     }

            //     var body = this.entity.body2d.body;
            //     if (body) {
            //         // We only support a single fixture at the moment
            //         var fixture = body.GetFixtureList();
            //         var accessors = {
            //             density: fixture.SetDensity,
            //             friction: fixture.SetFriction,
            //             restitution: fixture.SetRestitution
            //         };
            //         accessors[name].call(fixture, newValue);
            //         // Update the body with changes
            //         body.ResetMassData();
            //     }
            // },

            // onSetShapeValue: function (oldValue, newValue) {
            //     if (!this.entity.body2d) {
            //         return;
            //     }
                
            //     var body = this.entity.body2d.body;
            //     if (body) {
            //         // We only support a single fixture at the moment
            //         var fixture = body.GetFixtureList();
            //         var shape = fixture.GetShape();
                    
            //         var b = {
            //             x: this.x,
            //             y: this.y
            //         };

            //         b[name] = newValue;
                    
            //         shape.SetAsBox(b.x, b.y);

            //         body.SetAwake(true);
            //     }
            // }
        });

        return {
            CollisionRectComponent: CollisionRectComponent
        };
    }());
}