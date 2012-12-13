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
            if (this.entity.body3d) {
                if (typeof(Ammo) !== 'undefined') {
                    this.data.shape = new Ammo.btSphereShape(newValue);    
                }
                
                this.entity.body3d.createBody();
            }
        }
    });

    return {
        CollisionSphereComponent: CollisionSphereComponent
    };
}());