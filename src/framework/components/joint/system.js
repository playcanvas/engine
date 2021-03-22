import { Vec2 } from '../../../math/vec2.js';

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
        const props = [
            'angularEquilibriumX', 'angularEquilibriumY', 'angularEquilibriumZ',
            'angularLimitsX', 'angularLimitsY', 'angularLimitsZ',
            'angularSpringX', 'angularSpringY', 'angularSpringZ',
            'angularStiffnessX', 'angularStiffnessY', 'angularStiffnessZ',
            'breakForce', 'enableCollision', 'enabled', 'entityA', 'entityB',
            'linearEquilibriumX', 'linearEquilibriumY', 'linearEquilibriumZ',
            'linearLimitsX', 'linearLimitsY', 'linearLimitsZ',
            'linearSpringX', 'linearSpringY', 'linearSpringZ',
            'linearStiffnessX', 'linearStiffnessY', 'linearStiffnessZ'
        ];

        for (const prop of props) {
            if (data.hasOwnProperty(prop)) {
                if (data[prop] instanceof Vec2) {
                    component['_' + prop].copy(data[prop]);
                } else {
                    component['_' + prop] = data[prop];
                }
            }
        }

        component._createConstraint();
    }
}

Component._buildAccessors(JointComponent.prototype, _schema);

export { JointComponentSystem };
