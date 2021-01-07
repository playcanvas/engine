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
 * @class
 * @name pc.ScrollbarComponentSystem
 * @augments pc.ComponentSystem
 * @classdesc Manages creation of {@link pc.ScrollbarComponent}s.
 * @description Create a new ScrollbarComponentSystem.
 * @param {pc.Application} app - The application.
 */
function ScrollbarComponentSystem(app) {
    ComponentSystem.call(this, app);

    this.id = 'scrollbar';

    this.ComponentType = ScrollbarComponent;
    this.DataType = ScrollbarComponentData;

    this.schema = _schema;

    this.on('beforeremove', this._onRemoveComponent, this);
}
ScrollbarComponentSystem.prototype = Object.create(ComponentSystem.prototype);
ScrollbarComponentSystem.prototype.constructor = ScrollbarComponentSystem;

Component._buildAccessors(ScrollbarComponent.prototype, _schema);

Object.assign(ScrollbarComponentSystem.prototype, {
    initializeComponentData: function (component, data, properties) {
        ComponentSystem.prototype.initializeComponentData.call(this, component, data, _schema);
    },

    _onRemoveComponent: function (entity, component) {
        component.onRemove();
    }
});

export { ScrollbarComponentSystem };
