import { Vec3 } from '../../../core/math/vec3.js';
import { ComponentSystem } from '../system.js';
import { ZoneComponent } from './component.js';

/**
 * @import { AppBase } from '../../app-base.js'
 */

/**
 * Creates and manages {@link ZoneComponent} instances.
 *
 * @ignore
 */
class ZoneComponentSystem extends ComponentSystem {
    /**
     * Create a new ZoneComponentSystem.
     *
     * @param {AppBase} app - The application.
     * @ignore
     */
    constructor(app) {
        super(app);

        this.id = 'zone';

        this.ComponentType = ZoneComponent;

        this.on('beforeremove', this.onBeforeRemove, this);
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
            enabled: entity.zone.enabled,
            size: entity.zone.size
        };

        return this.addComponent(clone, data);
    }

    onBeforeRemove(entity, component) {
        component._onBeforeRemove();
    }
}

export { ZoneComponentSystem };
