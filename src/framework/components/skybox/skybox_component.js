pc.extend(pc.fw, function () {    
    /**
     * @component
     * @name pc.fw.SkyboxComponent
     * @constructor Create a new SkyboxComponent
     * @class A skybox is cube rendered around the camera. The texture on the inside of the cube is used to display the distant environment in a simple and efficient way.
     * Set a texture Asset to be used for each face of the cube.
     * @param {pc.fw.ApplicationContext} context
     * @extends pc.fw.Component
     * @property {String} negx Asset GUID of texture that is used for negative x face
     * @property {String} posx Asset GUID of texture that is used for positive x face
     * @property {String} negy Asset GUID of texture that is used for negative y face
     * @property {String} posy Asset GUID of texture that is used for positive y face
     * @property {String} negz Asset GUID of texture that is used for negative z face
     * @property {String} posz Asset GUID of texture that is used for positive z face
     */
    var SkyboxComponent = function SkyboxComponent (system, entity) {
        this.on("set", this.onSet, this);
    };
    SkyboxComponent = pc.inherits(SkyboxComponent, pc.fw.Component);

    pc.extend(SkyboxComponent.prototype, {
        onSet: function (name, oldValue, newValue) {
            function _loadTextureAsset(name, guid) {
                if(!guid)
                    return;

                var index = CUBE_MAP_NAMES.indexOf(name);
                var assets = this.entity.skybox.assets;
                
                // clear existing skybox
                this.data.model = null;
                
                if(guid) {
                    assets[index] = this.system.context.assets.getAsset(guid);
                    if (!assets[index]) {
                        logERROR(pc.string.format("Trying to load skybox component before asset {0} has loaded", guid));
                        return;
                    }
                    this.data.assets = assets;

                    // Once all assets are loaded create the skybox
                    if (assets[0] && assets[1] && assets[2] && assets[3] && assets[4] && assets[5]) {
                        var urls = assets.map(function (asset) { 
                            return asset.getFileUrl();
                        });
                        this.data.model = _createSkybox(this.entity, this.system.context, urls);

                        this.system.context.scene.addModel(this.data.model);
                        this.entity.removeChild(this.data.model.graph);
                    }
                } else {
                    delete assets[index];
                }
            }
            
            var functions = {
                "posx": function (entity, name, oldValue, newValue) { 
                        _loadTextureAsset.call(this, name, newValue);
                    },
                "negx": function (entity, name, oldValue, newValue) { 
                        _loadTextureAsset.call(this, name, newValue);
                    },
                "posy": function (entity, name, oldValue, newValue) { 
                        _loadTextureAsset.call(this, name, newValue);
                    },
                "negy": function (entity, name, oldValue, newValue) { 
                        _loadTextureAsset.call(this, name, newValue);
                    },
                "posz": function (entity, name, oldValue, newValue) { 
                        _loadTextureAsset.call(this, name, newValue);
                    },
                "negz": function (entity, name, oldValue, newValue) { 
                        _loadTextureAsset.call(this, name, newValue);
                    }
            };

            if (functions[name]) {
                functions[name].call(this, this.entity, name, oldValue, newValue);
            }
        }    
    });

    // Private    
    var _createSkybox = function (entity, context, urls) {
        var gd = context.graphicsDevice;

        var texture = new pc.gfx.Texture(gd, {
            format: pc.gfx.PIXELFORMAT_R8_G8_B8,
            cubemap: true
        });
        texture.minFilter = pc.gfx.FILTER_LINEAR_MIPMAP_LINEAR;
        texture.magFilter = pc.gfx.FILTER_LINEAR;
        texture.addressU = pc.gfx.ADDRESS_CLAMP_TO_EDGE;
        texture.addressV = pc.gfx.ADDRESS_CLAMP_TO_EDGE;

        var options = {
            parent: entity.getRequest()
        };
        var requests = urls.map(function (url) {
            return new pc.resources.ImageRequest(url);
        });
        
        context.loader.request(requests, options).then(function (resources) {
            texture.setSource(resources);
        });

        var library = gd.getProgramLibrary();
        var shader = library.getProgram('skybox');

        var material = new pc.scene.Material();
        material.setShader(shader);
        material.setParameter("texture_cubeMap", texture);
        material.cull = pc.gfx.CULLFACE_NONE;

        var node = new pc.scene.GraphNode();
        var mesh = pc.scene.procedural.createBox(gd);
        var meshInstance = new pc.scene.MeshInstance(node, mesh, material);

        var model = new pc.scene.Model();
        model.graph = node;
        model.meshInstances = [ meshInstance ];

        return model;
    };

    var CUBE_MAP_NAMES = [
        'posx',
        'negx',
        'posy',
        'negy',
        'posz',
        'negz'
    ];

    return {
        SkyboxComponent: SkyboxComponent
    };
}());

