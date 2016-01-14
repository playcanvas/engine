pc.SoundComponentData = function SoundComponentData() {
    this.enabled = true;
    this.volume = 1;
    this.pitch = 1;
    this.loop = false;
    this.positional = true;
    this.slots = {};

    this.refDistance = 1;
    this.maxDistance = 10000;
    this.rollOffFactor = 1;
    this.distanceModel = pc.DISTANCE_INVERSE;
};