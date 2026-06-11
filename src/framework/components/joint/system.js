import { ComponentSystem } from '../system.js';
import { JointComponent } from './component.js';

/**
 * @import { AppBase } from '../../app-base.js'
 */

/**
 * Creates and manages physics joint components.
 *
 * @ignore
 */
class JointComponentSystem extends ComponentSystem {
    /**
     * Create a new JointComponentSystem instance.
     *
     * @param {AppBase} app - The application.
     */
    constructor(app) {
        super(app);

        this.id = 'joint';
        this.app = app;

        this.ComponentType = JointComponent;
    }

    initializeComponentData(component, data, properties) {
        component.initFromData(data);

        super.initializeComponentData(component, data, ['enabled']);
    }

    cloneComponent(entity, clone) {
        return this.addComponent(clone, {
            enabled: entity.joint.enabled
        });
    }
}

export { JointComponentSystem };
