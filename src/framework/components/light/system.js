import { Color } from '../../../core/math/color.js';
import { Vec2 } from '../../../core/math/vec2.js';

import { LIGHTSHAPE_PUNCTUAL } from '../../../scene/constants.js';
import { Light, lightTypes } from '../../../scene/light.js';

import { ComponentSystem } from '../system.js';

import { _lightProps, LightComponent } from './component.js';
import { LightComponentData } from './data.js';

/**
 * A Light Component is used to dynamically light the scene.
 *
 * @augments ComponentSystem
 * @category Graphics
 */
class LightComponentSystem extends ComponentSystem {
    /**
     * Create a new LightComponentSystem instance.
     *
     * @param {import('../../app-base.js').AppBase} app - The application.
     * @hideconstructor
     */
    constructor(app) {
        super(app);

        this.id = 'light';

        this.ComponentType = LightComponent;
        this.DataType = LightComponentData;

        this.on('beforeremove', this._onRemoveComponent, this);
    }

    initializeComponentData(component, _data) {
        const properties = _lightProps;

        // duplicate because we're modifying the data
        const data = {};
        for (let i = 0, len = properties.length; i < len; i++) {
            const property = properties[i];
            data[property] = _data[property];
        }

        if (!data.type)
            data.type = component.data.type;

        component.data.type = data.type;

        if (data.layers && Array.isArray(data.layers)) {
            data.layers = data.layers.slice(0);
        }

        if (data.color && Array.isArray(data.color))
            data.color = new Color(data.color[0], data.color[1], data.color[2]);

        if (data.cookieOffset && data.cookieOffset instanceof Array)
            data.cookieOffset = new Vec2(data.cookieOffset[0], data.cookieOffset[1]);

        if (data.cookieScale && data.cookieScale instanceof Array)
            data.cookieScale = new Vec2(data.cookieScale[0], data.cookieScale[1]);

        if (data.enable) {
            console.warn('WARNING: enable: Property is deprecated. Set enabled property instead.');
            data.enabled = data.enable;
        }

        if (!data.shape) {
            data.shape = LIGHTSHAPE_PUNCTUAL;
        }

        const light = new Light(this.app.graphicsDevice, this.app.scene.clusteredLightingEnabled);
        light.type = lightTypes[data.type];
        light._node = component.entity;
        component.data.light = light;

        super.initializeComponentData(component, data, properties);
    }

    _onRemoveComponent(entity, component) {
        component.onRemove();
    }

    cloneComponent(entity, clone) {
        const light = entity.light;

        const data = [];
        let name;
        const _props = _lightProps;
        for (let i = 0; i < _props.length; i++) {
            name = _props[i];
            if (name === 'light') continue;
            if (light[name] && light[name].clone) {
                data[name] = light[name].clone();
            } else {
                data[name] = light[name];
            }
        }

        return this.addComponent(clone, data);
    }

    changeType(component, oldValue, newValue) {
        if (oldValue !== newValue) {
            component.light.type = lightTypes[newValue];
        }
    }
}

export { LightComponentSystem };
