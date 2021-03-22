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
        component.initFromData(data);
    }
}

Component._buildAccessors(JointComponent.prototype, _schema);

export { JointComponentSystem };
