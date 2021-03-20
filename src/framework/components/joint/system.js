import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { JointComponent } from './component.js';
import { JointComponentData } from './data.js';

var _schema = ['enabled'];

/**
 * @private
 * @class
 * @name JointComponentSystem
 * @classdesc Creates and manages physics joint components.
 * @description Create a new JointComponentSystem.
 * @param {Application} app - The application.
 * @augments ComponentSystem
 */
class JointComponentSystem extends ComponentSystem {
    constructor(app) {
        super(app);

        this.id = 'joint';
        this.app = app;

        this.ComponentType = JointComponent;
        this.DataType = JointComponentData;

        this.schema = _schema;
    }

    initializeComponentData(component, data, properties) {
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
}

Component._buildAccessors(JointComponent.prototype, _schema);

export { JointComponentSystem };
