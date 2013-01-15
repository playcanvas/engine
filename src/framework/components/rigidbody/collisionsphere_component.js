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
        this.on('set_radius', this.onSetRadius, this);
    };
    CollisionSphereComponent = pc.inherits(CollisionSphereComponent, pc.fw.Component);
    
    pc.extend(CollisionSphereComponent.prototype, {

        onSetRadius: function (name, oldValue, newValue) {
            if (this.entity.rigidbody) {
                if (typeof(Ammo) !== 'undefined') {
                    this.data.shape = new Ammo.btSphereShape(newValue);    
                }
                
                this.entity.rigidbody.createBody();
            }
        }
    });

    return {
        CollisionSphereComponent: CollisionSphereComponent
    };
}());