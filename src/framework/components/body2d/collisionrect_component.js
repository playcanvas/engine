pc.extend(pc.fw, function () {
    /**
     * @private
     * @name pc.fw.CollisionRectComponent
     * @constructor Create a new CollisionRectComponent
     * @class 
     * @extends pc.fw.Component
     */
    var CollisionRectComponent = function CollisionRectComponent () {
        this.on('set_density', this.onSetDensity, this);
        this.on('set_friction', this.onSetFriction, this);
        this.on('set_restitution', this.onSetRestitution, this);
        this.on('set_x', this.onSetX, this);
        this.on('set_y', this.onSetY, this);
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