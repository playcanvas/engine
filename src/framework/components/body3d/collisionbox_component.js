pc.extend(pc.fw, function () {

    /**
     * @private
     * @name pc.fw.CollisionBoxComponent
     * @constructor Create a new CollisionBoxComponent
     * @class 
     * @extends pc.fw.Component
     */
    var CollisionBoxComponent = function CollisionBoxComponent () {
        this.on('set_x', this.onSetX, this);
        this.on('set_y', this.onSetY, this);
        this.on('set_z', this.onSetZ, this);
    };
    CollisionBoxComponent = pc.inherits(CollisionBoxComponent, pc.fw.Component);
    
    pc.extend(CollisionBoxComponent.prototype, {

        onSetX: function (name, oldValue, newValue) {
            if (this.entity.body3d) {
                this.data.shape = this.createShape(newValue, this.data.y, this.data.z);
                this.entity.body3d.createBody();
            }
        },

        onSetY: function (name, oldValue, newValue) {
            if (this.entity.body3d) {
                this.data.shape = this.createShape(this.data.x, newValue, this.data.z);
                this.entity.body3d.createBody();
            }
        },

        onSetZ: function (name, oldValue, newValue) {
            if (this.entity.body3d) {
                this.data.shape = this.createShape(this.data.x, this.data.y, newValue);
                this.entity.body3d.createBody();
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