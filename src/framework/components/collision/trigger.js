import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { BODYTYPE_DYNAMIC } from '../rigid-body/constants.js';

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
        if (!this.body) return;

        this.app.systems.rigidbody.addTrigger(this);
        this.updateTransform();
    }

    disable() {
        if (!this.body) return;

        this.app.systems.rigidbody.removeTrigger(this);
    }
}

export { Trigger };
