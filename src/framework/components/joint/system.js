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
        if (data.angularSpringX !== undefined) {
            component._angularSpringX = data.angularSpringX;
        }
        if (data.angularStiffnessX !== undefined) {
            component._angularStiffnessX = data.angularStiffnessX;
        }
        if (data.angularEquilibriumX !== undefined) {
            component._angularEquilibriumX = data.angularEquilibriumX;
        }
        if (data.angularLimitsY !== undefined) {
            component._angularLimitsY.copy(data.angularLimitsY);
        }
        if (data.angularSpringY !== undefined) {
            component._angularSpringY = data.angularSpringY;
        }
        if (data.angularStiffnessY !== undefined) {
            component._angularStiffnessY = data.angularStiffnessY;
        }
        if (data.angularEquilibriumY !== undefined) {
            component._angularEquilibriumY = data.angularEquilibriumY;
        }
        if (data.angularLimitsZ !== undefined) {
            component._angularLimitsZ.copy(data.angularLimitsZ);
        }
        if (data.angularSpringZ !== undefined) {
            component._angularSpringZ = data.angularSpringZ;
        }
        if (data.angularStiffnessZ !== undefined) {
            component._angularStiffnessZ = data.angularStiffnessZ;
        }
        if (data.angularEquilibriumZ !== undefined) {
            component._angularEquilibriumZ = data.angularEquilibriumZ;
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
        if (data.linearSpringX !== undefined) {
            component._linearSpringX = data.linearSpringX;
        }
        if (data.linearStiffnessX !== undefined) {
            component._linearStiffnessX = data.linearStiffnessX;
        }
        if (data.linearEquilibriumX !== undefined) {
            component._linearEquilibriumX = data.linearEquilibriumX;
        }
        if (data.linearLimitsY !== undefined) {
            component._linearLimitsY.copy(data.linearLimitsY);
        }
        if (data.linearSpringY !== undefined) {
            component._linearSpringY = data.linearSpringY;
        }
        if (data.linearStiffnessY !== undefined) {
            component._linearStiffnessY = data.linearStiffnessY;
        }
        if (data.linearEquilibriumY !== undefined) {
            component._linearEquilibriumY = data.linearEquilibriumY;
        }
        if (data.linearLimitsZ !== undefined) {
            component._linearLimitsZ.copy(data.linearLimitsZ);
        }
        if (data.linearSpringZ !== undefined) {
            component._linearSpringZ = data.linearSpringZ;
        }
        if (data.linearStiffnessZ !== undefined) {
            component._linearStiffnessZ = data.linearStiffnessZ;
        }
        if (data.linearEquilibriumZ !== undefined) {
            component._linearEquilibriumZ = data.linearEquilibriumZ;
        }

        component._createConstraint();
    }
}

Component._buildAccessors(JointComponent.prototype, _schema);

export { JointComponentSystem };
