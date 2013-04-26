pc.extend(pc.fw, function () {
    /**
     * @component
     * @name pc.fw.StaticCubeMapComponent
     * @class Creates a static cubemap from assigned images
     * @constructor Create a new StaticCubeMapComponent
     * @param {pc.fw.StaticCubeMapComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.fw.Entity} entity The Entity that this Component is attached to.
     * @extends pc.fw.Component
     */
    var StaticCubeMapComponent = function StaticCubeMapComponent (system, entity) {
        this.on("set", this.onSet, this);
    };
    StaticCubeMapComponent = pc.inherits(StaticCubeMapComponent, pc.fw.Component);
    
    pc.extend(StaticCubeMapComponent.prototype, {
        onSet: function (name, oldValue, newValue) {
            function _loadTextureAsset(name, guid) {
                if(!guid)
                    return;

                var index = CUBE_MAP_NAMES.indexOf(name);
                var assets = this.assets;
                
                // clear existing cubemap
                this.cubemap = null;

                if (guid) {
                    assets[index] = this.system.context.assets.getAsset(guid);
                    
                    this.assets = assets;

                    if (assets[0] && assets[1] && assets[2] && assets[3] && assets[4] && assets[5]) {
                        var urls = assets.map(function (asset) { 
                            return asset.getFileUrl(); 
                        });
                        var cubemap = _createCubemap(this.entity, this.system.context, urls);
                        this.cubemap = cubemap;
                    }
                } else {
                    delete assets[index];                
                }
            }

            var functions = {
                "posx": function (name, oldValue, newValue) { 
                        _loadTextureAsset.call(this, name, newValue);
                    },
                "negx": function (name, oldValue, newValue) { 
                        _loadTextureAsset.call(this, name, newValue);
                    },
                "posy": function (name, oldValue, newValue) { 
                        _loadTextureAsset.call(this, name, newValue);
                    },
                "negy": function (name, oldValue, newValue) { 
                        _loadTextureAsset.call(this, name, newValue);
                    },
                "posz": function (name, oldValue, newValue) { 
                        _loadTextureAsset.call(this, name, newValue);
                    },
                "negz": function (name, oldValue, newValue) { 
                        _loadTextureAsset.call(this, name, newValue);
                    }
            };

            if (functions[name]) {
                functions[name].call(this, name, oldValue, newValue);
            }
        }
    });

    var CUBE_MAP_NAMES = [
        'posx',
        'negx',
        'posy',
        'negy',
        'posz',
        'negz'
    ];

    // Private    
    var _createCubemap = function (entity, context, urls) {
        var texture = new pc.gfx.Texture({
            format: pc.gfx.PIXELFORMAT_R8_G8_B8,
            cubemap: true
        });
        texture.minFilter = pc.gfx.FILTER_LINEAR_MIPMAP_LINEAR;
        texture.magFilter = pc.gfx.FILTER_LINEAR;
        texture.addressU = pc.gfx.ADDRESS_CLAMP_TO_EDGE;
        texture.addressV = pc.gfx.ADDRESS_CLAMP_TO_EDGE;
        
        var requests = urls.map(function (url) {
            return new pc.resources.ImageRequest(url);
        });
        var options = {
            parent: entity.getRequest()
        };
        context.loader.request(requests, options).then(function (resources) {
            texture.setSource(resources);
        });
        
        return texture;
    };

    return {
        StaticCubeMapComponent: StaticCubeMapComponent
    };
}());