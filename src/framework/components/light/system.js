import { Color } from '../../../core/math/color.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { _properties, LightComponent } from './component.js';
import { LightComponentData } from './data.js';

/**
 * @import { AppBase } from '../../app-base.js'
 */

const _schema = ['enabled'];

/**
 * A Light Component is used to dynamically light the scene.
 *
 * @category Graphics
 */
class LightComponentSystem extends ComponentSystem {
    /**
     * Create a new LightComponentSystem instance.
     *
     * @param {AppBase} app - The application.
     * @ignore
     */
    constructor(app) {
        super(app);

        this.id = 'light';

        this.ComponentType = LightComponent;
        this.DataType = LightComponentData;

        this.schema = _schema;

        this.on('beforeremove', this._onRemoveComponent, this);
    }

    initializeComponentData(component, _data) {
        // duplicate because we're modifying the data
        const data = { ..._data };

        if (data.layers && Array.isArray(data.layers)) {
            data.layers = data.layers.slice(0);
        }

        if (data.color && Array.isArray(data.color)) {
            data.color = new Color(data.color[0], data.color[1], data.color[2]);
        }

        if (data.cookieOffset && data.cookieOffset instanceof Array) {
            data.cookieOffset = new Vec2(data.cookieOffset[0], data.cookieOffset[1]);
        }

        if (data.cookieScale && data.cookieScale instanceof Array) {
            data.cookieScale = new Vec2(data.cookieScale[0], data.cookieScale[1]);
        }

        if (data.hasOwnProperty('enable')) {
            console.warn('WARNING: enable: Property is deprecated. Set enabled property instead.');
            data.enabled = data.enable;
        }

        for (let i = 0; i < _properties.length; i++) {
            const property = _properties[i];
            if (data.hasOwnProperty(property)) {
                component[property] = data[property];
            }
        }

        super.initializeComponentData(component, data, ['enabled']);
    }

    _onRemoveComponent(entity, component) {
        component.onRemove();
    }

    cloneComponent(entity, clone) {
        const c = entity.light;

        const data = {
            enabled: c.enabled
        };

        for (let i = 0; i < _properties.length; i++) {
            const name = _properties[i];
            const value = c[name];

            if (value && value.clone) {
                data[name] = value.clone();
            } else {
                data[name] = value;
            }
        }

        return this.addComponent(clone, data);
    }
}

Component._buildAccessors(LightComponent.prototype, _schema);

export { LightComponentSystem };
