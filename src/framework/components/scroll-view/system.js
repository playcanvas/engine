import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { ScrollViewComponent } from './component.js';
import { ScrollViewComponentData } from './data.js';

var _schema = [
    { name: 'enabled', type: 'boolean' },
    { name: 'horizontal', type: 'boolean' },
    { name: 'vertical', type: 'boolean' },
    { name: 'scrollMode', type: 'number' },
    { name: 'bounceAmount', type: 'number' },
    { name: 'friction', type: 'number' },
    { name: 'dragThreshold', type: 'number' },
    { name: 'horizontalScrollbarVisibility', type: 'number' },
    { name: 'verticalScrollbarVisibility', type: 'number' },
    { name: 'viewportEntity', type: 'entity' },
    { name: 'contentEntity', type: 'entity' },
    { name: 'horizontalScrollbarEntity', type: 'entity' },
    { name: 'verticalScrollbarEntity', type: 'entity' }
];

var DEFAULT_DRAG_THRESHOLD = 10;

/**
 * @class
 * @name pc.ScrollViewComponentSystem
 * @augments pc.ComponentSystem
 * @classdesc Manages creation of {@link pc.ScrollViewComponent}s.
 * @description Create a new ScrollViewComponentSystem.
 * @param {pc.Application} app - The application.
 */
var ScrollViewComponentSystem = function ScrollViewComponentSystem(app) {
    ComponentSystem.call(this, app);

    this.id = 'scrollview';

    this.ComponentType = ScrollViewComponent;
    this.DataType = ScrollViewComponentData;

    this.schema = _schema;

    this.on('beforeremove', this._onRemoveComponent, this);

    ComponentSystem.bind('update', this.onUpdate, this);
};
ScrollViewComponentSystem.prototype = Object.create(ComponentSystem.prototype);
ScrollViewComponentSystem.prototype.constructor = ScrollViewComponentSystem;

Component._buildAccessors(ScrollViewComponent.prototype, _schema);

Object.assign(ScrollViewComponentSystem.prototype, {
    initializeComponentData: function (component, data, properties) {
        if (data.dragThreshold === undefined) {
            data.dragThreshold = DEFAULT_DRAG_THRESHOLD;
        }

        ComponentSystem.prototype.initializeComponentData.call(this, component, data, _schema);
    },

    onUpdate: function (dt) {
        var components = this.store;

        for (var id in components) {
            var entity = components[id].entity;
            var component = entity.scrollview;
            if (component.enabled && entity.enabled) {
                component.onUpdate();
            }

        }
    },

    _onRemoveComponent: function (entity, component) {
        component.onRemove();
    }
});

export { ScrollViewComponentSystem };
