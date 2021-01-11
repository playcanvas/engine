import { math } from '../math/math.js';
import { Vec3 } from '../math/vec3.js';

import { DISTANCE_EXPONENTIAL, DISTANCE_INVERSE, DISTANCE_LINEAR } from './constants.js';
import { hasAudioContext } from './capabilities.js';
import { Channel } from './channel.js';

// default maxDistance, same as Web Audio API
const MAX_DISTANCE = 10000;

class Channel3d extends Channel {
    constructor(manager, sound, options) {
        super(manager, sound, options);

        this.position = new Vec3();
        this.velocity = new Vec3();

        if (this.hasAudioContext()) {
            this.panner = manager.context.createPanner();
        } else {
            this.maxDistance = MAX_DISTANCE;
            this.minDistance = 1;
            this.rollOffFactor = 1;
            this.distanceModel = DISTANCE_INVERSE;
        }
    }

    getPosition() {
        return this.position;
    }

    getVelocity() {
        return this.velocity;
    }
}

if (hasAudioContext()) {
    Object.assign(Channel3d.prototype, {
        setPosition: function (position) {
            this.position.copy(position);
            this.panner.setPosition(position.x, position.y, position.z);
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
} else {
    // temp vector storage
    let offset = new Vec3();

    // Fall off function which should be the same as the one in the Web Audio API
    // Taken from https://developer.mozilla.org/en-US/docs/Web/API/PannerNode/distanceModel
    function fallOff(posOne, posTwo, refDistance, maxDistance, rolloffFactor, distanceModel) {
        offset = offset.sub2(posOne, posTwo);
        let distance = offset.length();

        if (distance < refDistance) {
            return 1;
        } else if (distance > maxDistance) {
            return 0;
        }

        let result = 0;
        if (distanceModel === DISTANCE_LINEAR) {
            result = 1 - rolloffFactor * (distance - refDistance) / (maxDistance - refDistance);
        } else if (distanceModel === DISTANCE_INVERSE) {
            result = refDistance / (refDistance + rolloffFactor * (distance - refDistance));
        } else if (distanceModel === DISTANCE_EXPONENTIAL) {
            result = Math.pow(distance / refDistance, -rolloffFactor);
        }
        return math.clamp(result, 0, 1);
    }

    Object.assign(Channel3d.prototype, {
        setPosition: function (position) {
            this.position.copy(position);

            if (this.source) {
                const listener = this.manager.listener;

                const lpos = listener.getPosition();

                const factor = fallOff(lpos, this.position, this.minDistance, this.maxDistance, this.rollOffFactor, this.distanceModel);

                const v = this.getVolume();
                this.source.volume = v * factor;
            }
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
}

export { Channel3d };
