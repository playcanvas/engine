import { Vec3 } from '../../../core/math/vec3.js';

import { Component } from '../component.js';

/**
 * The ZoneComponent allows you to define an area in world space of certain size. This can be used
 * in various ways, such as affecting audio reverb when {@link AudioListenerComponent} is within
 * zone. Or create culling system with portals between zones to hide whole indoor sections for
 * performance reasons. And many other possible options. Zones are building blocks and meant to be
 * used in many different ways.
 *
 * @ignore
 */
class ZoneComponent extends Component {
    /**
     * Fired when the zone component is enabled. This event does not take into account the enabled
     * state of the entity or any of its ancestors.
     *
     * @event
     * @example
     * entity.zone.on('enable', () => {
     *     console.log(`Zone component of entity '${entity.name}' has been enabled`);
     * });
     */
    static EVENT_ENABLE = 'enable';

    /**
     * Fired when the zone component is disabled. This event does not take into account the enabled
     * state of the entity or any of its ancestors.
     *
     * @event
     * @example
     * entity.zone.on('disable', () => {
     *     console.log(`Zone component of entity '${entity.name}' has been disabled`);
     * });
     */
    static EVENT_DISABLE = 'disable';

    /**
     * Fired when the enabled state of the zone component changes. This event does not take into
     * account the enabled state of the entity or any of its ancestors.
     *
     * @event
     * @example
     * entity.zone.on('state', (enabled) => {
     *     console.log(`Zone component of entity '${entity.name}' has been ${enabled ? 'enabled' : 'disabled'}`);
     * });
     */
    static EVENT_STATE = 'state';

    /**
     * Fired when a zone component is removed from an entity.
     *
     * @event
     * @example
     * entity.zone.on('remove', () => {
     *     console.log(`Zone component removed from entity '${entity.name}'`);
     * });
     */
    static EVENT_REMOVE = 'remove';

    /**
     * Create a new ZoneComponent instance.
     *
     * @param {import('./system.js').ZoneComponentSystem} system - The ComponentSystem that
     * created this Component.
     * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
     * attached to.
     */
    constructor(system, entity) {
        super(system, entity);

        this._oldState = true;
        this._size = new Vec3();
        this.on('set_enabled', this._onSetEnabled, this);
    }

    /**
     * The size of the axis-aligned box of this ZoneComponent.
     *
     * @type {Vec3}
     */
    set size(data) {
        if (data instanceof Vec3) {
            this._size.copy(data);
        } else if (data instanceof Array && data.length >= 3) {
            this.size.set(data[0], data[1], data[2]);
        }
    }

    get size() {
        return this._size;
    }

    onEnable() {
        this._checkState();
    }

    onDisable() {
        this._checkState();
    }

    _onSetEnabled(prop, old, value) {
        this._checkState();
    }

    _checkState() {
        const state = this.enabled && this.entity.enabled;
        if (state === this._oldState)
            return;

        this._oldState = state;

        this.fire('enable');
        this.fire('state', this.enabled);
    }

    _onBeforeRemove() {
        this.fire('remove');
    }
}

export { ZoneComponent };
