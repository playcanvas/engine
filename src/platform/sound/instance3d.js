import { Debug } from '../../core/debug.js';
import { Vec3 } from '../../core/math/vec3.js';
import { DISTANCE_LINEAR } from './constants.js';
import { SoundInstance } from './instance.js';

/**
 * @import { SoundManager } from './manager.js'
 * @import { Sound } from './sound.js'
 */

// default maxDistance, same as Web Audio API
const MAX_DISTANCE = 10000;

/**
 * A SoundInstance3d plays a {@link Sound} in 3D.
 *
 * @category Sound
 */
class SoundInstance3d extends SoundInstance {
    /** @private */
    _position = new Vec3();

    /** @private */
    _velocity = new Vec3();

    /**
     * Create a new SoundInstance3d instance.
     *
     * @param {SoundManager} manager - The sound manager.
     * @param {Sound} sound - The sound to play.
     * @param {object} options - Options for the instance.
     * @param {number} [options.volume] - The playback volume, between 0 and 1. Defaults to 1.
     * @param {number} [options.pitch] - The relative pitch. Defaults to 1 (plays at normal pitch).
     * @param {boolean} [options.loop] - Whether the sound should loop when it reaches the end or
     * not. Defaults to false.
     * @param {number} [options.startTime] - The time from which the playback will start. Default
     * is 0 to start at the beginning.
     * @param {number} [options.duration] - The total time after the startTime when playback will
     * stop or restart if loop is true.
     * @param {Vec3} [options.position] - The position of the sound in 3D space.
     * @param {string} [options.distanceModel] - Determines which algorithm to use to reduce the
     * volume of the audio as it moves away from the listener. Can be:
     *
     * - {@link DISTANCE_LINEAR}
     * - {@link DISTANCE_INVERSE}
     * - {@link DISTANCE_EXPONENTIAL}
     *
     * Defaults to {@link DISTANCE_LINEAR}.
     * @param {number} [options.refDistance] - The reference distance for reducing volume as the
     * sound source moves further from the listener. Defaults to 1.
     * @param {number} [options.maxDistance] - The maximum distance from the listener at which
     * audio falloff stops. Note the volume of the audio is not 0 after this distance, but just
     * doesn't fall off anymore. Defaults to 10000.
     * @param {number} [options.rollOffFactor] - The factor used in the falloff equation. Defaults
     * to 1.
     */
    constructor(manager, sound, options = {}) {
        super(manager, sound, options);

        // Web Audio is unavailable - the base class left the instance inert.
        if (!manager.context) {
            return;
        }

        if (options.position) {
            this.position = options.position;
        }

        this.maxDistance = options.maxDistance !== undefined ? Number(options.maxDistance) : MAX_DISTANCE;
        this.refDistance = options.refDistance !== undefined ? Number(options.refDistance) : 1;
        this.rollOffFactor = options.rollOffFactor !== undefined ? Number(options.rollOffFactor) : 1;
        this.distanceModel = options.distanceModel !== undefined ? options.distanceModel : DISTANCE_LINEAR;
    }

    /**
     * Allocate Web Audio resources for this instance.
     *
     * @private
     */
    _initializeNodes() {
        this.gain = this._manager.context.createGain();
        this.panner = this._manager.context.createPanner();
        this.panner.connect(this.gain);
        this._inputNode = this.panner;
        this._connectorNode = this.gain;
        this._connectorNode.connect(this._manager.context.destination);
    }

    /**
     * Sets the position of the sound in 3D space.
     *
     * @type {Vec3}
     */
    set position(value) {
        this._position.copy(value);
        const panner = this.panner;
        if (!panner) {
            return;
        }
        if ('positionX' in panner) {
            panner.positionX.value = value.x;
            panner.positionY.value = value.y;
            panner.positionZ.value = value.z;
        } else if (panner.setPosition) { // Firefox (and legacy browsers)
            panner.setPosition(value.x, value.y, value.z);
        }
    }

    /**
     * Gets the position of the sound in 3D space.
     *
     * @type {Vec3}
     */
    get position() {
        return this._position;
    }

    set velocity(velocity) {
        Debug.warn('SoundInstance3d#velocity is not implemented.');
        this._velocity.copy(velocity);
    }

    get velocity() {
        Debug.warn('SoundInstance3d#velocity is not implemented.');
        return this._velocity;
    }

    /**
     * Sets the maximum distance from the listener at which audio falloff stops. Note that the
     * volume of the audio is not 0 after this distance, but just doesn't fall off anymore.
     *
     * @type {number}
     */
    set maxDistance(value) {
        if (this.panner) {
            this.panner.maxDistance = value;
        }
    }

    /**
     * Gets the maximum distance from the listener at which audio falloff stops.
     *
     * @type {number}
     */
    get maxDistance() {
        return this.panner ? this.panner.maxDistance : 0;
    }

    /**
     * Sets the reference distance for reducing volume as the sound source moves further from the
     * listener.
     *
     * @type {number}
     */
    set refDistance(value) {
        if (this.panner) {
            this.panner.refDistance = value;
        }
    }

    /**
     * Gets the reference distance for reducing volume as the sound source moves further from the
     * listener.
     *
     * @type {number}
     */
    get refDistance() {
        return this.panner ? this.panner.refDistance : 0;
    }

    /**
     * Sets the factor used in the falloff equation.
     *
     * @type {number}
     */
    set rollOffFactor(value) {
        if (this.panner) {
            this.panner.rolloffFactor = value;
        }
    }

    /**
     * Gets the factor used in the falloff equation.
     *
     * @type {number}
     */
    get rollOffFactor() {
        return this.panner ? this.panner.rolloffFactor : 0;
    }

    /**
     * Sets which algorithm to use to reduce the volume of the audio as it moves away from
     * the listener. Can be:
     *
     * - {@link DISTANCE_LINEAR}
     * - {@link DISTANCE_INVERSE}
     * - {@link DISTANCE_EXPONENTIAL}
     *
     * Default is {@link DISTANCE_LINEAR}.
     *
     * @type {string}
     */
    set distanceModel(value) {
        if (this.panner) {
            this.panner.distanceModel = value;
        }
    }

    /**
     * Gets which algorithm to use to reduce the volume of the audio as it moves away from
     * the listener.
     *
     * @type {string}
     */
    get distanceModel() {
        return this.panner ? this.panner.distanceModel : DISTANCE_LINEAR;
    }
}

export { SoundInstance3d };
