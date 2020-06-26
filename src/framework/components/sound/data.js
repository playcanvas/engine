import { DISTANCE_LINEAR } from '../../../audio/constants.js';

function SoundComponentData() {
    // serialized
    this.enabled = true;
    this.volume = 1;
    this.pitch = 1;
    this.positional = true;
    this.refDistance = 1;
    this.maxDistance = 10000;
    this.rollOffFactor = 1;
    this.distanceModel = DISTANCE_LINEAR;
    this.slots = {};

    // non serialized
    this.playingBeforeDisable = {};
}

export { SoundComponentData };
