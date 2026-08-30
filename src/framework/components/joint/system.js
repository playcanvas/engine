import { ComponentSystem } from '../system.js';
import { JointComponent } from './component.js';

/**
 * @import { AppBase } from '../../app-base.js'
 */

const _properties = [
    'type',
    'enableCollision', 'breakImpulse',
    'enableLimits', 'limits', 'motorSpeed', 'maxMotorForce',
    'swingLimitY', 'swingLimitZ', 'twistLimit',
    'linearMotionX', 'linearMotionY', 'linearMotionZ',
    'linearLimitsX', 'linearLimitsY', 'linearLimitsZ',
    'linearStiffness', 'linearDamping', 'linearEquilibrium',
    'angularMotionX', 'angularMotionY', 'angularMotionZ',
    'angularLimitsX', 'angularLimitsY', 'angularLimitsZ',
    'angularStiffness', 'angularDamping', 'angularEquilibrium',
    // entity references are assigned last so the constraint is created with full configuration
    'entityA', 'entityB'
];

/**
 * Manages creation of {@link JointComponent}s.
 *
 * @category Physics
 * @alpha
 */
class JointComponentSystem extends ComponentSystem {
    /**
     * Joints waiting for their rigid bodies to enter the simulation.
     *
     * @type {Set<JointComponent>}
     * @private
     */
    _pending = new Set();

    /**
     * Joints with an active constraint and a finite break impulse.
     *
     * @type {Set<JointComponent>}
     * @private
     */
    _breakable = new Set();

    /**
     * Create a new JointComponentSystem instance.
     *
     * @param {AppBase} app - The application.
     * @ignore
     */
    constructor(app) {
        super(app);

        this.id = 'joint';

        this.ComponentType = JointComponent;

        this.on('beforeremove', this.onBeforeRemove, this);

        // subscribing in the constructor places these handlers ahead of the rigid body system's,
        // which only subscribes to 'update' once Ammo has loaded - pending joints are therefore
        // created before the physics step that follows
        this.app.systems.on('update', this.onUpdate, this);
        this.app.systems.on('postUpdate', this.onPostUpdate, this);
    }

    initializeComponentData(component, data, properties) {
        // apply the user-supplied properties through the public setters - all constraint
        // creation attempts are gated on _initialized, which is still false here
        for (let i = 0; i < _properties.length; i++) {
            const property = _properties[i];
            if (data[property] !== undefined) {
                component[property] = data[property];
            }
        }

        component._initialized = true;

        super.initializeComponentData(component, data);
    }

    cloneComponent(entity, clone) {
        const c = entity.joint;

        const data = {
            enabled: c.enabled
        };

        for (let i = 0; i < _properties.length; i++) {
            const property = _properties[i];
            data[property] = c[property];
        }

        return this.addComponent(clone, data);
    }

    onBeforeRemove(entity, component) {
        component.onBeforeRemove();
    }

    onUpdate(dt) {
        // retry joints waiting for their rigid bodies to enter the simulation - this runs before
        // the physics step, so newly-ready joints constrain it
        for (const component of this._pending) {
            component._tryCreateConstraint();
        }
    }

    onPostUpdate(dt) {
        // detect joints broken by the physics step
        for (const component of this._breakable) {
            component._checkBroken();
        }
    }

    destroy() {
        super.destroy();

        this.app.systems.off('update', this.onUpdate, this);
        this.app.systems.off('postUpdate', this.onPostUpdate, this);
    }
}

export { JointComponentSystem };
