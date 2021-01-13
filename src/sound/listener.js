import { Vec3 } from '../math/vec3.js';
import { Mat4 } from '../math/mat4.js';

/**
 * @private
 * @class
 * @name pc.Listener
 * @classdesc Represents an audio listener - used internally.
 * @param {pc.SoundManager} manager - The sound manager.
 */
class Listener {
    constructor(manager) {
        this._manager = manager;

        this.position = new Vec3();
        this.velocity = new Vec3();
        this.orientation = new Mat4();
    }

    getPosition() {
        return this.position;
    }

    setPosition(position) {
        this.position.copy(position);
        const listener = this.listener;
        if (listener) {
            listener.setPosition(position.x, position.y, position.z);
        }
    }

    getVelocity() {
        return this.velocity;
    }

    setVelocity(velocity) {
        this.velocity.copy(velocity);
        const listener = this.listener;
        if (listener) {
            listener.setPosition(velocity.x, velocity.y, velocity.z);
        }
    }

    setOrientation(orientation) {
        this.orientation.copy(orientation);
        const listener = this.listener;
        if (listener) {
            listener.setOrientation(-orientation.data[8], -orientation.data[9], -orientation.data[10],
                                    orientation.data[4], orientation.data[5], orientation.data[6]);
        }
    }

    getOrientation() {
        return this.orientation;
    }

    get listener() {
        const context = this._manager.context;
        return context ? context.listener : null;
    }
}

export { Listener };
