import { Vec3 } from '../math/vec3.js';
import { Mat4 } from '../math/mat4.js';

/** @typedef {import('./manager.js').SoundManager} SoundManager */

/**
 * Represents an audio listener - used internally.
 *
 * @ignore
 */
class Listener {
    /**
     * Create a new listener instance.
     *
     * @param {SoundManager} manager - The sound manager.
     */
    constructor(manager) {
        /**
         * @type {SoundManager}
         * @private
         */
        this._manager = manager;

        /**
         * @type {Vec3}
         * @private
         */
        this.position = new Vec3();
        /**
         * @type {Vec3}
         * @private
         */
        this.velocity = new Vec3();
        /**
         * @type {Mat4}
         * @private
         */
        this.orientation = new Mat4();
    }

    /**
     * Get the position of the listener.
     *
     * @returns {Vec3} The position of the listener.
     */
    getPosition() {
        return this.position;
    }

    /**
     * Set the position of the listener.
     *
     * @param {Vec3} position - The new position of the listener.
     */
    setPosition(position) {
        this.position.copy(position);
        const listener = this.listener;
        if (listener) {
            listener.positionX.value = position.x;
            listener.positionY.value = position.y;
            listener.positionZ.value = position.z;
        }
    }

    /**
     * Get the velocity of the listener.
     *
     * @returns {Vec3} The velocity of the listener.
     */
    getVelocity() {
        return this.velocity;
    }

    /**
     * Set the velocity of the listener.
     *
     * @param {Vec3} velocity - The new velocity of the listener.
     */
    setVelocity(velocity) {
        this.velocity.copy(velocity);
        const listener = this.listener;
        if (listener) {
            listener.positionX.value = velocity.x;
            listener.positionY.value = velocity.y;
            listener.positionZ.value = velocity.z;
        }
    }

    /**
     * Set the orientation matrix of the listener.
     *
     * @param {Mat4} orientation - The new orientation matrix of the listener.
     */
    setOrientation(orientation) {
        this.orientation.copy(orientation);
        const listener = this.listener;
        if (listener) {
            const m = orientation.data;
            listener.forwardX.value = -m[8];
            listener.forwardY.value = -m[9];
            listener.forwardZ.value = -m[10];

            listener.upX.value = m[4];
            listener.upY.value = m[5];
            listener.upZ.value = m[6];
        }
    }

    /**
     * Get the orientation matrix of the listener.
     *
     * @returns {Mat4} The orientation matrix of the listener.
     */
    getOrientation() {
        return this.orientation;
    }

    /**
     * Get the listener.
     *
     * @type {AudioListener|null}
     */
    get listener() {
        const context = this._manager.context;
        return context ? context.listener : null;
    }
}

export { Listener };
