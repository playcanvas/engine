pc.extend(pc.fw, function() {
    function SkyboxComponentData() {
        this.posx = null;
        this.negx = null;
        this.posy = null;
        this.negy = null;
        this.posz = null;
        this.negz = null;
        
        this.assets = [];

        this.skybox = null;
    }
    SkyboxComponentData = SkyboxComponentData.extendsFrom(pc.fw.ComponentData);
    
    return {
        SkyboxComponentData:SkyboxComponentData 
    };
}());
editor.link.addComponentType("skybox");


editor.link.expose({
	system: "skybox",
	variable: "posx",
	displayName: "POSX",
	description: "URL of the positive X face of skybox cubemap",
	type: "asset",
    options: {
        max: 1
    },
    defaultValue: null  
});

editor.link.expose({
	system: "skybox",
	variable: "negx",
	displayName: "NEGX",
	description: "URL of the negative X face of skybox cubemap",
    type: "asset",
    options: {
        max: 1
    },
    defaultValue: null  
});

editor.link.expose({
	system: "skybox",
	variable: "posy",
	displayName: "POSY",
	description: "URL of the positive Y face of skybox cubemap",
    type: "asset",
    options: {
        max: 1
    },
    defaultValue: null  
});

editor.link.expose({
	system: "skybox",
	variable: "negy",
	displayName: "NEGY",
	description: "URL of the negative Y face of skybox cubemap",
    type: "asset",
    options: {
        max: 1
    },
    defaultValue: null  
});

editor.link.expose({
	system: "skybox",
	variable: "posz",
	displayName: "POSZ",
	description: "URL of the positive Z face of skybox cubemap",
    type: "asset",
    options: {
        max: 1
    },
    defaultValue: null  
});

editor.link.expose({
	system: "skybox",
	variable: "negz",
	displayName: "NEGZ",
	description: "URL of the negative Z face of skybox cubemap",
    type: "asset",
    options: {
        max: 1
    },
    defaultValue: null  
});