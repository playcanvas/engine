import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { ButtonComponent } from './component.js';
import { ButtonComponentData } from './data.js';

var _schema = [
    'enabled',
    'active',
    { name: 'imageEntity', type: 'entity' },
    { name: 'hitPadding', type: 'vec4' },
    'transitionMode',
    { name: 'hoverTint', type: 'rgba' },
    { name: 'pressedTint', type: 'rgba' },
    { name: 'inactiveTint', type: 'rgba' },
    'fadeDuration',
    'hoverSpriteAsset',
    'hoverSpriteFrame',
    'pressedSpriteAsset',
    'pressedSpriteFrame',
    'inactiveSpriteAsset',
    'inactiveSpriteFrame'
];

/**
 * @class
 * @name pc.ButtonComponentSystem
 * @augments pc.ComponentSystem
 * @classdesc Manages creation of {@link pc.ButtonComponent}s.
 * @description Create a new ButtonComponentSystem.
 * @param {pc.Application} app - The application.
 */
function ButtonComponentSystem(app) {
    ComponentSystem.call(this, app);

    this.id = 'button';

    this.ComponentType = ButtonComponent;
    this.DataType = ButtonComponentData;

    this.schema = _schema;

    this.on('beforeremove', this._onRemoveComponent, this);

    ComponentSystem.bind('update', this.onUpdate, this);
}
ButtonComponentSystem.prototype = Object.create(ComponentSystem.prototype);
ButtonComponentSystem.prototype.constructor = ButtonComponentSystem;

Component._buildAccessors(ButtonComponent.prototype, _schema);

Object.assign(ButtonComponentSystem.prototype, {
    initializeComponentData: function (component, data, properties) {
        ComponentSystem.prototype.initializeComponentData.call(this, component, data, _schema);
    },

    onUpdate: function (dt) {
        var components = this.store;

        for (var id in components) {
            var entity = components[id].entity;
            var component = entity.button;
            if (component.enabled && entity.enabled) {
                component.onUpdate();
            }
        }
    },

    _onRemoveComponent: function (entity, component) {
        component.onRemove();
    }
});

export { ButtonComponentSystem };
