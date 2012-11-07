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
         * @name pc.fw.CollisionRectComponent
         * @constructor Create a new CollisionRectComponent
         * @class 
         * @extends pc.fw.Component
         */
        var CollisionRectComponent = function CollisionRectComponent () {
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
            }
        });

        return {
            CollisionRectComponent: CollisionRectComponent
        };
    }());
}