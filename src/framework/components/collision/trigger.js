import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { BODYMASK_NOT_STATIC, BODYGROUP_TRIGGER, BODYTYPE_DYNAMIC } from '../rigid-body/constants.js';

/**
 * @import { AppBase } from '../../app-base.js'
 * @import { CollisionComponent } from './component.js'
 */

const _position = new Vec3();
const _rotation = new Quat();

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

        this.initialize();
    }

    initialize() {
        const entity = this.entity;
        const shape = this.component.shape;
        const world = this.app.systems.rigidbody.physicsWorld;

        if (shape && world) {
            if (entity.trigger) {
                entity.trigger.destroy();
            }

            this._getEntityTransform(_position, _rotation);

            const body = world.createBody({
                type: BODYTYPE_DYNAMIC,
                mass: 1,
                shape: shape,
                position: _position,
                rotation: _rotation,
                entity: entity,
                noContactResponse: true
            });

            body.setRestitution(0);
            body.setFriction(0);
            body.setDamping(0, 0);
            body.setLinearFactor(Vec3.ZERO);
            body.setAngularFactor(Vec3.ZERO);

            this.body = body;

            if (this.component.enabled && entity.enabled) {
                this.enable();
            }
        }
    }

    destroy() {
        if (!this.body) return;

        this.disable();

        this.app.systems.rigidbody.physicsWorld.destroyBody(this.body);
        this.body = null;
    }

    _getEntityTransform(position, rotation) {
        position.copy(this.component.getShapePosition());
        rotation.copy(this.component.getShapeRotation());
    }

    updateTransform() {
        this._getEntityTransform(_position, _rotation);
        this.body.setTransform(_position, _rotation);
    }

    enable() {
        const body = this.body;
        if (!body) return;

        const system = this.app.systems.rigidbody;
        const idx = system._triggers.indexOf(this);
        if (idx < 0) {
            // addBody also puts the body into the active state so that it is simulated
            // properly again
            system.addBody(body, BODYGROUP_TRIGGER, BODYMASK_NOT_STATIC ^ BODYGROUP_TRIGGER);
            system._triggers.push(this);
        }

        this.updateTransform();
    }

    disable() {
        const body = this.body;
        if (!body) return;

        const system = this.app.systems.rigidbody;
        const idx = system._triggers.indexOf(this);
        if (idx > -1) {
            // removeBody also drops the body out of the active state so that it properly
            // deactivates after we remove it from the physics world
            system.removeBody(body);
            system._triggers.splice(idx, 1);
        }
    }
}

export { Trigger };
