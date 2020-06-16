import { math } from '../math/math.js';
import { Vec3 } from '../math/vec3.js';

import { SoundManager } from '../sound/manager.js';

import { DISTANCE_EXPONENTIAL, DISTANCE_INVERSE, DISTANCE_LINEAR } from './constants.js';
import { Channel } from './channel.js';

// default maxDistance, same as Web Audio API
var MAX_DISTANCE = 10000;

var Channel3d;

if (SoundManager.hasAudioContext()) {
    Channel3d = function (manager, sound, options) {
        Channel.call(this, manager, sound, options);

        this.position = new Vec3();
        this.velocity = new Vec3();

        var context = manager.context;
        this.panner = context.createPanner();
    };
    Channel3d.prototype = Object.create(Channel.prototype);
    Channel3d.prototype.constructor = Channel3d;

    Object.assign(Channel3d.prototype, {
        getPosition: function () {
            return this.position;
        },

        setPosition: function (position) {
            this.position.copy(position);
            this.panner.setPosition(position.x, position.y, position.z);
        },

        getVelocity: function () {
            return this.velocity;
        },

        setVelocity: function (velocity) {
            this.velocity.copy(velocity);
            this.panner.setVelocity(velocity.x, velocity.y, velocity.z);
        },

        getMaxDistance: function () {
            return this.panner.maxDistance;
        },

        setMaxDistance: function (max) {
            this.panner.maxDistance = max;
        },

        getMinDistance: function () {
            return this.panner.refDistance;
        },

        setMinDistance: function (min) {
            this.panner.refDistance = min;
        },

        getRollOffFactor: function () {
            return this.panner.rolloffFactor;
        },

        setRollOffFactor: function (factor) {
            this.panner.rolloffFactor = factor;
        },

        getDistanceModel: function () {
            return this.pannel.distanceModel;
        },

        setDistanceModel: function (distanceModel) {
            this.panner.distanceModel = distanceModel;
        },

        /**
         * @private
         * @function
         * @name pc.Channel3d#_createSource
         * @description Create the buffer source and connect it up to the correct audio nodes.
         */
        _createSource: function () {
            var context = this.manager.context;

            this.source = context.createBufferSource();
            this.source.buffer = this.sound.buffer;

            // Connect up the nodes
            this.source.connect(this.panner);
            this.panner.connect(this.gain);
            this.gain.connect(context.destination);

            if (!this.loop) {
                // mark source as paused when it ends
                this.source.onended = this.pause.bind(this);
            }
        }
    });
} else if (SoundManager.hasAudio()) {
    // temp vector storage
    var offset = new Vec3();


    // Fall off function which should be the same as the one in the Web Audio API
    // Taken from https://developer.mozilla.org/en-US/docs/Web/API/PannerNode/distanceModel
    var fallOff = function (posOne, posTwo, refDistance, maxDistance, rolloffFactor, distanceModel) {
        offset = offset.sub2(posOne, posTwo);
        var distance = offset.length();

        if (distance < refDistance) {
            return 1;
        } else if (distance > maxDistance) {
            return 0;
        }

        var result = 0;
        if (distanceModel === DISTANCE_LINEAR) {
            result = 1 - rolloffFactor * (distance - refDistance) / (maxDistance - refDistance);
        } else if (distanceModel === DISTANCE_INVERSE) {
            result = refDistance / (refDistance + rolloffFactor * (distance - refDistance));
        } else if (distanceModel === DISTANCE_EXPONENTIAL) {
            result = Math.pow(distance / refDistance, -rolloffFactor);
        }
        return math.clamp(result, 0, 1);
    };

    Channel3d = function (manager, sound) {
        Channel.call(this, manager, sound);

        this.position = new Vec3();
        this.velocity = new Vec3();

        this.maxDistance = MAX_DISTANCE;
        this.minDistance = 1;
        this.rollOffFactor = 1;
        this.distanceModel = DISTANCE_INVERSE;
    };
    Channel3d.prototype = Object.create(Channel.prototype);
    Channel3d.prototype.constructor = Channel3d;

    Object.assign(Channel3d.prototype, {
        getPosition: function () {
            return this.position;
        },

        setPosition: function (position) {
            this.position.copy(position);

            if (this.source) {
                var listener = this.manager.listener;

                var lpos = listener.getPosition();

                var factor = fallOff(lpos, this.position, this.minDistance, this.maxDistance, this.rollOffFactor, this.distanceModel);

                var v = this.getVolume();
                this.source.volume = v * factor;
            }
        },

        getVelocity: function () {
            return this.velocity;
        },

        setVelocity: function (velocity) {
            this.velocity.copy(velocity);
        },

        getMaxDistance: function () {
            return this.maxDistance;
        },

        setMaxDistance: function (max) {
            this.maxDistance = max;
        },

        getMinDistance: function () {
            return this.minDistance;
        },

        setMinDistance: function (min) {
            this.minDistance = min;
        },

        getRollOffFactor: function () {
            return this.rollOffFactor;
        },

        setRollOffFactor: function (factor) {
            this.rollOffFactor = factor;
        },

        getDistanceModel: function () {
            return this.distanceModel;
        },

        setDistanceModel: function (distanceModel) {
            this.distanceModel = distanceModel;
        }
    });
} else {
    Channel3d = function () { };
}

export { Channel3d };
