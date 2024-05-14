import { Vec3 } from '../../../core/math/vec3.js';

import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { ZoneComponent } from './component.js';
import { ZoneComponentData } from './data.js';

const _schema = ['enabled'];

/**
 * Creates and manages {@link ZoneComponent} instances.
 *
 * @ignore
 */
class ZoneComponentSystem extends ComponentSystem {
    /**
     * Create a new ZoneComponentSystem.
     *
     * @param {import('../../app-base.js').AppBase} app - The application.
     * @ignore
     */
    constructor(app) {
        super(app);

        this.id = 'zone';

        this.ComponentType = ZoneComponent;
        this.DataType = ZoneComponentData;

        this.schema = _schema;

        this.on('beforeremove', this._onBeforeRemove, this);
    }

    initializeComponentData(component, data, properties) {
        component.enabled = data.hasOwnProperty('enabled') ? !!data.enabled : true;

        if (data.size) {
            if (data.size instanceof Vec3) {
                component.size.copy(data.size);
            } else if (data.size instanceof Array && data.size.length >= 3) {
                component.size.set(data.size[0], data.size[1], data.size[2]);
            }
        }
    }

    cloneComponent(entity, clone) {
        const data = {
            size: entity.zone.size
        };

        return this.addComponent(clone, data);
    }

    _onBeforeRemove(entity, component) {
        component._onBeforeRemove();
    }
}

Component._buildAccessors(ZoneComponent.prototype, _schema);

export { ZoneComponentSystem };
