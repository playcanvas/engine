pc.extend(pc.fw, function () {
    /**
     * @private
     * @name pc.fw.CollisionCircleComponent
     * @constructor Create a new CollisionCircleComponent
     * @class 
     * @param {Object} context
     * @extends pc.fw.Component
     */
    var CollisionCircleComponent = function CollisionCircleComponent () {
        // Indexes for converting between 2D and 3D co-ords
        this.xi = 0; // 3D index that corresponds to 2D x-axis
        this.yi = 2; // 3D index that corresponds to 2D y-axis
        this.ri = 1; // 3D index that corresponds to the rotation axis

        this.bind('set_density', this.onSetDensity.bind(this));
        this.bind('set_friction', this.onSetFriction.bind(this));
        this.bind('set_restitution', this.onSetRestitution.bind(this));
        this.bind('set_radius', this.onSetRadius)
    };
    CollisionCircleComponent = pc.inherits(CollisionCircleComponent, pc.fw.Component);
    
    pc.extend(CollisionCircleComponent.prototype, {
        onSetDensity: function (name, oldValue, newValue) {
            if (!this.entity.body2d) {
                return;
            }

            var body = this.entity.body2d.body;
            if (body) {
                // We only support a single fixture at the moment
                var fixture = body.GetFixtureList();
                fixture.SetDensity(newValue);

                // Update the body with changes
                body.ResetMassData();
            }                
        },

        onSetFriction: function (name, oldValue, newValue) {
            if (!this.entity.body2d) {
                return;
            }

            var body = this.entity.body2d.body;
            if (body) {
                // We only support a single fixture at the moment
                var fixture = body.GetFixtureList();
                fixture.SetFriction(newValue);

                // Update the body with changes
                body.ResetMassData();
            }                
        },

        onSetRestitution: function (name, oldValue, newValue) {
            if (!this.entity.body2d) {
                return;
            }

            var body = this.entity.body2d.body;
            if (body) {
                // We only support a single fixture at the moment
                var fixture = body.GetFixtureList();
                fixture.SetRestitution(newValue);

                // Update the body with changes
                body.ResetMassData();
            }                
        },

        onSetRadius: function (name, oldValue, newValue) {
            if (!this.entity.body2d) {
                return;
            }

            var body = this.entity.body2d.body;
            if (body) {
                var fixture = body.GetFixtureList();
                var shape = fixture.GetShape();
                
                shape.SetRadius(this.radius);

                body.SetAwake(true);
            }
        }
    });

    return {
        CollisionCircleComponent: CollisionCircleComponent
    };
}());