import { Color } from '../../../core/math/color.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { ComponentSystem } from '../system.js';
import { _properties, LightComponent } from './component.js';

/**
 * @import { AppBase } from '../../app-base.js'
 * @import { Entity } from '../../entity.js'
 */

/**
 * Options of the `light` component accepted by {@link LightComponentSystem} that differ from the
 * properties of {@link LightComponent}. Each replaces the same-named property of the options that
 * {@link Entity#addComponent} derives from the component class; see
 * {@link ComponentOptionsOverrides}.
 *
 * @typedef {object} LightComponentOptionsOverrides
 * @property {Color | number[]} [color] - Same as {@link LightComponent#color}, also accepting an
 * `[r, g, b]` array.
 * @property {Vec2 | number[]} [cookieOffset] - Same as {@link LightComponent#cookieOffset}, also
 * accepting an `[x, y]` array.
 * @property {Vec2 | number[]} [cookieScale] - Same as {@link LightComponent#cookieScale}, also
 * accepting an `[x, y]` array.
 * @property {boolean} [enable] - Deprecated alias of `enabled`.
 * @ignore
 */

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

        // 'enable' is a deprecated alias for 'enabled', handled in initializeComponentData
        this.extraDataProperties = ['enable'];

        this.on('beforeremove', this.onBeforeRemove, this);
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

        super.initializeComponentData(component, data);
    }

    onBeforeRemove(entity, component) {
        component.onBeforeRemove();
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

export { LightComponentSystem };
