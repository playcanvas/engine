import { Vec3 } from '../math/vec3.js';
import { Mat4 } from '../math/mat4.js';

import { hasAudioContext } from '../audio/capabilities.js';

/**
 * @private
 * @class
 * @name pc.Listener
 * @classdesc Represents an audio listener - used internally.
 * @param {pc.SoundManager} manager - The sound manager.
 */
function Listener(manager) {
    this.position = new Vec3();
    this.velocity = new Vec3();
    this.orientation = new Mat4();

    if (hasAudioContext()) {
        this.listener = manager.context.listener;
    }
}

Object.assign(Listener.prototype, {
    getPosition: function () {
        return this.position;
    },

    setPosition: function (position) {
        this.position.copy(position);
        if (this.listener) {
            this.listener.setPosition(position.x, position.y, position.z);
        }
    },

    getVelocity: function () {
        return this.velocity;
    },

    setVelocity: function (velocity) {
        this.velocity.copy(velocity);
        if (this.listener) {
            this.listener.setPosition(velocity.x, velocity.y, velocity.z);
        }
    },

    setOrientation: function (orientation) {
        this.orientation.copy(orientation);
        if (this.listener) {
            this.listener.setOrientation(-orientation.data[8], -orientation.data[9], -orientation.data[10],
                                         orientation.data[4], orientation.data[5], orientation.data[6]);
        }
    },

    getOrientation: function () {
        return this.orientation;
    }
});

export { Listener };
