pc.extend(pc, function () {
    /**
     * @private
     * @component
     * @name pc.BallSocketJointComponent
     * @constructor Create a new BallSocketJointComponent
     * @class A ball-socket joint limits translation such that the local pivot points of two rigid bodies
     * match in world space. A chain of rigidbodies can be connected using this constraint. 
     * @param {pc.BallSocketJointComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity that this Component is attached to.
     * @extends pc.Component
     */
    /**
     * @private
     * @field
     * @type pc.Vec3
     * @name pc.BallSocketJointComponent#pivot
     * @description The position of the pivot in the local space of the entity.
     */
    /**
     * @private
     * @field
     * @type pc.Vec3
     * @name pc.BallSocketJointComponent#position
     * @description The world space position of the constraint.
     */
    var BallSocketJointComponent = function BallSocketJointComponent (system, entity) {
        this.on('set_pivot', this.onSetPivot, this);
        this.on('set_position', this.onSetPosition, this);
        this.on('set_tau', this.onSetTau, this);
        this.on('set_damping', this.onSetDamping, this);
        this.on('set_impulseClamp', this.onSetImpulseClamp, this);
    };
    BallSocketJointComponent = pc.inherits(BallSocketJointComponent, pc.Component);
    
    pc.extend(BallSocketJointComponent.prototype, {

        onSetPivot: function (name, oldValue, newValue) {
            if (typeof Ammo !== 'undefined') {
                if (this.data.constraint) {
                    var pivotA = new Ammo.btVector3(newValue.x, newValue.y, newValue.z);
                    this.data.constraint.setPivotA(pivotA);
                }
            }
        },

        onSetPosition: function (name, oldValue, newValue) {
            if (typeof Ammo !== 'undefined') {
                if (this.data.constraint) {
                    var pivotB = new Ammo.btVector3(newValue.x, newValue.y, newValue.z);
                    this.data.constraint.setPivotB(pivotB);
                }
            }
        },

        onSetTau: function (name, oldValue, newValue) {
            if (typeof Ammo !== 'undefined') {
                if (this.data.constraint) {
                    this.data.constraint.get_m_setting().set_m_tau(newValue);;
                }
            }
        },

        onSetDamping: function (name, oldValue, newValue) {
            if (typeof Ammo !== 'undefined') {
                if (this.data.constraint) {
                    this.data.constraint.get_m_setting().set_m_damping(newValue);;
                }
            }
        },

        onSetImpulseClamp: function (name, oldValue, newValue) {
            if (typeof Ammo !== 'undefined') {
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