Object.assign(pc, function () {
    var _schema = ['enabled'];

    /**
     * @private
     * @class
     * @name pc.JointComponentSystem
     * @classdesc Creates and manages physics joint components.
     * @description Create a new JointComponentSystem.
     * @param {pc.Application} app - The application.
     * @augments pc.ComponentSystem
     */
    var JointComponentSystem = function JointComponentSystem(app) {
        pc.ComponentSystem.call(this, app);

        this.id = 'joint';
        this.app = app;

        this.ComponentType = pc.JointComponent;
        this.DataType = pc.JointComponentData;

        this.schema = _schema;
    };
    JointComponentSystem.prototype = Object.create(pc.ComponentSystem.prototype);
    JointComponentSystem.prototype.constructor = JointComponentSystem;

    pc.Component._buildAccessors(pc.JointComponent.prototype, _schema);

    Object.assign(JointComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            component.enabled = data.hasOwnProperty('enabled') ? !!data.enabled : true;

            if (data.angularLimitsX !== undefined) {
                component._angularLimitsX.copy(data.angularLimitsX);
            }
            if (data.angularLimitsY !== undefined) {
                component._angularLimitsY.copy(data.angularLimitsY);
            }
            if (data.angularLimitsZ !== undefined) {
                component._angularLimitsZ.copy(data.angularLimitsZ);
            }
            if (data.breakForce !== undefined) {
                component._breakForce = data.breakForce;
            }
            if (data.enableCollision !== undefined) {
                component._enableCollision = data.enableCollision;
            }
            if (data.entityA !== undefined) {
                component._entityA = data.entityA;
            }
            if (data.entityB !== undefined) {
                component._entityB = data.entityB;
            }
            if (data.linearLimitsX !== undefined) {
                component._linearLimitsX.copy(data.linearLimitsX);
            }
            if (data.linearLimitsY !== undefined) {
                component._linearLimitsY.copy(data.linearLimitsY);
            }
            if (data.linearLimitsZ !== undefined) {
                component._linearLimitsZ.copy(data.linearLimitsZ);
            }

            component._createConstraint();
        }
    });

    return {
        JointComponentSystem: JointComponentSystem
    };
}());
