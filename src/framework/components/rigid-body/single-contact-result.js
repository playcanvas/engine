import { Vec3 } from '../../../core/math/vec3.js';

/**
 * @import { Entity } from '../../entity.js'
 * @import { ContactPoint } from './contact-point.js'
 */

/**
 * Represents the detailed data of a single contact point between two rigid bodies in the physics
 * simulation. This class provides comprehensive information about the contact, including the
 * entities involved, the exact contact points in both local and world space coordinates, the
 * contact normal, and the collision impulse force.
 *
 * Instances of this class are created by the physics engine when collision events occur and are
 * passed to event handlers only through the global `contact` event on the
 * {@link RigidBodyComponentSystem}. Individual rigid body components receive instances of
 * {@link ContactResult} instead.
 *
 * @example
 * app.systems.rigidbody.on('contact', (result) => {
 *     console.log(`Contact between ${result.a.name} and ${result.b.name}`);
 * });
 * @category Physics
 */
class SingleContactResult {
    /**
     * The first entity involved in the contact.
     *
     * @type {Entity}
     */
    a;

    /**
     * The second entity involved in the contact.
     *
     * @type {Entity}
     */
    b;

    /**
     * The total accumulated impulse applied by the constraint solver during the last
     * sub-step. Describes how hard two bodies collided.
     *
     * @type {number}
     */
    impulse;

    /**
     * The point on Entity A where the contact occurred, relative to A.
     *
     * @type {Vec3}
     */
    localPointA;

    /**
     * The point on Entity B where the contact occurred, relative to B.
     *
     * @type {Vec3}
     */
    localPointB;

    /**
     * The point on Entity A where the contact occurred, in world space.
     *
     * @type {Vec3}
     */
    pointA;

    /**
     * The point on Entity B where the contact occurred, in world space.
     *
     * @type {Vec3}
     */
    pointB;

    /**
     * The normal vector of the contact on Entity B, in world space.
     *
     * @type {Vec3}
     */
    normal;

    /**
     * Create a new SingleContactResult instance.
     *
     * @param {Entity} a - The first entity involved in the contact.
     * @param {Entity} b - The second entity involved in the contact.
     * @param {ContactPoint} contactPoint - The contact point between the two entities.
     * @ignore
     */
    constructor(a, b, contactPoint) {
        if (arguments.length !== 0) {
            this.a = a;
            this.b = b;
            this.impulse = contactPoint.impulse;
            this.localPointA = contactPoint.localPoint;
            this.localPointB = contactPoint.localPointOther;
            this.pointA = contactPoint.point;
            this.pointB = contactPoint.pointOther;
            this.normal = contactPoint.normal;
        } else {
            this.a = null;
            this.b = null;
            this.impulse = 0;
            this.localPointA = new Vec3();
            this.localPointB = new Vec3();
            this.pointA = new Vec3();
            this.pointB = new Vec3();
            this.normal = new Vec3();
        }
    }
}

export { SingleContactResult };
