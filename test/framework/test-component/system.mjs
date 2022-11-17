import { Component } from '../../../src/framework/components/component.js';
import { ComponentSystem } from '../../../src/framework/components/system.js';

import { DummyComponent } from './component.mjs';
import { DummyComponentData } from './data.mjs';

const dummySchema = [
    'enabled',
    { name: 'myEntity1', type: 'entity' },
    { name: 'myEntity2', type: 'entity' }
];

class DummyComponentSystem extends ComponentSystem {
    constructor(app) {
        super(app);

        this.id = 'dummy';

        this.ComponentType = DummyComponent;
        this.DataType = DummyComponentData;

        this.schema = dummySchema;
    }

    initializeComponentData(component, data, properties) {
        super.initializeComponentData(component, data, dummySchema);
    }
}

Component._buildAccessors(DummyComponent.prototype, dummySchema);

export { DummyComponentSystem };
