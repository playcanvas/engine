if (typeof(Ammo) !== 'undefined') {
    pc.extend(pc.fw, function () {
        /**
         * @private
         * @name pc.fw.CollisionSphereComponent
         * @constructor Create a new CollisionSphereComponent
         * @class 
         * @param {Object} context
         * @extends pc.fw.Component
         */
        var CollisionSphereComponent = function CollisionSphereComponent () {
            this.bind('set_radius', this.onSetRadius)
        };
        CollisionSphereComponent = pc.inherits(CollisionSphereComponent, pc.fw.Component);
        
        pc.extend(CollisionSphereComponent.prototype, {

            onSetRadius: function (name, oldValue, newValue) {
                if (!this.entity.body3d) {
                    return;
                }

                var body = this.entity.body3d.body;
                if (body) {
                    /*
                    var fixture = body.GetFixtureList();
                    var shape = fixture.GetShape();
                    
                    shape.SetRadius(this.radius);

                    body.SetAwake(true);
                    */
                }
            }
        });

        return {
            CollisionSphereComponent: CollisionSphereComponent
        };
    }());
}