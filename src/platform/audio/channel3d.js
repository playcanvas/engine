import { Debug } from '../../core/debug.js';
import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';

import { DISTANCE_EXPONENTIAL, DISTANCE_INVERSE, DISTANCE_LINEAR } from './constants.js';
import { hasAudioContext } from './capabilities.js';
import { Channel } from './channel.js';

// default maxDistance, same as Web Audio API
const MAX_DISTANCE = 10000;

/**
 * 3D audio channel.
 *
 * @ignore
 */
class Channel3d extends Channel {
    /**
     * Create a new Channel3d instance.
     *
     * @param {import('../sound/manager.js').SoundManager} manager - The SoundManager instance.
     * @param {import('../sound/sound.js').Sound} sound - The sound to playback.
     * @param {object} [options] - Optional options object.
     * @param {number} [options.volume=1] - The playback volume, between 0 and 1.
     * @param {number} [options.pitch=1] - The relative pitch, default of 1, plays at normal pitch.
     * @param {boolean} [options.loop=false] - Whether the sound should loop when it reaches the
     * end or not.
     */
    constructor(manager, sound, options) {
        super(manager, sound, options);

        this.position = new Vec3();
        this.velocity = new Vec3();

        if (hasAudioContext()) {
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

    setPosition(position) {
        this.position.copy(position);
        const panner = this.panner;
        if ('positionX' in panner) {
            panner.positionX.value = position.x;
            panner.positionY.value = position.y;
            panner.positionZ.value = position.z;
        } else if (panner.setPosition) { // Firefox (and legacy browsers)
            panner.setPosition(position.x, position.y, position.z);
        }
    }

    getVelocity() {
        Debug.warn('Channel3d#getVelocity is not implemented.');
        return this.velocity;
    }

    setVelocity(velocity) {
        Debug.warn('Channel3d#setVelocity is not implemented.');
        this.velocity.copy(velocity);
    }

    getMaxDistance() {
        return this.panner.maxDistance;
    }

    setMaxDistance(max) {
        this.panner.maxDistance = max;
    }

    getMinDistance() {
        return this.panner.refDistance;
    }

    setMinDistance(min) {
        this.panner.refDistance = min;
    }

    getRollOffFactor() {
        return this.panner.rolloffFactor;
    }

    setRollOffFactor(factor) {
        this.panner.rolloffFactor = factor;
    }

    getDistanceModel() {
        return this.panner.distanceModel;
    }

    setDistanceModel(distanceModel) {
        this.panner.distanceModel = distanceModel;
    }

    /**
     * Create the buffer source and connect it up to the correct audio nodes.
     *
     * @private
     */
    _createSource() {
        const context = this.manager.context;

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
}

if (!hasAudioContext()) {
    // temp vector storage
    let offset = new Vec3();

    // Fall off function which should be the same as the one in the Web Audio API
    // Taken from https://developer.mozilla.org/en-US/docs/Web/API/PannerNode/distanceModel
    const fallOff = function (posOne, posTwo, refDistance, maxDistance, rolloffFactor, distanceModel) {
        offset = offset.sub2(posOne, posTwo);
        const distance = offset.length();

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
    };

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
