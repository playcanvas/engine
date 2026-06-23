/**
 * @import { Entity } from '../../entity.js'
 * @import { ContactPoint } from './contact-point.js'
 */

/**
 * Represents a collection of contact points between two entities in a physics collision.
 * When rigid bodies collide, this object stores the entity involved in the collision and
 * an array of specific contact points where the collision occurred. This information is
 * used by the physics system to resolve collisions and notify components through events.
 *
 * Instances of this class are passed to event handlers for the `contact` and `collisionstart`
 * events on individual {@link RigidBodyComponent} and {@link CollisionComponent} instances.
 *
 * Unlike {@link SingleContactResult} which is used for global contact events, ContactResult
 * objects provide information about collision from the perspective of one entity, with
 * information about which other entity was involved and all points of contact.
 *
 * Please refer to the following event documentation for more information:
 *
 * - {@link CollisionComponent.EVENT_CONTACT}
 * - {@link CollisionComponent.EVENT_COLLISIONSTART}
 * - {@link RigidBodyComponent.EVENT_CONTACT}
 * - {@link RigidBodyComponent.EVENT_COLLISIONSTART}
 *
 * @category Physics
 */
class ContactResult {
    /**
     * The entity that was involved in the contact with this entity.
     *
     * @type {Entity}
     */
    other;

    /**
     * An array of ContactPoints with the other entity.
     *
     * @type {ContactPoint[]}
     */
    contacts;

    /**
     * Create a new ContactResult instance.
     *
     * @param {Entity} other - The entity that was involved in the contact with this entity.
     * @param {ContactPoint[]} contacts - An array of ContactPoints with the other entity.
     * @ignore
     */
    constructor(other, contacts) {
        this.other = other;
        this.contacts = contacts;
    }
}

export { ContactResult };
