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
            if (this.entity.body3d) {
                this.data.shape = this.createShape(newValue, this.data.y, this.data.z);
                //this.data.shape = new Ammo.btBoxShape(new Ammo.btVector3(newValue, this.data.y, this.data.z));
                this.entity.body3d.createBody();
                //this.entity.body3d.body.activate();
            }
        },

        onSetY: function (name, oldValue, newValue) {
            if (this.entity.body3d) {
                this.data.shape = this.createShape(this.data.x, newValue, this.data.z);
                //this.data.shape = new Ammo.btBoxShape(new Ammo.btVector3(this.data.x, newValue, this.data.z));
                this.entity.body3d.createBody();
                //this.entity.body3d.body.activate();
            }
        },

        onSetZ: function (name, oldValue, newValue) {
            if (this.entity.body3d) {
                this.data.shape = this.createShape(this.data.x, this.data.y, newValue);
                //this.data.shape = new Ammo.btBoxShape(new Ammo.btVector3(this.data.x, this.data.y, newValue));
                this.entity.body3d.createBody();
                //this.entity.body3d.body.activate();
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