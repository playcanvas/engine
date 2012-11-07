pc.fw.AudioSourceComponentData = function AudioSourceComponentData() {
    // serialized
    this.assets = [];
    this.activate = true;
    this.volume = 1;
    this.loop = false;
    this['3d'] = true;
    
    this.minDistance = 1;
    this.maxDistance = 10000;
    this.rollOffFactor = 1;
    
    // not serialized
    this.paused = true;

    this.sources = {};
    this.currentSource = null;
    this.channel = null;
};