import { Component } from '../component.mjs';
import { ComponentSystem } from '../system.mjs';

import { JointComponent } from './component.mjs';
import { JointComponentData } from './data.mjs';

const _schema = ['enabled'];

/**
 * Creates and manages physics joint components.
 *
 * @augments ComponentSystem
 * @ignore
 */
class JointComponentSystem extends ComponentSystem {
    /**
     * Create a new JointComponentSystem instance.
     *
     * @param {import('../../app-base.mjs').AppBase} app - The application.
     * @hideconstructor
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
