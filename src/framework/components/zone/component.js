import { Vec3 } from '../../../core/math/vec3.js';

import { Component } from '../component.js';

/**
 * The ZoneComponent allows you to define an area in world space of certain size. This can be used
 * in various ways, such as affecting audio reverb when {@link AudioListenerComponent} is within
 * zone. Or create culling system with portals between zones to hide whole indoor sections for
 * performance reasons. And many other possible options. Zones are building blocks and meant to be
 * used in many different ways.
 *
 * @augments Component
 * @ignore
 */
class ZoneComponent extends Component {
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
     * Fired when Component becomes enabled. Note: this event does not take in account entity or
     * any of its parent enabled state.
     *
     * @event ZoneComponent#enable
     * @example
     * entity.zone.on('enable', function () {
     *     // component is enabled
     * });
     * @ignore
     */

    /**
     * Fired when Component becomes disabled. Note: this event does not take in account entity or
     * any of its parent enabled state.
     *
     * @event ZoneComponent#disable
     * @example
     * entity.zone.on('disable', function () {
     *     // component is disabled
     * });
     * @ignore
     */

    /**
     * Fired when Component changes state to enabled or disabled. Note: this event does not take in
     * account entity or any of its parent enabled state.
     *
     * @event ZoneComponent#state
     * @param {boolean} enabled - True if now enabled, False if disabled.
     * @example
     * entity.zone.on('state', function (enabled) {
     *     // component changed state
     * });
     * @ignore
     */

    /**
     * Fired when a zone is removed from an entity.
     *
     * @event ZoneComponent#remove
     * @example
     * entity.zone.on('remove', function () {
     *     // zone has been removed from an entity
     * });
     * @ignore
     */

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
