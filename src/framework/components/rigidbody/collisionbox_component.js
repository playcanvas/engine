pc.extend(pc.fw, function () {

    /**
     * @private
     * @name pc.fw.CollisionBoxComponent
     * @constructor Create a new CollisionBoxComponent
     * @class 
     * @extends pc.fw.Component
     */
    var CollisionBoxComponent = function CollisionBoxComponent () {
        this.on('set_size', this.onSetSize, this);
    };
    CollisionBoxComponent = pc.inherits(CollisionBoxComponent, pc.fw.Component);
    
    pc.extend(CollisionBoxComponent.prototype, {

        onSetSize: function (name, oldValue, newValue) {
            if (this.entity.rigidbody) {
                this.data.shape = this.createShape(this.data.size[0], this.data.size[1], this.data.size[2]);
                this.entity.rigidbody.createBody();
            }
        },

        createShape: function (x, y, z) {
            if (typeof(Ammo) !== 'undefined') {
                return new Ammo.btBoxShape(new Ammo.btVector3(x, y, z));    
            } else {
                return undefined;
            }
        }
    });

    return {
        CollisionBoxComponent: CollisionBoxComponent
    };
}());