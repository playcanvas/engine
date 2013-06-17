pc.extend(pc.fw, function () {
    /**
     * @component
     * @name pc.fw.BallSocketJointComponent
     * @constructor Create a new BallSocketJointComponent
     * @class A ball-socket joint limits translation such that the local pivot points of two rigid bodies
     * match in world space. A chain of rigidbodies can be connected using this constraint. 
     * @param {pc.fw.BallSocketJointComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.fw.Entity} entity The Entity that this Component is attached to.     
     * @property {pc.math.vec3} pivot The position of the pivot in the local space of the entity.
     * @property {pc.math.vec3} position The world space position of the constraint.
     * @extends pc.fw.Component
     */
    var BallSocketJointComponent = function BallSocketJointComponent (system, entity) {
        this.on('set_pivot', this.onSetPivot, this);
        this.on('set_position', this.onSetPosition, this);
        this.on('set_tau', this.onSetTau, this);
        this.on('set_damping', this.onSetDamping, this);
        this.on('set_impulseClamp', this.onSetImpulseClamp, this);
    };
    BallSocketJointComponent = pc.inherits(BallSocketJointComponent, pc.fw.Component);
    
    pc.extend(BallSocketJointComponent.prototype, {

        onSetPivot: function (name, oldValue, newValue) {
            if (typeof(Ammo) !== 'undefined') {
                if (this.data.constraint) {
                    var pivotA = new Ammo.btVector3(newValue[0], newValue[1], newValue[2]);
                    this.data.constraint.setPivotA(pivotA);
                }
            }
        },

        onSetPosition: function (name, oldValue, newValue) {
            if (typeof(Ammo) !== 'undefined') {
                if (this.data.constraint) {
                    var pivotB = new Ammo.btVector3(newValue[0], newValue[1], newValue[2]);
                    this.data.constraint.setPivotB(pivotB);
                }
            }
        },

        onSetTau: function (name, oldValue, newValue) {
            if (typeof(Ammo) !== 'undefined') {
                if (this.data.constraint) {
                    this.data.constraint.get_m_setting().set_m_tau(newValue);;
                }
            }
        },

        onSetDamping: function (name, oldValue, newValue) {
            if (typeof(Ammo) !== 'undefined') {
                if (this.data.constraint) {
                    this.data.constraint.get_m_setting().set_m_damping(newValue);;
                }
            }
        },

        onSetImpulseClamp: function (name, oldValue, newValue) {
            if (typeof(Ammo) !== 'undefined') {
                if (this.data.constraint) {
                    this.data.constraint.get_m_setting().set_m_impulseClamp(newValue);;
                }
            }
        }
    });

    return {
        BallSocketJointComponent: BallSocketJointComponent
    };
}());