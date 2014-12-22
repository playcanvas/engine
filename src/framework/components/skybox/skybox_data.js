pc.extend(pc, function() {
    var SkyboxComponentData = function () {
        this.enabled = true;
        this.posx = null;
        this.negx = null;
        this.posy = null;
        this.negy = null;
        this.posz = null;
        this.negz = null;

        this.assets = [];

        this.model = null;
    };
    SkyboxComponentData = pc.inherits(SkyboxComponentData, pc.ComponentData);
    
    return {
        SkyboxComponentData:SkyboxComponentData 
    };
}());