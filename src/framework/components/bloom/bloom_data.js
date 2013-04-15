pc.extend(pc.fw, function() {
    var BloomComponentData = function () {
        this.bloomThreshold = 0.25;
        this.blurAmount = 4;
        this.bloomIntensity = 1.25;
        this.baseIntensity = 1.0;
        this.bloomSaturation = 1.0;
        this.baseSaturation = 1.0;
    };
    BloomComponentData = pc.inherits(BloomComponentData, pc.fw.ComponentData);
    
    return {
        BloomComponentData: BloomComponentData 
    };
}());
