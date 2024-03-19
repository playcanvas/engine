import { Debug } from '../../core/debug.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';

/**
 * Represents an audio listener - used internally.
 *
 * @ignore
 */
class Listener {
    /**
     * @type {import('./manager.js').SoundManager}
     * @private
     */
    _manager;

    /**
     * @type {Vec3}
     * @private
     */
    position = new Vec3();

    /**
     * @type {Vec3}
     * @private
     */
    velocity = new Vec3();

    /**
     * @type {Mat4}
     * @private
     */
    orientation = new Mat4();

    /**
     * Create a new listener instance.
     *
     * @param {import('./manager.js').SoundManager} manager - The sound manager.
     */
    constructor(manager) {
        this._manager = manager;
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
            if ('positionX' in listener) {
                listener.positionX.value = position.x;
                listener.positionY.value = position.y;
                listener.positionZ.value = position.z;
            } else if (listener.setPosition) { // Firefox (and legacy browsers)
                listener.setPosition(position.x, position.y, position.z);
            }
        }
    }

    /**
     * Get the velocity of the listener.
     *
     * @returns {Vec3} The velocity of the listener.
     * @deprecated
     */
    getVelocity() {
        Debug.warn('Listener#getVelocity is not implemented.');
        return this.velocity;
    }

    /**
     * Set the velocity of the listener.
     *
     * @param {Vec3} velocity - The new velocity of the listener.
     * @deprecated
     */
    setVelocity(velocity) {
        Debug.warn('Listener#setVelocity is not implemented.');
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
            if ('forwardX' in listener) {
                listener.forwardX.value = -m[8];
                listener.forwardY.value = -m[9];
                listener.forwardZ.value = -m[10];

                listener.upX.value = m[4];
                listener.upY.value = m[5];
                listener.upZ.value = m[6];
            } else if (listener.setOrientation) { // Firefox (and legacy browsers)
                listener.setOrientation(-m[8], -m[9], -m[10], m[4], m[5], m[6]);
            }
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
