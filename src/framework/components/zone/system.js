import { Vec3 } from '../../../math/vec3.js';

import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { ZoneComponent } from './component.js';
import { ZoneComponentData } from './data.js';

const _schema = ['enabled'];

/**
 * @private
 * @class
 * @name pc.ZoneComponentSystem
 * @classdesc Defines zone in world.
 * @description Create a new ZoneComponentSystem.
 * @param {pc.Application} app - The application.
 * @augments pc.ComponentSystem
 */
var ZoneComponentSystem = function ZoneComponentSystem(app) {
    ComponentSystem.call(this, app);

    this.id = 'zone';

    this.ComponentType = ZoneComponent;
    this.DataType = ZoneComponentData;

    this.schema = _schema;

    this.on('beforeremove', this._onBeforeRemove, this);
};
ZoneComponentSystem.prototype = Object.create(ComponentSystem.prototype);
ZoneComponentSystem.prototype.constructor = ZoneComponentSystem;

Component._buildAccessors(ZoneComponent.prototype, _schema);

Object.assign(ZoneComponentSystem.prototype, {
    initializeComponentData: function (component, data, properties) {
        component.enabled = data.hasOwnProperty('enabled') ? !!data.enabled : true;

        if (data.size) {
            if (data.size instanceof Vec3) {
                component.size.copy(data.size);
            } else if (data.size instanceof Array && data.size.length >= 3) {
                component.size.set(data.size[0], data.size[1], data.size[2]);
            }
        }
    },

    cloneComponent: function (entity, clone) {
        var data = {
            size: entity.zone.size
        };

        return this.addComponent(clone, data);
    },

    _onBeforeRemove: function (entity, component) {
        component._onBeforeRemove();
    }
});

export { ZoneComponentSystem };
