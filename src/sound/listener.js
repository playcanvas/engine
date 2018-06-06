Object.assign(pc, function () {
    'use strict';

    /**
     * @private
     * @constructor
     * @name pc.Listener
     * @classdesc Represents an audio listener - used internally.
     * @param {pc.SoundManager} manager The sound manager
     */
    var Listener = function (manager) {
        this.position = new pc.Vec3();
        this.velocity = new pc.Vec3();
        this.orientation = new pc.Mat4();

        if (pc.AudioManager.hasAudioContext()) {
            this.listener = manager.context.listener;
        }
    };

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

    return {
        Listener: Listener
    };
}());
