import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { JointComponent } from './component.js';
import { JointComponentData } from './data.js';

const _schema = ['enabled'];

/**
 * Creates and manages physics joint components.
 *
 * @augments ComponentSystem
 * @private
 */
class JointComponentSystem extends ComponentSystem {
    /**
     * Create a new JointComponentSystem instance.
     *
     * @param {Application} app - The application.
     * @private
     */
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
