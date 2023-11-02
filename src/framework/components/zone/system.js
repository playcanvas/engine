import { Vec3 } from '../../../core/math/vec3.js';

import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { ZoneComponent } from './component.js';
import { ZoneComponentData } from './data.js';

const _schema = ['enabled', 'shape', 'halfExtents', 'radius', 'useColliders'];

/**
 * Creates and manages {@link ZoneComponent} instances.
 *
 * @augments ComponentSystem
 */
class ZoneComponentSystem extends ComponentSystem {
    /**
     * Holds all the active zone components.
     *
     * @type {ZoneComponent[]}
     */
    zones = [];

    /**
     * Create a new ZoneComponentSystem instance.
     *
     * @param {import('../../app-base.js').AppBase} app - The Application.
     * @hideconstructor
     */
    constructor(app) {
        super(app);

        // Defining system name.
        this.id = 'zone';

        // Defining different types used by system.
        this.ComponentType = ZoneComponent;
        this.DataType = ZoneComponentData;

        // Define data schema.
        this.schema = _schema;

        // Own listeners.
        this.on('add', this.onAdd, this);
        this.on('beforeremove', this.onBeforeRemove, this);
        this.app.systems.on('update', this.onUpdate, this);
    }

    /**
     * Initialize component with default data.
     *
     * @param {*} component - The component to initialize.
     * @param {*} data - The data to initialize the component with.
     * @param {*} properties - .
     * @ignore
     */
    initializeComponentData(component, data, properties) {
        component.enabled = data.hasOwnProperty('enabled') ? !!data.enabled : true;

        if (data.shape) {
            component.shape = data.shape;
        }

        if (!isNaN(data.radius)) {
            component.radius = data.radius;
        }

        if (data.hasOwnProperty('useColliders')) {
            component.useColliders = !!data.useColliders;
        }

        if (data.halfExtents) {
            if (data.halfExtents instanceof Vec3) {
                component.halfExtents.copy(data.halfExtents);
            } else if (data.halfExtents instanceof Array && data.halfExtents.length >= 3) {
                component.halfExtents.set(data.halfExtents[0], data.halfExtents[1], data.halfExtents[2]);
            }

            component._halfExtentsLast.copy(component.halfExtents);
        }
    }

    /**
     * Function to clone component from one entity to another.
     *
     * @param {import('../../entity').Entity} entity - The entity to get the component from.
     * @param {import('../../entity').Entity} clone - The entity to assign the clonned component to.
     * @returns {Component} - Result component from clonning.
     * @ignore
     */
    cloneComponent(entity, clone) {
        const c = entity.zone;
        return this.addComponent(clone, {
            size: c.size,
            shape: c.shape,
            halfExtents: c.halfExtents,
            radius: c.radius
        });
    }

    /**
     * Callback function to call when a component is getting removed.
     *
     * @param {import('../../entity').Entity} entity - Entity the component is removed from.
     * @param {ZoneComponent} component - Component getting removed.
     * @private
     */
    onAdd(entity, component) {
        if (entity.enabled && component.enabled) {
            component.onEnable();
        }
    }

    /**
     * Callback function to call when a component is getting removed.
     *
     * @param {import('../../entity').Entity} entity - Entity the component is removed from.
     * @param {ZoneComponent} component - Component getting removed.
     * @private
     */
    onBeforeRemove(entity, component) {
        component.onDisable();
    }

    /**
     * Callback function to call on every systems update.
     *
     * @param {number} dt - Time since last update in seconds.
     * @private
     */
    onUpdate(dt) {
        const zones = this.zones;
        for (let i = 0, l = zones.length; i < l; i++) {
            zones[i].checkEntities(this.app._dirtyZoneEntities);
        }
        this.app._dirtyZoneEntities.forEach(e => {e._dirtyZone = false;});
        this.app._dirtyZoneEntities.length = 0;
    }

    /**
     * Adds a new zone to update.
     *
     * @param {ZoneComponent} zone - The zone to add.
     * @ignore
     */
    addZone(zone) {
        if (this.zones.indexOf(zone) === -1) {
            this.zones.push(zone);
        }
    }

    /**
     * Remove a zone from updates.
     *
     * @param {ZoneComponent} zone - The zone to remove.
     * @ignore
     */
    removeZone(zone) {
        const index = this.zones.indexOf(zone);
        if (index >= 0) {
            this.zones.splice(index, 1);
        }
    }

    /**
     * Destroy the Zone Component System.
     */
    destroy() {
        super.destroy();

        this.app.systems.off('update', this.onUpdate, this);
    }
}

Component._buildAccessors(ZoneComponent.prototype, _schema);

export { ZoneComponentSystem };
