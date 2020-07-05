import { type } from '../../../core/core.js';
import { Color } from '../../../core/color.js';

import { Vec2 } from '../../../math/vec2.js';

import { LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_POINT, LIGHTTYPE_SPOT } from '../../../scene/constants.js';
import { Light } from '../../../scene/light.js';

import { ComponentSystem } from '../system.js';

import { _lightProps, LightComponent } from './component.js';
import { LightComponentData } from './data.js';

/**
 * @class
 * @name pc.LightComponentSystem
 * @augments pc.ComponentSystem
 * @classdesc A Light Component is used to dynamically light the scene.
 * @description Create a new LightComponentSystem.
 * @param {pc.Application} app - The application.
 */
var lightTypes = {
    'directional': LIGHTTYPE_DIRECTIONAL,
    'point': LIGHTTYPE_POINT,
    'spot': LIGHTTYPE_SPOT
};

function LightComponentSystem(app) {
    ComponentSystem.call(this, app);

    this.id = 'light';

    this.ComponentType = LightComponent;
    this.DataType = LightComponentData;

    this.on('beforeremove', this._onRemoveComponent, this);
}
LightComponentSystem.prototype = Object.create(ComponentSystem.prototype);
LightComponentSystem.prototype.constructor = LightComponentSystem;

Object.assign(LightComponentSystem.prototype, {
    initializeComponentData: function (component, _data) {
        var properties = _lightProps;

        // duplicate because we're modifying the data
        var data = {};
        for (var i = 0, len = properties.length; i < len; i++) {
            var property = properties[i];
            data[property] = _data[property];
        }

        if (!data.type)
            data.type = component.data.type;

        component.data.type = data.type;

        if (data.layers && type(data.layers) === 'array') {
            data.layers = data.layers.slice(0);
        }

        if (data.color && type(data.color) === 'array')
            data.color = new Color(data.color[0], data.color[1], data.color[2]);

        if (data.cookieOffset && data.cookieOffset instanceof Array)
            data.cookieOffset = new Vec2(data.cookieOffset[0], data.cookieOffset[1]);

        if (data.cookieScale && data.cookieScale instanceof Array)
            data.cookieScale = new Vec2(data.cookieScale[0], data.cookieScale[1]);

        if (data.enable) {
            console.warn("WARNING: enable: Property is deprecated. Set enabled property instead.");
            data.enabled = data.enable;
        }

        var light = new Light();
        light.type = lightTypes[data.type];
        light._node = component.entity;
        light._scene = this.app.scene;
        component.data.light = light;

        ComponentSystem.prototype.initializeComponentData.call(this, component, data, properties);
    },

    _onRemoveComponent: function (entity, component) {
        component.onRemove();
    },

    cloneComponent: function (entity, clone) {
        var light = entity.light;

        var data = [];
        var name;
        var _props = _lightProps;
        for (var i = 0; i < _props.length; i++) {
            name = _props[i];
            if (name === "light") continue;
            if (light[name] && light[name].clone) {
                data[name] = light[name].clone();
            } else {
                data[name] = light[name];
            }
        }

        this.addComponent(clone, data);
    },

    changeType: function (component, oldValue, newValue) {
        if (oldValue !== newValue) {
            component.light.type = lightTypes[newValue];
        }
    }
});

export { LightComponentSystem };
