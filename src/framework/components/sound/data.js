/**
 * @private
 * @constructor
 */
pc.SoundComponentData = function SoundComponentData() {
    // serialized
    this.enabled = true;
    this.volume = 1;
    this.pitch = 1;
    this.positional = true;
    this.refDistance = 1;
    this.maxDistance = 10000;
    this.rollOffFactor = 1;
    this.distanceModel = pc.DISTANCE_LINEAR;
    this.slots = {};

    // non serialized
    this.playingBeforeDisable = {};
};
