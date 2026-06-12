import { BODYFLAG_NORESPONSE_OBJECT, BODYMASK_NOT_STATIC, BODYGROUP_TRIGGER, BODYSTATE_ACTIVE_TAG, BODYSTATE_DISABLE_SIMULATION } from '../rigid-body/constants.js';

/**
 * @import { AppBase } from '../../app-base.js'
 * @import { CollisionComponent } from './component.js'
 */

let _ammoVec1, _ammoQuat, _ammoTransform;

/**
 * Creates a trigger object used to create internal physics objects that interact with rigid bodies
 * and trigger collision events with no collision response.
 */
class Trigger {
    /**
     * Create a new Trigger instance.
     *
     * @param {AppBase} app - The running {@link AppBase}.
     * @param {CollisionComponent} component - The component for which the trigger will be created.
     */
    constructor(app, component) {
        this.entity = component.entity;
        this.component = component;
        this.app = app;

        if (typeof Ammo !== 'undefined' && !_ammoVec1) {
            _ammoVec1 = new Ammo.btVector3();
            _ammoQuat = new Ammo.btQuaternion();
            _ammoTransform = new Ammo.btTransform();
        }

        this.initialize();
    }

    initialize() {
        const entity = this.entity;
        const shape = this.component.shape;

        if (shape && typeof Ammo !== 'undefined') {
            if (entity.trigger) {
                entity.trigger.destroy();
            }

            const mass = 1;

            this._getEntityTransform(_ammoTransform);

            const body = this.app.systems.rigidbody.createBody(mass, shape, _ammoTransform);

            body.setRestitution(0);
            body.setFriction(0);
            body.setDamping(0, 0);
            _ammoVec1.setValue(0, 0, 0);
            body.setLinearFactor(_ammoVec1);
            body.setAngularFactor(_ammoVec1);

            body.setCollisionFlags(body.getCollisionFlags() | BODYFLAG_NORESPONSE_OBJECT);
            body.entity = entity;

            this.body = body;

            if (this.component.enabled && entity.enabled) {
                this.enable();
            }
        }
    }

    destroy() {
        if (!this.body) return;

        this.disable();

        this.app.systems.rigidbody.destroyBody(this.body);
        this.body = null;
    }

    _getEntityTransform(transform) {
        const bodyPos = this.component.getShapePosition();
        const bodyRot = this.component.getShapeRotation();
        _ammoVec1.setValue(bodyPos.x, bodyPos.y, bodyPos.z);
        _ammoQuat.setValue(bodyRot.x, bodyRot.y, bodyRot.z, bodyRot.w);

        transform.setOrigin(_ammoVec1);
        transform.setRotation(_ammoQuat);
    }

    updateTransform() {
        this._getEntityTransform(_ammoTransform);

        const body = this.body;
        body.setWorldTransform(_ammoTransform);
        body.activate();
    }

    enable() {
        const body = this.body;
        if (!body) return;

        const system = this.app.systems.rigidbody;
        const idx = system._triggers.indexOf(this);
        if (idx < 0) {
            system.addBody(body, BODYGROUP_TRIGGER, BODYMASK_NOT_STATIC ^ BODYGROUP_TRIGGER);
            system._triggers.push(this);
        }

        // set the body's activation state to active so that it is
        // simulated properly again
        body.forceActivationState(BODYSTATE_ACTIVE_TAG);

        this.updateTransform();
    }

    disable() {
        const body = this.body;
        if (!body) return;

        const system = this.app.systems.rigidbody;
        const idx = system._triggers.indexOf(this);
        if (idx > -1) {
            system.removeBody(body);
            system._triggers.splice(idx, 1);
        }

        // set the body's activation state to disable simulation so
        // that it properly deactivates after we remove it from the physics world
        body.forceActivationState(BODYSTATE_DISABLE_SIMULATION);
    }
}

export { Trigger };
