pc.extend(pc.fw, function() {
    var SkyboxComponentData = function () {
        this.posx = null;
        this.negx = null;
        this.posy = null;
        this.negy = null;
        this.posz = null;
        this.negz = null;
        
        this.assets = [];

        this.model = null;
    };
    SkyboxComponentData = pc.inherits(SkyboxComponentData, pc.fw.ComponentData);
    
    return {
        SkyboxComponentData:SkyboxComponentData 
    };
}());