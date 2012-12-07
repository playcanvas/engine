if (typeof(Ammo) !== 'undefined') {
    pc.extend(pc.fw, function () {

        /**
         * @private
         * @name pc.fw.CollisionBoxComponent
         * @constructor Create a new CollisionBoxComponent
         * @class 
         * @extends pc.fw.Component
         */
        var CollisionBoxComponent = function CollisionBoxComponent () {
            this.bind('set_x', this.onSetX.bind(this));
            this.bind('set_y', this.onSetY.bind(this));
            this.bind('set_z', this.onSetZ.bind(this));
        };
        CollisionBoxComponent = pc.inherits(CollisionBoxComponent, pc.fw.Component);
        
        pc.extend(CollisionBoxComponent.prototype, {

            onSetX: function (name, oldValue, newValue) {
                if (!this.entity.body3d) {
                    return;
                }

                var body = this.entity.body3d.body;
                if (body) {
                }
            },

            onSetY: function (name, oldValue, newValue) {
                if (!this.entity.body3d) {
                    return;
                }
                
                var body = this.entity.body3d.body;

                if (body) {
                }
            },

            onSetZ: function (name, oldValue, newValue) {
                if (!this.entity.body3d) {
                    return;
                }
                
                var body = this.entity.body3d.body;

                if (body) {
                }
            }
        });

        return {
            CollisionBoxComponent: CollisionBoxComponent
        };
    }());
}