pc.extend(pc.fw, function() {
    function StaticCubeMapComponentData() {
        this.posx = null;
        this.negx = null;
        this.posy = null;
        this.negy = null;
        this.posz = null;
        this.negz = null;
        
        this.assets = [];

        this.cubemap = null;
    }
    StaticCubeMapComponentData = StaticCubeMapComponentData.extendsFrom(pc.fw.ComponentData);
    
    return {
        StaticCubeMapComponentData:StaticCubeMapComponentData 
    };
}());
editor.link.addComponentType("staticcubemap");


editor.link.expose({
	system: "staticcubemap",
	variable: "posx",
	displayName: "POSX",
	description: "URL of the positive X face of cubemap",
	type: "asset",
    options: {
        max: 1
    },
    defaultValue: null  
});

editor.link.expose({
	system: "staticcubemap",
	variable: "negx",
	displayName: "NEGX",
	description: "URL of the negative X face of cubemap",
    type: "asset",
    options: {
        max: 1
    },
    defaultValue: null  
});

editor.link.expose({
	system: "staticcubemap",
	variable: "posy",
	displayName: "POSY",
	description: "URL of the positive Y face of cubemap",
    type: "asset",
    options: {
        max: 1
    },
    defaultValue: null  
});

editor.link.expose({
	system: "staticcubemap",
	variable: "negy",
	displayName: "NEGY",
	description: "URL of the negative Y face of cubemap",
    type: "asset",
    options: {
        max: 1
    },
    defaultValue: null  
});

editor.link.expose({
	system: "staticcubemap",
	variable: "posz",
	displayName: "POSZ",
	description: "URL of the positive Z face of cubemap",
    type: "asset",
    options: {
        max: 1
    },
    defaultValue: null  
});

editor.link.expose({
	system: "staticcubemap",
	variable: "negz",
	displayName: "NEGZ",
	description: "URL of the negative Z face of cubemap",
    type: "asset",
    options: {
        max: 1
    },
    defaultValue: null  
});