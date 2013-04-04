pc.extend(pc.fw, function() {
    var StaticCubeMapComponentData = function () {
        this.posx = null;
        this.negx = null;
        this.posy = null;
        this.negy = null;
        this.posz = null;
        this.negz = null;
        
        this.assets = [];

        this.cubemap = null;
    };
    StaticCubeMapComponentData = pc.inherits(StaticCubeMapComponentData, pc.fw.ComponentData);
    
    return {
        StaticCubeMapComponentData:StaticCubeMapComponentData 
    };
}());