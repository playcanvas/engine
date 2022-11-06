import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { ScrollbarComponent } from './component.js';
import { ScrollbarComponentData } from './data.js';

const _schema = [
    { name: 'enabled', type: 'boolean' },
    { name: 'orientation', type: 'number' },
    { name: 'value', type: 'number' },
    { name: 'handleSize', type: 'number' },
    { name: 'handleEntity', type: 'entity' }
];

/**
 * Manages creation of {@link ScrollbarComponent}s.
 *
 * @augments ComponentSystem
 */
class ScrollbarComponentSystem extends ComponentSystem {
    /**
     * Create a new ScrollbarComponentSystem.
     *
     * @param {import('../../app-base.js').AppBase} app - The application.
     * @hideconstructor
     */
    constructor(app) {
        super(app);

        this.id = 'scrollbar';

        this.ComponentType = ScrollbarComponent;
        this.DataType = ScrollbarComponentData;

        this.schema = _schema;

        this.on('beforeremove', this._onRemoveComponent, this);
    }

    initializeComponentData(component, data, properties) {
        super.initializeComponentData(component, data, _schema);
    }

    _onRemoveComponent(entity, component) {
        component.onRemove();
    }
}

Component._buildAccessors(ScrollbarComponent.prototype, _schema);

export { ScrollbarComponentSystem };
