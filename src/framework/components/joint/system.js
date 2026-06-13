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
     * Shared static Ammo body that world-pinned joints attach to - see {@link getFixedBody}.
     *
     * @type {object|null}
     * @private
     */
    _fixedBody = null;

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

    /**
     * Returns a shared static body, lazily created and never added to the dynamics world, that
     * world-pinned joints (entityB of null) attach to. Its transform is identity, so the frame a
     * joint computes against it is simply the joint's world frame. This mirrors Bullet's own
     * getFixedBody pattern and avoids the single-body constraint constructors, some of which do
     * not transform their frame to world space (notably btConeTwistConstraint).
     *
     * @returns {object} The shared static Ammo body.
     * @ignore
     */
    getFixedBody() {
        if (!this._fixedBody) {
            const transform = new Ammo.btTransform();
            transform.setIdentity();
            const motionState = new Ammo.btDefaultMotionState(transform);
            const shape = new Ammo.btSphereShape(0.001);
            const inertia = new Ammo.btVector3(0, 0, 0);
            const info = new Ammo.btRigidBodyConstructionInfo(0, motionState, shape, inertia);
            this._fixedBody = new Ammo.btRigidBody(info);
            Ammo.destroy(info);
            Ammo.destroy(inertia);
            Ammo.destroy(transform);
        }

        return this._fixedBody;
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

        if (this._fixedBody) {
            Ammo.destroy(this._fixedBody.getMotionState());
            Ammo.destroy(this._fixedBody.getCollisionShape());
            Ammo.destroy(this._fixedBody);
            this._fixedBody = null;
        }
    }
}

export { JointComponentSystem };
